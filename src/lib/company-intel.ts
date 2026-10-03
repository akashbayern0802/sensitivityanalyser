import prisma from '@/lib/db';
import { scanRSSFeed } from '@/lib/rss/rss-reader';
import {
  VERTEX_MODEL,
  buildAiClient,
  discoverExecutives,
  saveExecutivesToInbox,
} from '@/lib/executive-discovery';

const MAJOR_EVENT_TYPES = new Set(['funding', 'acquisition', 'leadership', 'launch', 'expansion']);
const COMPANY_CONCURRENCY = 5;
const DEFAULT_MAX_DISCOVERIES = 5; // caps LLM/search cost + runtime per run
const DISCOVERY_COOLDOWN_DAYS = 7; // don't re-discover the same company within a week

export function buildGoogleNewsUrl(company: string): string {
  const encoded = encodeURIComponent(`"${company}"`);
  return `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
}

interface ArticleAnalysis {
  summary: string;
  isMajorEvent: boolean;
  eventType: string;
}

async function analyzeArticle(
  ai: ReturnType<typeof buildAiClient>,
  company: string,
  title: string,
  snippet: string
): Promise<ArticleAnalysis | null> {
  const prompt = `You are a business news analyst. Return ONLY a raw JSON object (no markdown) with exactly these keys: "summary" (exactly 2 sentences focused on business impact), "isMajorEvent" (boolean), "eventType" (one of: funding, acquisition, leadership, launch, expansion, layoffs, regulatory, none). Set isMajorEvent=true ONLY for funding rounds, acquisitions or mergers, C-suite or leadership changes, major product launches, or major market expansions for ${company}. Routine coverage, opinion pieces, stock price chatter and passing mentions are NOT major events. Article title: ${title}. Article snippet: ${snippet}`;

  try {
    const res = await ai.models.generateContent({
      model: VERTEX_MODEL,
      contents: prompt,
      config: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = (res.text ?? '').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const eventType = String(parsed.eventType ?? 'none').toLowerCase();
    return {
      summary: String(parsed.summary ?? '').trim(),
      isMajorEvent: parsed.isMajorEvent === true && MAJOR_EVENT_TYPES.has(eventType),
      eventType,
    };
  } catch (e) {
    console.error(`[company-scan] Analysis failed for "${title}":`, e);
    return null;
  }
}

export interface CompanyScanOptions {
  autoDiscover: boolean;
  maxDiscoveries?: number;
}

export interface MajorEvent {
  company: string;
  title: string;
  eventType: string;
}

export interface AutoDiscovery {
  company: string;
  trigger: string;
  eventType: string;
  added: string[];
}

export async function runCompanyScan(opts: CompanyScanOptions) {
  const influencers = await prisma.influencer.findMany({
    where: { isSaved: true, companyName: { not: null } },
    select: { companyName: true },
  });

  const companies = Array.from(
    new Set(influencers.map((i) => i.companyName!.trim()).filter(Boolean))
  );

  if (companies.length === 0) {
    return {
      companies: [] as string[],
      newEvents: [] as unknown[],
      majorEvents: [] as MajorEvent[],
      autoDiscovered: [] as AutoDiscovery[],
      message: 'No companies to scan. Save some influencers first.',
    };
  }

  const ai = buildAiClient();
  const newEvents: unknown[] = [];
  const majorEvents: MajorEvent[] = [];

  const scanCompany = async (company: string) => {
    const feedUrl = buildGoogleNewsUrl(company);

    const target = await prisma.trackedTarget.upsert({
      where: { url: feedUrl },
      update: { name: company },
      create: { type: 'google-news', name: company, url: feedUrl, niche: 'company-news', isActive: true },
    });

    const rawEvents = await scanRSSFeed(feedUrl, company, 72);

    for (const event of rawEvents.slice(0, 5)) {
      const exists = await prisma.radarEvent.findFirst({ where: { url: event.url } });
      if (exists) continue;

      const analysis = await analyzeArticle(ai, company, event.title, event.summary);

      const saved = await prisma.radarEvent.create({
        data: {
          targetId: target.id,
          title: event.title,
          url: event.url,
          summary: analysis?.summary || event.summary || '',
          publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
          type: 'article',
          status: 'new',
        },
      });
      newEvents.push({ ...saved, companyName: company });

      if (analysis?.isMajorEvent) {
        majorEvents.push({ company, title: event.title, eventType: analysis.eventType });
      }
    }

    await prisma.trackedTarget.update({ where: { id: target.id }, data: { lastScanned: new Date() } });
  };

  // Scan companies in small batches to stay friendly to Google News + Gemini rate limits
  for (let i = 0; i < companies.length; i += COMPANY_CONCURRENCY) {
    const batch = companies.slice(i, i + COMPANY_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(scanCompany));
    results.forEach((r, idx) => {
      if (r.status === 'rejected') console.error(`[company-scan] ${batch[idx]} failed:`, r.reason);
    });
  }

  // Phase 4: major event -> auto-discover decision-makers into the CRM inbox
  const autoDiscovered: AutoDiscovery[] = [];
  if (opts.autoDiscover && majorEvents.length > 0) {
    const maxDiscoveries = opts.maxDiscoveries ?? DEFAULT_MAX_DISCOVERIES;
    const cooldownStart = new Date(Date.now() - DISCOVERY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    // One discovery per company per run, using its first major event as the trigger
    const byCompany = new Map<string, MajorEvent>();
    for (const ev of majorEvents) if (!byCompany.has(ev.company)) byCompany.set(ev.company, ev);

    for (const [company, ev] of byCompany) {
      if (autoDiscovered.length >= maxDiscoveries) break;

      const recent = await prisma.influencer.count({
        where: { companyName: company, source: 'auto', createdAt: { gte: cooldownStart } },
      });
      if (recent > 0) continue;

      try {
        const found = await discoverExecutives(company, ev.title);
        const created = await saveExecutivesToInbox(company, found);
        autoDiscovered.push({
          company,
          trigger: ev.title,
          eventType: ev.eventType,
          added: created.map((c) => c.name),
        });
      } catch (e) {
        console.error(`[auto-discovery] ${company} failed:`, e);
      }
    }
  }

  return { companies, newEvents, majorEvents, autoDiscovered, message: undefined as string | undefined };
}

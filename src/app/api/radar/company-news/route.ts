import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import prisma from '@/lib/db';
import { scanRSSFeed } from '@/lib/rss/rss-reader';

const VERTEX_MODEL = 'gemini-3.8-flash';

function buildGoogleNewsUrl(company: string): string {
  const encoded = encodeURIComponent(`"${company}"`);
  return `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
}

function buildClient() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_VERTEX_API_KEY not set');
  return new GoogleGenAI({ vertexai: true, apiKey });
}

// POST: Scan Google News for all CRM companies
export async function POST() {
  try {
    // 1. Get all unique company names from saved influencers
    const influencers = await prisma.influencer.findMany({
      where: { isSaved: true, companyName: { not: null } },
      select: { companyName: true }
    });
    
    const companies = Array.from(
      new Set(influencers.map(i => i.companyName!.trim()).filter(Boolean))
    );

    if (companies.length === 0) {
      return NextResponse.json({ success: true, message: 'No companies to scan. Save some influencers first.', events: [] });
    }

    const ai = buildClient();
    const allNewEvents: any[] = [];

    // 2. For each company, upsert a TrackedTarget and scan Google News RSS
    await Promise.allSettled(companies.map(async (company) => {
      const feedUrl = buildGoogleNewsUrl(company);
      
      // Upsert a TrackedTarget for this company
      const target = await prisma.trackedTarget.upsert({
        where: { url: feedUrl },
        update: { name: company },
        create: {
          type: 'google-news',
          name: company,
          url: feedUrl,
          niche: 'company-news',
          isActive: true,
        }
      });

      // Scan the RSS feed (last 72 hours)
      const rawEvents = await scanRSSFeed(feedUrl, company, 72);

      // 3. For each article, generate a 2-sentence summary via LLM and save as RadarEvent
      for (const event of rawEvents.slice(0, 5)) { // cap at 5 per company
        const exists = await prisma.radarEvent.findFirst({ where: { url: event.url } });
        if (exists) continue;

        // LLM summarization
        let aiSummary = event.summary;
        try {
          const { text } = await ai.models.generateContent({
            model: VERTEX_MODEL,
            contents: `Summarize this news article about ${company} in exactly 2 sentences. Focus on the business impact. Article: ${event.title}. ${event.summary}`,
            config: { temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } }
          }).then(r => ({ text: r.text ?? '' }));
          if (text) aiSummary = text.trim();
        } catch { /* use raw summary as fallback */ }

        const saved = await prisma.radarEvent.create({
          data: {
            targetId: target.id,
            title: event.title,
            url: event.url,
            summary: aiSummary || event.summary || '',
            publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
            type: 'article',
            status: 'new',
          }
        });
        allNewEvents.push({ ...saved, companyName: company });
      }

      await prisma.trackedTarget.update({
        where: { id: target.id },
        data: { lastScanned: new Date() }
      });
    }));

    return NextResponse.json({ 
      success: true, 
      scanned: companies.length,
      newEvents: allNewEvents.length,
      events: allNewEvents,
      companies
    });
  } catch (error: any) {
    console.error('Company news scan error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Return all company news events (google-news type targets only), grouped by company
export async function GET() {
  try {
    const events = await prisma.radarEvent.findMany({
      where: { target: { type: 'google-news' } },
      orderBy: { publishedAt: 'desc' },
      include: { target: true },
      take: 100,
    });

    // Group by company (target.name)
    const grouped = events.reduce((acc: Record<string, any[]>, event) => {
      const company = event.target.name;
      if (!acc[company]) acc[company] = [];
      acc[company].push(event);
      return acc;
    }, {});

    return NextResponse.json({ success: true, grouped, events });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

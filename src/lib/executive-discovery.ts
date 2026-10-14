import { GoogleGenAI } from '@google/genai';
import prisma from '@/lib/db';

export async function getVertexModel(): Promise<string> {
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: 'user_mock_id' } });
    if (dbUser?.llmModel) return dbUser.llmModel;
  } catch {
    // fallback
  }
  return 'gemini-4-argon';
}

export const VERTEX_MODEL = 'gemini-4-argon';

export interface DiscoveredExecutive {
  name: string;
  company?: string;
  headline?: string;
  linkedinUrl?: string;
  whyFollow?: string;
  topics?: string[];
}

export function buildAiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_VERTEX_API_KEY is not set.');
  const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_VERTEX_PROJECT_ID || 'sensitivity-analyser';
  const location = process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_VERTEX_REGION || 'global';
  return new GoogleGenAI({ vertexai: true, apiKey, project, location });
}

function extractJsonArray(rawText: string): DiscoveredExecutive[] | null {
  if (!rawText?.trim()) return null;
  const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Finds up to 5 senior decision-makers at a company using Google Search grounding,
 * then formats them as JSON. India-focused, matching the manual discovery flow.
 */
export async function discoverExecutives(
  company: string,
  triggerContext?: string
): Promise<DiscoveredExecutive[]> {
  const ai = buildAiClient();

  // IMPORTANT: keep this prompt on a SINGLE line. Multi-line prompts make the
  // Google Search grounding tool silently return an empty candidate.
  const researchPrompt = `Find the names, current job titles, company names and LinkedIn profile URLs of 5 senior decision-makers (founders, C-suite, VPs, heads of product or engineering) currently working at ${company} in India${
    triggerContext ? `, who are relevant given this recent news: ${triggerContext}` : ''
  }. List 5 specific real people.`;

  const modelName = await getVertexModel();

  let research: any;
  try {
    research = await ai.models.generateContent({
      model: modelName,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  } catch (err: any) {
    if (modelName !== 'gemini-3.8-flash') {
      console.warn(`[executive-discovery] Model ${modelName} failed, falling back to gemini-3.8-flash:`, err?.message);
      research = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: researchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
    } else {
      throw err;
    }
  }

  let researchText = '';
  for (const part of research.candidates?.[0]?.content?.parts ?? []) {
    if ((part as { text?: string }).text) researchText += (part as { text?: string }).text;
  }
  if (!researchText) researchText = research.text ?? '';
  if (!researchText) return [];

  const formatPrompt = `Extract the people from this research text and return ONLY a raw JSON array with no prose or markdown. Each item must have: name, company (employer name only), headline (job title + company), linkedinUrl, whyFollow, topics (string array). Research: ${researchText.substring(0, 3000)}`;

  let formatted: any;
  try {
    formatted = await ai.models.generateContent({
      model: modelName,
      contents: formatPrompt,
      config: { temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
    });
  } catch (err: any) {
    if (modelName !== 'gemini-3.8-flash') {
      formatted = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: formatPrompt,
        config: { temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
      });
    } else {
      throw err;
    }
  }

  return extractJsonArray(formatted.text ?? '') ?? [];
}

function normalizeLinkedInUrl(raw: string | undefined, name: string): string {
  let url = raw?.trim() || '';
  if (url && !url.startsWith('http') && !url.includes('linkedin')) {
    url = `https://www.linkedin.com/in/${url}`;
  }
  if (!url || !url.includes('linkedin')) {
    url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`;
  }
  return url;
}

/**
 * Saves discovered executives into the CRM Inbox. Existing records are never
 * modified (so we don't push someone you already engaged back into the inbox).
 * Returns only the NEW contacts that were created.
 */
export async function saveExecutivesToInbox(
  company: string,
  executives: DiscoveredExecutive[]
): Promise<{ id: string; name: string }[]> {
  const created: { id: string; name: string }[] = [];

  for (const exec of executives) {
    if (!exec.name?.trim()) continue;
    const linkedinUrl = normalizeLinkedInUrl(exec.linkedinUrl, exec.name);

    try {
      const existing = await prisma.influencer.findUnique({ where: { linkedinUrl } });
      if (existing) continue;

      const record = await prisma.influencer.create({
        data: {
          name: exec.name.trim(),
          linkedinUrl,
          headline: exec.headline ?? '',
          companyName: exec.company?.trim() || company,
          interests: JSON.stringify(exec.topics ?? []),
          relevanceScore: 0.8,
          isSaved: true,
          status: 'inbox',
          source: 'auto',
        },
      });
      created.push({ id: record.id, name: record.name });
    } catch (e) {
      console.error(`[auto-discovery] Failed to save ${exec.name} (${company}):`, e);
    }
  }

  return created;
}

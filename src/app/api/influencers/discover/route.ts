import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import prisma from '@/lib/db';

const VERTEX_MODEL = 'gemini-3.8-flash';

interface DiscoveredInfluencer {
  name: string;
  company: string;
  headline: string;
  linkedinUrl: string;
  whyFollow: string;
  topics: string[];
}

function buildClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_VERTEX_API_KEY is not set in your .env file.');
  return new GoogleGenAI({ vertexai: true, apiKey });
}

function extractJsonArray(rawText: string): DiscoveredInfluencer[] | null {
  if (!rawText?.trim()) return null;

  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* continue */ }
  }

  const stripped = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  const strippedMatch = stripped.match(/\[[\s\S]*\]/);
  if (strippedMatch) {
    try {
      const parsed = JSON.parse(strippedMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* continue */ }
  }

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const wrapped = `[${rawText.substring(firstBrace, lastBrace + 1)}]`;
      const parsed = JSON.parse(wrapped);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* continue */ }
  }

  return null;
}

async function discoverInfluencers(
  query: string,
  country?: string
): Promise<DiscoveredInfluencer[]> {
  const ai = buildClient();

  const countryClause =
    country && country.trim()
      ? `CONSTRAINT: They MUST be based in or primarily associated with ${country}.`
      : '';

  // STEP 1: Grounded Research
  // IMPORTANT: Keep this as a SINGLE LINE. Multi-line prompts cause the Google Search
  // grounding tool to silently abort and return an empty candidate.
  const regionSuffix = country && country.trim() ? ` based in ${country}` : '';
  const researchPrompt = `Find the names, current job titles, company names, LinkedIn profile URLs, and why they are influential for ${query}${regionSuffix}. List 5 specific real people.`;

  console.log('[discover] Step 1: Running grounded research...');
  let researchResponse;
  try {
    researchResponse = await ai.models.generateContent({
      model: VERTEX_MODEL,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking — cuts 20-40s of latency
      },
    });
  } catch (err: any) {
    console.error('[discover] Grounded API call threw:', err.message);
    throw new Error(`Google Search grounding crashed. Try a slightly broader niche. (${err.message})`);
  }

  let researchText = '';
  const parts = researchResponse.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if ((part as any).text) researchText += (part as any).text;
  }
  if (!researchText) researchText = researchResponse.text ?? '';

  if (!researchText) {
    const finishReason = researchResponse.candidates?.[0]?.finishReason;
    console.error('[discover] Research step failed. Finish reason:', finishReason);
    if (finishReason === 'SAFETY') {
      throw new Error("Query was blocked by Google's safety filters. Try rephrasing.");
    } else if (finishReason === 'MALFORMED_FUNCTION_CALL') {
      throw new Error("Google Search tool crashed on this specific niche. Try simplifying the search query.");
    } else {
      throw new Error(`Live search failed to find enough verified profiles (Reason: ${finishReason || 'Unknown'}). Try making the search broader.`);
    }
  }

  console.log('[discover] Step 1 completed. Length:', researchText.length);

  // STEP 2: Format to strict JSON — no grounding, no thinking, just extraction
  const formatPrompt = `Extract the people from this research text and return ONLY a raw JSON array with no prose or markdown. Each item must have: name, company (employer name only, e.g. "Ola"), headline (job title + company, e.g. "Co-Founder & CEO, Ola"), linkedinUrl, whyFollow, topics (string array). Research: ${researchText.substring(0, 3000)}`;

  console.log('[discover] Step 2: Formatting to JSON...');
  let formatResponse;
  try {
    formatResponse = await ai.models.generateContent({
      model: VERTEX_MODEL,
      contents: formatPrompt,
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 }, // No thinking needed for JSON extraction
      },
    });
  } catch (err: any) {
    throw new Error(`JSON Formatting failed: ${err.message}`);
  }

  const jsonText = formatResponse.text ?? '';
  console.log('[discover] Step 2 completed. Length:', jsonText.length);

  const results = extractJsonArray(jsonText);
  if (!results) {
    throw new Error(
      `Failed to parse the search results into the correct format. Response snippet: ${jsonText.substring(0, 400)}`
    );
  }

  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query: string =
      (Array.isArray(body.interests) ? body.interests.join(', ') : body.interests) ||
      body.query ||
      '';

    if (!query.trim()) {
      return NextResponse.json(
        { success: false, error: 'A topic or niche is required.' },
        { status: 400 }
      );
    }

    const country = body.country || '';

    const discovered = await discoverInfluencers(query, country);

    const saved = [];
    for (const inf of discovered) {
      if (!inf.name?.trim()) continue;

      // Normalize LinkedIn URL: accept any linkedin URL, fix common malformations
      let linkedinUrl = inf.linkedinUrl?.trim() || '';
      // If it's a raw username with no domain, prefix it
      if (linkedinUrl && !linkedinUrl.startsWith('http') && !linkedinUrl.includes('linkedin')) {
        linkedinUrl = `https://www.linkedin.com/in/${linkedinUrl}`;
      }
      // Fallback placeholder so DB record still saves (user can fix manually)
      if (!linkedinUrl || !linkedinUrl.includes('linkedin')) {
        linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(inf.name.trim())}`;
      }

      // Extract company — try LLM field first, then parse headline
      // Headline formats: "CEO, Ola" | "CEO at Ola" | "CEO at Ola | extra"
      const extractCompanyFromHeadline = (h: string) => {
        if (!h) return '';
        // Try " at " separator (most common)
        const atMatch = h.match(/\bat\s+([^|,]+)/i);
        if (atMatch) return atMatch[1].trim();
        // Try comma separator "Role, Company"
        const commaMatch = h.split(',').slice(-1)[0].trim();
        if (commaMatch && commaMatch !== h.trim()) return commaMatch;
        return '';
      };

      const companyName: string =
        inf.company?.trim() || extractCompanyFromHeadline(inf.headline ?? '');

      try {
        const record = await prisma.influencer.upsert({
          where: { linkedinUrl },
          update: { headline: inf.headline ?? '', relevanceScore: 0.9, companyName: companyName || undefined },
          create: {
            name: inf.name.trim(),
            linkedinUrl,
            headline: inf.headline ?? '',
            companyName: companyName || undefined,
            interests: JSON.stringify(inf.topics ?? [query]),
            relevanceScore: 0.9,
          },
        });

        saved.push({ ...record, whyFollow: inf.whyFollow });
      } catch (e: any) {
        console.warn(`Skipping ${inf.name}:`, e.message);
      }
    }

    return NextResponse.json({ success: true, influencers: saved, query });
  } catch (error: any) {
    console.error('Influencer discovery error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

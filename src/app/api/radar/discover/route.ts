import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const { niche, region } = await req.json();
    if (!niche) return NextResponse.json({ success: false, error: 'Niche is required' }, { status: 400 });

    const dbUser = await prisma.user.findUnique({ where: { id: MOCK_USER_ID } });
    const modelConfig = {
      provider: dbUser?.llmProvider || 'gemini',
      modelId: dbUser?.llmModel || 'gemini-2.5-flash',
    };
    const model = resolveLanguageModel(modelConfig as any);

    const isGlobal = !region || region === 'Global';

    // Two fully separate prompts: Global keeps familiar Substack/GitHub behavior.
    // Regional mode instructs the LLM to source EVERYTHING from that region only.
    const prompt = isGlobal
      ? `You are an expert research assistant. Find the top sources for the niche: "${niche}".

Return ONLY a valid JSON array with no markdown, no backticks, no explanation — just raw JSON.

The JSON should have this exact structure:
[
  { "type": "rss", "name": "Author or Blog Name", "url": "https://example.substack.com/feed", "niche": "${niche}" },
  { "type": "github", "name": "Repo Name", "url": "https://github.com/owner/repo", "niche": "${niche}" }
]

Rules:
- Include 4 RSS feeds (Substack, Medium, personal blogs) from genuine global thought leaders in "${niche}"
- Include 3 trending GitHub repositories in "${niche}"
- All URLs must be real and publicly accessible
- RSS feed URLs should end with /feed or /rss or /atom.xml
- GitHub URLs should be in the format https://github.com/owner/repo
- Return ONLY the JSON array, nothing else`

      : `You are an expert regional research assistant. Find the top sources for the niche: "${niche}" specifically from ${region}.

Return ONLY a valid JSON array with no markdown, no backticks, no explanation — just raw JSON.

The JSON should have this exact structure:
[
  { "type": "rss", "name": "Source Name", "url": "https://example.com/rss", "niche": "${niche}" },
  { "type": "github", "name": "Repo Name", "url": "https://github.com/owner/repo", "niche": "${niche}" }
]

Rules:
- ALL sources must be from ${region} — do not include global or US-centric sources unless authored by someone based in ${region}
- Include 4 RSS feeds from ${region}-based sources: regional tech news sites (e.g. YourStory, Inc42, Entrackr for India), corporate PR blogs, startup engineering blogs, company newsletters, or Substack/Medium authors based in ${region} writing about "${niche}"
- Include 3 GitHub repositories authored or primarily maintained by developers or organizations from ${region} that are relevant to "${niche}"
- If fewer than 3 regional GitHub repos exist, substitute with additional ${region}-specific RSS feeds instead
- All URLs must be real and publicly accessible
- RSS feed URLs should end with /feed or /rss or /atom.xml
- GitHub URLs should be in the format https://github.com/owner/repo
- Return ONLY the JSON array, nothing else`;

    const { text } = await generateText({ model, prompt });

    // Parse the AI response
    let targets: any[] = [];
    try {
      const cleaned = text.trim().replace(/^```json\n?/, '').replace(/```$/, '').trim();
      targets = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Save to DB, skipping duplicates
    const saved = [];
    for (const target of targets) {
      if (!target.url || !target.type || !target.name) continue;
      try {
        const record = await prisma.trackedTarget.upsert({
          where: { url: target.url },
          update: { name: target.name, niche: target.niche },
          create: {
            type: target.type,
            name: target.name,
            url: target.url,
            niche: target.niche,
          },
        });
        saved.push(record);
      } catch (e) { /* skip duplicates */ }
    }

    return NextResponse.json({ success: true, targets: saved });
  } catch (error: any) {
    console.error('Discovery error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

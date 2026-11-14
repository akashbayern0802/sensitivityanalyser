import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export const dynamic = 'force-dynamic';

async function fetchLinkedInUrlContext(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
    const ogDesc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      '';
    return [ogTitle, ogDesc].filter(Boolean).join('\n').trim();
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { modelConfig, postUrl, targetRole } = await req.json();

    const cleanUrl = postUrl?.trim();
    if (!cleanUrl) {
      return NextResponse.json({ success: false, error: 'Please paste a LinkedIn Post URL first.' }, { status: 400 });
    }

    const model = resolveLanguageModel(modelConfig);
    const role = targetRole || 'Senior Tech & Product Leader';
    const urlContext = await fetchLinkedInUrlContext(cleanUrl);

    const prompt = `You are an executive syndication strategist for a ${role}.
A LinkedIn post has just been published at this URL:
${cleanUrl}
${urlContext ? `\nExtracted Link Preview Metadata:\n${urlContext}\n` : ''}

Generate short, high-signal link-drop teasers around this LinkedIn URL (do NOT include or repeat a full post — keep it strictly centered on sharing the URL so the target platform renders the native LinkedIn link preview card).

Return ONLY a valid raw JSON object (no markdown, no backticks, no wrapping text) with exactly these four keys:
{
  "telegramSnippet": "${cleanUrl}",
  "xTeaser": "A crisp 1-sentence executive hook (under 180 chars) followed by: ${cleanUrl}",
  "whatsappSnippet": "A 1-2 line peer message for a private CXO/VP WhatsApp group dropping the link for feedback: ${cleanUrl}",
  "slackSnippet": "A short 1-2 line community link-drop for Slack/Discord (#reading-room): ${cleanUrl}"
}

Constraints:
- Do NOT output a full post body.
- "telegramSnippet" should be strictly the URL (${cleanUrl}) or at most a 1-line pointer + ${cleanUrl}.
- Return ONLY the JSON object.`;

    const { text } = await generateText({ model, prompt });

    const cleaned = text.trim().replace(/^```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI did not return valid JSON for syndication');
    }

    const syndication = JSON.parse(match[0]);

    return NextResponse.json({
      success: true,
      syndication: {
        telegramSnippet: cleanUrl,
        xTeaser: syndication.xTeaser || cleanUrl,
        whatsappSnippet: syndication.whatsappSnippet || cleanUrl,
        slackSnippet: syndication.slackSnippet || cleanUrl,
      },
    });
  } catch (error: any) {
    console.error('Syndication generation error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to generate syndication assets' }, { status: 500 });
  }
}

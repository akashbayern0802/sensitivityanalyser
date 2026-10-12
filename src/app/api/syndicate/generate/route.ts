import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { modelConfig, postBody, postUrl, targetRole } = await req.json();

    if (!postBody || !postBody.trim()) {
      return NextResponse.json({ success: false, error: 'postBody is required' }, { status: 400 });
    }

    const model = resolveLanguageModel(modelConfig);
    const linkPlaceholder = postUrl?.trim() || '[LINKEDIN_POST_LINK]';
    const role = targetRole || 'Senior Tech & Product Leader';

    const prompt = `You are an executive syndication strategist for a ${role}.
A high-authority LinkedIn post has just been written:

--- MASTER LINKEDIN POST ---
${postBody}
----------------------------

Generate three platform-specific satellite assets to route audience and peer leaders directly to this LinkedIn post.

Return ONLY a valid raw JSON object (no markdown, no backticks, no wrapping text) with exactly these three keys:
{
  "xTeaser": "A punchy, high-signal single tweet under 240 characters that hooks the reader with a strong contrarian or architectural insight from the post, followed by: Full breakdown on LinkedIn: ${linkPlaceholder}",
  "whatsappSnippet": "A peer-to-peer message designed to share in a private 5-7 person CXO/VP leadership WhatsApp pod. Format with 2-3 clean emojis. Do NOT sound spammy or ask for likes. Instead, frame it as an intellectual trade-off you just published on LinkedIn and ask for their production experience or perspectives. End with the link: ${linkPlaceholder}",
  "slackSnippet": "A formatted Markdown message for tech Slack/Discord communities (#reading-room or #tech-strategy). 3-4 bullet points highlighting the architectural or business trade-offs discussed in the post, ending with a discussion question and the link: ${linkPlaceholder}"
}

Constraints:
- Maintain an executive gravitas (focus on P&L, architecture trade-offs, and operational scale, not beginner tips).
- "xTeaser" MUST be under 260 characters total including the link.
- Return ONLY the JSON object.`;

    const { text } = await generateText({ model, prompt });
    
    // Parse JSON safely
    const cleaned = text.trim().replace(/^```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI did not return valid JSON for syndication');
    }

    const syndication = JSON.parse(match[0]);

    return NextResponse.json({
      success: true,
      syndication: {
        xTeaser: syndication.xTeaser || '',
        whatsappSnippet: syndication.whatsappSnippet || '',
        slackSnippet: syndication.slackSnippet || '',
      },
    });
  } catch (error: any) {
    console.error('Syndication generation error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to generate syndication assets' }, { status: 500 });
  }
}

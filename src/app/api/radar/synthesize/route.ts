import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const { eventId, actionType = 'post' } = await req.json();

    const event = await prisma.radarEvent.findUnique({
      where: { id: eventId },
      include: { target: true },
    });
    if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

    // Step 1: Extract content via Bright Data if API key is available
    let extractedText = event.extractedText || event.summary || '';
    
    // Only scrape if we haven't already extracted the text
    if (!event.extractedText) {
      const brightDataKey = process.env.BRIGHT_DATA_API_KEY;
      if (brightDataKey && event.url) {
        try {
          const bdRes = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${brightDataKey}`,
            },
            body: JSON.stringify({
              zone: 'web_unlocker1',
              url: event.url,
              format: 'raw',
            }),
          });
          if (bdRes.ok) {
            const rawHtml = await bdRes.text();
            extractedText = rawHtml
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .substring(0, 6000)
              .trim();
          }
        } catch (bdErr) {
          console.log('Bright Data extraction failed, using summary:', bdErr);
        }
      }
    }

    // Step 2: Get user profile
    const dbUser = await prisma.user.findUnique({ where: { id: MOCK_USER_ID } });
    const modelConfig = {
      provider: dbUser?.llmProvider || 'gemini',
      modelId: dbUser?.llmModel || 'gemini-3.8-flash',
    };
    const model = resolveLanguageModel(modelConfig as any);

    // Step 3: Synthesize LinkedIn post or comment
    const prompt = actionType === 'comment' 
      ? `You are an industry expert reading a new post/article.
      
Source: ${event.target.name}
Title: ${event.title}
Content: ${extractedText}
Your role: ${dbUser?.targetRole || 'Professional'}

The author (${event.target.name}) just posted this on LinkedIn.
Draft 3 short, punchy, insightful comments you could leave on their post.
Constraints:
- Be a "First Mover": add unique value, a contrarian take, or a thought-provoking question based on the deep content.
- Do NOT say "Great post" or use cringe buzzwords.
- Keep each comment under 3 sentences.
- Output as exactly 3 bullet points starting with "- ".`
      : `You are a LinkedIn thought leader who writes viral, high-engagement posts.

A major development just happened in the ${event.target.niche} space:

Title: ${event.title}
Source: ${event.target.name}
URL: ${event.url}
Content: ${extractedText}

Your role: ${dbUser?.targetRole || 'Industry Professional'}
Your areas of interest: ${dbUser?.interests || '[]'}

Write a "First Mover" LinkedIn post about this development. The goal is to be the FIRST insightful voice on LinkedIn to cover this before it hits the mainstream feed.

Constraints:
- Open with a powerful, non-generic hook line. Never start with "Have you ever wondered" or "Excited to share".
- Write like a real human being, not a corporate announcement. Be direct and opinionated.
- Explain WHY this matters to your audience in plain English. Connect the technical dots to real business impact.
- Add 1-2 relevant emojis organically within the text (not as bullet points).
- End with a thought-provoking question that invites debate.
- Add 3-5 relevant hashtags at the very bottom.
- Keep it under 1300 characters for maximum reach.

IMPORTANT: Mention the source (${event.target.name}) naturally within the post text to credit them.`;

    const { text: draftResult } = await generateText({ model, prompt });

    // Save draft back to event
    const updateData: any = { extractedText, status: 'drafted' };
    if (actionType === 'comment') {
      updateData.commentDraft = draftResult;
    } else {
      updateData.linkedinDraft = draftResult;
    }

    const updated = await prisma.radarEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json({ success: true, event: updated });
  } catch (error: any) {
    console.error('Synthesize error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

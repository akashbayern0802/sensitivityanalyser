import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { modelConfig, postText, companyName } = await req.json();
    const userId = 'user_mock_id';
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Professional';
    const userInterests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];
    const model = resolveLanguageModel(modelConfig);

    // Fetch latest company news for context injection
    let companyNewsContext = '';
    if (companyName?.trim()) {
      const latestEvent = await prisma.radarEvent.findFirst({
        where: {
          target: { type: 'google-news', name: companyName.trim() },
        },
        orderBy: { publishedAt: 'desc' },
        include: { target: true },
      });

      if (latestEvent?.summary) {
        companyNewsContext = `

IMPORTANT CONTEXT — Recent news about ${companyName}:
"${latestEvent.title}: ${latestEvent.summary}"

At least one of your 3 comments MUST reference this news naturally and specifically. Do not be generic — mention the actual news event to show you are informed and timely.`;
      }
    }

    const prompt = `A top influencer in your industry just posted this on LinkedIn:
"${postText}"

Your Professional Role: ${userRole}
Your Areas of Expertise: ${userInterests.length > 0 ? userInterests.join(', ') : 'General industry trends'}${companyNewsContext}

Generate exactly 3 deeply insightful comments for this post, each from a different strategic archetype. These are for LinkedIn 360 Brew optimisation — the algorithm rewards substantial, expertise-driven engagement over generic praise.

ARCHETYPE 1 - THE CONTRARIAN:
A polite but confident comment that respectfully challenges ONE specific assumption or premise in the post. Do NOT disagree for the sake of it — pick a genuine nuance. Start with your point of disagreement, not with praise. 2-3 sentences.

ARCHETYPE 2 - THE ADDITIVE INSIGHT:
A comment that adds a brand new data point, framework, or perspective that the original post missed. Draw directly from the expertise in "${userRole}" and "${userInterests.join(', ')}". Make it specific, not generic. 2-3 sentences.

ARCHETYPE 3 - THE EXPERIENCE SHARE:
A short personal anecdote validating the post's core message using your own experience. Start with "In my experience..." or "When I was working on...". 2-3 sentences.

Constraints for ALL comments:
- Write like a real, senior professional. Zero corporate jargon.
- Include exactly 1 relevant emoji per comment.
- Each comment must stand alone as a complete thought.
- Do NOT start any comment with "Great post" or generic praise.

Format output as EXACTLY this structure with no other text:
CONTRARIAN: [comment text]
ADDITIVE: [comment text]
EXPERIENCE: [comment text]`;

    const { text } = await generateText({ model, prompt });

    const contrarian = text.match(/CONTRARIAN:\s*([\s\S]+?)(?=\nADDITIVE:|$)/)?.[1]?.trim() || '';
    const additive = text.match(/ADDITIVE:\s*([\s\S]+?)(?=\nEXPERIENCE:|$)/)?.[1]?.trim() || '';
    const experience = text.match(/EXPERIENCE:\s*([\s\S]+?)$/)?.[1]?.trim() || '';

    const suggestions = [
      { type: 'contrarian', label: '🤔 Contrarian Take', text: contrarian },
      { type: 'additive', label: '💡 Additive Insight', text: additive },
      { type: 'experience', label: '📖 Experience Share', text: experience },
    ].filter(s => s.text.length > 0);

    return NextResponse.json({
      success: true,
      suggestions,
      contextUsed: !!companyNewsContext,
      companyName: companyName || null,
    });
  } catch (error: any) {
    console.error('Comment generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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

Your Role: ${userRole}
Your Areas of Expertise: ${userInterests.length > 0 ? userInterests.join(', ') : 'General industry trends'}${companyNewsContext}

Generate 3 distinct, insightful comments you could leave on this post. Each comment should subtly reflect your expertise and role.
Constraints:
- Write like a real human (casual, authentic, conversational).
- Avoid robotic praise like "Great post!" or "I completely agree." Add actual value, a respectful contrarian take, or a thoughtful question.
- Include 1 relevant emoji in each comment.
- Keep them punchy and under 3 sentences.
- Format output as exactly 3 bullet points starting with "- ".`;

    const { text } = await generateText({ model, prompt });

    const suggestions = text
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());

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

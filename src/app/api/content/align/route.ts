import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { postBody, modelConfig } = await req.json();

    if (!postBody?.trim()) {
      return NextResponse.json({ success: false, error: 'Post body is required' }, { status: 400 });
    }

    const userId = 'user_mock_id';
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || '';
    const userInterests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];

    if (!userRole && userInterests.length === 0) {
      return NextResponse.json({
        success: true,
        score: null,
        feedback: ['Set your Target Role and Interests in Settings to enable alignment checking.'],
        suggestedEdits: '',
      });
    }

    const model = resolveLanguageModel(modelConfig);

    const alignmentSchema = z.object({
      score: z.number().min(0).max(100).describe('How well the post aligns with the user professional identity 0 to 100'),
      feedback: z.array(z.string()).describe('2 to 3 short, specific reasons for the score'),
      suggestedEdits: z.string().describe('A rewritten version of the post hook or first paragraph that better ties the content to the user niche. Empty string if score is already above 80.'),
    });

    const { object } = await generateObject({
      model,
      schema: alignmentSchema,
      prompt: `You are evaluating a LinkedIn post for "Professional Identity Alignment" — a key signal in the LinkedIn 360 Brew algorithm.

User's Professional Identity:
- Target Role: ${userRole}
- Areas of Expertise/Interests: ${userInterests.join(', ') || 'Not specified'}

LinkedIn Post to Evaluate:
"""${postBody}"""

Evaluate how clearly and directly this post demonstrates the user's expertise in their stated role and interests.

Scoring Guide:
- 90-100: Post is unmistakably expert content from someone in this role. Rich with domain knowledge.
- 70-89: Post is on-topic but could demonstrate more specific expertise.
- 50-69: Post is generic or tangentially related. Algorithm may not classify as expert knowledge.
- Below 50: Post drifts into generic motivation or topics unrelated to the user's niche.

If the score is below 80, provide a rewritten first paragraph that anchors the post's hook more firmly in the user's professional domain without losing the post's core message.`,
    });

    return NextResponse.json({ success: true, ...object });
  } catch (error: any) {
    console.error('Alignment check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

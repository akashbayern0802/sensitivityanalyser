import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { retrieveChunks } from '@/lib/rag/retriever';
import { rerankChunks } from '@/lib/rag/reranker';
import { runNLICritic } from '@/lib/rag/critic';
import { buildCommentGroundedPrompt } from '@/lib/rag/grounded-prompt';

const MOCK_USER_ID = 'user_mock_id';

/**
 * Lightweight NLI: only check sentences with factual markers.
 * Opinion sentences ("In my experience...", "I think...") are intentionally skipped.
 */
const FACTUAL_SENTENCE_PATTERN = /\d+%|\d+x|\$\d+|\b(study|research|data|statistics|according to|report)\b|\b([A-Z][a-z]+ (AI|Corp|Inc|Ltd|Platform|Framework|Labs))\b/i;

export async function POST(req: Request) {
  try {
    const { modelConfig, postText, companyName } = await req.json();
    const userId = MOCK_USER_ID;
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Professional';
    const userInterests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];
    const model = resolveLanguageModel(modelConfig);

    // === Fetch company news context ===
    let companyNewsContext = '';
    if (companyName?.trim()) {
      const latestEvent = await prisma.radarEvent.findFirst({
        where: { target: { type: 'google-news', name: companyName.trim() } },
        orderBy: { publishedAt: 'desc' },
        include: { target: true },
      });
      if (latestEvent?.summary) {
        companyNewsContext = `\n\nIMPORTANT CONTEXT — Recent news about ${companyName}:\n"${latestEvent.title}: ${latestEvent.summary}"\n\nAt least one of your 3 comments MUST reference this news naturally and specifically.`;
      }
    }

    // === RAG: Retrieve vault chunks for the Additive Insight archetype ===
    let groundingChunks: Awaited<ReturnType<typeof rerankChunks>> = [];
    let groundingBlock = '';

    try {
      // Query is the influencer's post — find relevant expertise from the user's vault
      const retrieved = await retrieveChunks(postText.substring(0, 400), userId, 5);
      if (retrieved.length > 0) {
        groundingChunks = await rerankChunks(postText.substring(0, 400), retrieved, 0.72);
        groundingBlock = buildCommentGroundedPrompt({
          postText,
          chunks: groundingChunks,
          userRole,
          companyNewsContext,
        });
      }
    } catch {
      // RAG failure is non-blocking
    }

    // If no RAG grounding found, use the original company news context only
    if (!groundingBlock && companyNewsContext) {
      groundingBlock = companyNewsContext;
    }

    const prompt = `A top influencer in your industry just posted this on LinkedIn:
"${postText}"

Your Professional Role: ${userRole}
Your Areas of Expertise: ${userInterests.length > 0 ? userInterests.join(', ') : 'General industry trends'}${groundingBlock ? '\n\n' + groundingBlock : ''}

Generate exactly 3 deeply insightful comments for this post, each from a different strategic archetype.

ARCHETYPE 1 - THE CONTRARIAN:
A polite but confident comment that respectfully challenges ONE specific assumption or premise in the post. Do NOT disagree for the sake of it — pick a genuine nuance. Start with your point of disagreement, not with praise. 2-3 sentences.

ARCHETYPE 2 - THE ADDITIVE INSIGHT:
A comment that adds a brand new data point, framework, or perspective. ${groundingChunks.length > 0 ? 'IMPORTANT: Draw ONLY from the verified GROUNDING CONTEXT provided above. Do not invent statistics or metrics.' : `Draw from your expertise as ${userRole}.`} Make it specific, not generic. 2-3 sentences.

ARCHETYPE 3 - THE EXPERIENCE SHARE:
A short personal anecdote validating the post's core message. Start with "In my experience..." or "When I was working on...". 2-3 sentences.

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
    let additive = text.match(/ADDITIVE:\s*([\s\S]+?)(?=\nEXPERIENCE:|$)/)?.[1]?.trim() || '';
    const experience = text.match(/EXPERIENCE:\s*([\s\S]+?)$/)?.[1]?.trim() || '';

    // === Lightweight NLI: only check additive insight for factual claims ===
    let additiveGroundingScore = 1.0;
    if (groundingChunks.length > 0 && additive) {
      // Only check factual sentences — skip opinion sentences
      const factualSentences = additive
        .split(/(?<=[.!?])\s+/)
        .filter(s => FACTUAL_SENTENCE_PATTERN.test(s));

      if (factualSentences.length > 0) {
        try {
          const criticResult = await runNLICritic(additive, groundingChunks, false);
          additive = criticResult.cleanedText;
          additiveGroundingScore = criticResult.faithfulnessScore;
        } catch { /* non-blocking */ }
      }
    }

    const suggestions = [
      { type: 'contrarian', label: '\ud83e\udd14 Contrarian Take', text: contrarian },
      { type: 'additive', label: '\ud83d\udca1 Additive Insight', text: additive },
      { type: 'experience', label: '\ud83d\udcd6 Experience Share', text: experience },
    ].filter(s => s.text.length > 0);

    return NextResponse.json({
      success: true,
      suggestions,
      contextUsed: !!companyNewsContext,
      companyName: companyName || null,
      groundingData: {
        isGrounded: groundingChunks.length > 0,
        additiveGroundingScore,
        chunksUsed: groundingChunks.length,
      },
    });
  } catch (error: any) {
    console.error('Comment generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

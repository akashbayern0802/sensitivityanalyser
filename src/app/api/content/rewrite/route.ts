import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { retrieveChunks } from '@/lib/rag/retriever';
import { rerankChunks } from '@/lib/rag/reranker';
import { runNLICritic } from '@/lib/rag/critic';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const { modelConfig, currentBody, feedback } = await req.json();
    const model = resolveLanguageModel(modelConfig);

    // === RAG: Retrieve grounding chunks based on the existing post content ===
    let groundingChunks: Awaited<ReturnType<typeof rerankChunks>> = [];
    let groundingContext = '';

    try {
      const retrieved = await retrieveChunks(currentBody.substring(0, 500), MOCK_USER_ID, 5);
      if (retrieved.length > 0) {
        groundingChunks = await rerankChunks(currentBody.substring(0, 500), retrieved, 0.7);
        if (groundingChunks.length > 0) {
          groundingContext = `\n\nGROUNDING CONTEXT (use these verified facts — do NOT invent new facts):\n` +
            groundingChunks
              .slice(0, 3)
              .map((c, i) => `[SOURCE ${i + 1}] ${c.source}: ${c.content.substring(0, 400)}`)
              .join('\n\n');
        }
      }
    } catch {
      // RAG failure is non-blocking for rewrite
    }

    const prompt = `You are a LinkedIn content strategist. Rewrite the following LinkedIn post based on the user's feedback.

CURRENT POST:
${currentBody}

USER FEEDBACK:
${feedback}${groundingContext}

Constraints:
- Maintain the formatting suitable for LinkedIn.
- Only output the rewritten post content, nothing else.
${groundingChunks.length > 0 ? '- Any factual claims you keep or add MUST come from the GROUNDING CONTEXT above.' : ''}`;

    const { text } = await generateText({ model, prompt });
    let rewrittenBody = text.trim();

    // Run NLI critic if grounded
    let faithfulnessScore = 1.0;
    if (groundingChunks.length > 0) {
      try {
        const criticResult = await runNLICritic(rewrittenBody, groundingChunks, false);
        rewrittenBody = criticResult.cleanedText;
        faithfulnessScore = criticResult.faithfulnessScore;
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      success: true,
      rewrittenBody,
      groundingData: {
        isGrounded: groundingChunks.length > 0,
        faithfulnessScore,
        chunks: groundingChunks.map(c => ({ id: c.id, source: c.source })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

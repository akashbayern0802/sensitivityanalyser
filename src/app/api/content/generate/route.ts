import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { retrieveChunks } from '@/lib/rag/retriever';
import { rerankChunks } from '@/lib/rag/reranker';
import { runNLICritic } from '@/lib/rag/critic';
import { buildGroundedPrompt } from '@/lib/rag/grounded-prompt';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const { modelConfig, topic, format, angle } = await req.json();

    const userId = MOCK_USER_ID;
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Professional';
    const model = resolveLanguageModel(modelConfig);

    // === PHASE 1: RAG Retrieval ===
    const query = [topic, angle].filter(Boolean).join(' ');
    let groundingChunks: Awaited<ReturnType<typeof rerankChunks>> = [];
    let isGrounded = false;
    let vaultInsufficient = false;

    try {
      // Step 1: Hybrid retrieval
      const retrieved = await retrieveChunks(query, userId, 8);

      if (retrieved.length > 0) {
        // Step 2: Re-rank, filter below 0.75 relevance
        groundingChunks = await rerankChunks(query, retrieved, 0.75);
        isGrounded = groundingChunks.length > 0;
        vaultInsufficient = retrieved.length > 0 && groundingChunks.length === 0;
      }
    } catch (ragError) {
      console.warn('[Content Generate] RAG retrieval failed, falling back to non-RAG:', ragError);
    }

    // === PHASE 2: Build Prompt ===
    let prompt: string;
    let systemPrompt: string | undefined;

    if (isGrounded && groundingChunks.length > 0) {
      const built = buildGroundedPrompt({
        userIntent: topic,
        chunks: groundingChunks,
        userRole,
        format,
        angle,
      });
      systemPrompt = built.systemPrompt;
      prompt = built.userPrompt;
    } else {
      // Fallback: non-RAG prompt grounded in I-H-O-P framework
      prompt = `Write a high-converting, authoritative LinkedIn post using the I-H-O-P Framework:

Topic: ${topic}
Format: ${format}
${angle ? `Strategic Angle / Perspective: ${angle}` : ''}
Author Role: ${userRole}

Execute across all 4 pillars:
1. [💡 IDEA]: Focus on a timely, relatable tension or challenge in ${userRole}'s domain. Avoid textbook definitions or bland corporate overviews.
2. [🪝 HOOK]: First 2 lines MUST deliver Curiosity + Credibility + a Commitment to Value. Sentence 1 must be under 45 characters. The hook must fit within 3 visual lines (~125 chars total) ending with a colon (:).
3. [🎯 OPINION]: Provide a bold, additive, or contrarian POV. What makes it worthwhile to hear this from YOU? Do NOT copy-paste generic advice (e.g. "alignment is key"). Take a strong stand on what breaks in practice and what to do instead.
4. [📦 PACKAGING]: Ultra-readable whitespace (1-2 sentences per paragraph max, under 200 chars each). NO generic AI openers ("In today's fast-paced world...", "Have you ever..."). End with an engaging peer discussion question and 3-5 relevant hashtags.

At the very end of your response, on a new line starting with "IMAGE_PROMPT:", provide a prompt for a high-signal concept diagram or illustration representing this insight.`;
    }

    // === PHASE 3: Generate ===
    const genOptions: Parameters<typeof generateText>[0] = {
      model,
      prompt,
      ...(systemPrompt && { system: systemPrompt }),
      ...(isGrounded && { temperature: 0.1 }),
    };

    const { text } = await generateText(genOptions);

    // Extract image prompt
    let postBody = text;
    let imagePrompt: string | null = null;
    const regex = /(?:\*\*)?IMAGE_?PROMPT:?(?:\*\*)?/i;
    const parts = text.split(regex);
    if (parts.length > 1) {
      postBody = parts[0].trim();
      imagePrompt = parts[1].trim().split('\n\n')[0].trim();
    } else {
      imagePrompt = `A professional, aesthetic corporate illustration representing: ${topic}`;
    }

    // === PHASE 4: NLI Critic (only if grounded) ===
    let faithfulnessScore = 1.0;
    let flaggedClaims: string[] = [];
    let criticStatus: 'passed' | 'remediated' | 'rejected' = 'passed';

    if (isGrounded && groundingChunks.length > 0) {
      try {
        const criticResult = await runNLICritic(postBody, groundingChunks, false);
        postBody = criticResult.cleanedText;
        faithfulnessScore = criticResult.faithfulnessScore;
        flaggedClaims = criticResult.flaggedClaims;
        criticStatus = criticResult.status;

        // Log to audit table
        await prisma.hallucinationAuditLog.create({
          data: {
            generationType: 'post',
            outputSnippet: postBody.substring(0, 500),
            faithfulnessScore,
            flaggedClaims: JSON.stringify(flaggedClaims),
            chunksReferenced: JSON.stringify(groundingChunks.map(c => c.id)),
            status: criticStatus,
          },
        });
      } catch (criticError) {
        console.warn('[Content Generate] NLI critic failed:', criticError);
      }
    }

    // === PHASE 5: Save draft ===
    const draft = await prisma.contentDraft.create({
      data: {
        userId,
        body: postBody,
        format,
        imagePrompt,
        status: 'draft',
      },
    });

    return NextResponse.json({
      success: true,
      draft,
      groundingData: isGrounded
        ? {
            isGrounded: true,
            faithfulnessScore,
            flaggedClaims,
            status: criticStatus,
            chunks: groundingChunks.map(c => ({
              id: c.id,
              snippet: c.content.substring(0, 120),
              source: c.source,
              relevanceScore: c.relevanceScore,
            })),
          }
        : {
            isGrounded: false,
            vaultInsufficient,
            message: vaultInsufficient
              ? 'Knowledge vault found, but no chunks were relevant enough (score < 0.75). Add more context to your vault.'
              : 'Knowledge vault is empty. Add career history, frameworks, or case studies to enable grounded generation.',
          },
    });
  } catch (error: any) {
    console.error('Content generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

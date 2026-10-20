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
      // Fallback: non-RAG prompt (same as original)
      prompt = `Write a LinkedIn post.
      Topic: ${topic}
      Format: ${format}
      Angle/Perspective: ${angle}
      User's Role: ${userRole}
      
      Constraints:
      - Write in a highly conversational, human, and authentic tone (like you're talking to a colleague over coffee).
      - DO NOT use generic AI intros like "Have you ever wondered..." or "In today's fast paced world...".
      - Start with a punchy, scroll-stopping hook (first 1-2 lines).
      - Use plenty of whitespace (1-2 sentences per paragraph max).
      - Sprinkle 2-4 relevant emojis naturally throughout the text to break it up visually.
      - Avoid cringy corporate buzzwords or overly dramatic language.
      - End with an engaging, casual question to invite comments.
      - Add 3-5 relevant hashtags at the very bottom.
      
      Also, at the very end of your response, on a new line starting with "IMAGE_PROMPT:", provide a prompt for an AI image generator.`;
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

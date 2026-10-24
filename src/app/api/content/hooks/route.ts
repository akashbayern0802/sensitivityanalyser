import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { retrieveChunks } from '@/lib/rag/retriever';
import { rerankChunks } from '@/lib/rag/reranker';
import { runNLICritic } from '@/lib/rag/critic';
import type { RetrievedChunk } from '@/lib/rag/retriever';

const MOCK_USER_ID = 'user_mock_id';

const AI_CLICHE_REGEX =
  /\b(in today['’]?s fast[- ]paced|have you ever wondered|unpopular opinion|thrilled to announce|excited to share|game[- ]?changer|delve into|let that sink in|buckle up)\b/i;

const OPEN_LOOP_REGEX =
  /([:?…]|\.\.\.)$|\b(here is|here['’]s|how we|why we|proved otherwise|actually took|instead|the result|3 lessons|4 lessons|5 lessons|what happened)\b/i;

/**
 * Deterministically extract verified metrics, numbers with units, and percentages
 * from the source chunks and current post body.
 */
function extractAllowedMetrics(textSources: string[]): string[] {
  const combined = textSources.join('\n');
  const matches =
    combined.match(
      /(?:₹|\$|€|£)\s*\d+(?:\.\d+)?\s*(?:Cr|L|M|B|K|million|billion|thousand)?|\b\d+(?:\.\d+)?\s*(?:%|x|ms|s|sec|seconds|mins|minutes|hours|days|weeks|months|years|Cr|M|B|K|microservices|services|APIs|engineers|clients|users|customers|pipelines)\b/gi,
    ) || [];

  const cleaned = matches.map(m => m.trim().replace(/\s+/g, ' '));
  return Array.from(new Set(cleaned)).slice(0, 12);
}

/**
 * Deterministic 40-point Fold Mechanics scorer.
 */
function scoreFoldMechanics(hookText: string): {
  foldScore: number;
  fitsMobileFold: boolean;
  hasOpenLoop: boolean;
  noCliches: boolean;
} {
  const trimmed = hookText.trim();
  const firstLine = trimmed.split('\n')[0] || '';

  // 1. Fits cleanly in mobile fold (first line <= 140 chars & total hook <= 210 chars) (15 pts)
  const fitsMobileFold = firstLine.length <= 140 && trimmed.length <= 210;
  const foldFitPts = fitsMobileFold ? 15 : trimmed.length <= 240 ? 10 : 5;

  // 2. Open loop / tension trigger before cutoff (15 pts)
  const aboveMobileCutoff = trimmed.substring(0, 160).trim();
  const hasOpenLoop = OPEN_LOOP_REGEX.test(aboveMobileCutoff) || OPEN_LOOP_REGEX.test(trimmed);
  const openLoopPts = hasOpenLoop ? 15 : 7;

  // 3. Zero AI clichés (10 pts)
  const noCliches = !AI_CLICHE_REGEX.test(trimmed);
  const clichePts = noCliches ? 10 : 0;

  return {
    foldScore: foldFitPts + openLoopPts + clichePts,
    fitsMobileFold,
    hasOpenLoop,
    noCliches,
  };
}

export async function POST(req: Request) {
  try {
    const { modelConfig, postBody = '', topic = '' } = await req.json();

    if (!postBody.trim() && !topic.trim()) {
      return NextResponse.json(
        { success: false, error: 'Post body or topic is required to generate hooks' },
        { status: 400 },
      );
    }

    const userId = MOCK_USER_ID;
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Senior Tech & Product Leader';
    const model = resolveLanguageModel(modelConfig);

    // === LAYER 1: Retrieve Grounding Chunks from Knowledge Vault ===
    const searchQuery = [topic, postBody.substring(0, 400)].filter(Boolean).join(' ');
    let groundingChunks: (RetrievedChunk & { relevanceScore?: number })[] = [];

    try {
      const retrieved = await retrieveChunks(searchQuery, userId, 6);
      if (retrieved.length > 0) {
        groundingChunks = await rerankChunks(searchQuery, retrieved, 0.65);
        if (groundingChunks.length === 0) {
          // Keep top 2 retrieved chunks if reranker was overly strict
          groundingChunks = retrieved.slice(0, 2);
        }
      }
    } catch (e) {
      console.warn('[Hooks API] Vault retrieval non-fatal error:', e);
    }

    // Build verification pool (Vault Chunks + Current Post Body)
    const verificationChunks: RetrievedChunk[] = [
      ...groundingChunks,
      ...(postBody.trim()
        ? [
            {
              id: 'current_post_body',
              content: postBody.substring(0, 1500),
              metadata: { source: 'Current Post Draft' },
              score: 1.0,
              source: 'Current Post Draft',
            },
          ]
        : []),
    ];

    // === LAYER 2: Extract Strict Metric & Entity Whitelist ===
    const allowedMetrics = extractAllowedMetrics(verificationChunks.map(c => c.content));

    const sourceContextBlock = verificationChunks
      .map((c, i) => `[SOURCE ${i + 1}] (${c.source}):\n${c.content.substring(0, 500)}`)
      .join('\n\n');

    const metricRule =
      allowedMetrics.length > 0
        ? `ALLOWED METRICS WHITELIST: [${allowedMetrics.join(', ')}]\nCRITICAL: You may ONLY use numbers, percentages, or metrics from this exact whitelist. Do NOT invent or round numbers.`
        : `NO NUMBERS AVAILABLE IN VAULT: Because there are no verified metrics in the source context, DO NOT use any percentages, dollar/rupee amounts, or numbers in any hook. Use qualitative architectural or leadership scope instead.`;

    const prompt = `You are an elite LinkedIn hook strategist for a ${userRole}.
Generate 3 scroll-stopping opening hooks (1-2 short paragraphs, max 190 characters each) for the post below.

${metricRule}

SOURCE CONTEXT:
${sourceContextBlock}

Generate these 3 exact archetypes:
1. METRIC_SHOCK: ${
      allowedMetrics.length > 0
        ? 'Lead directly with the most compelling verified metric/outcome from the ALLOWED METRICS WHITELIST, followed by an open loop ending in a colon.'
        : 'Lead with a high-stakes architectural or product scope statement from the source context, followed by an open loop ending in a colon.'
    }
2. CONTRARIAN: Challenge a conventional industry belief related to this post, anchored strictly in the verified facts above, ending with a colon or tension break.
3. LESSON: Start with a concrete moment of friction or challenge from the source context ("When we...", "Most teams..."), ending with an open loop before the solution.

RULES FOR ALL 3 HOOKS:
- Maximum 190 characters per hook (so the first line fits cleanly above the 140-char mobile fold).
- Include a line break (\\n\\n) between sentence 1 and sentence 2.
- End with a colon (:) or open-loop cliffhanger that compels the reader to click "...see more".
- ZERO fabricated metrics, ZERO corporate clichés.

Output ONLY valid JSON in this exact format (no markdown fences):
{
  "hooks": [
    {
      "id": "metric_shock",
      "archetype": "📊 Metric / Outcome Shock",
      "text": "First line under 120 chars.\\n\\nSecond line ending with an open loop:",
      "curiosityChecks": { "hasTension": true, "isPeerLevel": true, "isActiveVoice": true }
    },
    {
      "id": "contrarian",
      "archetype": "🤔 Contrarian Thesis",
      "text": "First line challenging convention.\\n\\nSecond line ending with an open loop:",
      "curiosityChecks": { "hasTension": true, "isPeerLevel": true, "isActiveVoice": true }
    },
    {
      "id": "lesson",
      "archetype": "📖 Hard-Won Lesson",
      "text": "First line sharing the friction point.\\n\\nSecond line ending with an open loop:",
      "curiosityChecks": { "hasTension": true, "isPeerLevel": true, "isActiveVoice": true }
    }
  ]
}`;

    const { text: rawOutput } = await generateText({
      model,
      prompt,
      temperature: 0.1,
    });

    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse hook generator response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawHooks: Array<{
      id: string;
      archetype: string;
      text: string;
      curiosityChecks?: { hasTension?: boolean; isPeerLevel?: boolean; isActiveVoice?: boolean };
    }> = parsed.hooks || [];

    // === LAYER 3 & 4: NLI Critic Gate + Deterministic Hybrid Scoring ===
    const scoredHooks = await Promise.all(
      rawHooks.map(async h => {
        const cleanHookText = (h.text || '').trim();

        // Run NLI Critic on the hook against verificationChunks
        const criticResult = await runNLICritic(cleanHookText, verificationChunks, false);

        // Also check that any metric in the hook is backed by source text
        const hookMetrics = extractAllowedMetrics([cleanHookText]);
        const unverifiedMetrics = hookMetrics.filter(
          hm =>
            !allowedMetrics.some(
              am => am.toLowerCase().includes(hm.toLowerCase()) || hm.toLowerCase().includes(am.toLowerCase()),
            ),
        );

        const isFullyVerified =
          criticResult.faithfulnessScore >= 0.95 && unverifiedMetrics.length === 0;
        const effectiveFaithfulness =
          unverifiedMetrics.length > 0
            ? Math.min(criticResult.faithfulnessScore, 0.5)
            : criticResult.faithfulnessScore;

        // 1. Fold Mechanics (40 pts deterministic)
        const { foldScore, fitsMobileFold, hasOpenLoop, noCliches } =
          scoreFoldMechanics(cleanHookText);

        // 2. Vault Grounding (30 pts from NLI Critic + Whitelist)
        const vaultScore = Math.round(effectiveFaithfulness * 30);

        // 3. Curiosity Rubric (30 pts)
        const checks = h.curiosityChecks || {};
        const curiosityScore =
          (checks.hasTension !== false ? 10 : 5) +
          (checks.isPeerLevel !== false ? 10 : 5) +
          (checks.isActiveVoice !== false ? 9 : 4);

        const totalScore = Math.min(100, foldScore + vaultScore + curiosityScore);

        return {
          id: h.id,
          archetype: h.archetype,
          text: criticResult.cleanedText || cleanHookText,
          score: totalScore,
          breakdown: {
            foldScore,
            vaultScore,
            curiosityScore,
            fitsMobileFold,
            hasOpenLoop,
            noCliches,
          },
          isVerified: isFullyVerified,
          faithfulnessScore: effectiveFaithfulness,
          flaggedClaims: [...criticResult.flaggedClaims, ...unverifiedMetrics],
          verifiedSources: verificationChunks.slice(0, 2).map(c => c.source),
        };
      }),
    );

    // Sort highest score first
    scoredHooks.sort((a, b) => b.score - a.score);

    // Audit log the top hook
    if (scoredHooks.length > 0) {
      try {
        const best = scoredHooks[0];
        await prisma.hallucinationAuditLog.create({
          data: {
            generationType: 'post_hooks',
            outputSnippet: best.text.substring(0, 500),
            faithfulnessScore: best.faithfulnessScore,
            flaggedClaims: JSON.stringify(best.flaggedClaims),
            chunksReferenced: JSON.stringify(groundingChunks.map(c => c.id)),
            status: best.isVerified ? 'passed' : 'remediated',
          },
        });
      } catch {
        // Non-blocking audit log
      }
    }

    return NextResponse.json({
      success: true,
      allowedMetrics,
      hooks: scoredHooks,
    });
  } catch (error: any) {
    console.error('[Hooks API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate grounded hooks' },
      { status: 500 },
    );
  }
}

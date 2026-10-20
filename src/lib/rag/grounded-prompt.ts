import type { RetrievedChunk } from './retriever';

/**
 * Assembles a strict epistemic grounding system prompt that anchors the LLM
 * to the retrieved knowledge vault chunks and prevents hallucination.
 */
export function buildGroundedPrompt(params: {
  userIntent: string;
  chunks: RetrievedChunk[];
  userRole?: string;
  format?: string;
  angle?: string;
}): { systemPrompt: string; userPrompt: string } {
  const { userIntent, chunks, userRole = 'Professional', format = 'text', angle } = params;

  const sourceBlock = chunks
    .map(
      (c, i) =>
        `[SOURCE ${i + 1}] (${c.source}):\n${c.content.substring(0, 600)}`,
    )
    .join('\n\n');

  const systemPrompt = `You are an expert LinkedIn content strategist helping ${userRole} create authentic, credible posts.

GROUNDING RULES — CRITICAL:
1. You MUST only use facts, metrics, company names, tool names, and statistics that appear in the SOURCE CONTEXT below.
2. If you need to cite a specific number or claim, it MUST come from a source below — do not invent data.
3. If the sources don't contain enough detail about a specific claim, write in general/qualitative terms instead.
4. Do NOT hallucinate: no made-up case studies, percentages, company names, or frameworks unless they are in the sources.
5. You may use your own analysis, transitions, and structure freely — only factual CLAIMS must be grounded.
6. Refer to sources naturally (e.g., "Based on my experience with...") — do NOT add citation brackets like [1].

SOURCE CONTEXT:
${sourceBlock}

If the source context is insufficient to make a specific factual claim, state your point qualitatively or share a principle instead of inventing a statistic.`;

  const userPrompt = `Write a LinkedIn post.

TOPIC / INTENT: ${userIntent}
FORMAT: ${format}
${angle ? `ANGLE: ${angle}` : ''}
USER ROLE: ${userRole}

Constraints:
- Write in a highly conversational, human, and authentic tone.
- DO NOT use generic AI intros like "Have you ever wondered..." or "In today's fast-paced world...".
- Start with a punchy, scroll-stopping hook (first 1-2 lines).
- Use plenty of whitespace (1-2 sentences per paragraph max).
- Sprinkle 2-4 relevant emojis naturally throughout the text.
- Avoid cringy corporate buzzwords.
- End with an engaging, casual question to invite comments.
- Add 3-5 relevant hashtags at the very bottom.

At the end, on a new line starting with "IMAGE_PROMPT:", provide an AI image generation prompt for this post.`;

  return { systemPrompt, userPrompt };
}

/**
 * Builds a lightweight grounded system prompt for Comment Studio.
 * Less strict — only prevents factual hallucinations in the Additive Insight archetype.
 */
export function buildCommentGroundedPrompt(params: {
  postText: string;
  chunks: RetrievedChunk[];
  userRole?: string;
  companyNewsContext?: string;
}): string {
  const { postText: _postText, chunks, userRole = 'Professional', companyNewsContext = '' } = params;

  if (chunks.length === 0) {
    return ''; // No grounding available — caller uses non-RAG prompt
  }

  const sourceBlock = chunks
    .slice(0, 3)
    .map((c, i) => `[SOURCE ${i + 1}] (${c.source}):\n${c.content.substring(0, 400)}`)
    .join('\n\n');

  return `GROUNDING CONTEXT for the Additive Insight archetype only:
The following are verified facts and frameworks from your career and professional experience.
When writing the ADDITIVE INSIGHT comment, you MUST draw specific, verifiable claims from these sources.
Do NOT invent statistics, tool names, or case study results.

${sourceBlock}${companyNewsContext}`;

  void userRole; // consumed via closure; kept for API consistency
}

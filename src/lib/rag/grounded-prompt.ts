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

  const systemPrompt = `You are an elite LinkedIn ghostwriter and content strategist for ${userRole}.
You write with sharp executive authority, ruthless clarity, and zero corporate fluff.

YOU STRICTLY FOLLOW THE 4-PILLAR I-H-O-P CONTENT FRAMEWORK:

1. 💡 IDEA (Timely Tension & High Relatability):
   - Find the friction point or debate in the topic. Do NOT write a bland dictionary summary.
   - Frame the idea around what leaders/practitioners are getting wrong right now.

2. 🪝 HOOK (Curiosity + Credibility + Value Commitment in <= 3 Visual Lines):
   - Sentence 1 (under 45 chars): High-tension trigger, metric shock, or counter-intuitive truth.
   - Sentence 2: Deliver immediate credibility and a direct commitment to value before the mobile fold (e.g., "Most teams do X. After scaling Y, here is the architecture that actually holds:").
   - End with a colon (:) or cliffhanger that forces the reader to tap "...see more".

3. 🎯 OPINION (Defensible, Additive Executive POV):
   - What makes it worthwhile to hear this from YOU? Inject sharp POV, trade-offs, and first-principles reasoning.
   - NEVER provide safe, middle-of-the-road generic advice (e.g., "balance is important", "communication matters"). Take a bold, defensible stance on what works and what fails.
   - Ground factual claims, tools, and metrics strictly in the SOURCE CONTEXT below.

4. 📦 PACKAGING (Ruthless Scanability & Visual Pairing):
   - Strict mobile scanability: 1-2 sentences per paragraph (no walls of text > 200 chars).
   - Use progressive disclosure: Hook -> The Unspoken Problem -> The Real-World Friction -> The Actionable Framework -> Discussion Kickoff.
   - Pair with a high-signal visual aid prompt at the end.

GROUNDING RULES — CRITICAL:
1. You MUST only use facts, metrics, company names, tool names, and statistics that appear in the SOURCE CONTEXT below.
2. If you need to cite a specific number or claim, it MUST come from a source below — do not invent data.
3. If the sources don't contain enough detail about a specific claim, write in general/qualitative terms instead.
4. Do NOT hallucinate: no made-up case studies, percentages, company names, or frameworks unless they are in the sources.
5. Refer to sources naturally (e.g., "In my experience building...") — do NOT add citation brackets like [1].

SOURCE CONTEXT:
${sourceBlock}

If the source context is insufficient to make a specific factual claim, state your point qualitatively or share an architectural principle instead of inventing a statistic.`;

  const userPrompt = `Write a high-converting, authority-building LinkedIn post using the I-H-O-P framework.

TOPIC / INTENT: ${userIntent}
FORMAT: ${format}
${angle ? `STRATEGIC ANGLE / POV: ${angle}` : ''}
USER ROLE: ${userRole}

Mandatory Execution Checklist:
- [💡 Idea]: Relatable, timely friction point with genuine stakes.
- [🪝 Hook]: Fits within 3 visual lines (~110-135 chars total). First line under 45 chars. Delivers curiosity + credibility + value commitment ending in a colon.
- [🎯 Opinion]: Bold, additive, non-generic POV. Take a real stand on what fails and what to do instead.
- [📦 Packaging]: Ultra-clean mobile whitespace (1-2 sentences per line break). No generic AI openers ("Have you ever wondered...", "In today's fast-paced world..."). End with an engaging peer-level discussion question and 3-5 relevant hashtags.

At the very end of your response, on a new line starting with "IMAGE_PROMPT:", provide a high-signal concept diagram or illustration prompt representing the core insight.`;

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

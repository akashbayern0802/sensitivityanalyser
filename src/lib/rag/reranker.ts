import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import type { RetrievedChunk } from './retriever';

const RERANKER_MODEL = { provider: 'gemini' as const, modelId: 'gemini-3.8-flash' };
const MIN_RELEVANCE_THRESHOLD = 0.75;

/**
 * Ask Gemini Flash to score each chunk's relevance to the query.
 * Returns filtered chunks above the threshold, sorted by relevance score.
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  threshold = MIN_RELEVANCE_THRESHOLD,
): Promise<(RetrievedChunk & { relevanceScore: number })[]> {
  if (chunks.length === 0) return [];

  // Build a batch evaluation prompt
  const chunkList = chunks
    .map((c, i) => `[CHUNK ${i + 1}]\nSource: ${c.source}\nContent: ${c.content.substring(0, 600)}`)
    .join('\n\n');

  const prompt = `You are a relevance evaluator. Score each chunk's relevance to the query below.

QUERY: "${query}"

CHUNKS:
${chunkList}

For each chunk, output ONLY a line in this exact format (no other text):
CHUNK_1_SCORE: 0.XX
CHUNK_2_SCORE: 0.XX
...

Score 0.0 = completely irrelevant, 1.0 = perfectly relevant. Be strict.`;

  try {
    const provider = process.env.GOOGLE_VERTEX_API_KEY ? ('google-vertex' as const) : ('gemini' as const);
    const model = resolveLanguageModel({ provider, modelId: 'gemini-3.8-flash' });
    const { text } = await generateText({ model, prompt, maxOutputTokens: 1500 });
    console.log('[RAG Reranker] LLM response:', text.trim());

    const results: (RetrievedChunk & { relevanceScore: number })[] = [];
    chunks.forEach((chunk, i) => {
      const match = text.match(new RegExp(`(?:\\*\\*)?CHUNK[\\s_]?${i + 1}[\\s_]?SCORE:?(?:\\*\\*)?\\s*([0-9.]+)`, 'i'));
      const score = match ? parseFloat(match[1]) : 0;
      if (score >= threshold) {
        results.push({ ...chunk, relevanceScore: score });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (err) {
    console.error('[RAG Reranker] Error:', err);
    // On failure, return all chunks with a default score above threshold
    return chunks.map(c => ({ ...c, relevanceScore: threshold }));
  }
}

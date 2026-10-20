import prisma from '@/lib/db';
import { embedText, cosineSimilarity } from './embedder';

export interface RetrievedChunk {
  id: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
  source: string;
}

/**
 * Keyword overlap score between query and chunk (Jaccard on word tokens).
 */
function keywordScore(query: string, chunk: string): number {
  const tokenize = (t: string) =>
    new Set(t.toLowerCase().match(/\b\w{3,}\b/g) || []);
  const qTokens = tokenize(query);
  const cTokens = tokenize(chunk);
  let overlap = 0;
  for (const t of qTokens) if (cTokens.has(t)) overlap++;
  const union = new Set([...qTokens, ...cTokens]).size;
  return union === 0 ? 0 : overlap / union;
}

/**
 * Reciprocal Rank Fusion score from two ranked lists.
 */
function rrfScore(rank1: number, rank2: number, k = 60): number {
  return 1 / (k + rank1) + 1 / (k + rank2);
}

/**
 * Hybrid retrieval: cosine similarity + keyword overlap fused via RRF.
 * Returns top-k chunks, skipping chunks without embeddings for semantic step.
 */
export async function retrieveChunks(
  query: string,
  userId = 'user_mock_id',
  topK = 5,
): Promise<RetrievedChunk[]> {
  // Load all chunks that belong to this user's vault items or are radar events
  const allChunks = await prisma.knowledgeChunk.findMany({
    where: {
      OR: [
        { vaultItem: { userId } },
        { radarEventId: { not: null } },
      ],
    },
    include: { vaultItem: true },
  });

  if (allChunks.length === 0) return [];

  // Embed query
  let queryVec: number[] | null = null;
  try {
    queryVec = await embedText(query);
  } catch {
    // If embedding fails, fall back to keyword-only
    queryVec = null;
  }

  // Score each chunk
  type ScoredChunk = { chunk: typeof allChunks[0]; semanticScore: number; keywordSc: number };
  const scored: ScoredChunk[] = allChunks.map(chunk => {
    let semanticScore = 0;
    if (queryVec && chunk.embedding) {
      try {
        const vec: number[] = JSON.parse(chunk.embedding);
        semanticScore = cosineSimilarity(queryVec, vec);
      } catch { /* ignore */ }
    }
    const keywordSc = keywordScore(query, chunk.content);
    return { chunk, semanticScore, keywordSc };
  });

  // Sort by each dimension
  const bySemantics = [...scored].sort((a, b) => b.semanticScore - a.semanticScore);
  const byKeyword = [...scored].sort((a, b) => b.keywordSc - a.keywordSc);

  // Build rank maps
  const semRank = new Map(bySemantics.map((s, i) => [s.chunk.id, i + 1]));
  const kwRank = new Map(byKeyword.map((s, i) => [s.chunk.id, i + 1]));

  // RRF fusion
  const fused = scored.map(s => ({
    chunk: s.chunk,
    score: rrfScore(semRank.get(s.chunk.id) ?? 999, kwRank.get(s.chunk.id) ?? 999),
  }));

  fused.sort((a, b) => b.score - a.score);

  return fused.slice(0, topK).map(({ chunk, score }) => {
    let metadata: Record<string, string> = {};
    try { metadata = JSON.parse(chunk.metadata); } catch { /* ignore */ }
    const source = metadata.source ||
      chunk.vaultItem?.title ||
      (chunk.radarEventId ? `RadarEvent:${chunk.radarEventId}` : 'Unknown');
    return {
      id: chunk.id,
      content: chunk.content,
      metadata,
      score,
      source,
    };
  });
}

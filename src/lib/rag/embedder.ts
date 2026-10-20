import { GoogleGenAI } from '@google/genai';

const EMBEDDING_MODEL = 'text-embedding-004';

function getGenAIClient() {
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  if (process.env.GOOGLE_VERTEX_API_KEY) {
    return new GoogleGenAI({ vertexai: true, apiKey: process.env.GOOGLE_VERTEX_API_KEY });
  }
  return new GoogleGenAI({ apiKey: '' });
}

/**
 * Embed a single text string into a float[] vector.
 * Uses gemini text-embedding-004 (768 dimensions).
 */
export async function embedText(text: string): Promise<number[]> {
  const genai = getGenAIClient();
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Embedding returned empty vector');
  }
  return values;
}

/**
 * Batch embed multiple texts. Returns array of float[] vectors in same order.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(texts.map(t => embedText(t)));
  return results;
}

/**
 * Cosine similarity between two vectors. Returns value in [-1, 1].
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

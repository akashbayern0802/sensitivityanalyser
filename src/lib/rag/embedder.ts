import { GoogleGenAI } from '@google/genai';

const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Embed text using Google Vertex AI predict REST API (supports Vertex API keys)
 * with automatic fallback to Google AI Studio Gemini API if standard key is used.
 */
export async function embedText(text: string): Promise<number[]> {
  const vertexApiKey = process.env.GOOGLE_VERTEX_API_KEY;
  const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_VERTEX_PROJECT_ID || 'sensitivity-analyser';
  let location = process.env.GOOGLE_VERTEX_REGION || process.env.GOOGLE_VERTEX_LOCATION || 'us-central1';
  // text-embedding-004 on Vertex is a regional model, default to us-central1 if global is set for LLM
  if (location === 'global') {
    location = 'us-central1';
  }

  // 1. Try Vertex AI REST endpoint if Vertex API Key is present
  if (vertexApiKey) {
    try {
      const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/publishers/google/models/${EMBEDDING_MODEL}:predict?key=${vertexApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ content: text }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const values = data.predictions?.[0]?.embeddings?.values;
        if (Array.isArray(values) && values.length > 0) {
          return values;
        }
      } else {
        console.warn(`[embedder] Vertex predict returned status ${res.status}, falling back...`);
      }
    } catch (err) {
      console.warn('[embedder] Vertex predict failed, falling back:', err);
    }
  }

  // 2. Try Google AI Studio Gemini API
  const geminiKey = process.env.GEMINI_API_KEY || vertexApiKey || '';
  const genai = new GoogleGenAI({ apiKey: geminiKey });
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

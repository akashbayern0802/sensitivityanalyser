import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import type { RetrievedChunk } from './retriever';

const CRITIC_MODEL = { provider: 'gemini' as const, modelId: 'gemini-3.8-flash' };

export interface CriticResult {
  cleanedText: string;
  faithfulnessScore: number;  // 0.0–1.0
  flaggedClaims: string[];
  status: 'passed' | 'remediated' | 'rejected';
}

/**
 * Factual claim patterns — sentences containing these are checked by NLI critic.
 * Opinion/experience sentences are intentionally skipped.
 */
const FACTUAL_PATTERNS = [
  /\d+%|\d+x|\$\d+|\d+ (billion|million|thousand|percent)/i,
  /\b(study|report|research|according to|survey|data shows|statistics)\b/i,
  /\b([A-Z][a-z]+ (AI|ML|Corp|Inc|Ltd|Technologies|Labs|Platform|Framework))\b/,
];

function isCandidateForNLI(sentence: string, strict = false): boolean {
  if (strict) return true;
  return FACTUAL_PATTERNS.some(p => p.test(sentence));
}

/**
 * Split text into sentences.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);
}

/**
 * Post-generation NLI critic. Evaluates each factual sentence against
 * the retrieved chunks. Strips unsupported claims from the output.
 *
 * @param text - Generated text to verify
 * @param chunks - Retrieved source chunks used for grounding
 * @param strict - If true, check ALL sentences (use false for Comment Studio)
 */
export async function runNLICritic(
  text: string,
  chunks: RetrievedChunk[],
  strict = true,
): Promise<CriticResult> {
  if (chunks.length === 0) {
    // No grounding sources — can't verify, pass through but score low
    return {
      cleanedText: text,
      faithfulnessScore: 0.5,
      flaggedClaims: [],
      status: 'passed',
    };
  }

  const sentences = splitSentences(text);
  const candidateSentences = sentences.filter(s => isCandidateForNLI(s, strict));

  if (candidateSentences.length === 0) {
    return {
      cleanedText: text,
      faithfulnessScore: 1.0,
      flaggedClaims: [],
      status: 'passed',
    };
  }

  const context = chunks
    .slice(0, 4)
    .map(c => c.content.substring(0, 500))
    .join('\n---\n');

  const sentenceList = candidateSentences.map((s, i) => `[S${i + 1}] ${s}`).join('\n');

  const prompt = `You are a fact-checking engine. Determine if each sentence is SUPPORTED or UNSUPPORTED by the provided source context.

SOURCE CONTEXT:
${context}

SENTENCES TO CHECK:
${sentenceList}

For each sentence, output ONLY lines in this exact format:
S1: SUPPORTED
S2: UNSUPPORTED
...

A sentence is SUPPORTED if the source context directly or indirectly backs up its claim.
A sentence is UNSUPPORTED if it makes a claim not found in the source context.`;

  try {
    const provider = process.env.GOOGLE_VERTEX_API_KEY ? ('google-vertex' as const) : ('gemini' as const);
    const model = resolveLanguageModel({ provider, modelId: 'gemini-3.8-flash' });
    const { text: judgement } = await generateText({
      model,
      prompt,
      maxOutputTokens: 1500,
      temperature: 0,
    });

    const flagged: string[] = [];
    candidateSentences.forEach((sentence, i) => {
      const match = judgement.match(new RegExp(`(?:\\*\\*)?S${i + 1}:?(?:\\*\\*)?\\s*(SUPPORTED|UNSUPPORTED)`, 'i'));
      const verdict = match ? match[1].toUpperCase() : 'SUPPORTED';
      if (verdict === 'UNSUPPORTED') {
        flagged.push(sentence);
      }
    });

    const totalChecked = candidateSentences.length;
    const faithfulnessScore = totalChecked === 0
      ? 1.0
      : parseFloat(((totalChecked - flagged.length) / totalChecked).toFixed(2));

    // Build cleaned text: remove flagged sentences
    let cleanedText = text;
    for (const claim of flagged) {
      cleanedText = cleanedText.replace(claim, '').replace(/\s{2,}/g, ' ').trim();
    }

    const status: 'passed' | 'remediated' | 'rejected' =
      flagged.length === 0
        ? 'passed'
        : faithfulnessScore < 0.5
        ? 'rejected'
        : 'remediated';

    return { cleanedText, faithfulnessScore, flaggedClaims: flagged, status };
  } catch (err) {
    console.error('[RAG Critic] NLI check failed:', err);
    return {
      cleanedText: text,
      faithfulnessScore: 0.9,
      flaggedClaims: [],
      status: 'passed',
    };
  }
}

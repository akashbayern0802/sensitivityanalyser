export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, string>;
}

/**
 * Rough token count estimate: ~4 chars per token.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into semantic chunks of 300–500 tokens.
 * Splits on double newlines (paragraphs) or headings first,
 * then recursively splits oversized segments on single newlines,
 * then on sentence boundaries.
 */
export function chunkText(
  text: string,
  sourceMetadata: Record<string, string> = {},
  targetTokens = 400,
  maxTokens = 550,
): TextChunk[] {
  // Normalise line endings
  const normalised = text.replace(/\r\n/g, '\n').trim();

  // Split on double newlines (paragraph boundaries)
  const paragraphs = normalised.split(/\n\n+/);

  const segments: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const combined = buffer ? buffer + '\n\n' + para : para;
    const tokens = estimateTokens(combined);

    if (tokens <= maxTokens) {
      buffer = combined;
    } else {
      // Flush current buffer
      if (buffer) segments.push(buffer.trim());
      // If this single paragraph is oversized, split on sentences
      if (estimateTokens(para) > maxTokens) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sentBuf = '';
        for (const s of sentences) {
          const cand = sentBuf ? sentBuf + ' ' + s : s;
          if (estimateTokens(cand) <= maxTokens) {
            sentBuf = cand;
          } else {
            if (sentBuf) segments.push(sentBuf.trim());
            sentBuf = s;
          }
        }
        if (sentBuf) buffer = sentBuf;
        else buffer = '';
      } else {
        buffer = para;
      }
    }
  }
  if (buffer) segments.push(buffer.trim());

  // targetTokens is available for future use (e.g., adaptive chunking)
  void targetTokens;

  return segments
    .filter(s => s.length > 20)
    .map((content, chunkIndex) => ({
      content,
      chunkIndex,
      tokenCount: estimateTokens(content),
      metadata: sourceMetadata,
    }));
}

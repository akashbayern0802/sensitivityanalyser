/**
 * Real-world LinkedIn Feed Fold Simulator
 *
 * Simulates LinkedIn's actual feed rendering engine:
 * - Mobile: 3 visual text lines (-webkit-line-clamp: 3) with ~42-45 chars per line
 * - Desktop: 5 visual text lines with ~68-72 chars per line
 * - Word-wrapping aware: long lines wrap into multiple visual lines
 */

export interface LinkedInFoldResult {
  aboveFold: string;
  belowFold: string;
  cutoffIndex: number;
  visualLines: number;
  maxVisualLines: number;
  charsPerLine: number;
  hardCharCap: number;
  isTruncated: boolean;
}

export function calculateLinkedInFold(
  text: string,
  device: 'mobile' | 'desktop' = 'mobile'
): LinkedInFoldResult {
  if (!text) {
    return {
      aboveFold: '',
      belowFold: '',
      cutoffIndex: 0,
      visualLines: 0,
      maxVisualLines: device === 'mobile' ? 3 : 5,
      charsPerLine: device === 'mobile' ? 42 : 68,
      hardCharCap: device === 'mobile' ? 140 : 230,
      isTruncated: false,
    };
  }

  const maxVisualLines = device === 'mobile' ? 3 : 5;
  const charsPerLine = device === 'mobile' ? 42 : 68;
  const hardCharCap = device === 'mobile' ? 140 : 230;

  let visualLinesUsed = 0;
  let cutoffIndex = text.length;

  const rawParagraphs = text.split('\n');
  let currentOffset = 0;

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const para = rawParagraphs[pIdx];

    // Blank lines (collapsed margins in LinkedIn feed)
    if (para.trim().length === 0) {
      currentOffset += para.length + 1; // +1 for the \n
      continue;
    }

    const words = para.split(' ');
    let currentLineChars = 0;

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      const spaceNeeded = currentLineChars === 0 ? word.length : currentLineChars + 1 + word.length;

      if (spaceNeeded > charsPerLine) {
        // Line wrapped to next visual line
        visualLinesUsed += 1;
        if (visualLinesUsed >= maxVisualLines) {
          cutoffIndex = Math.min(cutoffIndex, currentOffset + currentLineChars);
          break;
        }
        currentLineChars = word.length;
      } else {
        currentLineChars = spaceNeeded;
      }
    }

    if (visualLinesUsed >= maxVisualLines) {
      break;
    }

    // Finished paragraph's last line
    visualLinesUsed += 1;
    if (visualLinesUsed >= maxVisualLines) {
      cutoffIndex = Math.min(cutoffIndex, currentOffset + currentLineChars);
      break;
    }

    currentOffset += para.length + 1;
  }

  cutoffIndex = Math.min(cutoffIndex, hardCharCap, text.length);

  return {
    aboveFold: text.slice(0, cutoffIndex),
    belowFold: text.slice(cutoffIndex),
    cutoffIndex,
    visualLines: visualLinesUsed,
    maxVisualLines,
    charsPerLine,
    hardCharCap,
    isTruncated: cutoffIndex < text.length,
  };
}

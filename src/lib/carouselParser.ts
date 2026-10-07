export interface CarouselSlide {
  id: number;
  title: string;
  body: string;
  isTitle?: boolean;
  isCta?: boolean;
}

export function parseCarouselText(text: string): CarouselSlide[] {
  const slides: CarouselSlide[] = [];

  // Match "Slide N: Title\nBody" or "Slide N:\nTitle\nBody"
  const slideRegex = /Slide\s*(\d+)\s*:?\s*([^\n]*)?\n([\s\S]*?)(?=Slide\s*\d+\s*:|$)/gi;
  let match;

  while ((match = slideRegex.exec(text)) !== null) {
    const num = parseInt(match[1]);
    const rawTitle = match[2]?.trim() || '';
    const rawBody = match[3]?.trim() || '';

    // If no title on the slide line, first line of body becomes title
    let title = rawTitle;
    let body = rawBody;
    if (!title && rawBody) {
      const lines = rawBody.split('\n');
      title = lines[0];
      body = lines.slice(1).join('\n').trim();
    }

    slides.push({
      id: num,
      title,
      body,
      isTitle: num === 1,
      isCta: false,
    });
  }

  // Fallback: if no slides detected, split by double newlines
  if (slides.length === 0) {
    const chunks = text.split(/\n{2,}/).filter(c => c.trim().length > 0);
    chunks.forEach((chunk, i) => {
      const lines = chunk.split('\n').filter(l => l.trim());
      slides.push({
        id: i + 1,
        title: lines[0] || '',
        body: lines.slice(1).join(' '),
        isTitle: i === 0,
        isCta: i === chunks.length - 1,
      });
    });
  }

  return slides.slice(0, 10); // Max 10 slides
}

import Parser from 'rss-parser';

const parser = new Parser();

export interface RSSEvent {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  type: 'article';
  sourceName: string;
}

export async function scanRSSFeed(feedUrl: string, feedName: string, sinceHours = 48): Promise<RSSEvent[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const events: RSSEvent[] = [];

  try {
    const feed = await parser.parseURL(feedUrl);
    for (const item of feed.items || []) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      if (!pubDate || pubDate < since) continue;
      events.push({
        title: item.title || 'Untitled',
        url: item.link || feedUrl,
        summary: item.contentSnippet ? item.contentSnippet.substring(0, 300) : (item.content ? item.content.substring(0, 300) : ''),
        publishedAt: pubDate.toISOString(),
        type: 'article',
        sourceName: feedName,
      });
    }
  } catch (err) {
    console.log(`RSS scan failed for ${feedUrl}:`, err);
  }

  return events;
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { scanGitHubRepo } from '@/lib/mcp/github-client';
import { scanRSSFeed } from '@/lib/rss/rss-reader';

export async function POST() {
  try {
    const targets = await prisma.trackedTarget.findMany({ where: { isActive: true } });
    const allEvents: any[] = [];

    await Promise.allSettled(targets.map(async (target) => {
      let events: any[] = [];

      if (target.type === 'github') {
        const ghEvents = await scanGitHubRepo(target.url);
        events = ghEvents.map(e => ({ ...e, targetId: target.id, targetName: target.name }));
      } else if (target.type === 'rss') {
        const rssEvents = await scanRSSFeed(target.url, target.name);
        events = rssEvents.map(e => ({ ...e, targetId: target.id, targetName: target.name }));
      } else if (target.type === 'google-news') {
        const rssEvents = await scanRSSFeed(target.url, target.name);
        events = rssEvents.map(e => ({ ...e, targetId: target.id, targetName: target.name }));
      }

      // Save new events to DB
      for (const event of events) {
        const existing = await prisma.radarEvent.findFirst({ where: { url: event.url } });
        if (!existing) {
          const saved = await prisma.radarEvent.create({
            data: {
              targetId: event.targetId,
              title: event.title,
              url: event.url,
              summary: event.summary || '',
              publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
              type: event.type,
              status: 'new',
            },
          });
          allEvents.push({ ...saved, targetName: event.targetName });
        }
      }

      // Update lastScanned
      await prisma.trackedTarget.update({
        where: { id: target.id },
        data: { lastScanned: new Date() },
      });
    }));

    return NextResponse.json({ success: true, newEvents: allEvents.length, events: allEvents });
  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Return all stored events ordered by date
  const events = await prisma.radarEvent.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { target: true },
    take: 50,
  });
  return NextResponse.json({ success: true, events });
}

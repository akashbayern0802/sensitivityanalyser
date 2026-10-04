export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Get all company news events from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const companyNewsEvents = await prisma.radarEvent.findMany({
      where: {
        target: { type: 'google-news' },
        createdAt: { gte: sevenDaysAgo },
      },
      include: { target: true },
      orderBy: { publishedAt: 'desc' },
    });

    // Get all saved influencers with company names
    const savedInfluencers = await prisma.influencer.findMany({
      where: { isSaved: true, companyName: { not: null } },
      select: { id: true, name: true, companyName: true, status: true, linkedinUrl: true },
    });

    // Build a map: companyName -> influencers
    const companyToInfluencers = new Map<string, typeof savedInfluencers>();
    for (const inf of savedInfluencers) {
      const company = inf.companyName!.trim();
      if (!companyToInfluencers.has(company)) companyToInfluencers.set(company, []);
      companyToInfluencers.get(company)!.push(inf);
    }

    // Build alerts: for each company that has news AND has CRM targets
    const alertMap = new Map<string, any>();
    for (const event of companyNewsEvents) {
      const company = event.target.name;
      const targets = companyToInfluencers.get(company) || [];
      if (targets.length === 0) continue; // no CRM targets for this company

      if (!alertMap.has(company)) {
        alertMap.set(company, {
          company,
          targets,
          targetCount: targets.length,
          coldCount: targets.filter(t => t.status === 'cold' || t.status === 'inbox').length,
          latestEvent: event,
          events: [],
        });
      }
      alertMap.get(company)!.events.push(event);
    }

    const alerts = Array.from(alertMap.values()).sort(
      (a, b) => new Date(b.latestEvent.publishedAt || b.latestEvent.createdAt).getTime() -
                 new Date(a.latestEvent.publishedAt || a.latestEvent.createdAt).getTime()
    );

    return NextResponse.json({ success: true, alerts, totalAlerts: alerts.length });
  } catch (error: any) {
    console.error('Alerts error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

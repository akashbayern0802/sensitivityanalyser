export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runCompanyScan } from '@/lib/company-intel';

export const maxDuration = 300;

// POST: Scan Google News for all CRM companies (also triggers auto-discovery on major events)
export async function POST() {
  try {
    const result = await runCompanyScan({ autoDiscover: true });

    return NextResponse.json({
      success: true,
      message: result.message,
      scanned: result.companies.length,
      newEvents: result.newEvents.length,
      events: result.newEvents,
      companies: result.companies,
      majorEvents: result.majorEvents,
      autoDiscovered: result.autoDiscovered,
    });
  } catch (error: any) {
    console.error('Company news scan error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// GET: Return all company news events (google-news type targets only), grouped by company
export async function GET() {
  try {
    const events = await prisma.radarEvent.findMany({
      where: { target: { type: 'google-news' } },
      orderBy: { publishedAt: 'desc' },
      include: { target: true },
      take: 100,
    });

    // Group by company (target.name)
    const grouped = events.reduce((acc: Record<string, any[]>, event) => {
      const company = event.target.name;
      if (!acc[company]) acc[company] = [];
      acc[company].push(event);
      return acc;
    }, {});

    return NextResponse.json({ success: true, grouped, events });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

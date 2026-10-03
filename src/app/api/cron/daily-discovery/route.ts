import { NextResponse } from 'next/server';
import { runCompanyScan } from '@/lib/company-intel';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Hobby plan maximum

/**
 * Daily autonomous discovery. Triggered by Vercel Cron (see vercel.json).
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET environment variable is set on the project.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await runCompanyScan({ autoDiscover: true });

    const summary = {
      success: true,
      scannedCompanies: result.companies.length,
      newArticles: result.newEvents.length,
      majorEvents: result.majorEvents.length,
      autoDiscovered: result.autoDiscovered,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
    };
    console.log('[cron/daily-discovery] done', JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[cron/daily-discovery] failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

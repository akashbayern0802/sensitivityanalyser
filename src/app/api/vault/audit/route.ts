import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET: Fetch recent hallucination audit logs
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const logs = await prisma.hallucinationAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const parsed = logs.map(log => ({
      ...log,
      flaggedClaims: JSON.parse(log.flaggedClaims),
      chunksReferenced: JSON.parse(log.chunksReferenced),
    }));

    return NextResponse.json({ success: true, logs: parsed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Save a new audit log entry
export async function POST(req: Request) {
  try {
    const {
      generationType,
      outputSnippet,
      faithfulnessScore,
      flaggedClaims = [],
      chunksReferenced = [],
      status,
    } = await req.json();

    const log = await prisma.hallucinationAuditLog.create({
      data: {
        generationType,
        outputSnippet: outputSnippet.substring(0, 500),
        faithfulnessScore,
        flaggedClaims: JSON.stringify(flaggedClaims),
        chunksReferenced: JSON.stringify(chunksReferenced),
        status,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

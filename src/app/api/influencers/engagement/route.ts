import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { influencerId, actionType, notes } = await req.json();

    if (!influencerId || !actionType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date();

    // Create the log
    const log = await prisma.engagementLog.create({
      data: {
        influencerId,
        actionType,
        notes,
        createdAt: now
      }
    });

    // Update the influencer's status and lastEngagedAt
    const updated = await prisma.influencer.update({
      where: { id: influencerId },
      data: {
        status: 'engaged',
        lastEngagedAt: now
      }
    });

    return NextResponse.json({ success: true, log, influencer: updated });
  } catch (error: any) {
    console.error('Engagement log error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

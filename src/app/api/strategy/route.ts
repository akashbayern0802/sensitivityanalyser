export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const userId = "user_mock_id"; // Mock auth

    // Get the most recent weekly plan
    const plan = await prisma.weeklyPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plannedItems: true }
    });

    if (!plan) {
      return NextResponse.json({ success: true, plan: null });
    }

    return NextResponse.json({ 
      success: true, 
      plan: {
        id: plan.id,
        status: plan.status,
        planData: plan.planData
      } 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


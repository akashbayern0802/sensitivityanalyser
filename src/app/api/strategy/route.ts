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

export async function PUT(req: Request) {
  try {
    const userId = "user_mock_id"; // Mock auth
    const { planData } = await req.json();

    // Find the most recent plan to update
    const plan = await prisma.weeklyPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) throw new Error("No active plan found");

    const updatedPlan = await prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: { planData: JSON.stringify(planData) }
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Save plan error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


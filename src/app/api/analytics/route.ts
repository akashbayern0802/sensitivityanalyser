import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all snapshots ordered by date
export async function GET() {
  try {
    const userId = "user_mock_id"; // Mock auth
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { userId },
      orderBy: { weekStart: 'asc' },
    });
    return NextResponse.json({ success: true, snapshots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST a new snapshot
export async function POST(req: Request) {
  try {
    const userId = "user_mock_id"; // Mock auth
    const data = await req.json();
    
    // Ensure weekStart is a Monday at 00:00:00
    const weekStart = new Date(data.weekStart);
    weekStart.setHours(0, 0, 0, 0);

    const snapshot = await prisma.analyticsSnapshot.create({
      data: {
        userId,
        weekStart,
        impressions: parseInt(data.impressions) || 0,
        profileViews: parseInt(data.profileViews) || 0,
        searchAppearances: parseInt(data.searchAppearances) || 0,
        followerCount: parseInt(data.followerCount) || 0,
        ssiScore: parseFloat(data.ssiScore) || 0,
        connectionsReceived: parseInt(data.connectionsReceived) || 0,
        visibilityScore: calculateVisibilityScore(data)
      }
    });

    return NextResponse.json({ success: true, snapshot });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Simple heuristic for visibility score
function calculateVisibilityScore(data: any) {
  const impressionsWeight = 0.4;
  const profileViewsWeight = 0.3;
  const followerWeight = 0.3;
  
  // Normalize and calculate a score 1-100 (dummy calculation for now)
  const score = ((data.impressions || 0) / 1000 * impressionsWeight) + 
                ((data.profileViews || 0) / 100 * profileViewsWeight) + 
                (data.ssiScore || 0);
                
  return Math.min(Math.max(Math.round(score), 0), 100);
}

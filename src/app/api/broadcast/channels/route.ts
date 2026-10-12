import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const MOCK_USER_ID = 'user_mock_id';

// GET: List all distribution channels
export async function GET() {
  try {
    const channels = await prisma.distributionChannel.findMany({
      where: { userId: MOCK_USER_ID },
      orderBy: { createdAt: 'desc' },
      include: {
        broadcastLogs: {
          take: 1,
          orderBy: { dispatchedAt: 'desc' },
        },
      },
    });

    return NextResponse.json({ success: true, channels });
  } catch (error: any) {
    console.error('Fetch channels error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a new channel
export async function POST(req: Request) {
  try {
    const { name, type, endpointUrl, authToken } = await req.json();

    if (!name?.trim() || !type || !endpointUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name, type, and endpoint URL are required.' },
        { status: 400 }
      );
    }

    const channel = await prisma.distributionChannel.create({
      data: {
        userId: MOCK_USER_ID,
        name: name.trim(),
        type, // 'slack_webhook' | 'discord_webhook' | 'buffer'
        endpointUrl: endpointUrl.trim(),
        authToken: authToken?.trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, channel });
  } catch (error: any) {
    console.error('Create channel error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Toggle channel active status
export async function PATCH(req: Request) {
  try {
    const { id, isActive } = await req.json();

    const channel = await prisma.distributionChannel.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, channel });
  } catch (error: any) {
    console.error('Update channel error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a channel
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    await prisma.distributionChannel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

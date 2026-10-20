import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const MOCK_USER_ID = 'user_mock_id';

// GET: List all vault items for the user
export async function GET() {
  try {
    const items = await prisma.knowledgeVaultItem.findMany({
      where: { userId: MOCK_USER_ID, isActive: true },
      include: { chunks: { select: { id: true, chunkIndex: true, tokenCount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new vault item
export async function POST(req: Request) {
  try {
    const { title, category, content } = await req.json();
    if (!title || !category || !content) {
      return NextResponse.json(
        { success: false, error: 'title, category, and content are required' },
        { status: 400 },
      );
    }
    const item = await prisma.knowledgeVaultItem.create({
      data: { userId: MOCK_USER_ID, title, category, content },
    });
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

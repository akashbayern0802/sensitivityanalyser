import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const MOCK_USER_ID = 'user_mock_id';

// DELETE: Remove a vault item (soft delete)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.knowledgeVaultItem.updateMany({
      where: { id, userId: MOCK_USER_ID },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update vault item
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const item = await prisma.knowledgeVaultItem.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.category && { category: body.category }),
        ...(body.content && { content: body.content }),
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

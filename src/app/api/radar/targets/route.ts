import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const targets = await prisma.trackedTarget.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ success: true, targets });
}

export async function DELETE(req: Request) {
  try {
    const { id, type } = await req.json();
    if (type) {
      await prisma.trackedTarget.deleteMany({ where: { type } });
      return NextResponse.json({ success: true, deleted: 'type' });
    }
    if (id) {
      await prisma.trackedTarget.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: 'id' });
    }
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { type, name, url, niche } = await req.json();
    if (!type || !name || !url || !niche) {
      return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 });
    }
    
    const target = await prisma.trackedTarget.upsert({
      where: { url },
      update: { name, niche, type },
      create: { type, name, url, niche },
    });
    
    return NextResponse.json({ success: true, target });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

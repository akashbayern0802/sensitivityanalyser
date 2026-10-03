import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE(req: Request) {
  try {
    const { id, deleteAll } = await req.json();
    
    if (deleteAll) {
      await prisma.radarEvent.deleteMany({});
      return NextResponse.json({ success: true, deleted: 'all' });
    }
    
    if (id) {
      await prisma.radarEvent.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: id });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Delete event error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const influencers = await prisma.influencer.findMany({
      where: { isSaved: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, influencers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, isSaved } = await req.json();
    const updated = await prisma.influencer.update({
      where: { id },
      data: { isSaved }
    });
    return NextResponse.json({ success: true, influencer: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, companyName } = await req.json();
    
    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (companyName !== undefined) dataToUpdate.companyName = companyName;

    const updated = await prisma.influencer.update({
      where: { id },
      data: dataToUpdate
    });
    return NextResponse.json({ success: true, influencer: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

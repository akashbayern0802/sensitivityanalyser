import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const MOCK_USER_ID = 'user_mock_id';

export async function GET() {
  try {
    let user = await prisma.user.findUnique({
      where: { id: MOCK_USER_ID },
      include: { profile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: MOCK_USER_ID,
          name: 'Akash Bhattacharya',
          llmProvider: 'openai',
          llmModel: 'gpt-4o-mini',
        },
        include: { profile: true },
      });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const user = await prisma.user.upsert({
      where: { id: MOCK_USER_ID },
      update: {
        name: data.name,
        linkedinUrl: data.linkedinUrl,
        targetRole: data.targetRole,
        targetLocation: data.targetLocation,
        interests: JSON.stringify(data.interests || []),
        llmProvider: data.llmProvider,
        llmModel: data.llmModel,
      },
      create: {
        id: MOCK_USER_ID,
        name: data.name || 'User',
        linkedinUrl: data.linkedinUrl,
        targetRole: data.targetRole,
        targetLocation: data.targetLocation,
        interests: JSON.stringify(data.interests || []),
        llmProvider: data.llmProvider || 'openai',
        llmModel: data.llmModel || 'gpt-4o-mini',
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

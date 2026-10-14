import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { modelConfig, influencer, customContext } = await req.json();

    if (!influencer?.name) {
      return NextResponse.json(
        { success: false, error: 'Influencer details are required' },
        { status: 400 }
      );
    }

    const userId = 'user_mock_id';
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    const senderName = dbUser?.name && dbUser.name !== 'User' ? dbUser.name : '';
    const userRole = dbUser?.targetRole || dbUser?.profile?.headline || 'Senior Technology & Product Leader';
    const userInterests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];
    const companyName = influencer.companyName?.trim() || '';
    const firstName = influencer.name.split(' ')[0] || influencer.name;

    const model = resolveLanguageModel(modelConfig);

    // Fetch latest company news if available for hyper-personalized outreach
    let companyNewsContext = '';
    let newsItem: { title: string; summary: string | null; url: string } | null = null;

    if (companyName) {
      const latestEvent = await prisma.radarEvent.findFirst({
        where: {
          target: { type: 'google-news', name: companyName },
        },
        orderBy: { publishedAt: 'desc' },
      });

      if (latestEvent) {
        newsItem = {
          title: latestEvent.title,
          summary: latestEvent.summary,
          url: latestEvent.url,
        };
        companyNewsContext = `\nRecent Company News about ${companyName}: "${latestEvent.title}${latestEvent.summary ? ` — ${latestEvent.summary}` : ''}"`;
      }
    }

    const prompt = `You are an elite executive networking advisor. Craft 3 personalized LinkedIn connection invitation notes to send to:

Recipient Name: ${influencer.name} (Address them as "${firstName}")
Recipient Headline/Role: ${influencer.headline || 'Industry Leader'}
${companyName ? `Recipient Company: ${companyName}` : ''}
${influencer.whyFollow ? `Why they are notable: ${influencer.whyFollow}` : ''}${companyNewsContext}
${customContext?.trim() ? `Additional Custom Context to weave in: ${customContext.trim()}` : ''}

Sender Profile:
${senderName ? `Name: ${senderName}` : ''}
Role / Positioning: ${userRole}
Core Domains: ${userInterests.length > 0 ? userInterests.join(', ') : 'Technology Strategy, AI & Product Leadership'}

CRITICAL LINKEDIN CONSTRAINTS:
- LinkedIn strictly limits connection request notes to 300 characters MAX.
- Every single note MUST be under 260 characters (including spaces).
- Write from a peer-to-peer executive perspective. Never sound like a salesperson, recruiter, or junior fanboy.
- Never use cliches like "I'd love to pick your brain", "I came across your profile", or "Let's synergize".
- Sign off naturally or omit sign-off to save characters.

Generate 3 distinct invitation options:

OPTION 1 - PEER_SYNERGY:
A warm, peer-to-peer executive note connecting over shared domain focus between their work (${influencer.headline || companyName || 'their domain'}) and your focus in ${userRole}. Under 250 characters.

OPTION 2 - COMPANY_HOOK:
${companyNewsContext ? `Directly reference the recent news about ${companyName} ("${newsItem?.title}") and how it intersects with industry shifts.` : `Reference their leadership at ${companyName || 'their organization'} and a specific strategic theme from their headline (${influencer.headline || 'their field'}).`} Under 250 characters.

OPTION 3 - MINIMALIST:
An ultra-crisp, high-status 1-to-2 sentence note (< 175 characters). Busy CXOs and Managing Partners respond best to brevity and mutual respect.

Format output as EXACTLY these 3 lines/blocks with no extra commentary:
PEER_SYNERGY: [invite text]
COMPANY_HOOK: [invite text]
MINIMALIST: [invite text]`;

    const { text } = await generateText({ model, prompt });

    const peerSynergy = text.match(/PEER_SYNERGY:\s*([\s\S]+?)(?=\nCOMPANY_HOOK:|$)/)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
    const companyHook = text.match(/COMPANY_HOOK:\s*([\s\S]+?)(?=\nMINIMALIST:|$)/)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
    const minimalist = text.match(/MINIMALIST:\s*([\s\S]+?)$/)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';

    const invites = [
      {
        type: 'peer_synergy',
        label: '🤝 Peer Executive Synergy',
        subtitle: 'Shared domain & leadership alignment',
        text: peerSynergy,
      },
      {
        type: 'company_hook',
        label: newsItem ? `📰 ${companyName} News Hook` : '🏢 Role & Company Hook',
        subtitle: newsItem ? 'References latest company intelligence' : 'Tailored to their current mandate',
        text: companyHook,
      },
      {
        type: 'minimalist',
        label: '⚡ Executive Minimalist',
        subtitle: 'Ultra-crisp (<180 chars) for busy CXOs',
        text: minimalist,
      },
    ].filter(item => item.text.length > 0);

    return NextResponse.json({
      success: true,
      invites,
      newsUsed: newsItem,
    });
  } catch (error: any) {
    console.error('Invite generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate invitation messages' },
      { status: 500 }
    );
  }
}


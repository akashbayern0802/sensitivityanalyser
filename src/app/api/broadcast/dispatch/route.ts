import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { contentText, postUrl, channelIds } = await req.json();

    if (!contentText?.trim()) {
      return NextResponse.json({ success: false, error: 'Content text is required.' }, { status: 400 });
    }

    // Query active distribution channels
    const whereClause: any = { isActive: true };
    if (channelIds && Array.isArray(channelIds) && channelIds.length > 0) {
      whereClause.id = { in: channelIds };
    }

    const channels = await prisma.distributionChannel.findMany({
      where: whereClause,
    });

    if (channels.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active distribution channels configured. Please add Slack/Discord webhooks in Settings.',
      }, { status: 400 });
    }

    const cleanPostUrl = postUrl?.trim() || '';
    let resolvedText = cleanPostUrl
      ? contentText.replace(/\[LINKEDIN_POST_LINK\]/g, cleanPostUrl)
      : contentText;

    if (cleanPostUrl && !resolvedText.includes(cleanPostUrl)) {
      resolvedText = `${resolvedText.trim()}\n\n🔗 Read & engage on LinkedIn: ${cleanPostUrl}`;
    }

    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        if (!channel.endpointUrl) {
          throw new Error('Missing endpoint URL / Chat ID');
        }

        let response: Response;

        if (channel.type === 'telegram_bot') {
          if (!channel.authToken?.trim()) {
            throw new Error('Missing Telegram Bot Token');
          }
          const tgUrl = `https://api.telegram.org/bot${channel.authToken.trim()}/sendMessage`;
          const tgText = resolvedText.length > 4090 ? resolvedText.slice(0, 4087) + '...' : resolvedText;
          response = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channel.endpointUrl.trim(),
              text: tgText,
              disable_web_page_preview: false,
            }),
          });
        } else {
          let bodyPayload: Record<string, string>;

          if (channel.type === 'slack_webhook') {
            bodyPayload = { text: resolvedText };
          } else if (channel.type === 'discord_webhook') {
            bodyPayload = { content: resolvedText };
          } else {
            bodyPayload = { text: resolvedText };
          }

          response = await fetch(channel.endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });
        }

        const statusText = response.ok ? 'success' : 'failed';
        const responseLog = response.ok ? 'OK' : `HTTP ${response.status}: ${await response.text().catch(() => '')}`;

        // Save log to database
        await prisma.broadcastLog.create({
          data: {
            channelId: channel.id,
            status: statusText,
            responseLog,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        return { channelId: channel.id, name: channel.name, status: 'success' };
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      dispatchedCount: successful,
      failedCount: failed,
      totalChannels: channels.length,
      results,
    });
  } catch (error: any) {
    console.error('Broadcast dispatch error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Dispatch failed' }, { status: 500 });
  }
}


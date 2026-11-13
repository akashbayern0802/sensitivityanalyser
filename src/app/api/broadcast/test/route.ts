import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { type, endpointUrl, authToken } = await req.json();

    if (!endpointUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: type === 'telegram_bot' ? 'Telegram Channel / Chat ID is required (e.g. @mychannel or -100123456789).' : 'Webhook URL is required.' },
        { status: 400 }
      );
    }

    if (type === 'telegram_bot') {
      const token = authToken?.trim();
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Telegram Bot Token (from @BotFather) is required.' },
          { status: 400 }
        );
      }

      const chatId = endpointUrl.trim();
      const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      const tgRes = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🚀 Sensitivity Analyser Connected!\n\nYour direct LinkedIn posts + URLs are ready to broadcast to this Telegram channel.',
          disable_web_page_preview: false,
        }),
      });

      const tgData = await tgRes.json().catch(() => null);
      if (!tgRes.ok || !tgData?.ok) {
        return NextResponse.json({
          success: false,
          error: tgData?.description || `Telegram API returned status ${tgRes.status}. Ensure the bot is added as an Admin in ${chatId}.`,
        });
      }

      return NextResponse.json({ success: true });
    }

    let payload: Record<string, string>;

    if (type === 'slack_webhook') {
      payload = {
        text: '🚀 *Sensitivity Analyser Test Ping*: Webhook connection established successfully! Ready for automated syndication.',
      };
    } else if (type === 'discord_webhook') {
      payload = {
        content: '🚀 **Sensitivity Analyser Test Ping**: Webhook connection established successfully! Ready for automated syndication.',
      };
    } else {
      payload = { text: 'Test ping from Sensitivity Analyser' };
    }

    const res = await fetch(endpointUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `Webhook returned status ${res.status}: ${errText || res.statusText}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Test webhook error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to ping webhook' }, { status: 500 });
  }
}


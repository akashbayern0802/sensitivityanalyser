import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { type, endpointUrl } = await req.json();

    if (!endpointUrl?.trim()) {
      return NextResponse.json({ success: false, error: 'Webhook URL is required.' }, { status: 400 });
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

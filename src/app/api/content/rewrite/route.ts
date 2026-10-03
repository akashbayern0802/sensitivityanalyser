import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { modelConfig, currentBody, feedback } = await req.json();
    const model = resolveLanguageModel(modelConfig);

    const prompt = "You are a LinkedIn content strategist. Rewrite the following LinkedIn post based on the user's feedback.\n\nCURRENT POST:\n" + currentBody + "\n\nUSER FEEDBACK:\n" + feedback + "\n\nConstraints:\n- Maintain the formatting suitable for LinkedIn.\n- Only output the rewritten post content, nothing else.";

    const { text } = await generateText({ model, prompt });
    return NextResponse.json({ success: true, rewrittenBody: text.trim() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

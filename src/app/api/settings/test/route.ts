import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { resolveLanguageModel, ModelConfig } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const modelConfig: ModelConfig = await req.json();
    const model = resolveLanguageModel(modelConfig);

    const { text } = await generateText({
      model,
      prompt: 'Respond with the single word: OK',
    });

    return NextResponse.json({
      success: true,
      message: `Connected successfully to ${modelConfig.modelId}! Response: "${text.trim().substring(0, 50)}"`,
    });
  } catch (error: any) {
    console.error('[settings/test] Connection test failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Connection test failed' },
      { status: 500 }
    );
  }
}


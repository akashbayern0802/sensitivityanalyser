import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, modelConfig } = await req.json();
    
    let apiKey = modelConfig?.apiKey || process.env.OPENAI_API_KEY;
    if (modelConfig?.provider !== 'openai' && !apiKey) {
        apiKey = process.env.OPENAI_API_KEY;
    }

    if (!apiKey) {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 1000000);
      const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&nologo=true&seed=${seed}`;
      
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) throw new Error('Image generation service busy. Please try again.');
      
      const arrayBuffer = await pollRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = pollRes.headers.get('content-type') || 'image/jpeg';
      const imageUrl = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({ success: true, imageUrl, warning: 'Using free fallback generator.' });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, imageUrl: data.data[0].url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

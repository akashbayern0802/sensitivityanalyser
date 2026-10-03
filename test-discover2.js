const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function test() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  const ai = new GoogleGenAI({ vertexai: true, apiKey });

  // Test with the exact failing query
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `You are a research assistant. Search the live web for top ACTIVE LinkedIn thought leaders in: "AI+Fintech". IMPORTANT REGIONAL CONSTRAINT: India. Return ONLY a raw JSON array of 6-8 people. No markdown. No explanation. Array fields: name, headline, linkedinUrl, whyFollow, topics`,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
    },
  });

  const text = response.text ?? '';
  console.log('Full response length:', text.length);
  console.log('First 500 chars:', text.substring(0, 500));
  
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  console.log('JSON match found:', !!jsonMatch);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed count:', parsed.length);
    } catch(e) { console.log('Parse error:', e.message); }
  }
}

test().catch(e => console.error('ERROR:', e.message));

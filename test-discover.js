const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function test() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  console.log('API Key present:', !!apiKey);

  const ai = new GoogleGenAI({ vertexai: true, apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: 'Return a JSON array of 2 LinkedIn influencers in AI. No markdown. Only raw JSON array with fields: name, headline, linkedinUrl, whyFollow',
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
    },
  });

  console.log('--- response.text ---');
  console.log(response.text?.substring(0, 500));
  console.log('--- candidates ---');
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      console.log('Part type:', Object.keys(part));
      if (part.text) console.log('text:', part.text.substring(0, 300));
    }
  }
}

test().catch(e => console.error('ERROR:', e.message));

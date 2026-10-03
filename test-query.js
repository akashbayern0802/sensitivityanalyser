const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  const ai = new GoogleGenAI({ vertexai: true, apiKey });

  const query = "Executive/Retained Search Partners (Korn Ferry, Michael Page India, Spencer Stuart)";
  const countryClause = "CONSTRAINT: Only return influencers based in or primarily associated with India.";

  const prompt = `You are an executive talent research assistant with access to live Google Search.

Find the top ACTIVE LinkedIn thought leaders in: "${query}". ${countryClause}

Return ONLY a valid JSON array. No markdown. No prose. Start your response with "[" and end with "]".

[
  {
    "name": "Full Name",
    "headline": "Current Role at Company | Key expertise",
    "linkedinUrl": "https://www.linkedin.com/in/exact-username",
    "whyFollow": "One sentence on why their content is high-signal for this niche",
    "topics": ["topic1", "topic2"]
  }
]

Include 6-8 real people. All linkedinUrl values must be real /in/ profile URLs.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    console.log("--- FULL RESPONSE OBJECT ---");
    console.log(JSON.stringify(response, null, 2));

    let fullText = '';
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.text) fullText += part.text;
    }
    if (!fullText) fullText = response.text ?? '';
    
    console.log("\n--- EXTRACTED TEXT ---");
    console.log(fullText);

  } catch(e) {
    console.error("API Error:", e);
  }
}

test();

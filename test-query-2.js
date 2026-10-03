const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  const ai = new GoogleGenAI({ vertexai: true, apiKey });

  const query = "Executive/Retained Search Partners (Korn Ferry, Michael Page India, Spencer Stuart)";
  
  // No grounding to see if that's the issue
  const prompt = `You are an executive talent research assistant.

Find the top ACTIVE LinkedIn thought leaders in: "${query}". CONSTRAINT: India.

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
    console.log("Calling API without grounding...");
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    console.log("Finish Reason:", response.candidates?.[0]?.finishReason);
    console.log("Text:", response.text);

  } catch(e) {
    console.error("API Error:", e);
  }
}

test();

const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const ai = new GoogleGenAI({ vertexai: true, apiKey: process.env.GOOGLE_VERTEX_API_KEY });
  const model = "gemini-3.8-flash";

  console.log("Testing very simple query...");
  const res = await ai.models.generateContent({
    model,
    contents: "Find 3 executive recruiters in India.",
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  console.log("Result length:", res.text?.length);
  console.log("Text:", res.text?.substring(0, 100));
}

test().catch(e => console.error(e));

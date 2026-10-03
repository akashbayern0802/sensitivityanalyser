const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const ai = new GoogleGenAI({ vertexai: true, apiKey: process.env.GOOGLE_VERTEX_API_KEY });
  
  console.log("Testing complex query...");
  const res = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: "Find 5 executive search partners specifically at Korn Ferry, Michael Page, or Spencer Stuart in India.",
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  console.log("Result length:", res.text?.length);
  if(!res.text) {
      console.log(JSON.stringify(res, null, 2));
  }
}

test().catch(e => console.error(e));

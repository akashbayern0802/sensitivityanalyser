const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const ai = new GoogleGenAI({ vertexai: true, apiKey: process.env.GOOGLE_VERTEX_API_KEY });
  
  const query = "Korn Ferry + Michael Page + Executive Recruiters";
  const country = "India";
  const regionSuffix = ` based in ${country}`;
  const prompt = `Find the names, current job titles, company names, LinkedIn profile URLs, and why they are influential for ${query}${regionSuffix}. List 6 to 8 specific real people.`;
  
  console.log("Prompt:", prompt);
  
  const res = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  
  console.log("Result length:", res.text?.length);
  console.log("First 300:", res.text?.substring(0, 300));
}

test().catch(e => console.error(e));

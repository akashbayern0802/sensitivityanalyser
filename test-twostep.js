const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

async function test() {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  const ai = new GoogleGenAI({ vertexai: true, apiKey });
  const model = "gemini-3.8-flash";

  const query = "Executive/Retained Search Partners (Korn Ferry, Michael Page India, Spencer Stuart)";
  const country = "India";
  const countryClause = "They MUST be based in or primarily associated with India.";

  // STEP 1: Research (Grounded, no JSON constraints)
  console.log("Step 1: Researching...");
  const researchPrompt = `Search the live web for the top ACTIVE LinkedIn thought leaders and executives in: "${query}". ${countryClause}
Find 5 to 8 specific real people. For each person, find their exact current role, company, and their real LinkedIn profile URL.
Write down your findings in a clear list.`;

  try {
    const researchRes = await ai.models.generateContent({
      model,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    let researchText = '';
    for (const part of researchRes.candidates?.[0]?.content?.parts || []) {
      if (part.text) researchText += part.text;
    }
    if (!researchText) researchText = researchRes.text || '';
    
    console.log("Research Result Length:", researchText.length);
    if (!researchText) {
       console.log("Finish Reason:", researchRes.candidates?.[0]?.finishReason);
       return;
    }

    // STEP 2: Format (Ungrounded, strict JSON)
    console.log("\nStep 2: Formatting to JSON...");
    const formatPrompt = `You are a data extractor. Convert the following research notes into a strict JSON array of objects.
Do not include any prose, markdown, or other text. Only the JSON array.

Required JSON format:
[
  {
    "name": "Full Name",
    "headline": "Current Role at Company | Key expertise",
    "linkedinUrl": "https://www.linkedin.com/in/exact-username",
    "whyFollow": "One sentence on why their content is high-signal",
    "topics": ["topic1", "topic2"]
  }
]

Research Notes:
${researchText}
`;

    const formatRes = await ai.models.generateContent({
      model,
      contents: formatPrompt,
      config: { temperature: 0.1 },
    });

    console.log(formatRes.text?.substring(0, 500));

  } catch(e) {
    console.error("API Error:", e);
  }
}

test();

const { buildAiClient, VERTEX_MODEL } = require('./src/lib/executive-discovery');
async function test() {
  const ai = buildAiClient();
  const prompt = 'You are a business news analyst. Return ONLY a raw JSON object (no markdown) with exactly these keys: "summary" (exactly 2 sentences focused on business impact), "isMajorEvent" (boolean), "eventType" (one of: funding, acquisition, leadership, launch, expansion, layoffs, regulatory, none). Set isMajorEvent=true ONLY for funding rounds, acquisitions or mergers, C-suite or leadership changes, major product launches, or major market expansions for Yellow.ai. Routine coverage, opinion pieces, stock price chatter and passing mentions are NOT major events. Article title: Yellow.ai Nexus EDGE Brings Agentic AI Directly to Enterprise Employee Desktops - konsulteer.com. Article snippet: Yellow.ai has launched Nexus EDGE, an agentic AI solution deployed directly on enterprise desktops to streamline workflows and reduce the time employees spend toggling between disparate tools.';
  const res = await ai.models.generateContent({
      model: VERTEX_MODEL,
      contents: prompt,
      config: { temperature: 0.2 },
  });
  console.log(res.text);
}
test();

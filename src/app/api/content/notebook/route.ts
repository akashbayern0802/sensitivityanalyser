import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { load } from 'cheerio';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, modelConfig } = body;

    const userId = MOCK_USER_ID;
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Senior Tech & Product Leader';
    const model = resolveLanguageModel(modelConfig);

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: EXTRACT WEB URL CONTENT FOR NOTEBOOK SOURCE
    // ─────────────────────────────────────────────────────────────
    if (action === 'extract-url') {
      const { url } = body;
      if (!url?.trim()) {
        return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
      }

      let rawHtml = '';
      try {
        const response = await fetch(parsedUrl.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SensitivityAnalyser/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rawHtml = await response.text();
      } catch (fetchErr: any) {
        return NextResponse.json(
          { success: false, error: `Could not fetch URL: ${fetchErr.message}` },
          { status: 422 }
        );
      }

      const $ = load(rawHtml);
      $('script, style, nav, footer, header, aside, .sidebar, .ad, .cookie-banner, .advertisement').remove();
      const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || parsedUrl.hostname;
      const mainContent =
        $('article, main, .post-content, .article-content, .entry-content, .content, #content').first().text() ||
        $('body').text();

      const cleanText = mainContent.replace(/\s+/g, ' ').trim().substring(0, 10000);
      if (cleanText.length < 80) {
        return NextResponse.json(
          { success: false, error: 'Could not extract meaningful content from this URL' },
          { status: 422 }
        );
      }

      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
      return NextResponse.json({
        success: true,
        source: {
          id: `src_url_${Date.now()}`,
          title: pageTitle.slice(0, 80),
          content: cleanText,
          type: 'url',
          url: parsedUrl.toString(),
          wordCount,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: MULTI-SOURCE SYNTHESIS & GROUNDED Q&A
    // ─────────────────────────────────────────────────────────────
    if (action === 'synthesize') {
      const { sources = [], query, preset } = body;
      if (!Array.isArray(sources) || sources.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one source is required for notebook synthesis' },
          { status: 400 }
        );
      }

      const sourcesBlock = sources
        .map(
          (s: any, idx: number) =>
            `[SOURCE ${idx + 1}: ${s.title || 'Untitled'} (${s.type || 'note'})]\n${(s.content || '').substring(0, 4000)}`
        )
        .join('\n\n---\n\n');

      let queryIntent = query?.trim() || '';
      if (!queryIntent) {
        if (preset === 'contradiction') {
          queryIntent = 'Identify the single biggest contradiction or paradox between what the industry believes and what the data/facts actually show in these sources.';
        } else if (preset === 'metrics') {
          queryIntent = 'Extract all quantitative metrics, growth rates, latency figures, dollar amounts, and concrete numbers from these sources with their exact context.';
        } else if (preset === 'contrarian') {
          queryIntent = 'What is the sharpest contrarian or counter-intuitive thesis that an executive can defend using these sources?';
        } else if (preset === 'playbook') {
          queryIntent = 'Synthesize a 3-step actionable architectural or product playbook to solve the core problem described in these sources.';
        } else {
          queryIntent = 'Synthesize the top 3 high-signal executive takeaways from these sources.';
        }
      }

      const systemPrompt = `You are Gemini Research Notebook, an elite research assistant for an executive (${userRole}).
You strictly ground your analysis in the provided sources. Do NOT invent numbers, company names, or case studies.
Highlight concrete trade-offs, real friction points, and exact numbers.`;

      const prompt = `SOURCES LOADED IN NOTEBOOK (${sources.length} sources):
${sourcesBlock}

USER QUERY / RESEARCH INTENT:
${queryIntent}

Provide a structured, grounded synthesis:
1. Executive Summary & Core Insight (2-3 sentences highlighting the central tension or contradiction)
2. Concrete Evidence & Grounded Metrics (bullet points citing exact numbers from the sources)
3. Strategic Implication for ${userRole} (what action or stance to take)

Keep the response sharp, dense with facts, and free of filler words.`;

      const { text: answer } = await generateText({
        model,
        prompt,
        system: systemPrompt,
        temperature: 0.1,
      });

      // Extract regex metrics from synthesis for quick tags
      const metricMatches =
        answer.match(
          /(?:₹|\$|€|£)\s*\d+(?:\.\d+)?\s*(?:Cr|L|M|B|K|billion|million)?|\b\d+(?:\.\d+)?\s*(?:%|x|ms|s|sec|TPS|RPS|Cr|M|B|K|engineers|users|customers|APIs)\b/gi
        ) || [];
      const uniqueMetrics = Array.from(new Set(metricMatches.map((m) => m.trim()))).slice(0, 8);

      return NextResponse.json({
        success: true,
        synthesis: {
          answer,
          query: queryIntent,
          metrics: uniqueMetrics,
          sourceCount: sources.length,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3: 1-CLICK DRAFT I-H-O-P POST FROM NOTEBOOK INSIGHT
    // ─────────────────────────────────────────────────────────────
    if (action === 'draft-post') {
      const { insight, sources = [], preferredTopic } = body;

      if (!insight?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Insight text is required to draft post' },
          { status: 400 }
        );
      }

      const sourcesSummary = sources
        .slice(0, 3)
        .map((s: any, i: number) => `Source ${i + 1} (${s.title}): ${s.content.substring(0, 800)}`)
        .join('\n');

      const prompt = `You are an elite LinkedIn ghostwriter for ${userRole}.
Transform this research insight into a high-converting, authority-building LinkedIn post using the I-H-O-P framework:

RESEARCH INSIGHT:
${insight}

VERIFIED SOURCE CONTEXT:
${sourcesSummary}

${preferredTopic ? `PREFERRED TOPIC FOCUS: ${preferredTopic}` : ''}

MANDATORY I-H-O-P EXECUTION RULES:
1. [💡 IDEA]: Focus on the central friction point or contradiction. No bland textbook summaries.
2. [🪝 HOOK]: First 2 lines MUST deliver Curiosity + Credibility + Value Commitment.
   - Sentence 1: MUST be under 45 characters (stays on 1 mobile line).
   - Sentence 2: High-credibility setup ending with a colon (:).
   - Hook must strictly fit within 3 visual lines (~110-130 characters total).
3. [🎯 OPINION]: Take a bold, defensible stance on what fails and what works. Zero generic platitudes.
4. [📦 PACKAGING]: Ultra-clean mobile whitespace (1-2 sentences per paragraph max, under 200 chars each). Avoid corporate clichés ("In today's fast-paced world..."). End with an engaging peer discussion question and 3-5 hashtags.

Output ONLY valid JSON in this exact structure:
{
  "topic": "Clean topic headline",
  "angle": "Executive contrarian angle",
  "postBody": "The full post text with double newlines between paragraphs",
  "imagePrompt": "A high-signal concept diagram or illustration prompt representing the core insight"
}`;

      const { text: rawJson } = await generateText({
        model,
        prompt,
        temperature: 0.1,
      });

      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse draft JSON from Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return NextResponse.json({
        success: true,
        draft: {
          topic: parsed.topic || preferredTopic || 'Executive Strategic Insight',
          angle: parsed.angle || '',
          postBody: parsed.postBody || '',
          imagePrompt: parsed.imagePrompt || '',
        },
      });
    }

    // ---------------------------------------------------------
    // ACTION 4: Generate 6-Slide Executive Carousel Deck + Post
    // ---------------------------------------------------------
    if (action === 'generate-carousel') {
      const { sources = [], insight = '', preferredTopic = '' } = body;

      if (!Array.isArray(sources) || (sources.length === 0 && !insight)) {
        return NextResponse.json({ success: false, error: 'Please load at least one source or synthesis insight first' }, { status: 400 });
      }

      const sourcesSummary = sources
        .slice(0, 4)
        .map((s: any, i: number) => `Source ${i + 1} (${s.title}): ${s.content.substring(0, 1200)}`)
        .join('\n\n');

      const prompt = `You are an elite LinkedIn Visual Architect and Ghostwriter for ${userRole}.
Transform the following grounded research into a high-impact 6-Slide LinkedIn PDF Carousel Deck AND a companion I-H-O-P post caption.

${insight ? `CORE RESEARCH INSIGHT:\n${insight}\n` : ''}
VERIFIED SOURCE CONTEXT:
${sourcesSummary}

${preferredTopic ? `PREFERRED TOPIC FOCUS: ${preferredTopic}` : ''}

STRICT CAROUSEL RULES:
1. Ground every metric, percentage, and claim strictly in the provided sources. Do NOT invent statistics.
2. Create exactly 6 slides:
   - Slide 1 (isTitle: true): High-tension Hook Headline (max 45 chars) + executive subtitle (max 90 chars).
   - Slide 2: The Core Industry Contradiction / P&L Trap (with verified numbers from the sources).
   - Slide 3: Playbook Step 1 — Concrete architectural or product shift.
   - Slide 4: Playbook Step 2 — Operational or unit-economics rule.
   - Slide 5: Playbook Step 3 — Strategic moat or monetization lever.
   - Slide 6 (isCta: true): Executive Takeaway & peer discussion question.
3. Also write a companion I-H-O-P LinkedIn post ("postBody") introducing the carousel:
   - Line 1 MUST be under 40 characters so it stays on 1 visual mobile line.
   - Line 2 MUST be under 50 characters and end with a colon (:) so both lines stay above LinkedIn's 3-line clamp!

Output ONLY valid JSON in this exact format:
{
  "topic": "Clean topic headline",
  "postBody": "Companion I-H-O-P LinkedIn post text with double newlines",
  "slides": [
    { "id": 1, "title": "Slide 1 Headline", "body": "Subtitle / framing", "isTitle": true },
    { "id": 2, "title": "The Core Paradox", "body": "2-3 punchy sentences with verified stats" },
    { "id": 3, "title": "01 / First Shift", "body": "Concrete rule and impact" },
    { "id": 4, "title": "02 / Second Shift", "body": "Concrete rule and impact" },
    { "id": 5, "title": "03 / Third Shift", "body": "Concrete rule and impact" },
    { "id": 6, "title": "Executive Takeaway", "body": "Closing synthesis + peer question", "isCta": true }
  ]
}`;

      const { text: rawJson } = await generateText({
        model,
        prompt,
        temperature: 0.1,
      });

      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse carousel JSON from Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return NextResponse.json({
        success: true,
        topic: parsed.topic || preferredTopic || 'Executive Carousel Deck',
        postBody: parsed.postBody || '',
        slides: Array.isArray(parsed.slides) ? parsed.slides : [],
      });
    }

    // ---------------------------------------------------------
    // ACTION 5: Generate Executive Infographic / Comparison Card
    // ---------------------------------------------------------
    if (action === 'generate-infographic') {
      const { sources = [], insight = '', preferredTopic = '' } = body;

      if (!Array.isArray(sources) || (sources.length === 0 && !insight)) {
        return NextResponse.json({ success: false, error: 'Please load at least one source or synthesis insight first' }, { status: 400 });
      }

      const sourcesSummary = sources
        .slice(0, 4)
        .map((s: any, i: number) => `Source ${i + 1} (${s.title}): ${s.content.substring(0, 1200)}`)
        .join('\n\n');

      const prompt = `You are an elite Executive Data Visualizer for ${userRole}.
Synthesize the loaded research sources into a high-signal LinkedIn Executive Infographic Card (Hero Metrics + Legacy vs. Modern Playbook Matrix + Bottom-Line Takeaway).

${insight ? `CORE RESEARCH INSIGHT:\n${insight}\n` : ''}
VERIFIED SOURCE CONTEXT:
${sourcesSummary}

${preferredTopic ? `PREFERRED TOPIC FOCUS: ${preferredTopic}` : ''}

STRICT GROUNDING RULES:
1. Extract 3 punchy hero metrics directly from the sources (if exact numbers aren't present, use sharp structural ratios like "0% MDR", "3x Cost", "100% Float").
2. Build 3 high-contrast comparison rows contrasting the "Old / Legacy Trap" vs. the "Modern Executive Playbook".
3. Provide a 1-sentence bottom-line executive rule.

Output ONLY valid JSON in this exact format:
{
  "title": "Executive Infographic Headline (max 55 chars)",
  "subtitle": "Grounded synthesis across verified research sources",
  "metrics": [
    { "value": "+68%", "label": "Short Metric Label", "tone": "emerald" },
    { "value": "0%", "label": "Short Metric Label", "tone": "amber" },
    { "value": "3.2x", "label": "Short Metric Label", "tone": "indigo" }
  ],
  "comparisonRows": [
    { "dimension": "Primary Revenue", "legacyModel": "Old failing approach", "modernPlaybook": "New winning architecture" },
    { "dimension": "Cost Structure", "legacyModel": "Old failing approach", "modernPlaybook": "New winning architecture" },
    { "dimension": "Strategic Moat", "legacyModel": "Old failing approach", "modernPlaybook": "New winning architecture" }
  ],
  "takeaway": "One punchy, quotable executive rule summarizing the shift."
}`;

      const { text: rawJson } = await generateText({
        model,
        prompt,
        temperature: 0.1,
      });

      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse infographic JSON from Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return NextResponse.json({
        success: true,
        infographic: {
          title: parsed.title || preferredTopic || 'Executive Architecture Matrix',
          subtitle: parsed.subtitle || `Grounded synthesis for ${userRole}`,
          metrics: Array.isArray(parsed.metrics) ? parsed.metrics.slice(0, 3) : [],
          comparisonRows: Array.isArray(parsed.comparisonRows) ? parsed.comparisonRows.slice(0, 4) : [],
          takeaway: parsed.takeaway || '',
        },
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[Gemini Notebook API Error]:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}


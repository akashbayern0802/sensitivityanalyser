import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { load } from 'cheerio';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { url, modelConfig } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch the page content
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
      return NextResponse.json({ success: false, error: `Could not fetch URL: ${fetchErr.message}` }, { status: 422 });
    }

    // Extract main text using cheerio
    const $ = load(rawHtml);
    $('script, style, nav, footer, header, aside, .sidebar, .ad, .cookie-banner, .advertisement').remove();
    
    // Try to get main article content
    const mainContent = $('article, main, .post-content, .article-content, .entry-content, .content, #content').first().text() 
      || $('body').text();
    
    const cleanText = mainContent.replace(/\s+/g, ' ').trim().substring(0, 6000);

    if (cleanText.length < 100) {
      return NextResponse.json({ success: false, error: 'Could not extract meaningful content from this URL.' }, { status: 422 });
    }

    // Get user profile for context
    const userId = 'user_mock_id';
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userRole = dbUser?.targetRole || 'Professional';
    const userInterests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];

    const model = resolveLanguageModel(modelConfig);

    const { text } = await generateText({
      model,
      prompt: `You are a LinkedIn thought leader who transforms dense technical content into high-signal educational posts.

User's Role: ${userRole}
User's Expertise: ${userInterests.join(', ') || 'General'}

Source URL: ${url}

Source Content:
${cleanText}

Task: Extract the 3 most valuable, actionable insights from this content and write a LinkedIn "Knowledge Share" post.

LINKEDIN 360 BREW RULES (strictly follow):
- The algorithm categorises posts as "Knowledge Sharing & Advice" or "Engagement Bait". Write squarely in the first category.
- Mobile Hook: First 1-2 lines must be under 100 characters and tell the reader EXACTLY what they will learn.
- Each insight should be a standalone paragraph of 1-2 sentences. No fluff.
- Write from the perspective of someone who genuinely understands this topic (the user's role).
- End with ONE specific, domain-relevant question to invite expert discussion.
- Add 3-5 hashtags at the bottom.
- Strip ALL marketing language from the source. If the source has hype, cut it.

Also add at the end on a new line: IMAGE_PROMPT: [a clean image description for this post]`,
    });

    // Extract image prompt
    const parts = text.split(/(?:\*\*)?IMAGE_?PROMPT:?(?:\*\*)?/i);
    const postBody = parts[0].trim();
    const imagePrompt = parts[1]?.trim().split('\n\n')[0] || `A clean professional illustration representing: ${url}`;

    // Save as draft
    const draft = await prisma.contentDraft.create({
      data: {
        userId,
        body: postBody,
        format: 'Knowledge Share',
        imagePrompt,
        status: 'draft',
      },
    });

    return NextResponse.json({ 
      success: true, 
      draft,
      sourceUrl: url,
      extractedLength: cleanText.length,
    });
  } catch (error: any) {
    console.error('Extract error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

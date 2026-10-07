import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

export async function POST(req: Request) {
  try {
    const { modelConfig, topic, format, angle } = await req.json();
    
    const userId = "user_mock_id";
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const userProfile = dbUser || { targetRole: 'Professional' };
    const model = resolveLanguageModel(modelConfig);

    const isCarousel = format.toLowerCase().includes('carousel');
    
    const prompt = `Write a LinkedIn post.
      Topic: ${topic}
      Format: ${format}
      Angle/Perspective: ${angle}
      User's Role: ${userProfile?.targetRole || 'Professional'}
      
      MOBILE-FIRST & LINKEDIN 360 BREW CONSTRAINTS:
      - Write in a highly conversational, authentic tone. Zero corporate jargon or generic AI intros ("In today's fast-paced world...").
      - Mobile Hook: The "See more" button truncates posts after the first 3 lines on mobile. The first 1-2 lines MUST contain a punchy, scroll-stopping hook (under 100 characters) that forces a click.
      - Mobile Readability: Max 1-2 short sentences per paragraph. A paragraph should not exceed 3 lines on a mobile screen.
      - Authority & Alignment: Ensure the post demonstrates genuine subject matter expertise. Share actionable knowledge, not just engagement bait.
      - Sprinkle 2-4 relevant emojis naturally to break up text visually.
      - End with an engaging, casual question to invite comments.
      
      ${isCarousel ? 
      `CAROUSEL SPECIFIC CONSTRAINTS (For Mobile Swiping):
      - Format the output clearly into "Slide 1:", "Slide 2:", etc.
      - Mobile slides are small: Keep text per slide EXTREMELY brief (Max 1 short headline + 15 words per slide).
      - Include a "Title Slide" and a "Call to Action Slide".` 
      : 
      `- Add 3-5 relevant hashtags at the very bottom.`}
      
      Also, at the very end of your response, on a new line starting with "IMAGE_PROMPT:", provide a prompt that could be sent to an AI image generator (like DALL-E) to create an accompanying image for this post.`;

    const { text } = await generateText({
      model,
      prompt,
    });

    // Extract image prompt
    let postBody = text;
    let imagePrompt = null;
    
    // More robust regex to catch variations like **IMAGE_PROMPT:** or Image Prompt:
    const regex = /(?:\*\*)?IMAGE_?PROMPT:?(?:\*\*)?/i;
    const parts = text.split(regex);
    
    if (parts.length > 1) {
      postBody = parts[0].trim();
      imagePrompt = parts[1].trim();
      // Clean up any trailing text like "Hope this helps!"
      imagePrompt = imagePrompt.split('\n\n')[0].trim();
    } else {
      // Fallback if LLM forgets the delimiter
      imagePrompt = "A professional, aesthetic corporate illustration representing: " + topic;
    }

    // Save as draft
    const draft = await prisma.contentDraft.create({
      data: {
        userId,
        body: postBody,
        format,
        imagePrompt,
        status: 'draft'
      }
    });

    return NextResponse.json({ success: true, draft });
  } catch (error: any) {
    console.error('Content generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}



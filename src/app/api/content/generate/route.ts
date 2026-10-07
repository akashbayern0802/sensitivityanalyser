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

    const prompt = `Write a LinkedIn post.
      Topic: ${topic}
      Format: ${format}
      Angle/Perspective: ${angle}
      User's Role: ${userProfile?.targetRole || 'Professional'}
      
      ${format.toLowerCase().includes('carousel') || format.toLowerCase().includes('slide') ? `
      CAROUSEL FORMAT INSTRUCTIONS (CRITICAL):
      - You are generating content for a multi-slide PDF carousel.
      - You MUST format your output exactly like this:
      Slide 1: [Catchy Title/Hook for the Cover]
      [Optional subtitle]
      
      Slide 2: [Point 1 Title]
      [Point 1 details - max 15 words]
      
      Slide 3: [Point 2 Title]
      [Point 2 details - max 15 words]
      
      (Continue for up to 8 slides)
      
      Slide 8: [Call to Action Title]
      [Ask a question or tell them to follow]
      ` : ''}

      Constraints:
      - Write in a highly conversational, human, and authentic tone (like you're talking to a colleague over coffee).
      - DO NOT use generic AI intros like "Have you ever wondered..." or "In today's fast paced world...".
      - Start with a punchy, scroll-stopping hook (first 1-2 lines).
      - Use plenty of whitespace (1-2 sentences per paragraph max).
      - Sprinkle 2-4 relevant emojis naturally throughout the text to break it up visually.
      - Avoid cringy corporate buzzwords or overly dramatic language.
      - End with an engaging, casual question to invite comments.
      - Add 3-5 relevant hashtags at the very bottom.
      
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



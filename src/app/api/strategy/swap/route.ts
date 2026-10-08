import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

const MOCK_USER_ID = 'user_mock_id';

export async function POST(req: Request) {
  try {
    const { modelConfig, rejectedTopic, archetype, day, format } = await req.json();

    const dbUser = await prisma.user.findUnique({ where: { id: MOCK_USER_ID } });
    const role = dbUser?.targetRole || 'Product Manager';
    const interests: string[] = dbUser?.interests ? JSON.parse(dbUser.interests) : [];
    const topics = interests.join(', ') || 'Product Management';
    const location = dbUser?.targetLocation || 'India';

    const resolvedConfig = modelConfig || {
      provider: dbUser?.llmProvider || 'gemini',
      modelId: dbUser?.llmModel || 'gemini-3.8-flash',
    };
    const model = resolveLanguageModel(resolvedConfig);

    const archetypeGuide: Record<string, string> = {
      AUTHORITY_BUILDER: `An AUTHORITY BUILDER post (format: carousel or listicle): Deep expert-level content. Specific frameworks or data only someone in "${role}" would know. Topic from: ${topics}.`,
      NETWORK_ACTIVATOR: `A NETWORK ACTIVATOR post (format: text): Short, confident contrarian opinion. Must challenge a mainstream belief in ${role} or ${topics}. Ends with a debate-triggering question.`,
      EXPERIENCE_SHARE: `An EXPERIENCE SHARE post (format: story): Personal career anecdote. Must start with "I" or "When I". Validates a professional principle relevant to ${role}.`,
    };

    const guide = archetypeGuide[archetype] || archetypeGuide.AUTHORITY_BUILDER;

    const prompt = `You are a LinkedIn growth strategist for Indian professionals targeting ${role} roles.

The user REJECTED this idea for ${day}:
Topic: "${rejectedTopic}"
Format: ${format}
Archetype: ${archetype}

Generate ONE completely different replacement idea:
${guide}

User profile:
- Target Role: ${role}
- Location: ${location}
- Topics/Skills: ${topics}

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "day": "${day}",
  "time": "08:00",
  "format": "${format}",
  "archetype": "${archetype}",
  "topic": "specific, punchy post topic relevant to Indian recruiters hiring for ${role}",
  "angle": "the unique hook — 1 sentence, specific and compelling",
  "whyThisTime": "one sentence on why posting at this IST time maximises recruiter impressions"
}`;

    let text = '';
    try {
      const result = await generateText({ model, prompt });
      text = result.text;
    } catch (primaryError: any) {
      if (primaryError.message?.includes('high demand') || primaryError.message?.includes('429')) {
        const fallbackConfig = { ...resolvedConfig, modelId: 'gemini-2.0-flash' };
        const fallbackModel = resolveLanguageModel(fallbackConfig);
        const fallbackResult = await generateText({ model: fallbackModel, prompt });
        text = fallbackResult.text;
      } else {
        throw primaryError;
      }
    }

    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Model did not return valid JSON');
    const newIdea = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));

    return NextResponse.json({ success: true, idea: newIdea });
  } catch (error: any) {
    console.error('Swap error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

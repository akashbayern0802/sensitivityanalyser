import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';

// Allow up to 90s for AI generation (monthly plans are larger)
export const maxDuration = 90;

// Detect if the user is in the Indian market based on their location string
function isIndianMarket(location: string): boolean {
  const indianKeywords = [
    'india', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad',
    'pune', 'chennai', 'kolkata', 'gurgaon', 'gurugram', 'noida',
    'ahmedabad', 'kochi', 'coimbatore', 'jaipur', 'chandigarh', 'ist'
  ];
  return indianKeywords.some(kw => location.toLowerCase().includes(kw));
}

export async function POST(req: Request) {
  try {
    const { modelConfig, userProfile, mode = 'weekly', feedback, previousPlan } = await req.json();
    const userId = 'user_mock_id';

    const model = resolveLanguageModel(modelConfig);
    const isMonthly = mode === 'monthly';

    const topics = Array.isArray(userProfile?.interests) && userProfile.interests.length > 0
      ? userProfile.interests.join(', ')
      : 'industry trends, career growth, leadership';

    const role = userProfile?.targetRole || 'Professional';
    const location = userProfile?.targetLocation || '';
    const isIndia = isIndianMarket(location);

    // ── GOLDEN HOURS ─────────────────────────────────────────────────────────
    // IST-specific peak windows differ from US/UK:
    // - Indian recruiters (talent + executive) are heavy LinkedIn users
    //   during commute, lunch, and post-work hours in IST
    const goldenHoursContext = isIndia ? `
LINKEDIN GOLDEN HOURS — INDIA (IST, Indian recruiter behaviour):
Talent recruiters (HR, TA teams at Indian corporates, startups, MNCs) and executive/retained search firms
(Korn Ferry, Spencer Stuart, ABC Consultants, Mancer, Michael Page India, etc.) are most active at these times:

BEST TIMES TO POST (original content — max algorithm boost):
- Tuesday–Thursday 8:00–9:30 AM IST → PEAK: recruiters check feeds before office meetings; LinkedIn algorithm rewards early-morning posts with higher reach
- Monday 8:00–9:00 AM IST → GOOD: "week-intent" posts (goals, industry outlook) perform well
- Wednesday 12:30–1:30 PM IST → GOOD: lunch hour, high scroll activity across India
- Friday 9:00–10:30 AM IST → GOOD: reflection / week-in-review posts before the weekend

BEST TIMES TO COMMENT (engagement — recruiter notice):
- Tuesday–Thursday 12:00–1:30 PM IST → PEAK: lunch scroll, high reply rate; commenting on senior leaders' posts at this time surfaces your name to their network
- Tuesday–Thursday 6:30–8:00 PM IST → GOOD: post-work commute, second wave of engagement

AVOID: Saturday/Sunday, Monday after 2 PM, Friday after 3 PM IST

INDIA-SPECIFIC INSIGHT:
- Indian executive recruiters heavily search LinkedIn for candidates with posts using keywords like "P&L", "cross-functional", "digital transformation", "0-to-1", "scale", "GTM"
- Commenting on posts by CHRO/CPO/CEO of Indian companies puts you directly in the view of their retained search partners
- Use Indian context (Zomato, Swiggy, Razorpay, Zepto, ONDC, UPI, Bharat Stack) where relevant to signal market depth
`.trim() : `
LINKEDIN GOLDEN HOURS (highest recruiter activity + algorithm boost):
- Tuesday–Thursday 8:00–10:00 AM local time → BEST for original posts
- Tuesday–Thursday 12:00–1:00 PM → GOOD for commenting
- Monday 7:30–9:00 AM → GOOD for motivational / goal-setting posts
- Friday 9:00–11:00 AM → GOOD for reflection / lessons-learned posts
- AVOID: weekends, Monday after noon, Friday after 2 PM
`.trim();

    const marketContext = isIndia ? `
MARKET CONTEXT — INDIA:
- Primary goal: Get noticed by Indian talent recruiters (HR/TA at companies like Razorpay, Meesho, PhonePe, BYJU's, Flipkart, Tata Digital, L&T, Mahindra, Infosys, HDFC, Axis) AND executive/retained search recruiters (headhunters looking for Director/VP/CXO profiles)
- Indian recruiters search for: leadership impact, scale (team size, revenue, user growth), transformation stories, industry-specific terms (Bharat, D2C, fintech, SaaS, deeptech)
- Executive recruiters want signals of: business acumen, stakeholder management, P&L ownership, cross-functional leadership
- Key hashtags that Indian recruiters follow: #ProductManagement #Leadership #IndianStartups #Fintech #DigitalIndia #CareerGrowth #Hiring
- Comment on posts by: Indian CPOs, CHROs, Founders, and LinkedIn Top Voices in India — this puts your name in front of their recruiter networks
`.trim() : '';

    const brew360Context = [
      '=========================================',
      '360 BREW ALGORITHM CONTENT DIET (MANDATORY):',
      'The LinkedIn 360 Brew algorithm rewards 3 specific content archetypes. You MUST include at least one of EACH:',
      '',
      `1. AUTHORITY BUILDER (format: carousel or listicle)`,
      `   - Deep expert-level educational post. Specific frameworks, data, or step-by-step breakdowns only a ${role} would know.`,
      `   - Algorithm classifies this as "expert knowledge" and distributes to non-followers.`,
      `   - Topic must directly leverage user skills: ${topics}`,
      `   - Set archetype field to: "AUTHORITY_BUILDER"`,
      '',
      `2. NETWORK ACTIVATOR (format: text)`,
      `   - Short, confident opinion post that respectfully challenges a mainstream belief in ${role} or ${topics}.`,
      `   - Must end with a debate-triggering question. 360 Brew rewards threaded comment conversations.`,
      `   - Set archetype field to: "NETWORK_ACTIVATOR"`,
      '',
      `3. EXPERIENCE SHARE (format: story)`,
      `   - Personal career anecdote that validates a professional principle. Must start with "I" or "When I".`,
      `   - Semantic analysis detects personal experience — highly shareable by peers and recruiters.`,
      `   - Set archetype field to: "EXPERIENCE_SHARE"`,
      '=========================================',
    ].join('\n').trim();

    const feedbackContext = feedback ? `
=========================================
USER FEEDBACK ON PREVIOUS PLAN:
The user reviewed the previous iteration of this strategy and gave the following feedback/instruction for revision:
"${feedback}"

CRITICAL INSTRUCTION: You MUST incorporate this feedback into the new plan. Adjust the themes, topics, angles, or engagement targets exactly as requested by the user, while still maintaining the JSON structure.
=========================================
`.trim() : '';

    const weeklyPrompt = `You are a LinkedIn growth strategist for the INDIAN job market, specialising in helping ${role} professionals maximise LinkedIn impressions so that both talent recruiters AND executive/retained search recruiters discover their profile organically.

USER PROFILE:
- Target Role: ${role}
- Location: ${location}
- Topics / Skills: ${topics}
- Market: ${isIndia ? 'India (IST timezone)' : location}

PRIMARY GOAL: Every post and comment in this plan must serve one purpose — to maximise LinkedIn impressions and put this user's profile in front of recruiters actively hiring for ${role} positions in India. Focus on impression-driving tactics, not vanity metrics.

${goldenHoursContext}

${marketContext}

${brew360Context}

${feedbackContext}

Respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "focusTopic": "the main narrative thread for this week — must be highly searchable by Indian recruiters",
  "goldenHoursInsight": "3 sentences personalised to this user's role and IST timezone — tell them exactly WHEN to post and WHY those windows maximise recruiter visibility in India",
  "recruiterStrategy": "3 sentences explaining HOW this week's plan will get both talent recruiters and executive headhunters to notice this profile — be specific about what actions trigger recruiter discovery on LinkedIn",
  "posts": [
    {
      "day": "Monday",
      "time": "08:00",
      "format": "text",
      "archetype": "AUTHORITY_BUILDER" | "NETWORK_ACTIVATOR" | "EXPERIENCE_SHARE",
      "topic": "specific post topic relevant to Indian market",
      "angle": "the hook or unique angle — must be compelling for Indian professional audience",
      "whyThisTime": "one sentence on why this IST slot maximises recruiter impressions"
    }
  ],
  "engagement": [
    {
      "day": "Tuesday",
      "time": "12:30",
      "targetRole": "specific type of Indian recruiter or leader to engage with (e.g. 'CHRO at Indian unicorn startups', 'VP Talent Acquisition at BFSI companies')",
      "goal": "specific comment approach that demonstrates expertise and signals candidacy to recruiters watching the thread"
    }
  ]
}

Rules:
- Include 3-4 posts and 2-3 engagement targets spread across Mon–Fri
- Post times MUST be from the Golden Hours above
- Days: Monday, Tuesday, Wednesday, Thursday, or Friday only
- Formats: text, listicle, story, carousel, poll
- Every topic must be searchable by Indian recruiters hiring for ${role}`;

    const monthlyPrompt = `You are a LinkedIn growth strategist for the INDIAN job market, building a 4-week plan for a ${role} professional to progressively build recruiter visibility.

USER PROFILE:
- Target Role: ${role}
- Location: ${location}
- Topics / Skills: ${topics}
- Market: ${isIndia ? 'India (IST timezone)' : location}

PRIMARY GOAL: Each week builds on the last to progressively increase LinkedIn impressions and signal to both talent recruiters AND executive/retained search recruiters in India that this person is an active, high-value candidate.

${goldenHoursContext}

${marketContext}

${brew360Context}

${feedbackContext}

Respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "overallTheme": "the 4-week narrative arc — how the user will build from unknown to in-demand candidate for Indian recruiters",
  "goldenHoursInsight": "3 sentences personalised to this user's role and IST timezone — the key posting windows that maximise recruiter discovery in India",
  "recruiterStrategy": "4 sentences on how 4 weeks of consistent posting will trigger both talent recruiters (searching keywords) and executive headhunters (who discover via network engagement) to proactively reach out",
  "weeks": [
    {
      "weekNumber": 1,
      "weekTheme": "e.g. Establish authority in X — relevant to Indian recruiters hiring for ${role}",
      "posts": [
        {
          "day": "Monday",
          "time": "08:00",
          "format": "text",
          "archetype": "AUTHORITY_BUILDER" | "NETWORK_ACTIVATOR" | "EXPERIENCE_SHARE",
          "topic": "specific topic searchable by Indian recruiters",
          "angle": "the hook — must resonate with Indian professional audience",
          "whyThisTime": "one sentence on why this IST slot maximises impressions"
        }
      ],
      "engagement": [
        {
          "day": "Tuesday",
          "time": "12:30",
          "targetRole": "specific Indian recruiter or leader type to engage",
          "goal": "how this comment signals expertise and recruiter-readiness"
        }
      ]
    }
  ]
}

Rules:
- 4 weeks total. Week 1: Establish → Week 2: Demonstrate expertise → Week 3: Show scale & leadership → Week 4: Signal availability & invite inbound
- Each week: 2-3 posts, 1-2 engagement targets
- Post times from the IST Golden Hours above
- Days: Monday–Friday only
- All topics must be searchable by Indian recruiters hiring for ${role}`;

    let text = '';
    try {
      const result = await generateText({
        model,
        prompt: isMonthly ? monthlyPrompt : weeklyPrompt,
      });
      text = result.text;
    } catch (primaryError: any) {
      console.warn('Primary model failed, attempting fallback...', primaryError.message);
      if (primaryError.message?.includes('high demand') || primaryError.message?.includes('429')) {
        // Fallback to a stable, high-capacity model
        const fallbackConfig = { ...modelConfig, modelId: 'gemini-2.0-flash' };
        const fallbackModel = resolveLanguageModel(fallbackConfig);
        const fallbackResult = await generateText({
          model: fallbackModel,
          prompt: isMonthly ? monthlyPrompt : weeklyPrompt,
        });
        text = fallbackResult.text;
      } else {
        throw primaryError;
      }
    }

    // Strip markdown fences and extract JSON
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Model did not return valid JSON. Raw: ' + cleaned.slice(0, 200));
    }
    const object = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));

    // Validate structure
    if (isMonthly) {
      if (!object.overallTheme || !Array.isArray(object.weeks)) {
        throw new Error('Invalid monthly strategy structure returned by model.');
      }
    } else {
      if (!object.focusTopic || !Array.isArray(object.posts) || !Array.isArray(object.engagement)) {
        throw new Error('Invalid weekly strategy structure returned by model.');
      }
    }

    // Save to database
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: 'User', email: 'user@example.com' }
    });

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    const plan = await prisma.weeklyPlan.create({
      data: {
        userId,
        weekStart,
        status: 'draft',
        planData: JSON.stringify({ ...object, mode, isIndia }),
      }
    });

    const postsToSave = isMonthly ? (object.weeks?.[0]?.posts || []) : (object.posts || []);
    await Promise.all(postsToSave.map((post: any) =>
      prisma.plannedItem.create({
        data: {
          planId: plan.id,
          day: post.day,
          time: post.time || '08:00',
          type: 'post',
          topic: post.topic,
          format: post.format
        }
      })
    ));

    return NextResponse.json({
      success: true,
      mode,
      plan: { ...plan, planData: JSON.stringify({ ...object, mode, isIndia }) },
      data: object
    });
  } catch (error: any) {
    console.error('Plan generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

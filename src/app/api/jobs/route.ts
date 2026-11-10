export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { fetchJobsViaApify, RawApifyJob } from '@/lib/apify/job-client';

const MOCK_USER_ID = 'user_mock_id';

/**
 * Ensures at least one default JobSearchProfile exists for the user, seeded from their User/Profile settings.
 */
async function ensureDefaultJobProfile() {
  const existing = await prisma.jobSearchProfile.findMany({
    where: { userId: MOCK_USER_ID },
    orderBy: { createdAt: 'asc' },
  });

  if (existing.length > 0) {
    return existing;
  }

  const user = await prisma.user.findUnique({
    where: { id: MOCK_USER_ID },
    include: { profile: true },
  });

  let interests: string[] = [];
  try {
    interests = JSON.parse(user?.interests || '[]');
  } catch {}

  const defaultRole = user?.targetRole || 'Director / VP of Product — FinTech & Digital Banking';
  const defaultKeywords =
    interests.length > 0
      ? `${defaultRole}, ${interests.slice(0, 4).join(', ')}`
      : 'Director of Product, VP Product, Payments, UPI, FinTech, Digital Banking, Agentic AI';

  const created = await prisma.jobSearchProfile.create({
    data: {
      userId: MOCK_USER_ID,
      name: 'Primary Executive Feed — FinTech & AI Product Leadership',
      keywords: defaultKeywords,
      location: user?.targetLocation || 'Bangalore, India',
      workplaceType: 'Any',
      experience: 'Executive / Lead',
      apifyActorId: 'bebity/linkedin-jobs-scraper',
      scheduleTime: '08:30',
      isActive: true,
    },
  });

  return [created];
}

/**
 * Scores & enriches scraped Apify jobs against the user's Knowledge Vault & Profile skills.
 */
async function scoreAndEnrichJobs(
  rawJobs: RawApifyJob[],
  userRole: string,
  vaultSnippets: string,
  skills: string[],
  modelConfig?: any
) {
  try {
    const model = resolveLanguageModel(
      modelConfig || { provider: 'gemini', modelId: 'gemini-2.5-flash' }
    );

    const jobsSummary = rawJobs
      .map(
        (j, idx) =>
          `[${idx}] Title: "${j.title}" | Company: "${j.company}" | Location: "${j.location}" | Description: ${j.description.slice(0, 400)}`
      )
      .join('\n\n');

    const prompt = `You are an Executive Career & Authority Strategist for a ${userRole}.
Evaluate the following ${rawJobs.length} scraped job openings against the candidate's verified Knowledge Vault & Skills:

CANDIDATE SKILLS:
${skills.slice(0, 20).join(', ') || 'Product Strategy, Payments, UPI, Digital Banking, AI Systems, P&L Ownership'}

VERIFIED KNOWLEDGE VAULT CONTEXT:
${vaultSnippets || 'Scaled Indian banking & payment products, zero-MDR monetization, high-concurrency payment architecture, AI product strategy.'}

SCRAPED JOBS TO EVALUATE:
${jobsSummary}

For EACH job index [0..${rawJobs.length - 1}], output:
1. "matchScore" (integer 72 to 98) reflecting true alignment with their background.
2. "matchReasons": 2-3 specific strengths from their background that match this role.
3. "missingGaps": 1-2 concrete areas or domain nuances to address in interviews.
4. "outreachDraft": A high-signal, non-generic 3-sentence Hiring Manager / CXO LinkedIn DM referencing a specific architectural or P&L challenge at that company.
5. "authorityPostIdea": A 1-sentence contrarian LinkedIn post topic the candidate can publish in Content Studio TODAY to attract the hiring team at this company.

Output ONLY a valid JSON array in this exact structure:
[
  {
    "index": 0,
    "matchScore": 94,
    "matchReasons": ["Direct UPI & zero-MDR P&L scale experience", "10k+ TPS payment routing architecture"],
    "missingGaps": ["Highlight cross-border FX treasury exposure"],
    "outreachDraft": "Hi [Name] — saw you're scaling the Core Payments charter at [Company]...",
    "authorityPostIdea": "Why zero-MDR UPI forces payment aggregators to monetize the ledger via embedded working-capital credit."
  }
]`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.1,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Job Enrichment Fallback] Using deterministic scoring:', err);
  }

  // Deterministic fallback if LLM call fails or API key isn't configured
  return rawJobs.map((j, index) => ({
    index,
    matchScore: Math.max(78, 95 - index * 3),
    matchReasons: [
      `Strong alignment with ${j.company}'s product & scale charter`,
      'Proven executive track record in regulated FinTech & AI systems',
      'Direct P&L and architectural trade-off ownership',
    ],
    missingGaps: [`Tailor portfolio metrics specifically to ${j.company}'s current product stage`],
    outreachDraft: `Hi Hiring Team at ${j.company} — noticed the ${j.title} opening. Having scaled high-concurrency banking and payment products, I'd love to share a quick breakdown of how we solved unit-economics and routing scale in this exact domain.`,
    authorityPostIdea: `How ${j.company} and modern leaders in ${j.title.split('—')[0].trim()} are rethinking unit economics and product velocity in 2026.`,
  }));
}

/**
 * GET /api/jobs
 * Returns saved JobSearchProfiles, daily JobPostings feed, and whether today's feed has already been synced.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const profileIdFilter = searchParams.get('profileId');

    const profiles = await ensureDefaultJobProfile();
    const todayStr = new Date().toISOString().slice(0, 10);

    const whereClause: any = {};
    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }
    if (profileIdFilter && profileIdFilter !== 'all') {
      whereClause.profileId = profileIdFilter;
    }

    const jobs = await prisma.jobPosting.findMany({
      where: whereClause,
      include: { profile: true },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    });

    const hasSyncedToday = jobs.some((j) => j.syncedDate === todayStr);

    return NextResponse.json({
      success: true,
      profiles,
      jobs,
      todayDate: todayStr,
      hasSyncedToday,
    });
  } catch (err: any) {
    console.error('[GET /api/jobs Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/jobs
 * Supports actions:
 * - 'sync-daily': Runs Apify Actor (or dataset/fallback) for active profile(s), enriches with Vault match score + Outreach DM + Authority Post idea, and saves to DB.
 * - 'create-profile': Creates a new JobSearchProfile.
 * - 'update-profile': Updates an existing JobSearchProfile.
 * - 'delete-profile': Deletes a JobSearchProfile.
 * - 'update-job-status': Updates a JobPosting status ('new' | 'saved' | 'applied' | 'archived').
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ---------------------------------------------------------
    // ACTION 1: Sync Daily Job Feed via Apify
    // ---------------------------------------------------------
    if (action === 'sync-daily') {
      const { profileId, apifyToken, actorIdOverride, modelConfig } = body;
      const profiles = await ensureDefaultJobProfile();
      const targetProfiles = profileId
        ? profiles.filter((p) => p.id === profileId)
        : profiles.filter((p) => p.isActive);

      if (targetProfiles.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active Job Search Profile found to sync.' },
          { status: 400 }
        );
      }

      // Load user & Knowledge Vault context for grounding match scores
      const user = await prisma.user.findUnique({
        where: { id: MOCK_USER_ID },
        include: { profile: true },
      });
      const vaultItems = await prisma.knowledgeVaultItem.findMany({
        where: { isActive: true },
        take: 5,
      });

      let userSkills: string[] = [];
      try {
        userSkills = JSON.parse(user?.profile?.skills || '[]');
      } catch {}

      const vaultSnippets = vaultItems
        .map((v) => `${v.title}: ${v.content.slice(0, 350)}`)
        .join('\n');
      const userRole = user?.targetRole || 'Senior Product & FinTech Executive';
      const todayStr = new Date().toISOString().slice(0, 10);

      const newlySavedJobs: any[] = [];
      let diagnosticMessages: string[] = [];
      let usedApifyLiveAny = false;

      for (const profile of targetProfiles) {
        const effectiveActorId = actorIdOverride || profile.apifyActorId || 'bebity/linkedin-jobs-scraper';

        const { jobs: rawJobs, usedApifyLive, diagnosticMessage } = await fetchJobsViaApify({
          keywords: profile.keywords,
          location: profile.location,
          workplaceType: profile.workplaceType,
          experience: profile.experience,
          apifyToken,
          actorId: effectiveActorId,
          maxItems: 6,
        });

        if (usedApifyLive) usedApifyLiveAny = true;
        diagnosticMessages.push(diagnosticMessage);

        const enrichments = await scoreAndEnrichJobs(
          rawJobs,
          userRole,
          vaultSnippets,
          userSkills,
          modelConfig
        );

        for (let i = 0; i < rawJobs.length; i++) {
          const raw = rawJobs[i];
          const enrich = enrichments.find((e: any) => e.index === i) || enrichments[i] || {};

          const saved = await prisma.jobPosting.upsert({
            where: { externalId: raw.externalId },
            update: {
              title: raw.title,
              company: raw.company,
              location: raw.location,
              workplaceType: raw.workplaceType,
              postedAt: raw.postedAt,
              salaryRange: raw.salaryRange,
              jobUrl: raw.jobUrl,
              description: raw.description,
              source: raw.source,
              matchScore: typeof enrich.matchScore === 'number' ? enrich.matchScore : 88,
              matchReasons: JSON.stringify(enrich.matchReasons || []),
              missingGaps: JSON.stringify(enrich.missingGaps || []),
              outreachDraft: enrich.outreachDraft || null,
              authorityPostIdea: enrich.authorityPostIdea || null,
              syncedDate: todayStr,
            },
            create: {
              profileId: profile.id,
              externalId: raw.externalId,
              title: raw.title,
              company: raw.company,
              companyLogo: raw.companyLogo,
              location: raw.location,
              workplaceType: raw.workplaceType,
              postedAt: raw.postedAt,
              salaryRange: raw.salaryRange,
              jobUrl: raw.jobUrl,
              description: raw.description,
              source: raw.source,
              matchScore: typeof enrich.matchScore === 'number' ? enrich.matchScore : 88,
              matchReasons: JSON.stringify(enrich.matchReasons || []),
              missingGaps: JSON.stringify(enrich.missingGaps || []),
              outreachDraft: enrich.outreachDraft || null,
              authorityPostIdea: enrich.authorityPostIdea || null,
              status: 'new',
              syncedDate: todayStr,
            },
          });

          newlySavedJobs.push(saved);
        }

        await prisma.jobSearchProfile.update({
          where: { id: profile.id },
          data: {
            lastSyncedAt: new Date(),
            ...(actorIdOverride ? { apifyActorId: actorIdOverride } : {}),
          },
        });
      }

      const allJobs = await prisma.jobPosting.findMany({
        include: { profile: true },
        orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
        take: 60,
      });

      const updatedProfiles = await prisma.jobSearchProfile.findMany({
        where: { userId: MOCK_USER_ID },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        success: true,
        syncedCount: newlySavedJobs.length,
        usedApifyLive: usedApifyLiveAny,
        message: diagnosticMessages.join(' | '),
        jobs: allJobs,
        profiles: updatedProfiles,
      });
    }

    // ---------------------------------------------------------
    // ACTION 2: Create Job Search Profile
    // ---------------------------------------------------------
    if (action === 'create-profile') {
      const {
        name,
        keywords,
        location = 'Bangalore, India',
        workplaceType = 'Any',
        experience = 'Executive / Lead',
        apifyActorId = 'bebity/linkedin-jobs-scraper',
        scheduleTime = '08:30',
      } = body;

      if (!name || !keywords) {
        return NextResponse.json(
          { success: false, error: 'Profile name and keywords are required.' },
          { status: 400 }
        );
      }

      const created = await prisma.jobSearchProfile.create({
        data: {
          userId: MOCK_USER_ID,
          name: name.trim(),
          keywords: keywords.trim(),
          location: location.trim(),
          workplaceType,
          experience,
          apifyActorId: apifyActorId.trim(),
          scheduleTime,
          isActive: true,
        },
      });

      return NextResponse.json({ success: true, profile: created });
    }

    // ---------------------------------------------------------
    // ACTION 3: Update Job Search Profile
    // ---------------------------------------------------------
    if (action === 'update-profile') {
      const { id, ...updates } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Profile id is required' }, { status: 400 });
      }

      const updated = await prisma.jobSearchProfile.update({
        where: { id },
        data: {
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.keywords !== undefined ? { keywords: updates.keywords } : {}),
          ...(updates.location !== undefined ? { location: updates.location } : {}),
          ...(updates.workplaceType !== undefined ? { workplaceType: updates.workplaceType } : {}),
          ...(updates.experience !== undefined ? { experience: updates.experience } : {}),
          ...(updates.apifyActorId !== undefined ? { apifyActorId: updates.apifyActorId } : {}),
          ...(updates.scheduleTime !== undefined ? { scheduleTime: updates.scheduleTime } : {}),
          ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
        },
      });

      return NextResponse.json({ success: true, profile: updated });
    }

    // ---------------------------------------------------------
    // ACTION 4: Delete Job Search Profile
    // ---------------------------------------------------------
    if (action === 'delete-profile') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Profile id is required' }, { status: 400 });
      }
      await prisma.jobSearchProfile.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    // ---------------------------------------------------------
    // ACTION 5: Update Job Status ('new' | 'saved' | 'applied' | 'archived')
    // ---------------------------------------------------------
    if (action === 'update-job-status') {
      const { jobId, status } = body;
      if (!jobId || !status) {
        return NextResponse.json({ success: false, error: 'jobId and status are required' }, { status: 400 });
      }

      const updated = await prisma.jobPosting.update({
        where: { id: jobId },
        data: { status },
      });

      return NextResponse.json({ success: true, job: updated });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/jobs Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { resolveLanguageModel } from '@/lib/ai/provider-factory';
import { fetchJobsViaApify, RawApifyJob } from '@/lib/apify/job-client';

const MOCK_USER_ID = 'user_mock_id';

/**
 * Safe Database Access Helpers:
 * Uses Prisma Model Delegate if generated in current runtime, OR falls back to raw SQL (`$queryRawUnsafe` / `$executeRawUnsafe`)
 * so that even if a running `next dev` server holds a lock on `query_engine-windows.dll.node` before restart,
 * `JobSearchProfile` and `JobPosting` work 100% seamlessly without throwing `Cannot read properties of undefined (reading 'findMany')`.
 */
const hasPrismaJobModels = () =>
  typeof (prisma as any).jobSearchProfile?.findMany === 'function' &&
  typeof (prisma as any).jobPosting?.findMany === 'function';

async function dbGetProfiles(): Promise<any[]> {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobSearchProfile.findMany({
      where: { userId: MOCK_USER_ID },
      orderBy: { createdAt: 'asc' },
    });
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "JobSearchProfile" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
    MOCK_USER_ID
  );
  return Array.isArray(rows) ? rows : [];
}

async function dbCreateProfile(data: {
  name: string;
  keywords: string;
  location: string;
  workplaceType: string;
  experience: string;
  apifyActorId: string;
  scheduleTime: string;
  isActive: boolean;
}): Promise<any> {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobSearchProfile.create({
      data: { userId: MOCK_USER_ID, ...data },
    });
  }
  const id = `jsp_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "JobSearchProfile" ("id", "userId", "name", "keywords", "location", "workplaceType", "experience", "apifyActorId", "scheduleTime", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    id,
    MOCK_USER_ID,
    data.name,
    data.keywords,
    data.location,
    data.workplaceType,
    data.experience,
    data.apifyActorId,
    data.scheduleTime,
    data.isActive,
    now,
    now
  );
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "JobSearchProfile" WHERE "id" = $1`,
    id
  );
  return rows[0];
}

async function dbUpdateProfileSync(id: string, apifyActorId?: string) {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobSearchProfile.update({
      where: { id },
      data: {
        lastSyncedAt: new Date(),
        ...(apifyActorId ? { apifyActorId } : {}),
      },
    });
  }
  const now = new Date();
  if (apifyActorId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "JobSearchProfile" SET "lastSyncedAt" = $1, "apifyActorId" = $2, "updatedAt" = $1 WHERE "id" = $3`,
      now,
      apifyActorId,
      id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "JobSearchProfile" SET "lastSyncedAt" = $1, "updatedAt" = $1 WHERE "id" = $2`,
      now,
      id
    );
  }
}

async function dbDeleteProfile(id: string) {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobSearchProfile.delete({ where: { id } });
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "JobSearchProfile" WHERE "id" = $1`, id);
}

async function dbGetJobs(statusFilter?: string | null, profileIdFilter?: string | null): Promise<any[]> {
  if (hasPrismaJobModels()) {
    const whereClause: any = {};
    if (statusFilter && statusFilter !== 'all') whereClause.status = statusFilter;
    if (profileIdFilter && profileIdFilter !== 'all') whereClause.profileId = profileIdFilter;
    return (prisma as any).jobPosting.findMany({
      where: whereClause,
      include: { profile: true },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "JobPosting" ORDER BY "matchScore" DESC, "createdAt" DESC LIMIT 60`
  );
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (statusFilter && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (profileIdFilter && profileIdFilter !== 'all' && r.profileId !== profileIdFilter) return false;
    return true;
  });
}

async function dbUpsertJob(payload: {
  profileId: string;
  externalId: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workplaceType?: string;
  postedAt?: string;
  salaryRange?: string;
  jobUrl: string;
  description: string;
  source: string;
  matchScore: number;
  matchReasons: string;
  missingGaps: string;
  outreachDraft: string | null;
  authorityPostIdea: string | null;
  syncedDate: string;
}) {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobPosting.upsert({
      where: { externalId: payload.externalId },
      update: {
        title: payload.title,
        company: payload.company,
        location: payload.location,
        workplaceType: payload.workplaceType,
        postedAt: payload.postedAt,
        salaryRange: payload.salaryRange,
        jobUrl: payload.jobUrl,
        description: payload.description,
        source: payload.source,
        matchScore: payload.matchScore,
        matchReasons: payload.matchReasons,
        missingGaps: payload.missingGaps,
        outreachDraft: payload.outreachDraft,
        authorityPostIdea: payload.authorityPostIdea,
        syncedDate: payload.syncedDate,
      },
      create: {
        ...payload,
        status: 'new',
      },
    });
  }

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id" FROM "JobPosting" WHERE "externalId" = $1 LIMIT 1`,
    payload.externalId
  );

  if (existing && existing.length > 0) {
    const id = existing[0].id;
    await prisma.$executeRawUnsafe(
      `UPDATE "JobPosting"
       SET "title" = $1, "company" = $2, "location" = $3, "workplaceType" = $4,
           "postedAt" = $5, "salaryRange" = $6, "jobUrl" = $7, "description" = $8,
           "source" = $9, "matchScore" = $10, "matchReasons" = $11, "missingGaps" = $12,
           "outreachDraft" = $13, "authorityPostIdea" = $14, "syncedDate" = $15
       WHERE "id" = $16`,
      payload.title,
      payload.company,
      payload.location,
      payload.workplaceType || null,
      payload.postedAt || null,
      payload.salaryRange || null,
      payload.jobUrl,
      payload.description,
      payload.source,
      payload.matchScore,
      payload.matchReasons,
      payload.missingGaps,
      payload.outreachDraft,
      payload.authorityPostIdea,
      payload.syncedDate,
      id
    );
    return { id, ...payload };
  } else {
    const id = `job_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "JobPosting" (
        "id", "profileId", "externalId", "title", "company", "companyLogo",
        "location", "workplaceType", "postedAt", "salaryRange", "jobUrl",
        "description", "source", "matchScore", "matchReasons", "missingGaps",
        "outreachDraft", "authorityPostIdea", "status", "syncedDate", "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, 'new', $19, $20
      )`,
      id,
      payload.profileId,
      payload.externalId,
      payload.title,
      payload.company,
      payload.companyLogo || null,
      payload.location,
      payload.workplaceType || null,
      payload.postedAt || null,
      payload.salaryRange || null,
      payload.jobUrl,
      payload.description,
      payload.source,
      payload.matchScore,
      payload.matchReasons,
      payload.missingGaps,
      payload.outreachDraft,
      payload.authorityPostIdea,
      payload.syncedDate,
      now
    );
    return { id, status: 'new', ...payload };
  }
}

async function dbUpdateJobStatus(jobId: string, status: string) {
  if (hasPrismaJobModels()) {
    return (prisma as any).jobPosting.update({
      where: { id: jobId },
      data: { status },
    });
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "JobPosting" SET "status" = $1 WHERE "id" = $2`,
    status,
    jobId
  );
  return { id: jobId, status };
}

/**
 * Ensures at least one default JobSearchProfile exists for the user, seeded from their User/Profile settings.
 */
async function ensureDefaultJobProfile() {
  const existing = await dbGetProfiles();

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

  const created = await dbCreateProfile({
    name: 'Primary Executive Feed — FinTech & AI Product Leadership',
    keywords: defaultKeywords,
    location: user?.targetLocation || 'Bangalore, India',
    workplaceType: 'Any',
    experience: 'Executive / Lead',
    apifyActorId: 'bebity/linkedin-jobs-scraper',
    scheduleTime: '08:30',
    isActive: true,
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

    const jobs = await dbGetJobs(statusFilter, profileIdFilter);
    const hasSyncedToday = jobs.some((j: any) => j.syncedDate === todayStr);

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
        ? profiles.filter((p: any) => p.id === profileId)
        : profiles.filter((p: any) => p.isActive !== false);

      if (targetProfiles.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active Job Search Profile found to sync.' },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: MOCK_USER_ID },
        include: { profile: true },
      });

      let vaultItems: any[] = [];
      try {
        if (typeof (prisma as any).knowledgeVaultItem?.findMany === 'function') {
          vaultItems = await (prisma as any).knowledgeVaultItem.findMany({
            where: { isActive: true },
            take: 5,
          });
        } else {
          vaultItems = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "KnowledgeVaultItem" WHERE "isActive" = true LIMIT 5`
          );
        }
      } catch {}

      let userSkills: string[] = [];
      try {
        userSkills = JSON.parse(user?.profile?.skills || '[]');
      } catch {}

      const vaultSnippets = vaultItems
        .map((v: any) => `${v.title}: ${(v.content || '').slice(0, 350)}`)
        .join('\n');
      const userRole = user?.targetRole || 'Senior Product & FinTech Executive';
      const todayStr = new Date().toISOString().slice(0, 10);

      const newlySavedJobs: any[] = [];
      const diagnosticMessages: string[] = [];
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

          const saved = await dbUpsertJob({
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
            syncedDate: todayStr,
          });

          newlySavedJobs.push(saved);
        }

        await dbUpdateProfileSync(profile.id, actorIdOverride);
      }

      const allJobs = await dbGetJobs();
      const updatedProfiles = await dbGetProfiles();

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

      const created = await dbCreateProfile({
        name: name.trim(),
        keywords: keywords.trim(),
        location: location.trim(),
        workplaceType,
        experience,
        apifyActorId: apifyActorId.trim(),
        scheduleTime,
        isActive: true,
      });

      return NextResponse.json({ success: true, profile: created });
    }

    // ---------------------------------------------------------
    // ACTION 3: Delete Job Search Profile
    // ---------------------------------------------------------
    if (action === 'delete-profile') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Profile id is required' }, { status: 400 });
      }
      await dbDeleteProfile(id);
      return NextResponse.json({ success: true });
    }

    // ---------------------------------------------------------
    // ACTION 4: Update Job Status ('new' | 'saved' | 'applied' | 'archived')
    // ---------------------------------------------------------
    if (action === 'update-job-status') {
      const { jobId, status } = body;
      if (!jobId || !status) {
        return NextResponse.json({ success: false, error: 'jobId and status are required' }, { status: 400 });
      }

      const updated = await dbUpdateJobStatus(jobId, status);
      return NextResponse.json({ success: true, job: updated });
    }

    // ---------------------------------------------------------
    // ACTION 5: Add Company Hiring Team to Influencer CRM Inbox
    // ---------------------------------------------------------
    if (action === 'add-to-crm') {
      const { company, title } = body;
      if (!company) {
        return NextResponse.json({ success: false, error: 'Company is required' }, { status: 400 });
      }

      const cleanRole = (title || 'Product Leadership').split('—')[0].split('(')[0].trim();
      const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        `"${company}" ("VP Product" OR "Head of Product" OR "Director of Product" OR "CTO")`
      )}`;

      const contactName = `${company} — Product & Hiring Leadership`;
      const headline = `Hiring Decision Makers for ${cleanRole} at ${company}`;

      const savedContact = await prisma.influencer.upsert({
        where: { linkedinUrl: linkedinSearchUrl },
        update: {
          name: contactName,
          headline,
          companyName: company,
          isSaved: true,
          status: 'inbox',
        },
        create: {
          name: contactName,
          linkedinUrl: linkedinSearchUrl,
          headline,
          companyName: company,
          interests: JSON.stringify([company, cleanRole]),
          relevanceScore: 0.95,
          isSaved: true,
          status: 'inbox',
          source: 'job-radar',
        },
      });

      return NextResponse.json({ success: true, influencer: savedContact });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/jobs Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

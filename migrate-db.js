const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');

const sqlite = new Database('prisma/dev.db', { readonly: true });
const prisma = new PrismaClient();

function toDate(val) {
  if (!val) return null;
  return new Date(val);
}

function toBool(val) {
  return val === 1 || val === 'true' || val === true;
}

async function main() {
  console.log('Starting Migration from SQLite to Supabase Postgres...');

  // 1. Users
  console.log('--- Migrating Users ---');
  const users = sqlite.prepare('SELECT * FROM User').all();
  for (const row of users) {
    try {
      await prisma.user.upsert({
        where: { id: row.id },
        update: {},
        create: {
          id: row.id,
          name: row.name,
          email: row.email,
          linkedinUrl: row.linkedinUrl,
          interests: row.interests,
          targetRole: row.targetRole,
          targetLocation: row.targetLocation,
          llmProvider: row.llmProvider,
          llmModel: row.llmModel,
          createdAt: toDate(row.createdAt),
          updatedAt: toDate(row.updatedAt),
        }
      });
      console.log(`Migrated user: ${row.name}`);
    } catch (e) { console.log(`Skipped user: ${row.name}`); }
  }

  // 2. TrackedTargets
  console.log('--- Migrating Tracked Targets ---');
  const targets = sqlite.prepare('SELECT * FROM TrackedTarget').all();
  for (const row of targets) {
    try {
      await prisma.trackedTarget.upsert({
        where: { url: row.url },
        update: {},
        create: {
          id: row.id,
          type: row.type,
          name: row.name,
          url: row.url,
          niche: row.niche,
          avatarUrl: row.avatarUrl,
          isActive: toBool(row.isActive),
          lastScanned: toDate(row.lastScanned),
          createdAt: toDate(row.createdAt),
        }
      });
      console.log(`Migrated target: ${row.name}`);
    } catch (e) { console.log(`Skipped target: ${row.name}`, e.message); }
  }

  // 3. Influencers
  console.log('--- Migrating Influencers ---');
  const influencers = sqlite.prepare('SELECT * FROM Influencer').all();
  for (const row of influencers) {
    try {
      await prisma.influencer.upsert({
        where: { linkedinUrl: row.linkedinUrl },
        update: {},
        create: {
          id: row.id,
          name: row.name,
          linkedinUrl: row.linkedinUrl,
          headline: row.headline,
          followerCount: row.followerCount,
          interests: row.interests,
          relevanceScore: row.relevanceScore,
          lastScanned: toDate(row.lastScanned),
          isSaved: toBool(row.isSaved),
          createdAt: toDate(row.createdAt),
          companyName: row.companyName,
          status: row.status || 'inbox',
          lastEngagedAt: toDate(row.lastEngagedAt),
        }
      });
      console.log(`Migrated influencer: ${row.name}`);
    } catch (e) { console.log(`Skipped influencer: ${row.name}`); }
  }

  console.log('Done migrating data!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

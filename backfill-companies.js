const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function extractCompany(headline) {
  if (!headline) return '';
  // Try " at " separator (most common)
  const atMatch = headline.match(/\bat\s+([^|,]+)/i);
  if (atMatch) return atMatch[1].trim();
  // Try comma separator "Role, Company"
  const parts = headline.split(',');
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim();
    if (last && last !== headline.trim()) return last;
  }
  return '';
}

async function main() {
  const influencers = await p.influencer.findMany({
    where: { OR: [{ companyName: null }, { companyName: '' }] },
    select: { id: true, name: true, headline: true, companyName: true }
  });

  console.log(`Found ${influencers.length} influencers missing company name`);

  let updated = 0;
  for (const inf of influencers) {
    const company = extractCompany(inf.headline);
    if (company) {
      await p.influencer.update({
        where: { id: inf.id },
        data: { companyName: company }
      });
      console.log(`✓ ${inf.name} → ${company}`);
      updated++;
    }
  }

  console.log(`\nBackfilled ${updated} influencers`);
}

main().finally(() => p.$disconnect());

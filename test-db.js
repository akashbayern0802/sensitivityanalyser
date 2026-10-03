const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check if isSaved column exists by reading all influencers
  const all = await p.influencer.findMany({ take: 3 });
  console.log('DB influencers:', JSON.stringify(all, null, 2));
  
  if (all.length > 0) {
    // Try to update isSaved
    const updated = await p.influencer.update({ where: { id: all[0].id }, data: { isSaved: true } });
    console.log('Update worked:', updated.isSaved);
  }
}

main().catch(e => console.error('ERROR:', e.message)).finally(() => p.$disconnect());

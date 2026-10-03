const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find any influencer
  const inf = await p.influencer.findFirst();
  if (!inf) { console.log('No influencers in DB'); return; }
  
  console.log('Found influencer:', inf.id, inf.name, 'isSaved:', inf.isSaved);
  
  // Try to save it
  const updated = await p.influencer.update({
    where: { id: inf.id },
    data: { isSaved: true }
  });
  console.log('After update - isSaved:', updated.isSaved);
  
  // Check it persisted
  const refetch = await p.influencer.findUnique({ where: { id: inf.id } });
  console.log('After refetch - isSaved:', refetch?.isSaved);
  
  // Now check saved list
  const savedList = await p.influencer.findMany({ where: { isSaved: true } });
  console.log('Total saved influencers in DB:', savedList.length);
  savedList.forEach(s => console.log(' -', s.name));
}

main().catch(e => console.error('ERROR:', e.message)).finally(() => p.$disconnect());

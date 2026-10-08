const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const recentEvents = await prisma.radarEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { target: true }
  });
  console.log("--- RECENT RADAR EVENTS ---");
  for (const e of recentEvents) {
    console.log([ + e.createdAt.toISOString() + ]  + e.target.name + :  + e.title);
  }
  const recentAutoInfluencers = await prisma.influencer.findMany({
    where: { source: 'auto' },
    orderBy: { createdAt: 'desc' }
  });
  console.log("\n--- AUTO-DISCOVERED INFLUENCERS ---");
  console.log(Count:  + recentAutoInfluencers.length);
  for (const i of recentAutoInfluencers) {
    console.log(-  + i.name +  ( + i.companyName + ));
  }
}
check().catch(console.error).finally(() => prisma.());
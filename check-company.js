const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const influencers = await p.influencer.findMany({
    select: { name: true, companyName: true, headline: true, isSaved: true }
  });
  console.log(JSON.stringify(influencers, null, 2));
}

main().finally(() => p.$disconnect());

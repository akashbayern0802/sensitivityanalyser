
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const companies = await prisma.influencer.findMany({
    where: { isSaved: true, companyName: { not: null } },
    select: { companyName: true }
  });
  console.log('Tracked companies:', [...new Set(companies.map(c => c.companyName))]);
}
run();


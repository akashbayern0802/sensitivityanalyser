
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const events = await prisma.radarEvent.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
  for (const e of events) console.log(e.title, '\n  Summary:', e.summary);
}
check();


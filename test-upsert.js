const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const record = await prisma.influencer.upsert({
      where: { linkedinUrl: 'https://linkedin.com/in/test1234' },
      update: { headline: 'Test', relevanceScore: 0.9, companyName: 'Test Inc' },
      create: {
        name: 'Test Name',
        linkedinUrl: 'https://linkedin.com/in/test1234',
        headline: 'Test',
        companyName: 'Test Inc',
        interests: JSON.stringify(['AI']),
        relevanceScore: 0.9,
      },
    });
    console.log('Success!', record);
  } catch (e) {
    console.error('FAIL:', e.message);
  }
}
test();

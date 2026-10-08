
const fs = require('fs');
const files = [
  'src/app/api/alerts/route.ts',
  'src/app/api/analytics/route.ts',
  'src/app/api/influencers/saved/route.ts',
  'src/app/api/profile/route.ts',
  'src/app/api/radar/company-news/route.ts',
  'src/app/api/radar/scan/route.ts',
  'src/app/api/radar/targets/route.ts',
  'src/app/api/strategy/route.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('force-dynamic')) {
    content = 'export const dynamic = \'force-dynamic\';\n' + content;
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}


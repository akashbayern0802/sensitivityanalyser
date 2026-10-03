const p = require('./node_modules/@prisma/client');
const db = new p.PrismaClient();
db.user.findUnique({ where: { id: 'user_mock_id' } }).then(function(u) {
  console.log(JSON.stringify(u, null, 2));
  return db.$disconnect();
}).catch(function(e) {
  console.error(e.message);
  db.$disconnect();
});

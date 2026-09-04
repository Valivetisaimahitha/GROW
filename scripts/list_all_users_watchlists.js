const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany();
  console.log('ALL_USERS_COUNT:', users.length);
  console.log('ALL_USERS:', JSON.stringify(users, null, 2));

  const watchlists = await prisma.watchlist.findMany({
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
  console.log('ALL_WATCHLISTS_COUNT:', watchlists.length);
  console.log('ALL_WATCHLISTS:', JSON.stringify(watchlists, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

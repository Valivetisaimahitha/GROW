const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    where: { id: 'demo_user_default' },
  });

  if (!user) {
    console.log('NO DEMO USER FOUND');
    return;
  }

  const watchlists = await prisma.watchlist.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { items: true },
      },
    },
  });

  console.log('DEMO_USER_ID:', user.id);
  console.log('DEMO_WATCHLISTS_COUNT:', watchlists.length);
  console.log('DEMO_WATCHLISTS:', JSON.stringify(watchlists, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

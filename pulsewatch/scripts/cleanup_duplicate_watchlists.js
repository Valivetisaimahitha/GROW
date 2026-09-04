const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  console.log('Cleaning up duplicate watchlists in dev database...');

  const users = await prisma.user.findMany({
    include: {
      watchlists: {
        include: {
          items: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  for (const user of users) {
    if (user.watchlists.length <= 1) continue;

    // Group watchlists by name
    const groupedByName = new Map();
    for (const wl of user.watchlists) {
      if (!groupedByName.has(wl.name)) {
        groupedByName.set(wl.name, []);
      }
      groupedByName.get(wl.name).push(wl);
    }

    for (const [name, watchlists] of groupedByName.entries()) {
      if (watchlists.length > 1) {
        // Keep the canonical one: prefer id === 'default_watchlist_id' or isDefault, or oldest
        let canonical = watchlists.find(w => w.id === 'default_watchlist_id');
        if (!canonical) {
          canonical = watchlists.find(w => w.isDefault);
        }
        if (!canonical) {
          canonical = watchlists[0];
        }

        const duplicates = watchlists.filter(w => w.id !== canonical.id);

        console.log(`User ${user.id} has ${watchlists.length} watchlists named "${name}". Preserving canonical: ${canonical.id}`);

        for (const dup of duplicates) {
          // Merge any items from duplicate into canonical if missing
          for (const item of dup.items) {
            const existing = canonical.items.find(i => i.symbol === item.symbol);
            if (!existing) {
              await prisma.watchlistItem.create({
                data: {
                  watchlistId: canonical.id,
                  symbol: item.symbol,
                  displayName: item.displayName,
                  sortOrder: item.sortOrder,
                },
              });
              console.log(`  Merged symbol ${item.symbol} into canonical ${canonical.id}`);
            }
          }

          // Delete duplicate watchlist (cascade deletes items)
          await prisma.watchlist.delete({
            where: { id: dup.id },
          });
          console.log(`  Deleted duplicate watchlist ${dup.id}`);
        }
      }
    }
  }

  console.log('Cleanup finished!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ObservationManager } from '../lib/domain/observationManager';
import { DemoProvider } from '../lib/domain/marketDataProvider';

describe('Watchlist Idempotency & Edge Cases Tests', () => {
  const prisma = new PrismaClient();
  const testUserId = 'test_user_watchlist_concurrency';

  beforeEach(async () => {
    await prisma.watchlistItem.deleteMany({ where: { watchlist: { userId: testUserId } } });
    await prisma.watchlist.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await prisma.user.create({
      data: { id: testUserId, name: 'Concurrency User', email: 'concurrency@pulsewatch.local' },
    });
  });

  it('1. Rapid parallel processUserDashboard calls for fresh user only create ONE default watchlist', async () => {
    const provider = new DemoProvider('NORMAL_NOISE');
    const obsManager = new ObservationManager(prisma, provider);

    // Trigger 5 parallel dashboard loads for a new user
    await Promise.all([
      obsManager.processUserDashboard(testUserId),
      obsManager.processUserDashboard(testUserId),
      obsManager.processUserDashboard(testUserId),
      obsManager.processUserDashboard(testUserId),
      obsManager.processUserDashboard(testUserId),
    ]);

    const watchlists = await prisma.watchlist.findMany({
      where: { userId: testUserId },
    });

    expect(watchlists.length).toBe(1);
    expect(watchlists[0].name).toBe('My Watchlist');
    expect(watchlists[0].isDefault).toBe(true);
  });

  it('2. Creating duplicate watchlist name via Prisma unique constraint throws error', async () => {
    await prisma.watchlist.create({
      data: { userId: testUserId, name: 'Tech Stocks', isDefault: false },
    });

    await expect(
      prisma.watchlist.create({
        data: { userId: testUserId, name: 'Tech Stocks', isDefault: false },
      })
    ).rejects.toThrow();
  });
});

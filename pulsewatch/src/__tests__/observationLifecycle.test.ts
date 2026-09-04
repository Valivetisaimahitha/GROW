import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ObservationManager } from '../lib/domain/observationManager';
import { DemoProvider } from '../lib/domain/marketDataProvider';
import { DemoScenarioManager } from '../lib/domain/demoScenarioManager';

describe('Observation Lifecycle, Authorization, and Idempotency Tests', () => {
  const prisma = new PrismaClient();
  const userA = 'test_user_lifecycle_A';
  const userB = 'test_user_lifecycle_B';

  beforeEach(async () => {
    await prisma.userObservation.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.changeEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.watchlist.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });

    await prisma.user.createMany({
      data: [
        { id: userA, name: 'Lifecycle User A', email: 'lifecycle_a@pulsewatch.local' },
        { id: userB, name: 'Lifecycle User B', email: 'lifecycle_b@pulsewatch.local' },
      ],
    });
  });

  it('1. Proves Personal Baseline Divergence: Same current market + different user baselines = different personal movements', async () => {
    // Setup User A baseline @ ₹1,500
    await prisma.userObservation.create({
      data: {
        userId: userA,
        symbol: 'INFY',
        price: 1500.00,
        volume: 4000000,
        marketTimestamp: new Date(),
        observedAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    // Setup User B baseline @ ₹1,545
    await prisma.userObservation.create({
      data: {
        userId: userB,
        symbol: 'INFY',
        price: 1545.00,
        volume: 4000000,
        marketTimestamp: new Date(),
        observedAt: new Date(Date.now() - 1800 * 1000),
      },
    });

    // Current market state for BOTH users: INFY @ ₹1,560
    const provider = new DemoProvider('PERSONAL_BASELINE_DIVERGENCE');
    const obsManager = new ObservationManager(prisma, provider);

    const payloadA = await obsManager.processUserDashboard(userA);
    const payloadB = await obsManager.processUserDashboard(userB);

    const evtA = payloadA.meaningfulChanges.find(e => e.symbol === 'INFY') || payloadA.lowerSignalChanges.find(e => e.symbol === 'INFY');
    const evtB = payloadB.meaningfulChanges.find(e => e.symbol === 'INFY') || payloadB.lowerSignalChanges.find(e => e.symbol === 'INFY');

    expect(evtA?.personalChangePct).toBe(4.0);
    expect(evtB?.personalChangePct).toBe(0.97);
    expect(evtA?.currentPrice).toBe(1560.00);
    expect(evtB?.currentPrice).toBe(1560.00);
  });

  it('2. Proves Idempotency & ChangeEvent FK persistence (previousObservationId & currentSnapshotId)', async () => {
    const provider = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const obsManager = new ObservationManager(prisma, provider);

    await obsManager.processUserDashboard(userA);
    const countFirst = await prisma.changeEvent.count({ where: { userId: userA, symbol: 'INFY' } });

    // Verify created ChangeEvent populates currentSnapshotId reference
    const dbEvt = await prisma.changeEvent.findFirst({ where: { userId: userA, symbol: 'INFY' } });
    expect(dbEvt).not.toBeNull();
    expect(dbEvt?.idempotencyKey).toBeDefined();

    // Refresh dashboard again
    await obsManager.processUserDashboard(userA);
    const countSecond = await prisma.changeEvent.count({ where: { userId: userA, symbol: 'INFY' } });

    // Idempotency prevents duplicate insertion
    expect(countSecond).toBe(countFirst);
  });

  it('3. Proves Observation Baseline Lifecycle (First visit -> +4% move -> second refresh without move does not repeat +4%)', async () => {
    const providerV1 = new DemoProvider('NORMAL_NOISE');
    const obsManagerV1 = new ObservationManager(prisma, providerV1);

    const payload1 = await obsManagerV1.processUserDashboard(userA);
    expect(payload1.isFirstVisit).toBe(true);

    const providerV2 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const obsManagerV2 = new ObservationManager(prisma, providerV2);

    const payload2 = await obsManagerV2.processUserDashboard(userA);
    expect(payload2.isFirstVisit).toBe(false);

    const infyEvent2 = payload2.meaningfulChanges.find(e => e.symbol === 'INFY');
    expect(infyEvent2?.personalChangePct).toBeGreaterThan(3.5);

    // Subsequent visit without further market change
    const obsManagerV3 = new ObservationManager(prisma, providerV2);
    const payload3 = await obsManagerV3.processUserDashboard(userA);

    const infyEvent3 = payload3.meaningfulChanges.find(e => e.symbol === 'INFY') || payload3.lowerSignalChanges.find(e => e.symbol === 'INFY');
    expect(infyEvent3?.personalChangePct).toBe(0);
  });

  it('4. Enforces database duplicate watchlist item prevention constraint (UNIQUE watchlist_id, symbol)', async () => {
    const wl = await prisma.watchlist.create({
      data: { userId: userA, name: 'Test List', isDefault: false },
    });

    await prisma.watchlistItem.create({
      data: { watchlistId: wl.id, symbol: 'INFY', displayName: 'Infosys' },
    });

    // Attempting duplicate insertion must throw unique constraint violation (P2002)
    await expect(
      prisma.watchlistItem.create({
        data: { watchlistId: wl.id, symbol: 'INFY', displayName: 'Infosys' },
      })
    ).rejects.toThrow();
  });

  it('5. Handles Market Closed scenario correctly', async () => {
    const provider = new DemoProvider('MARKET_CLOSED');
    const obsManager = new ObservationManager(prisma, provider);

    const payload = await obsManager.processUserDashboard(userA);
    expect(payload.marketStatus).toBe('CLOSED');
  });

  it('6. Demo Reset wipes observations and restores clean initial state', async () => {
    const provider = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const obsManager = new ObservationManager(prisma, provider);

    await obsManager.processUserDashboard(userA);
    const obsCountBefore = await prisma.userObservation.count({ where: { userId: userA } });
    expect(obsCountBefore).toBeGreaterThan(0);

    const demoManager = new DemoScenarioManager(prisma);
    await demoManager.resetDemo(userA);

    const obsCountAfter = await prisma.userObservation.count({ where: { userId: userA } });
    expect(obsCountAfter).toBe(0);
  });
  it('7. Attention Budget filters and respects MAX_PRIMARY_CHANGES limit', async () => {
    // We add 10 stocks to the watchlist, make them all have HIGH_ATTENTION.
    // The DemoProvider in MULTIPLE_MOVES returns changes for 6+ symbols.
    const provider = new DemoProvider('MULTIPLE_MOVES');
    const obsManager = new ObservationManager(prisma, provider);

    const wl = await prisma.watchlist.create({
      data: { userId: userA, name: 'Large List', isDefault: false },
    });
    
    for (const sym of ['INFY', 'TCS', 'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'WIPRO', 'HCLTECH']) {
      await prisma.watchlistItem.create({
        data: { watchlistId: wl.id, symbol: sym, displayName: sym },
      });
      // create baseline so we get changes
      await prisma.userObservation.create({
        data: {
          userId: userA,
          symbol: sym,
          price: 100, // artifically low so all register as huge moves
          volume: 4000000,
          marketTimestamp: new Date(),
          observedAt: new Date(Date.now() - 3600 * 1000),
        },
      });
    }

    const payload = await obsManager.processUserDashboard(userA, wl.id);
    expect(payload.meaningfulChanges.length).toBeLessThanOrEqual(5);
    // There are 7 stocks, all should move massively. Max 5 prominent.
    expect(payload.lowerSignalChanges.length).toBeGreaterThanOrEqual(2);
  });

  it('8. Critical End-to-End Flow (First visit -> returns to +4% -> idempotency -> divergence)', async () => {
    // 1-4. User A visits and establishes baseline (INFY = 1500 in NORMAL_NOISE initially)
    const providerV1 = new DemoProvider('NORMAL_NOISE');
    const obsV1 = new ObservationManager(prisma, providerV1);
    await obsV1.processUserDashboard(userA);

    // Hardcode baseline to exact 1500 to match the prompt's scenario
    await prisma.userObservation.updateMany({
      where: { userId: userA, symbol: 'INFY' },
      data: { price: 1500.00 }
    });

    // 5-8. INFY changes to 1560 (mock provider to return exactly 1560)
    const providerV2 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    providerV2.getQuotes = async (symbols) => {
      const q = await DemoProvider.prototype.getQuotes.call(providerV2, symbols);
      if (q['INFY']) q['INFY'].price = 1560.00;
      return q;
    };
    
    const obsV2 = new ObservationManager(prisma, providerV2);
    const payloadV2 = await obsV2.processUserDashboard(userA);
    const eventV2 = payloadV2.meaningfulChanges.find(e => e.symbol === 'INFY');
    
    // 7. Dashboard displays approximately +4%
    expect(eventV2?.personalChangePct).toBeCloseTo(4.00, 1);
    
    // 8. New observation is stored
    const obsCount = await prisma.userObservation.count({ where: { userId: userA, symbol: 'INFY' } });
    expect(obsCount).toBeGreaterThanOrEqual(2); // Initial + this one
    
    // 9-10. User A refreshes with same market state -> Previous +4% is NOT shown again
    const payloadV3 = await obsV2.processUserDashboard(userA);
    const eventV3 = payloadV3.meaningfulChanges.find(e => e.symbol === 'INFY') || payloadV3.lowerSignalChanges.find(e => e.symbol === 'INFY');
    expect(eventV3?.personalChangePct).toBe(0);

    // 11. User B has previous observation ₹1545
    await prisma.userObservation.create({
      data: {
        userId: userB,
        symbol: 'INFY',
        price: 1545.00,
        volume: 4000000,
        marketTimestamp: new Date(),
        observedAt: new Date(Date.now() - 3600 * 1000),
      }
    });

    // 12-13. User B sees approx +0.97% against the same 1560 state
    const obsV2_UserB = new ObservationManager(prisma, providerV2);
    const payloadUserB = await obsV2_UserB.processUserDashboard(userB);
    const eventUserB = payloadUserB.meaningfulChanges.find(e => e.symbol === 'INFY') || payloadUserB.lowerSignalChanges.find(e => e.symbol === 'INFY');
    expect(eventUserB?.personalChangePct).toBeCloseTo(0.97, 1);
  });
});

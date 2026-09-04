import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ObservationManager, DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID, DIVERGENCE_DEMO_USER_A_BASELINE, DIVERGENCE_DEMO_USER_B_BASELINE, DIVERGENCE_DEMO_INFY_CURRENT_PRICE } from '../lib/domain/observationManager';
import { DemoProvider } from '../lib/domain/marketDataProvider';

describe('Personal Baseline Divergence — Determinism & Isolation Tests', () => {
  const prisma = new PrismaClient();

  // Expected exact values (to 2 decimal places)
  const EXPECTED_A_PCT = Number(
    (((DIVERGENCE_DEMO_INFY_CURRENT_PRICE - DIVERGENCE_DEMO_USER_A_BASELINE) / DIVERGENCE_DEMO_USER_A_BASELINE) * 100).toFixed(2)
  ); // 4.00
  const EXPECTED_B_PCT = Number(
    (((DIVERGENCE_DEMO_INFY_CURRENT_PRICE - DIVERGENCE_DEMO_USER_B_BASELINE) / DIVERGENCE_DEMO_USER_B_BASELINE) * 100).toFixed(2)
  ); // 0.97

  const makeManager = () => {
    const provider = new DemoProvider('PERSONAL_BASELINE_DIVERGENCE');
    return new ObservationManager(prisma, provider);
  };

  const cleanupDivergenceUsers = async () => {
    await prisma.changeEvent.deleteMany({ where: { userId: { in: [DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID] } } });
    await prisma.userObservation.deleteMany({ where: { userId: { in: [DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID] } } });
    await prisma.watchlist.deleteMany({ where: { userId: { in: [DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID] } } });
    await prisma.user.deleteMany({ where: { id: { in: [DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID] } } });
  };

  beforeEach(async () => {
    await cleanupDivergenceUsers();
  });

  afterEach(async () => {
    await cleanupDivergenceUsers();
  });

  // ─── Test A: Clean run produces exact expected values ─────────────────────
  it('A. Clean run: User A = +4.00%, User B = +0.97% from exact canonical baselines', async () => {
    const mgr = makeManager();
    const result = await mgr.runDivergenceSimulation();

    // Current price must be the canonical demo price for both
    expect(result.currentPrice).toBe(DIVERGENCE_DEMO_INFY_CURRENT_PRICE);
    expect(result.userA.currentPrice).toBe(DIVERGENCE_DEMO_INFY_CURRENT_PRICE);
    expect(result.userB.currentPrice).toBe(DIVERGENCE_DEMO_INFY_CURRENT_PRICE);

    // Baselines must be the canonical seed values
    expect(result.userA.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_A_BASELINE); // ₹1500
    expect(result.userB.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_B_BASELINE); // ₹1545

    // Personal change percentages must match the formula exactly
    expect(result.userA.personalChangePct).toBe(EXPECTED_A_PCT); // +4.00
    expect(result.userB.personalChangePct).toBe(EXPECTED_B_PCT); // +0.97

    // Same snapshot used for both users
    expect(result.userA.infy.currentPrice).toBe(result.userB.infy.currentPrice);

    // User A with larger move should have higher attention score
    expect(result.userA.attentionScore).toBeGreaterThan(result.userB.attentionScore);
  });

  // ─── Test B: Repeated run produces identical results ─────────────────────
  it('B. Repeated run produces identical deterministic results', async () => {
    const mgr = makeManager();

    const run1 = await mgr.runDivergenceSimulation();
    const run2 = await mgr.runDivergenceSimulation();

    expect(run2.userA.previousObservationPrice).toBe(run1.userA.previousObservationPrice);
    expect(run2.userB.previousObservationPrice).toBe(run1.userB.previousObservationPrice);
    expect(run2.userA.personalChangePct).toBe(run1.userA.personalChangePct);
    expect(run2.userB.personalChangePct).toBe(run1.userB.personalChangePct);
    expect(run2.currentPrice).toBe(run1.currentPrice);
  });

  // ─── Test C: Stale observations are overwritten by seed ──────────────────
  it('C. Stale/wrong observations (e.g. ₹1512, ₹1560) are reset and replaced by canonical seeds', async () => {
    // Pre-populate WRONG baselines (simulating stale state from a prior dev run)
    await prisma.user.upsert({
      where: { email: `${DIVERGENCE_DEMO_USER_A_ID}@pulsewatch.local` },
      update: {},
      create: { id: DIVERGENCE_DEMO_USER_A_ID, name: 'User A', email: `${DIVERGENCE_DEMO_USER_A_ID}@pulsewatch.local` },
    });
    await prisma.user.upsert({
      where: { email: `${DIVERGENCE_DEMO_USER_B_ID}@pulsewatch.local` },
      update: {},
      create: { id: DIVERGENCE_DEMO_USER_B_ID, name: 'User B', email: `${DIVERGENCE_DEMO_USER_B_ID}@pulsewatch.local` },
    });

    // Inject stale wrong observations
    await prisma.userObservation.createMany({
      data: [
        { userId: DIVERGENCE_DEMO_USER_A_ID, symbol: 'INFY', price: 1512.00, volume: 4500000, marketTimestamp: new Date(), observedAt: new Date() },
        { userId: DIVERGENCE_DEMO_USER_B_ID, symbol: 'INFY', price: 1560.00, volume: 4500000, marketTimestamp: new Date(), observedAt: new Date() },
      ],
    });

    const mgr = makeManager();
    const result = await mgr.runDivergenceSimulation();

    // Stale observations must be gone — canonical values take over
    expect(result.userA.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_A_BASELINE); // 1500, not 1512
    expect(result.userB.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_B_BASELINE); // 1545, not 1560
    expect(result.userA.personalChangePct).toBe(EXPECTED_A_PCT);
    expect(result.userB.personalChangePct).toBe(EXPECTED_B_PCT);
  });

  // ─── Test D: Modal and proof use the same backend result ─────────────────
  it('D. Single result object provides consistent data for both cards and proof', async () => {
    const mgr = makeManager();
    const result = await mgr.runDivergenceSimulation();

    // Proof text would show: result.userA.personalChangePct and result.userB.personalChangePct
    // Cards would show: result.userA.previousObservationPrice, result.userB.previousObservationPrice
    // All values come from the same object — no separate calculation

    const proofFormulaA = ((result.currentPrice - result.userA.previousObservationPrice) / result.userA.previousObservationPrice) * 100;
    const proofFormulaB = ((result.currentPrice - result.userB.previousObservationPrice) / result.userB.previousObservationPrice) * 100;

    expect(Number(proofFormulaA.toFixed(2))).toBe(result.userA.personalChangePct);
    expect(Number(proofFormulaB.toFixed(2))).toBe(result.userB.personalChangePct);
  });

  // ─── Test E: Same snapshot used for both users ───────────────────────────
  it('E. Both users receive the exact same current price snapshot', async () => {
    const mgr = makeManager();
    const result = await mgr.runDivergenceSimulation();

    expect(result.userA.infy.currentPrice).toBe(DIVERGENCE_DEMO_INFY_CURRENT_PRICE);
    expect(result.userB.infy.currentPrice).toBe(DIVERGENCE_DEMO_INFY_CURRENT_PRICE);
    expect(result.userA.infy.currentPrice).toBe(result.userB.infy.currentPrice);
    expect(result.userA.infy.dataQuality.status).toBe('FRESH');
    expect(result.userB.infy.dataQuality.status).toBe('FRESH');
  });

  // ─── Test F: Running prior scenarios doesn't affect divergence ───────────
  it('F. Prior scenarios (NORMAL_NOISE → MAJOR_SPIKE → ... → PROVIDER_FAILURE → MARKET_CLOSED) do not pollute divergence result', async () => {
    const normalUserId = 'test_user_div_sequence';

    // Clean up
    await prisma.userObservation.deleteMany({ where: { userId: normalUserId } });
    await prisma.changeEvent.deleteMany({ where: { userId: normalUserId } });
    await prisma.watchlist.deleteMany({ where: { userId: normalUserId } });
    await prisma.user.deleteMany({ where: { id: normalUserId } });

    try {
      await prisma.user.create({
        data: { id: normalUserId, name: 'Sequence User', email: 'sequence@pulsewatch.local' },
      });

      // Run through all prior scenarios for a normal user
      const scenarios = [
        'NORMAL_NOISE',
        'SIGNIFICANT_SINGLE_MOVE',
        'MULTIPLE_MOVES',
        'UNUSUAL_VOLATILITY',
        'STALE_DATA',
        'PROVIDER_FAILURE',
        'MARKET_CLOSED',
      ] as const;

      for (const scenario of scenarios) {
        const provider = new DemoProvider(scenario);
        const mgr = new ObservationManager(prisma, provider);
        await mgr.processUserDashboard(normalUserId);
      }

      // Now run divergence — must still produce canonical values regardless
      const divMgr = makeManager();
      const result = await divMgr.runDivergenceSimulation();

      expect(result.userA.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_A_BASELINE);
      expect(result.userB.previousObservationPrice).toBe(DIVERGENCE_DEMO_USER_B_BASELINE);
      expect(result.userA.personalChangePct).toBe(EXPECTED_A_PCT);
      expect(result.userB.personalChangePct).toBe(EXPECTED_B_PCT);
    } finally {
      await prisma.userObservation.deleteMany({ where: { userId: normalUserId } });
      await prisma.changeEvent.deleteMany({ where: { userId: normalUserId } });
      await prisma.watchlist.deleteMany({ where: { userId: normalUserId } });
      await prisma.user.deleteMany({ where: { id: normalUserId } });
    }
  });

  // ─── Verify exact percentages ─────────────────────────────────────────────
  it('G. Exact percentage values match the mathematical formula precisely', async () => {
    // User A: (1560 - 1500) / 1500 * 100 = 4.00
    const expectedA = Number((((1560 - 1500) / 1500) * 100).toFixed(2));
    expect(expectedA).toBe(4.00);

    // User B: (1560 - 1545) / 1545 * 100 = 0.97...
    const expectedB = Number((((1560 - 1545) / 1545) * 100).toFixed(2));
    expect(expectedB).toBe(0.97);

    const mgr = makeManager();
    const result = await mgr.runDivergenceSimulation();

    expect(result.userA.personalChangePct).toBe(4.00);
    expect(result.userB.personalChangePct).toBe(0.97);
  });
});

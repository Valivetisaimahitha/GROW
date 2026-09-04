import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ObservationManager } from '../lib/domain/observationManager';
import { DemoProvider } from '../lib/domain/marketDataProvider';
import { DemoScenarioManager } from '../lib/domain/demoScenarioManager';

describe('State Consistency & Scenario Pipeline Tests', () => {
  const prisma = new PrismaClient();
  const testUserId = 'test_user_consistency_suite';

  beforeEach(async () => {
    await prisma.userObservation.deleteMany({ where: { userId: testUserId } });
    await prisma.changeEvent.deleteMany({ where: { userId: testUserId } });
    await prisma.watchlist.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await prisma.user.create({
      data: { id: testUserId, name: 'Consistency User', email: 'consistency@pulsewatch.local' },
    });
  });

  it('1. NORMAL_NOISE produces expected low-signal result and 0 meaningful changes', async () => {
    const provider = new DemoProvider('NORMAL_NOISE');
    const obsManager = new ObservationManager(prisma, provider);

    // Initial visit establishes baseline
    await obsManager.processUserDashboard(testUserId);

    // Second evaluation under NORMAL_NOISE
    const payload = await obsManager.processUserDashboard(testUserId);
    expect(payload.meaningfulChanges.length).toBe(0);
    expect(payload.summary.meaningful).toBe(0);
  });

  it('2. SIGNIFICANT_SINGLE_MOVE produces expected INFY move', async () => {
    const provider1 = new DemoProvider('NORMAL_NOISE');
    const obsManager1 = new ObservationManager(prisma, provider1);
    await obsManager1.processUserDashboard(testUserId);

    const provider2 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const obsManager2 = new ObservationManager(prisma, provider2);
    const payload = await obsManager2.processUserDashboard(testUserId);

    const infyMove = payload.meaningfulChanges.find(e => e.symbol === 'INFY');
    expect(infyMove).toBeDefined();
    expect(infyMove?.personalChangePct).toBeGreaterThan(4.0);
    expect(infyMove?.personalChangePct).toBeLessThan(5.0);
    expect(['SIGNIFICANT', 'HIGH_ATTENTION']).toContain(infyMove?.severity);
  });

  it('3. Dashboard summary invariant: meaningful + lowerSignal = changed', async () => {
    const provider = new DemoProvider('MULTIPLE_MOVES');
    const obsManager = new ObservationManager(prisma, provider);

    // Baseline initial visit
    await obsManager.processUserDashboard(testUserId);

    // Process evaluation
    const provider2 = new DemoProvider('MULTIPLE_MOVES');
    const obsManager2 = new ObservationManager(prisma, provider2);
    const payload = await obsManager2.processUserDashboard(testUserId);

    const { tracked, changed, meaningful, lowerSignal } = payload.summary;
    expect(meaningful + lowerSignal).toBe(changed);
    expect(meaningful + lowerSignal).toBeLessThanOrEqual(tracked);
  });

  it('4. Reset Demo produces deterministic clean state and clears old ChangeEvents', async () => {
    const provider = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const obsManager = new ObservationManager(prisma, provider);
    await obsManager.processUserDashboard(testUserId);

    // Verify events were created
    const countBefore = await prisma.userObservation.count({ where: { userId: testUserId } });
    expect(countBefore).toBeGreaterThan(0);

    // Perform Reset Demo
    const scenarioManager = new DemoScenarioManager(prisma);
    await scenarioManager.resetDemo(testUserId);

    const countAfterObs = await prisma.userObservation.count({ where: { userId: testUserId } });
    const countAfterEvt = await prisma.changeEvent.count({ where: { userId: testUserId } });
    const state = await scenarioManager.getScenarioState();

    expect(countAfterObs).toBe(0);
    expect(countAfterEvt).toBe(0);
    expect(state.scenario).toBe('NORMAL_NOISE');
    expect(state.timeShiftMinutes).toBe(0);
  });

  it('5. Repeating the same scenario sequence produces identical output', async () => {
    const runSequence = async () => {
      const manager = new DemoScenarioManager(prisma);
      await manager.resetDemo(testUserId);

      // Visit 1: Normal Noise
      const provider1 = new DemoProvider('NORMAL_NOISE');
      const obs1 = new ObservationManager(prisma, provider1);
      const p1 = await obs1.processUserDashboard(testUserId);

      // Visit 2: Significant Single Move
      const provider2 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
      const obs2 = new ObservationManager(prisma, provider2);
      const p2 = await obs2.processUserDashboard(testUserId);

      return { p1, p2 };
    };

    const res1 = await runSequence();
    const res2 = await runSequence();

    expect(res1.p1.summary).toEqual(res2.p1.summary);
    expect(res1.p2.summary).toEqual(res2.p2.summary);
    const infy1 = res1.p2.meaningfulChanges.find(e => e.symbol === 'INFY');
    const infy2 = res2.p2.meaningfulChanges.find(e => e.symbol === 'INFY');
    expect(infy1?.personalChangePct).toBe(infy2?.personalChangePct);
  });

  it('6. Provider failure + trusted previous price does NOT calculate fake -100% or 0 price', async () => {
    // 1. Establish baseline observation for INFY
    const provider1 = new DemoProvider('NORMAL_NOISE');
    const obs1 = new ObservationManager(prisma, provider1);
    await obs1.processUserDashboard(testUserId);

    // 2. Evaluate under PROVIDER_FAILURE
    const providerFail = new DemoProvider('PROVIDER_FAILURE');
    const obsFail = new ObservationManager(prisma, providerFail);
    const payload = await obsFail.processUserDashboard(testUserId);

    const infyEvt = payload.meaningfulChanges.find(e => e.symbol === 'INFY') || payload.lowerSignalChanges.find(e => e.symbol === 'INFY');
    expect(infyEvt).toBeDefined();
    expect(infyEvt?.dataQuality.status).toBe('UNAVAILABLE');
    expect(infyEvt?.currentPrice).toBeNull();
    expect(infyEvt?.personalChangePct).toBeNull();
    expect(infyEvt?.todayChangePct).toBeNull();
    expect(infyEvt?.previousObservationPrice).toBeGreaterThan(0);
  });

  it('7. Unusual Volatility scenario surfaces ITC prominently due to behavioral baseline ratio', async () => {
    // 1. Establish baseline observation
    const provider1 = new DemoProvider('NORMAL_NOISE');
    const obs1 = new ObservationManager(prisma, provider1);
    await obs1.processUserDashboard(testUserId);

    // 2. Evaluate under UNUSUAL_VOLATILITY
    const providerVol = new DemoProvider('UNUSUAL_VOLATILITY');
    const obsVol = new ObservationManager(prisma, providerVol);
    const payload = await obsVol.processUserDashboard(testUserId);

    const itcEvt = payload.meaningfulChanges.find(e => e.symbol === 'ITC');
    expect(itcEvt).toBeDefined();
    expect(itcEvt?.unusualnessFactor).toBeGreaterThanOrEqual(1.8);
    expect(itcEvt?.reasons.some(r => r.code === 'UNUSUAL_MOVE')).toBe(true);
  });

  it('8. Market Closed scenario returns CLOSED market status without fake live movements', async () => {
    const providerClosed = new DemoProvider('MARKET_CLOSED');
    const obsClosed = new ObservationManager(prisma, providerClosed);
    const payload = await obsClosed.processUserDashboard(testUserId);

    expect(payload.marketStatus).toBe('CLOSED');
  });
});

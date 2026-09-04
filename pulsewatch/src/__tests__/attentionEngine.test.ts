import { describe, it, expect, vi } from 'vitest';
import { calculateAttention } from '../lib/domain/attentionEngine';
import { DemoProvider, deriveHistoricalVolatility } from '../lib/domain/marketDataProvider';
import { MarketSnapshot, UserObservation } from '../lib/domain/types';

describe('Domain Core Unit Tests: Attention, Confidence, and Deterministic Providers', () => {
  const mockSnapshot = (price: number, prevClose: number, volume = 1000000, ageSeconds = 10): MarketSnapshot => ({
    symbol: 'INFY',
    price,
    previousClose: prevClose,
    openPrice: prevClose,
    highPrice: Math.max(price, prevClose),
    lowPrice: Math.min(price, prevClose),
    volume,
    provider: 'demo',
    providerTimestamp: new Date(Date.now() - ageSeconds * 1000).toISOString(),
    receivedAt: new Date().toISOString(),
    freshnessStatus: ageSeconds > 300 ? 'STALE' : 'FRESH',
  });

  const mockObs = (price: number): UserObservation => ({
    userId: 'user_1',
    symbol: 'INFY',
    price,
    volume: 1000000,
    marketTimestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
    observedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  });

  it('1. Zero movement returns NORMAL severity and score close to 0', () => {
    const obs = mockObs(1500);
    const snap = mockSnapshot(1500, 1500);
    const result = calculateAttention({
      previousObservation: obs,
      currentSnapshot: snap,
      typicalVolatility: 0.012,
      averageVolume: 1000000,
    });

    expect(result.personalChangePct).toBe(0);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.severity).toBe('NORMAL');
    expect(result.confidence).toBe('HIGH');
  });

  it('2. Same price move + different historical volatility = different unusualness', () => {
    const obs = mockObs(1000);
    const snap = mockSnapshot(1030, 1000);

    const resultLowVol = calculateAttention({
      previousObservation: obs,
      currentSnapshot: snap,
      typicalVolatility: 0.008,
    });

    const resultHighVol = calculateAttention({
      previousObservation: obs,
      currentSnapshot: snap,
      typicalVolatility: 0.030,
    });

    expect(resultLowVol.unusualnessFactor).toBeGreaterThan(resultHighVol.unusualnessFactor!);
    expect(resultLowVol.score).toBeGreaterThan(resultHighVol.score);
  });

  it('3. Large movement + stale data = HIGH attention but LOW confidence (strictly separated)', () => {
    const obs = mockObs(1500);
    const snapStale = mockSnapshot(1575, 1500, 2000000, 600); // 10m old data
    const result = calculateAttention({
      previousObservation: obs,
      currentSnapshot: snapStale,
      typicalVolatility: 0.012,
    });

    expect(result.score).toBeGreaterThanOrEqual(61);
    expect(['SIGNIFICANT', 'HIGH_ATTENTION']).toContain(result.severity);
    expect(result.confidence).toBe('LOW'); // Confidence is LOW due to staleness, NOT additive score reduction!
    expect(result.reasons.some(r => r.code === 'STALE_WARNING')).toBe(true);
  });

  it('4. Insufficient historical data does NOT fabricate volatility or unusualness', () => {
    const obs = mockObs(1500);
    const snap = mockSnapshot(1545, 1500);
    const result = calculateAttention({
      previousObservation: obs,
      currentSnapshot: snap,
      typicalVolatility: null,
      averageVolume: null,
      historicalStatus: 'HISTORICAL_DATA_UNAVAILABLE',
    });

    expect(result.unusualnessFactor).toBeNull();
    expect(result.volumeAnomalyRatio).toBeNull();
    expect(result.historicalStatus).toBe('HISTORICAL_DATA_UNAVAILABLE');
    expect(result.reasons.some(r => r.code === 'HISTORY_UNAVAILABLE')).toBe(true);
  });

  it('5. Dynamic historical volatility derivation returns correct status without fabrication', () => {
    const insufficientSeries = [100, 102, 101]; // < 5 points
    const sufficientSeries = Array.from({ length: 15 }, (_, i) => 100 + (i % 3));

    const status1 = deriveHistoricalVolatility(insufficientSeries);
    expect(status1.volatility).toBeNull();
    expect(status1.status).toBe('HISTORICAL_DATA_UNAVAILABLE');

    const status2 = deriveHistoricalVolatility(sufficientSeries);
    expect(status2.volatility).not.toBeNull();
    expect(status2.status).toBe('HISTORICAL_DATA_SUFFICIENT');
  });

  it('6. Deterministic DemoProvider produces reproducible outputs (Zero Math.random())', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
    
    const provider1 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');
    const provider2 = new DemoProvider('SIGNIFICANT_SINGLE_MOVE');

    const quotes1 = await provider1.getQuotes(['INFY', 'RELIANCE']);
    const quotes2 = await provider2.getQuotes(['INFY', 'RELIANCE']);

    expect(quotes1['INFY'].price).toBe(quotes2['INFY'].price);
    expect(quotes1['INFY'].volume).toBe(quotes2['INFY'].volume);

    const history1 = await provider1.getHistoricalData('INFY', '1M');
    const history2 = await provider2.getHistoricalData('INFY', '1M');
    expect(history1).toEqual(history2);
    
    vi.useRealTimers();
  });

  it('7. Partial provider failure isolates failed symbol cleanly', async () => {
    const provider = new DemoProvider('NORMAL_NOISE');
    const quotes = await provider.getQuotes(['INFY', 'FAIL_SYM']);

    expect(quotes['INFY'].freshnessStatus).toBe('FRESH');
    expect(quotes['FAIL_SYM'].freshnessStatus).toBe('UNAVAILABLE');
    expect(quotes['FAIL_SYM'].price).toBe(0);
  });
});

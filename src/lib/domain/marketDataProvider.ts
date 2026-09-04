import { DemoScenarioType, FreshnessStatus, HistoricalDataStatus, MarketSnapshot } from './types';

export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<Record<string, MarketSnapshot>>;
  getQuote(symbol: string): Promise<MarketSnapshot>;
  getHistoricalData(symbol: string, timeframe: '1D' | '1W' | '1M' | '3M'): Promise<{ timestamp: string; price: number }[]>;
  getMarketStatus(): Promise<'OPEN' | 'CLOSED' | 'PRE_OPEN'>;
}

export const DEFAULT_SECURITIES = [
  { symbol: 'INFY', companyName: 'Infosys Limited', basePrice: 1500.00, volatility: 0.011, avgVol: 4500000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', basePrice: 2950.00, volatility: 0.013, avgVol: 6200000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services', basePrice: 3980.00, volatility: 0.010, avgVol: 2800000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', basePrice: 1440.00, volatility: 0.012, avgVol: 9500000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', basePrice: 1080.00, volatility: 0.014, avgVol: 8100000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', basePrice: 960.00, volatility: 0.021, avgVol: 12000000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'WIPRO', companyName: 'Wipro Limited', basePrice: 510.00, volatility: 0.015, avgVol: 5400000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited', basePrice: 1190.00, volatility: 0.012, avgVol: 4100000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'ITC', companyName: 'ITC Limited', basePrice: 415.00, volatility: 0.008, avgVol: 11000000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
  { symbol: 'SBIN', companyName: 'State Bank of India', basePrice: 760.00, volatility: 0.016, avgVol: 9200000, historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus },
];

/**
 * Calculates historical daily volatility (standard deviation of daily returns) dynamically.
 * Derives true historical status without fabricating baseline data.
 */
export function deriveHistoricalVolatility(priceSeries: number[]): { volatility: number | null; status: HistoricalDataStatus } {
  if (!priceSeries || priceSeries.length < 5) {
    return { volatility: null, status: 'HISTORICAL_DATA_UNAVAILABLE' };
  }

  // Calculate daily percentage returns
  const returns: number[] = [];
  for (let i = 1; i < priceSeries.length; i++) {
    const prev = priceSeries[i - 1];
    const curr = priceSeries[i];
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length < 4) {
    return { volatility: null, status: 'HISTORICAL_DATA_UNAVAILABLE' };
  }

  // Calculate mean return
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate variance & standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  const status: HistoricalDataStatus = priceSeries.length >= 14 
    ? 'HISTORICAL_DATA_SUFFICIENT' 
    : 'HISTORICAL_DATA_LIMITED';

  return {
    volatility: Number(stdDev.toFixed(4)),
    status,
  };
}

/**
 * Deterministic Market Data Provider Adapter
 * Feeds exact same MarketSnapshot -> AttentionEngine -> ChangeEvent pipeline.
 * Zero Math.random() usage for reproducible evaluation.
 */
export class DemoProvider implements MarketDataProvider {
  private scenario: DemoScenarioType = 'NORMAL_NOISE';
  private timeShiftMinutes = 0;

  constructor(scenario: DemoScenarioType = 'NORMAL_NOISE', timeShiftMinutes = 0) {
    this.scenario = scenario;
    this.timeShiftMinutes = timeShiftMinutes;
  }

  public setScenario(scenario: DemoScenarioType, timeShiftMinutes = 0) {
    this.scenario = scenario;
    this.timeShiftMinutes = timeShiftMinutes;
  }

  public async getMarketStatus(): Promise<'OPEN' | 'CLOSED' | 'PRE_OPEN'> {
    if (this.scenario === 'MARKET_CLOSED') {
      return 'CLOSED';
    }
    return 'OPEN';
  }

  public async getQuote(symbol: string): Promise<MarketSnapshot> {
    const quotes = await this.getQuotes([symbol]);
    return quotes[symbol] || this.createSnapshot(symbol, 1000, 1000, 1000000, 'FRESH');
  }

  public async getQuotes(symbols: string[]): Promise<Record<string, MarketSnapshot>> {
    const results: Record<string, MarketSnapshot> = {};

    if (this.scenario === 'PROVIDER_FAILURE') {
      for (const sym of symbols) {
        results[sym] = this.createSnapshot(sym, 0, 0, 0, 'UNAVAILABLE');
      }
      return results;
    }

    const now = new Date(Date.now() + this.timeShiftMinutes * 60 * 1000);

    for (const sym of symbols) {
      const security = DEFAULT_SECURITIES.find(s => s.symbol === sym) || {
        symbol: sym,
        companyName: `${sym} Ltd`,
        basePrice: 1000.0,
        volatility: 0.012,
        avgVol: 1000000,
        historicalStatus: 'HISTORICAL_DATA_SUFFICIENT' as HistoricalDataStatus,
      };

      let price = security.basePrice;
      let prevClose = security.basePrice;
      let volume = security.avgVol;
      let freshness: FreshnessStatus = 'FRESH';

      // Deterministic price adjustments based on scenario and symbol characteristics
      switch (this.scenario) {
        case 'NORMAL_NOISE':
          // Micro price shifts using deterministic trigonometric function
          price = security.basePrice * (1 + (Math.sin(sym.length * 1.5) * 0.003));
          volume = security.avgVol * 0.95;
          break;

        case 'SIGNIFICANT_SINGLE_MOVE':
          if (sym === 'INFY') {
            price = security.basePrice * 1.045; // +4.5% move
            volume = security.avgVol * 2.6;    // 2.6x volume spike
          } else {
            price = security.basePrice * (1 + (Math.cos(sym.length * 2.1) * 0.002));
            volume = security.avgVol;
          }
          break;

        case 'PERSONAL_BASELINE_DIVERGENCE':
          // INFY current price set to ₹1560.00 to demonstrate Personal Baseline Divergence
          if (sym === 'INFY') {
            price = 1560.00;
            prevClose = 1500.00;
            volume = 5400000;
          } else {
            price = security.basePrice * 1.002;
            volume = security.avgVol;
          }
          break;

        case 'MULTIPLE_MOVES':
          if (sym === 'INFY') price = security.basePrice * 1.041;       // +4.1%
          else if (sym === 'RELIANCE') price = security.basePrice * 1.032; // +3.2%
          else if (sym === 'TCS') price = security.basePrice * 0.965;     // -3.5%
          else if (sym === 'TATAMOTORS') price = security.basePrice * 1.052;// +5.2%
          else price = security.basePrice * 1.002;
          volume = security.avgVol * 1.8;
          break;

        case 'UNUSUAL_VOLATILITY':
          if (sym === 'ITC') {
            price = security.basePrice * 1.032; // +3.2% on ITC (low typical vol 0.008 = 4.0x unusualness)
            volume = security.avgVol * 2.2;
          } else {
            price = security.basePrice * 1.001;
            volume = security.avgVol;
          }
          break;

        case 'STALE_DATA':
          price = security.basePrice * 1.038;
          freshness = 'STALE';
          break;

        case 'MARKET_CLOSED':
          price = security.basePrice * 1.008;
          volume = security.avgVol;
          break;
      }

      // Handle partial provider failure test
      if (sym === 'FAIL_SYM') {
        results[sym] = this.createSnapshot(sym, 0, 0, 0, 'UNAVAILABLE');
        continue;
      }

      const timestamp = freshness === 'STALE'
        ? new Date(now.getTime() - 42 * 60 * 1000).toISOString()
        : now.toISOString();

      results[sym] = {
        symbol: sym,
        price: Number(price.toFixed(2)),
        previousClose: Number(prevClose.toFixed(2)),
        openPrice: Number((prevClose * 1.001).toFixed(2)),
        highPrice: Number((Math.max(price, prevClose) * 1.005).toFixed(2)),
        lowPrice: Number((Math.min(price, prevClose) * 0.995).toFixed(2)),
        volume: Math.round(volume),
        provider: 'demo',
        providerTimestamp: timestamp,
        receivedAt: now.toISOString(),
        freshnessStatus: freshness,
      };
    }

    return results;
  }

  /**
   * Deterministic historical data generation (Zero Math.random())
   */
  public async getHistoricalData(symbol: string, timeframe: '1D' | '1W' | '1M' | '3M'): Promise<{ timestamp: string; price: number }[]> {
    const security = DEFAULT_SECURITIES.find(s => s.symbol === symbol) || { basePrice: 1000 };
    const pointsCount = timeframe === '1D' ? 24 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : 90;
    const now = Date.now();
    const stepMs = (timeframe === '1D' ? 3600 : 86400) * 1000;

    const data: { timestamp: string; price: number }[] = [];
    const symHash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    for (let i = pointsCount; i >= 0; i--) {
      const t = new Date(now - i * stepMs).toISOString();
      // Purely deterministic sine wave price curve
      const factor = Math.sin((i + symHash) * 0.3) * 0.02 + Math.cos(i * 0.1) * 0.01;
      const price = security.basePrice * (1 + factor);
      data.push({ timestamp: t, price: Number(price.toFixed(2)) });
    }

    return data;
  }

  private createSnapshot(symbol: string, price: number, prevClose: number, volume: number, status: FreshnessStatus): MarketSnapshot {
    const now = new Date().toISOString();
    return {
      symbol,
      price,
      previousClose: prevClose,
      openPrice: price,
      highPrice: price,
      lowPrice: price,
      volume,
      provider: 'demo',
      providerTimestamp: now,
      receivedAt: now,
      freshnessStatus: status,
    };
  }
}

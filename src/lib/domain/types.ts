export type SeverityBucket = 'NORMAL' | 'WORTH_A_LOOK' | 'SIGNIFICANT' | 'HIGH_ATTENTION';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type FreshnessStatus = 'FRESH' | 'DELAYED' | 'STALE' | 'UNAVAILABLE';

export type HistoricalDataStatus = 
  | 'HISTORICAL_DATA_SUFFICIENT'
  | 'HISTORICAL_DATA_LIMITED'
  | 'HISTORICAL_DATA_UNAVAILABLE';

export interface DataQuality {
  status: FreshnessStatus;
  provider: string;
  providerTimestamp: string;
  receivedAt: string;
  ageSeconds: number;
  confidence: ConfidenceLevel;
  message: string;
}

export interface MarketSnapshot {
  id?: string;
  symbol: string;
  price: number;
  previousClose: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  provider: string;
  providerTimestamp: string;
  receivedAt: string;
  freshnessStatus: FreshnessStatus;
}

export interface UserObservation {
  id?: string;
  userId: string;
  symbol: string;
  price: number;
  volume: number;
  marketTimestamp: string;
  observedAt: string;
}

export interface ReasonItem {
  code: string;
  text: string;
  value?: number;
}

export interface AttentionInput {
  previousObservation: UserObservation | null;
  currentSnapshot: MarketSnapshot;
  typicalVolatility?: number | null; // Null if unavailable
  averageVolume?: number | null;     // Null if unavailable
  historicalStatus?: HistoricalDataStatus;
  marketStatus?: 'OPEN' | 'CLOSED' | 'PRE_OPEN';
}

export interface AttentionResult {
  score: number;             // 0 to 100 clamped (Attention ONLY, no freshness addition!)
  severity: SeverityBucket;  // NORMAL, WORTH_A_LOOK, SIGNIFICANT, HIGH_ATTENTION
  confidence: ConfidenceLevel;// HIGH, MEDIUM, LOW (Confidence ONLY, derived from freshness)
  historicalStatus: HistoricalDataStatus;
  personalChangePct: number | null;
  todayChangePct: number | null;
  unusualnessFactor: number | null; // Null if history unavailable
  volumeAnomalyRatio: number | null;// Null if volume/history unavailable
  reasons: ReasonItem[];
  dataQuality: DataQuality;
}

export interface ChangeEventDomain {
  id?: string;
  userId: string;
  symbol: string;
  companyName: string;
  currentPrice: number | null;
  previousObservationId?: string | null;
  currentSnapshotId?: string | null;
  previousObservationPrice?: number | null;
  idempotencyKey?: string;
  personalChangePct: number | null;
  todayChangePct: number | null;
  unusualnessFactor: number | null;
  volumeAnomalyRatio: number | null;
  historicalStatus: HistoricalDataStatus;
  attentionScore: number;
  severity: SeverityBucket;
  confidence: ConfidenceLevel;
  reasons: ReasonItem[];
  dataQuality: DataQuality;
  isFirstVisit: boolean;
  createdAt: string;
}

export type DemoScenarioType = 
  | 'NORMAL_NOISE'
  | 'SIGNIFICANT_SINGLE_MOVE'
  | 'MULTIPLE_MOVES'
  | 'UNUSUAL_VOLATILITY'
  | 'STALE_DATA'
  | 'PROVIDER_FAILURE'
  | 'MARKET_CLOSED'
  | 'PERSONAL_BASELINE_DIVERGENCE';

export interface WatchlistDomain {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
  symbols: string[];
}

export interface DashboardPayload {
  userId: string;
  lastCheckedAt: string;
  isFirstVisit: boolean;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE_OPEN';
  summary: {
    tracked: number;
    changed: number;
    meaningful: number;
    lowerSignal: number;
  };
  meaningfulChanges: ChangeEventDomain[];
  lowerSignalChanges: ChangeEventDomain[];
  dataQualitySummary: {
    total: number;
    fresh: number;
    delayed: number;
    stale: number;
    unavailable: number;
  };
}

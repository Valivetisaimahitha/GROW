import { 
  AttentionInput, 
  AttentionResult, 
  ConfidenceLevel, 
  DataQuality, 
  FreshnessStatus, 
  HistoricalDataStatus,
  ReasonItem, 
  SeverityBucket 
} from './types';

export const ATTENTION_CONFIG = {
  MIN_VOLATILITY_PCT: 0.5,    // 0.5% floor to prevent division by near-zero
  PERSONAL_MOVE_WEIGHT: 14.0, // multiplier for personal change %
  PERSONAL_MOVE_CAP: 50.0,    // max score component for personal move
  UNUSUALNESS_WEIGHT: 15.0,   // multiplier for unusualness factor
  UNUSUALNESS_CAP: 30.0,      // max score component for unusualness
  VOLUME_WEIGHT: 10.0,        // multiplier for volume anomaly
  VOLUME_CAP: 20.0,           // max score component for volume anomaly

  FRESH_MAX_SEC: 60,          // < 60s
  DELAYED_MAX_SEC: 300,       // 60s - 300s
};

/**
 * Pure domain function to evaluate market change & calculate attention score + confidence.
 * Strictly separates Attention (meaningfulness) from Confidence (trustworthiness).
 * Handles insufficient history explicitly without fabricating baseline metrics.
 */
export function calculateAttention(input: AttentionInput): AttentionResult {
  const { 
    previousObservation, 
    currentSnapshot, 
    typicalVolatility, 
    averageVolume,
    historicalStatus = typicalVolatility !== undefined && typicalVolatility !== null 
      ? 'HISTORICAL_DATA_SUFFICIENT' 
      : 'HISTORICAL_DATA_UNAVAILABLE'
  } = input;

  const isUnavailable = currentSnapshot.freshnessStatus === 'UNAVAILABLE';
  const currentPrice = currentSnapshot.price;
  const previousClose = currentSnapshot.previousClose || currentPrice;

  // 1. Calculate Personal and Market Baselines
  let personalChangePct: number | null = null;
  const isFirstVisit = !previousObservation;

  if (!isUnavailable) {
    if (previousObservation && previousObservation.price > 0) {
      personalChangePct = ((currentPrice - previousObservation.price) / previousObservation.price) * 100;
    } else {
      personalChangePct = 0;
    }
  }

  const todayChangePct: number | null = (!isUnavailable && previousClose > 0) 
    ? ((currentPrice - previousClose) / previousClose) * 100 
    : (isUnavailable ? null : 0);

  // 2. Behavioral Baseline (Unusualness) — ONLY computed if history is sufficient!
  let unusualnessFactor: number | null = null;
  let unusualnessScore = 0;

  if (historicalStatus !== 'HISTORICAL_DATA_UNAVAILABLE' && typicalVolatility && typicalVolatility > 0 && !isUnavailable) {
    const baseVolatilityPct = Math.max(typicalVolatility * 100, ATTENTION_CONFIG.MIN_VOLATILITY_PCT);
    // Use personal change if available, fall back to today's change, skip if both null
    const deltaRaw = previousObservation
      ? (personalChangePct !== null ? Math.abs(personalChangePct) : null)
      : (todayChangePct !== null ? Math.abs(todayChangePct) : null);
    if (deltaRaw !== null) {
      unusualnessFactor = deltaRaw / baseVolatilityPct;
      unusualnessScore = Math.min(
        Math.max(unusualnessFactor - 1, 0) * ATTENTION_CONFIG.UNUSUALNESS_WEIGHT,
        ATTENTION_CONFIG.UNUSUALNESS_CAP
      );
    }
  }

  // 3. Volume Anomaly Ratio — ONLY computed if average volume is available!
  let volumeAnomalyRatio: number | null = null;
  let volumeScore = 0;

  if (historicalStatus !== 'HISTORICAL_DATA_UNAVAILABLE' && averageVolume && averageVolume > 0 && currentSnapshot.volume > 0) {
    volumeAnomalyRatio = currentSnapshot.volume / averageVolume;
    volumeScore = Math.min(
      Math.max(volumeAnomalyRatio - 1, 0) * ATTENTION_CONFIG.VOLUME_WEIGHT,
      ATTENTION_CONFIG.VOLUME_CAP
    );
  }

  // 4. Calculate Raw Attention Score (Strictly Attention / Meaningfulness ONLY!)
  // Guard against null (UNAVAILABLE path — no meaningful move score possible)
  const absPersonalMove = personalChangePct !== null ? Math.abs(personalChangePct) : 0;
  const personalMoveScore = isUnavailable
    ? 0  // No meaningful score for unavailable data
    : isFirstVisit 
      ? Math.min((todayChangePct !== null ? Math.abs(todayChangePct) : 0) * 6, 25)
      : Math.min(absPersonalMove * ATTENTION_CONFIG.PERSONAL_MOVE_WEIGHT, ATTENTION_CONFIG.PERSONAL_MOVE_CAP);

  // Raw combined score clamped between 0 and 100
  const rawScore = personalMoveScore + unusualnessScore + volumeScore;
  const attentionScore = Math.min(Math.max(Math.round(rawScore), 0), 100);

  // 5. Determine Severity Bucket
  let severity: SeverityBucket = 'NORMAL';
  if (attentionScore >= 81) {
    severity = 'HIGH_ATTENTION';
  } else if (attentionScore >= 61) {
    severity = 'SIGNIFICANT';
  } else if (attentionScore >= 31) {
    severity = 'WORTH_A_LOOK';
  } else {
    severity = 'NORMAL';
  }

  // 6. Data Quality & Confidence Assessment (Independent from Attention Score!)
  const now = new Date();
  const providerTime = new Date(currentSnapshot.providerTimestamp);
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - providerTime.getTime()) / 1000));

  let freshnessStatus: FreshnessStatus = currentSnapshot.freshnessStatus || 'FRESH';
  let confidence: ConfidenceLevel = 'HIGH';
  let qualityMessage = 'Data is fresh';

  if (currentSnapshot.freshnessStatus === 'UNAVAILABLE') {
    freshnessStatus = 'UNAVAILABLE';
    confidence = 'LOW';
    qualityMessage = 'Market data is temporarily unavailable';
  } else if (ageSeconds > ATTENTION_CONFIG.DELAYED_MAX_SEC) {
    freshnessStatus = 'STALE';
    confidence = 'LOW';
    qualityMessage = `Showing last known state (${Math.floor(ageSeconds / 60)} minutes old)`;
  } else if (ageSeconds > ATTENTION_CONFIG.FRESH_MAX_SEC) {
    freshnessStatus = 'DELAYED';
    confidence = 'MEDIUM';
    qualityMessage = `Data delayed (${Math.floor(ageSeconds / 60)}m ago)`;
  } else {
    qualityMessage = `Updated ${ageSeconds}s ago`;
  }

  const dataQuality: DataQuality = {
    status: freshnessStatus,
    provider: currentSnapshot.provider,
    providerTimestamp: currentSnapshot.providerTimestamp,
    receivedAt: currentSnapshot.receivedAt,
    ageSeconds,
    confidence,
    message: qualityMessage,
  };

  // 7. Explainable Reasons Generator
  const reasons: ReasonItem[] = [];

  if (isFirstVisit) {
    reasons.push({
      code: 'FIRST_VISIT',
      text: `Initial baseline established at ₹${currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Future visits will calculate change against this point.`,
    });
  } else {
    if (personalChangePct !== null && absPersonalMove >= 0.3) {
      const sign = personalChangePct >= 0 ? '+' : '';
      reasons.push({
        code: 'PERSONAL_MOVE',
        text: `Moved ${sign}${personalChangePct.toFixed(2)}% since your last check`,
        value: Number(personalChangePct.toFixed(2)),
      });
    }

    if (unusualnessFactor !== null && unusualnessFactor >= 1.8) {
      reasons.push({
        code: 'UNUSUAL_MOVE',
        text: `Movement is ${unusualnessFactor.toFixed(1)}× larger than its typical daily range`,
        value: Number(unusualnessFactor.toFixed(1)),
      });
    } else if (historicalStatus === 'HISTORICAL_DATA_UNAVAILABLE') {
      reasons.push({
        code: 'HISTORY_UNAVAILABLE',
        text: 'Historical volatility baseline is unavailable for this security',
      });
    }

    if (volumeAnomalyRatio !== null && volumeAnomalyRatio >= 1.8) {
      reasons.push({
        code: 'VOLUME_ANOMALY',
        text: `Trading volume is ${volumeAnomalyRatio.toFixed(1)}× recent baseline`,
        value: Number(volumeAnomalyRatio.toFixed(1)),
      });
    }

    if (
      todayChangePct !== null &&
      Math.abs(todayChangePct) >= 1.8 &&
      (personalChangePct === null || Math.abs(todayChangePct - personalChangePct) > 1.0)
    ) {
      const sign = todayChangePct >= 0 ? '+' : '';
      reasons.push({
        code: 'TODAY_CONTEXT',
        text: `Today's intraday move is ${sign}${todayChangePct.toFixed(2)}%`,
        value: Number(todayChangePct.toFixed(2)),
      });
    }

    if (confidence === 'LOW') {
      reasons.push({
        code: 'STALE_WARNING',
        text: `Data confidence is LOW (${dataQuality.message})`,
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        code: 'NORMAL_STABILITY',
        text: 'Price remains stable within expected volatility boundaries',
      });
    }
  }

  return {
    score: attentionScore,
    severity,
    confidence,
    historicalStatus,
    personalChangePct: personalChangePct !== null ? Number(personalChangePct.toFixed(2)) : null,
    todayChangePct: todayChangePct !== null ? Number(todayChangePct.toFixed(2)) : null,
    unusualnessFactor: unusualnessFactor !== null ? Number(unusualnessFactor.toFixed(1)) : null,
    volumeAnomalyRatio: volumeAnomalyRatio !== null ? Number(volumeAnomalyRatio.toFixed(1)) : null,
    reasons,
    dataQuality,
  };
}

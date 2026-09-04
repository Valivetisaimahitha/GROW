import { PrismaClient } from '@prisma/client';
import { calculateAttention } from './attentionEngine';
import { DEFAULT_SECURITIES, MarketDataProvider } from './marketDataProvider';
import { ChangeEventDomain, UserObservation, MarketSnapshot, DashboardPayload } from './types';

// ─── Divergence Demo Constants ────────────────────────────────────────────────
// Canonical, deterministic baselines for the Personal Baseline Divergence demo.
// These NEVER come from the database; they are always seeded explicitly.
export const DIVERGENCE_DEMO_USER_A_ID = 'test_user_divergence_A';
export const DIVERGENCE_DEMO_USER_B_ID = 'test_user_divergence_B';
export const DIVERGENCE_DEMO_USER_A_BASELINE = 1500.00; // Infrequent: last saw ₹1,500
export const DIVERGENCE_DEMO_USER_B_BASELINE = 1545.00; // Frequent:  last saw ₹1,545
export const DIVERGENCE_DEMO_INFY_CURRENT_PRICE = 1560.00; // Current market price

export interface DivergenceUserResult {
  userId: string;
  previousObservationPrice: number;
  currentPrice: number;
  personalChangePct: number;
  attentionScore: number;
  severity: string;
  infy: ChangeEventDomain;
}

export interface DivergenceSimulationResult {
  userA: DivergenceUserResult;
  userB: DivergenceUserResult;
  currentPrice: number;
}

/**
 * Manages the User Observation Baseline Lifecycle and Idempotent Change Generation
 */
export class ObservationManager {
  private prisma: PrismaClient;
  private provider: MarketDataProvider;

  constructor(prisma: PrismaClient, provider: MarketDataProvider) {
    this.prisma = prisma;
    this.provider = provider;
  }

  /**
   * PERSONAL BASELINE DIVERGENCE DEMO
   *
   * Produces a fully deterministic divergence demonstration using canonical baselines.
   *
   * Algorithm:
   *  1. Upsert User A and User B records in the DB
   *  2. DELETE all prior INFY UserObservation records for both demo users (idempotent reset)
   *  3. SEED exactly ONE UserObservation per user with the canonical baseline price
   *  4. Build the current INFY MarketSnapshot (₹1,560) in-memory — no DB dependency
   *  5. Run AttentionEngine in PURE-COMPUTE mode for each user
   *  6. Return { userA, userB } — does NOT write any new UserObservations
   *     (preserves seeded baseline so repeated runs stay deterministic)
   */
  public async runDivergenceSimulation(): Promise<DivergenceSimulationResult> {
    const secMeta = DEFAULT_SECURITIES.find(s => s.symbol === 'INFY')!;
    const now = new Date();

    // 1. Ensure both demo users exist (safe regardless of prior email state)
    for (const uid of [DIVERGENCE_DEMO_USER_A_ID, DIVERGENCE_DEMO_USER_B_ID]) {
      const existing = await this.prisma.user.findUnique({ where: { id: uid } });
      if (!existing) {
        await this.prisma.user.create({
          data: {
            id: uid,
            name: uid === DIVERGENCE_DEMO_USER_A_ID ? 'User A (Infrequent Visitor)' : 'User B (Frequent Visitor)',
            email: `${uid}@pulsewatch.local`,
          },
        });
      }
    }

    // 2. Delete all prior INFY observations for both demo users (idempotent reset)
    await this.prisma.$transaction([
      this.prisma.userObservation.deleteMany({
        where: { userId: DIVERGENCE_DEMO_USER_A_ID, symbol: 'INFY' },
      }),
      this.prisma.userObservation.deleteMany({
        where: { userId: DIVERGENCE_DEMO_USER_B_ID, symbol: 'INFY' },
      }),
    ]);

    // 3. Seed canonical baselines with appropriate backdated timestamps
    //    User A: infrequent visitor — last checked 3 days ago
    //    User B: frequent visitor  — last checked 1 hour ago
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [seedA, seedB] = await this.prisma.$transaction([
      this.prisma.userObservation.create({
        data: {
          userId: DIVERGENCE_DEMO_USER_A_ID,
          symbol: 'INFY',
          price: DIVERGENCE_DEMO_USER_A_BASELINE,
          volume: secMeta.avgVol,
          marketTimestamp: threeDaysAgo,
          observedAt: threeDaysAgo,
        },
      }),
      this.prisma.userObservation.create({
        data: {
          userId: DIVERGENCE_DEMO_USER_B_ID,
          symbol: 'INFY',
          price: DIVERGENCE_DEMO_USER_B_BASELINE,
          volume: secMeta.avgVol,
          marketTimestamp: oneHourAgo,
          observedAt: oneHourAgo,
        },
      }),
    ]);

    // 4. Build the current INFY snapshot entirely in-memory — no DB read needed
    const currentSnapshot: MarketSnapshot = {
      symbol: 'INFY',
      price: DIVERGENCE_DEMO_INFY_CURRENT_PRICE,
      previousClose: 1500.00,
      openPrice: 1505.00,
      highPrice: 1565.00,
      lowPrice: 1498.00,
      volume: Math.round(secMeta.avgVol * 2.6),
      provider: 'demo',
      providerTimestamp: now.toISOString(),
      receivedAt: now.toISOString(),
      freshnessStatus: 'FRESH',
    };

    // 5. Pure-compute helper: run AttentionEngine against a seeded baseline
    const buildUserResult = (userId: string, seed: typeof seedA): DivergenceUserResult => {
      const prevObs: UserObservation = {
        id: seed.id,
        userId: seed.userId,
        symbol: seed.symbol,
        price: seed.price,
        volume: seed.volume,
        marketTimestamp: seed.marketTimestamp.toISOString(),
        observedAt: seed.observedAt.toISOString(),
      };

      const attentionResult = calculateAttention({
        previousObservation: prevObs,
        currentSnapshot,
        typicalVolatility: secMeta.volatility,
        averageVolume: secMeta.avgVol,
        historicalStatus: secMeta.historicalStatus,
        marketStatus: 'OPEN',
      });

      const infy: ChangeEventDomain = {
        userId,
        symbol: 'INFY',
        companyName: secMeta.companyName,
        currentPrice: currentSnapshot.price,
        previousObservationId: prevObs.id,
        previousObservationPrice: prevObs.price,
        personalChangePct: attentionResult.personalChangePct,
        todayChangePct: attentionResult.todayChangePct,
        unusualnessFactor: attentionResult.unusualnessFactor,
        volumeAnomalyRatio: attentionResult.volumeAnomalyRatio,
        historicalStatus: attentionResult.historicalStatus,
        attentionScore: attentionResult.score,
        severity: attentionResult.severity,
        confidence: attentionResult.confidence,
        reasons: attentionResult.reasons,
        dataQuality: attentionResult.dataQuality,
        isFirstVisit: false,
        createdAt: now.toISOString(),
      };

      return {
        userId,
        previousObservationPrice: prevObs.price,
        currentPrice: DIVERGENCE_DEMO_INFY_CURRENT_PRICE,
        // personalChangePct is non-null here: both users have valid prior observations
        // and the current snapshot is FRESH (not UNAVAILABLE)
        personalChangePct: attentionResult.personalChangePct!,
        attentionScore: attentionResult.score,
        severity: attentionResult.severity,
        infy,
      };
    };

    // 6. Compute and return — NO new UserObservation writes
    return {
      userA: buildUserResult(DIVERGENCE_DEMO_USER_A_ID, seedA),
      userB: buildUserResult(DIVERGENCE_DEMO_USER_B_ID, seedB),
      currentPrice: DIVERGENCE_DEMO_INFY_CURRENT_PRICE,
    };
  }

  /**
   * Process user dashboard inspection following strict baseline sequencing:
   * 1. READ PREVIOUS USER OBSERVATIONS
   * 2. READ CURRENT MARKET SNAPSHOTS
   * 3. COMPARE & EVALUATE ATTENTION / CONFIDENCE
   * 4. GENERATE CHANGE EVENTS
   * 5. FORMULATE RESPONSE
   * 6. RECORD NEW USER OBSERVATIONS & CHANGE EVENTS (AFTER COMPUTATION)
   */
  public async processUserDashboard(userId: string, watchlistId?: string): Promise<DashboardPayload> {
    // 1. Resolve User & Target Watchlist
    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userId,
          name: 'Demo Investor',
          email: `${userId}@pulsewatch.local`,
        },
      });
    }

    let targetWatchlist = watchlistId 
      ? await this.prisma.watchlist.findUnique({ where: { id: watchlistId }, include: { items: true } })
      : await this.prisma.watchlist.findFirst({ where: { userId, isDefault: true }, include: { items: true } });

    if (!targetWatchlist && !watchlistId) {
      // Look for ANY watchlist owned by user (isDefault true first, then oldest)
      targetWatchlist = await this.prisma.watchlist.findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: { items: true },
      });
    }

    if (!targetWatchlist) {
      try {
        targetWatchlist = await this.prisma.watchlist.create({
          data: {
            userId,
            name: 'My Watchlist',
            isDefault: true,
            items: {
              create: [
                { symbol: 'INFY', displayName: 'Infosys Limited', sortOrder: 1 },
                { symbol: 'RELIANCE', displayName: 'Reliance Industries Ltd', sortOrder: 2 },
                { symbol: 'TCS', displayName: 'Tata Consultancy Services', sortOrder: 3 },
                { symbol: 'HDFCBANK', displayName: 'HDFC Bank Limited', sortOrder: 4 },
                { symbol: 'ICICIBANK', displayName: 'ICICI Bank Limited', sortOrder: 5 },
                { symbol: 'TATAMOTORS', displayName: 'Tata Motors Limited', sortOrder: 6 },
                { symbol: 'WIPRO', displayName: 'Wipro Limited', sortOrder: 7 },
                { symbol: 'ITC', displayName: 'ITC Limited', sortOrder: 8 },
              ],
            },
          },
          include: { items: true },
        });
      } catch (err) {
        // Handle concurrent creation race condition safely
        targetWatchlist = await this.prisma.watchlist.findFirst({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: { items: true },
        });
        if (!targetWatchlist) {
          throw err;
        }
      }
    }

    const trackedSymbols = targetWatchlist.items.map(item => item.symbol);
    const lastCheckedAt = user.lastCheckedAt.toISOString();

    if (trackedSymbols.length === 0) {
      return {
        userId,
        lastCheckedAt,
        isFirstVisit: false,
        marketStatus: await this.provider.getMarketStatus(),
        summary: { tracked: 0, changed: 0, meaningful: 0, lowerSignal: 0 },
        meaningfulChanges: [],
        lowerSignalChanges: [],
        dataQualitySummary: { total: 0, fresh: 0, delayed: 0, stale: 0, unavailable: 0 },
      };
    }

    // 2. READ PREVIOUS USER OBSERVATIONS (Most recent per symbol for this user)
    const prevObsMap: Record<string, UserObservation> = {};
    for (const symbol of trackedSymbols) {
      const dbObs = await this.prisma.userObservation.findFirst({
        where: { userId, symbol },
        orderBy: { observedAt: 'desc' },
      });
      if (dbObs) {
        prevObsMap[symbol] = {
          id: dbObs.id,
          userId: dbObs.userId,
          symbol: dbObs.symbol,
          price: dbObs.price,
          volume: dbObs.volume,
          marketTimestamp: dbObs.marketTimestamp.toISOString(),
          observedAt: dbObs.observedAt.toISOString(),
        };
      }
    }

    const isFirstVisitOverall = Object.keys(prevObsMap).length === 0;

    // 3. READ CURRENT MARKET SNAPSHOTS
    const currentSnapshots = await this.provider.getQuotes(trackedSymbols);
    const marketStatus = await this.provider.getMarketStatus();

    const qualityCounts = { total: trackedSymbols.length, fresh: 0, delayed: 0, stale: 0, unavailable: 0 };
    const changeEvents: ChangeEventDomain[] = [];

    // 4. COMPARE & CALCULATE ATTENTION
    for (const symbol of trackedSymbols) {
      const snapshot = currentSnapshots[symbol] || {
        symbol,
        price: 0,
        previousClose: 0,
        openPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        provider: 'demo',
        providerTimestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        freshnessStatus: 'UNAVAILABLE' as const,
      };

      if (snapshot.freshnessStatus === 'FRESH') qualityCounts.fresh++;
      else if (snapshot.freshnessStatus === 'DELAYED') qualityCounts.delayed++;
      else if (snapshot.freshnessStatus === 'STALE') qualityCounts.stale++;
      else qualityCounts.unavailable++;

      const secMeta = DEFAULT_SECURITIES.find(s => s.symbol === symbol);
      const prevObs = prevObsMap[symbol] || null;

      const attentionResult = calculateAttention({
        previousObservation: prevObs,
        currentSnapshot: snapshot,
        typicalVolatility: secMeta?.volatility,
        averageVolume: secMeta?.avgVol,
        historicalStatus: secMeta?.historicalStatus,
        marketStatus,
      });

      // Construct Idempotency Key (userId:symbol:prevObsId:price:providerTimestamp)
      const idempotencyKey = `${userId}:${symbol}:${prevObs?.id || 'first'}:${snapshot.price}:${snapshot.providerTimestamp}`;

      const changeEvent: ChangeEventDomain = {
        userId,
        symbol,
        companyName: secMeta?.companyName || `${symbol} Ltd`,
        currentPrice: snapshot.freshnessStatus === 'UNAVAILABLE' ? null : snapshot.price,
        previousObservationId: prevObs?.id || null,
        previousObservationPrice: prevObs?.price || null,
        idempotencyKey,
        personalChangePct: attentionResult.personalChangePct,
        todayChangePct: attentionResult.todayChangePct,
        unusualnessFactor: attentionResult.unusualnessFactor,
        volumeAnomalyRatio: attentionResult.volumeAnomalyRatio,
        historicalStatus: attentionResult.historicalStatus,
        attentionScore: attentionResult.score,
        severity: attentionResult.severity,
        confidence: attentionResult.confidence,
        reasons: attentionResult.reasons,
        dataQuality: attentionResult.dataQuality,
        isFirstVisit: !prevObs,
        createdAt: snapshot.providerTimestamp,
      };

      changeEvents.push(changeEvent);
    }

    // 5. ATTENTION BUDGET FILTERING
    changeEvents.sort((a, b) => b.attentionScore - a.attentionScore);

    const MAX_PRIMARY_CHANGES = 5;
    const meaningfulChanges: ChangeEventDomain[] = [];
    const lowerSignalChanges: ChangeEventDomain[] = [];

    for (const evt of changeEvents) {
      if (meaningfulChanges.length < MAX_PRIMARY_CHANGES) {
        if (evt.severity === 'HIGH_ATTENTION' || evt.severity === 'SIGNIFICANT') {
          meaningfulChanges.push(evt);
        } else if (evt.severity === 'WORTH_A_LOOK') {
          meaningfulChanges.push(evt);
        } else {
          lowerSignalChanges.push(evt);
        }
      } else {
        lowerSignalChanges.push(evt);
      }
    }

    // 6. RECORD NEW OBSERVATIONS & PERSIST CHANGE JOURNAL **AFTER** COMPUTATION
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Pass 1: Persist MarketSnapshots and UserObservations, collect snapshotId per symbol
      const snapshotIdMap: Record<string, string> = {};

      for (const symbol of trackedSymbols) {
        const snapshot = currentSnapshots[symbol];
        if (snapshot && snapshot.freshnessStatus !== 'UNAVAILABLE') {
          // Persist MarketSnapshot reference
          const dbSnapshot = await tx.marketSnapshot.create({
            data: {
              symbol,
              price: snapshot.price,
              previousClose: snapshot.previousClose,
              openPrice: snapshot.openPrice,
              highPrice: snapshot.highPrice,
              lowPrice: snapshot.lowPrice,
              volume: snapshot.volume,
              provider: snapshot.provider,
              providerTimestamp: new Date(snapshot.providerTimestamp),
              receivedAt: new Date(snapshot.receivedAt),
              freshnessStatus: snapshot.freshnessStatus,
            },
          });

          // Record snapshot DB ID for use when creating ChangeEvent
          snapshotIdMap[symbol] = dbSnapshot.id;

          // Persist UserObservation for user's personal memory
          await tx.userObservation.create({
            data: {
              userId,
              symbol,
              marketSnapshotId: dbSnapshot.id,
              price: snapshot.price,
              volume: snapshot.volume,
              marketTimestamp: new Date(snapshot.providerTimestamp),
              observedAt: now,
            },
          });
        }
      }

      // Pass 2: Record ChangeEvents WITH IDEMPOTENCY PROTECTION and correct currentSnapshotId
      for (const evt of changeEvents) {
        if (evt.attentionScore > 20 && evt.idempotencyKey) {
          const existingEvent = await tx.changeEvent.findUnique({
            where: { idempotencyKey: evt.idempotencyKey },
          });

          if (!existingEvent) {
            await tx.changeEvent.create({
              data: {
                userId,
                symbol: evt.symbol,
                previousObservationId: evt.previousObservationId || null,
                // Correctly populate currentSnapshotId from the snapshot persisted in Pass 1
                currentSnapshotId: snapshotIdMap[evt.symbol] || null,
                idempotencyKey: evt.idempotencyKey,
                personalChangePct: evt.personalChangePct ?? 0,
                todayChangePct: evt.todayChangePct ?? 0,
                unusualnessFactor: evt.unusualnessFactor,
                volumeAnomalyRatio: evt.volumeAnomalyRatio,
                historicalStatus: evt.historicalStatus,
                attentionScore: evt.attentionScore,
                severity: evt.severity,
                confidence: evt.confidence,
                reasonsJson: JSON.stringify(evt.reasons),
                createdAt: new Date(evt.createdAt),
              },
            });
          }
        }
      }

      // Update user lastCheckedAt timestamp to latest successful user-facing observation
      await tx.user.update({
        where: { id: userId },
        data: { lastCheckedAt: now },
      });
    });

    const changedCount = meaningfulChanges.length + lowerSignalChanges.length;

    return {
      userId,
      lastCheckedAt: now.toISOString(),
      isFirstVisit: isFirstVisitOverall,
      marketStatus,
      summary: {
        tracked: trackedSymbols.length,
        changed: changedCount,
        meaningful: meaningfulChanges.length,
        lowerSignal: lowerSignalChanges.length,
      },
      meaningfulChanges,
      lowerSignalChanges,
      dataQualitySummary: qualityCounts,
    };
  }
}

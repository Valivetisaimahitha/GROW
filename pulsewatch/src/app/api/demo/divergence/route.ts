import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DemoProvider } from '@/lib/domain/marketDataProvider';
import { ObservationManager } from '@/lib/domain/observationManager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/demo/divergence
 *
 * Runs the Personal Baseline Divergence simulation.
 * This endpoint:
 *  1. Seeds canonical UserObservation baselines (User A=₹1500, User B=₹1545)
 *  2. Runs the AttentionEngine in pure-compute mode for both users
 *  3. Returns a unified { userA, userB, currentPrice } payload
 *
 * The result is the single source of truth for both the modal cards
 * AND the Judge Verification Proof — they always agree.
 *
 * Repeatable: running this endpoint N times always produces identical results.
 */
export async function GET(req: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      { error: { code: 'DEMO_MODE_DISABLED', message: 'Demo endpoints disabled in production' } },
      { status: 403 }
    );
  }

  try {
    // Use a PERSONAL_BASELINE_DIVERGENCE provider (market status OPEN, standard prices)
    // The divergence simulation builds its own in-memory snapshot — provider is unused for INFY
    const provider = new DemoProvider('PERSONAL_BASELINE_DIVERGENCE');
    const obsManager = new ObservationManager(prisma, provider);

    const result = await obsManager.runDivergenceSimulation();

    return NextResponse.json({
      success: true,
      data: {
        currentPrice: result.currentPrice,
        userA: {
          previousObservationPrice: result.userA.previousObservationPrice,
          currentPrice: result.userA.currentPrice,
          personalChangePct: result.userA.personalChangePct,
          attentionScore: result.userA.attentionScore,
          severity: result.userA.severity,
          infy: result.userA.infy,
        },
        userB: {
          previousObservationPrice: result.userB.previousObservationPrice,
          currentPrice: result.userB.currentPrice,
          personalChangePct: result.userB.personalChangePct,
          attentionScore: result.userB.attentionScore,
          severity: result.userB.severity,
          infy: result.userB.infy,
        },
      },
    });
  } catch (error: any) {
    console.error('[/api/demo/divergence] Error:', error);
    return NextResponse.json(
      { error: { code: 'DIVERGENCE_FAILED', message: error.message || 'Divergence simulation failed' } },
      { status: 500 }
    );
  }
}

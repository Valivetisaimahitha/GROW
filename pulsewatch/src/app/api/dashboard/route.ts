import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DemoProvider } from '@/lib/domain/marketDataProvider';
import { ObservationManager } from '@/lib/domain/observationManager';
import { DemoScenarioManager } from '@/lib/domain/demoScenarioManager';
import { getAuthenticatedUser, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const watchlistId = searchParams.get('watchlistId') || undefined;

    if (watchlistId) {
      const { verifyWatchlistOwnership } = await import('@/lib/auth');
      await verifyWatchlistOwnership(watchlistId, user.id);
    }

    // Load scenario state
    const demoManager = new DemoScenarioManager(prisma);
    const { scenario, timeShiftMinutes } = await demoManager.getScenarioState();

    const provider = new DemoProvider(scenario, timeShiftMinutes);
    const obsManager = new ObservationManager(prisma, provider);

    // Execute dashboard evaluation with strict baseline sequencing for authenticated user
    const payload = await obsManager.processUserDashboard(user.id, watchlistId);

    return NextResponse.json({
      success: true,
      demoScenario: scenario,
      timeShiftMinutes,
      data: payload,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate dashboard' } },
      { status: 500 }
    );
  }
}

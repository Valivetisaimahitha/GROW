import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, AuthError } from '@/lib/auth';

// GET /api/changes?severity=&symbol=
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity');
    const symbol = searchParams.get('symbol');

    const whereClause: any = { userId: user.id };
    if (severity && severity !== 'ALL') whereClause.severity = severity;
    if (symbol) whereClause.symbol = symbol;

    const dbEvents = await prisma.changeEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const parsedEvents = dbEvents.map(evt => ({
      id: evt.id,
      userId: evt.userId,
      symbol: evt.symbol,
      previousObservationId: evt.previousObservationId,
      currentSnapshotId: evt.currentSnapshotId,
      personalChangePct: evt.personalChangePct,
      todayChangePct: evt.todayChangePct,
      unusualnessFactor: evt.unusualnessFactor,
      volumeAnomalyRatio: evt.volumeAnomalyRatio,
      historicalStatus: evt.historicalStatus,
      attentionScore: evt.attentionScore,
      severity: evt.severity,
      confidence: evt.confidence,
      reasons: JSON.parse(evt.reasonsJson || '[]'),
      createdAt: evt.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: parsedEvents });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'JOURNAL_FETCH_FAILED', message: 'Failed to retrieve change history' } }, { status: 500 });
  }
}

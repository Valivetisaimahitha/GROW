import { NextRequest, NextResponse } from 'next/server';
import { DemoProvider } from '@/lib/domain/marketDataProvider';

// GET /api/market/history/:symbol?timeframe=1D|1W|1M|3M
export async function GET(req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol.toUpperCase();
    const { searchParams } = new URL(req.url);
    const timeframe = (searchParams.get('timeframe') || '1M') as '1D' | '1W' | '1M' | '3M';

    const provider = new DemoProvider('NORMAL_NOISE');
    const history = await provider.getHistoricalData(symbol, timeframe);

    return NextResponse.json({
      success: true,
      symbol,
      timeframe,
      data: history,
    });
  } catch (error: any) {
    return NextResponse.json({ error: { code: 'HISTORY_FETCH_FAILED', message: error.message } }, { status: 500 });
  }
}

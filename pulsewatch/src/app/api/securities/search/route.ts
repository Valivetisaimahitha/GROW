import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SECURITIES } from '@/lib/domain/marketDataProvider';

// GET /api/securities/search?q=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim().toLowerCase();

  if (!query) {
    return NextResponse.json({ success: true, data: DEFAULT_SECURITIES.slice(0, 5) });
  }

  const results = DEFAULT_SECURITIES.filter(
    s => s.symbol.toLowerCase().includes(query) || s.companyName.toLowerCase().includes(query)
  );

  return NextResponse.json({ success: true, data: results });
}

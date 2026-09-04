import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, verifyWatchlistOwnership, AuthError } from '@/lib/auth';
import { DEFAULT_SECURITIES } from '@/lib/domain/marketDataProvider';

// POST /api/watchlists/:id/items (Add stock)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(req);
    const watchlistId = params.id;

    // Enforce server-side ownership check
    await verifyWatchlistOwnership(watchlistId, user.id);

    const body = await req.json();
    const { symbol } = body;

    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0 || symbol.length > 15) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Valid symbol string is required' } }, { status: 400 });
    }

    const upperSymbol = symbol.toUpperCase().trim();
    const secMeta = DEFAULT_SECURITIES.find(s => s.symbol === upperSymbol);
    const displayName = secMeta ? secMeta.companyName : `${upperSymbol} Ltd`;

    const existing = await prisma.watchlistItem.findUnique({
      where: {
        watchlistId_symbol: {
          watchlistId,
          symbol: upperSymbol,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_ITEM', message: `${upperSymbol} is already in this watchlist` } },
        { status: 409 }
      );
    }

    const count = await prisma.watchlistItem.count({ where: { watchlistId } });

    const newItem = await prisma.watchlistItem.create({
      data: {
        watchlistId,
        symbol: upperSymbol,
        displayName,
        sortOrder: count + 1,
      },
    });

    return NextResponse.json({ success: true, data: newItem });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'ADD_FAILED', message: 'Failed to add security to watchlist' } }, { status: 500 });
  }
}

// DELETE /api/watchlists/:id/items?symbol= (Remove stock)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(req);
    const watchlistId = params.id;

    // Enforce server-side ownership check
    await verifyWatchlistOwnership(watchlistId, user.id);

    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: { code: 'MISSING_SYMBOL', message: 'Symbol is required' } }, { status: 400 });
    }

    await prisma.watchlistItem.deleteMany({
      where: {
        watchlistId,
        symbol: symbol.toUpperCase(),
      },
    });

    return NextResponse.json({ success: true, message: `Removed ${symbol}` });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'DELETE_FAILED', message: 'Failed to remove security' } }, { status: 500 });
  }
}

// PATCH /api/watchlists/:id/items (Persist reordering)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(req);
    const watchlistId = params.id;

    await verifyWatchlistOwnership(watchlistId, user.id);

    const body = await req.json();
    const { items } = body; // Array of { symbol: string, sortOrder: number }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'items array is required' } }, { status: 400 });
    }

    await prisma.$transaction(
      items.map((item: { symbol: string; sortOrder: number }) =>
        prisma.watchlistItem.updateMany({
          where: { watchlistId, symbol: item.symbol },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Watchlist reordered successfully' });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'REORDER_FAILED', message: 'Failed to reorder watchlist items' } }, { status: 500 });
  }
}

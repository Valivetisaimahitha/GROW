import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, AuthError } from '@/lib/auth';

// GET /api/watchlists
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    const watchlists = await prisma.watchlist.findMany({
      where: { userId: user.id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: watchlists });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve watchlists' } }, { status: 500 });
  }
}

// POST /api/watchlists
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Watchlist name must be 1-50 characters' } }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Pre-check existing watchlist with same name for this user
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_name: {
          userId: user.id,
          name: trimmedName,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: { code: 'DUPLICATE_NAME', message: 'A watchlist with this name already exists' } }, { status: 400 });
    }

    const newWatchlist = await prisma.watchlist.create({
      data: {
        userId: user.id,
        name: trimmedName,
        isDefault: false,
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: newWatchlist });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: { code: 'DUPLICATE_NAME', message: 'A watchlist with this name already exists' } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'CREATE_FAILED', message: 'Failed to create watchlist' } }, { status: 500 });
  }
}

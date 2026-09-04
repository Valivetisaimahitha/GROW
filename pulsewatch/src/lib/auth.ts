import { NextRequest } from 'next/server';
import { prisma } from './db';
import { SignJWT, jwtVerify } from 'jose';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const secretKey = process.env.SESSION_SECRET || 'fallback-secret-for-dev-only-change-me';
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const sessionToken = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
    
  return { sessionToken, expiresAt };
}

export async function verifySession(sessionToken: string) {
  try {
    const { payload } = await jwtVerify(sessionToken, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload.userId as string;
  } catch (error) {
    return null;
  }
}

/**
 * Server-side Authentication & Session extraction helper.
 * Never trusts client-supplied query params for resource access.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser> {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const sessionCookie = req.cookies.get('pulsewatch_session')?.value;
  let targetUserId = null;

  if (sessionCookie) {
    targetUserId = await verifySession(sessionCookie);
  }

  if (!targetUserId) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      targetUserId = await verifySession(token);
    }
  }

  // Handle explicitly allowed demo impersonations when in DEMO_MODE
  if (isDemoMode && (!targetUserId)) {
    const headerUserId = req.headers.get('x-pulsewatch-user-id');
    const cookieUserId = req.cookies.get('pulsewatch_user_id')?.value;
    const fallbackId = headerUserId || cookieUserId;
    // Allow fallback for demonstration users ONLY in demo mode
    if (fallbackId && (fallbackId === 'demo_user_default' || fallbackId.startsWith('test_user_divergence') || fallbackId.startsWith('test_user_'))) {
        targetUserId = fallbackId;
    }
  }

  if (!targetUserId) {
    throw new AuthError('Invalid or expired authentication session', 401, 'UNAUTHORIZED');
  }

  let user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    // In demo mode, automatically bootstrap the demo user if missing
    if (isDemoMode && (targetUserId === 'demo_user_default' || targetUserId.startsWith('test_user_'))) {
      user = await prisma.user.upsert({
        where: { email: `${targetUserId}@pulsewatch.local` },
        update: {},
        create: {
          id: targetUserId,
          name: targetUserId === 'demo_user_default' ? 'Demo Investor' : `Demo User ${targetUserId.split('_').pop()}`,
          email: `${targetUserId}@pulsewatch.local`,
        },
      });
    } else {
      throw new AuthError('Invalid or expired authentication session', 401, 'UNAUTHORIZED');
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

/**
 * Server-side Ownership Verification for Watchlists
 */
export async function verifyWatchlistOwnership(watchlistId: string, userId: string): Promise<void> {
  const watchlist = await prisma.watchlist.findUnique({
    where: { id: watchlistId },
  });

  if (!watchlist) {
    throw new AuthError('Watchlist not found', 404, 'NOT_FOUND');
  }

  if (watchlist.userId !== userId) {
    throw new AuthError('Forbidden: You do not own this watchlist', 403, 'FORBIDDEN');
  }
}

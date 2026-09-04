import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getAuthenticatedUser, verifyWatchlistOwnership, AuthError } from '../lib/auth';
import { prisma } from '../lib/db';

vi.mock('../lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    watchlist: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
  }),
}));

describe('Security & Authentication Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getAuthenticatedUser', () => {
    it('1. No auth -> throws 401 UNAUTHORIZED', async () => {
      const req = new NextRequest('http://localhost/api/dashboard');
      process.env.DEMO_MODE = 'false';
      
      await expect(getAuthenticatedUser(req)).rejects.toThrowError(
        new AuthError('Invalid or expired authentication session', 401)
      );
    });

    it('2. Forged x-pulsewatch-user-id header does NOT change authenticated identity in normal mode', async () => {
      const req = new NextRequest('http://localhost/api/dashboard', {
        headers: { 'x-pulsewatch-user-id': 'test_user_divergence_A' }
      });
      process.env.DEMO_MODE = 'false';

      await expect(getAuthenticatedUser(req)).rejects.toThrowError(
        new AuthError('Invalid or expired authentication session', 401)
      );
    });

    it('3. Demo impersonation endpoint fails when DEMO_MODE=false', async () => {
      const req = new NextRequest('http://localhost/api/dashboard', {
        headers: { 'x-pulsewatch-user-id': 'demo_user_default' }
      });
      process.env.DEMO_MODE = 'false';

      await expect(getAuthenticatedUser(req)).rejects.toThrowError(
        new AuthError('Invalid or expired authentication session', 401)
      );
    });
  });

  describe('Watchlist Ownership', () => {
    it('4. User A reads User B watchlist -> throws 403 FORBIDDEN', async () => {
      (prisma.watchlist.findUnique as any).mockResolvedValue({
        id: 'watchlist_B',
        userId: 'user_B'
      });

      await expect(verifyWatchlistOwnership('watchlist_B', 'user_A')).rejects.toThrowError(
        new AuthError('Forbidden: You do not own this watchlist', 403)
      );
    });

    it('5. Invalid watchlist ID -> throws 404 NOT_FOUND', async () => {
      (prisma.watchlist.findUnique as any).mockResolvedValue(null);

      await expect(verifyWatchlistOwnership('invalid_id', 'user_A')).rejects.toThrowError(
        new AuthError('Watchlist not found', 404)
      );
    });

    it('6. Successful ownership verification does not throw', async () => {
      (prisma.watchlist.findUnique as any).mockResolvedValue({
        id: 'watchlist_A',
        userId: 'user_A'
      });

      await expect(verifyWatchlistOwnership('watchlist_A', 'user_A')).resolves.toBeUndefined();
    });
  });
});

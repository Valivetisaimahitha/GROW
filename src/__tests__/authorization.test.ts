import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { verifyWatchlistOwnership, AuthError } from '../lib/auth';

describe('Server-Side Authorization & Resource Ownership Tests', () => {
  const prisma = new PrismaClient();
  const userA = 'auth_user_A';
  const userB = 'auth_user_B';

  beforeEach(async () => {
    await prisma.watchlist.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });

    await prisma.user.createMany({
      data: [
        { id: userA, name: 'User A', email: 'userA_auth@pulsewatch.local' },
        { id: userB, name: 'User B', email: 'userB_auth@pulsewatch.local' },
      ],
    });
  });

  it('1. Ownership check passes when accessing user-owned watchlist', async () => {
    const wl = await prisma.watchlist.create({
      data: { userId: userA, name: "User A's List", isDefault: false },
    });

    await expect(verifyWatchlistOwnership(wl.id, userA)).resolves.not.toThrow();
  });

  it('2. Ownership check throws 403 FORBIDDEN when user B attempts to access user A watchlist', async () => {
    const wl = await prisma.watchlist.create({
      data: { userId: userA, name: "User A's List", isDefault: false },
    });

    await expect(verifyWatchlistOwnership(wl.id, userB)).rejects.toThrowError(
      new AuthError('Forbidden: You do not own this watchlist', 403, 'FORBIDDEN')
    );
  });

  it('3. Ownership check throws 404 NOT_FOUND for non-existent watchlist ID', async () => {
    await expect(verifyWatchlistOwnership('invalid_id_999', userA)).rejects.toThrowError(
      new AuthError('Watchlist not found', 404, 'NOT_FOUND')
    );
  });
});

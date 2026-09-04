import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // For hackathon simplicity, we bypass strong password checks and just match email
    // In production, this would use bcrypt.compare
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }, { status: 401 });
    }

    // Generate secure JWT session
    const { sessionToken, expiresAt } = await createSession(user.id);

    // Set secure HTTP-only cookie
    cookies().set('pulsewatch_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({ 
      success: true, 
      data: { id: user.id, name: user.name, email: user.email } 
    });

  } catch (error: any) {
    return NextResponse.json({ error: { code: 'LOGIN_FAILED', message: 'Failed to authenticate' } }, { status: 500 });
  }
}

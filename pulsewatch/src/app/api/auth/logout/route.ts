import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  // Clear the session cookie by setting it with immediate expiry
  cookies().set('pulsewatch_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}

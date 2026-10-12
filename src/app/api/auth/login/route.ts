import { NextResponse } from 'next/server';
import { personById } from '@/config/people';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth/session';

// Temporary sign-in: pick your name + the shared access code. Replace with CWU / Google sign-in later.
export async function POST(req: Request) {
  const { personId, accessCode } = await req.json().catch(() => ({}));
  const person = personById(personId);
  if (!person) return NextResponse.json({ error: 'Pick your name' }, { status: 400 });

  const expected = process.env.HUB_ACCESS_CODE;
  if (!expected && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Sign-in is not set up yet (HUB_ACCESS_CODE).' }, { status: 503 });
  }
  if (expected && accessCode !== expected) return NextResponse.json({ error: 'Wrong access code' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(person.id), sessionCookieOptions);
  return res;
}

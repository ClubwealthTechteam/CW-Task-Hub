import { NextResponse } from 'next/server';
import { personById } from '@/config/people';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth/session';
import { checkAccessCode, clearFailures, lockedUntil, recordFailure } from '@/lib/auth/access-codes';

// Temporary sign-in: pick your name + your own access code. Replace with CWU / Google sign-in later.
export async function POST(req: Request) {
  const { personId, accessCode } = await req.json().catch(() => ({}));
  const person = personById(personId);
  if (!person) return NextResponse.json({ error: 'Pick your name' }, { status: 400 });

  const until = await lockedUntil(person.id);
  if (until) {
    const mins = Math.ceil((until - Date.now()) / 60000);
    return NextResponse.json({ error: `Too many wrong codes. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` }, { status: 429 });
  }

  const result = checkAccessCode(person.id, accessCode);
  if (result === 'not_set_up') return NextResponse.json({ error: 'Sign-in is not set up yet.' }, { status: 503 });
  if (result === 'no_code') return NextResponse.json({ error: 'You don’t have an access code yet. Ask Miguel for yours.' }, { status: 403 });
  if (result === 'wrong') {
    await recordFailure(person.id);
    return NextResponse.json({ error: 'Wrong access code' }, { status: 401 });
  }

  await clearFailures(person.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(person.id), sessionCookieOptions);
  return res;
}

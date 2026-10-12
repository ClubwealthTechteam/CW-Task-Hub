import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canLookUpKeap } from '@/lib/integrations/keap/access';
import { keapMessage, searchContacts } from '@/lib/integrations/keap/contacts';
import { KeapError } from '@/lib/integrations/keap/client';

export const dynamic = 'force-dynamic';

/** GET ?q=name or email → up to 10 matching Keap contacts. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canLookUpKeap(user)) return NextResponse.json({ error: 'None of your tasks use Keap' }, { status: 403 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ contacts: [] });
  try {
    return NextResponse.json({ contacts: await searchContacts(q) });
  } catch (e) {
    const err = e as KeapError;
    return NextResponse.json({ error: keapMessage(err) }, { status: err.status && err.status < 500 ? 502 : 503 });
  }
}


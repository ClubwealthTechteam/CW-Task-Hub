// The hub's own notes on a member for referrals: the services they offer (helps matching) and whether
// they're paused (not sent referrals). Keap isn't changed.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome as canUseReferrals } from '@/lib/welcome/access';
import { memberNotes, saveMemberNotes } from '@/lib/referrals/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseReferrals(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const notes = await memberNotes();
  notes[id] = { ...notes[id], ...(b.services !== undefined ? { services: String(b.services).slice(0, 200) } : {}), ...(b.paused !== undefined ? { paused: Boolean(b.paused) } : {}) };
  await saveMemberNotes(notes);
  return NextResponse.json({ note: notes[id] });
}

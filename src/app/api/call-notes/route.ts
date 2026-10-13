// Client Care call notes: list, add a call, undo one. Stored in the hub only (Keap is never written).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { addEntry, canUseCallNotes, listClients, removeEntry } from '@/lib/calls/store';
import { CALL_TYPES, outcomeOf, type CallType } from '@/lib/calls/notes';

export const dynamic = 'force-dynamic';

async function who() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canUseCallNotes(user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user };
}

export async function GET() {
  const { error } = await who();
  if (error) return error;
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(req: Request) {
  const { user, error } = await who();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 120);
  const type = String(b.type ?? '') as CallType;
  const outcome = outcomeOf(type, String(b.outcome ?? ''));
  const details = String(b.details ?? '').trim().slice(0, 300);
  if (!name) return NextResponse.json({ error: 'Add the client’s name' }, { status: 400 });
  if (!CALL_TYPES.some((t) => t.id === type) || !outcome) return NextResponse.json({ error: 'Pick the call outcome' }, { status: 400 });
  if (outcome.needs && !details) return NextResponse.json({ error: `Add: ${outcome.needs}` }, { status: 400 });
  const client = await addEntry(name, { at: Date.now(), type, outcome: outcome.id, details: details || undefined, by: user!.id });
  return NextResponse.json({ client });
}

export async function DELETE(req: Request) {
  const { error } = await who();
  if (error) return error;
  const q = new URL(req.url).searchParams;
  const client = await removeEntry(String(q.get('client') ?? ''), Number(q.get('at')));
  return NextResponse.json({ client });
}

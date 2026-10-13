// Lets the council's Accuracy Checker look up a client in Keap (read-only) to verify facts.

import { NextResponse } from 'next/server';
import { validRun } from '@/lib/council/store';
import { contactWithTags, searchContacts } from '@/lib/integrations/keap/contacts';
import { keapConfigured } from '@/lib/integrations/keap/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!(await validRun(q.get('run') ?? '', q.get('token') ?? ''))) return NextResponse.json({ error: 'Invalid or expired run token' }, { status: 403 });
  if (!keapConfigured()) return NextResponse.json({ error: 'Keap isn’t connected' }, { status: 503 });
  const term = String(q.get('q') ?? '').trim().slice(0, 80);
  if (!term) return NextResponse.json({ error: 'Give an email or a name' }, { status: 400 });
  try {
    const found = await searchContacts(term);
    return NextResponse.json({ contacts: await Promise.all(found.slice(0, 3).map((c) => contactWithTags(c.id).catch(() => c))) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

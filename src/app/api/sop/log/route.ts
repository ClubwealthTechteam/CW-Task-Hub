// SOP Handbook: add a row to an article's POC log (date, article, what was done, anything unusual).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sopById } from '@/data/sop';
import { addSopLog, UNUSUAL_MAX, WHAT_MAX } from '@/lib/sop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const article = sopById(String(body.id ?? ''));
  if (!article) return NextResponse.json({ error: 'That SOP article doesn’t exist' }, { status: 404 });
  const what = String(body.what ?? '').trim();
  const unusual = String(body.unusual ?? '').trim();
  if (!what) return NextResponse.json({ error: 'Say what you did' }, { status: 400 });
  if (what.length > WHAT_MAX || unusual.length > UNUSUAL_MAX) return NextResponse.json({ error: 'That’s too long' }, { status: 400 });
  const entry = await addSopLog(article.id, { by: user.id, what, unusual });
  return NextResponse.json({ entry });
}

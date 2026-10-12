// Super admins approve Google accounts other than the marketing Gmail that spreadsheets may live in.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { isEmail, isMainAccount, listApproved, normalizeEmail, saveApproved } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

async function admin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!isSuperAdmin(user)) return { error: NextResponse.json({ error: 'Only Miguel, Omerson or Camille can approve accounts' }, { status: 403 }) };
  return { user };
}

export async function POST(req: Request) {
  const { user, error } = await admin();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ''));
  const note = String(body.note ?? '').trim().slice(0, 200) || undefined;
  if (!isEmail(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  if (isMainAccount(email)) return NextResponse.json({ error: 'The marketing Gmail is always allowed' }, { status: 400 });
  const all = await listApproved();
  if (all.some((a) => a.email === email)) return NextResponse.json({ error: 'Already approved' }, { status: 409 });
  const entry = { email, note, by: user!.id, at: Date.now() };
  await saveApproved([...all, entry]);
  return NextResponse.json({ approved: entry });
}

export async function DELETE(req: Request) {
  const { error } = await admin();
  if (error) return error;
  const email = normalizeEmail(new URL(req.url).searchParams.get('email') ?? '');
  await saveApproved((await listApproved()).filter((a) => a.email !== email));
  return NextResponse.json({ ok: true });
}

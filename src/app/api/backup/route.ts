// Nightly backup, called by the "Nightly backup" GitHub Action with BACKUP_SECRET. Not for browsers.

import { NextResponse } from 'next/server';
import { backup } from '@/lib/backup';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function allowed(req: Request) {
  const secret = process.env.BACKUP_SECRET;
  const got = req.headers.get('authorization') ?? '';
  if (!secret || secret.length < 16 || got.length !== secret.length + 7) return false;
  let diff = 0;
  const want = `Bearer ${secret}`;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: Request) {
  if (!process.env.BACKUP_SECRET) return NextResponse.json({ error: 'Backups aren’t set up: add BACKUP_SECRET in Vercel.' }, { status: 503 });
  if (!allowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    return NextResponse.json(await backup(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    await logError('server', `Backup: ${(e as Error).message}`, { path: '/api/backup' });
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}

// One screenshot of a Task Recording, for the Claude routine writing it up (token from the routine's links).

import { NextResponse } from 'next/server';
import { getRecording, getShot } from '@/lib/task-recordings/store';
import { validToken } from '@/lib/task-recordings/routine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, props: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await props.params;
  const rec = await getRecording(id);
  if (!rec || !(await validToken(rec, new URL(req.url).searchParams.get('token') ?? ''))) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  const shot = await getShot(id, Number(n));
  const m = shot && /^data:(image\/[a-z]+);base64,(.+)$/.exec(shot);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'no-store' } });
}

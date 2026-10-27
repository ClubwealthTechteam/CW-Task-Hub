// A Task Recording step's screenshot: the extension uploads it (PUT, the recorder only, while uploading);
// the recording page shows it (GET, the recorder or a super admin).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canView, getRecording, getShot, setShot } from '@/lib/task-recordings/store';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string; n: string }> };

export async function PUT(req: Request, props: Props) {
  const { id, n } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  if (!rec || rec.owner !== user.id) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  const step = rec.steps.find((s) => s.n === Number(n));
  if (!step || !step.hasShot) return NextResponse.json({ error: 'That step has no screenshot' }, { status: 404 });
  if (rec.status !== 'uploading') return NextResponse.json({ error: 'This recording is already sent' }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const problem = await setShot(id, step.n, String(body.dataUrl ?? ''));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, props: Props) {
  const { id, n } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  const shot = rec && canView(user, rec) ? await getShot(id, Number(n)) : null;
  const m = shot && /^data:(image\/[a-z]+);base64,(.+)$/.exec(shot);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}

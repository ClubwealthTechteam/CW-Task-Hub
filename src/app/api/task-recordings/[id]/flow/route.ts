// The Flow Canvas JSON for a Task Recording (screenshots included as Image nodes), for "Copy JSON".
// ?download=1 saves it as a .json file instead.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canView, getRecording } from '@/lib/task-recordings/store';
import { buildFlow } from '@/lib/task-recordings/flow';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  if (!rec || !canView(user, rec)) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  if (!rec.writeUp) return NextResponse.json({ error: 'The steps aren’t written yet' }, { status: 409 });
  const flow = await buildFlow(rec, rec.writeUp);
  const download = new URL(req.url).searchParams.has('download');
  const name = `${rec.writeUp.title.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'task'}-flow.json`;
  return new Response(JSON.stringify(flow, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      ...(download ? { 'Content-Disposition': `attachment; filename="${name}"` } : {}),
    },
  });
}

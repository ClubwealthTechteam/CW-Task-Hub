// Edit, change the status of, or delete one calendar post.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { cleanPost, deletePost, setStatus, STATUSES, updatePost, type PostStatus } from '@/lib/calendar';
import { canUseCalendar, teamIds } from '@/lib/calendar-access';

export const dynamic = 'force-dynamic';

async function allowed(dept: string) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCalendar(user, dept)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

/** The whole post (an edit), or just { status, date? } to tick one off. */
export async function PATCH(req: Request, props: { params: Promise<{ dept: string; id: string }> }) {
  const params = await props.params;
  const denied = await allowed(params.dept);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (body.title === undefined && body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    const post = await setStatus(params.dept, params.id, body.status as PostStatus, body.date ? String(body.date) : undefined);
    return post ? NextResponse.json({ post }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const clean = cleanPost(body, teamIds(params.dept));
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  const post = await updatePost(params.dept, params.id, clean.fields);
  return post ? NextResponse.json({ post }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_req: Request, props: { params: Promise<{ dept: string; id: string }> }) {
  const params = await props.params;
  const denied = await allowed(params.dept);
  if (denied) return denied;
  await deletePost(params.dept, params.id);
  return NextResponse.json({ ok: true });
}

// A department's content calendar: its posts, plus upcoming Eventbrite events (read-only).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { addPost, cleanPost, listPosts } from '@/lib/calendar';
import { canUseCalendar, teamIds } from '@/lib/calendar-access';
import { upcomingEvents } from '@/lib/calendar-events';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { dept: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCalendar(user, params.dept)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [posts, events] = await Promise.all([listPosts(params.dept), upcomingEvents()]);
  return NextResponse.json({ posts, events });
}

export async function POST(req: Request, { params }: { params: { dept: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCalendar(user, params.dept)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const clean = cleanPost(await req.json().catch(() => ({})), teamIds(params.dept));
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  return NextResponse.json({ post: await addPost(params.dept, clean.fields, user.id) });
}

// Updates and announcements. Everyone signed in reads the ones meant for them; super admins post.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { departmentById } from '@/config/departments';
import { addAnnouncement, announcementsFor, BODY_MAX, TITLE_MAX, type Announcement } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  return NextResponse.json({ announcements: await announcementsFor(user) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Only Miguel, Omerson or Camille can post updates' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const text = String(body.body ?? '').trim();
  const audience = String(body.audience ?? 'all');
  if (!title) return NextResponse.json({ error: 'Add a title' }, { status: 400 });
  if (title.length > TITLE_MAX || text.length > BODY_MAX) return NextResponse.json({ error: 'That’s too long' }, { status: 400 });
  if (audience !== 'all' && !departmentById(audience)) return NextResponse.json({ error: 'Pick who it’s for' }, { status: 400 });
  const entry = await addAnnouncement({ title, body: text, audience: audience as Announcement['audience'], pinned: Boolean(body.pinned), by: user.id });
  return NextResponse.json({ announcement: entry });
}

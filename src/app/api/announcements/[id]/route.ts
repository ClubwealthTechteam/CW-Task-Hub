// Edit, pin or delete an announcement. Super admins only.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { departmentById } from '@/config/departments';
import { BODY_MAX, TITLE_MAX, deleteAnnouncement, updateAnnouncement, type Announcement } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

async function admin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Only Miguel, Omerson or Camille can change updates' }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await admin();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Pick<Announcement, 'title' | 'body' | 'audience' | 'pinned'>> = {};
  if (body.title !== undefined) {
    patch.title = String(body.title).trim();
    if (!patch.title || patch.title.length > TITLE_MAX) return NextResponse.json({ error: 'Check the title' }, { status: 400 });
  }
  if (body.body !== undefined) {
    patch.body = String(body.body).trim();
    if (patch.body.length > BODY_MAX) return NextResponse.json({ error: 'That’s too long' }, { status: 400 });
  }
  if (body.audience !== undefined) {
    if (body.audience !== 'all' && !departmentById(String(body.audience))) return NextResponse.json({ error: 'Pick who it’s for' }, { status: 400 });
    patch.audience = body.audience;
  }
  if (body.pinned !== undefined) patch.pinned = Boolean(body.pinned);
  const updated = await updateAnnouncement(params.id, patch);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ announcement: updated });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await admin();
  if (denied) return denied;
  await deleteAnnouncement(params.id);
  return NextResponse.json({ ok: true });
}

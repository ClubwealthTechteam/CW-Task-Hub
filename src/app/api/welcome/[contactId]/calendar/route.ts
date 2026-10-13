// Put a client's welcome post on the Social Media content calendar (Page + Group, captions in the notes).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome, WELCOME_DEPT } from '@/lib/welcome/access';
import { listRecords, saveRecord } from '@/lib/welcome/store';
import { addPost, listPosts, updatePost, type CalendarPost } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const id = Number(params.contactId);
  const body = await req.json().catch(() => ({}));
  const date = String(body.date ?? '');
  const time = String(body.time ?? '');
  const name = String(body.name ?? '').slice(0, 100);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Pick a date' }, { status: 400 });
  const rec = (await listRecords())[id];
  const notes = [rec?.pageCaption && `FACEBOOK PAGE:\n${rec.pageCaption}`, rec?.groupCaption && `FACEBOOK GROUP:\n${rec.groupCaption}`].filter(Boolean).join('\n\n') || undefined;
  const fields: Omit<CalendarPost, 'id' | 'by' | 'at'> = {
    title: `Welcome: ${name || 'new client'}`, date, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : undefined,
    type: 'welcome', platforms: ['fb-page', 'fb-group'], status: 'scheduled', assignee: user.id, notes, repeat: 'none',
  };
  const existing = rec?.calendarPostId && (await listPosts(WELCOME_DEPT)).some((p) => p.id === rec.calendarPostId);
  const post = existing ? await updatePost(WELCOME_DEPT, rec!.calendarPostId!, fields) : await addPost(WELCOME_DEPT, fields, user.id);
  const record = await saveRecord(id, { calendarPostId: post!.id, scheduledFor: date, status: 'scheduled' }, user.id);
  return NextResponse.json({ record, post });
}

// Save where one new client is in the welcome-post process (photo, captions, status…). Hub only.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome, WELCOME_DEPT } from '@/lib/welcome/access';
import { saveRecord, WELCOME_STATUSES, type WelcomeRecord } from '@/lib/welcome/store';
import { fileMeta, updateFileMeta } from '@/lib/chat/files';
import { syncCalendar } from '@/lib/welcome/auto';

export const dynamic = 'force-dynamic';

const TEXT = { business: 120, city: 120, coach: 120, pageCaption: 3000, groupCaption: 3000, notes: 2000 } as const;

export async function PATCH(req: Request, { params }: { params: { contactId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const id = Number(params.contactId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const patch: Partial<WelcomeRecord> = {};
  for (const [k, max] of Object.entries(TEXT)) if (body[k] !== undefined) (patch as Record<string, string>)[k] = String(body[k] ?? '').slice(0, max);
  if (body.status !== undefined) {
    if (!WELCOME_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    patch.status = body.status;
  }
  if (body.noPhoto !== undefined) patch.noPhoto = Boolean(body.noPhoto);
  if (body.photoRequested) patch.photoRequestedAt = Date.now();
  if (body.scheduledFor !== undefined) patch.scheduledFor = /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledFor) ? body.scheduledFor : undefined;
  if (body.photoFileId !== undefined) {
    if (body.photoFileId) {
      const meta = await fileMeta(String(body.photoFileId));
      if (!meta || meta.source !== 'upload' || (meta.owner !== user.id && meta.shared !== WELCOME_DEPT)) return NextResponse.json({ error: 'Upload the photo again' }, { status: 400 });
      if (meta.type === 'application/pdf') return NextResponse.json({ error: 'Use a PNG or JPEG photo' }, { status: 400 });
      await updateFileMeta({ ...meta, shared: WELCOME_DEPT }); // the whole Social Media team can see it
      patch.photoFileId = meta.id;
      patch.noPhoto = false;
    } else patch.photoFileId = undefined;
  }
  const record = await saveRecord(id, patch, user.id);
  if (patch.status) await syncCalendar(record); // keep the content calendar's status in step
  return NextResponse.json({ record });
}

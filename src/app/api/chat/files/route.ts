// Attach a file to a CW Assistant message: PNG, JPEG or PDF, up to 4 MB. Social Media and super admins.
// The file is held for the person until they send it; the message then links it to the conversation.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseFiles, cleanName, MAX_FILE_BYTES, newFileId, saveFile, sniff, toRef } from '@/lib/chat/files';
import { storeIsPersistent } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseFiles(user)) return NextResponse.json({ error: 'Attaching files is for the Social Media team' }, { status: 403 });
  if (!storeIsPersistent()) return NextResponse.json({ error: 'Storage isn’t connected yet' }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose a file' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files can be up to 4 MB' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ error: 'Only PNG, JPEG and PDF files can be attached' }, { status: 415 });
  const meta = await saveFile({ id: newFileId(), name: cleanName(file.name, type), type, size: bytes.length, owner: user.id, source: 'upload', at: Date.now() }, bytes);
  return NextResponse.json({ file: toRef(meta) });
}

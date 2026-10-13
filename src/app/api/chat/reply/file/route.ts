// The CW Assistant routine sends a graphic it made: POST the PNG/JPEG bytes to
// /api/chat/reply/file?conversationId=…&messageId=…&token=…&name=… (the same one-time reply token).
// It returns the file id, which the routine then lists in its reply as "files": [id, …].

import { NextResponse } from 'next/server';
import { validReplyToken } from '@/lib/chat/routine';
import { getConversation } from '@/lib/chat/store';
import { cleanName, MAX_FILE_BYTES, newFileId, saveFile, sniff } from '@/lib/chat/files';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const conversationId = q.get('conversationId') ?? '';
  const messageId = q.get('messageId') ?? '';
  if (!(await validReplyToken(conversationId, messageId, q.get('token') ?? ''))) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 403 });
  }
  const conv = await getConversation(conversationId);
  const msg = conv?.messages.find((m) => m.id === messageId && m.role === 'assistant');
  if (!conv || !msg) return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 });
  if (msg.status === 'done') return NextResponse.json({ ok: false, error: 'Already delivered' }, { status: 409 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: 'Send a PNG or JPEG up to 4 MB' }, { status: 413 });
  const type = sniff(bytes);
  if (type !== 'image/png' && type !== 'image/jpeg') return NextResponse.json({ ok: false, error: 'Only PNG or JPEG' }, { status: 415 });
  const meta = await saveFile({
    id: newFileId(), name: cleanName(q.get('name') || 'cw-graphic', type), type, size: bytes.length,
    owner: conv.owner, conversationId: conv.id, source: 'assistant', at: Date.now(),
  }, bytes);
  return NextResponse.json({ ok: true, id: meta.id });
}

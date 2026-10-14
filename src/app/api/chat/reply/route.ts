// Called by the CW Assistant routine (not by a browser): { conversationId, messageId, token, text, files? }.
// `files` lists graphics it already sent to /api/chat/reply/file for this message.
// The token is an HMAC of the conversation and message ids, so it only fills the one reply it was made for,
// and only once.

import { NextResponse } from 'next/server';
import { validReplyToken } from '@/lib/chat/routine';
import { getConversation, saveConversation, touchIndex } from '@/lib/chat/store';
import { fileMeta, toRef } from '@/lib/chat/files';
import { notifyReply } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const MAX_REPLY = 20_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const conversationId = String(body?.conversationId ?? '');
  const messageId = String(body?.messageId ?? '');
  const token = String(body?.token ?? '');
  const text = String(body?.text ?? '').trim();
  if (!conversationId || !messageId || !token || !text) {
    return NextResponse.json({ ok: false, error: 'conversationId, messageId, token and text are required' }, { status: 400 });
  }
  if (!(await validReplyToken(conversationId, messageId, token))) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 403 });
  }

  const conv = await getConversation(conversationId);
  const msg = conv?.messages.find((m) => m.id === messageId && m.role === 'assistant');
  if (!conv || !msg) return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 });
  if (msg.status === 'done') return NextResponse.json({ ok: false, error: 'Already delivered' }, { status: 409 });

  // A late reply still lands, replacing the "didn't arrive" note.
  msg.text = text.slice(0, MAX_REPLY);
  const ids: string[] = Array.isArray(body?.files) ? body.files.map(String).slice(0, 6) : [];
  const files = (await Promise.all(ids.map(fileMeta))).filter((f) => f && f.conversationId === conv.id && f.source === 'assistant');
  if (files.length) msg.files = files.map((f) => toRef(f!));
  msg.status = 'done';
  conv.updated = Date.now();
  await saveConversation(conv);
  await touchIndex(conv);
  await notifyReply(conv).catch(() => null);
  return NextResponse.json({ ok: true });
}

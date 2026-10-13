// The CW Assistant routine puts a design into the person's Canva: POST a PDF (editable in Canva) or a PNG to
// /api/chat/reply/canva?conversationId=…&messageId=…&token=…&title=… with the one-time reply token. Only for
// people allowed to use Canva who have connected it. The design shows in the reply as "Open in Canva".

import { NextResponse } from 'next/server';
import { validReplyToken } from '@/lib/chat/routine';
import { getConversation, saveConversation } from '@/lib/chat/store';
import { CanvaError, canUseCanva, designFromImage, designFromPdf, status } from '@/lib/canva/client';
import { MAX_FILE_BYTES, sniff } from '@/lib/chat/files';
import { personById } from '@/config/people';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const conversationId = q.get('conversationId') ?? '';
  const messageId = q.get('messageId') ?? '';
  if (!(await validReplyToken(conversationId, messageId, q.get('token') ?? ''))) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 403 });
  const conv = await getConversation(conversationId);
  const msg = conv?.messages.find((m) => m.id === messageId && m.role === 'assistant');
  if (!conv || !msg) return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 });
  if (msg.status === 'done') return NextResponse.json({ ok: false, error: 'Already delivered' }, { status: 409 });
  if (!canUseCanva(personById(conv.owner)) || !(await status(conv.owner)).connected) return NextResponse.json({ ok: false, error: 'Canva isn’t connected for this person' }, { status: 409 });
  if ((msg.canva?.length ?? 0) >= 3) return NextResponse.json({ ok: false, error: 'Up to 3 Canva designs per reply' }, { status: 429 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: 'Send a PDF or PNG up to 4 MB' }, { status: 413 });
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ ok: false, error: 'Only PDF, PNG or JPEG' }, { status: 415 });
  const title = (q.get('title') || 'CW graphic').slice(0, 50);
  try {
    const design = type === 'application/pdf' ? await designFromPdf(conv.owner, bytes, title) : await designFromImage(conv.owner, bytes, title);
    // Kept on the pending reply; it shows once the reply is delivered.
    msg.canva = [...(msg.canva ?? []), design];
    await saveConversation(conv);
    return NextResponse.json({ ok: true, editUrl: design.editUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as CanvaError).message }, { status: 502 });
  }
}

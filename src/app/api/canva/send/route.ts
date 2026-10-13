// "Send to Canva" on a graphic in a Canva task chat: the image becomes a Canva design in the
// person's account, and the chat remembers the "Open in Canva" link.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { CanvaError, canUseCanva, designFromImage, designFromPdf } from '@/lib/canva/client';
import { fileBytes, fileMeta } from '@/lib/chat/files';
import { getConversation, saveConversation } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCanva(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const conv = await getConversation(String(b.conversationId ?? ''));
  if (!conv || conv.owner !== user.id) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  const msg = conv.messages.find((m) => m.id === String(b.messageId ?? ''));
  const ref = msg?.files?.find((f) => f.id === String(b.fileId ?? ''));
  const meta = ref ? await fileMeta(ref.id) : null;
  const bytes = meta ? await fileBytes(meta) : null;
  if (!ref || !meta || !bytes) return NextResponse.json({ error: 'That file has expired' }, { status: 410 });
  try {
    const title = meta.name.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').slice(0, 50) || 'CW graphic';
    const design = meta.type === 'application/pdf' ? await designFromPdf(user.id, bytes, title) : await designFromImage(user.id, bytes, title);
    ref.canva = design;
    await saveConversation(conv);
    return NextResponse.json({ design, conversation: conv });
  } catch (e) {
    const err = e as CanvaError;
    return NextResponse.json({ error: err.message }, { status: err.status === 409 ? 409 : 502 });
  }
}

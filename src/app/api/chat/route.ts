import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { storeIsPersistent } from '@/lib/store';
import { chatIsConfigured, buildPayload, fireChatRoutine } from '@/lib/chat/routine';
import {
  createConversation, getConversation, listConversations, newId, saveConversation, touchIndex, type ChatMessage,
} from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 4000;

/** The signed-in person's conversations, plus whether the assistant is switched on. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  return NextResponse.json({
    conversations: await listConversations(user.id),
    ready: chatIsConfigured() && storeIsPersistent(),
    missing: [!chatIsConfigured() && 'CLAUDE_CHAT_ROUTINE_TOKEN', !storeIsPersistent() && 'storage'].filter(Boolean),
  });
}

/** Sends a message: { conversationId?, text }. Starts the routine; the reply arrives later via /api/chat/reply. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!chatIsConfigured() || !storeIsPersistent()) {
    return NextResponse.json({ error: 'CW Assistant isn’t switched on yet. Ask Miguel to finish the setup.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Type a message first' }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `Keep messages under ${MAX_TEXT} characters` }, { status: 400 });

  let conv = body.conversationId ? await getConversation(String(body.conversationId)) : null;
  if (body.conversationId && (!conv || (conv.owner !== user.id && !isSuperAdmin(user)))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  if (conv && conv.owner !== user.id) return NextResponse.json({ error: 'You can read this chat but not reply in it' }, { status: 403 });
  if (conv?.messages.some((m) => m.status === 'pending')) {
    return NextResponse.json({ error: 'Wait for the current reply first' }, { status: 409 });
  }
  conv ??= createConversation(user.id, text);

  const now = Date.now();
  const asked: ChatMessage = { id: newId('m'), role: 'user', text, at: now, status: 'done' };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  conv.updated = now;

  try {
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id));
  } catch (e) {
    reply.status = 'error';
    reply.text = (e as Error).message;
  }
  await saveConversation(conv);
  await touchIndex(conv);
  return NextResponse.json({ conversation: conv });
}

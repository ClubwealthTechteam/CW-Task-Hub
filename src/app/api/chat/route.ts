import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { findAutomation } from '@/data/catalog';
import { cleanContact } from '@/lib/chat/contact';
import { keapContext } from '@/lib/chat/keap-context';
import { eventbriteContext } from '@/lib/chat/eventbrite-context';
import { calendarContext } from '@/lib/chat/calendar-context';
import { zapierContext } from '@/lib/chat/zapier-context';
import { sheetsContext } from '@/lib/chat/sheets-context';
import { storeIsPersistent } from '@/lib/store';
import { canUseFiles, fileMeta, MAX_FILES_PER_MESSAGE, toRef, updateFileMeta } from '@/lib/chat/files';
import { filesContext } from '@/lib/chat/files-context';
import { countMessage, usageFor } from '@/lib/chat/usage';
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
    usage: await usageFor(user),
    missing: [!chatIsConfigured() && 'CLAUDE_CHAT_ROUTINE_TOKEN', !storeIsPersistent() && 'storage'].filter(Boolean),
  });
}

/** Sends a message: { conversationId?, automationId?, text }. Starts the routine; the reply arrives later via /api/chat/reply. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!chatIsConfigured() || !storeIsPersistent()) {
    return NextResponse.json({ error: 'CW Assistant isn’t switched on yet. Ask Miguel to finish the setup.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const hasFiles = Array.isArray(body.attachments) && body.attachments.length > 0;
  const text = String(body.text ?? '').trim() || (hasFiles ? 'Here are the files.' : '');
  if (!text) return NextResponse.json({ error: 'Type a message first' }, { status: 400 });
  const usage = await usageFor(user);
  if (usage.left === 0) {
    return NextResponse.json({ error: `You’ve used your ${usage.limit} CW Assistant messages for today. They reset at midnight (Pacific).`, usage }, { status: 429 });
  }
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `Keep messages under ${MAX_TEXT} characters` }, { status: 400 });

  let conv = body.conversationId ? await getConversation(String(body.conversationId)) : null;
  if (body.conversationId && (!conv || (conv.owner !== user.id && !isSuperAdmin(user)))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  if (conv && conv.owner !== user.id) return NextResponse.json({ error: 'You can read this chat but not reply in it' }, { status: 403 });
  if (conv?.messages.some((m) => m.status === 'pending')) {
    return NextResponse.json({ error: 'Wait for the current reply first' }, { status: 409 });
  }
  // A task chat stays with its task; people can only chat with their own tasks (super admins: any).
  const taskId = conv ? conv.automationId : body.automationId ? String(body.automationId) : undefined;
  const task = taskId ? await findAutomation(taskId) : undefined;
  if (taskId && (!task || !canViewAutomation(user, task))) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  // Attached files: only the sender's own, not yet sent in another chat.
  const ids: string[] = Array.isArray(body.attachments) ? body.attachments.map(String) : [];
  if (ids.length && !canUseFiles(user)) return NextResponse.json({ error: 'Attaching files is for the Social Media team' }, { status: 403 });
  if (ids.length > MAX_FILES_PER_MESSAGE) return NextResponse.json({ error: `Attach up to ${MAX_FILES_PER_MESSAGE} files per message` }, { status: 400 });
  const attached = await Promise.all(ids.map(fileMeta));
  if (attached.some((f) => !f || f.owner !== user.id || f.source !== 'upload' || (f.conversationId && f.conversationId !== conv?.id))) {
    return NextResponse.json({ error: 'One of the files is missing or expired. Attach it again.' }, { status: 400 });
  }

  conv ??= createConversation(user.id, text, task?.id);
  for (const f of attached) await updateFileMeta({ ...f!, conversationId: conv.id });

  const now = Date.now();
  const asked: ChatMessage = { id: newId('m'), role: 'user', text, at: now, status: 'done', ...(attached.length ? { files: attached.map((f) => toRef(f!)) } : {}) };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  conv.updated = now;

  try {
    const contact = task ? cleanContact(body.contact) : undefined;
    const [keapBlock, eventsBlock, zapBlock, sheetsBlock, calendarBlock] = await Promise.all([
      keapContext(user, text, contact?.id),
      eventbriteContext(user, text, Boolean(task && (task.department === 'events' || task.integrations.includes('eventbrite')))),
      zapierContext(user, text),
      sheetsContext(user, text, task?.id),
      calendarContext(task?.id).catch(() => ''),
    ]);
    const filesBlock = await filesContext(conv, canUseFiles(user));
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id, contact, keapBlock, eventsBlock + zapBlock + sheetsBlock + calendarBlock + filesBlock));
  } catch (e) {
    reply.status = 'error';
    reply.text = (e as Error).message;
  }
  if (reply.status !== 'error') await countMessage(user);
  await saveConversation(conv);
  await touchIndex(conv);
  return NextResponse.json({ conversation: conv, usage: await usageFor(user) });
}

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { findAutomation } from '@/data/catalog';
import { cleanContact } from '@/lib/chat/contact';
import { keapContext } from '@/lib/chat/keap-context';
import { eventbriteContext } from '@/lib/chat/eventbrite-context';
import { calendarContext } from '@/lib/chat/calendar-context';
import { welcomeContext } from '@/lib/chat/welcome-context';
import { referralsContext } from '@/lib/chat/referrals-context';
import { zapierContext } from '@/lib/chat/zapier-context';
import { sheetsContext } from '@/lib/chat/sheets-context';
import { storeIsPersistent } from '@/lib/store';
import { canUseFiles, fileMeta, MAX_FILES_PER_MESSAGE, toRef, updateFileMeta } from '@/lib/chat/files';
import { filesContext } from '@/lib/chat/files-context';
import { judgeContext } from '@/lib/council/judge-context';
import { taskGuide } from '@/lib/chat/task-guides';
import { arContext, canUseAr } from '@/lib/billing/ar';
import { canvaOnTask, canvaConfigured, status as canvaStatus } from '@/lib/canva/client';
import { countMessage, usageFor } from '@/lib/chat/usage';
import { logError } from '@/lib/errors';
import { canAnswerQuickly, streamQuickReply } from '@/lib/chat/quick';
import { chatIsConfigured, buildPayload, fireChatRoutine } from '@/lib/chat/routine';
import {
  createConversation, getConversation, listConversations, newId, saveConversation, touchIndex, type ChatMessage, type Conversation,
} from '@/lib/chat/store';
import type { Person } from '@/config/people';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  // The council's Executive Judge: super admins only, chat only, no task and no files.
  const judge = conv ? Boolean(conv.judge) : Boolean(body.judge);
  if (judge && !isSuperAdmin(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // A task chat stays with its task; people can only chat with their own tasks (super admins: any).
  const taskId = judge ? undefined : conv ? conv.automationId : body.automationId ? String(body.automationId) : undefined;
  const task = taskId ? await findAutomation(taskId) : undefined;
  if (taskId && (!task || !canViewAutomation(user, task))) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  // Attached files: only the sender's own, not yet sent in another chat.
  const ids: string[] = !judge && Array.isArray(body.attachments) ? body.attachments.map(String) : [];
  if (ids.length && !canUseFiles(user)) return NextResponse.json({ error: 'Attaching files isn’t turned on for you' }, { status: 403 });
  if (ids.length > MAX_FILES_PER_MESSAGE) return NextResponse.json({ error: `Attach up to ${MAX_FILES_PER_MESSAGE} files per message` }, { status: 400 });
  const attached = await Promise.all(ids.map(fileMeta));
  if (attached.some((f) => !f || f.owner !== user.id || f.source !== 'upload' || (f.conversationId && f.conversationId !== conv?.id))) {
    return NextResponse.json({ error: 'One of the files is missing or expired. Attach it again.' }, { status: 400 });
  }

  if (!conv) {
    conv = createConversation(user.id, text, task?.id);
    if (judge) conv.judge = true;
  }
  for (const f of attached) await updateFileMeta({ ...f!, conversationId: conv.id });

  const now = Date.now();
  const asked: ChatMessage = { id: newId('m'), role: 'user', text, at: now, status: 'done', ...(attached.length ? { files: attached.map((f) => toRef(f!)) } : {}) };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  conv.updated = now;

  // Build what the assistant reads, then either stream a quick reply or start the routine.
  let routinePayload = '';
  let quick = false;
  let quickPayload = '';
  try {
    if (judge) {
      routinePayload = await buildPayload(user, conv, asked.id, reply.id, undefined, '', await judgeContext());
    } else {
      const contact = task ? cleanContact(body.contact) : undefined;
      const [keapBlock, eventsBlock, zapBlock, sheetsBlock, calendarBlock, welcomeBlock, referralsBlock, arBlock] = await Promise.all([
        keapContext(user, text, contact?.id),
        eventbriteContext(user, text, Boolean(task && (task.department === 'events' || task.integrations.includes('eventbrite')))),
        zapierContext(user, text),
        sheetsContext(user, text, task?.id),
        calendarContext(task?.id).catch(() => ''),
        welcomeContext(task?.id).catch(() => ''),
        referralsContext(task?.id).catch(() => ''),
        canUseAr(user) ? arContext(task?.id).catch(() => '') : Promise.resolve(''),
      ]);
      const canvaOn = canvaOnTask(user, task) && canvaConfigured() && (await canvaStatus(user.id)).connected;
      const filesBlock = await filesContext(conv, canUseFiles(user), canvaOn);
      const extra = eventsBlock + zapBlock + sheetsBlock + calendarBlock + welcomeBlock + referralsBlock + arBlock + taskGuide(task?.id);
      quick = body.stream === true && canAnswerQuickly(conv, text, { judge, attachments: attached.length });
      if (quick) quickPayload = await buildPayload(user, conv, asked.id, reply.id, contact, keapBlock, extra, true);
      routinePayload = await buildPayload(user, conv, asked.id, reply.id, contact, keapBlock, extra + filesBlock);
    }
    if (!quick) await fireChatRoutine(routinePayload);
  } catch (e) {
    quick = false;
    reply.status = 'error';
    reply.text = (e as Error).message;
    await logError('server', `Chat: ${(e as Error).message}`, { path: '/api/chat', user: user.id });
  }
  if (reply.status !== 'error') await countMessage(user);
  await saveConversation(conv);
  await touchIndex(conv);
  if (quick) return streamReply(user, conv, reply, quickPayload, routinePayload);
  return NextResponse.json({ conversation: conv, usage: await usageFor(user) });
}

/**
 * Quick path: newline-delimited JSON. {type:"start", conversation, usage}, then {type:"text", text} pieces,
 * then {type:"done", conversation}. If the API fails before any text, the routine takes over and the
 * stream ends with {type:"handoff", conversation} (the reply then arrives the usual way).
 */
function streamReply(user: Person, conv: Conversation, reply: ChatMessage, quickPayload: string, routinePayload: string) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      send({ type: 'start', conversation: conv, usage: await usageFor(user) });
      let got = '';
      try {
        const result = await streamQuickReply(quickPayload, (delta) => { got += delta; send({ type: 'text', text: delta }); });
        reply.text = result.text.trim() || (result.refused ? 'I can’t help with that one. Try asking another way, or ask Miguel.' : 'I don’t have an answer for that. Try asking another way.');
        reply.status = 'done';
        reply.at = Date.now();
      } catch (e) {
        await logError('server', `Quick reply: ${(e as Error).message}`, { path: '/api/chat', user: user.id });
        if (!got) {
          // Nothing shown yet: let the routine answer instead.
          try { await fireChatRoutine(routinePayload); }
          catch (err) { reply.status = 'error'; reply.text = (err as Error).message; }
        } else {
          reply.status = 'done';
          reply.text = `${got.trim()}\n\n_(The reply was cut off. Ask again to get the rest.)_`;
        }
      }
      conv.updated = Date.now();
      await saveConversation(conv);
      await touchIndex(conv);
      send({ type: reply.status === 'pending' ? 'handoff' : 'done', conversation: conv });
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}


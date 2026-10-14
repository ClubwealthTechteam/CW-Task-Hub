// The home page's shift summary maker: Claude turns what the person did today (their notes, the to-dos
// they ticked off and the task chats they worked in) into a short end-of-shift summary ready to paste in
// Slack. It runs in a background chat, like the other hub tools, so no extra key is needed.

import type { Person } from '@/config/people';
import { allAutomations } from '@/data/catalog';
import { buildPayload, fireChatRoutine } from '@/lib/chat/routine';
import { createConversation, getConversation, listConversations, newId, saveConversation, type ChatMessage } from '@/lib/chat/store';
import { listItems } from './items';

const MAX_NOTES = 3000;
const pacificDay = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

/** What the hub already knows about the person's day: to-dos ticked off today, open urgent items, task chats. */
export async function dayFacts(user: Person) {
  const today = pacificDay(Date.now());
  const [items, convs, tasks] = await Promise.all([listItems(user.id), listConversations(user.id), allAutomations()]);
  const title = new Map(tasks.map((a) => [a.id, a.title]));
  const doneToday = items.filter((i) => i.done && i.doneAt && pacificDay(i.doneAt) === today).map((i) => i.text);
  const open = items.filter((i) => !i.done).sort((a, b) => (a.kind === 'urgent' ? 0 : a.kind === 'hot' ? 1 : 2) - (b.kind === 'urgent' ? 0 : b.kind === 'hot' ? 1 : 2)).map((i) => `${i.kind === 'todo' ? '' : `[${i.kind}] `}${i.text}${i.due ? ` (due ${i.due})` : ''}`);
  const chats = convs.filter((c) => !c.judge && pacificDay(c.updated) === today).map((c) => (c.automationId ? `${title.get(c.automationId) ?? 'Task'}: ${c.title}` : `CW Assistant: ${c.title}`));
  return { today, doneToday, open: open.slice(0, 20), chats: chats.slice(0, 15) };
}

function prompt(user: Person, f: Awaited<ReturnType<typeof dayFacts>>, notes: string, hours: string) {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none)');
  return [
    'SHIFT SUMMARY MAKER: a background request from the person\'s home page in the Task Hub. Do NOT make graphics, do not ask questions.',
    `Write ${user.name.split(/\s+/)[0]}'s end-of-shift summary for ${f.today}${hours ? ` (shift ${hours})` : ''}, ready to paste into Slack for their manager.`,
    'Reply with ONLY the summary, in exactly this shape (plain text, Slack style, no [DRAFT] markers, no intro or sign-off):',
    '*Shift summary · <weekday, Mon D>*',
    '*Done today*',
    '• <one line per thing done, past tense, merge duplicates, most important first>',
    '*Carrying over*',
    '• <open items still to do, urgent first; write "• Nothing carried over" if none>',
    '*Notes / blockers*',
    '• <only if their notes mention a blocker, a question or something waiting on someone; otherwise leave this whole section out>',
    'Use only what is below. Never invent work, numbers, names or results. Keep each bullet short and plain.',
    '',
    'THEIR NOTES FOR TODAY (their own words; may be empty):',
    notes || '(none)',
    '',
    'TO-DOS THEY TICKED OFF TODAY (from their home page):',
    list(f.doneToday),
    '',
    'STILL OPEN ON THEIR LIST:',
    list(f.open),
    '',
    'TASK CHATS THEY WORKED IN TODAY (titles only; mention as work only if it clearly was):',
    list(f.chats),
  ].join('\n');
}

export async function startShiftSummary(user: Person, notesRaw: unknown, hoursRaw: unknown) {
  const notes = String(notesRaw ?? '').trim().slice(0, MAX_NOTES);
  const hours = String(hoursRaw ?? '').replace(/[^0-9:apmAPM\s–-]/g, '').trim().slice(0, 30);
  const facts = await dayFacts(user);
  if (!notes && !facts.doneToday.length && !facts.chats.length) {
    throw new Error('Add a few notes about your day, or tick off some to-dos first.');
  }
  const conv = createConversation(user.id, `Shift summary ${facts.today}`);
  conv.background = true;
  const now = Date.now();
  const asked: ChatMessage = { id: newId('m'), role: 'user', text: prompt(user, facts, notes, hours), at: now, status: 'done' };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  await saveConversation(conv);
  try {
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id));
  } catch (e) {
    reply.status = 'error';
    reply.text = (e as Error).message;
    await saveConversation(conv);
    throw e;
  }
  return { conversationId: conv.id, messageId: reply.id };
}

/** The summary once it has arrived: { status, text }. Only the person's own. */
export async function shiftSummaryResult(user: Person, conversationId: string) {
  const conv = await getConversation(conversationId);
  if (!conv || conv.owner !== user.id || !conv.background) return null;
  const msg = [...conv.messages].reverse().find((m) => m.role === 'assistant');
  return { status: msg?.status ?? 'error', text: msg?.status === 'pending' ? '' : msg?.text ?? '' };
}

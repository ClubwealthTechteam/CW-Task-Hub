// Sends a chat message to the "CW Assistant → Task Hub chat replies" Claude routine. Claude writes the
// answer in its own session and posts it back to /api/chat/reply with the one-time REPLY_TOKEN made here.
// No Anthropic API key needed: only the routine's own token (CLAUDE_CHAT_ROUTINE_TOKEN).

import type { Person } from '@/config/people';
import { departmentById } from '@/config/departments';
import { AUTOMATIONS, automationById } from '@/data/automations';
import { integrationName } from '@/lib/integrations/registry';
import { canViewDepartment, isSuperAdmin } from '@/lib/access';
import { signValue } from '@/lib/auth/session';
import type { Conversation } from './store';

const DEFAULT_ROUTINE_ID = 'trig_018jZ5AiA2CBb6AFPU6iTovc';
const MAX_PAYLOAD = 48_000; // the routine accepts up to 64 KiB
const MAX_MESSAGE = 4_000;

export const chatIsConfigured = () => Boolean(process.env.CLAUDE_CHAT_ROUTINE_TOKEN);

export const replyToken = (conversationId: string, messageId: string) => signValue(`chat-reply:${conversationId}:${messageId}`);

export async function validReplyToken(conversationId: string, messageId: string, token: string) {
  const expected = await replyToken(conversationId, messageId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

function automationLines(user: Person) {
  const mine = AUTOMATIONS.filter((a) => (isSuperAdmin(user) ? true : canViewDepartment(user, a.department)));
  return mine.slice(0, 60).map((a) => `- ${a.title} (${departmentById(a.department)?.name}, ${a.stage})`).join('\n');
}

export async function buildPayload(user: Person, conv: Conversation, userMessageId: string, replyId: string) {
  const depts = user.departments.map((d) => departmentById(d)?.name ?? d).join(', ');
  const asked = conv.messages.find((m) => m.id === userMessageId)?.text ?? '';
  const header = [
    'CW Task Hub chat message (sent by the hub relay).',
    `CONVERSATION_ID: ${conv.id}`,
    `MESSAGE_ID: ${replyId}`,
    `REPLY_TOKEN: ${await replyToken(conv.id, replyId)}`,
    `PERSON: ${user.name}${user.title ? ` (${user.title})` : ''} · department: ${depts} · ${isSuperAdmin(user) ? 'super admin (sees every department)' : 'team member'}`,
    `DATE: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'AUTOMATIONS THEY CAN SEE IN THE HUB:',
    automationLines(user) || '(none yet)',
  ].join('\n');
  const task = conv.automationId ? automationById(conv.automationId) : undefined;
  const taskBlock = task ? [
    '',
    '',
    'TASK (they are chatting with this task\'s assistant in their department workspace):',
    `title: ${task.title}`,
    `what it does: ${task.summary}`,
    `tools: ${task.integrations.map(integrationName).join(', ') || 'none'}`,
    `stage: ${task.stage}${task.runsIn ? ` (runs in ${task.runsIn})` : ''}`,
  ].join('\n') : '';
  const tail = `${taskBlock}\n\nMESSAGE:\n${asked.slice(0, MAX_MESSAGE)}`;

  // Earlier turns, newest kept first when trimming to size.
  const earlier = conv.messages
    .filter((m) => m.id !== userMessageId && m.id !== replyId && m.status === 'done')
    .map((m) => `${m.role === 'user' ? user.name : 'CW Assistant'}: ${m.text}`);
  const budget = MAX_PAYLOAD - header.length - tail.length - 100;
  const kept: string[] = [];
  let used = 0;
  for (let i = earlier.length - 1; i >= 0; i--) {
    const line = earlier[i].slice(0, 3000);
    if (used + line.length > budget) break;
    kept.unshift(line);
    used += line.length + 2;
  }
  const history = kept.length ? `\n\nCONVERSATION SO FAR (oldest first):\n${kept.join('\n\n')}` : '';
  return header + history + tail;
}

export async function fireChatRoutine(text: string) {
  const id = process.env.CHAT_ROUTINE_ID || DEFAULT_ROUTINE_ID;
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${id}/fire`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLAUDE_CHAT_ROUTINE_TOKEN}`,
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`The assistant couldn’t be reached (${res.status}).`);
}

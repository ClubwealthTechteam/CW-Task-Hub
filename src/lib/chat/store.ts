// CW Assistant conversations. Each conversation is one key (chat:conv:<id>); each person has an
// index of their conversation ids (chat:user:<uid>), newest first.

import { deleteKey, getJSON, setJSON } from '@/lib/store';
import type { FileRef } from './files';

export type ChatRole = 'user' | 'assistant';
export type ChatStatus = 'pending' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
  status: ChatStatus;
  /** Files attached to a message, or graphics the assistant made for its reply. */
  files?: FileRef[];
  /** Designs the assistant put in the person's Canva for this reply. */
  canva?: { id: string; title: string; editUrl: string; viewUrl: string; at: number }[];
}

export interface Conversation {
  id: string;
  owner: string;
  title: string;
  /** Set when the chat belongs to one task's assistant in a department workspace. */
  automationId?: string;
  /** Made by a tool in the background (e.g. a welcome graphic): kept out of the person's chat list. */
  background?: boolean;
  created: number;
  updated: number;
  messages: ChatMessage[];
}

export interface ConversationSummary { id: string; title: string; updated: number; automationId?: string }

/** A reply that hasn't arrived after this long is shown as failed, and the person can ask again. */
export const REPLY_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CONVERSATIONS = 50;

const convKey = (id: string) => `chat:conv:${id}`;
const userKey = (uid: string) => `chat:user:${uid}`;

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

/** Marks replies that never arrived as failed, so the chat doesn't wait forever. */
export function withTimeouts(conv: Conversation, now = Date.now()): Conversation {
  for (const m of conv.messages) {
    if (m.status === 'pending' && now - m.at > REPLY_TIMEOUT_MS) {
      m.status = 'error';
      m.text = 'The reply didn’t arrive. Please try asking again.';
    }
  }
  return conv;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (!/^c_[a-z0-9]+$/.test(id)) return null;
  const conv = await getJSON<Conversation | null>(convKey(id), null);
  return conv ? withTimeouts(conv) : null;
}

export const saveConversation = (conv: Conversation) => setJSON(convKey(conv.id), conv);

export async function listConversations(uid: string): Promise<ConversationSummary[]> {
  return getJSON<ConversationSummary[]>(userKey(uid), []);
}

export async function touchIndex(conv: Conversation) {
  if (conv.background) return;
  const list = (await listConversations(conv.owner)).filter((c) => c.id !== conv.id);
  list.unshift({ id: conv.id, title: conv.title, updated: conv.updated, automationId: conv.automationId });
  await setJSON(userKey(conv.owner), list.slice(0, MAX_CONVERSATIONS));
}

export function createConversation(owner: string, firstMessage: string, automationId?: string): Conversation {
  const now = Date.now();
  const title = firstMessage.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New chat';
  return { id: newId('c'), owner, title, automationId, created: now, updated: now, messages: [] };
}

export async function deleteConversation(conv: Conversation) {
  await deleteKey(convKey(conv.id));
  const list = (await listConversations(conv.owner)).filter((c) => c.id !== conv.id);
  await setJSON(userKey(conv.owner), list);
}

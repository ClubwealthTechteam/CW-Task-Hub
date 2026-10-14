// The bell in the top bar. Stored notifications (notif:<uid>, newest first) plus the person's updates and
// announcements, which are read straight from the announcements list instead of being copied to everyone.
// "Read" is one timestamp per person (notif:read:<uid>): anything newer is unread.

import type { Person } from '@/config/people';
import { personById } from '@/config/people';
import { getJSON, setJSON } from '@/lib/store';
import { announcementsFor } from '@/lib/announcements';
import { findAutomation } from '@/data/catalog';
import type { Conversation } from '@/lib/chat/store';

export type NotifKind = 'reply' | 'summary' | 'update' | 'graphic';
export interface Notification { id: string; at: number; kind: NotifKind; title: string; body?: string; href?: string; chatId?: string; read?: boolean }

const MAX = 40;
const KEEP_MS = 14 * 86_400_000;
const key = (uid: string) => `notif:${uid}`;
const readKey = (uid: string) => `notif:read:${uid}`;

export async function notify(uid: string, n: Omit<Notification, 'id' | 'at' | 'read'>) {
  if (!personById(uid)) return;
  const list = await getJSON<Notification[]>(key(uid), []);
  const entry: Notification = { ...n, id: `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
  await setJSON(key(uid), [entry, ...list.filter((x) => x.at > Date.now() - KEEP_MS)].slice(0, MAX));
}

/** Called when a CW Assistant reply lands: tells its owner, unless it was a background job nobody waits on. */
export async function notifyReply(conv: Conversation) {
  if (conv.judge) return;
  if (conv.background) {
    if (conv.title.startsWith('Shift summary')) await notify(conv.owner, { kind: 'summary', title: 'Your shift summary is ready', body: 'Copy it from your home page.', href: '/' });
    return;
  }
  const task = conv.automationId ? await findAutomation(conv.automationId) : undefined;
  await notify(conv.owner, task
    ? { kind: 'reply', title: `Reply ready · ${task.title}`, body: conv.title, href: `/w/${task.department}?t=${task.id}` }
    : { kind: 'reply', title: 'CW Assistant replied', body: conv.title, chatId: conv.id });
}

export async function notificationsFor(user: Person) {
  const [stored, readAt, updates] = await Promise.all([
    getJSON<Notification[]>(key(user.id), []), getJSON<number>(readKey(user.id), 0), announcementsFor(user),
  ]);
  const since = Date.now() - KEEP_MS;
  const fromUpdates: Notification[] = updates.filter((a) => a.at > since && a.by !== user.id).map((a) => ({
    id: `u_${a.id}`, at: a.at, kind: 'update', title: `New update · ${a.title}`, body: a.body.replace(/[*_`#>]/g, '').split('\n').find((l) => l.trim())?.slice(0, 140), href: '/updates',
  }));
  const items = [...stored.filter((n) => n.at > since), ...fromUpdates].sort((a, b) => b.at - a.at).slice(0, MAX)
    .map((n) => ({ ...n, read: n.at <= readAt }));
  return { items, unread: items.filter((n) => !n.read).length };
}

export const markAllRead = (uid: string) => setJSON(readKey(uid), Date.now());

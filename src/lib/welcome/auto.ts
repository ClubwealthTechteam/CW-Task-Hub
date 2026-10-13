// The automatic part of New Client Welcome Posts. When a new client appears, the hub writes their Page and
// Group captions and puts the post on the content calendar in the next open weekday slot. Once there's a
// photo (or "no photo" is chosen, or the photo request has waited 2 days), the assistant makes the welcome
// graphic in a background chat. Getting the photo and posting stay with Jay.

import type { Person } from '@/config/people';
import { addPost, listPosts, setStatus as setPostStatus, type PostStatus } from '@/lib/calendar';
import { addDays, todayPacific, weekday } from '@/lib/calendar-dates';
import { buildPayload, chatIsConfigured, fireChatRoutine } from '@/lib/chat/routine';
import { createConversation, getConversation, newId, saveConversation, type ChatMessage } from '@/lib/chat/store';
import { fileMeta, toRef, updateFileMeta } from '@/lib/chat/files';
import { filesContext } from '@/lib/chat/files-context';
import { storeIsPersistent } from '@/lib/store';
import { GROUP_CAPTIONS, PAGE_CAPTIONS, graphicPrompt, versionFor, type ClientFacts } from './captions';
import type { NewClient } from './keap-clients';
import { saveRecords, type WelcomeRecord, type WelcomeSettings, type WelcomeStatus } from './store';
import { WELCOME_DEPT } from './access';

const PHOTO_WAIT_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_GRAPHICS_PER_RUN = 3;
const OPEN: WelcomeStatus[] = ['new', 'photo', 'ready', 'review', 'scheduled'];

export const factsOf = (c: NewClient, r?: WelcomeRecord): ClientFacts => ({
  first: c.first || 'there',
  full: [c.first, c.last].filter(Boolean).join(' ') || 'our newest member',
  business: (r?.business ?? c.business) || undefined,
  city: (r?.city ?? c.city) || undefined,
  coach: (r?.coach ?? c.coach) || undefined,
});

const captionNotes = (page?: string, group?: string) =>
  [page && `FACEBOOK PAGE:\n${page}`, group && `FACEBOOK GROUP:\n${group}`].filter(Boolean).join('\n\n') || undefined;

/** Welcome status → content calendar status. */
export const CALENDAR_STATUS: Partial<Record<WelcomeStatus, PostStatus>> = {
  new: 'idea', photo: 'idea', ready: 'drafting', review: 'review', scheduled: 'scheduled', posted: 'posted',
};
export async function syncCalendar(rec: WelcomeRecord) {
  const s = CALENDAR_STATUS[rec.status];
  if (rec.calendarPostId && s) await setPostStatus(WELCOME_DEPT, rec.calendarPostId, s).catch(() => null);
}

/** Starts a background chat in which the assistant makes this client's welcome graphic. */
export async function requestGraphic(user: Person, c: NewClient, r: WelcomeRecord | undefined) {
  const withPhoto = Boolean(r?.photoFileId);
  const photo = withPhoto ? await fileMeta(r!.photoFileId!) : null;
  const facts = factsOf(c, r);
  const conv = createConversation(user.id, `Welcome graphic: ${facts.full}`, 'jaymar-1');
  conv.background = true;
  const now = Date.now();
  const asked: ChatMessage = { id: newId('m'), role: 'user', text: graphicPrompt(facts, Boolean(photo)), at: now, status: 'done', ...(photo ? { files: [toRef(photo)] } : {}) };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  await saveConversation(conv);
  let status: 'pending' | 'error' = 'pending';
  try {
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id, undefined, '', await filesContext(conv, true)));
  } catch {
    status = 'error';
  }
  return { conversationId: conv.id, messageId: reply.id, status, withPhoto: Boolean(photo), at: now } as WelcomeRecord['graphic'];
}

/** Picks up finished graphics from their background chats. */
async function collectGraphics(records: Record<string, WelcomeRecord>) {
  const patches: Record<number, Partial<WelcomeRecord>> = {};
  for (const r of Object.values(records)) {
    if (r.graphic?.status !== 'pending') continue;
    const conv = await getConversation(r.graphic.conversationId);
    const msg = conv?.messages.find((m) => m.id === r.graphic!.messageId);
    if (!msg || msg.status === 'pending') continue;
    const file = msg.files?.find((f) => f.source === 'assistant');
    if (msg.status === 'done' && file) {
      const meta = await fileMeta(file.id);
      if (meta) await updateFileMeta({ ...meta, shared: WELCOME_DEPT }); // the whole Social Media team can see it
      patches[r.contactId] = { graphic: { ...r.graphic, status: 'done', fileId: file.id } };
    } else patches[r.contactId] = { graphic: { ...r.graphic, status: 'error' } };
  }
  return patches;
}

/** Next weekday (from tomorrow, Pacific) with fewer than `perDay` welcome posts. */
function slotFinder(taken: Map<string, number>, perDay: number) {
  return () => {
    for (let d = addDays(todayPacific(), 1); ; d = addDays(d, 1)) {
      if (weekday(d) === 0 || weekday(d) === 6) continue;
      if ((taken.get(d) ?? 0) < perDay) { taken.set(d, (taken.get(d) ?? 0) + 1); return d; }
    }
  };
}

/** Runs the automatic steps for the board. Returns the records after any changes. */
export async function runWelcomeAutomation(clients: NewClient[], records: Record<string, WelcomeRecord>, settings: WelcomeSettings, user: Person) {
  if (!settings.auto) return records;
  const patches: Record<number, Partial<WelcomeRecord>> = await collectGraphics(records);
  const merged = (id: number) => ({ ...records[id], ...patches[id] }) as WelcomeRecord | undefined;

  // 1. Captions + calendar slot for clients seen for the first time, oldest sign-up first.
  const fresh = clients.filter((c) => !records[c.contactId]?.autoPrepared && OPEN.includes(records[c.contactId]?.status ?? 'new'))
    .sort((a, b) => a.signedUp.localeCompare(b.signedUp));
  if (fresh.length) {
    const posts = await listPosts(WELCOME_DEPT);
    const taken = new Map<string, number>();
    for (const p of posts) if (p.type === 'welcome' && p.date > todayPacific()) taken.set(p.date, (taken.get(p.date) ?? 0) + 1);
    const nextSlot = slotFinder(taken, settings.perDay);
    for (const c of fresh) {
      const r = records[c.contactId];
      const f = factsOf(c, r);
      const page = r?.pageCaption || PAGE_CAPTIONS[versionFor(c.contactId)](f);
      const group = r?.groupCaption || GROUP_CAPTIONS[versionFor(c.contactId, 1)](f);
      let calendarPostId = r?.calendarPostId;
      let scheduledFor = r?.scheduledFor;
      if (!calendarPostId) {
        scheduledFor = nextSlot();
        const post = await addPost(WELCOME_DEPT, {
          title: `Welcome: ${f.full}`, date: scheduledFor, time: settings.time, type: 'welcome', platforms: ['fb-page', 'fb-group'],
          status: 'drafting', assignee: user.id, notes: captionNotes(page, group), repeat: 'none',
        }, user.id);
        calendarPostId = post.id;
      }
      patches[c.contactId] = { ...patches[c.contactId], pageCaption: page, groupCaption: group, calendarPostId, scheduledFor, autoPrepared: true, status: r?.status && r.status !== 'new' ? r.status : 'ready' };
    }
  }

  // 2. Photo request unanswered for 2 days → switch to the no-photo version.
  for (const c of clients) {
    const r = merged(c.contactId);
    if (r?.photoRequestedAt && !r.photoFileId && !r.noPhoto && Date.now() - r.photoRequestedAt > PHOTO_WAIT_MS) {
      patches[c.contactId] = { ...patches[c.contactId], noPhoto: true };
    }
  }

  // 3. Welcome graphic once there's a photo or "no photo" (again if the photo changed), a few per visit.
  if (chatIsConfigured() && storeIsPersistent()) {
    let started = 0;
    for (const c of clients) {
      if (started >= MAX_GRAPHICS_PER_RUN) break;
      const r = merged(c.contactId);
      if (!r || !OPEN.includes(r.status) || (!r.photoFileId && !r.noPhoto)) continue;
      const g = r.graphic;
      const stale = g && g.status !== 'pending' && g.withPhoto !== Boolean(r.photoFileId);
      if (g && !stale) continue;
      patches[c.contactId] = { ...patches[c.contactId], graphic: await requestGraphic(user, c, r) };
      started++;
    }
  }

  if (!Object.keys(patches).length) return records;
  return saveRecords(patches, user.id);
}

// The hub's side of New Client Welcome Posts: where each new client is in the process (photo, captions,
// review, scheduled, posted) and the tool's settings. Keap itself is never changed.

import { getJSON, setJSON } from '@/lib/store';

export const WELCOME_STATUSES = ['new', 'photo', 'ready', 'review', 'scheduled', 'posted', 'skipped'] as const;
export type WelcomeStatus = typeof WELCOME_STATUSES[number];

export interface WelcomeRecord {
  contactId: number;
  status: WelcomeStatus;
  business?: string;        // overrides what Keap has
  city?: string;
  coach?: string;
  photoFileId?: string;
  noPhoto?: boolean;        // use the branded no-photo template
  photoRequestedAt?: number;
  pageCaption?: string;
  groupCaption?: string;
  scheduledFor?: string;    // YYYY-MM-DD
  notes?: string;
  calendarPostId?: string;
  /** Captions and calendar slot were filled in automatically when the client first appeared. */
  autoPrepared?: boolean;
  /** The welcome graphic the assistant is making or made (in a background chat). */
  graphic?: { conversationId: string; messageId: string; status: 'pending' | 'done' | 'error'; fileId?: string; withPhoto: boolean; at: number };
  by?: string;
  updated?: number;
}

export interface WelcomeSettings {
  tagIds: number[];          // Keap tags that mark a new client
  tagNames: string[];
  days: number;              // how far back to look
  coachField: 'owner' | `custom:${number}`;
  coachFieldLabel?: string;
  /** Fill in captions, calendar slots and graphics automatically. */
  auto: boolean;
  perDay: number;           // welcome posts per weekday on the calendar
  time: string;             // HH:MM
}

const RECORDS = 'welcome:records';
const SETTINGS = 'welcome:settings';
export const DEFAULT_SETTINGS: WelcomeSettings = { tagIds: [], tagNames: [], days: 14, coachField: 'owner', auto: true, perDay: 2, time: '10:00' };

export const listRecords = () => getJSON<Record<string, WelcomeRecord>>(RECORDS, {});
export const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await getJSON<Partial<WelcomeSettings>>(SETTINGS, {})) });
export const saveSettings = (s: WelcomeSettings) => setJSON(SETTINGS, s);

/** Saves several records at once (one write). */
export async function saveRecords(patches: Record<number, Partial<WelcomeRecord>>, by: string) {
  const all = await listRecords();
  for (const [id, patch] of Object.entries(patches)) {
    const cur = all[id] ?? { contactId: Number(id), status: 'new' as WelcomeStatus };
    all[id] = { ...cur, ...patch, contactId: Number(id), by, updated: Date.now() };
  }
  await setJSON(RECORDS, all);
  return all;
}

export async function saveRecord(contactId: number, patch: Partial<WelcomeRecord>, by: string) {
  const all = await listRecords();
  const cur = all[contactId] ?? { contactId, status: 'new' as WelcomeStatus };
  all[contactId] = { ...cur, ...patch, contactId, by, updated: Date.now() };
  await setJSON(RECORDS, all);
  return all[contactId];
}

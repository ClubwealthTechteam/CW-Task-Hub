// The Events team's own details for each venue (Google My Maps can't hold these): description, type,
// status, tags, contact, follow-up dates, booking/cost and files. Stored in the hub store; Google is
// never written. Every save is checked against the version the person started from (so two people
// can't silently overwrite each other) and logged in the venue's history.

import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { getJSON, setJSON } from '@/lib/store';

export const VENUE_TYPES = ['Realtor Association', 'Builders Association', 'Hotel', 'Convention Center'] as const;
export const VENUE_STATUSES = ['Renting', 'Not Renting', 'Not Available', 'Not contacted yet'] as const;
export const CONTRACT_STATUSES = ['No contract', 'Quote received', 'Contract sent', 'Signed', 'Cancelled'] as const;

export interface VenueFileRef { id: string; name: string; type: string; size: number; at: number; by: string }

export interface VenueInfo {
  description?: string;
  type?: string;
  status?: string;
  tags?: string[];
  contact?: string;
  phone?: string;
  website?: string;
  address?: string;
  classroom?: string;     // max seats, classroom setup
  theater?: string;       // max seats, theater setup
  rate?: string;
  deposit?: string;
  cancellation?: string;
  contract?: string;
  lastContacted?: string; // YYYY-MM-DD
  followUp?: string;      // YYYY-MM-DD
  notes?: string;
  files?: VenueFileRef[];
  updatedAt?: number;
  updatedBy?: string;
}

/** Field labels, in the order they show in the history and the export. */
export const FIELD_LABELS: Record<string, string> = {
  type: 'Type', status: 'Status', description: 'Description', tags: 'Tags', classroom: 'Classroom max', theater: 'Theater max', rate: 'Rate',
  deposit: 'Deposit', cancellation: 'Cancellation terms', contract: 'Contract', contact: 'Contact', phone: 'Phone',
  website: 'Website', address: 'Address', lastContacted: 'Last contacted', followUp: 'Follow-up', notes: 'Notes',
};

const KEY = 'venues:info';
const historyKey = (id: string) => `venues:history:${id}`;

export interface VenueChange { at: number; by: string; field: string; from?: string; to?: string }

/** Only these people (plus super admins) open and edit venues: not everyone who joins the Events team later. */
export const VENUE_PEOPLE = ['ali', 'andrea', 'liz'];
export const canUseVenues = (user: Person | null) => Boolean(user) && (isSuperAdmin(user) || VENUE_PEOPLE.includes(user!.id));

export const allVenueInfo = () => getJSON<Record<string, VenueInfo>>(KEY, {});
export const venueHistory = (id: string) => getJSON<VenueChange[]>(historyKey(id), []);

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : undefined) || undefined;
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const oneOf = (list: readonly string[], v: unknown) => list.find((x) => x === v);

/** Cleans what the browser sent: only known fields, known type/status values, short strings. Files are kept server-side. */
export function cleanVenueInfo(b: Record<string, unknown>): VenueInfo {
  const tags = Array.isArray(b.tags)
    ? [...new Set(b.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
    : undefined;
  return {
    description: clip(b.description, 2000),
    type: oneOf(VENUE_TYPES, b.type),
    status: oneOf(VENUE_STATUSES, b.status),
    tags: tags?.length ? tags : undefined,
    contact: clip(b.contact, 300),
    phone: clip(b.phone, 60),
    website: clip(b.website, 300),
    address: clip(b.address, 300),
    classroom: clip(b.classroom, 40),
    theater: clip(b.theater, 40),
    rate: clip(b.rate, 120),
    deposit: clip(b.deposit, 120),
    cancellation: clip(b.cancellation, 600),
    contract: oneOf(CONTRACT_STATUSES, b.contract),
    lastContacted: date(b.lastContacted),
    followUp: date(b.followUp),
    notes: clip(b.notes, 4000),
  };
}

const show = (v: unknown) => (v == null ? undefined : Array.isArray(v) ? v.join(', ') : String(v)) || undefined;

export class VenueConflict extends Error {
  constructor(public current: VenueInfo) { super('Someone else saved this venue after you opened it'); }
}

/**
 * Saves the team's details for a venue. `baseUpdatedAt` is the version the person started from: if someone
 * saved in between, nothing is written and VenueConflict carries their version. Changes go to the history.
 */
export async function saveVenueInfo(id: string, info: VenueInfo, by: string, baseUpdatedAt?: number): Promise<VenueInfo> {
  const all = await allVenueInfo();
  const before = all[id] ?? {};
  if ((before.updatedAt ?? 0) !== (baseUpdatedAt ?? 0)) throw new VenueConflict(before);
  const now = Date.now();
  const saved: VenueInfo = { ...info, files: before.files, updatedAt: now, updatedBy: by };
  const changes: VenueChange[] = Object.keys(FIELD_LABELS)
    .filter((k) => show(before[k as keyof VenueInfo]) !== show(saved[k as keyof VenueInfo]))
    .map((k) => ({ at: now, by, field: k, from: show(before[k as keyof VenueInfo])?.slice(0, 300), to: show(saved[k as keyof VenueInfo])?.slice(0, 300) }));
  if (!changes.length) return before;
  all[id] = saved;
  await setJSON(KEY, all);
  await logChanges(id, changes);
  return saved;
}

export async function logChanges(id: string, changes: VenueChange[]) {
  const h = await venueHistory(id);
  await setJSON(historyKey(id), [...changes.reverse(), ...h].slice(0, 200));
}

/** Files are added and removed on their own (not through the form), so they don't conflict with edits. */
export async function setVenueFiles(id: string, update: (files: VenueFileRef[]) => VenueFileRef[]) {
  const all = await allVenueInfo();
  const cur = all[id] ?? {};
  const files = update(cur.files ?? []);
  all[id] = { ...cur, files: files.length ? files : undefined };
  await setJSON(KEY, all);
  return files;
}

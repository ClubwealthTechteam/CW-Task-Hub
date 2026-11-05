// The Events team's own details for each venue (Google My Maps can't hold these): description, type,
// status, contact, notes and free tags. Stored in the hub store under one key; Google is never written.

import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { getJSON, setJSON } from '@/lib/store';

export const VENUE_TYPES = ['Realtor Association', 'Builders Association', 'Hotel', 'Convention Center'] as const;
export const VENUE_STATUSES = ['Renting', 'Not Renting', 'Not Available', 'Not contacted yet'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];
export type VenueStatus = (typeof VENUE_STATUSES)[number];

export interface VenueInfo {
  description?: string;
  type?: VenueType;
  status?: VenueStatus;
  tags?: string[];        // anything else the team wants (e.g. "Parking", "AV included")
  contact?: string;       // name / phone / email, as the team types it
  website?: string;
  capacity?: string;
  rate?: string;
  notes?: string;
  updatedAt?: number;
  updatedBy?: string;     // person id
}

const KEY = 'venues:info';

/** Events team and super admins open and edit venues. */
export const canUseVenues = (user: Person | null) => Boolean(user) && (isSuperAdmin(user) || user!.departments.includes('events'));

export const allVenueInfo = () => getJSON<Record<string, VenueInfo>>(KEY, {});

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : undefined) || undefined;

/** Cleans what the browser sent: only known fields, known type/status values, short strings. */
export function cleanVenueInfo(b: Record<string, unknown>): VenueInfo {
  const type = VENUE_TYPES.find((t) => t === b.type);
  const status = VENUE_STATUSES.find((s) => s === b.status);
  const tags = Array.isArray(b.tags)
    ? [...new Set(b.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
    : undefined;
  return {
    description: clip(b.description, 2000),
    type, status,
    tags: tags?.length ? tags : undefined,
    contact: clip(b.contact, 300),
    website: clip(b.website, 300),
    capacity: clip(b.capacity, 60),
    rate: clip(b.rate, 120),
    notes: clip(b.notes, 4000),
  };
}

export async function saveVenueInfo(id: string, info: VenueInfo, by: string): Promise<VenueInfo> {
  const all = await allVenueInfo();
  const saved = { ...info, updatedAt: Date.now(), updatedBy: by };
  all[id] = saved;
  await setJSON(KEY, all);
  return saved;
}

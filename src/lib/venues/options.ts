// The fixed choices for a venue (type, status, amenities) and how older saved values read today.
// No server imports here: the venues page uses the same lists and rules in the browser.

export const VENUE_TYPES = ['Hotel', 'Association', 'Home Builder', 'Convention Center', 'Apartment Association'] as const;
export const VENUE_STATUSES = ['Renting', 'Not Renting'] as const;
export const VENUE_AMENITIES = [
  'Free parking', 'Coffee included', 'No coffee', 'AV included', 'Bring projector',
  'Easel', 'Flipchart', 'Lavalier', 'Microphone', 'COI needed',
] as const;

/** Picking one of these unpicks the other. */
export const EXCLUSIVE_AMENITIES: readonly (readonly [string, string])[] = [['Coffee included', 'No coffee']];

/** Older saved types, as they read now. Hotel and Convention Center are unchanged. */
const OLD_TYPES: Record<string, string> = { 'Realtor Association': 'Association', 'Builders Association': 'Home Builder' };
/** Older saved statuses, as they read now. '' means no status. */
const OLD_STATUSES: Record<string, string> = { 'Not Available': 'Not Renting', 'Not contacted yet': '' };

/** A saved type as it reads today (old names mapped; anything unknown reads as no type). */
export function readVenueType(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = OLD_TYPES[v] ?? v;
  return (VENUE_TYPES as readonly string[]).includes(t) ? t : undefined;
}

/** A saved status as it reads today ("Not Available" → "Not Renting", "Not contacted yet" → no status). */
export function readVenueStatus(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v in OLD_STATUSES ? OLD_STATUSES[v] : v;
  return (VENUE_STATUSES as readonly string[]).includes(s) ? s : undefined;
}

/** The amenity option a tag matches (case and spaces ignored), spelled as the option. */
export function amenityOf(tag: unknown): string | undefined {
  const t = String(tag ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return t ? VENUE_AMENITIES.find((a) => a.toLowerCase() === t) : undefined;
}

/**
 * Only the fixed amenities, in the list's order, each once. When both of an exclusive pair are there,
 * the one that came first is kept. Anything else (old free-text tags) is dropped.
 */
export function cleanAmenities(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const picked: string[] = [];
  for (const t of tags) {
    const a = amenityOf(t);
    if (!a || picked.includes(a)) continue;
    if (EXCLUSIVE_AMENITIES.some((pair) => pair.includes(a) && pair.some((o) => o !== a && picked.includes(o)))) continue;
    picked.push(a);
  }
  return VENUE_AMENITIES.filter((a) => picked.includes(a));
}

/** Turns an amenity on or off; turning one of an exclusive pair on turns the other off. */
export function toggleAmenity(current: readonly string[], amenity: string): string[] {
  if (current.includes(amenity)) return current.filter((a) => a !== amenity);
  const others = EXCLUSIVE_AMENITIES.flatMap((pair) => (pair.includes(amenity) ? pair.filter((o) => o !== amenity) : []));
  const next = [...current.filter((a) => !others.includes(a)), amenity];
  return VENUE_AMENITIES.filter((a) => next.includes(a));
}

/**
 * How saved details read today: old type and status names mapped, tags that match an amenity spelled as
 * the amenity. Tags that match none are left as they are (they're dropped only when the venue is next
 * saved), so nothing in the store is rewritten just by reading it.
 */
export function readVenueInfo<T extends { type?: string; status?: string; tags?: string[] }>(i: T): T {
  const out = { ...i, type: readVenueType(i.type), status: readVenueStatus(i.status) };
  if (Array.isArray(i.tags)) {
    const tags = [...new Set(i.tags.map((t) => amenityOf(t) ?? t))];
    out.tags = tags.length ? tags : undefined;
  }
  for (const k of ['type', 'status', 'tags'] as const) if (out[k] === undefined) delete out[k];
  return out;
}

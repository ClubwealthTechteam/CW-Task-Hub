// New clients from Keap (read-only): everyone who got one of the chosen "new client" tags in the last
// few days, with their business, city, coach and Facebook profile when Keap has them.

import { callKeap } from '@/lib/integrations/keap/client';
import type { WelcomeSettings } from './store';
import { getFinding } from './finder';

export interface NewClient {
  contactId: number;
  first: string;
  last: string;
  email?: string;
  business?: string;
  city?: string;
  coach?: string;
  facebook?: string;
  signedUp: string;          // when the tag was applied, or when Claude says they signed up (ISO)
  tag: string;
  /** Claude's reason for counting them as a new client. */
  why?: string;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MAX_CLIENTS = 60;
const TTL = 5 * 60 * 1000;
let cache: { key: string; at: number; clients: NewClient[] } | null = null;
let usersCache: { at: number; byId: Map<number, string> } | null = null;

async function users() {
  if (usersCache && Date.now() - usersCache.at < 60 * 60 * 1000) return usersCache.byId;
  const body = (await callKeap('users.list', { limit: 200 }).catch(() => null)) as Row | null;
  const byId = new Map<number, string>((body?.users ?? []).map((u: Row) => [Number(u.id), [u.given_name, u.family_name].filter(Boolean).join(' ') || u.email_address]));
  usersCache = { at: Date.now(), byId };
  return byId;
}

/** Contacts tagged with `tagId` since `since`, newest first (pages through the tag's contacts). */
async function taggedSince(tagId: number, since: number) {
  const out: { id: number; first: string; last: string; email?: string; applied: string }[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const body = (await callKeap('tags.contacts', { tagId, limit: 1000, offset })) as Row;
    const rows: Row[] = body?.contacts ?? [];
    for (const r of rows) {
      const applied = r.date_applied ?? r.dateApplied;
      if (applied && Date.parse(applied) >= since) out.push({ id: Number(r.contact?.id), first: r.contact?.first_name ?? '', last: r.contact?.last_name ?? '', email: r.contact?.email, applied });
    }
    if (rows.length < 1000) break;
  }
  return out;
}

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function newClients(settings: WelcomeSettings): Promise<NewClient[]> {
  const finding = settings.find === 'tag' ? null : await getFinding();
  if (settings.find === 'tag' ? !settings.tagIds.length : !finding?.clients.length) return [];
  const key = JSON.stringify([settings.find, settings.tagIds, settings.days, settings.coachField, finding?.at]);
  if (cache && cache.key === key && Date.now() - cache.at < TTL) return cache.clients;

  const since = Date.now() - settings.days * 24 * 60 * 60 * 1000;
  const why = new Map((finding?.clients ?? []).map((c) => [c.id, c.why]));
  const tagged = finding
    ? finding.clients.map((c) => ({ id: c.id, first: c.first, last: c.last, email: c.email, applied: c.signedUp, tag: 'Found by Claude' }))
    : (await Promise.all(settings.tagIds.map(async (id, i) => (await taggedSince(id, since)).map((c) => ({ ...c, tag: settings.tagNames[i] ?? String(id) }))))).flat();
  // One row per person, keeping the earliest tag date.
  const byId = new Map<number, (typeof tagged)[number]>();
  for (const c of tagged) if (!byId.has(c.id) || c.applied < byId.get(c.id)!.applied) byId.set(c.id, c);
  const list = [...byId.values()].sort((a, b) => b.applied.localeCompare(a.applied)).slice(0, MAX_CLIENTS);

  const owners = settings.coachField === 'owner' ? await users() : null;
  const customId = settings.coachField.startsWith('custom:') ? Number(settings.coachField.slice(7)) : null;
  const clients = await inBatches(list, 5, async (c): Promise<NewClient> => {
    const d = (await callKeap('contacts.get', { contactId: c.id, optional_properties: 'custom_fields,social_accounts' }).catch(() => null)) as Row | null;
    const addr: Row | undefined = (d?.addresses ?? []).find((a: Row) => a.locality) ?? d?.addresses?.[0];
    const fb: Row | undefined = (d?.social_accounts ?? []).find((s: Row) => /facebook/i.test(s.type ?? ''));
    const coachValue = owners ? owners.get(Number(d?.owner_id)) : customId ? (d?.custom_fields ?? []).find((f: Row) => Number(f.id) === customId)?.content : undefined;
    return {
      contactId: c.id,
      first: d?.given_name ?? c.first,
      last: d?.family_name ?? c.last,
      email: d?.email_addresses?.[0]?.email ?? c.email,
      business: d?.company?.company_name || d?.company_name || undefined,
      city: addr ? [addr.locality, addr.region].filter(Boolean).join(', ') : undefined,
      coach: coachValue ? String(coachValue) : undefined,
      facebook: fb?.name ? (String(fb.name).startsWith('http') ? fb.name : `https://www.facebook.com/${fb.name}`) : undefined,
      signedUp: c.applied,
      tag: c.tag,
      why: why.get(c.id),
    };
  });
  cache = { key, at: Date.now(), clients };
  return clients;
}

export const clearClientCache = () => { cache = null; };

/** Keap tags whose name contains `q` (for choosing the "new client" tag). */
export async function findTags(q: string) {
  const body = (await callKeap('tags.list', { name: q, limit: 50 })) as Row;
  return ((body?.tags ?? []) as Row[]).map((t) => ({ id: Number(t.id), name: String(t.name), category: t.category?.name as string | undefined }));
}

/** Custom contact fields in Keap that might hold the coach. */
export async function customFields() {
  const body = (await callKeap('contacts.model', {})) as Row;
  return ((body?.custom_fields ?? []) as Row[]).map((f) => ({ id: Number(f.id), label: String(f.label ?? f.field_name ?? f.id) }));
}

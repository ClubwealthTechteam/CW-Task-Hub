// The Club Wealth member directory for referrals, read from Keap: everyone with the chosen member tag(s),
// with business, city, state, phone and industry. Contact details are fetched a few at a time and kept in
// the hub's store, so a big list builds up over a few syncs without slowing anything down.

import { callKeap } from '@/lib/integrations/keap/client';
import { getJSON, setJSON } from '@/lib/store';
import type { ReferralSettings } from './store';

export interface Member {
  id: number;
  name: string;
  first: string;
  business?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  industry?: string;
  fetchedAt: number;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const IDS = 'referral:member-ids';
const DETAILS = 'referral:members';
const IDS_TTL = 6 * 60 * 60 * 1000;
const DETAILS_TTL = 7 * 24 * 60 * 60 * 1000;
const PER_SYNC = 40;

async function taggedIds(tagIds: number[]) {
  const ids = new Set<number>();
  for (const tagId of tagIds) {
    for (let offset = 0; offset < 20000; offset += 1000) {
      const body = (await callKeap('tags.contacts', { tagId, limit: 1000, offset })) as Row;
      const rows: Row[] = body?.contacts ?? [];
      rows.forEach((r) => r.contact?.id && ids.add(Number(r.contact.id)));
      if (rows.length < 1000) break;
    }
  }
  return [...ids];
}

async function details(id: number, industryField?: number): Promise<Member> {
  const d = (await callKeap('contacts.get', { contactId: id, optional_properties: 'custom_fields' })) as Row;
  const addr: Row | undefined = (d?.addresses ?? []).find((a: Row) => a.locality) ?? d?.addresses?.[0];
  const phone: Row | undefined = (d?.phone_numbers ?? []).find((p: Row) => p.number);
  const industry = industryField ? (d?.custom_fields ?? []).find((f: Row) => Number(f.id) === industryField)?.content : undefined;
  return {
    id,
    first: d?.given_name ?? '',
    name: [d?.given_name, d?.family_name].filter(Boolean).join(' ') || `Contact ${id}`,
    business: d?.company?.company_name || d?.company_name || undefined,
    city: addr?.locality || undefined,
    state: addr?.region || undefined,
    phone: phone?.number || undefined,
    email: d?.email_addresses?.[0]?.email,
    industry: industry ? String(industry) : undefined,
    fetchedAt: Date.now(),
  };
}

/** The directory, filling in up to PER_SYNC missing or old members per call. */
export async function syncMembers(settings: ReferralSettings, force = false) {
  if (!settings.tagIds.length) return { members: [] as Member[], total: 0, pending: 0 };
  let ids = await getJSON<{ key: string; at: number; ids: number[] } | null>(IDS, null);
  const key = JSON.stringify([settings.tagIds, settings.industryField]);
  if (force || !ids || ids.key !== key || Date.now() - ids.at > IDS_TTL) {
    ids = { key, at: Date.now(), ids: await taggedIds(settings.tagIds) };
    await setJSON(IDS, ids);
  }
  const cache = await getJSON<Record<string, Member>>(DETAILS, {});
  const stale = ids.ids.filter((id) => !cache[id] || Date.now() - cache[id].fetchedAt > DETAILS_TTL);
  const batch = stale.slice(0, PER_SYNC);
  for (let i = 0; i < batch.length; i += 5) {
    const got = await Promise.all(batch.slice(i, i + 5).map((id) => details(id, settings.industryField).catch(() => null)));
    for (const m of got) if (m) cache[m.id] = m;
  }
  if (batch.length) await setJSON(DETAILS, cache);
  const keep = new Set(ids.ids);
  const members = Object.values(cache).filter((m) => keep.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
  return { members, total: ids.ids.length, pending: Math.max(0, stale.length - batch.length) };
}

export const cachedMembers = async () => Object.values(await getJSON<Record<string, Member>>(DETAILS, {}));

/** Forget fetched details (e.g. when the industry field changes), so the next syncs read them again. */
export const clearMemberDetails = () => setJSON(DETAILS, {});

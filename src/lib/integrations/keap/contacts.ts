// Contact lookup for the workspace's Keap panel. Read-only: search contacts and read one contact's tags.

import { callKeap, type KeapError } from './client';

export interface KeapContactSummary { id: number; name: string; email: string | null }
export interface KeapContactDetail extends KeapContactSummary { tags: string[]; created?: string }

interface RawContact {
  id: number;
  given_name?: string;
  family_name?: string;
  email_addresses?: { email?: string; field?: string }[];
  date_created?: string;
}

const summary = (c: RawContact): KeapContactSummary => ({
  id: c.id,
  name: [c.given_name, c.family_name].filter(Boolean).join(' ') || '(no name)',
  email: c.email_addresses?.find((e) => e.field === 'EMAIL1')?.email ?? c.email_addresses?.[0]?.email ?? null,
});

async function list(params: Record<string, unknown>) {
  const body = (await callKeap('contacts.list', { limit: 10, ...params })) as { contacts?: RawContact[] };
  return body?.contacts ?? [];
}

/** Finds contacts by email, or by first and/or last name. */
export async function searchContacts(q: string): Promise<KeapContactSummary[]> {
  const query = q.trim();
  if (query.includes('@')) return (await list({ email: query })).map(summary);
  const [first, ...rest] = query.split(/\s+/);
  const last = rest.join(' ');
  const batches = last
    ? [await list({ given_name: first, family_name: last })]
    : await Promise.all([list({ given_name: first }), list({ family_name: first })]);
  const seen = new Map<number, KeapContactSummary>();
  for (const c of batches.flat()) if (!seen.has(c.id)) seen.set(c.id, summary(c));
  return [...seen.values()].slice(0, 10);
}

export async function contactWithTags(id: number): Promise<KeapContactDetail> {
  const [contact, tags] = await Promise.all([
    callKeap('contacts.get', { contactId: id }) as Promise<RawContact>,
    callKeap('contacts.tags.list', { contactId: id, limit: 100 }) as Promise<{ tags?: { tag?: { name?: string } }[] }>,
  ]);
  return {
    ...summary(contact),
    created: contact.date_created,
    tags: (tags?.tags ?? []).map((t) => t.tag?.name).filter((n): n is string => Boolean(n)),
  };
}

/** A plain-language error for the people using the panel. */
export function keapMessage(err: KeapError) {
  if (err.message?.startsWith('The hub is view-only')) return err.message;
  if (err.status === 401 || err.status === 403) return 'Keap rejected the hub’s key. Ask Miguel to check KEAP_API_KEY.';
  if (err.status === 429) return 'Keap is busy. Try again in a minute.';
  return err.message || 'Keap couldn’t be reached';
}

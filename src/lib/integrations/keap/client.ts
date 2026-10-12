// Thin Keap REST client. The API key stays on the server (KEAP_API_KEY); the browser never sees it.

import { keapCapability, type KeapCapability } from './capabilities';

const BASE = 'https://api.infusionsoft.com/crm/rest';

export const keapConfigured = () => Boolean(process.env.KEAP_API_KEY);

export class KeapError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) {
    super(message);
  }
}

/** Fill {placeholders} in the path from params; returns the path and the params left over. */
function buildPath(cap: KeapCapability, params: Record<string, unknown>) {
  const rest = { ...params };
  const path = cap.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = rest[key];
    delete rest[key];
    if (value === undefined || value === null || value === '') throw new KeapError(`Missing "${key}"`, 400);
    return encodeURIComponent(String(value));
  });
  return { path, rest };
}

export async function callKeap(capabilityId: string, params: Record<string, unknown> = {}) {
  const cap = keapCapability(capabilityId);
  if (!cap) throw new KeapError(`Unknown Keap action "${capabilityId}"`, 404);
  if (!keapConfigured()) throw new KeapError('Keap is not connected yet. Add KEAP_API_KEY in Vercel.', 503);

  const { path, rest } = buildPath(cap, params);
  const url = new URL(BASE + path);
  const init: RequestInit = {
    method: cap.method,
    headers: { 'X-Keap-API-Key': process.env.KEAP_API_KEY as string, Accept: 'application/json' },
    cache: 'no-store',
  };
  if (cap.method === 'GET' || cap.method === 'DELETE') {
    for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  } else {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(rest);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) throw new KeapError(`Keap returned ${res.status}`, res.status, body);
  return body;
}

// Named helpers the automations use, so their code reads like the workflow.
export const keap = {
  findContactByEmail: (email: string) => callKeap('contacts.list', { email, limit: 5 }),
  applyTag: (contactId: number, tagId: number) => callKeap('contacts.tags.apply', { contactId, tagIds: [tagId] }),
  removeTag: (contactId: number, tagId: number) => callKeap('contacts.tags.remove', { contactId, tagId }),
  triggerGoal: (integration: string, callName: string, contactId: number) =>
    callKeap('campaigns.goal.achieve', { integration, callName, contact_id: contactId }),
  addNote: (contactId: number, title: string, body: string) =>
    callKeap('notes.create', { contact_id: contactId, title, body, type: 'Other' }),
};

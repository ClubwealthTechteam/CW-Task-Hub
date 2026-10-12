// Integrations a super admin adds in the app (any webhook or REST API). Stored server-side;
// the secret is never sent back to the browser.

import { getJSON, setJSON } from '@/lib/store';
import type { CustomIntegration, PublicCustomIntegration } from './types';

const KEY = 'integrations:custom';

export const listCustom = () => getJSON<CustomIntegration[]>(KEY, []);

export const toPublic = ({ secret, ...rest }: CustomIntegration): PublicCustomIntegration => ({ ...rest, hasSecret: Boolean(secret) });

export async function addCustom(input: Omit<CustomIntegration, 'id' | 'createdAt'>) {
  const all = await listCustom();
  const item: CustomIntegration = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await setJSON(KEY, [...all, item]);
  return item;
}

export async function removeCustom(id: string) {
  const all = await listCustom();
  await setJSON(KEY, all.filter((i) => i.id !== id));
}

/** Send a JSON payload to a custom integration (used by automations and the "Test" button). */
export async function callCustom(id: string, payload: unknown) {
  const item = (await listCustom()).find((i) => i.id === id);
  if (!item) throw new Error('Integration not found');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (item.secret) headers[item.authHeader || 'Authorization'] = item.secret;
  const res = await fetch(item.url, { method: 'POST', headers, body: JSON.stringify(payload) });
  return { ok: res.ok, status: res.status };
}

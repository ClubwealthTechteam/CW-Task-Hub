// Eventbrite client. View-only: it refuses anything that isn't a GET, so the hub never creates, edits,
// cancels or refunds anything in Eventbrite. The private token stays on the server (EVENTBRITE_TOKEN);
// EVENTBRITE_ORG_ID is optional (defaults to the token's first organization).

import { eventbriteCapability } from './capabilities';
import { callRest, IntegrationError } from '../http';

const BASE = 'https://www.eventbriteapi.com';

export const eventbriteConfigured = () => Boolean(process.env.EVENTBRITE_TOKEN);

let cachedOrg: string | null = null;

async function raw(capabilityId: string, params: Record<string, unknown>) {
  const cap = eventbriteCapability(capabilityId);
  if (!cap) throw new IntegrationError(`Unknown Eventbrite view "${capabilityId}"`, 404);
  if (cap.method !== 'GET') throw new IntegrationError('The hub is view-only for Eventbrite. Nothing there can be changed from here.', 403);
  if (!eventbriteConfigured()) throw new IntegrationError('Eventbrite is not connected yet. Add EVENTBRITE_TOKEN in Vercel.', 503);
  return callRest(BASE, cap, params, { Authorization: `Bearer ${process.env.EVENTBRITE_TOKEN}` });
}

export async function organizationId(): Promise<string> {
  if (process.env.EVENTBRITE_ORG_ID) return process.env.EVENTBRITE_ORG_ID;
  if (cachedOrg) return cachedOrg;
  const body = (await raw('organizations', {})) as { organizations?: { id: string }[] };
  const id = body?.organizations?.[0]?.id;
  if (!id) throw new IntegrationError('This Eventbrite account has no organization', 404);
  cachedOrg = id;
  return id;
}

/** Calls a view; fills in the organization automatically for organization views. */
export async function callEventbrite(capabilityId: string, params: Record<string, unknown> = {}) {
  const cap = eventbriteCapability(capabilityId);
  if (cap?.path.includes('{organizationId}') && !params.organizationId) params = { ...params, organizationId: await organizationId() };
  return raw(capabilityId, params);
}

export function eventbriteMessage(err: IntegrationError) {
  if (err.message?.startsWith('The hub is view-only')) return err.message;
  if (err.status === 401 || err.status === 403) return 'Eventbrite rejected the hub’s token. Ask Miguel to check EVENTBRITE_TOKEN.';
  if (err.status === 429) return 'Eventbrite is busy. Try again in a minute.';
  return err.message || 'Eventbrite couldn’t be reached';
}

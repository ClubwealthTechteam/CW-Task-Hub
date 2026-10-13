// Thin Keap REST client. The API key stays on the server (KEAP_API_KEY); the browser never sees it.
// View-only: every call goes through callKeap, which refuses anything that isn't a read.

import { isKeapRead, keapCapability } from './capabilities';
import { callRest, IntegrationError } from '../http';

// KEAP_BASE_URL is only for local testing against a stand-in server.
const BASE = process.env.KEAP_BASE_URL || 'https://api.infusionsoft.com/crm/rest';

export const keapConfigured = () => Boolean(process.env.KEAP_API_KEY);

export { IntegrationError as KeapError };

export async function callKeap(capabilityId: string, params: Record<string, unknown> = {}) {
  const cap = keapCapability(capabilityId);
  if (!cap) throw new IntegrationError(`Unknown Keap action "${capabilityId}"`, 404);
  // View-only: the hub never creates, changes, deletes, sends or starts anything in Keap.
  if (!isKeapRead(cap)) throw new IntegrationError('The hub is view-only for Keap. Nothing in Keap can be changed from here.', 403);
  if (!keapConfigured()) throw new IntegrationError('Keap is not connected yet. Add KEAP_API_KEY in Vercel.', 503);
  return callRest(BASE, cap, params, { 'X-Keap-API-Key': process.env.KEAP_API_KEY as string });
}

// Named helpers for later automations. While the hub is view-only, the write helpers are refused above.
export const keap = {
  findContactByEmail: (email: string) => callKeap('contacts.list', { email, limit: 5 }),
  applyTag: (contactId: number, tagId: number) => callKeap('contacts.tags.apply', { contactId, tagIds: [tagId] }),
  removeTag: (contactId: number, tagId: number) => callKeap('contacts.tags.remove', { contactId, tagId }),
  triggerGoal: (integration: string, callName: string, contactId: number) =>
    callKeap('campaigns.goal.achieve', { integration, callName, contact_id: contactId }),
  addNote: (contactId: number, title: string, body: string) =>
    callKeap('notes.create', { contact_id: contactId, title, body, type: 'Other' }),
};

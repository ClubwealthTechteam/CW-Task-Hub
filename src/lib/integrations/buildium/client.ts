// Buildium client. Credentials stay on the server: BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET
// (Buildium → Settings → Developer tools / API keys). BUILDIUM_BASE_URL switches to the sandbox.

import { buildiumCapability } from './capabilities';
import { callRest, IntegrationError } from '../http';

const base = () => process.env.BUILDIUM_BASE_URL || 'https://api.buildium.com';

export const buildiumConfigured = () => Boolean(process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET);

export async function callBuildium(capabilityId: string, params: Record<string, unknown> = {}) {
  const cap = buildiumCapability(capabilityId);
  if (!cap) throw new IntegrationError(`Unknown Buildium action "${capabilityId}"`, 404);
  // View-only: the hub never creates or changes anything in Buildium until writes are approved.
  if (cap.method !== 'GET' || cap.writes) throw new IntegrationError('The hub is view-only for Buildium. Nothing there can be changed from here.', 403);
  if (!buildiumConfigured()) throw new IntegrationError('Buildium is not connected yet. Add BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET in Vercel.', 503);
  return callRest(base(), cap, params, {
    'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID as string,
    'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET as string,
  });
}

// Named helpers for Amrissa's automations (reads only while the hub is view-only for Buildium).
export const buildium = {
  openWorkOrders: () => callBuildium('workorders.list', { statuses: 'New,InProgress', limit: 100 }),
  contractors: () => callBuildium('vendors.list', { limit: 200 }),
  property: (propertyId: number) => callBuildium('rentals.get', { propertyId }),
  residentRequests: () => callBuildium('residentrequests.list', { limit: 100 }),
};

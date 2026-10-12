// Buildium actions the hub can call (Amrissa's properties, contractors and maintenance).
// Paths follow the Buildium Open API v1 (https://developer.buildium.com/). Confirm each against the
// docs once API access is approved; the route only runs actions listed here.

import type { HttpMethod } from '../keap/capabilities';

export interface BuildiumCapability {
  id: string;
  group: string;
  label: string;
  method: HttpMethod;
  path: string;
  hint?: string;
  writes?: boolean;
}

export const BUILDIUM_CAPABILITIES: BuildiumCapability[] = [
  // Properties
  { id: 'rentals.list', group: 'Properties', label: 'List rental properties', method: 'GET', path: '/v1/rentals', hint: 'limit/offset; filter by propertyids, status' },
  { id: 'rentals.get', group: 'Properties', label: 'Get a property', method: 'GET', path: '/v1/rentals/{propertyId}' },
  { id: 'units.list', group: 'Properties', label: 'List units', method: 'GET', path: '/v1/rentals/units' },
  { id: 'owners.list', group: 'Properties', label: 'List rental owners', method: 'GET', path: '/v1/rentals/owners' },

  // Maintenance
  { id: 'workorders.list', group: 'Maintenance', label: 'List work orders', method: 'GET', path: '/v1/workorders', hint: 'Filter by status, propertyids, vendorids' },
  { id: 'workorders.get', group: 'Maintenance', label: 'Get a work order', method: 'GET', path: '/v1/workorders/{workOrderId}' },
  { id: 'workorders.create', group: 'Maintenance', label: 'Create a work order', method: 'POST', path: '/v1/workorders', writes: true },
  { id: 'workorders.update', group: 'Maintenance', label: 'Update a work order', method: 'PUT', path: '/v1/workorders/{workOrderId}', writes: true },
  { id: 'tasks.list', group: 'Maintenance', label: 'List tasks', method: 'GET', path: '/v1/tasks' },
  { id: 'residentrequests.list', group: 'Maintenance', label: 'List resident requests', method: 'GET', path: '/v1/tasks/residentrequests', hint: 'Maintenance issues reported by tenants' },
  { id: 'todos.create', group: 'Maintenance', label: 'Create a to-do', method: 'POST', path: '/v1/tasks/todorequests', writes: true },

  // Contractors (vendors)
  { id: 'vendors.list', group: 'Contractors', label: 'List vendors / contractors', method: 'GET', path: '/v1/vendors' },
  { id: 'vendors.get', group: 'Contractors', label: 'Get a vendor', method: 'GET', path: '/v1/vendors/{vendorId}' },
  { id: 'vendors.create', group: 'Contractors', label: 'Add a vendor', method: 'POST', path: '/v1/vendors', writes: true },
  { id: 'bills.list', group: 'Contractors', label: 'List bills (quotes, invoices)', method: 'GET', path: '/v1/bills' },

  // Leasing
  { id: 'leases.list', group: 'Leasing', label: 'List leases', method: 'GET', path: '/v1/leases' },
  { id: 'tenants.list', group: 'Leasing', label: 'List tenants', method: 'GET', path: '/v1/leases/tenants' },
  { id: 'applicants.list', group: 'Leasing', label: 'List rental applicants', method: 'GET', path: '/v1/applicants' },
];

export const buildiumCapability = (id: string) => BUILDIUM_CAPABILITIES.find((c) => c.id === id);

/** The hub is view-only for Buildium: only these (GET) actions can run. */
export const BUILDIUM_READS = BUILDIUM_CAPABILITIES.filter((c) => c.method === 'GET' && !c.writes);

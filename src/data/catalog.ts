// Every task in the hub: the audit list and live automations (static), plus one task per process from the
// Workflow Process Form (read live from the responses sheet). Use these instead of the static AUTOMATIONS
// when form tasks should be included.

import type { DepartmentId } from '@/config/departments';
import { AUTOMATIONS, type Automation } from './automations';
import { getSubmissions } from '@/lib/forms/submissions';
import { formAutomations } from '@/lib/forms/plan';
import { HANDLED_ELSEWHERE } from '@/config/task-layout';

export async function allAutomations(): Promise<Automation[]> {
  return [...AUTOMATIONS, ...formAutomations(await getSubmissions())].filter((a) => !HANDLED_ELSEWHERE[a.id]);
}

export const findAutomation = async (id: string) => (await allAutomations()).find((a) => a.id === id);
export const automationsInDept = async (dept: DepartmentId) => (await allAutomations()).filter((a) => a.department === dept);
export const automationsOwnedByAsync = async (personId: string) => (await allAutomations()).filter((a) => a.ownerId === personId);

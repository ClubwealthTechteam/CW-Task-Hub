// Every task in the hub: the audit list and live automations (static), plus one task per process from the
// Workflow Process Form (read live from the responses sheet). Use these instead of the static AUTOMATIONS
// when form tasks should be included.

import type { DepartmentId } from '@/config/departments';
import { AUTOMATIONS, type Automation } from './automations';
import { getSubmissions } from '@/lib/forms/submissions';
import { formAutomations } from '@/lib/forms/plan';
import { FORM_ONLY, HANDLED_ELSEWHERE } from '@/config/task-layout';

export async function allAutomations(): Promise<Automation[]> {
  const fromForms = formAutomations(await getSubmissions());
  // For FORM_ONLY people, the form replaces the audit list (kept if their form couldn't be read, so the list is never empty).
  const replaced = new Set(FORM_ONLY.filter((id) => fromForms.some((a) => a.ownerId === id)));
  return [...AUTOMATIONS, ...fromForms].filter((a) => !HANDLED_ELSEWHERE[a.id] && !(a.source === 'audit' && replaced.has(a.ownerId)));
}

export const findAutomation = async (id: string) => (await allAutomations()).find((a) => a.id === id);
export const automationsInDept = async (dept: DepartmentId) => (await allAutomations()).filter((a) => a.department === dept);
export const automationsOwnedByAsync = async (personId: string) => (await allAutomations()).filter((a) => a.ownerId === personId);

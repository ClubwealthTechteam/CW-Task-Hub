// The one place that decides who can see what. Pages, API routes and the middleware all call these.

import { DEPARTMENTS, type Department, type DepartmentId } from '@/config/departments';
import type { Person } from '@/config/people';

export const isSuperAdmin = (user: Person | null | undefined) => user?.role === 'super_admin';

export function canViewDepartment(user: Person | null | undefined, dept: DepartmentId): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || user.departments.includes(dept);
}

/** Departments to show as tabs for this person, in order. */
export function visibleDepartments(user: Person | null | undefined): Department[] {
  return DEPARTMENTS.filter((d) => canViewDepartment(user, d.id) && (!d.hidden || isSuperAdmin(user)));
}

/** Team members only see their own tasks; super admins see every task in every department. */
export function canViewAutomation(user: Person | null | undefined, a: { ownerId: string; department: DepartmentId }): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || (a.ownerId === user.id && canViewDepartment(user, a.department));
}

/**
 * For now team members only use EOD reports: every other page sends them to /eod, and the menu shows the rest
 * greyed out ("available soon"). Set to false to open the whole hub to them again.
 */
export const MEMBERS_EOD_ONLY = true;
export const EOD_HOME = '/eod';
export const eodOnly = (user: Person | null | undefined) => MEMBERS_EOD_ONLY && Boolean(user) && !isSuperAdmin(user);

/** Only super admins add, edit or test integrations. */
export const canManageIntegrations = isSuperAdmin;

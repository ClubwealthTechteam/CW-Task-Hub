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

/** Only super admins add, edit or test integrations. */
export const canManageIntegrations = isSuperAdmin;

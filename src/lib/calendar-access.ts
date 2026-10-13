// Who can open and edit a department's content calendar: that department's people and super admins.

import { PEOPLE, type Person } from '@/config/people';
import { canViewDepartment, isSuperAdmin } from '@/lib/access';
import type { DepartmentId } from '@/config/departments';

/** Departments that have a content calendar, and the task that opens it. */
export const CALENDAR_TASKS: Record<string, DepartmentId> = { 'jaymar-9': 'social-media' };

export const calendarDeptForTask = (taskId: string | undefined) => (taskId ? CALENDAR_TASKS[taskId] : undefined);
export const hasCalendar = (dept: string) => Object.values(CALENDAR_TASKS).includes(dept as DepartmentId);
export const canUseCalendar = (user: Person | null | undefined, dept: string) => Boolean(user) && hasCalendar(dept) && canViewDepartment(user, dept as DepartmentId);

/** People a post can be assigned to: the department's team and the super admins. */
export const calendarTeam = (dept: string) => PEOPLE.filter((p) => p.departments.includes(dept as DepartmentId) || isSuperAdmin(p));
export const teamIds = (dept: string) => calendarTeam(dept).map((p) => p.id);

// Server-side helpers for pages and API routes.

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { personById, type Person } from '@/config/people';
import { canViewDepartment } from '@/lib/access';
import type { DepartmentId } from '@/config/departments';
import { SESSION_COOKIE, verifySession } from './session';

export async function getCurrentUser(): Promise<Person | null> {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  return session ? personById(session.uid) ?? null : null;
}

/** For pages: sends signed-out people to /login. */
export async function requireUser(): Promise<Person> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** For pages: 404s (rather than revealing it exists) when someone opens another department. */
export async function requireDepartment(dept: DepartmentId): Promise<Person> {
  const user = await requireUser();
  if (!canViewDepartment(user, dept)) notFound();
  return user;
}

// Server-side helpers for pages and API routes.

import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { personById, type Person } from '@/config/people';
import { canViewDepartment } from '@/lib/access';
import type { DepartmentId } from '@/config/departments';
import { markActive } from '@/lib/adoption';
import { PREVIEW_COOKIE, SESSION_COOKIE, signValue, verifySession } from './session';

/** "Preview as": a super admin sees the hub exactly as one team member does (read-only; writes are blocked). */
export const previewSignature = (realId: string, asId: string) => signValue(`preview:${realId}:${asId}`);

export interface Viewer { user: Person; real: Person; preview: boolean }

export async function getViewer(): Promise<Viewer | null> {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  const real = session ? personById(session.uid) : undefined;
  if (!real) return null;
  const raw = cookies().get(PREVIEW_COOKIE)?.value;
  if (raw && real.role === 'super_admin') {
    const [asId, sig] = raw.split('.');
    const as = personById(asId);
    if (as && sig && sig === (await previewSignature(real.id, as.id))) return { user: as, real, preview: true };
  }
  return { user: real, real, preview: false };
}

/** The person the hub is showing: the signed-in person, or the team member a super admin is previewing. */
export async function getCurrentUser(): Promise<Person | null> {
  return (await getViewer())?.user ?? null;
}

/** For pages: sends signed-out people to /login. */
export async function requireUser(): Promise<Person> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  // Adoption numbers: opening any page counts as a day of using the hub (never while previewing someone).
  if (!viewer.preview) await markActive(viewer.user.id).catch(() => null);
  return viewer.user;
}

/** For pages: 404s (rather than revealing it exists) when someone opens another department. */
export async function requireDepartment(dept: DepartmentId): Promise<Person> {
  const user = await requireUser();
  if (!canViewDepartment(user, dept)) notFound();
  return user;
}

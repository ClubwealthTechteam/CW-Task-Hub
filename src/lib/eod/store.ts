// EOD reports in the hub's store: one list per person (eod:<uid>, newest first, last 120 days).

import { getJSON, setJSON } from '@/lib/store';
import { PEOPLE, type Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import type { EodReport } from './report';

const KEEP = 120;
const key = (uid: string) => `eod:${uid}`;

/** Everyone writes their own (super admins too); super admins also read everyone's. */
export const canWriteEod = (p: Person) => Boolean(p);
export const canReadAllEod = isSuperAdmin;
/** Team members first, then the super admins. */
export const eodPeople = () => [...PEOPLE.filter((p) => !isSuperAdmin(p)), ...PEOPLE.filter((p) => isSuperAdmin(p))];

export const reportsOf = (uid: string) => getJSON<EodReport[]>(key(uid), []);

export async function saveReport(r: EodReport) {
  const list = await reportsOf(r.uid);
  const next = [r, ...list.filter((x) => x.id !== r.id)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP);
  await setJSON(key(r.uid), next);
  return r;
}

/** Submitted reports from everyone, newest submission first (the live feed). */
export async function submittedFeed(limit = 200) {
  const all = await Promise.all(eodPeople().map((p) => reportsOf(p.id)));
  return all.flat().filter((r) => r.status === 'submitted').sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)).slice(0, limit);
}

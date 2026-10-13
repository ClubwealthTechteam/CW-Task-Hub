// The Council page's data (super admins): latest reports, runs, and whether the council is set up.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { listReports, listRuns, saveRuns } from '@/lib/council/store';
import { councilConfigured } from '@/lib/council/run';
import { personById } from '@/config/people';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const runs = await listRuns();
  // A run that never reported within 45 minutes is marked as failed.
  let changed = false;
  for (const r of runs) if (r.status === 'running' && Date.now() - r.at > 45 * 60 * 1000) { r.status = 'error'; r.error = 'The council didn’t report back in time.'; changed = true; }
  if (changed) await saveRuns(runs);
  return NextResponse.json({ configured: councilConfigured(), runs: runs.slice(0, 15).map((r) => ({ ...r, by: r.by === 'schedule' ? r.by : personById(r.by)?.name ?? r.by })), reports: await listReports() });
}

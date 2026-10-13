// A super admin applies or dismisses a clean-up the Database Secretary proposed (hub data only).

import { NextResponse } from 'next/server';
import { getCurrentUser, getViewer } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { listReports, saveReports } from '@/lib/council/store';
import { applyAction } from '@/lib/council/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user) || (await getViewer())?.preview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const reports = await listReports();
  const p = reports.flatMap((r) => r.proposals).find((x) => x.id === String(b.id ?? ''));
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (p.status !== 'open') return NextResponse.json({ error: 'Already handled' }, { status: 409 });
  if (b.decision === 'apply') p.result = await applyAction(p.action);
  p.status = b.decision === 'apply' ? 'applied' : 'dismissed';
  p.by = user.id;
  p.at = Date.now();
  await saveReports(reports);
  return NextResponse.json({ proposal: p });
}

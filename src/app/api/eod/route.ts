// EOD reports. Team members load and save their own (a draft through the day, then Submit); super admins
// get everyone's submitted reports as a live feed.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canReadAllEod, canWriteEod, reportsOf, saveReport, submittedFeed } from '@/lib/eod/store';
import { LIMITS, emptyReport, pacificDate, reportId, type EodEntry, type EodReport } from '@/lib/eod/report';
import { PEOPLE } from '@/config/people';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= pacificDate(Date.now() + DAY) && d >= pacificDate(Date.now() - 30 * DAY);
const time = (v: unknown) => (/^\d{2}:\d{2}$/.test(String(v ?? '')) ? String(v) : '');
const str = (v: unknown, max: number) => String(v ?? '').replace(/\r/g, '').slice(0, max);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const q = new URL(req.url).searchParams;
  if (q.get('feed')) {
    if (!canReadAllEod(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ feed: await submittedFeed() });
  }
  const date = q.get('date') || pacificDate();
  if (!validDate(date)) return NextResponse.json({ error: 'Pick a date within the last 30 days' }, { status: 400 });
  const mine = await reportsOf(user.id);
  return NextResponse.json({
    report: mine.find((r) => r.date === date) ?? emptyReport(user.id, date),
    recent: mine.slice(0, 30),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canWriteEod(user)) return NextResponse.json({ error: 'EOD reports are written by team members' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const date = String(b.date ?? '');
  if (!validDate(date)) return NextResponse.json({ error: 'Pick a date within the last 30 days' }, { status: 400 });

  const entries: EodEntry[] = (Array.isArray(b.entries) ? b.entries : []).slice(0, LIMITS.entries).map((e: Record<string, unknown>, i: number) => ({
    id: str(e.id, 40) || `e_${i}`, start: time(e.start), end: time(e.end), task: str(e.task, LIMITS.task).trim(), notes: str(e.notes, LIMITS.notes), daily: Boolean(e.daily),
  })).filter((e: EodEntry) => e.task || e.notes.trim());
  const submit = Boolean(b.submit);
  if (submit && !entries.length) return NextResponse.json({ error: 'Add at least one task before submitting' }, { status: 400 });

  const prev = (await reportsOf(user.id)).find((r) => r.id === reportId(user.id, date));
  const wasSubmitted = prev?.status === 'submitted';
  const report: EodReport = {
    id: reportId(user.id, date), uid: user.id, date, entries,
    highlights: str(b.highlights, LIMITS.text), blockers: str(b.blockers, LIMITS.text), tomorrow: str(b.tomorrow, LIMITS.text),
    // Once submitted it stays submitted; later saves mark it edited.
    status: submit || wasSubmitted ? 'submitted' : 'draft',
    submittedAt: prev?.submittedAt ?? (submit ? Date.now() : undefined),
    updatedAt: Date.now(),
    edited: wasSubmitted ? true : undefined,
  };
  await saveReport(report);

  if (submit && !wasSubmitted) {
    const first = user.name.split(/\s+/)[0];
    await Promise.all(PEOPLE.filter((p) => canReadAllEod(p) && p.id !== user.id).map((p) =>
      notify(p.id, { kind: 'eod', title: `EOD report · ${first}`, body: `${entries.length} task${entries.length === 1 ? '' : 's'} · ${date}`, href: `/eod#${report.id.replace(':', '-')}` }).catch(() => null)));
  }
  return NextResponse.json({ report });
}

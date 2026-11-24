// For the "REality intro emails (Amrissa)" Claude routine. Needs "Authorization: Bearer <ROUTINES_REPORT_SECRET>"
// (the routines' cloud environment adds it to requests under /api/routines/report).
// GET: { open: the batch still waiting for review (or null), toSend: approved/sending batches, each person
//   still to email with the exact email (subject, html, text) the REality page previewed }.
// POST { action: 'create', rows: [{ row, keapId, first, last, email, location }] } → { batch, url }.
// POST { action: 'claim', id } → claims an approved batch for this run (409 if another run has it).
// POST { action: 'result', id, results: [{ row, status: 'sent'|'skipped', note?, sentAt? }], done?, list?, summary? }.

import { NextResponse } from 'next/server';
import { reportAllowed } from '../auth';
import { allBatches, claimBatch, cleanRows, createBatch, recordResults, type PersonResult } from '@/lib/reality/batches';
import { realityEmail, REALITY_CC, REALITY_FROM } from '@/lib/reality/email';

export const dynamic = 'force-dynamic';

const denied = () => NextResponse.json({ error: 'Not allowed' }, { status: 403 });

export async function GET(req: Request) {
  if (!reportAllowed(req)) return denied();
  const batches = await allBatches();
  const open = batches.find((b) => b.status === 'waiting') ?? null;
  const toSend = batches.filter((b) => b.status === 'approved' || b.status === 'sending').map((b) => ({
    id: b.id, status: b.status, approvedBy: b.approvedBy, approvedAt: b.approvedAt,
    from: REALITY_FROM, cc: REALITY_CC,
    people: b.people.filter((p) => p.status === 'waiting').map((p) => ({ ...p, email: p.email, ...realityEmail(p.first, p.location) })),
    alreadySent: b.people.filter((p) => p.status === 'sent').map((p) => p.row),
    leftOut: b.people.filter((p) => p.status === 'left out').map((p) => p.row),
  }));
  return NextResponse.json({ open: open && { id: open.id, createdAt: open.createdAt, rows: open.people.map((p) => p.row) }, toSend });
}

export async function POST(req: Request) {
  if (!reportAllowed(req)) return denied();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === 'string' ? b.id : '';
  if (b.action === 'create') {
    const rows = cleanRows(b.rows);
    if ('error' in rows) return NextResponse.json({ error: rows.error }, { status: 400 });
    const made = await createBatch(rows.people);
    if ('error' in made) return NextResponse.json({ error: made.error, id: made.batch.id, status: made.batch.status }, { status: 409 });
    return NextResponse.json({ batch: { id: made.batch.id, count: made.batch.people.length }, url: `${new URL(req.url).origin}/reality` });
  }
  if (b.action === 'claim') {
    const got = await claimBatch(id);
    if ('error' in got) return NextResponse.json({ error: got.error }, { status: 409 });
    return NextResponse.json({ claimed: id });
  }
  if (b.action === 'result') {
    const results = (Array.isArray(b.results) ? b.results : []).filter((r): r is PersonResult =>
      Boolean(r) && Number.isInteger((r as PersonResult).row) && ['sent', 'skipped'].includes((r as PersonResult).status));
    const list = b.list && typeof b.list === 'object' ? b.list as { sent: boolean; count: number; leftOut: string[] } : undefined;
    const done = await recordResults(id, results, b.done === true, list, typeof b.summary === 'string' ? b.summary : undefined);
    if ('error' in done) return NextResponse.json({ error: done.error }, { status: 404 });
    return NextResponse.json({ id, status: done.batch.status, recorded: results.length });
  }
  return NextResponse.json({ error: 'action must be create, claim or result' }, { status: 400 });
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Person { row: number; keapId: string; first: string; last: string; email: string; location: string; status: 'waiting' | 'left out' | 'sent' | 'skipped'; note?: string; sentAt?: string; preview: string }
interface Batch { id: string; createdAt: string; status: 'waiting' | 'approved' | 'sending' | 'done'; people: Person[]; approvedBy?: string; approvedAt?: string; doneAt?: string; list?: { sent: boolean; count: number; leftOut: string[] }; summary?: string }
interface Data { batches: Batch[]; from: string; cc: string[]; routine: boolean }

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT' : '');
const STATUS_LABEL: Record<Batch['status'], string> = { waiting: 'Waiting for review', approved: 'Approved · sending soon', sending: 'Sending…', done: 'Sent' };

export function RealityReview() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [leaveOut, setLeaveOut] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/reality', { cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || 'Couldn’t load the REality batches.'); return; }
    setData(j); setError('');
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = data?.batches.find((b) => b.status === 'waiting');
  const active = data?.batches.find((b) => b.status === 'approved' || b.status === 'sending');
  const history = data?.batches.filter((b) => b.status === 'done') ?? [];
  // While a batch is sending, refresh every 10 seconds so the results show up.
  useEffect(() => { if (!active) return; const t = setInterval(load, 10_000); return () => clearInterval(t); }, [active, load]);
  useEffect(() => { if (open && picked == null && open.people.length) setPicked(open.people[0].row); }, [open, picked]);

  const chosen = useMemo(() => open?.people.filter((p) => !leaveOut.includes(p.row)) ?? [], [open, leaveOut]);
  const shown = open?.people.find((p) => p.row === picked) ?? open?.people[0];

  const toggle = (row: number) => { setConfirming(false); setLeaveOut((l) => (l.includes(row) ? l.filter((r) => r !== row) : [...l, row])); };
  const toggleAll = () => { setConfirming(false); setLeaveOut(chosen.length ? (open?.people.map((p) => p.row) ?? []) : []); };

  async function send() {
    if (!open) return;
    setBusy(true); setNotice('');
    const res = await fetch('/api/reality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: open.id, leaveOut }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false); setConfirming(false);
    if (!res.ok) { setNotice(j.error || 'Couldn’t send. Try again.'); return; }
    setNotice(j.started ? `Sending ${j.count} emails now. This page updates when they’re out.` : `Approved ${j.count} emails. They go out at the next hourly run (within the hour).`);
    setLeaveOut([]); load();
  }

  if (error) return <p className="rl-empty">{error}</p>;
  if (!data) return <p className="rl-empty">Loading…</p>;

  return (
    <div className="rl-wrap">
      {notice && <p className="rl-notice" role="status">{notice}</p>}

      {active && <ActiveBatch batch={active} />}

      {open ? (
        <section className="rl-review">
          <div className="rl-bar">
            <div>
              <h2>New list · {open.people.length} {open.people.length === 1 ? 'person' : 'people'}</h2>
              <p>Created {when(open.createdAt)} · {chosen.length} selected to email</p>
            </div>
            <div className="rl-actions">
              {confirming ? (
                <>
                  <span className="rl-confirm">Email {chosen.length} {chosen.length === 1 ? 'person' : 'people'} and send Jessica the list?</span>
                  <button className="rl-btn ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
                  <button className="rl-btn primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Yes, send'}</button>
                </>
              ) : (
                <button className="rl-btn primary" onClick={() => setConfirming(true)} disabled={!chosen.length || Boolean(active)}
                  title={active ? 'Wait for the batch that is sending to finish' : undefined}>
                  Send {chosen.length} {chosen.length === 1 ? 'email' : 'emails'}
                </button>
              )}
            </div>
          </div>

          <div className="rl-grid">
            <div className="rl-list">
              <table>
                <thead>
                  <tr>
                    <th className="rl-check"><input type="checkbox" aria-label="Select everyone" checked={chosen.length === open.people.length} onChange={toggleAll} /></th>
                    <th>Name</th><th>Event</th><th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {open.people.map((p) => {
                    const off = leaveOut.includes(p.row);
                    return (
                      <tr key={p.row} className={`${shown?.row === p.row ? 'on' : ''} ${off ? 'off' : ''}`} onClick={() => setPicked(p.row)}>
                        <td className="rl-check" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Email ${p.first} ${p.last}`} checked={!off} onChange={() => toggle(p.row)} />
                        </td>
                        <td className="rl-name">{p.first} {p.last}</td>
                        <td>{p.location}</td>
                        <td className="rl-email">{p.email}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="rl-hint">Click a name to preview their email. Untick anyone who shouldn’t get it; they stay in the sheet.</p>
            </div>

            {shown && (
              <article className="rl-preview" aria-label="Email preview">
                <div className="rl-preview-tag">Email preview{leaveOut.includes(shown.row) ? ' · left out' : ''}</div>
                <dl className="rl-head">
                  <dt>From</dt><dd>{data.from}</dd>
                  <dt>To</dt><dd>{shown.first} {shown.last} &lt;{shown.email}&gt;</dd>
                  <dt>Cc</dt><dd>{data.cc.join(', ')}</dd>
                  <dt>Subject</dt><dd><b>Intro to REality (Recruiting)</b></dd>
                </dl>
                {/* Built by the hub from escaped names: the same HTML the routine sends. */}
                <div className="rl-body" dangerouslySetInnerHTML={{ __html: shown.preview }} />
              </article>
            )}
          </div>
        </section>
      ) : (
        !active && <p className="rl-empty">No new list right now. When people tick “Recruiting” on their half-day form, the CW Assistant messages Am and Miguel on Slack and the list shows here.</p>
      )}

      {history.length > 0 && (
        <section className="rl-history">
          <h2>Sent</h2>
          <table>
            <thead><tr><th>Approved</th><th>By</th><th>Emailed</th><th>Skipped</th><th>List to Jessica</th></tr></thead>
            <tbody>
              {history.map((b) => {
                const sent = b.people.filter((p) => p.status === 'sent');
                const skipped = b.people.filter((p) => p.status === 'skipped' || p.status === 'left out');
                return (
                  <tr key={b.id}>
                    <td>{when(b.approvedAt)}</td>
                    <td>{b.approvedBy ?? '—'}</td>
                    <td><details><summary>{sent.length}</summary><ul>{sent.map((p) => <li key={p.row}>{p.first} {p.last} · {p.location}</li>)}</ul></details></td>
                    <td>{skipped.length ? <details><summary>{skipped.length}</summary><ul>{skipped.map((p) => <li key={p.row}>{p.first} {p.last}: {p.status === 'left out' ? 'left out' : p.note || 'skipped'}</li>)}</ul></details> : '0'}</td>
                    <td>{b.list ? (b.list.sent ? `Sent · ${b.list.count} people` : 'Not sent') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function ActiveBatch({ batch }: { batch: Batch }) {
  const sent = batch.people.filter((p) => p.status === 'sent').length;
  const toSend = batch.people.filter((p) => p.status !== 'left out').length;
  return (
    <section className="rl-active">
      <span className="rl-pill">{STATUS_LABEL[batch.status]}</span>
      <p><b>{sent} of {toSend}</b> emails sent · approved by {batch.approvedBy} {when(batch.approvedAt)}</p>
      <div className="rl-progress"><span style={{ width: `${toSend ? Math.round((sent / toSend) * 100) : 0}%` }} /></div>
    </section>
  );
}

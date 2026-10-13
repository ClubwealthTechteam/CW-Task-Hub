'use client';

// Jizel's overdue balances: who owes, what changed since the previous working day, and a CSV for her sheet.
// Read-only from Keap; charging cards stays in Keap with her.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArClient, ArReport } from '@/lib/billing/ar';

const ASK_EVENT = 'cw-ask-assistant';
type Filter = 'changes' | 'all' | 'paid' | 'd30' | 'd60' | 'd90';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const shortDate = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
const bucket = (days: number) => (days >= 90 ? '90+ days' : days >= 60 ? '60–89 days' : days >= 30 ? '30–59 days' : 'Under 30 days');

function csv(r: ArReport) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Contact ID', 'Name', 'Email', 'Company', 'Balance due', 'Oldest unpaid order', 'Days', 'Age', 'Orders', 'Since ' + (r.comparedTo ?? 'last check')]];
  const isNew = new Set(r.isNew);
  const changed = new Map(r.changed.map((c) => [c.contactId, c]));
  for (const c of r.clients) rows.push([String(c.contactId), c.name, c.email ?? '', c.company ?? '', c.due.toFixed(2), c.oldest, String(c.days), bucket(c.days), c.orders.map((o) => `${o.title} (${o.date}, ${o.due.toFixed(2)} due)`).join('; '), isNew.has(c.contactId) ? 'New' : changed.has(c.contactId) ? `Changed from ${changed.get(c.contactId)!.before.toFixed(2)}` : '']);
  for (const p of r.paid) rows.push([String(p.contactId), p.name, '', '', '0.00', '', '', '', '', `Paid off (was ${p.before.toFixed(2)})`]);
  return rows.map((row) => row.map(q).join(',')).join('\n');
}

export function ArBoard({ taskId }: { taskId: string }) {
  const [report, setReport] = useState<ArReport | null>(null);
  const [keap, setKeap] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('changes');
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const res = await fetch(`/api/billing/ar${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (res.ok) { setKeap(b.keap !== false); setError(b.error ?? ''); if (b.report) setReport(b.report); } else setError(b.error || 'Couldn’t load balances');
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const isNew = useMemo(() => new Set(report?.isNew ?? []), [report]);
  const changed = useMemo(() => new Map((report?.changed ?? []).map((c) => [c.contactId, c])), [report]);
  const counts = useMemo(() => {
    const cl = report?.clients ?? [];
    return {
      changes: cl.filter((c) => isNew.has(c.contactId) || changed.has(c.contactId)).length + (report?.paid.length ?? 0),
      all: cl.length, paid: report?.paid.length ?? 0,
      d30: cl.filter((c) => c.days >= 30).length, d60: cl.filter((c) => c.days >= 60).length, d90: cl.filter((c) => c.days >= 90).length,
    };
  }, [report, isNew, changed]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (c: { name: string; email?: string; company?: string }) => words.every((w) => `${c.name} ${c.email ?? ''} ${c.company ?? ''}`.toLowerCase().includes(w));
  const shown = (report?.clients ?? []).filter(match).filter((c) =>
    filter === 'all' ? true : filter === 'changes' ? isNew.has(c.contactId) || changed.has(c.contactId)
      : filter === 'd30' ? c.days >= 30 : filter === 'd60' ? c.days >= 60 : filter === 'd90' ? c.days >= 90 : false);
  const paidShown = filter === 'changes' || filter === 'paid' ? (report?.paid ?? []).filter(match) : [];

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([csv(report)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `overdue-balances-${report.date}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const ask = (c: ArClient) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { taskId, text: `Draft a friendly payment reminder text and a short email for ${c.name}${c.company ? ` (${c.company})` : ''}. Balance due: ${usd(c.due)}, oldest unpaid since ${shortDate(c.oldest)} (${c.days} days). Orders: ${c.orders.map((o) => `${o.title} ${usd(o.due)}`).join('; ')}. Ask them to update their card or reply with a good time to call.` } }));

  const tag = (c: ArClient) => isNew.has(c.contactId) ? <span className="wp-st st-photo">New</span>
    : changed.has(c.contactId) ? <span className="wp-st st-ready">{changed.get(c.contactId)!.after > changed.get(c.contactId)!.before ? 'Went up' : 'Went down'} · was {usd(changed.get(c.contactId)!.before)}</span> : null;

  return (
    <main className="ws-main wp" aria-label="Overdue balances">
      <div className="ws-mh">
        <span className="ws-bot wp-bot" aria-hidden="true">💳</span>
        <b>Overdue balances</b>
        <span className="muted small wp-from">From Keap (read-only){report ? ` · checked ${new Date(report.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button className="linkbtn" onClick={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {report && <button className="linkbtn" onClick={download}>Download CSV</button>}
      </div>

      {report && (
        <>
          <div className="ar-sum">
            <div><span className="muted small">Total owed</span><b>{usd(report.total)}</b></div>
            <div><span className="muted small">Clients</span><b>{report.clients.length}</b></div>
            <div><span className="muted small">New since {report.comparedTo ? shortDate(report.comparedTo) : 'last check'}</span><b>{report.isNew.length}</b></div>
            <div><span className="muted small">Paid off</span><b>{report.paid.length}</b></div>
          </div>
          <div className="wp-filters" role="group" aria-label="Show">
            {([['changes', 'Changes'], ['all', 'All'], ['paid', 'Paid off'], ['d30', '30+ days'], ['d60', '60+ days'], ['d90', '90+ days']] as [Filter, string][]).map(([f, label]) => (
              <button key={f} className={`chip-btn${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} <span className="wp-n">{counts[f]}</span></button>
            ))}
            <input className="ar-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company" aria-label="Search" />
          </div>
        </>
      )}

      <div className="wp-body">
        {!keap ? <p className="note">Keap isn’t connected, so balances can’t be read yet.</p>
          : error ? <p className="note" role="alert">{error}</p>
            : loading && !report ? <p className="muted small">Reading unpaid orders from Keap…</p>
              : report && !report.comparedTo && filter === 'changes' ? <p className="muted small">This is the first check, so there’s nothing to compare yet. From the next working day, this tab shows who’s new, who paid off and whose balance changed. Use <b>All</b> for today’s full list.</p>
                : !shown.length && !paidShown.length ? <p className="muted small">{filter === 'changes' ? `No changes since ${report?.comparedTo ? shortDate(report.comparedTo) : 'the last check'}.` : 'Nobody here.'}</p>
                  : (
                    <ul className="wp-list">
                      {shown.map((c) => (
                        <li key={c.contactId} className={`wp-card${open === c.contactId ? ' open' : ''}`}>
                          <button className="wp-row" onClick={() => setOpen(open === c.contactId ? null : c.contactId)} aria-expanded={open === c.contactId}>
                            <span className="wp-who"><b>{c.name}</b><span className="muted small">{[c.company, c.email].filter(Boolean).join(' · ') || `Keap #${c.contactId}`}</span></span>
                            {tag(c)}
                            <span className={`ar-age${c.days >= 60 ? ' late' : ''}`}>{c.days} day{c.days === 1 ? "" : "s"}</span>
                            <b className="ar-due">{usd(c.due)}</b>
                          </button>
                          {open === c.contactId && (
                            <div className="wp-steps">
                              <table className="ar-orders"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Due</th></tr></thead>
                                <tbody>{c.orders.map((o) => <tr key={o.id}><td>{o.title}</td><td>{shortDate(o.date)}</td><td>{usd(o.total)}</td><td>{usd(o.due)}</td></tr>)}</tbody>
                              </table>
                              <div className="row">
                                <button className="btn" onClick={() => ask(c)}>Draft a payment reminder</button>
                                <span className="muted small">Keap #{c.contactId} · {bucket(c.days)}</span>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                      {paidShown.map((p) => (
                        <li key={`paid-${p.contactId}`} className="wp-card">
                          <div className="wp-row">
                            <span className="wp-who"><b>{p.name}</b><span className="muted small">Keap #{p.contactId}</span></span>
                            <span className="wp-st st-posted">Paid off · was {usd(p.before)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
        <p className="muted small" style={{ margin: 0 }}>Age counts from the oldest unpaid order’s date. The hub only reads Keap; charges and notes stay in Keap.</p>
      </div>
    </main>
  );
}

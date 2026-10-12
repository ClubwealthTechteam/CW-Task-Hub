'use client';

// Read-only browser for everything in Keap: pick a view on the left, filter and page through it, and open a
// contact or campaign for the full picture. Nothing here can change Keap.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

interface View { id: string; group: string; label: string; path: string; hint?: string }
type Row = Record<string, unknown>;

const PAGE = 50;
const PREFERRED = ['id', 'name', 'given_name', 'family_name', 'email', 'title', 'subject', 'status', 'category', 'type',
  'contact_id', 'stage', 'total', 'amount', 'sent_to_address', 'sent_date', 'due_date', 'date_created', 'last_updated', 'published_date'];

async function keapGet(cap: string, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const res = await fetch(`/api/keap/view/${cap}?${qs}`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Keap request failed (${res.status})`);
  return body.data;
}

/** The list inside a Keap response ({ contacts: [...] }, { tags: [...] }, a bare array, …). */
function rowsOf(data: unknown): Row[] | null {
  if (Array.isArray(data)) return data as Row[];
  if (data && typeof data === 'object') {
    const arr = Object.values(data as Row).find(Array.isArray);
    if (arr) return arr as Row[];
  }
  return null;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') {
      const first = v[0] as Row;
      return String(first.email ?? first.number ?? first.name ?? first.line1 ?? `${v.length} items`) + (v.length > 1 ? ` +${v.length - 1}` : '');
    }
    return v.join(', ');
  }
  if (typeof v === 'object') {
    const o = v as Row;
    return String(o.name ?? o.email ?? o.id ?? JSON.stringify(o).slice(0, 60));
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? new Date(s).toLocaleString() : s;
}

function columns(rows: Row[]) {
  const keys = new Set<string>();
  rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
  const all = [...keys];
  const picked = PREFERRED.filter((k) => keys.has(k));
  for (const k of all) if (picked.length < 7 && !picked.includes(k)) picked.push(k);
  return picked.slice(0, 7);
}

const label = (k: string) => k.replace(/_/g, ' ');

export function KeapExplorer({ views, connected }: { views: View[]; connected: boolean }) {
  const groups = useMemo(() => [...new Set(views.map((v) => v.group))], [views]);
  const listViews = views.filter((v) => !v.path.includes('{'));
  const [viewId, setViewId] = useState(listViews[0]?.id ?? '');
  const [filters, setFilters] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState(false);
  const [detail, setDetail] = useState<{ kind: 'contact' | 'campaign' | 'automation' | 'row'; id?: number | string; row?: Row } | null>(null);
  const view = views.find((v) => v.id === viewId);

  const load = useCallback(async (id: string, f: string, off: number) => {
    setBusy(true); setError(''); setDetail(null);
    const params: Record<string, string | number> = { limit: PAGE, offset: off };
    for (const pair of f.split(/[,&\n]/)) {
      const [k, ...rest] = pair.split('=');
      if (k?.trim() && rest.length) params[k.trim()] = rest.join('=').trim();
    }
    try { setData(await keapGet(id, params)); } catch (e) { setData(null); setError((e as Error).message); }
    setBusy(false);
  }, []);

  useEffect(() => { if (connected && viewId) load(viewId, filters, offset); }, [connected, viewId, offset, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = rowsOf(data);
  const cols = rows ? columns(rows) : [];
  const count = data && typeof data === 'object' && 'count' in (data as Row) ? Number((data as Row).count) : null;

  function open(row: Row) {
    const id = row.id as number | string | undefined;
    if (viewId === 'contacts.list' || viewId === 'tags.contacts') setDetail({ kind: 'contact', id: (row.contact as Row | undefined)?.id as number ?? id });
    else if (viewId === 'campaigns.list') setDetail({ kind: 'campaign', id });
    else if (viewId === 'automations.list') setDetail({ kind: 'automation', id });
    else setDetail({ kind: 'row', row });
  }

  return (
    <div className="ws ws-wide">
      <aside className="ws-side" aria-label="Keap views">
        <div className="ws-side-h"><b>Keap</b><span>View-only · Club Wealth&apos;s database</span></div>
        <nav className="ws-navs">
          {groups.map((g) => (
            <div key={g} className="ws-navs">
              <div className="ws-group">{g}</div>
              {listViews.filter((v) => v.group === g).map((v) => (
                <button key={v.id} className="ws-nav kx-nav" aria-current={v.id === viewId ? 'page' : undefined}
                  onClick={() => { setViewId(v.id); setOffset(0); setFilters(''); setRaw(false); }}>
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="ws-side-f"><span className={`keap-pill${connected ? '' : ' off'}`}>{connected ? 'Keap connected · read-only' : 'Keap not connected'}</span></div>
      </aside>

      <main className="ws-page">
        {!connected ? (
          <section className="card"><h2>Keap isn&apos;t connected yet</h2><p className="muted" style={{ margin: 0 }}>Add <code>KEAP_API_KEY</code> in Vercel and redeploy. Everything in Keap then shows here, read-only.</p></section>
        ) : detail?.kind === 'contact' ? (
          <ContactDetail id={Number(detail.id)} onBack={() => setDetail(null)} />
        ) : detail?.kind === 'campaign' || detail?.kind === 'automation' ? (
          <FlowDetail kind={detail.kind} id={detail.id!} onBack={() => setDetail(null)} />
        ) : (
          <>
            <div className="ws-page-h">
              <h1>{view?.label}</h1>
              <p><code>{view?.path}</code>{view?.hint ? <> · {view.hint}</> : null}</p>
            </div>
            <form className="row" onSubmit={(e) => { e.preventDefault(); setOffset(0); load(viewId, filters, 0); }}>
              <input value={filters} onChange={(e) => setFilters(e.target.value)} placeholder={viewId === 'contacts.list' ? 'Filters, e.g. email=maria@example.com or given_name=Maria' : 'Filters, e.g. contact_id=123, order=date_created'} style={{ maxWidth: 520 }} aria-label="Filters" />
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</button>
              <label className="check" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> Raw data</label>
            </form>
            {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}

            {data != null && (raw || !rows) ? (
              <pre className="json kx-json">{JSON.stringify(data, null, 2)}</pre>
            ) : rows && (
              <section className="card" style={{ padding: 0, gap: 0 }}>
                <div className="spread kx-bar">
                  <span className="muted small">{count != null ? `${count.toLocaleString()} total · ` : ''}showing {rows.length ? offset + 1 : 0}–{offset + rows.length}</span>
                  <span className="row">
                    <button className="btn" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Previous</button>
                    <button className="btn" disabled={rows.length < PAGE || busy} onClick={() => setOffset(offset + PAGE)}>Next →</button>
                  </span>
                </div>
                {rows.length === 0 ? <p className="empty">Nothing here.</p> : (
                  <div className="table-wrap">
                    <table className="kx-table">
                      <thead><tr>{cols.map((c) => <th key={c}>{label(c)}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={String(r.id ?? i)} onClick={() => open(r)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(r); }}>
                            {cols.map((c) => <td key={c}>{show(r[c])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
            {detail?.kind === 'row' && (
              <section className="card">
                <div className="spread"><h2>Record</h2><button className="btn" onClick={() => setDetail(null)}>Close</button></div>
                <pre className="json kx-json">{JSON.stringify(detail.row, null, 2)}</pre>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function useKeap(cap: string, params: Record<string, string | number | undefined>) {
  const [state, setState] = useState<{ data?: unknown; error?: string; loading: boolean }>({ loading: true });
  const key = JSON.stringify([cap, params]);
  useEffect(() => {
    let live = true;
    keapGet(cap, params).then((data) => live && setState({ data, loading: false }), (e) => live && setState({ error: (e as Error).message, loading: false }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function Section({ title, state, render }: { title: string; state: ReturnType<typeof useKeap>; render: (rows: Row[]) => React.ReactNode }) {
  const rows = rowsOf(state.data) ?? [];
  return (
    <section className="card">
      <h2>{title} {!state.loading && !state.error && <span className="muted small">({rows.length})</span>}</h2>
      {state.loading ? <p className="muted small" style={{ margin: 0 }}>Loading…</p>
        : state.error ? <p className="note" style={{ margin: 0 }}>{state.error}</p>
          : rows.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None.</p> : render(rows)}
    </section>
  );
}

function MiniTable({ rows, keys }: { rows: Row[]; keys: string[] }) {
  return (
    <div className="table-wrap">
      <table><thead><tr>{keys.map((k) => <th key={k}>{label(k)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{keys.map((k) => <td key={k}>{show(r[k])}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

function ContactDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const contact = useKeap('contacts.get', { contactId: id, optional_properties: 'custom_fields,lead_source_id,origin,job_title,website,social_accounts,contact_type,owner_id' });
  const tags = useKeap('contacts.tags.list', { contactId: id, limit: 200 });
  const emails = useKeap('contacts.emails', { contactId: id, limit: 25 });
  const notes = useKeap('notes.list', { contact_id: id, limit: 25 });
  const tasks = useKeap('tasks.list', { contact_id: id, limit: 25 });
  const orders = useKeap('orders.list', { contact_id: id, limit: 25 });
  const c = (contact.data ?? {}) as Row;
  const name = [c.given_name, c.family_name].filter(Boolean).join(' ') || `Contact #${id}`;
  const facts: [string, unknown][] = [
    ['Email', c.email_addresses], ['Phone', c.phone_numbers], ['Company', c.company], ['Job title', c.job_title],
    ['Type', c.contact_type], ['Owner id', c.owner_id], ['Lead source id', c.lead_source_id], ['Created', c.date_created], ['Last updated', c.last_updated],
  ];
  return (
    <>
      <nav className="small"><button className="linkish" onClick={onBack}>← Back to the list</button></nav>
      <div className="ws-page-h"><h1>{contact.loading ? 'Loading…' : name}</h1><p>Keap contact #{id} · read-only</p></div>
      {contact.error && <p className="note">{contact.error}</p>}
      {!contact.loading && !contact.error && (
        <section className="card">
          <dl className="kv">{facts.filter(([, v]) => show(v)).map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{show(v)}</dd></Fragment>))}</dl>
          {Array.isArray(c.custom_fields) && (c.custom_fields as Row[]).some((f) => show(f.content)) && (
            <details><summary className="small">Custom fields</summary><MiniTable rows={(c.custom_fields as Row[]).filter((f) => show(f.content))} keys={['id', 'content']} /></details>
          )}
        </section>
      )}
      <Section title="Tags" state={tags} render={(rows) => (
        <div className="kc-tags">{rows.map((r, i) => { const t = (r.tag ?? r) as Row; return <span key={i} className="tag" title={show(r.date_applied)}>{show(t.name)}</span>; })}</div>
      )} />
      <Section title="Emails" state={emails} render={(rows) => <MiniTable rows={rows} keys={['subject', 'sent_to_address', 'sent_date', 'opened_date', 'clicked_date']} />} />
      <Section title="Notes" state={notes} render={(rows) => <MiniTable rows={rows} keys={['title', 'body', 'type', 'date_created']} />} />
      <Section title="Tasks" state={tasks} render={(rows) => <MiniTable rows={rows} keys={['title', 'due_date', 'completed', 'priority', 'user_id']} />} />
      <Section title="Orders" state={orders} render={(rows) => <MiniTable rows={rows} keys={['title', 'status', 'total', 'order_date']} />} />
    </>
  );
}

function FlowDetail({ kind, id, onBack }: { kind: 'campaign' | 'automation'; id: number | string; onBack: () => void }) {
  const state = useKeap(kind === 'campaign' ? 'campaigns.get' : 'automations.get',
    kind === 'campaign' ? { campaignId: id, optional_properties: 'goals,sequences' } : { automationId: id });
  const d = (state.data ?? {}) as Row;
  const goals = (d.goals as Row[] | undefined) ?? [];
  const sequences = (d.sequences as Row[] | undefined) ?? [];
  return (
    <>
      <nav className="small"><button className="linkish" onClick={onBack}>← Back to the list</button></nav>
      <div className="ws-page-h"><h1>{state.loading ? 'Loading…' : show(d.name) || `${kind} #${id}`}</h1><p>Keap {kind} #{id} · read-only{d.published_status ? ` · ${show(d.published_status)}` : ''}</p></div>
      {state.error && <p className="note">{state.error}</p>}
      {kind === 'campaign' && !state.loading && !state.error && (
        <>
          <section className="card">
            <dl className="kv">
              <dt>Active contacts</dt><dd>{show(d.active_contact_count) || '0'}</dd>
              <dt>Completed contacts</dt><dd>{show(d.completed_contact_count) || '0'}</dd>
              <dt>Published</dt><dd>{show(d.published_date)}</dd>
            </dl>
          </section>
          <section className="card"><h2>Goals <span className="muted small">({goals.length})</span></h2>
            {goals.length ? <MiniTable rows={goals} keys={['id', 'name', 'type', 'historical_contact_count']} /> : <p className="muted small" style={{ margin: 0 }}>None.</p>}</section>
          <section className="card"><h2>Sequences <span className="muted small">({sequences.length})</span></h2>
            {sequences.length ? <MiniTable rows={sequences} keys={['id', 'name', 'active_contact_count', 'completed_contact_count']} /> : <p className="muted small" style={{ margin: 0 }}>None.</p>}</section>
        </>
      )}
      {!state.loading && !state.error && (
        <details className="card"><summary className="small">Raw data</summary><pre className="json kx-json">{JSON.stringify(state.data, null, 2)}</pre></details>
      )}
    </>
  );
}

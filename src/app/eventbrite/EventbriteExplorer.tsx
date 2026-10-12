'use client';

// Read-only view of Club Wealth's Eventbrite: events, then one event's ticket types, attendees and orders.

import { useCallback, useEffect, useState } from 'react';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Filter = 'current_future' | 'past' | 'all';

async function eb(cap: string, params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const res = await fetch(`/api/eventbrite/view/${cap}?${qs}`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Eventbrite request failed (${res.status})`);
  return body.data as Row;
}

const when = (d?: Row) => (d?.local ? new Date(d.local).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

/** Loads every page of a list (continuation paging), up to a safe cap. */
function usePaged(cap: string, key: string, params: Record<string, string>, enabled = true) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<{ loading: boolean; error?: string; more: boolean }>({ loading: true, more: false });
  const [cont, setCont] = useState<string | undefined>();
  const pid = JSON.stringify(params);

  const load = useCallback(async (continuation?: string, append = false) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const d = await eb(cap, { ...params, continuation });
      setRows((r) => (append ? [...r, ...(d[key] ?? [])] : d[key] ?? []));
      setCont(d.pagination?.continuation);
      setState({ loading: false, more: Boolean(d.pagination?.has_more_items) });
    } catch (e) { setState({ loading: false, error: (e as Error).message, more: false }); }
  }, [cap, key, pid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  return { rows, ...state, loadMore: () => load(cont, true) };
}

export function EventbriteExplorer({ connected }: { connected: boolean }) {
  const [filter, setFilter] = useState<Filter>('current_future');
  const [open, setOpen] = useState<Row | null>(null);
  const events = usePaged('events.list', 'events',
    { time_filter: filter === 'all' ? '' : filter, status: 'all', order_by: filter === 'past' ? 'start_desc' : 'start_asc', expand: 'venue' }, connected);

  return (
    <div className="ws ws-wide">
      <aside className="ws-side" aria-label="Eventbrite events">
        <div className="ws-side-h"><b>Eventbrite</b><span>View-only</span></div>
        <div className="eb-filter" role="tablist" aria-label="Which events">
          {([['current_future', 'Upcoming'], ['past', 'Past'], ['all', 'All']] as [Filter, string][]).map(([f, l]) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => { setFilter(f); setOpen(null); }}>{l}</button>
          ))}
        </div>
        <nav className="ws-navs">
          {!connected ? <p className="ws-empty">Not connected yet.</p>
            : events.error ? <p className="ws-empty">{events.error}</p>
              : events.rows.length === 0 && !events.loading ? <p className="ws-empty">No events.</p>
                : events.rows.map((e) => (
                  <button key={e.id} className="ws-nav kx-nav eb-ev" aria-current={open?.id === e.id ? 'page' : undefined} onClick={() => setOpen(e)}>
                    <span><b>{e.name?.text}</b><small>{when(e.start)}{e.venue?.address?.city ? ` · ${e.venue.address.city}` : ''}</small></span>
                  </button>
                ))}
          {events.loading && <p className="ws-empty">Loading…</p>}
          {events.more && !events.loading && <button className="btn" style={{ margin: 10 }} onClick={events.loadMore}>Load more</button>}
        </nav>
        <div className="ws-side-f"><span className={`keap-pill${connected ? '' : ' off'}`}>{connected ? 'Eventbrite connected · read-only' : 'Eventbrite not connected'}</span></div>
      </aside>

      <main className="ws-page">
        {!connected ? (
          <section className="card"><h2>Eventbrite isn&apos;t connected yet</h2><p className="muted" style={{ margin: 0 }}>Add <code>EVENTBRITE_TOKEN</code> in Vercel and redeploy. Events, tickets, attendees and orders then show here, read-only.</p></section>
        ) : open ? <EventDetail ev={open} /> : (
          <div className="ws-page-h"><h1>Pick an event</h1><p>Choose an event on the left to see its ticket types, attendees and orders. Nothing here changes Eventbrite.</p></div>
        )}
      </main>
    </div>
  );
}

function EventDetail({ ev }: { ev: Row }) {
  const [tab, setTab] = useState<'attendees' | 'orders'>('attendees');
  const [q, setQ] = useState('');
  const tickets = usePaged('events.ticket_classes', 'ticket_classes', { eventId: ev.id });
  const attendees = usePaged('events.attendees', 'attendees', { eventId: ev.id }, tab === 'attendees');
  const orders = usePaged('events.orders', 'orders', { eventId: ev.id }, tab === 'orders');
  const sold = tickets.rows.reduce((n, t) => n + (t.quantity_sold ?? 0), 0);
  const total = tickets.rows.reduce((n, t) => n + (t.quantity_total ?? 0), 0);
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const list = tab === 'attendees' ? attendees : orders;
  const shown = list.rows.filter((r) => !q.trim() || match(`${r.profile?.name ?? r.name ?? ''} ${r.profile?.email ?? r.email ?? ''}`));

  return (
    <>
      <div className="ws-page-h">
        <h1>{ev.name?.text}</h1>
        <p>{when(ev.start)}{ev.venue?.name ? ` · ${ev.venue.name}` : ''}{ev.venue?.address?.localized_address_display ? `, ${ev.venue.address.localized_address_display}` : ''} · <span className="pill">{ev.status}</span> · <a href={ev.url} target="_blank" rel="noreferrer">Open in Eventbrite</a></p>
      </div>

      <section className="card">
        <div className="stats">
          <div className="stat"><b>{tickets.loading ? '…' : sold.toLocaleString()}</b><span>tickets sold</span></div>
          <div className="stat"><b>{tickets.loading ? '…' : total ? total.toLocaleString() : '—'}</b><span>capacity</span></div>
          <div className="stat"><b>{ev.capacity ?? '—'}</b><span>event capacity</span></div>
        </div>
        {tickets.error ? <p className="note" style={{ margin: 0 }}>{tickets.error}</p> : tickets.rows.length > 0 && (
          <div className="table-wrap">
            <table><thead><tr><th>Ticket type</th><th>Price</th><th>Sold</th><th>Available</th><th>Sales end</th></tr></thead>
              <tbody>{tickets.rows.map((t) => (
                <tr key={t.id}><td>{t.name}</td><td>{t.free ? 'Free' : t.cost?.display ?? '—'}</td><td>{t.quantity_sold ?? 0}</td><td>{t.quantity_total ?? '—'}</td><td>{when(t.sales_end ? { local: t.sales_end } : undefined)}</td></tr>
              ))}</tbody></table>
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 0, gap: 0 }}>
        <div className="spread kx-bar">
          <div className="eb-filter" role="tablist">
            <button role="tab" aria-selected={tab === 'attendees'} onClick={() => setTab('attendees')}>Attendees</button>
            <button role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>Orders</button>
          </div>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or email" aria-label="Filter" style={{ maxWidth: 280 }} />
        </div>
        {list.error ? <p className="note" style={{ margin: 16 }}>{list.error}</p> : (
          <div className="table-wrap">
            {tab === 'attendees' ? (
              <table><thead><tr><th>Name</th><th>Email</th><th>Ticket</th><th>Status</th><th>Checked in</th><th>Registered</th></tr></thead>
                <tbody>{shown.map((a) => (
                  <tr key={a.id}><td>{a.profile?.name}</td><td>{a.profile?.email}</td><td>{a.ticket_class_name}</td><td>{a.status}{a.cancelled ? ' (cancelled)' : ''}{a.refunded ? ' (refunded)' : ''}</td><td>{a.checked_in ? 'Yes' : 'No'}</td><td>{a.created ? new Date(a.created).toLocaleDateString() : ''}</td></tr>
                ))}</tbody></table>
            ) : (
              <table><thead><tr><th>Order</th><th>Name</th><th>Email</th><th>Total</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>{shown.map((o) => (
                  <tr key={o.id}><td>#{o.id}</td><td>{o.name}</td><td>{o.email}</td><td>{o.costs?.gross?.display ?? '—'}</td><td>{o.status}</td><td>{o.created ? new Date(o.created).toLocaleDateString() : ''}</td></tr>
                ))}</tbody></table>
            )}
            {!list.loading && shown.length === 0 && <p className="empty">None{q ? ' match' : ''}.</p>}
          </div>
        )}
        <div className="kx-bar spread" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
          <span className="muted small">{list.loading ? 'Loading…' : `${list.rows.length.toLocaleString()} loaded${list.more ? ' (more available)' : ''}`}</span>
          {list.more && !list.loading && <button className="btn" onClick={list.loadMore}>Load more</button>}
        </div>
      </section>
    </>
  );
}

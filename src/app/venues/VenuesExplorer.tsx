'use client';

// Events venues. Left: venues by state (dropdown per state, status counts, search, filters, follow-ups due,
// add a venue, export). Middle: the Google My Maps embed (Google's own map, icons and locations).
// Right (collapsible): the team's details for the picked venue: details, booking & cost, contact &
// follow-up, files, Eventbrite events held there, and the change history.

import { useEffect, useMemo, useRef, useState } from 'react';

interface Venue { id: string; name: string; state: string; lat: number; lng: number; color: string; icon: 'pin' | 'letter'; custom?: boolean; address?: string }
interface FileRef { id: string; name: string; type: string; size: number; at: number; by: string }
interface Info {
  description?: string; type?: string; status?: string; tags?: string[]; contact?: string; phone?: string; website?: string; address?: string;
  classroom?: string; theater?: string; rate?: string; deposit?: string; cancellation?: string; contract?: string; lastContacted?: string; followUp?: string;
  notes?: string; files?: FileRef[]; updatedAt?: number; updatedBy?: string;
}
interface Place { address?: string; phone?: string; website?: string; source: string; nearest?: boolean }
interface Ev { id: string; name: string; start: string; status: string; url: string; capacity?: number; sold?: number }
interface Change { at: number; by: string; byName: string; field: string; from?: string; to?: string }

const STATUS_TONE: Record<string, string> = { Renting: 'ok', 'Not Renting': 'bad', 'Not Available': 'warn', 'Not contacted yet': 'muted' };
const FIELD_NAMES: Record<string, string> = {
  type: 'Type', status: 'Status', description: 'Description', tags: 'Tags', classroom: 'Classroom max', theater: 'Theater max', rate: 'Rate', deposit: 'Deposit',
  cancellation: 'Cancellation terms', contract: 'Contract', contact: 'Contact', phone: 'Phone', website: 'Website', address: 'Address',
  lastContacted: 'Last contacted', followUp: 'Follow-up', notes: 'Notes', file: 'File', added: 'Venue',
};
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const editable = (i?: Info): Info => { const { files, updatedAt, updatedBy, ...rest } = i ?? {}; void files; void updatedAt; void updatedBy; return rest; };
const statusOf = (i?: Info) => i?.status ?? 'Not contacted yet';
const fmtDate = (d?: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Pin({ v }: { v: Venue }) {
  return (
    <svg className="vn-pin" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill={v.color} />
      {v.icon === 'letter' ? <text x="12" y="12.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">T</text> : <circle cx="12" cy="9" r="2.6" fill="#fff" />}
    </svg>
  );
}

function Section({ title: t, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="vn-sec" open={open}>
      <summary>{t}</summary>
      <div className="vn-sec-body">{children}</div>
    </details>
  );
}

export function VenuesExplorer({ mapId, editUrl, types, statuses, contracts }: { mapId: string; editUrl: string; types: string[]; statuses: string[]; contracts: string[] }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [stale, setStale] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [sel, setSel] = useState('');
  const [panel, setPanel] = useState(true);
  const [draft, setDraft] = useState<Info>({});
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [conflict, setConflict] = useState<{ info: Info; name?: string } | null>(null);
  const [place, setPlace] = useState<Place | null | 'loading'>(null);
  const [events, setEvents] = useState<{ connected: boolean; events: Ev[]; error?: string } | 'loading' | null>(null);
  const [history, setHistory] = useState<Change[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newV, setNewV] = useState({ name: '', state: '', address: '', type: '' });
  const [addMsg, setAddMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (fresh = false) => {
    setLoading(true);
    return fetch(`/api/venues${fresh ? '?fresh=1' : ''}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load the venues'); return d; })
      .then((d) => { setVenues(d.venues); setInfo(d.info); setNames(d.names); setStale(d.staleSince); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const states = useMemo(() => [...new Set(venues.map((v) => v.state))], [venues]);
  const isDue = (i?: Info) => Boolean(i?.followUp && i.followUp <= today());
  const dueCount = useMemo(() => venues.filter((v) => isDue(info[v.id])).length, [venues, info]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return venues.filter((v) => {
      const i = info[v.id] ?? {};
      if (fType && i.type !== fType) return false;
      if (fStatus && statusOf(i) !== fStatus) return false;
      if (dueOnly && !isDue(i)) return false;
      if (!s) return true;
      return [v.name, v.state, v.address, i.description, i.notes, i.contact, i.address, ...(i.tags ?? [])].some((x) => x?.toLowerCase().includes(s));
    });
  }, [venues, info, q, fType, fStatus, dueOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtering = Boolean(q || fType || fStatus || dueOnly);

  const venue = venues.find((v) => v.id === sel);
  const saved = venue ? info[venue.id] : undefined;
  useEffect(() => {
    setDraft(editable(saved)); setMsg(''); setTagInput(''); setConflict(null); setHistory(null);
    if (!venue) return;
    setPlace('loading'); setEvents('loading');
    fetch(`/api/venues/place?id=${encodeURIComponent(venue.id)}`).then((r) => r.json()).then((d) => setPlace(d.place ?? null)).catch(() => setPlace(null));
    fetch(`/api/venues/events?id=${encodeURIComponent(venue.id)}`).then((r) => r.json()).then(setEvents).catch(() => setEvents(null));
    loadHistory(venue.id);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadHistory = (id: string) => fetch(`/api/venues/history?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((d) => setHistory(d.history ?? [])).catch(() => setHistory([]));

  const pick = (v: Venue) => { setSel(v.id); setPanel(true); };
  const mapSrc = `https://www.google.com/maps/d/embed?mid=${mapId}${venue ? `&ll=${venue.lat},${venue.lng}&z=14` : ''}`;
  const dirty = venue && JSON.stringify(draft) !== JSON.stringify(editable(saved));

  const set = (k: keyof Info, v: unknown) => setDraft((d) => ({ ...d, [k]: v === '' ? undefined : v }));
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !(draft.tags ?? []).includes(t)) set('tags', [...(draft.tags ?? []), t]);
    setTagInput('');
  };
  const save = async () => {
    if (!venue) return;
    setSaving(true); setMsg(''); setConflict(null);
    const r = await fetch('/api/venues', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: venue.id, info: draft, baseUpdatedAt: saved?.updatedAt ?? 0 }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.status === 409 && d.conflict) { setConflict({ info: d.info, name: d.name }); setMsg(d.error); return; }
    if (!r.ok) { setMsg(d.error || 'Could not save'); return; }
    setInfo((all) => ({ ...all, [venue.id]: d.info }));
    if (d.info.updatedBy) setNames((n) => ({ ...n, [d.info.updatedBy]: d.name }));
    setDraft(editable(d.info));
    setMsg('Saved');
    loadHistory(venue.id);
  };
  const takeTheirs = () => {
    if (!venue || !conflict) return;
    setInfo((all) => ({ ...all, [venue.id]: conflict.info }));
    setDraft(editable(conflict.info)); setConflict(null); setMsg('Loaded the latest version. Re-apply your change and save.');
    loadHistory(venue.id);
  };
  const keepMine = () => {
    if (!venue || !conflict) return;
    // Put only the fields I changed on top of their version, so their other changes aren't lost.
    const base = editable(saved) as Record<string, unknown>, mine = draft as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...editable(conflict.info) };
    for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
      if (JSON.stringify(base[k]) !== JSON.stringify(mine[k])) merged[k] = mine[k];
    }
    setInfo((all) => ({ ...all, [venue.id]: conflict.info }));
    setDraft(merged as Info); setConflict(null); setMsg('Your changes are on top of their version. Check it and press Save.');
  };
  const useFound = () => {
    if (place && place !== 'loading') setDraft((d) => ({ ...d, address: d.address || place.address, phone: d.phone || place.phone, website: d.website || place.website }));
  };

  const upload = async (files: FileList | null) => {
    if (!venue || !files?.length) return;
    setUploading(true); setMsg('');
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append('id', venue.id); fd.append('file', f);
      const r = await fetch('/api/venues/files', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error || 'Upload failed'); break; }
      setInfo((all) => ({ ...all, [venue.id]: { ...(all[venue.id] ?? {}), files: d.files } }));
      setNames((n) => ({ ...n, [d.files.at(-1)?.by]: d.name }));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    loadHistory(venue.id);
  };
  const removeFile = async (fid: string) => {
    if (!venue) return;
    const r = await fetch(`/api/venues/files?id=${encodeURIComponent(venue.id)}&file=${fid}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setInfo((all) => ({ ...all, [venue.id]: { ...(all[venue.id] ?? {}), files: d.files } })); loadHistory(venue.id); }
  };

  const addVenue = async () => {
    setAddMsg('');
    const r = await fetch('/api/venues/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newV) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setAddMsg(d.error || 'Could not add the venue'); return; }
    setVenues((vs) => [...vs, d.venue]); setAdding(false); setNewV({ name: '', state: '', address: '', type: '' }); setInfo((all) => ({ ...all, [d.venue.id]: d.info }));
    setOpen((o) => ({ ...o, [d.venue.state]: true })); pick(d.venue);
  };
  const removeVenue = async () => {
    if (!venue?.custom) return;
    const r = await fetch(`/api/venues/custom?id=${encodeURIComponent(venue.id)}`, { method: 'DELETE' });
    if (r.ok) { setVenues((vs) => vs.filter((v) => v.id !== venue.id)); setSel(''); }
  };

  return (
    <main className="vn">
      <aside className="vn-left" aria-label="Venues by state">
        <div className="vn-left-head">
          <div><b>Venues</b><span className="muted"> · {venues.length}</span></div>
          <div className="vn-left-actions">
            <button className="vn-plus" onClick={() => { setAdding((a) => !a); setAddMsg(''); }} aria-label="Add a venue" title="Add an association, hotel or venue">+</button>
            <a className="linkbtn" href="/api/venues/export">Export</a>
          </div>
        </div>
        {adding && (
          <div className="vn-add">
            <b className="vn-small">New association, hotel or venue</b>
            <input placeholder="Name (e.g. Lake County Association of REALTORS)" value={newV.name} onChange={(e) => setNewV({ ...newV, name: e.target.value })} />
            <select value={newV.type} onChange={(e) => setNewV({ ...newV, type: e.target.value })} aria-label="Type">
              <option value="">Type…</option>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input list="vn-states" placeholder="State (e.g. FLORIDA)" value={newV.state} onChange={(e) => setNewV({ ...newV, state: e.target.value })} />
            <datalist id="vn-states">{states.map((s) => <option key={s} value={s} />)}</datalist>
            <input placeholder="Address, city, ZIP" value={newV.address} onChange={(e) => setNewV({ ...newV, address: e.target.value })} />
            <div className="vn-add-row">
              <button className="btn primary" onClick={addVenue} disabled={!newV.name || !newV.state || !newV.address}>Add</button>
              <span className="muted vn-small">Saved in the hub. Add the pin in Google too so it shows on the map.</span>
            </div>
            {addMsg && <p className="vn-err">{addMsg}</p>}
          </div>
        )}
        <input className="vn-search" placeholder="Search venues, tags, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="vn-filters">
          <select value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {statuses.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <label className="vn-due">
          <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
          Follow-ups due <span className={`vn-count${dueCount ? ' is-due' : ''}`}>{dueCount}</span>
        </label>
        {stale && <p className="vn-warn vn-pad">Showing the copy saved {new Date(stale).toLocaleString()}: Google’s map couldn’t be read just now. <button className="linkbtn" onClick={() => load(true)}>Retry</button></p>}
        {loading && !venues.length && <p className="muted vn-pad">Loading the Google map…</p>}
        {error && <p className="vn-err vn-pad">{error} <button className="linkbtn" onClick={() => load(true)}>Try again</button></p>}
        <div className="vn-states">
          {states.map((st) => {
            const all = venues.filter((v) => v.state === st);
            const list = shown.filter((v) => v.state === st);
            if (filtering && !list.length) return null;
            const isOpen = open[st] ?? filtering;
            const counts = statuses.map((s) => [s, all.filter((v) => statusOf(info[v.id]) === s).length] as const).filter(([, n]) => n);
            return (
              <section key={st} className="vn-state">
                <div className="vn-state-row">
                  <button className="vn-state-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [st]: !isOpen }))}>
                    <span className="vn-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                    <span className="vn-state-name">{st}</span>
                    <span className="vn-count">{filtering ? `${list.length}/${all.length}` : all.length}</span>
                  </button>
                  <button className="vn-plus sm" onClick={() => { setAdding(true); setAddMsg(''); setNewV((n) => ({ ...n, state: st })); }} aria-label={`Add a venue in ${title(st)}`} title={`Add a venue in ${title(st)}`}>+</button>
                </div>
                <div className="vn-counts">
                  {counts.map(([s, n]) => <span key={s} title={s}><i className={`vn-dot tone-${STATUS_TONE[s]}`} />{n} {s}</span>)}
                </div>
                {isOpen && (
                  <ul>
                    {list.map((v) => {
                      const i = info[v.id];
                      return (
                        <li key={v.id}>
                          <button className={`vn-venue${v.id === sel ? ' is-sel' : ''}`} onClick={() => pick(v)}>
                            <Pin v={v} />
                            <span className="vn-venue-name">{v.name}</span>
                            {(i?.classroom || i?.theater) && <span className="vn-cap" title="Classroom / Theater max">{i?.classroom ?? '–'}/{i?.theater ?? '–'}</span>}
                            {v.custom && <span className="vn-hub" title="Added in the hub, not on the Google map yet">hub</span>}
                            {isDue(i) && <span className="vn-hub is-due" title={`Follow up ${fmtDate(i?.followUp)}`}>due</span>}
                            {i?.status && <span className={`vn-dot tone-${STATUS_TONE[i.status] ?? 'muted'}`} title={i.status} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <p className="muted vn-small vn-pad"><a href={editUrl} target="_blank" rel="noreferrer">Add or move pins in Google ↗</a></p>
      </aside>

      <section className="vn-map" aria-label="Google map">
        <iframe key={mapSrc} src={mapSrc} title="Club Wealth venues map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        {!panel && <button className="vn-reopen" onClick={() => setPanel(true)}>Details ◂</button>}
      </section>

      {panel && (
        <aside className="vn-right" aria-label="Venue details">
          <div className="vn-right-head">
            <div>
              <b>{venue ? venue.name : 'Venue details'}</b>
              {venue && (
                <p className="muted vn-sub">
                  {title(venue.state)}{venue.custom ? ' · added in the hub' : ''} · <a href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
                </p>
              )}
            </div>
            <button className="linkbtn" onClick={() => setPanel(false)} aria-label="Hide details">▸</button>
          </div>
          {!venue ? (
            <p className="muted vn-pad">Pick a venue on the left to see and add its details. The map zooms to it.</p>
          ) : (
            <div className="vn-form">
              {conflict && (
                <div className="vn-conflict">
                  <b>{conflict.name ?? 'Someone'} saved this venue after you opened it.</b>
                  <div className="vn-add-row">
                    <button className="btn" onClick={takeTheirs}>Load their version</button>
                    <button className="btn" onClick={keepMine}>Keep my edits</button>
                  </div>
                </div>
              )}

              <Section title="Details">
                <div className="vn-two">
                  <label>Type
                    <select value={draft.type ?? ''} onChange={(e) => set('type', e.target.value)}>
                      <option value="">—</option>
                      {types.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>Status
                    <select value={draft.status ?? ''} onChange={(e) => set('status', e.target.value)}>
                      <option value="">Not contacted yet</option>
                      {statuses.filter((s) => s !== 'Not contacted yet').map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                </div>
                <label>Description<textarea rows={3} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
                <div className="vn-tags">
                  <span>Tags</span>
                  <div className="vn-tag-list">
                    {(draft.tags ?? []).map((t) => (
                      <span key={t} className="chip">{t} <button aria-label={`Remove ${t}`} onClick={() => set('tags', (draft.tags ?? []).filter((x) => x !== t))}>×</button></span>
                    ))}
                  </div>
                  <input placeholder="Add a tag and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
                </div>
              </Section>

              <Section title="Address & phone">
                <label>Address<input value={draft.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder={venue.address ?? ''} /></label>
                <div className="vn-two">
                  <label>Phone<input value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></label>
                  <label>Website<input value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></label>
                </div>
                {place === 'loading' && <p className="muted vn-small">Looking up the address…</p>}
                {place && place !== 'loading' && (
                  <div className="vn-found">
                    <span className="muted vn-small">{place.nearest ? 'Nearest address to the pin (OpenStreetMap), check it:' : `Found on ${place.source === 'google' ? 'Google' : 'OpenStreetMap'}:`}</span>
                    {place.address && <span>{place.address}</span>}
                    {place.phone && <span>{place.phone}</span>}
                    {place.website && <a href={place.website} target="_blank" rel="noreferrer">{place.website}</a>}
                    {(!draft.address || (!draft.phone && place.phone) || (!draft.website && place.website)) && <button className="linkbtn" onClick={useFound}>Use these</button>}
                  </div>
                )}
                {place === null && <p className="muted vn-small">No address found automatically; type it in.</p>}
              </Section>

              <Section title="Contact & follow-up">
                <label>Contact person<input value={draft.contact ?? ''} onChange={(e) => set('contact', e.target.value)} placeholder="Name, phone, email" /></label>
                <div className="vn-two">
                  <label>Last contacted<input type="date" value={draft.lastContacted ?? ''} onChange={(e) => set('lastContacted', e.target.value)} /></label>
                  <label>Follow up on<input type="date" value={draft.followUp ?? ''} onChange={(e) => set('followUp', e.target.value)} /></label>
                </div>
                {isDue(draft) && <p className="vn-warn vn-small">Follow-up due {fmtDate(draft.followUp)}</p>}
              </Section>

              <Section title="Booking & cost" open={false}>
                <span className="vn-label">Capacity (one room can have both setups)</span>
                <div className="vn-two">
                  <label>Classroom max<input inputMode="numeric" value={draft.classroom ?? ''} onChange={(e) => set('classroom', e.target.value)} placeholder="e.g. 60" /></label>
                  <label>Theater max<input inputMode="numeric" value={draft.theater ?? ''} onChange={(e) => set('theater', e.target.value)} placeholder="e.g. 80" /></label>
                </div>
                <label>Rate<input value={draft.rate ?? ''} onChange={(e) => set('rate', e.target.value)} placeholder="e.g. $500 half day" /></label>
                <div className="vn-two">
                  <label>Deposit<input value={draft.deposit ?? ''} onChange={(e) => set('deposit', e.target.value)} placeholder="e.g. $200, due 14 days before" /></label>
                  <label>Contract
                    <select value={draft.contract ?? ''} onChange={(e) => set('contract', e.target.value)}>
                      <option value="">—</option>
                      {contracts.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <label>Cancellation terms<textarea rows={2} value={draft.cancellation ?? ''} onChange={(e) => set('cancellation', e.target.value)} /></label>
                <p className="muted vn-small">Every rate change is kept in the history below.</p>
              </Section>

              <label>Notes<textarea rows={4} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>

              <div className="vn-save">
                <button className="btn primary" onClick={save} disabled={!dirty || saving || Boolean(conflict)}>{saving ? 'Saving…' : 'Save'}</button>
                {msg && <span className={msg === 'Saved' ? 'vn-ok' : 'vn-err'}>{msg}</span>}
              </div>
              {saved?.updatedAt && <p className="muted vn-small">Last updated by {names[saved.updatedBy ?? ''] ?? 'someone'} · {new Date(saved.updatedAt).toLocaleString()}</p>}

              <Section title={`Photos & files (${saved?.files?.length ?? 0})`}>
                <div className="vn-files">
                  {(saved?.files ?? []).map((f) => (
                    <div key={f.id} className="vn-file">
                      {f.type.startsWith('image/')
                        ? <a href={`/api/venues/files/${f.id}`} target="_blank" rel="noreferrer"><img src={`/api/venues/files/${f.id}`} alt={f.name} /></a>
                        : <a className="vn-pdf" href={`/api/venues/files/${f.id}`} target="_blank" rel="noreferrer">PDF</a>}
                      <span title={f.name}>{f.name}</span>
                      <button className="linkbtn" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`}>×</button>
                    </div>
                  ))}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
                <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Add photos or files'}</button>
                <p className="muted vn-small">Room setup, floor plan, contract… PNG, JPEG or PDF, up to 4 MB each.</p>
              </Section>

              <Section title="Eventbrite events here">
                {events === 'loading' && <p className="muted vn-small">Checking Eventbrite…</p>}
                {events && events !== 'loading' && !events.connected && <p className="muted vn-small">Eventbrite isn’t connected to the hub yet.</p>}
                {events && events !== 'loading' && events.error && <p className="vn-err vn-small">{events.error}</p>}
                {events && events !== 'loading' && events.connected && !events.error && !events.events.length && <p className="muted vn-small">No Eventbrite events found at this venue.</p>}
                {events && events !== 'loading' && events.events.length > 0 && (
                  <ul className="vn-events">
                    {events.events.map((e) => (
                      <li key={e.id}>
                        <a href={e.url} target="_blank" rel="noreferrer">{e.name}</a>
                        <span className="muted vn-small">
                          {e.start ? new Date(e.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          {e.start && e.start > new Date().toISOString() ? ' · upcoming' : ''}
                          {e.sold != null ? ` · ${e.sold}${e.capacity ? `/${e.capacity}` : ''} registered` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="History" open={false}>
                {history === null && <p className="muted vn-small">Loading…</p>}
                {history && !history.length && <p className="muted vn-small">No changes yet.</p>}
                {history && history.length > 0 && (
                  <ul className="vn-history">
                    {history.map((c, i) => (
                      <li key={i}>
                        <span className="muted vn-small">{new Date(c.at).toLocaleString()} · {c.byName}</span>
                        <span><b>{FIELD_NAMES[c.field] ?? c.field}</b>{c.from ? <>: <s>{c.from}</s></> : ''}{c.to ? <> → {c.to}</> : c.from ? ' cleared' : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {venue.custom && <button className="linkbtn vn-remove" onClick={removeVenue}>Remove this hub-added venue</button>}
            </div>
          )}
        </aside>
      )}
    </main>
  );
}

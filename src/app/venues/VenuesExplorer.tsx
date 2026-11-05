'use client';

// Events venues: left = venues grouped by state (dropdown per state, like the Google map's legend),
// middle = the Google My Maps embed (Google's own map, icons and locations), right = collapsible panel
// with the team's details for the picked venue (description, type, status, tags, contact, notes).

import { useEffect, useMemo, useState } from 'react';

interface Venue { id: string; name: string; state: string; lat: number; lng: number; color: string; icon: 'pin' | 'letter' }
interface Info {
  description?: string; type?: string; status?: string; tags?: string[]; contact?: string; website?: string;
  capacity?: string; rate?: string; notes?: string; updatedAt?: number; updatedBy?: string;
}

const STATUS_TONE: Record<string, string> = { Renting: 'ok', 'Not Renting': 'bad', 'Not Available': 'warn', 'Not contacted yet': 'muted' };
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Pin({ v }: { v: Venue }) {
  return (
    <svg className="vn-pin" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill={v.color} />
      {v.icon === 'letter' ? <text x="12" y="12.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">T</text> : <circle cx="12" cy="9" r="2.6" fill="#fff" />}
    </svg>
  );
}

export function VenuesExplorer({ mapId, editUrl, types, statuses }: { mapId: string; editUrl: string; types: string[]; statuses: string[] }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [sel, setSel] = useState<string>('');
  const [panel, setPanel] = useState(true);
  const [draft, setDraft] = useState<Info>({});
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = (fresh = false) => {
    setLoading(true);
    fetch(`/api/venues${fresh ? '?fresh=1' : ''}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load the venues'); return d; })
      .then((d) => { setVenues(d.venues); setInfo(d.info); setNames(d.names); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const states = useMemo(() => [...new Set(venues.map((v) => v.state))], [venues]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return venues.filter((v) => {
      const i = info[v.id] ?? {};
      if (fType && i.type !== fType) return false;
      if (fStatus && (i.status ?? 'Not contacted yet') !== fStatus) return false;
      if (!s) return true;
      return [v.name, v.state, i.description, i.notes, i.contact, ...(i.tags ?? [])].some((x) => x?.toLowerCase().includes(s));
    });
  }, [venues, info, q, fType, fStatus]);
  const filtering = Boolean(q || fType || fStatus);

  const venue = venues.find((v) => v.id === sel);
  useEffect(() => { setDraft(venue ? { ...(info[venue.id] ?? {}) } : {}); setMsg(''); setTagInput(''); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (v: Venue) => { setSel(v.id); setPanel(true); };
  const mapSrc = `https://www.google.com/maps/d/embed?mid=${mapId}${venue ? `&ll=${venue.lat},${venue.lng}&z=14` : ''}`;
  const dirty = venue && JSON.stringify(draft) !== JSON.stringify(info[venue.id] ?? {});

  const set = (k: keyof Info, v: unknown) => setDraft((d) => ({ ...d, [k]: v === '' ? undefined : v }));
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !(draft.tags ?? []).includes(t)) set('tags', [...(draft.tags ?? []), t]);
    setTagInput('');
  };
  const save = async () => {
    if (!venue) return;
    setSaving(true); setMsg('');
    const r = await fetch('/api/venues', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: venue.id, info: draft }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg(d.error || 'Could not save'); return; }
    setInfo((all) => ({ ...all, [venue.id]: d.info }));
    setNames((n) => ({ ...n, [d.info.updatedBy]: d.name }));
    setDraft(d.info);
    setMsg('Saved');
  };

  return (
    <main className="vn">
      <aside className="vn-left" aria-label="Venues by state">
        <div className="vn-left-head">
          <div>
            <b>Venues</b>
            <span className="muted"> · {venues.length} on the Google map</span>
          </div>
          <a className="vn-small" href={editUrl} target="_blank" rel="noreferrer">Edit pins in Google ↗</a>
        </div>
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
        {loading && !venues.length && <p className="muted vn-pad">Loading the Google map…</p>}
        {error && <p className="vn-err vn-pad">{error} <button className="linkbtn" onClick={() => load(true)}>Try again</button></p>}
        <div className="vn-states">
          {states.map((st) => {
            const list = shown.filter((v) => v.state === st);
            const total = venues.filter((v) => v.state === st).length;
            if (filtering && !list.length) return null;
            const isOpen = open[st] ?? filtering;
            return (
              <section key={st} className="vn-state">
                <button className="vn-state-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [st]: !isOpen }))}>
                  <span className="vn-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="vn-state-name">{st}</span>
                  <span className="vn-count">{filtering ? `${list.length}/${total}` : total}</span>
                </button>
                {isOpen && (
                  <ul>
                    {list.map((v) => {
                      const i = info[v.id];
                      return (
                        <li key={v.id}>
                          <button className={`vn-venue${v.id === sel ? ' is-sel' : ''}`} onClick={() => pick(v)}>
                            <Pin v={v} />
                            <span className="vn-venue-name">{v.name}</span>
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
      </aside>

      <section className="vn-map" aria-label="Google map">
        <iframe key={mapSrc} src={mapSrc} title="Club Wealth venues map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        {!panel && venue && <button className="vn-reopen" onClick={() => setPanel(true)}>Details ◂</button>}
      </section>

      {panel && (
        <aside className="vn-right" aria-label="Venue details">
          <div className="vn-right-head">
            <b>{venue ? venue.name : 'Venue details'}</b>
            <button className="linkbtn" onClick={() => setPanel(false)} aria-label="Hide details">▸</button>
          </div>
          {!venue ? (
            <p className="muted vn-pad">Pick a venue on the left to see and add its details. The map zooms to it.</p>
          ) : (
            <div className="vn-form">
              <p className="muted vn-sub">
                {title(venue.state)} · <a href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
              </p>
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
              <label>Description
                <textarea rows={3} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </label>
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
              <div className="vn-two">
                <label>Capacity<input value={draft.capacity ?? ''} onChange={(e) => set('capacity', e.target.value)} placeholder="e.g. 120 seats" /></label>
                <label>Rate<input value={draft.rate ?? ''} onChange={(e) => set('rate', e.target.value)} placeholder="e.g. $500 half day" /></label>
              </div>
              <label>Contact<input value={draft.contact ?? ''} onChange={(e) => set('contact', e.target.value)} placeholder="Name, phone, email" /></label>
              <label>Website<input value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></label>
              <label>Notes<textarea rows={5} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
              <div className="vn-save">
                <button className="btn primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
                {msg && <span className={msg === 'Saved' ? 'vn-ok' : 'vn-err'}>{msg}</span>}
              </div>
              {info[venue.id]?.updatedAt && (
                <p className="muted vn-small">Last updated by {names[info[venue.id].updatedBy ?? ''] ?? 'someone'} · {new Date(info[venue.id].updatedAt!).toLocaleString()}</p>
              )}
            </div>
          )}
        </aside>
      )}
    </main>
  );
}

'use client';

// New Client Welcome Posts (Jay Mar's task #1): new clients from Keap → photo → Facebook Page and Group
// captions → welcome graphic → ready to publish. Keap is only read; nothing is posted from the hub.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GROUP_CAPTIONS, PAGE_CAPTIONS, photoRequest, type ClientFacts } from '@/lib/welcome/captions';
import type { WelcomeRecord, WelcomeSettings, WelcomeStatus } from '@/lib/welcome/store';
import type { NewClient } from '@/lib/welcome/keap-clients';
import { uploadFile } from '@/components/chat/Attachments';
import { WelcomeSettingsDialog } from './WelcomeSettingsDialog';

const ASK_EVENT = 'cw-ask-assistant';
const PHOTO_WAIT_MS = 2 * 24 * 60 * 60 * 1000;
const META_COMPOSER = 'https://business.facebook.com/latest/composer';

export const STATUS_LABEL: Record<WelcomeStatus, string> = {
  new: 'New', photo: 'Waiting on photo', ready: 'Captions ready', review: 'In review', scheduled: 'Scheduled', posted: 'Posted', skipped: 'Skipped',
};
const TODO: WelcomeStatus[] = ['new', 'photo', 'ready', 'review'];
type Filter = 'todo' | 'scheduled' | 'posted' | 'skipped' | 'all';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const initials = (c: NewClient) => `${c.first[0] ?? ''}${c.last[0] ?? ''}`.toUpperCase() || '?';
const nextWeekday = () => {
  const d = new Date();
  do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
  return d.toLocaleDateString('en-CA');
};
function weekLabel(iso: string) {
  const d = new Date(iso);
  const monday = (x: Date) => { const m = new Date(x); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m.getTime(); };
  const diff = Math.round((monday(new Date()) - monday(d)) / (7 * 24 * 60 * 60 * 1000));
  return diff <= 0 ? 'Signed up this week' : diff === 1 ? 'Signed up last week' : `Signed up ${diff} weeks ago`;
}

export function WelcomePosts({ taskId, readOnly }: { taskId: string; readOnly?: boolean }) {
  const [clients, setClients] = useState<NewClient[]>([]);
  const [records, setRecords] = useState<Record<string, WelcomeRecord>>({});
  const [settings, setSettings] = useState<WelcomeSettings | null>(null);
  const [keap, setKeap] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todo');
  const [open, setOpen] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh || !clients.length) setLoading(true);
    const res = await fetch(`/api/welcome${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setClients(body.clients); setRecords(body.records); setSettings(body.settings); setKeap(body.keap); setError(body.error ?? '');
    } else setError(body.error || 'Couldn’t load new clients');
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  // While the assistant is making graphics, check back every 20 seconds.
  const making = Object.values(records).some((r) => r.graphic?.status === 'pending');
  useEffect(() => {
    if (!making) return;
    const t = setInterval(() => load(), 20_000);
    return () => clearInterval(t);
  }, [making, load]);

  const statusOf = (c: NewClient): WelcomeStatus => records[c.contactId]?.status ?? 'new';
  const counts = useMemo(() => {
    const n = { todo: 0, scheduled: 0, posted: 0, skipped: 0, all: clients.length };
    for (const c of clients) { const s = statusOf(c); if (TODO.includes(s)) n.todo++; else if (s in n) n[s as 'scheduled']++; }
    return n;
  }, [clients, records]); // eslint-disable-line react-hooks/exhaustive-deps
  // The open card stays in view while you work on it, even once its status leaves the current filter.
  const shown = clients.filter((c) => { const s = statusOf(c); return c.contactId === open || filter === 'all' || (filter === 'todo' ? TODO.includes(s) : s === filter); });
  const groups = shown.reduce<Record<string, NewClient[]>>((acc, c) => { (acc[weekLabel(c.signedUp)] ??= []).push(c); return acc; }, {});

  async function save(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/welcome/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setRecords((r) => ({ ...r, [id]: body.record }));
    return res.ok ? null : body.error || 'Couldn’t save';
  }

  const needsSetup = settings && !settings.tagIds.length;

  return (
    <main className="ws-main wp" aria-label="New client welcome posts">
      <div className="ws-mh">
        <span className="ws-bot wp-bot" aria-hidden="true">👋</span>
        <b>New client welcome posts</b>
        <span className="muted small wp-from">{settings?.tagNames.length ? `From Keap · ${settings.tagNames.join(', ')} · last ${settings.days} days${settings.auto ? ' · auto-prepare on' : ''}` : 'From Keap'}</span>
        <span style={{ flex: 1 }} />
        <button className="linkbtn" onClick={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        {!readOnly && <button className="linkbtn" onClick={() => setShowSettings(true)}>Settings</button>}
      </div>

      {!needsSetup && keap && (
        <div className="wp-filters" role="group" aria-label="Show">
          {([['todo', 'To do'], ['scheduled', 'Scheduled'], ['posted', 'Posted'], ['skipped', 'Skipped'], ['all', 'All']] as [Filter, string][]).map(([f, label]) => (
            <button key={f} className={`chip-btn${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} <span className="wp-n">{counts[f]}</span></button>
          ))}
        </div>
      )}

      <div className="wp-body">
        {!keap ? <p className="note">Keap isn’t connected, so new clients can’t be pulled in yet.</p>
          : needsSetup ? (
            <div className="wp-empty">
              <h3>Choose how new clients are found</h3>
              <p className="muted">Pick the Keap tag that’s applied when someone becomes a client (for example “New Client”). The hub lists everyone who got it recently. It only reads Keap; nothing there changes.</p>
              {!readOnly && <button className="btn primary" onClick={() => setShowSettings(true)}>Choose the Keap tag</button>}
            </div>
          ) : error ? <p className="note" role="alert">{error}</p>
            : loading && !clients.length ? <p className="muted small">Pulling new clients from Keap…</p>
              : !shown.length ? <p className="muted small">{filter === 'todo' ? 'All caught up: no welcome posts to prepare.' : 'Nobody here.'}</p>
                : Object.entries(groups).map(([label, list]) => (
                  <section key={label} className="wp-group">
                    <h4>{label} <span className="wp-n">{list.length}</span></h4>
                    <ul className="wp-list">
                      {list.map((c) => (
                        <ClientCard key={c.contactId} c={c} rec={records[c.contactId]} open={open === c.contactId} readOnly={readOnly} taskId={taskId}
                          onToggle={() => setOpen(open === c.contactId ? null : c.contactId)} onSave={(p) => save(c.contactId, p)}
                          onRecord={(r) => setRecords((x) => ({ ...x, [c.contactId]: r }))} />
                      ))}
                    </ul>
                  </section>
                ))}
      </div>

      {showSettings && settings && (
        <WelcomeSettingsDialog settings={settings} onClose={() => setShowSettings(false)} onSaved={(s) => { setSettings(s); setShowSettings(false); load(true); }} />
      )}
    </main>
  );
}

function ClientCard({ c, rec, open, readOnly, taskId, onToggle, onSave, onRecord }: {
  c: NewClient; rec?: WelcomeRecord; open: boolean; readOnly?: boolean; taskId: string;
  onToggle: () => void; onSave: (p: Record<string, unknown>) => Promise<string | null>; onRecord: (r: WelcomeRecord) => void;
}) {
  const facts: ClientFacts = {
    first: c.first || 'there', full: [c.first, c.last].filter(Boolean).join(' ') || 'our newest member',
    business: (rec?.business ?? c.business) || undefined, city: (rec?.city ?? c.city) || undefined, coach: (rec?.coach ?? c.coach) || undefined,
  };
  const status = rec?.status ?? 'new';
  const [pageV, setPageV] = useState(0);
  const [groupV, setGroupV] = useState(0);
  const [page, setPage] = useState(rec?.pageCaption ?? '');
  const [group, setGroup] = useState(rec?.groupCaption ?? '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [calDate, setCalDate] = useState(rec?.scheduledFor ?? nextWeekday());
  const [calTime, setCalTime] = useState('10:00');

  // Until a caption is saved, show a ready-made one filled in from Keap.
  const pageText = page || PAGE_CAPTIONS[pageV % PAGE_CAPTIONS.length](facts);
  const groupText = group || GROUP_CAPTIONS[groupV % GROUP_CAPTIONS.length](facts);
  const photoWaiting = status === 'photo' && rec?.photoRequestedAt && !rec.photoFileId;
  const photoOverdue = photoWaiting && Date.now() - rec!.photoRequestedAt! > PHOTO_WAIT_MS;
  const photoUrl = rec?.photoFileId ? `/api/chat/files/${rec.photoFileId}` : null;
  const fbSearch = c.facebook ?? `https://www.facebook.com/search/people/?q=${encodeURIComponent(facts.full)}`;

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { setMsg('Couldn’t copy. Select the text and copy it instead.'); }
  }
  async function run(key: string, fn: () => Promise<string | null | void>) {
    setBusy(key); setMsg('');
    const err = await fn();
    if (err) setMsg(err);
    setBusy('');
  }
  const ask = (text: string, withPhoto = false) => window.dispatchEvent(new CustomEvent(ASK_EVENT, {
    detail: { taskId, text, files: withPhoto && rec?.photoFileId ? [{ id: rec.photoFileId, name: `${facts.first}-photo.jpg`, type: 'image/jpeg', size: 0 }] : undefined },
  }));
  const makeGraphic = async () => {
    const res = await fetch(`/api/welcome/${c.contactId}/graphic`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error || 'Couldn’t start the graphic';
    onRecord(body.record);
  };
  const factLine = [`Name: ${facts.full}`, facts.business && `Business: ${facts.business}`, facts.city && `City: ${facts.city}`, facts.coach && `Coach: ${facts.coach}`].filter(Boolean).join('\n');

  return (
    <li className={`wp-card${open ? ' open' : ''}`}>
      <button className="wp-row" onClick={onToggle} aria-expanded={open}>
        {photoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="wp-ava" src={photoUrl} alt="" />
          : <span className="wp-ava">{initials(c)}</span>}
        <span className="wp-who">
          <b>{facts.full}</b>
          <span className="muted small">{[facts.business, facts.city, facts.coach && `Coach: ${facts.coach}`].filter(Boolean).join(' · ') || c.email}</span>
        </span>
        <span className="wp-when small muted">{day(c.signedUp)}</span>
        <span className={`wp-st st-${status}`}>{photoOverdue ? 'Photo overdue' : STATUS_LABEL[status]}</span>
      </button>

      {open && (
        <div className="wp-steps">
          <fieldset disabled={readOnly} className="wp-step">
            <legend>1 · Details <span className="muted small">from Keap · you can correct them here (Keap isn’t changed)</span></legend>
            <div className="wp-grid3">
              {(['business', 'city', 'coach'] as const).map((k) => (
                <label key={k} className="field">
                  <span>{k === 'business' ? 'Business' : k === 'city' ? 'City' : 'Coach'}</span>
                  <input defaultValue={rec?.[k] ?? c[k] ?? ''} placeholder={k === 'coach' ? 'Coach’s name' : ''}
                    onBlur={(e) => { if (e.target.value !== (rec?.[k] ?? c[k] ?? '')) onSave({ [k]: e.target.value }); }} />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={readOnly} className="wp-step">
            <legend>2 · Photo</legend>
            <div className="wp-photo">
              {photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photoUrl} alt={`${facts.full}’s photo`} />
                : <div className="wp-nophoto">{rec?.noPhoto ? 'No-photo version' : 'No photo yet'}</div>}
              <div className="wp-photo-acts">
                <a className="btn" href={fbSearch} target="_blank" rel="noreferrer">{c.facebook ? 'Open their Facebook' : 'Find on Facebook'}</a>
                <label className="btn wp-upload">
                  {busy === 'photo' ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => {
                    const f = e.target.files?.[0]; e.target.value = '';
                    if (f) run('photo', async () => { const r = await uploadFile(f); return r.error ?? (await onSave({ photoFileId: r.id, status: status === 'new' || status === 'photo' ? 'new' : status })); });
                  }} />
                </label>
                {!photoUrl && (
                  <>
                    <button className="btn" onClick={() => { copy('req', photoRequest(facts)); if (!rec?.photoRequestedAt) onSave({ photoRequested: true, status: 'photo' }); }}>
                      {copied === 'req' ? 'Copied ✓' : 'Copy photo request'}
                    </button>
                    <label className="wp-check"><input type="checkbox" checked={Boolean(rec?.noPhoto)} onChange={(e) => onSave({ noPhoto: e.target.checked })} /> Use the no-photo version</label>
                  </>
                )}
              </div>
            </div>
            {photoWaiting && <p className={`small ${photoOverdue ? 'wp-warn' : 'muted'}`} style={{ margin: 0 }}>Asked for a photo {day(new Date(rec!.photoRequestedAt!).toISOString())}.{photoOverdue ? ' No reply after 2 days: use the no-photo version.' : ' Wait up to 2 days, then use the no-photo version.'}</p>}
            {!photoUrl && !rec?.photoRequestedAt && <p className="muted small" style={{ margin: 0 }}>Paste the photo request into Messenger. Copying it marks the client as “Waiting on photo”.</p>}
          </fieldset>

          <fieldset disabled={readOnly} className="wp-step">
            <legend>3 · Captions</legend>
            <div className="wp-caps">
              {([['page', 'Facebook Page', pageText, setPage, () => setPageV((v) => v + 1)], ['group', 'Facebook Group', groupText, setGroup, () => setGroupV((v) => v + 1)]] as const).map(([k, label, text, set, next]) => (
                <div key={k} className="wp-cap">
                  <div className="spread"><b className="small">{label}</b>
                    <span className="row">
                      <button className="linkbtn" onClick={() => { set(''); next(); }} title="A different ready-made version">Another version</button>
                      <button className="linkbtn" onClick={() => copy(k, text)}>{copied === k ? 'Copied ✓' : 'Copy'}</button>
                    </span>
                  </div>
                  <textarea value={text} rows={5} onChange={(e) => set(e.target.value)}
                    onBlur={(e) => onSave({ [k === 'page' ? 'pageCaption' : 'groupCaption']: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="row">
              <button className="btn primary" disabled={!!busy} onClick={() => run('cap', () => onSave({ pageCaption: pageText, groupCaption: groupText, status: status === 'new' || status === 'photo' ? 'ready' : status }))}>
                {busy === 'cap' ? 'Saving…' : 'Captions are ready'}
              </button>
              <button className="btn" onClick={() => ask(`Improve these welcome captions for a new Club Wealth client. Keep the facts exactly as given; give one Page version and one Group version, each in its own [DRAFT].\n\n${factLine}\n\nFacebook Page caption:\n${pageText}\n\nFacebook Group caption:\n${groupText}`)}>✦ Improve with assistant</button>
            </div>
          </fieldset>

          <fieldset disabled={readOnly} className="wp-step">
            <legend>4 · Welcome graphic</legend>
            {rec?.graphic?.status === 'done' && rec.graphic.fileId ? (
              <div className="wp-graphic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={`/api/chat/files/${rec.graphic.fileId}`} target="_blank" rel="noreferrer"><img src={`/api/chat/files/${rec.graphic.fileId}`} alt={`Welcome graphic for ${facts.full}`} /></a>
                <div className="wp-photo-acts">
                  <a className="btn" href={`/api/chat/files/${rec.graphic.fileId}?download=1`}>Download</a>
                  <button className="btn" onClick={() => run('gfx', makeGraphic)}>{busy === 'gfx' ? 'Starting…' : 'Make a new one'}</button>
                  <button className="btn" onClick={() => ask(`Change the welcome graphic for ${facts.full}: [what to change]. Keep the same size and Club Wealth look.\n${factLine}`, true)}>✦ Change it with the assistant</button>
                  <span className="muted small">{rec.graphic.withPhoto ? 'With their photo' : 'No-photo version'}</span>
                </div>
              </div>
            ) : rec?.graphic?.status === 'pending' ? (
              <p className="wp-making"><span className="cf-spin" aria-hidden="true" /> The assistant is making the graphic{rec.graphic.withPhoto ? ' with their photo' : ' (no-photo version)'}. It usually takes 1–3 minutes and shows up here.</p>
            ) : (
              <div className="row">
                {rec?.graphic?.status === 'error' && <span className="wp-warn small">The last try didn’t work.</span>}
                <button className="btn" disabled={!!busy} onClick={() => run('gfx', makeGraphic)}>{busy === 'gfx' ? 'Starting…' : rec?.graphic ? 'Try again' : 'Make it now'}</button>
                <span className="muted small">Made automatically once there’s a photo, or when you choose the no-photo version.</span>
              </div>
            )}
          </fieldset>

          <fieldset disabled={readOnly} className="wp-step">
            <legend>5 · Publish</legend>
            <div className="row">
              <button className="btn" onClick={() => copy('p2', pageText)}>{copied === 'p2' ? 'Copied ✓' : 'Copy Page caption'}</button>
              <button className="btn" onClick={() => copy('g2', groupText)}>{copied === 'g2' ? 'Copied ✓' : 'Copy Group caption'}</button>
              <a className="btn" href={META_COMPOSER} target="_blank" rel="noreferrer">Open Meta Business Suite</a>
            </div>
            <div className="row wp-cal">
              <label className="field"><span>Post on</span><input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} /></label>
              <label className="field"><span>Time</span><input type="time" value={calTime} onChange={(e) => setCalTime(e.target.value)} /></label>
              <button className="btn" disabled={!!busy} onClick={() => run('cal', async () => {
                await onSave({ pageCaption: pageText, groupCaption: groupText });
                const res = await fetch(`/api/welcome/${c.contactId}/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: calDate, time: calTime, name: facts.full }) });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) return body.error || 'Couldn’t add it';
                onRecord(body.record);
                setMsg('Added to the content calendar.');
              })}>{rec?.calendarPostId ? 'Move on the calendar' : 'Add to content calendar'}</button>
              <label className="field"><span>Status</span>
                <select value={status} onChange={(e) => onSave({ status: e.target.value })}>
                  {(Object.keys(STATUS_LABEL) as WelcomeStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
            </div>
            <p className="muted small" style={{ margin: 0 }}>{rec?.scheduledFor ? `On the content calendar for ${day(`${rec.scheduledFor}T12:00:00`)}. ` : ''}The hub doesn’t post anything: schedule it in Meta Business Suite, then mark it Scheduled or Posted here (the calendar follows).</p>
          </fieldset>
          {msg && <p className={`note${msg.startsWith('Added') ? ' ok' : ''}`} role="status" style={{ margin: 0 }}>{msg}</p>}
        </div>
      )}
    </li>
  );
}

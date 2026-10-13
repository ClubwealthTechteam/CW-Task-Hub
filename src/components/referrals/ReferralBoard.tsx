'use client';

// Referral Prospecting (Jay Mar's task #8). Jay pastes Facebook Group posts (or screenshots); the assistant
// picks out referral requests, matches each to a Club Wealth member from the Keap directory and drafts the
// SMS to that member. Opportunities are grouped by location. Nothing is sent from the hub.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Batch, MemberNote, Opportunity, OppStatus, ReferralSettings } from '@/lib/referrals/store';
import type { Member } from '@/lib/referrals/members';
import { PendingFiles, useAttachments } from '@/components/chat/Attachments';
import { ReferralSettingsDialog } from './ReferralSettingsDialog';

const STATUS_LABEL: Record<OppStatus, string> = { new: 'New', texted: 'Member texted', won: 'Connected', closed: 'Closed' };
type Tab = 'opps' | 'members';
type Filter = OppStatus | 'all';

const where = (o: { city?: string; state?: string }) => [o.city, o.state].filter(Boolean).join(', ') || 'Location unknown';
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function ReferralBoard({ readOnly }: { readOnly?: boolean }) {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [notes, setNotes] = useState<Record<string, MemberNote>>({});
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [keap, setKeap] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('opps');
  const [filter, setFilter] = useState<Filter>('new');
  const [loc, setLoc] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async (sync = false) => {
    const res = await fetch(`/api/referrals${sync ? '?sync=1' : ''}`, { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (res.ok) {
      setOpps(b.opps); setBatches(b.batches); setMembers(b.members); setNotes(b.notes); setSettings(b.settings);
      setTotal(b.total); setPending(b.pending); setKeap(b.keap); setError(b.error ?? '');
    } else setError(b.error || 'Couldn’t load referrals');
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Keep loading the member directory until it's complete, and check on posts being read.
  const reading = batches.some((b) => b.status === 'reading');
  useEffect(() => {
    if (!pending && !reading) return;
    const t = setTimeout(() => load(), pending ? 1500 : 15_000);
    return () => clearTimeout(t);
  }, [pending, reading, load, opps, members]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const counts = useMemo(() => {
    const n: Record<Filter, number> = { new: 0, texted: 0, won: 0, closed: 0, all: opps.length };
    opps.forEach((o) => n[o.status]++);
    return n;
  }, [opps]);
  const locations = useMemo(() => [...new Set(opps.map(where))].sort(), [opps]);
  const shown = opps.filter((o) => (filter === 'all' || o.status === filter) && (loc === 'all' || where(o) === loc));
  const groups = shown.reduce<Record<string, Opportunity[]>>((acc, o) => { (acc[where(o)] ??= []).push(o); return acc; }, {});
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  async function patch(id: string, p: Partial<Opportunity>) {
    setOpps((list) => list.map((o) => (o.id === id ? { ...o, ...p } : o)));
    await fetch(`/api/referrals/opps/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
  }
  async function remove(id: string) {
    setOpps((list) => list.filter((o) => o.id !== id));
    await fetch(`/api/referrals/opps/${id}`, { method: 'DELETE' });
  }
  async function saveNote(id: number, n: MemberNote) {
    setNotes((x) => ({ ...x, [id]: { ...x[id], ...n } }));
    await fetch(`/api/referrals/members/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) });
  }

  const needsSetup = settings && !settings.tagIds.length;

  return (
    <main className="ws-main rf" aria-label="Referral prospecting">
      <div className="ws-mh">
        <span className="ws-bot wp-bot" aria-hidden="true">🤝</span>
        <b>Referral prospecting</b>
        <div className="cc-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'opps'} className={tab === 'opps' ? 'on' : ''} onClick={() => setTab('opps')}>Opportunities</button>
          <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>Members</button>
        </div>
        <span style={{ flex: 1 }} />
        <span className="muted small">{total ? `${members.length}${pending ? ` of ${total}` : ''} members from Keap${pending ? '…' : ''}` : ''}</span>
        {!readOnly && <button className="linkbtn" onClick={() => setShowSettings(true)}>Settings</button>}
      </div>

      <div className="wp-body">
        {!keap ? <p className="note">Keap isn’t connected, so the member directory can’t load yet.</p>
          : needsSetup ? (
            <div className="wp-empty">
              <h3>Choose who counts as a Club Wealth member</h3>
              <p className="muted">Pick the Keap tag that marks active Club Wealth members (clients). Their business, city and phone become the directory referrals are matched to. The hub only reads Keap.</p>
              {!readOnly && <button className="btn primary" onClick={() => setShowSettings(true)}>Choose the Keap tag</button>}
            </div>
          ) : tab === 'opps' ? (
            <>
              {!readOnly && !loading && <AddPosts startOpen={!opps.length} onStarted={(b) => setBatches((x) => [b, ...x])} />}
              {batches.filter((b) => b.status === 'reading' || (b.status === 'error' && Date.now() - b.at < 86_400_000)).map((b) => (
                <p key={b.id} className={`rf-batch${b.status === 'error' ? ' err' : ''}`}>
                  {b.status === 'reading' ? <><span className="cf-spin" aria-hidden="true" /> Reading {b.posts} post{b.posts === 1 ? '' : 's'}{b.group ? ` from ${b.group}` : ''}… usually 1–3 minutes.</> : <>Couldn’t read “{b.preview.slice(0, 50)}…”: {b.error}</>}
                </p>
              ))}
              {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}

              {opps.length > 0 && (
                <div className="rf-bar">
                  <div className="row" role="group" aria-label="Status">
                    {(['new', 'texted', 'won', 'closed', 'all'] as Filter[]).map((f) => (
                      <button key={f} className={`chip-btn${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : STATUS_LABEL[f]} <span className="wp-n">{counts[f]}</span>
                      </button>
                    ))}
                  </div>
                  <select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location">
                    <option value="all">All locations</option>
                    {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}

              {loading ? <p className="muted small">Loading…</p> : !opps.length ? (
                <p className="muted small">No opportunities yet. Paste posts from your Facebook Groups above and the assistant will find the referral requests.</p>
              ) : !shown.length ? <p className="muted small">Nothing here.</p> : sortedGroups.map(([place, list]) => (
                <section key={place} className="wp-group">
                  <h4>📍 {place} <span className="wp-n">{list.length}</span></h4>
                  <ul className="wp-list">
                    {list.map((o) => <OppCard key={o.id} o={o} members={members} byId={byId} readOnly={readOnly} onPatch={(p) => patch(o.id, p)} onRemove={() => remove(o.id)} />)}
                  </ul>
                </section>
              ))}
            </>
          ) : (
            <MembersTab members={members} notes={notes} opps={opps} pending={pending} total={total} readOnly={readOnly} onNote={saveNote} onSync={() => { setLoading(true); load(true); }} />
          )}
      </div>

      {showSettings && settings && (
        <ReferralSettingsDialog settings={settings} onClose={() => setShowSettings(false)} onSaved={(s) => { setSettings(s); setShowSettings(false); load(true); }} />
      )}
    </main>
  );
}

function AddPosts({ startOpen, onStarted }: { startOpen: boolean; onStarted: (b: Batch) => void }) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const files = useAttachments();

  async function find() {
    setBusy(true); setError('');
    const res = await fetch('/api/referrals/find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, group, link, fileIds: files.ready }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(b.error || 'Couldn’t start'); return; }
    onStarted(b.batch); setText(''); setLink(''); files.clear();
  }

  return (
    <section className="rf-add">
      <button className="rf-add-h" onClick={() => setOpen(!open)} aria-expanded={open}><b>＋ Add Facebook Group posts</b><span className="muted small">Paste posts or attach screenshots; the assistant finds the referral requests</span></button>
      {open && (
        <div className="rf-add-b"
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); files.add(e.dataTransfer.files); }}>
          <div className="cc-grid3">
            <label className="field"><span className="cc-lab">Facebook Group</span><input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Phoenix Small Business Owners" /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span className="cc-lab">Post link (optional, for a single post)</span><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.facebook.com/groups/…" /></label>
          </div>
          <label className="field"><span className="cc-lab">Posts</span>
            <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste one or more posts. Put a blank line or --- between posts.\n\nExample: "Can anyone recommend a good realtor in Mesa? We’re looking to sell in the spring."'}
              onPaste={(e) => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); files.add(f); } }} />
          </label>
          <PendingFiles items={files.items} onRemove={files.remove} />
          {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
          <div className="row">
            <button className="btn primary" disabled={busy || files.uploading || (!text.trim() && !files.ready.length)} onClick={find}>{busy ? 'Sending…' : 'Find referrals'}</button>
            <label className="btn wp-upload">Attach screenshots<input type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => { if (e.target.files) files.add(e.target.files); e.target.value = ''; }} /></label>
            <span className="muted small">Or drop / paste screenshots here.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function OppCard({ o, members, byId, readOnly, onPatch, onRemove }: {
  o: Opportunity; members: Member[]; byId: Map<number, Member>; readOnly?: boolean;
  onPatch: (p: Partial<Opportunity>) => void; onRemove: () => void;
}) {
  const [sms, setSms] = useState(o.sms ?? '');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setSms(o.sms ?? ''), [o.sms]);
  const m = o.memberId ? byId.get(o.memberId) : undefined;
  // Members in the same city first, then the same state, then everyone else.
  const ranked = useMemo(() => {
    const score = (x: Member) => (o.city && x.city?.toLowerCase() === o.city.toLowerCase() ? 0 : o.state && x.state?.toUpperCase() === o.state ? 1 : 2);
    return [...members].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  }, [members, o.city, o.state]);
  const suggested = [o.memberId, ...(o.otherMemberIds ?? [])].filter(Boolean) as number[];

  function pickMember(id: number) {
    const next = byId.get(id);
    // Keep the drafted SMS, but greet the newly chosen member.
    const text = m && next && sms.includes(m.first) ? sms.replace(m.first, next.first) : sms;
    setSms(text);
    onPatch({ memberId: id || undefined, sms: text });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(sms); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select by hand */ }
  }
  const smsHref = m?.phone ? `sms:${m.phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(sms)}` : undefined;

  return (
    <li className={`rf-card st-${o.status}`}>
      <div className="rf-top">
        <div className="rf-need">
          <b>{o.need}</b>
          <span className="muted small">{[o.service && `Needs: ${o.service}`, o.poster && `Posted by ${o.poster}`, o.group, ago(o.at)].filter(Boolean).join(' · ')}</span>
        </div>
        <select className={`rf-st st-${o.status}`} value={o.status} disabled={readOnly} onChange={(e) => onPatch({ status: e.target.value as OppStatus })} aria-label="Status">
          {(Object.keys(STATUS_LABEL) as OppStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {o.excerpt && <blockquote className="rf-quote">{o.excerpt}</blockquote>}
      {o.postLink && <a className="small" href={o.postLink} target="_blank" rel="noreferrer">Open the post on Facebook ↗</a>}

      <div className="rf-match">
        <label className="field">
          <span className="cc-lab">Club Wealth member</span>
          <select value={o.memberId ?? ''} disabled={readOnly} onChange={(e) => pickMember(Number(e.target.value))}>
            <option value="">Nobody yet</option>
            {suggested.length > 0 && (
              <optgroup label="Suggested">
                {suggested.map((id) => byId.get(id)).filter(Boolean).map((x) => <option key={`s${x!.id}`} value={x!.id}>{x!.name}{x!.business ? ` · ${x!.business}` : ''} ({where(x!)})</option>)}
              </optgroup>
            )}
            <optgroup label="All members (nearest first)">
              {ranked.map((x) => <option key={x.id} value={x.id}>{x.name}{x.business ? ` · ${x.business}` : ''} ({where(x)})</option>)}
            </optgroup>
          </select>
        </label>
        {m && <span className="muted small">{[m.phone ?? 'no phone in Keap', m.industry].filter(Boolean).join(' · ')}{o.why ? ` · ${o.why}` : ''}</span>}
      </div>

      <label className="field">
        <span className="cc-lab">SMS to {m?.first || 'the member'}</span>
        <textarea rows={3} value={sms} disabled={readOnly} onChange={(e) => setSms(e.target.value)} onBlur={() => { if (sms !== (o.sms ?? '')) onPatch({ sms }); }} placeholder="Pick a member and write the text…" />
        <span className={`small ${sms.length > 320 ? 'wp-warn' : 'muted'}`}>{sms.length} characters{sms.length > 160 ? ` · ${Math.ceil(sms.length / 153)} SMS parts` : ''}</span>
      </label>
      <div className="row">
        <button className="btn" onClick={copy} disabled={!sms}>{copied ? 'Copied ✓' : 'Copy SMS'}</button>
        {smsHref && <a className="btn" href={smsHref}>Text {m!.first} from this device</a>}
        {!readOnly && o.status === 'new' && <button className="btn primary" disabled={!o.memberId} onClick={() => onPatch({ status: 'texted' })}>Mark as texted</button>}
        <span style={{ flex: 1 }} />
        {!readOnly && (confirm
          ? <><button className="linkbtn danger" onClick={onRemove}>Remove</button><button className="linkbtn" onClick={() => setConfirm(false)}>Keep</button></>
          : <button className="linkbtn" onClick={() => setConfirm(true)}>Not a referral</button>)}
      </div>
    </li>
  );
}

function MembersTab({ members, notes, opps, pending, total, readOnly, onNote, onSync }: {
  members: Member[]; notes: Record<string, MemberNote>; opps: Opportunity[]; pending: number; total: number; readOnly?: boolean;
  onNote: (id: number, n: MemberNote) => void; onSync: () => void;
}) {
  const [q, setQ] = useState('');
  const sent = useMemo(() => opps.reduce<Record<number, number>>((acc, o) => { if (o.memberId && o.status !== 'new') acc[o.memberId] = (acc[o.memberId] ?? 0) + 1; return acc; }, {}), [opps]);
  const list = members.filter((m) => !q || `${m.name} ${m.business} ${m.city} ${m.state} ${m.industry} ${notes[m.id]?.services}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="rf-bar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, city, industry…" style={{ maxWidth: 320 }} />
        <span className="muted small">{pending ? `Loading members from Keap: ${members.length} of ${total}…` : `${members.length} members`}</span>
        <button className="linkbtn" onClick={onSync}>Sync from Keap</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Add what each member offers under <b>Services</b> (e.g. “realtor, investment properties”) so matches are better. <b>Paused</b> members aren’t suggested. These notes stay in the hub; Keap isn’t changed.</p>
      <div className="table-wrap">
        <table className="rf-table">
          <thead><tr><th>Member</th><th>City</th><th>Phone</th><th>Industry</th><th>Services</th><th title="Referrals sent">Sent</th><th>Paused</th></tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className={notes[m.id]?.paused ? 'paused' : ''}>
                <td><b>{m.name}</b>{m.business && <small>{m.business}</small>}</td>
                <td>{where(m)}</td>
                <td>{m.phone ?? '—'}</td>
                <td>{m.industry ?? '—'}</td>
                <td><input defaultValue={notes[m.id]?.services ?? ''} disabled={readOnly} placeholder="What they offer" onBlur={(e) => { if (e.target.value !== (notes[m.id]?.services ?? '')) onNote(m.id, { services: e.target.value }); }} /></td>
                <td>{sent[m.id] ?? 0}</td>
                <td><input type="checkbox" checked={Boolean(notes[m.id]?.paused)} disabled={readOnly} onChange={(e) => onNote(m.id, { paused: e.target.checked })} aria-label={`Pause referrals for ${m.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

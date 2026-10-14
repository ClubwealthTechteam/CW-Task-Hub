'use client';

// Updates and announcements: the list everyone reads, the composer super admins post from, and the banner
// at the top of each workspace that shows the newest update until it's read.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Markdown } from '@/components/chat/Markdown';
import { Icon } from '@/components/Icon';

export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  audience: string;
  audienceName: string;
  pinned: boolean;
  byName: string;
  at: number;
  edited?: number;
}

const SEEN = 'cw-updates-seen';
const readSeen = () => { try { return Number(localStorage.getItem(SEEN) ?? 0); } catch { return 0; } };
const markSeen = (at: number) => { try { if (at > readSeen()) localStorage.setItem(SEEN, String(at)); } catch { /* ignore */ } };

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function Item({ a, admin, onChanged }: { a: AnnouncementView; admin?: boolean; onChanged?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/announcements/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { setEditing(false); onChanged?.(); }
  }
  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/announcements/${a.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) onChanged?.();
  }

  if (editing) return <Composer initial={a} onDone={() => { setEditing(false); onChanged?.(); }} onCancel={() => setEditing(false)} />;

  return (
    <article className={`ann${a.pinned ? ' pinned' : ''}`}>
      <div className="ann-h">
        <h3>{a.title}</h3>
        {a.pinned && <span className="pill gold">Pinned</span>}
        {a.audience !== 'all' && <span className="pill">{a.audienceName}</span>}
      </div>
      {a.body && <div className="ann-body"><Markdown text={a.body} /></div>}
      <div className="ann-f">
        <span className="muted small">{a.byName} · {when(a.at)}{a.edited ? ' · edited' : ''}</span>
        {admin && (
          <span className="row">
            <button className="linkbtn" disabled={busy} onClick={() => patch({ pinned: !a.pinned })}>{a.pinned ? 'Unpin' : 'Pin'}</button>
            <button className="linkbtn" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
            {confirm
              ? <><button className="linkbtn danger" disabled={busy} onClick={remove}>Yes, delete</button><button className="linkbtn" onClick={() => setConfirm(false)}>Keep</button></>
              : <button className="linkbtn" disabled={busy} onClick={() => setConfirm(true)}>Delete</button>}
          </span>
        )}
      </div>
    </article>
  );
}

function Composer({ initial, departments = [], onDone, onCancel }: {
  initial?: AnnouncementView; departments?: { id: string; name: string }[]; onDone: () => void; onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState(initial?.audience ?? 'all');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true); setError('');
    const res = await fetch(initial ? `/api/announcements/${initial.id}` : '/api/announcements', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initial ? { title, body } : { title, body, audience, pinned }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Couldn’t save'); return; }
    if (!initial) { setTitle(''); setBody(''); setPinned(false); setAudience('all'); }
    onDone();
  }

  return (
    <form className="ann-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`ann-t-${initial?.id ?? 'new'}`}>Title</label>
        <input id={`ann-t-${initial?.id ?? 'new'}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New: open drafts in Outlook" required />
      </div>
      <div className="field">
        <label htmlFor={`ann-b-${initial?.id ?? 'new'}`}>Message</label>
        <textarea id={`ann-b-${initial?.id ?? 'new'}`} value={body} maxLength={4000} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="What changed and what people should do. **bold**, lists and links work." />
      </div>
      {!initial && (
        <div className="row">
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="ann-aud">Who it’s for</label>
            <select id="ann-aud" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">Everyone</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} only</option>)}
            </select>
          </div>
          <label className="ann-check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top</label>
        </div>
      )}
      {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !title.trim()}>{initial ? 'Save' : 'Post update'}</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/** The list (and, for super admins, the composer) on the home page and /updates. */
export function Announcements({ items, admin, departments, limit, preview }: {
  items: AnnouncementView[]; admin?: boolean; departments?: { id: string; name: string }[]; limit?: number; preview?: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const shown = limit ? items.slice(0, limit) : items;
  const refresh = () => router.refresh();

  // Reading the list counts as seeing the newest update, so the workspace banner goes away.
  useEffect(() => { if (!preview && items.length) markSeen(Math.max(...items.map((a) => a.at))); }, [items, preview]);

  return (
    <div className="ann-list">
      {admin && !preview && (composing
        ? <Composer departments={departments} onDone={() => { setComposing(false); refresh(); }} onCancel={() => setComposing(false)} />
        : <div><button className="textlink" onClick={() => setComposing(true)}><Icon name="plus" size={14} /> New update</button></div>)}
      {shown.length === 0 && <p className="muted small" style={{ margin: 0 }}>No updates yet.{admin ? ' Post one to let the team know what’s new.' : ''}</p>}
      {shown.map((a) => <Item key={a.id} a={a} admin={admin && !preview} onChanged={refresh} />)}
      {limit && items.length > limit && <Link href="/updates" className="small">See all {items.length} updates</Link>}
    </div>
  );
}

/** Top of the workspace: the newest update this person hasn't read yet. */
export function UpdatesBanner({ items }: { items: AnnouncementView[] }) {
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => { setSeen(readSeen()); }, []);
  const unread = seen == null ? [] : items.filter((a) => a.at > seen).sort((a, b) => b.at - a.at);
  const latest = unread[0];
  if (!latest) return <div className="ws-updates-slot" />;
  const firstLine = latest.body.split('\n').find((l) => l.trim())?.replace(/[*_`#>]/g, '').replace(/^\s*[-\d.]+\s+/, '').trim() ?? '';
  const read = () => { markSeen(latest.at); setSeen(readSeen()); };
  return (
    <div className="ws-updates-slot">
      <div className="ws-updates" role="status">
        <span className="ws-updates-tag"><Icon name="megaphone" size={14} /> Update</span>
        <b>{latest.title}</b>
        {firstLine && <span className="ws-updates-line">{firstLine}</span>}
        <span style={{ flex: 1 }} />
        <Link href="/updates" className="linkbtn" onClick={() => markSeen(Math.max(...unread.map((a) => a.at)))}>{unread.length > 1 ? `Read all ${unread.length}` : 'Read'}</Link>
        <button className="ws-updates-x" aria-label="Dismiss this update" onClick={read}>×</button>
      </div>
    </div>
  );
}

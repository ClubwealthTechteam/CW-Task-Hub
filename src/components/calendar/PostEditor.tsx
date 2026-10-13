'use client';

// Add or edit one calendar post. "Draft caption" hands the post to the task's assistant on the right.

import { useEffect, useRef, useState } from 'react';
import { PLATFORMS, POST_TYPES, REPEATS, STATUSES, type CalendarPost, type PostStatus } from '@/lib/calendar-types';
import { toDate } from '@/lib/calendar-dates';
import { PLATFORM_META, STATUS_META, TYPE_META, TypeIcon } from './meta';

export type Draft = Partial<CalendarPost> & { date: string; occurrence?: { date: string; status: PostStatus } };

const ASK_EVENT = 'cw-ask-assistant';
const REPEAT_LABEL = { none: 'Doesn’t repeat', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' } as const;
const nice = (d: string) => toDate(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });

export function PostEditor({ dept, taskId, team, draft, readOnly, onClose, onSaved }: {
  dept: string; taskId: string; team: { id: string; name: string }[]; draft: Draft; readOnly?: boolean;
  onClose: () => void; onSaved: (post: CalendarPost | null, removedId?: string) => void;
}) {
  const [f, setF] = useState({
    title: draft.title ?? '',
    date: draft.date,
    time: draft.time ?? '',
    type: draft.type ?? 'other',
    platforms: draft.platforms ?? [],
    status: draft.status ?? 'idea',
    assignee: draft.assignee ?? '',
    notes: draft.notes ?? '',
    link: draft.link ?? '',
    repeat: draft.repeat ?? 'none',
    until: draft.until ?? '',
  });
  const [occStatus, setOccStatus] = useState<PostStatus | undefined>(draft.occurrence?.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const isNew = !draft.id;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || readOnly) return;
    setBusy(true); setError('');
    const occurrences = draft.occurrence && occStatus && occStatus !== draft.occurrence.status
      ? { ...draft.occurrences, [draft.occurrence.date]: occStatus } : draft.occurrences;
    const res = await fetch(isNew ? `/api/calendar/${dept}` : `/api/calendar/${dept}/${draft.id}`, {
      method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, occurrences }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || 'Couldn’t save'); return; }
    onSaved(body.post);
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/calendar/${dept}/${draft.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) onSaved(null, draft.id);
  }

  function askAssistant() {
    const platforms = f.platforms.map((p) => PLATFORM_META[p].label).join(' and ') || 'our Facebook Page and Group';
    const text = `Write a caption for this ${TYPE_META[f.type].label.toLowerCase()} post, planned for ${nice(f.date)}${f.time ? ` at ${f.time}` : ''} on ${platforms}.\nTitle: ${f.title || '(no title yet)'}${f.notes ? `\nNotes: ${f.notes}` : ''}${f.platforms.length > 1 ? '\nGive one version per platform.' : ''}`;
    window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { taskId, text } }));
  }

  return (
    <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-ed-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="cc-editor" onSubmit={save}>
        <div className="spread">
          <h3 id="cc-ed-title">{readOnly ? 'Post' : isNew ? 'New post' : 'Edit post'}</h3>
          <button type="button" className="cc-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <fieldset disabled={readOnly} className="cc-fields">
          <div className="field">
            <label htmlFor="cc-title">Title</label>
            <input id="cc-title" ref={first} value={f.title} maxLength={140} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Testimonial: Maria’s first Half-Day" required />
          </div>

          <div className="field">
            <span className="cc-lab" id="cc-type-l">Type</span>
            <div className="cc-typepick" role="radiogroup" aria-labelledby="cc-type-l">
              {POST_TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={f.type === t} className={f.type === t ? 'on' : ''} style={{ ['--t' as string]: TYPE_META[t].color }} onClick={() => set('type', t)}>
                  <TypeIcon type={t} size={15} /> {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="cc-grid3">
            <div className="field"><label htmlFor="cc-date">{f.repeat === 'none' ? 'Date' : 'Starts'}</label><input id="cc-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required /></div>
            <div className="field"><label htmlFor="cc-time">Time (optional)</label><input id="cc-time" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></div>
            <div className="field">
              <label htmlFor="cc-repeat">Repeats</label>
              <select id="cc-repeat" value={f.repeat} onChange={(e) => set('repeat', e.target.value as typeof f.repeat)}>
                {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          {f.repeat !== 'none' && (
            <div className="cc-grid3">
              <div className="field"><label htmlFor="cc-until">Ends (optional)</label><input id="cc-until" type="date" value={f.until} min={f.date} onChange={(e) => set('until', e.target.value)} /></div>
            </div>
          )}

          <div className="field">
            <span className="cc-lab" id="cc-plat-l">Platforms</span>
            <div className="cc-platpick" role="group" aria-labelledby="cc-plat-l">
              {PLATFORMS.map((p) => {
                const on = f.platforms.includes(p);
                return (
                  <button key={p} type="button" aria-pressed={on} className={on ? 'on' : ''} style={{ ['--p' as string]: PLATFORM_META[p].color }}
                    onClick={() => set('platforms', on ? f.platforms.filter((x) => x !== p) : [...f.platforms, p])}>
                    <span className="cc-plat" style={{ background: PLATFORM_META[p].color }}>{PLATFORM_META[p].short}</span> {PLATFORM_META[p].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cc-grid3">
            <div className="field">
              <label htmlFor="cc-status">{draft.occurrence ? 'Status (every date)' : 'Status'}</label>
              <select id="cc-status" value={f.status} onChange={(e) => set('status', e.target.value as PostStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            {draft.occurrence && (
              <div className="field">
                <label htmlFor="cc-occ">Status on {toDate(draft.occurrence.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}</label>
                <select id="cc-occ" value={occStatus} onChange={(e) => setOccStatus(e.target.value as PostStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="cc-owner">Owner</label>
              <select id="cc-owner" value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
                <option value="">Unassigned</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="cc-link">Link (optional)</label>
            <input id="cc-link" type="url" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="Canva design, Google Doc, or the live post: https://…" />
          </div>
          <div className="field">
            <label htmlFor="cc-notes">Notes or caption</label>
            <textarea id="cc-notes" value={f.notes} maxLength={4000} rows={4} onChange={(e) => set('notes', e.target.value)} placeholder="Who it’s about, the photo to use, the caption once it’s written…" />
          </div>
        </fieldset>

        {draft.occurrence && !readOnly && <p className="muted small" style={{ margin: 0 }}>This post repeats. Changes to the title, platforms and other details apply to every date.</p>}
        {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="cc-actions">
          {!readOnly && <button type="submit" className="btn primary" disabled={busy || !f.title.trim()}>{isNew ? 'Add to calendar' : 'Save'}</button>}
          <button type="button" className="btn" onClick={askAssistant} title="Opens the assistant on the right with this post filled in">✦ Draft caption with assistant</button>
          <span style={{ flex: 1 }} />
          {!isNew && !readOnly && (confirm
            ? <><span className="small">Delete{draft.repeat !== 'none' ? ' every date' : ''}?</span><button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button><button type="button" className="btn" onClick={() => setConfirm(false)}>Keep</button></>
            : <button type="button" className="linkbtn" onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
      </form>
    </div>
  );
}

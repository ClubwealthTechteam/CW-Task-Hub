'use client';

// Home page: the person's own urgent / hot tasks and their to-do list. Saved per person in the hub.

import { useEffect, useMemo, useState } from 'react';
import type { HomeItem, ItemKind } from '@/lib/home/items';

const RANK: Record<ItemKind, number> = { urgent: 0, hot: 1, todo: 2 };
const todayPacific = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const dueLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function sortOpen(a: HomeItem, b: HomeItem) {
  return RANK[a.kind] - RANK[b.kind] || (a.due ?? '9999').localeCompare(b.due ?? '9999') || b.createdAt - a.createdAt;
}

export function MyLists({ initial, readOnly }: { initial: HomeItem[]; readOnly?: boolean }) {
  const [items, setItems] = useState<HomeItem[]>(initial);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  useEffect(() => { setItems(initial); }, [initial]);

  async function call(method: string, body: unknown) {
    setError('');
    const res = await fetch('/api/me/items', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'That didn’t save. Try again.'); return null; }
    return data;
  }

  async function add(kind: ItemKind, text: string, due: string) {
    const data = await call('POST', { kind, text, due: due || undefined });
    if (data?.item) setItems((xs) => [data.item, ...xs]);
    return Boolean(data?.item);
  }
  async function toggle(it: HomeItem) {
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : undefined } : x)));
    const data = await call('PATCH', { id: it.id, done: !it.done });
    if (!data) setItems((xs) => xs.map((x) => (x.id === it.id ? it : x)));
  }
  async function remove(ids: string[]) {
    const before = items;
    setItems((xs) => xs.filter((x) => !ids.includes(x.id)));
    if (!(await call('DELETE', { ids }))) setItems(before);
  }

  const urgent = useMemo(() => items.filter((i) => i.kind !== 'todo'), [items]);
  const todos = useMemo(() => items.filter((i) => i.kind === 'todo'), [items]);

  return (
    <>
      <List title="Urgent tasks" sub="What can’t wait. Urgent first, then hot." kinds={['urgent', 'hot']} items={urgent}
        onAdd={add} onToggle={toggle} onRemove={remove} showDone={showDone} setShowDone={setShowDone} readOnly={readOnly} id="urgent" />
      <List title="To-do list" sub="Everything else on your plate today." kinds={['todo']} items={todos}
        onAdd={add} onToggle={toggle} onRemove={remove} showDone={showDone} setShowDone={setShowDone} readOnly={readOnly} id="todo" />
      {error && <p className="hm-err" role="alert">{error}</p>}
    </>
  );
}

function List({ id, title, sub, kinds, items, onAdd, onToggle, onRemove, showDone, setShowDone, readOnly }: {
  id: string; title: string; sub: string; kinds: ItemKind[]; items: HomeItem[]; readOnly?: boolean;
  onAdd: (k: ItemKind, t: string, due: string) => Promise<boolean>; onToggle: (i: HomeItem) => void; onRemove: (ids: string[]) => void;
  showDone: boolean; setShowDone: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ItemKind>(kinds[0]);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const t0 = todayPacific();
  const open = items.filter((i) => !i.done).sort(sortOpen);
  const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const urgentCount = open.filter((i) => i.kind === 'urgent').length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await onAdd(kind, text, due)) { setText(''); setDue(''); }
    setBusy(false);
  }

  return (
    <section className="dcard hm-list" aria-labelledby={`hm-${id}`}>
      <div className="dcard-h">
        <div><h2 id={`hm-${id}`}>{title}</h2><p className="muted small">{sub}</p></div>
        <span className="hm-count">{open.length ? (kinds.length > 1 ? `${urgentCount} urgent · ${open.length - urgentCount} hot` : `${open.length} open`) : ''}</span>
      </div>
      {!readOnly && (
        <form className="hm-add" onSubmit={submit}>
          <label className="sr-only" htmlFor={`hm-${id}-text`}>New item</label>
          <input id={`hm-${id}-text`} value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
            placeholder={kinds.length > 1 ? 'Add an urgent task, then Enter' : 'Add a to-do, then Enter'} />
          {kinds.length > 1 && (
            <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)} aria-label="Priority">
              <option value="urgent">Urgent</option><option value="hot">Hot</option>
            </select>
          )}
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
          <button className="dbtn primary sm" type="submit" disabled={busy || !text.trim()}>Add</button>
        </form>
      )}
      <ul className="hm-items">
        {open.length === 0 && <li className="hm-empty">{kinds.length > 1 ? 'Nothing urgent. Nice.' : 'Your list is clear.'}</li>}
        {[...open, ...(showDone ? done : [])].map((i) => {
          const late = !i.done && i.due && i.due < t0;
          return (
            <li key={i.id} className={`hm-item k-${i.kind}${i.done ? ' done' : ''}`}>
              <input type="checkbox" checked={i.done} onChange={() => onToggle(i)} disabled={readOnly} aria-label={`Mark done: ${i.text}`} />
              {i.kind !== 'todo' && <span className={`hm-tag k-${i.kind}`}>{i.kind === 'urgent' ? 'Urgent' : 'Hot'}</span>}
              <span className="hm-text">{i.text}</span>
              {i.due && <span className={`hm-due${late ? ' late' : ''}`}>{late ? 'Overdue · ' : 'Due '}{dueLabel(i.due)}</span>}
              {!readOnly && <button type="button" className="hm-x" onClick={() => onRemove([i.id])} aria-label={`Remove: ${i.text}`} title="Remove">✕</button>}
            </li>
          );
        })}
      </ul>
      {done.length > 0 && (
        <div className="hm-foot">
          <span>{done.length} done</span>
          <span>
            <button type="button" className="hm-link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide done' : 'Show done'}</button>
            {!readOnly && <button type="button" className="hm-link" onClick={() => onRemove(done.map((d) => d.id))}>Clear done</button>}
          </span>
        </div>
      )}
    </section>
  );
}

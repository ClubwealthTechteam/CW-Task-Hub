'use client';

// Ctrl+K (⌘K on Mac) search: jump to any page, task, chat or update. The list loads when it first opens.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchItem } from '@/app/api/search/route';

const KIND_LABEL: Record<SearchItem['kind'], string> = { page: 'Pages', task: 'Tasks', chat: 'Chats', update: 'Updates' };
const ORDER: SearchItem['kind'][] = ['page', 'task', 'chat', 'update'];

function score(item: SearchItem, words: string[]) {
  if (!words.length) return item.kind === 'page' ? 1 : item.kind === 'task' ? 0.5 : 0;
  const title = item.title.toLowerCase(), all = `${title} ${item.sub.toLowerCase()}`;
  if (!words.every((w) => all.includes(w))) return -1;
  let s = 0;
  for (const w of words) s += title.startsWith(w) ? 3 : title.split(/\W+/).some((t) => t.startsWith(w)) ? 2 : title.includes(w) ? 1 : 0.3;
  return s;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const show = useCallback(() => { setOpen(true); setQ(''); setSel(0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); setQ(''); setSel(0); }
    };
    const onOpen = () => show();
    window.addEventListener('keydown', onKey);
    window.addEventListener('cw:search', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('cw:search', onOpen); };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
    if (items) return;
    fetch('/api/search', { cache: 'no-store' }).then(async (r) => {
      if (!r.ok) throw new Error();
      setItems((await r.json()).items);
    }).catch(() => setError('Search couldn’t load. Try again.'));
  }, [open, items]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = (items ?? []).map((it) => ({ it, s: score(it, words) })).filter((x) => x.s >= 0);
    const groups = ORDER.map((k) => ({ kind: k, rows: scored.filter((x) => x.it.kind === k).sort((a, b) => b.s - a.s).slice(0, words.length ? 8 : k === 'page' ? 6 : 4).map((x) => x.it) })).filter((g) => g.rows.length);
    return groups;
  }, [items, q]);
  const flat = useMemo(() => results.flatMap((g) => g.rows), [results]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  function go(it: SearchItem) {
    setOpen(false);
    if (it.chatId) window.dispatchEvent(new CustomEvent('cwa:open', { detail: { id: it.chatId } }));
    else if (it.href) router.push(it.href);
  }

  if (!open) return null;
  let n = -1;
  return (
    <div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search the hub">
        <div className="cmdk-in">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, tasks, chats, updates…" aria-label="Search"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={flat[sel] ? `cmdk-${sel}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); go(flat[sel]); }
            }} />
          <button type="button" className="cmdk-x" onClick={() => setOpen(false)} aria-label="Close search" title="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {error && <li className="cmdk-none">{error}</li>}
          {!error && !items && <li className="cmdk-none">Loading…</li>}
          {items && !flat.length && <li className="cmdk-none">Nothing matches “{q}”.</li>}
          {results.map((g) => (
            <li key={g.kind} role="presentation">
              <div className="cmdk-group">{KIND_LABEL[g.kind]}</div>
              <ul role="presentation">
                {g.rows.map((it) => {
                  n++;
                  const i = n;
                  return (
                    <li key={`${it.kind}-${it.href ?? it.chatId}-${it.title}`} id={`cmdk-${i}`} role="option" aria-selected={i === sel}
                      className="cmdk-row" onMouseMove={() => setSel(i)} onClick={() => go(it)}>
                      <span className={`cmdk-ico k-${it.kind}`} aria-hidden="true">{it.kind === 'page' ? '↗' : it.kind === 'task' ? '★' : it.kind === 'chat' ? '💬' : '📣'}</span>
                      <span className="cmdk-main"><b>{it.title}</b><small>{it.sub}</small></span>
                      {i === sel && <kbd>↵</kbd>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> anywhere</span></div>
      </div>
    </div>
  );
}

/** The search button in the top bar. */
export function SearchButton() {
  const [mac, setMac] = useState(false);
  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);
  return (
    <button type="button" className="hdr-search" onClick={() => window.dispatchEvent(new Event('cw:search'))} aria-label="Search the hub">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <span>Search</span><kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

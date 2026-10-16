'use client';

// The bell in the top bar: assistant replies, finished shift summaries and new updates.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/lib/notifications';

const POLL_MS = 60_000;
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const ICON: Record<Notification['kind'], string> = { reply: '💬', summary: '📝', update: '📣', graphic: '🖼', eod: '🗒' };

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const body = await res.json();
    setItems(body.items); setUnread(body.unread);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function readAll() {
    setUnread(0); setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await fetch('/api/notifications', { method: 'POST' }).catch(() => null);
  }

  function go(n: Notification) {
    setOpen(false);
    if (n.chatId) window.dispatchEvent(new CustomEvent('cwa:open', { detail: { id: n.chatId } }));
    else if (n.href) router.push(n.href);
  }

  return (
    <div className="bell" ref={box}>
      <button type="button" className="bell-btn" onClick={() => { setOpen((v) => !v); if (!open) load(); }} aria-expanded={open} aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        {unread > 0 && <span className="bell-n">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="menu" aria-label="Notifications">
          <div className="bell-h"><b>Notifications</b>{unread > 0 && <button type="button" className="hm-link" onClick={readAll}>Mark all as read</button>}</div>
          {items.length === 0 ? <p className="bell-none">Nothing yet. Replies, shift summaries and updates show up here.</p> : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" role="menuitem" className={`bell-row${n.read ? '' : ' unread'}`} onClick={() => go(n)}>
                    <span className="bell-ico" aria-hidden="true">{ICON[n.kind]}</span>
                    <span className="bell-main"><b>{n.title}</b>{n.body && <small>{n.body}</small>}<em>{ago(n.at)}</em></span>
                    {!n.read && <i className="bell-dot" aria-label="unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

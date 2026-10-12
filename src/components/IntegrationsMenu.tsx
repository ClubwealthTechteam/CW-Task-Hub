'use client';

// "Integrations ▾" in the top bar: every external app the hub connects to, with its status.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface MenuApp { id: string; name: string; note: string; href: string; connected: boolean }

export function IntegrationsMenu({ apps, manage, active }: { apps: MenuApp[]; manage: boolean; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className="im" ref={ref}>
      <button className="im-btn" aria-expanded={open} aria-haspopup="true" aria-current={active ? 'page' : undefined} onClick={() => setOpen((v) => !v)}>
        Integrations <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="im-menu" role="menu">
          <div className="im-h">External apps</div>
          {apps.map((a) => (
            <Link key={a.id} href={a.href} role="menuitem" className="im-item" onClick={() => setOpen(false)}>
              <span className={`im-dot${a.connected ? ' on' : ''}`} aria-hidden="true" />
              <span className="im-txt"><b>{a.name}</b><small>{a.note}</small></span>
              <span className={`im-state${a.connected ? ' on' : ''}`}>{a.connected ? 'Connected' : 'Not connected'}</span>
            </Link>
          ))}
          {manage && (
            <>
              <div className="im-sep" />
              <Link href="/integrations" role="menuitem" className="im-item im-manage" onClick={() => setOpen(false)}>
                <span className="im-txt"><b>Manage integrations</b><small>Connections, shortcuts and adding a new app</small></span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

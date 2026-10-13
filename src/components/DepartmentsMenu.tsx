'use client';

// "Departments ▾" in the top bar: each department workspace this person can open.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface MenuDept { id: string; name: string; blurb: string; adminsOnly?: boolean }

export function DepartmentsMenu({ depts, current }: { depts: MenuDept[]; current?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = depts.some((d) => d.id === current);

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
        Departments <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="im-menu" role="menu">
          <div className="im-h">Departments</div>
          {depts.map((d) => (
            <Link key={d.id} href={`/w/${d.id}`} role="menuitem" className="im-item" aria-current={d.id === current ? 'page' : undefined} onClick={() => setOpen(false)}>
              <span className="im-txt"><b>{d.name}{d.adminsOnly && <span className="dm-tag">Admins only</span>}</b><small>{d.blurb}</small></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

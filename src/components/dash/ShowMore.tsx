'use client';

// "View all / Hide" for a long block on the dashboard: a text link, closed to begin with.

import { useState, type ReactNode } from 'react';

export function ShowMore({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && children}
      <button type="button" className="textlink dmore" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : label} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    </>
  );
}

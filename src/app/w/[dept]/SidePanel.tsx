'use client';

// The task details panel on the right. A tab on its edge slides it closed to a thin strip and back open;
// the choice is remembered in this browser.

import { useEffect, useState, type ReactNode } from 'react';

const KEY = 'cw-panel-collapsed';

export function SidePanel({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === '1'); } catch { /* private window */ }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  }

  return (
    <aside className={`ws-panel-wrap${collapsed ? ' collapsed' : ''}`} aria-label="Task details">
      <button className="ws-panel-tab" onClick={toggle} aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show task details' : 'Hide task details'} title={collapsed ? 'Show task details' : 'Hide task details'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={collapsed ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
        </svg>
      </button>
      {collapsed
        ? <button className="ws-panel-rail" onClick={toggle} tabIndex={-1} aria-hidden="true"><span>Task details</span></button>
        : <div className="ws-panel">{children}</div>}
    </aside>
  );
}

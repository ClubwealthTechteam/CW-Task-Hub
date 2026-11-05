'use client';

// Hides the top bar to give the page the full screen (e.g. the Venues map), and brings it back from a
// small tab at the top. The choice is remembered per browser.

import { useEffect, useState } from 'react';

const KEY = 'cw-header-collapsed';

export function HeaderToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch { /* private window */ }
    setCollapsed(saved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('hdr-collapsed', collapsed);
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* fine */ }
  }, [collapsed]);

  return collapsed ? (
    <button className="hdr-show" onClick={() => setCollapsed(false)} aria-label="Show the menu bar" title="Show the menu bar">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Menu
    </button>
  ) : (
    <button className="hdr-hide" onClick={() => setCollapsed(true)} aria-label="Hide the menu bar" title="Hide the menu bar">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

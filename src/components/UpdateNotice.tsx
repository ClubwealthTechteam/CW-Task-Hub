'use client';

// "A new version of the hub is ready · Reload": shown when a new deploy goes live while someone has
// the hub open, so nobody has to wait for a new link. Checks every few minutes and whenever the tab
// comes back into view; dismissing it hides it until the next deploy.

import { useEffect, useState } from 'react';

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID;
const EVERY = 3 * 60 * 1000;
const DISMISSED = 'cw-update-dismissed';

export function UpdateNotice() {
  const [next, setNext] = useState<{ build: string; latest: string | null } | null>(null);

  useEffect(() => {
    if (!BUILD) return;
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const v = (await r.json()) as { build: string | null; latest: string | null };
        if (!v.build || v.build === BUILD) return;
        let dismissed: string | null = null;
        try { dismissed = localStorage.getItem(DISMISSED); } catch { /* private mode */ }
        if (dismissed !== v.build) setNext({ build: v.build, latest: v.latest });
      } catch { /* offline or signed out: try again later */ }
    };
    const t = setInterval(check, EVERY);
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    check();
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); };
  }, []);

  if (!next) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISSED, next.build); } catch { /* ignore */ }
    setNext(null);
  };
  return (
    <div className="upd-notice" role="status">
      <span className="upd-dot" aria-hidden="true" />
      <div className="upd-txt">
        <b>A new version of the hub is ready</b>
        {next.latest && <small>New: {next.latest}</small>}
      </div>
      <button type="button" className="upd-reload" onClick={() => window.location.reload()}>Reload</button>
      <button type="button" className="upd-x" onClick={dismiss} aria-label="Dismiss until the next update" title="Later">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

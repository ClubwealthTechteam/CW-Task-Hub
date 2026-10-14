'use client';

// Sends uncaught browser errors to the hub's error log (at most a few per page load).

import { useEffect } from 'react';

let sent = 0;
export function reportError(message: unknown) {
  if (sent >= 5) return;
  sent++;
  const text = message instanceof Error ? message.message : String(message ?? '');
  if (!text || /ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch/i.test(text)) return;
  fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, path: location.pathname }), keepalive: true }).catch(() => null);
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
    const onReject = (e: PromiseRejectionEvent) => reportError(e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onReject); };
  }, []);
  return null;
}

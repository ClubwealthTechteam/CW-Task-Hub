'use client';

// Sends uncaught browser errors to the hub's error log (at most a few per page load).

import { useEffect } from 'react';

let sent = 0;
// Browser extensions run their own scripts on our pages (e.g. "reading 'M_ID'"); their crashes aren't the hub's.
const EXTENSION = /(chrome|moz|safari(-web)?)-extension:\/\//i;
const fromElsewhere = (file?: string) => !!file && (EXTENSION.test(file) || !file.startsWith(location.origin));

export function reportError(message: unknown, file?: string) {
  if (sent >= 5) return;
  const stack = message instanceof Error ? message.stack ?? '' : '';
  // A stack with no frame from our own bundle came from a script someone's browser injected.
  const notOurs = /:\d+:\d+/.test(stack) && !stack.includes('/_next/');
  if (fromElsewhere(file) || EXTENSION.test(stack) || notOurs) return;
  sent++;
  const text = message instanceof Error ? message.message : String(message ?? '');
  if (!text || /ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch/i.test(text)) return;
  fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, path: location.pathname }), keepalive: true }).catch(() => null);
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, e.filename);
    const onReject = (e: PromiseRejectionEvent) => reportError(e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onReject); };
  }, []);
  return null;
}

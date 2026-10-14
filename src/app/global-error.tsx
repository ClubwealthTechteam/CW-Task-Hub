'use client';

// Last resort when even the layout fails: plain page, report the error.

import { useEffect } from 'react';
import { reportError } from '@/components/ErrorReporter';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(`[layout] ${error.message}${error.digest ? ` (digest ${error.digest})` : ''}`); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#f2f4f8', color: '#121a2b' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>The hub hit a problem</h1>
          <p>It’s been reported to the tech team.</p>
          <button type="button" onClick={reset} style={{ padding: '9px 18px', borderRadius: 999, border: 0, background: '#0b1f4b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}

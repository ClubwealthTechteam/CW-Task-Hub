'use client';

// Shown when a page crashes: a calm message, a retry, and a report to the hub's error log.

import { useEffect } from 'react';
import { reportError } from '@/components/ErrorReporter';

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(`${error.message}${error.digest ? ` (digest ${error.digest})` : ''}`); }, [error]);
  return (
    <main className="page" style={{ alignItems: 'center', paddingTop: 80 }}>
      <section className="dcard" style={{ maxWidth: 520, textAlign: 'center', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong on this page</h1>
        <p className="muted" style={{ margin: 0 }}>It’s been reported to the tech team. Try again, or go back home.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="dbtn primary" onClick={reset}>Try again</button>
          <a className="dbtn" href="/">Home</a>
        </div>
      </section>
    </main>
  );
}

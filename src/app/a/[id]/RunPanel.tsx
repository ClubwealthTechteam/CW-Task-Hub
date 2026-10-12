'use client';

import { useState } from 'react';
import type { RunResult } from '@/lib/automations/runner';

const ICON = { done: '✓', ready: '✓', waiting: '…', skipped: '–' } as const;

export function RunPanel({ id, live }: { id: string; live: boolean }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true); setError('');
    const res = await fetch(`/api/automations/${id}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setResult(body); else setError(body.error || 'Something went wrong');
    setBusy(false);
  }

  return (
    <section className="card" aria-labelledby="run-title">
      <h2 id="run-title">{live ? 'Status' : 'Run (preview)'}</h2>
      {!live && (
        <div className="field">
          <label htmlFor="notes">What do you need this time? <span className="muted">(optional)</span></label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. the event name, a contact, a link to the sheet" />
        </div>
      )}
      <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Working…' : live ? 'Check status' : 'Show the plan'}</button>
      {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
          <p className="small" style={{ margin: 0 }}>{result.message}</p>
          <ol className="steps">
            {result.steps.map((s, i) => (
              <li key={i}>
                <span className={`dot ${s.status}`} aria-hidden="true">{ICON[s.status]}</span>
                <span>{s.label}{s.detail && <span className="muted small"> — {s.detail}</span>}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

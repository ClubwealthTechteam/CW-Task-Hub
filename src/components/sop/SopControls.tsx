'use client';

// SOP Handbook controls: the Main Admin's "I'm out today" switch and the POC log form on each article.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OutToggle({ out }: { out: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true); setError('');
    const res = await fetch('/api/sop/out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ out: !out }) });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t save that. Try again.');
  }

  return (
    <div className="row">
      <button className={`btn ${out ? '' : 'primary'}`} onClick={toggle} disabled={busy}>
        {out ? 'I’m back' : 'I’m out today'}
      </button>
      <span className="muted small">{out ? 'Your tasks show your POC as covering today.' : 'Your POC covers your tasks for the day.'}</span>
      {error && <span className="sop-error small" role="alert">{error}</span>}
    </div>
  );
}

export function LogForm({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [what, setWhat] = useState('');
  const [unusual, setUnusual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/sop/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: articleId, what, unusual }) });
    setBusy(false);
    if (res.ok) { setWhat(''); setUnusual(''); router.refresh(); }
    else setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t save that. Try again.');
  }

  return (
    <form className="sop-logform" onSubmit={submit}>
      <label>
        <span>What was done</span>
        <textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={2} maxLength={500} required
          placeholder="e.g. Tagged 28 Plano attendees in Keap and archived the event" />
      </label>
      <label>
        <span>Anything unusual <em className="muted">(optional)</em></span>
        <textarea value={unusual} onChange={(e) => setUnusual(e.target.value)} rows={2} maxLength={500}
          placeholder="e.g. Step 6 showed an error, did steps 6–8 by hand" />
      </label>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !what.trim()}>{busy ? 'Saving…' : 'Add log row'}</button>
        {error && <span className="sop-error small" role="alert">{error}</span>}
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';

export function LoginForm({ people, next }: { people: { id: string; name: string }[]; next?: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: form.get('personId'), accessCode: form.get('accessCode') }),
    });
    if (res.ok) {
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } else {
      setError((await res.json().catch(() => ({}))).error || 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field">
        <label htmlFor="personId">Your name</label>
        <select id="personId" name="personId" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="accessCode">Access code</label>
        <input id="accessCode" name="accessCode" type="password" autoComplete="current-password" />
      </div>
      {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

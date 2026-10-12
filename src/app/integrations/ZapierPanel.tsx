'use client';

import { useState } from 'react';

export function ZapierPanel({ zaps }: { zaps: string[] }) {
  const [msg, setMsg] = useState('');
  if (!zaps.length) {
    return <p className="muted small" style={{ margin: 0 }}>No Zaps added yet. Add a JSON map of Zap names to Catch Hook URLs in the <code>ZAPIER_HOOKS</code> environment variable, or add a Zap below as a webhook integration.</p>;
  }
  async function fire(name: string) {
    setMsg(`Starting ${name}…`);
    const res = await fetch('/api/integrations/zapier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, payload: { test: true } }) });
    const b = await res.json().catch(() => ({}));
    setMsg(b.ok ? `Sent to ${name}.` : `Failed: ${b.error || b.status}`);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row">{zaps.map((z) => <button key={z} className="btn" onClick={() => fire(z)}>Test {z}</button>)}</div>
      {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

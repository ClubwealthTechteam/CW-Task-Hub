'use client';

import { useState } from 'react';
import type { PublicCustomIntegration } from '@/lib/integrations/types';

export function CustomIntegrations({ initial }: { initial: PublicCustomIntegration[] }) {
  const [items, setItems] = useState(initial);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    const res = await fetch('/api/integrations/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const b = await res.json().catch(() => ({}));
    if (res.ok) { setItems([...items, b]); form.reset(); setMsg(`Added ${b.name}.`); } else setMsg(b.error || 'Could not add it');
    setBusy(false);
  }
  async function test(id: string) {
    setMsg('Testing…');
    const res = await fetch('/api/integrations/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', id }) });
    const b = await res.json().catch(() => ({}));
    setMsg(b.ok ? `Test sent (HTTP ${b.status}).` : `Test failed: ${b.error || `HTTP ${b.status}`}`);
  }
  async function remove(id: string) {
    await fetch(`/api/integrations/custom?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>URL</th><th>Key</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.name}</b>{i.description && <div className="muted small">{i.description}</div>}</td>
                  <td>{i.type === 'webhook' ? 'Webhook' : 'REST API'}</td>
                  <td style={{ wordBreak: 'break-all' }}>{i.url}</td>
                  <td>{i.hasSecret ? 'Saved' : '—'}</td>
                  <td><div className="row"><button className="btn" onClick={() => test(i.id)}>Test</button><button className="btn" onClick={() => remove(i.id)}>Remove</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={add} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="field"><label htmlFor="ci-name">Name</label><input id="ci-name" name="name" required placeholder="e.g. ProspectBoss, a Zap" /></div>
        <div className="field"><label htmlFor="ci-type">Type</label>
          <select id="ci-type" name="type" defaultValue="webhook"><option value="webhook">Webhook (Zapier, Make, n8n…)</option><option value="rest_api">REST API</option></select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="ci-url">URL</label><input id="ci-url" name="url" type="url" required placeholder="https://hooks.zapier.com/hooks/catch/…" /></div>
        <div className="field"><label htmlFor="ci-header">Auth header (optional)</label><input id="ci-header" name="authHeader" placeholder="Authorization" /></div>
        <div className="field"><label htmlFor="ci-secret">Key / token (optional)</label><input id="ci-secret" name="secret" type="password" autoComplete="off" placeholder="Stored on the server only" /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="ci-desc">What it&apos;s for</label><input id="ci-desc" name="description" placeholder="Which automations use it" /></div>
        <div><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add integration'}</button></div>
      </form>
      {msg && <p className="small" style={{ margin: 0 }} aria-live="polite">{msg}</p>}
    </div>
  );
}

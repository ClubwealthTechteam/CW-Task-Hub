'use client';

import { useMemo, useState } from 'react';
import type { KeapCapability } from '@/lib/integrations/keap/capabilities';

export function KeapConsole({ capabilities, connected }: { capabilities: KeapCapability[]; connected: boolean }) {
  const [id, setId] = useState(capabilities[0]?.id ?? '');
  const [params, setParams] = useState('{\n  "limit": 5\n}');
  const [out, setOut] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const cap = capabilities.find((c) => c.id === id);
  const groups = useMemo(() => [...new Set(capabilities.map((c) => c.group))], [capabilities]);
  const placeholders = cap ? [...cap.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]) : [];

  async function run() {
    let parsed: unknown;
    try { parsed = params.trim() ? JSON.parse(params) : {}; } catch { setOut('Parameters must be valid JSON.'); return; }
    setBusy(true);
    const res = await fetch(`/api/integrations/keap/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params: parsed }) });
    setOut(JSON.stringify(await res.json().catch(() => ({ error: 'No response' })), null, 2));
    setBusy(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label htmlFor="cap">Action</label>
          <select id="cap" value={id} onChange={(e) => setId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {capabilities.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.label}{c.writes ? ' (changes Keap)' : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {cap && (
          <p className="small muted" style={{ margin: 0 }}>
            <code>{cap.method} {cap.path}</code>{cap.hint ? <> · {cap.hint}</> : null}
            {placeholders.length > 0 && <> · Needs: {placeholders.join(', ')}</>}
          </p>
        )}
        <div className="field">
          <label htmlFor="params">Parameters (JSON)</label>
          <textarea id="params" value={params} onChange={(e) => setParams(e.target.value)} spellCheck={false} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }} />
        </div>
        <button className="btn primary" onClick={run} disabled={busy || !connected}>
          {!connected ? 'Connect Keap first' : busy ? 'Running…' : cap?.writes ? 'Run (changes Keap data)' : 'Run'}
        </button>
      </div>
      <pre className="json" aria-live="polite">{out || 'The result shows here.'}</pre>
    </div>
  );
}

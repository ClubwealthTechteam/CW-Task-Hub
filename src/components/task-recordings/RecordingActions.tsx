'use client';

// Buttons on a Task Recording page: copy the Flow Canvas JSON, download it, have Claude write it again,
// and delete the recording (asks once more first; the hub can't show confirm() dialogs everywhere).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RecordingActions({ id, canRewrite, written }: { id: string; canRewrite: boolean; written: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'copy' | 'write' | 'delete'>('');
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [sure, setSure] = useState(false);

  async function copy() {
    setBusy('copy'); setMsg(null);
    try {
      const res = await fetch(`/api/task-recordings/${id}/flow`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Couldn’t build the JSON');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setMsg({ text: `Copied (${Math.round(text.length / 1024)} KB). In the CW AI Hub Flow Canvas, open Paste JSON and paste it.`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error && e.message ? e.message : 'Couldn’t copy. Use Download JSON instead.' });
    }
    setBusy('');
  }

  async function rewrite() {
    setBusy('write'); setMsg({ text: 'Claude is reading the steps and screenshots. This can take a few minutes…' });
    const res = await fetch(`/api/task-recordings/${id}/write`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setMsg({ text: data.error ?? 'Couldn’t write it. Try again.' }); return; }
    setMsg({ text: data.problem ? `${data.problem}; a basic write-up was made instead.` : 'Done: Claude rewrote the steps and the summary.', ok: !data.problem });
    router.refresh();
  }

  async function remove() {
    if (!sure) { setSure(true); return; }
    setBusy('delete');
    const res = await fetch(`/api/task-recordings/${id}`, { method: 'DELETE' });
    if (res.ok) { router.push('/task-recordings'); router.refresh(); return; }
    setBusy(''); setMsg({ text: 'Couldn’t delete it. Try again.' });
  }

  return (
    <div className="trec-actions">
      <div className="row">
        {written && <button type="button" className="btn primary" onClick={copy} disabled={!!busy}>{busy === 'copy' ? 'Copying…' : 'Copy Flow Canvas JSON'}</button>}
        {written && <a className="btn" href={`/api/task-recordings/${id}/flow?download=1`}>Download JSON</a>}
        {canRewrite && <button type="button" className="btn" onClick={rewrite} disabled={!!busy}>{busy === 'write' ? 'Claude is writing…' : written ? 'Write it again with Claude' : 'Write it up with Claude'}</button>}
        <button type="button" className="btn trec-del" onClick={remove} disabled={!!busy} onBlur={() => setSure(false)}>{sure ? 'Click again to delete' : 'Delete recording'}</button>
      </div>
      {msg && <p className={`small ${msg.ok ? 'trec-ok' : 'muted'}`} role="status">{msg.text}</p>}
    </div>
  );
}

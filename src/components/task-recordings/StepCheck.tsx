'use client';

// "Is this correct?" under a written step: Yes, or No with a box to describe what's wrong. Saved on the hub,
// shown to Miguel, and used by "Write it again with Claude" to fix the step.

import { useState } from 'react';
import type { StepCheck as Check } from '@/lib/task-recordings/store';

export function StepCheck({ id, index, initial, canAnswer }: { id: string; index: number; initial?: Check; canAnswer: boolean }) {
  const [check, setCheck] = useState<Check | undefined>(initial);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(ok: boolean | null, text = '') {
    setBusy(true); setErr('');
    const res = await fetch(`/api/task-recordings/${id}/steps/${index}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok, note: text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? 'Couldn’t save. Try again.'); return; }
    setCheck(data.check ?? undefined);
    setEditing(false);
  }

  if (check && !editing) {
    return (
      <div className={`trec-check ${check.ok ? 'is-ok' : 'is-wrong'}`}>
        <span>{check.ok ? '✓ Marked correct' : '✗ Marked not correct'}</span>
        {!check.ok && check.note && <p className="small">{check.note}</p>}
        {canAnswer && <button type="button" className="linkbtn small" onClick={() => { setNote(check.note ?? ''); setEditing(true); }}>Change</button>}
      </div>
    );
  }
  if (!canAnswer) return null;
  return (
    <div className="trec-check">
      {!editing && (
        <div className="row">
          <span className="small"><b>Is this correct?</b></span>
          <button type="button" className="btn" onClick={() => save(true)} disabled={busy}>Yes</button>
          <button type="button" className="btn" onClick={() => setEditing(true)} disabled={busy}>No</button>
        </div>
      )}
      {editing && (
        <>
          <label className="small" htmlFor={`fix-${index}`}><b>What’s wrong with this step?</b> Describe what you actually did.</label>
          <textarea id={`fix-${index}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. I copied A2:E28 from the Registrants tab, not the whole sheet." />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => save(false, note)} disabled={busy || !note.trim()}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn" onClick={() => { setEditing(false); setErr(''); }} disabled={busy}>Cancel</button>
            {check && <button type="button" className="linkbtn small" onClick={() => save(true)} disabled={busy}>It’s correct after all</button>}
          </div>
        </>
      )}
      {err && <p className="small sop-error" role="status">{err}</p>}
    </div>
  );
}

'use client';

// Canva connection in a task chat (Jay: Marketing Graphics; Andrea and Liz: their Events tasks).

import { useEffect, useState } from 'react';

export interface CanvaState { allowed: boolean; configured?: boolean; connected?: boolean; name?: string }

export function useCanva(enabled: boolean) {
  const [state, setState] = useState<CanvaState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    fetch('/api/canva/status', { cache: 'no-store' }).then((r) => r.json()).then(setState).catch(() => setState(null));
  }, [enabled]);
  return [state, setState] as const;
}

export function CanvaBar({ state, onChange, returnTo }: { state: CanvaState; onChange: (s: CanvaState) => void; returnTo: string }) {
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('canva');
    if (r) {
      setNote(r === 'connected' ? 'Canva is connected.' : r === 'cancelled' ? 'Connecting Canva was cancelled.' : 'Couldn’t connect Canva. Try again.');
      const u = new URL(window.location.href); u.searchParams.delete('canva'); window.history.replaceState(null, '', u);
    }
  }, []);
  if (!state.allowed) return null;
  return (
    <div className={`canva-bar${state.connected ? ' on' : ''}`}>
      <span className="canva-mark" aria-hidden="true">C</span>
      {!state.configured ? (
        <span className="small">Canva isn’t set up in the hub yet. Miguel needs to add the Canva app keys.</span>
      ) : state.connected ? (
        <>
          <span className="small"><b>Canva connected</b>{state.name ? ` as ${state.name}` : ''}. Ask for a graphic “in Canva”, or use <b>Send to Canva</b> on any graphic.</span>
          <span style={{ flex: 1 }} />
          {confirm
            ? <><button className="linkbtn" onClick={async () => { await fetch('/api/canva/disconnect', { method: 'POST' }); onChange({ ...state, connected: false, name: undefined }); setConfirm(false); }}>Yes, disconnect</button><button className="linkbtn" onClick={() => setConfirm(false)}>Keep</button></>
            : <button className="linkbtn" onClick={() => setConfirm(true)}>Disconnect</button>}
        </>
      ) : (
        <>
          <span className="small">Connect your Canva account so the assistant can put designs straight into your Canva.</span>
          <span style={{ flex: 1 }} />
          <a className="btn canva-connect" href={`/api/canva/connect?return=${encodeURIComponent(returnTo)}`}>Connect Canva</a>
        </>
      )}
      {note && <span className="small canva-note" role="status">{note}</span>}
    </div>
  );
}

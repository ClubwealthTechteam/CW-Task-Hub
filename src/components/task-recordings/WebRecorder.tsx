'use client';

// The Task Recorder: records by screen sharing from this page (like Loom's web recorder).
// Start asks the browser which screen, window or tab to share, counts down 5 seconds, then saves a
// screenshot each time the shared screen changes and settles (checked twice a second). A web page can't see
// clicks in other tabs or apps, so Claude works out each action from the screenshots and circles the mouse
// pointer in red. Stop shows the screenshots to review: type what happened under each one, click a big one to
// mark where you clicked (red circle), delete (with Undo / Ctrl+Z), then send them to the hub for Claude to write up.
// Everything stays in this tab until it's sent, so the tab must stay open while recording.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RingedShot } from './StepShotZoom';
import type { Point } from '@/lib/task-recordings/store';

const COUNTDOWN = 5;
const CHECK_MS = 500;
const SHOT_WIDTH = 1600;     // wide enough for Claude to read sheet links, tab names and cells
const SHOT_CHARS = 950_000;  // the hub's per-screenshot cap
const MAX_SHOTS = 150;
const MIN_GAP_MS = 1200;     // at most one screenshot per 1.2 s while the screen keeps changing
const DIFF_LIMIT = 0.012;    // share of the small preview's pixels that must change to count as a new step

interface Shot { id: string; at: number; dataUrl: string; note: string; click?: Point }
type Phase = 'idle' | 'countdown' | 'recording' | 'paused' | 'review' | 'sending';

const thumbW = 96, thumbH = 54;

export function WebRecorder() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(COUNTDOWN);
  const [shots, setShots] = useState<Shot[]>([]);
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ shot: Shot; index: number }[]>([]);

  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const last = useRef<{ thumb: Uint8ClampedArray | null; at: number; pending: Uint8ClampedArray | null }>({ thumb: null, at: 0, pending: null });
  phaseRef.current = phase;

  useEffect(() => () => stopStream(), []);
  // Ctrl+Z / Cmd+Z brings back the last deleted screenshot (typing boxes keep their own undo).
  useEffect(() => {
    if (phase !== 'review' || !deleted.length) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z' || el?.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'paused' && phase !== 'countdown') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  function stopStream() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  /** A tiny grayscale copy of the current frame, to compare frames cheaply. */
  function thumb(v: HTMLVideoElement): Uint8ClampedArray {
    const c = document.createElement('canvas');
    c.width = thumbW; c.height = thumbH;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, thumbW, thumbH);
    const d = ctx.getImageData(0, 0, thumbW, thumbH).data;
    const g = new Uint8ClampedArray(thumbW * thumbH);
    for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
    return g;
  }
  const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 24) n++;
    return n / a.length;
  };

  async function grab(v: HTMLVideoElement): Promise<string | null> {
    if (!v.videoWidth) return null;
    const w = Math.min(SHOT_WIDTH, v.videoWidth), h = Math.round(v.videoHeight * (w / v.videoWidth));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(v, 0, 0, w, h);
    // Try lower quality until it fits the hub's cap (busy screens make bigger files).
    for (const q of [0.8, 0.68, 0.55, 0.42]) {
      let url = c.toDataURL('image/webp', q);
      if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q);
      if (url.length <= SHOT_CHARS) return url;
    }
    return null;
  }

  async function save(v: HTMLVideoElement, t: Uint8ClampedArray) {
    const dataUrl = await grab(v);
    if (!dataUrl) return;
    last.current = { thumb: t, at: Date.now(), pending: null };
    setShots((s) => (s.length >= MAX_SHOTS ? s : [...s, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), dataUrl, note: '' }]));
  }

  /** Twice a second: if the screen changed and has now settled (two checks alike), save a screenshot. */
  async function tick() {
    const v = video.current;
    if (!v || phaseRef.current !== 'recording') return;
    const t = thumb(v);
    const { thumb: prev, pending, at } = last.current;
    if (!prev) { await save(v, t); return; }
    if (changed(t, prev) < DIFF_LIMIT) { last.current.pending = null; return; }
    if (pending && changed(t, pending) < DIFF_LIMIT / 2 && Date.now() - at > MIN_GAP_MS) { await save(v, t); return; }
    last.current.pending = t;
  }

  async function start() {
    setMsg(null);
    let s: MediaStream;
    try {
      // Chrome-only options: hide this tab from the picker, and offer "Share this tab instead" when switching tabs.
      s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, cursor: 'always' },
        audio: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include',
      } as DisplayMediaStreamOptions);
    } catch {
      setMsg({ text: 'Screen sharing was cancelled or blocked, so nothing is being recorded. Press Start and pick a screen, window or tab to share.', err: true });
      return;
    }
    stream.current = s;
    // Sharing one tab leaves the address bar out of the screenshots, so Claude can't read the page links.
    const surface = (s.getVideoTracks()[0]?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
    if (surface === 'browser') setMsg({ text: 'You’re sharing one tab, so the address bar isn’t in the screenshots and Claude can’t read the site links. To capture links and tab switches, stop and share your Entire screen or a window instead.' });
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = s;
    await v.play().catch(() => {});
    video.current = v;
    s.getVideoTracks()[0]?.addEventListener('ended', () => { if (['recording', 'paused', 'countdown'].includes(phaseRef.current)) stop(); });
    setShots([]);
    setDeleted([]);
    last.current = { thumb: null, at: 0, pending: null };
    setPhase('countdown');
    let left = COUNTDOWN;
    setCount(left);
    const cd = window.setInterval(() => {
      left -= 1;
      setCount(left);
      if (left > 0) return;
      window.clearInterval(cd);
      if (phaseRef.current !== 'countdown') return;
      setPhase('recording');
      phaseRef.current = 'recording';
      timer.current = window.setInterval(tick, CHECK_MS);
      tick();
    }, 1000);
  }

  const setShot = (id: string, patch: Partial<Shot>) => setShots((x) => x.map((y) => (y.id === id ? { ...y, ...patch } : y)));

  function remove(s: Shot) {
    const index = shots.findIndex((y) => y.id === s.id);
    if (index < 0) return;
    setShots((x) => x.filter((y) => y.id !== s.id));
    setDeleted((d) => [...d, { shot: s, index }]);
  }

  function undo() {
    const lastDel = deleted[deleted.length - 1];
    if (!lastDel) return;
    setDeleted((d) => d.slice(0, -1));
    setShots((x) => [...x.slice(0, lastDel.index), lastDel.shot, ...x.slice(lastDel.index)]);
  }

  /** In the big view, a click marks where the person clicked on that screen. */
  function mark(e: React.MouseEvent<HTMLImageElement>, id: string) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) setShot(id, { click: { x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4 } });
  }

  function stop() {
    stopStream();
    setPhase('review');
  }

  async function send() {
    if (!shots.length) { setMsg({ text: 'There are no screenshots to send.', err: true }); return; }
    setPhase('sending');
    try {
      const call = async (url: string, init: RequestInit = {}) => {
        const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `The hub answered ${res.status}`);
        return data;
      };
      setMsg({ text: 'Sending the recording…' });
      const steps = shots.map((s, i) => ({ kind: i === 0 ? 'start' : 'screen', at: s.at, url: '', title: '', note: s.note.trim(), click: s.click, hasShot: true }));
      const { id } = await call('/api/task-recordings', { method: 'POST', body: JSON.stringify({ title, about, source: 'screen', steps }) });
      for (const [i, s] of shots.entries()) {
        setMsg({ text: `Uploading screenshots… ${i + 1} of ${shots.length}` });
        await call(`/api/task-recordings/${id}/shots/${i + 1}`, { method: 'PUT', body: JSON.stringify({ dataUrl: s.dataUrl }) });
      }
      setMsg({ text: 'Sending it to Claude…' });
      // The recording is saved by now: if Claude can't be reached, its page says so and has a button to try again.
      await call(`/api/task-recordings/${id}/write`, { method: 'POST' }).catch(() => null);
      router.push(`/task-recordings/${id}`);
      router.refresh();
    } catch (e) {
      setPhase('review');
      setMsg({ text: `Couldn’t send it: ${e instanceof Error ? e.message : 'unknown error'}. Your screenshots are still here; try again.`, err: true });
    }
  }

  const live = phase === 'recording' || phase === 'paused';
  const zoomIndex = shots.findIndex((x) => x.id === zoom);
  const zoomed = zoomIndex >= 0 ? shots[zoomIndex] : null;
  return (
    <div className="wrec">
      {(phase === 'idle') && (
        <>
          <button type="button" className="btn primary wrec-start" onClick={start}>● Start recording</button>
          <p className="muted small">Your browser asks what to share. For a task across several tabs or apps, share your <b>Entire screen</b> (or a whole window); for one tab, pick that tab. Keep this Admin Hub tab open while you record.</p>
        </>
      )}
      {phase === 'countdown' && <div className="wrec-count" role="status"><b>{count}</b><span>Recording starts… switch to the task now</span></div>}
      {live && (
        <div className="wrec-live" role="status">
          <span className={`wrec-dot ${phase === 'paused' ? 'off' : ''}`} />
          <b>{phase === 'paused' ? 'Paused' : 'Recording'}</b> · {shots.length} screenshot{shots.length === 1 ? '' : 's'}
          <button type="button" className="btn" onClick={() => setPhase(phase === 'paused' ? 'recording' : 'paused')}>{phase === 'paused' ? 'Resume' : 'Pause'}</button>
          <button type="button" className="btn wrec-stop" onClick={stop}>■ Stop</button>
        </div>
      )}
      {live && <p className="muted small">A screenshot is saved each time the screen changes. Pause before typing a password or opening anything private while recording.</p>}
      {(phase === 'review' || phase === 'sending') && (
        <div className="wrec-review">
          <div className="field-grid">
            <label>Task name<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Half-Day attendance matching" disabled={phase === 'sending'} /></label>
            <label>What is this task? (optional)<input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} placeholder="One sentence for Claude" disabled={phase === 'sending'} /></label>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={send} disabled={phase === 'sending' || !shots.length}>{phase === 'sending' ? 'Sending…' : `Send ${shots.length} screenshot${shots.length === 1 ? '' : 's'} to Claude`}</button>
            <button type="button" className="btn" onClick={() => { setShots([]); setDeleted([]); setPhase('idle'); setMsg(null); }} disabled={phase === 'sending'}>Discard</button>
            {deleted.length > 0 && phase === 'review' && (
              <span className="wrec-undo">
                <span className="muted">Deleted {deleted.length}</span>
                <button type="button" className="btn" onClick={undo} title="Ctrl+Z">↶ Undo delete</button>
              </span>
            )}
          </div>
          <p className="muted small">Under each screenshot, type what you did on that screen (the button you clicked, what you copied or pasted, the sheet link, tab and cells). Click a screenshot to see it big, then click where you clicked to circle it in red. Delete any you don't want sent; Undo or Ctrl+Z brings it back.</p>
          <ol className="wrec-shots">
            {shots.map((s, i) => (
              <li key={s.id}>
                <button type="button" className="trec-shot" onClick={() => setZoom(s.id)} aria-label={`Open screenshot ${i + 1}`}><RingedShot src={s.dataUrl} alt={`Screenshot ${i + 1}`} ring={s.click} /></button>
                <div className="row"><span className="small">{i + 1}</span><button type="button" className="linkbtn small" onClick={() => remove(s)} disabled={phase === 'sending'}>Delete</button></div>
                <textarea value={s.note} onChange={(e) => setShot(s.id, { note: e.target.value })} maxLength={1000} rows={2} aria-label={`What you did on screen ${i + 1}`} placeholder="What did you do here? (button, cells, sheet link…)" disabled={phase === 'sending'} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {msg && <p className={`small ${msg.err ? 'sop-error' : 'muted'}`} role="status">{msg.text}</p>}
      {zoomed && (
        <div className="sop-lightbox" role="dialog" aria-modal="true" aria-label={`Screenshot ${zoomIndex + 1}`} onClick={() => setZoom(null)}>
          <button type="button" className="sop-lightbox-x" aria-label="Close" onClick={() => setZoom(null)}>×</button>
          <span className="wrec-mark" onClick={(e) => e.stopPropagation()}>
            <RingedShot src={zoomed.dataUrl} alt={`Screenshot ${zoomIndex + 1}`} ring={zoomed.click} onClick={phase === 'review' ? (e) => mark(e, zoomed.id) : undefined} />
          </span>
          {phase === 'review' && (
            <div className="wrec-lightbox-bar" onClick={(e) => e.stopPropagation()}>
              <span>Screenshot {zoomIndex + 1}: click where you clicked to circle it.</span>
              {zoomed.click && <button type="button" className="linkbtn" onClick={() => setShot(zoomed.id, { click: undefined })}>Remove circle</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

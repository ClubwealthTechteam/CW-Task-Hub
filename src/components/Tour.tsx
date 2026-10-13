'use client';

// First-sign-in tour of the workspace: highlights each area in turn with a short note.
// Shown once per browser; "Take the tour again" on the Help page brings it back.

import { useEffect, useLayoutEffect, useState } from 'react';

const DONE = 'cw-tour-done';

interface Step { sel: string; title: string; text: string }

const STEPS: Step[] = [
  { sel: '.ws-side', title: 'Your tasks', text: 'Everything on the left is yours: tasks from your Workflow Process Form and the ones Miguel set up. Click one to open it.' },
  { sel: '.ws-main', title: 'The task’s assistant', text: 'Tell it what you’re working on. It drafts emails and messages for you. Nothing is sent until you approve it.' },
  { sel: '.ws-panel-wrap', title: 'Task details and Keap', text: 'What the task does, the steps it follows, and a Keap search so the assistant knows which contact you mean. Use the “<” tab to hide or show it.' },
  { sel: '.cwa-bubble', title: 'CW Assistant', text: 'Questions that aren’t about one task go here. It can open several chats and you can make it bigger.' },
  { sel: 'a[href="/help"]', title: 'Help', text: 'Step-by-step guides and answers to common questions. You can take this tour again from there.' },
];

function seen() {
  try { return localStorage.getItem(DONE) === '1'; } catch { return true; }
}
function markSeen(v: boolean) {
  try { if (v) localStorage.setItem(DONE, '1'); else localStorage.removeItem(DONE); } catch { /* ignore */ }
}

export function Tour() {
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);
  const steps = typeof document === 'undefined' ? STEPS : STEPS.filter((s) => document.querySelector(s.sel));

  useEffect(() => { if (!seen()) setI(0); }, []);

  useLayoutEffect(() => {
    if (i < 0) return;
    const place = () => {
      const el = steps[i] && document.querySelector(steps[i].sel);
      setBox(el ? el.getBoundingClientRect() : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (i < 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i]);

  function finish() { markSeen(true); setI(-1); }

  if (i < 0 || !steps[i]) return null;
  const s = steps[i];
  const last = i === steps.length - 1;

  // Put the card beside the highlighted area, kept on screen.
  const W = 320;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  let left = vw / 2 - W / 2;
  let top = vh / 2 - 90;
  if (box) {
    if (box.right + W + 24 < vw) { left = box.right + 16; top = box.top + 24; }
    else if (box.left - W - 24 > 0) { left = box.left - W - 16; top = box.top + 24; }
    else { left = box.left + box.width / 2 - W / 2; top = box.top - 200; }
  }
  left = Math.max(16, Math.min(left, vw - W - 16));
  top = Math.max(16, Math.min(top, vh - 220));

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box && <div className="tour-hole" style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }} />}
      {!box && <div className="tour-dim" />}
      <div className="tour-card" style={{ top, left, width: W }}>
        <span className="tour-step">{i + 1} of {steps.length}</span>
        <h3 id="tour-title">{s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-acts">
          <button className="linkbtn" onClick={finish}>Skip tour</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn primary" autoFocus onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

/** On the Help page: clears the "seen" flag and opens the workspace, where the tour starts again. */
export function TourButton({ href }: { href: string }) {
  return (
    <button className="btn primary" onClick={() => { markSeen(false); window.location.href = href; }}>Take the tour again</button>
  );
}

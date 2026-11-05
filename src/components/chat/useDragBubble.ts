'use client';

// Lets people drag the CW Assistant bubble anywhere on the screen (mouse or touch), so it never sits on
// top of something they need (e.g. the Venues map's zoom buttons). A short press still opens the chat;
// only a move of more than a few pixels counts as a drag. The spot is remembered per browser.

import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'cw-assistant-bubble';
const SIZE = 60;
const MARGIN = 12;
const DRAG_PX = 5;

/** Distance of the bubble from the right and bottom edges of the window. */
export interface BubblePos { right: number; bottom: number }

const DEFAULT: BubblePos = { right: 20, bottom: 20 };

function clamp(p: BubblePos): BubblePos {
  if (typeof window === 'undefined') return p;
  const maxR = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxB = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return { right: Math.min(Math.max(p.right, MARGIN), maxR), bottom: Math.min(Math.max(p.bottom, MARGIN), maxB) };
}

function load(): BubblePos {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && Number.isFinite(p.right) && Number.isFinite(p.bottom)) return clamp(p);
  } catch { /* private window: use the default */ }
  return DEFAULT;
}

export function useDragBubble() {
  const [pos, setPos] = useState<BubblePos>(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; pos: BubblePos; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    setPos(load());
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, pos, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!s.moved) { s.moved = true; setDragging(true); }
    setPos(clamp({ right: s.pos.right - dx, bottom: s.pos.bottom - dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!s?.moved) return;
    setDragging(false);
    justDragged.current = true; // swallow the click that follows the drag
    setPos((p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* fine */ } return p; });
  }, []);

  /** Call at the start of the bubble's onClick: true means "that was a drag, don't open". */
  const wasDrag = useCallback(() => {
    if (!justDragged.current) return false;
    justDragged.current = false;
    return true;
  }, []);

  /** Where the chat window opens: on the same side and edge as the bubble, so it stays next to it. */
  const windowStyle = useCallback((): React.CSSProperties => {
    if (typeof window === 'undefined') return {};
    const cx = window.innerWidth - pos.right - SIZE / 2;
    const cy = window.innerHeight - pos.bottom - SIZE / 2;
    const style: React.CSSProperties = {};
    if (cx < window.innerWidth / 2) { style.left = Math.max(MARGIN, window.innerWidth - pos.right - SIZE); style.right = 'auto'; }
    else style.right = pos.right;
    if (cy < window.innerHeight / 2) { style.top = Math.max(MARGIN, window.innerHeight - pos.bottom - SIZE); style.bottom = 'auto'; }
    else style.bottom = pos.bottom;
    return style;
  }, [pos]);

  return {
    style: { right: pos.right, bottom: pos.bottom } as React.CSSProperties,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    wasDrag,
    windowStyle,
  };
}

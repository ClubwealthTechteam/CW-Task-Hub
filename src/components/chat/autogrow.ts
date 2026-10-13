'use client';

// Chat boxes grow with what's typed so the whole message stays visible, up to a limit, then scroll.

import { useLayoutEffect, type RefObject } from 'react';

export function useAutoGrow(ref: RefObject<HTMLTextAreaElement>, value: string, maxPx: () => number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = maxPx();
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden';
  }, [ref, value, maxPx]);
}

export const halfScreen = () => Math.round(window.innerHeight * 0.45);
export const bubbleMax = () => 200;

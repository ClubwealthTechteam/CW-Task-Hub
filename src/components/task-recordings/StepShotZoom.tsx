'use client';

// A step's screenshot on a Task Recording page; clicking it opens it big on the same page (X, Esc or a
// click outside closes it), like the SOP Handbook's screenshots. `ring` circles the click in red.

import { useEffect, useState } from 'react';
import type { Point } from '@/lib/task-recordings/store';

/** A screenshot with a red circle at `ring` (shares of its width and height). */
export function RingedShot({ src, alt, ring, lazy, onClick }: { src: string; alt: string; ring?: Point; lazy?: boolean; onClick?: (e: React.MouseEvent<HTMLImageElement>) => void }) {
  return (
    <span className="trec-ringed">
      <img src={src} alt={alt} loading={lazy ? 'lazy' : undefined} onClick={onClick} />
      {ring && <span className="trec-ring" style={{ left: `${ring.x * 100}%`, top: `${ring.y * 100}%` }} aria-hidden />}
    </span>
  );
}

export function StepShotZoom({ src, alt, ring }: { src: string; alt: string; ring?: Point }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button type="button" className="trec-shot" onClick={() => setOpen(true)} aria-label={`Open ${alt}`}>
        <RingedShot src={src} alt={alt} ring={ring} lazy />
      </button>
      {open && (
        <div className="sop-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="sop-lightbox-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <span onClick={(e) => e.stopPropagation()}><RingedShot src={src} alt={alt} ring={ring} /></span>
        </div>
      )}
    </>
  );
}

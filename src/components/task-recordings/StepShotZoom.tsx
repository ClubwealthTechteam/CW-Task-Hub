'use client';

// A step's screenshot on a Task Recording page; clicking it opens it big on the same page (X, Esc or a
// click outside closes it), like the SOP Handbook's screenshots.

import { useEffect, useState } from 'react';

export function StepShotZoom({ src, alt }: { src: string; alt: string }) {
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
        <img src={src} alt={alt} loading="lazy" />
      </button>
      {open && (
        <div className="sop-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="sop-lightbox-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

'use client';

// A step's screenshot on an SOP article, with Miguel's paste box. Click the box, press Ctrl/⌘+V (or choose a file);
// the image is shrunk here (1600px, WebP) before it's saved, then the page refreshes to show it.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_SIDE = 1600;
const MAX_CHARS = 850_000;

function shrink(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      let q = 0.9;
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', q);
        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', q);
        if (out.length <= MAX_CHARS) return resolve(out);
        k *= 0.8; q = Math.max(0.6, q - 0.08);
      }
      reject(new Error('too big'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

type Size = 's' | 'm' | 'l' | 'full';
const SIZES: { id: Size; label: string }[] = [{ id: 's', label: 'Small' }, { id: 'm', label: 'Medium' }, { id: 'l', label: 'Large' }, { id: 'full', label: 'Full width' }];

/** The screenshot shown big over the page, with an X (Esc or a click outside also closes it). */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  return (
    <div className="sop-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button ref={closeRef} type="button" className="sop-lightbox-x" aria-label="Close" onClick={onClose}>×</button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

export function StepShot({ articleId, step, slot = 1, src, size = 'm', canEdit }: { articleId: string; step: number; slot?: 1 | 2; src: string | null; size?: Size; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<Size>(size);
  useEffect(() => setWidth(size), [size]);
  const label = slot === 1 ? `step ${step}` : `step ${step} · image ${slot}`;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(file: Blob) {
    setBusy(true); setError('');
    try {
      const dataUrl = await shrink(file);
      const res = await fetch('/api/sop/shot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: articleId, step, slot, dataUrl }) });
      if (res.ok) router.refresh();
      else setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t save that. Try again.');
    } catch {
      setError('Couldn’t read that image. Try a PNG or JPG screenshot.');
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true); setError('');
    const res = await fetch(`/api/sop/shot?id=${encodeURIComponent(articleId)}&step=${step}&slot=${slot}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t remove it. Try again.');
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) { setError('There’s no image on the clipboard. Copy a screenshot first.'); return; }
    e.preventDefault();
    save(file);
  }

  async function resize(next: Size) {
    const before = width;
    setWidth(next); setError('');
    const res = await fetch('/api/sop/shot', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: articleId, step, slot, size: next }) });
    if (!res.ok) { setWidth(before); setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t change the size. Try again.'); }
  }

  const alt = `${articleId} ${label}`;
  const image = src && (
    <>
      <button type="button" className="sop-shot sop-shot-open" onClick={() => setOpen(true)} aria-label={`Open ${label} image`}>
        <img src={src} alt={alt} loading="lazy" />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );

  if (!canEdit) {
    return image ? <div className={`sop-shot-item size-${width}`}>{image}</div> : (
      <div className="sop-shot sop-shot-empty" role="img" aria-label={`Screenshot for ${label} not added yet`}>
        <span>Screenshot · {label}</span>
        <span className="muted small">To be added by the Main Admin</span>
      </div>
    );
  }

  return (
    <div className={`sop-shot-edit sop-shot-item size-${src ? width : 'm'}`}>
      {image}
      {src && (
        <div className="sop-size" role="group" aria-label={`Size of ${label} image`}>
          <span className="muted small">Size</span>
          {SIZES.map((x) => (
            <button key={x.id} type="button" aria-pressed={width === x.id} onClick={() => resize(x.id)} disabled={busy}>{x.label}</button>
          ))}
        </div>
      )}
      <div className={`sop-paste${src ? ' has-shot' : ''}`} tabIndex={0} role="button" onPaste={onPaste}
        aria-label={`Paste a screenshot for ${label}`}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
        {busy ? <span>Saving…</span> : (
          <>
            <span>{src ? 'Replace' : 'Paste image'} · {label}</span>
            <span className="muted small">Click here, then press Ctrl/⌘+V</span>
          </>
        )}
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>Choose file</button>
        {src && <button type="button" className="btn" disabled={busy} onClick={remove}>Remove</button>}
        {error && <span className="sop-error small" role="alert">{error}</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) save(f); }} />
    </div>
  );
}

'use client';

// A step's screenshot on an SOP article, with Miguel's paste box. Click the box, press Ctrl/⌘+V (or choose a file);
// the image is shrunk here (1600px, WebP) before it's saved, then the page refreshes to show it.

import { useRef, useState } from 'react';
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

export function StepShot({ articleId, step, src, canEdit }: { articleId: string; step: number; src: string | null; canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(file: Blob) {
    setBusy(true); setError('');
    try {
      const dataUrl = await shrink(file);
      const res = await fetch('/api/sop/shot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: articleId, step, dataUrl }) });
      if (res.ok) router.refresh();
      else setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t save that. Try again.');
    } catch {
      setError('Couldn’t read that image. Try a PNG or JPG screenshot.');
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true); setError('');
    const res = await fetch(`/api/sop/shot?id=${encodeURIComponent(articleId)}&step=${step}`, { method: 'DELETE' });
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

  const image = src && (
    <a href={src} target="_blank" rel="noreferrer" className="sop-shot">
      <img src={src} alt={`${articleId} step ${step}`} loading="lazy" />
    </a>
  );

  if (!canEdit) {
    return image || (
      <div className="sop-shot sop-shot-empty" role="img" aria-label={`Screenshot for step ${step} not added yet`}>
        <span>Screenshot · step {step}</span>
        <span className="muted small">To be added by the Main Admin</span>
      </div>
    );
  }

  return (
    <div className="sop-shot-edit">
      {image}
      <div className={`sop-paste${src ? ' has-shot' : ''}`} tabIndex={0} role="button" onPaste={onPaste}
        aria-label={`Paste a screenshot for step ${step}`}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
        {busy ? <span>Saving…</span> : (
          <>
            <span>{src ? 'Replace' : 'Paste image'} · step {step}</span>
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

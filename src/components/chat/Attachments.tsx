'use client';

// Files in a chat: what someone attached (thumbnails and PDF chips) and the graphics the assistant made
// (shown large, with Open and Download). Also the uploader used by the composer.

import { useState } from 'react';
import type { FileRef } from '@/lib/chat/files';
import { Icon } from '@/components/Icon';

const src = (f: { id: string }) => `/api/chat/files/${f.id}`;
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function MessageFiles({ files }: { files: FileRef[] }) {
  const made = files.filter((f) => f.source === 'assistant');
  const sent = files.filter((f) => f.source !== 'assistant');
  return (
    <>
      {sent.length > 0 && (
        <div className="cf-sent">
          {sent.map((f) => (f.type === 'application/pdf'
            ? <a key={f.id} className="cf-pdf" href={src(f)} target="_blank" rel="noreferrer"><Icon name="file" size={15} /><span>{f.name}</span><small>{kb(f.size)}</small></a>
            // eslint-disable-next-line @next/next/no-img-element
            : <a key={f.id} className="cf-thumb" href={src(f)} target="_blank" rel="noreferrer" title={f.name}><img src={src(f)} alt={f.name} loading="lazy" /></a>))}
        </div>
      )}
      {made.map((f) => (
        <figure key={f.id} className="cf-made">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href={src(f)} target="_blank" rel="noreferrer"><img src={src(f)} alt={f.name} loading="lazy" /></a>
          <figcaption>
            <span>{f.name}</span>
            <a className="btn" href={`${src(f)}?download=1`}><Icon name="download" size={14} /> Download</a>
          </figcaption>
        </figure>
      ))}
    </>
  );
}

export interface Pending { key: string; name: string; type: string; size: number; preview?: string; id?: string; error?: string }

export const ACCEPT = 'image/png,image/jpeg,application/pdf';
const MAX = 4 * 1024 * 1024;
const MAX_SIDE = 3000;

/** Big photos are scaled down in the browser first, so they fit the 4 MB limit and upload fast. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= MAX) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.9, 0.8, 0.7, 0.6]) {
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
    if (out && out.size <= MAX) return out;
  }
  return file;
}

export async function uploadFile(file: File): Promise<{ id?: string; error?: string }> {
  if (!ACCEPT.split(',').includes(file.type)) return { error: 'Only PNG, JPEG and PDF' };
  const blob = await shrink(file);
  if (blob.size > MAX) return { error: 'Too big (4 MB max)' };
  const form = new FormData();
  form.append('file', blob, blob === file ? file.name : file.name.replace(/\.\w+$/, '') + '.jpg');
  const res = await fetch('/api/chat/files', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { id: body.file.id } : { error: body.error || 'Upload failed' };
}

export function PendingFiles({ items, onRemove }: { items: Pending[]; onRemove: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="cf-pending">
      {items.map((p) => (
        <span key={p.key} className={`cf-chip${p.error ? ' err' : ''}`} title={p.error ?? p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.preview ? <img src={p.preview} alt="" /> : <Icon name="file" size={15} />}
          <span className="cf-name">{p.error ? p.error : p.name}</span>
          {!p.id && !p.error && <span className="cf-spin" aria-label="Uploading" />}
          <button type="button" onClick={() => onRemove(p.key)} aria-label={`Remove ${p.name}`}>×</button>
        </span>
      ))}
    </div>
  );
}

export function useAttachments() {
  const [items, setItems] = useState<Pending[]>([]);
  async function add(list: FileList | File[]) {
    for (const file of Array.from(list).slice(0, 5)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setItems((x) => [...x, { key, name: file.name, type: file.type, size: file.size, preview }]);
      const r = await uploadFile(file);
      setItems((x) => x.map((p) => (p.key === key ? { ...p, ...r } : p)));
    }
  }
  /** A file already in the hub (e.g. a client's photo from the welcome board). */
  const addExisting = (f: { id: string; name: string; type: string; size: number }) =>
    setItems((x) => (x.some((p) => p.id === f.id) ? x : [...x, { key: f.id, name: f.name, type: f.type, size: f.size, id: f.id, preview: f.type.startsWith('image/') ? `/api/chat/files/${f.id}` : undefined }]));
  const remove = (key: string) => setItems((x) => x.filter((p) => p.key !== key));
  const clear = () => setItems([]);
  const ready = items.filter((p) => p.id).map((p) => p.id!);
  const uploading = items.some((p) => !p.id && !p.error);
  return { items, add, addExisting, remove, clear, ready, uploading };
}

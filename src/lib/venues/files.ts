// Photos and files per venue (room setup, floor plan, contract): PNG, JPEG or PDF up to 4 MB, at most
// 12 per venue. Kept in the hub store (no expiry), split into chunks like chat files.

import { getJSON, setJSON, deleteKey } from '@/lib/store';
import { newFileId, sniff, cleanName, MAX_FILE_BYTES, type FileType } from '@/lib/chat/files';

export const MAX_VENUE_FILES = 12;
export { MAX_FILE_BYTES, sniff, cleanName, newFileId };
export type { FileType };

const CHUNK = 700_000;
interface Meta { id: string; venue: string; name: string; type: FileType; size: number; parts: number }
const metaKey = (id: string) => `venues:file:${id}`;
const partKey = (id: string, n: number) => `venues:file:${id}:${n}`;
const validId = (id: string) => /^f_[a-z0-9]+$/.test(id);

export async function saveVenueFile(meta: Omit<Meta, 'parts'>, bytes: Uint8Array) {
  const b64 = Buffer.from(bytes).toString('base64');
  const parts = Math.ceil(b64.length / CHUNK) || 1;
  for (let n = 0; n < parts; n++) await setJSON(partKey(meta.id, n), b64.slice(n * CHUNK, (n + 1) * CHUNK));
  await setJSON(metaKey(meta.id), { ...meta, parts });
}

export async function venueFile(id: string) {
  if (!validId(id)) return null;
  const meta = await getJSON<Meta | null>(metaKey(id), null);
  if (!meta) return null;
  const parts = await Promise.all(Array.from({ length: meta.parts }, (_, n) => getJSON<string>(partKey(id, n), '')));
  if (parts.some((p) => !p)) return null;
  return { meta, bytes: Buffer.from(parts.join(''), 'base64') };
}

export async function deleteVenueFile(id: string) {
  if (!validId(id)) return;
  const meta = await getJSON<Meta | null>(metaKey(id), null);
  if (meta) for (let n = 0; n < meta.parts; n++) await deleteKey(partKey(id, n));
  await deleteKey(metaKey(id));
}

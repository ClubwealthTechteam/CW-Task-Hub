// Files in CW Assistant chats: PNG, JPEG and PDF files people attach (Social Media), and the graphics the
// assistant makes. Kept for 30 days in the hub's store, split into chunks so no single value is too big.
// The browser reads them with the person's session; the assistant routine reads them with a signed link.

import { getJSON, setJSONFor } from '@/lib/store';
import { signValue } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/access';
import type { Person } from '@/config/people';

export interface ChatFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  owner: string;            // the person whose chat it belongs to
  conversationId?: string;  // set once the file is sent in a message
  source: 'upload' | 'assistant';
  at: number;
  /** A department whose people may all open it (e.g. a client's photo on a welcome post). */
  shared?: string;
}

export type FileType = 'image/png' | 'image/jpeg' | 'application/pdf';
export type FileRef = Pick<ChatFile, 'id' | 'name' | 'type' | 'size' | 'source'> & {
  /** Set when the graphic was sent to the person's Canva. */
  canva?: { id: string; title: string; editUrl: string; viewUrl: string; at: number };
};

export const MAX_FILE_BYTES = 4 * 1024 * 1024;   // Vercel request bodies stop at 4.5 MB
export const MAX_FILES_PER_MESSAGE = 5;
const TTL = 30 * 24 * 60 * 60;
const CHUNK = 700_000;                           // characters of base64 per stored value

const metaKey = (id: string) => `chat:file:${id}`;
const partKey = (id: string, n: number) => `chat:file:${id}:${n}`;

/** What the bytes really are (the name and browser's type aren't trusted). */
export function sniff(bytes: Uint8Array): FileType | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  return null;
}

const EXT: Record<FileType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };

export function cleanName(name: string, type: FileType) {
  const base = name.replace(/[^\w.\- ()]+/g, '_').replace(/\.[a-z0-9]{1,5}$/i, '').trim().slice(0, 80) || 'file';
  return `${base}.${EXT[type]}`;
}

export const newFileId = () => `f_${Date.now().toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
const validId = (id: string) => /^f_[a-z0-9]+$/.test(id);

export async function saveFile(meta: ChatFile, bytes: Uint8Array) {
  const b64 = Buffer.from(bytes).toString('base64');
  const parts = Math.ceil(b64.length / CHUNK) || 1;
  for (let n = 0; n < parts; n++) await setJSONFor(partKey(meta.id, n), b64.slice(n * CHUNK, (n + 1) * CHUNK), TTL);
  await setJSONFor(metaKey(meta.id), { ...meta, parts }, TTL);
  return meta;
}

export async function fileMeta(id: string) {
  if (!validId(id)) return null;
  return getJSON<(ChatFile & { parts: number }) | null>(metaKey(id), null);
}

export async function updateFileMeta(meta: ChatFile & { parts: number }) {
  await setJSONFor(metaKey(meta.id), meta, TTL);
}

export async function fileBytes(meta: ChatFile & { parts: number }) {
  const parts = await Promise.all(Array.from({ length: meta.parts }, (_, n) => getJSON<string>(partKey(meta.id, n), '')));
  if (parts.some((p) => !p)) return null;
  return Buffer.from(parts.join(''), 'base64');
}

export const toRef = (f: ChatFile): FileRef => ({ id: f.id, name: f.name, type: f.type, size: f.size, source: f.source });

/** Signed link the assistant routine uses to read a file (no session needed). */
export const fileToken = (id: string) => signValue(`chat-file:${id}`);
export async function validFileToken(id: string, token: string) {
  const expected = await fileToken(id);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** People outside Social Media who also design (Events: Andrea and Liz edit graphics in Canva). */
export const GRAPHICS_PEOPLE = ['andrea', 'liz'];

/** Attaching files and making graphics: the Social Media department, GRAPHICS_PEOPLE and super admins. */
export const canUseFiles = (user: Person | null | undefined) =>
  Boolean(user) && (isSuperAdmin(user) || user!.departments.includes('social-media') || GRAPHICS_PEOPLE.includes(user!.id));

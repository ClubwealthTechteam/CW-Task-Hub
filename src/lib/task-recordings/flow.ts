// Builds a Flow Canvas board (the JSON the CW AI Hub canvas imports with "Paste JSON") from a write-up:
// one node per step left to right, each step's screenshot as an Image node wired below it (port "img",
// the click circled in red), tips as Notes wired to the top of their step (port "note"), and the summary as a Note at the start.
// Same shape as Miguel's boards (e.g. "Half Day Events Registration Main").

import sharp from 'sharp';
import { CANVAS_APPS, type CanvasApp } from './apps';
import { clickFor, getShot, type Point, type Recording, type WriteUp } from './store';

const STEP_GAP = 300;
const IMG_W = 260;
const IMG_Y = 300;

let seq = 0;
const nid = () => `t${Date.now().toString(36).slice(-4)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Width and height of a WebP/PNG/JPEG data URL, read from its header (no image library needed). */
export function imageSize(dataUrl: string): { w: number; h: number } | null {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 1 + 64 * 1024), 'base64');
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** The screenshot with a red circle around the click (WebP data URL). Returns the original if drawing fails. */
export async function ringShot(dataUrl: string, at: Point): Promise<string> {
  const size = imageSize(dataUrl);
  if (!size) return dataUrl;
  try {
    const r = Math.max(14, Math.round(size.w * 0.022));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}"><circle cx="${Math.round(at.x * size.w)}" cy="${Math.round(at.y * size.h)}" r="${r}" fill="rgba(217,48,37,0.12)" stroke="#d93025" stroke-width="${Math.max(3, Math.round(r / 5))}"/></svg>`;
    const out = await sharp(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))
      .composite([{ input: Buffer.from(svg) }])
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${out.toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

export async function buildFlow(rec: Recording, w: WriteUp) {
  const nodes: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  const edge = (from: string, to: string, port: string, toPort?: string) => edges.push({ id: nid(), from, to, port, ...(toPort ? { toPort } : {}) });

  nodes.push({ id: nid(), type: 'note', x: -STEP_GAP, y: -40, title: 'Summary', desc: [`${w.title}`, ...w.summary.map((s) => `• ${s}`)].join('\n') });
  let prev: string | null = null;
  for (const [i, s] of w.steps.entries()) {
    const x = i * STEP_GAP;
    const id = nid();
    const app = (s.app in CANVAS_APPS ? s.app : 'node') as CanvasApp;
    nodes.push({
      id, type: 'app', app, x, y: 0,
      title: app === 'node' || app === 'human' ? s.title : CANVAS_APPS[app],
      desc: `Step ${i + 1} · ${s.title}\n${s.action}`,
      status: 'idea', showDesc: true,
      ...(s.sheet ? { sheet: s.sheet } : {}),
      ...(s.tab ? { tab: s.tab } : {}),
      ...(s.range ? { range: s.range } : {}),
      ...(s.link ? { link: s.link } : {}),
      ...(s.channel ? { channel: s.channel } : {}),
    });
    if (prev) edge(prev, id, 'out');
    prev = id;
    if (s.note) {
      const note = nid();
      nodes.push({ id: note, type: 'note', x: x - 15, y: -200, title: 'Note', desc: s.note });
      edge(id, note, 'note', 'bottom');
    }
    const raw = s.shot >= 0 ? await getShot(rec.id, s.shot) : null;
    const at = raw ? clickFor(rec, s.shot) : undefined;
    const shot = raw && at ? await ringShot(raw, at) : raw;
    if (shot) {
      const size = imageSize(shot) ?? { w: 1000, h: 600 };
      const ar = size.h / size.w;
      const img = nid();
      nodes.push({ id: img, type: 'image', x: x - 45, y: IMG_Y, title: `Step ${i + 1}`, desc: '', img: shot, nw: size.w, ar, w: IMG_W, h: Math.round(IMG_W * ar) });
      edge(id, img, 'img');
    }
  }
  const date = new Date(rec.at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
  return {
    id: nid(),
    name: `${w.title} (recorded ${date})`,
    view: { k: 0.5, x: 420, y: 160 },
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}

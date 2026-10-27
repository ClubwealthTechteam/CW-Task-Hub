// Download the CW Task Recorder browser extension (a .zip to load in chrome://extensions → Load unpacked).
// It's built from the extension/ folder on each download, with this hub's address written into config.js
// so the extension sends recordings to the hub it was downloaded from.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { zip } from '@/lib/task-recordings/zip';

export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'extension');

async function walk(dir: string, base = ''): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (!e.name.startsWith('.')) out.push(rel);
  }
  return out.sort();
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const origin = new URL(req.url).origin;
  const files: [string, Buffer][] = [];
  for (const rel of await walk(ROOT)) {
    let data = await readFile(path.join(ROOT, rel));
    if (rel === 'config.js') data = Buffer.from(`// Written by the Admin Hub when this copy was downloaded.\nexport const HUB_URL = ${JSON.stringify(origin)};\n`);
    files.push([`cw-task-recorder/${rel}`, data]);
  }
  return new Response(new Uint8Array(zip(files)), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="cw-task-recorder.zip"',
      'Cache-Control': 'no-store',
    },
  });
}

// Upload a photo/file to a venue (multipart: id, file) or remove one (DELETE ?id=&file=).

import { NextResponse } from 'next/server';
import { findVenue } from '@/lib/venues/all';
import { logChanges, setVenueFiles } from '@/lib/venues/info';
import { cleanName, deleteVenueFile, MAX_FILE_BYTES, MAX_VENUE_FILES, newFileId, saveVenueFile, sniff } from '@/lib/venues/files';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { user, error } = await venuesUser();
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') ?? '');
  const file = form?.get('file');
  if (!(await findVenue(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'Pick a file' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files can be up to 4 MB' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return NextResponse.json({ error: 'Only PNG, JPEG or PDF files' }, { status: 400 });
  const ref = { id: newFileId(), name: cleanName(file.name, type), type, size: bytes.length, at: Date.now(), by: user!.id };
  let full = false;
  await saveVenueFile({ id: ref.id, venue: id, name: ref.name, type, size: ref.size }, bytes);
  const files = await setVenueFiles(id, (list) => {
    if (list.length >= MAX_VENUE_FILES) { full = true; return list; }
    return [...list, ref];
  });
  if (full) { await deleteVenueFile(ref.id); return NextResponse.json({ error: `Up to ${MAX_VENUE_FILES} files per venue` }, { status: 400 }); }
  await logChanges(id, [{ at: ref.at, by: user!.id, field: 'file', to: `Added ${ref.name}` }]);
  return NextResponse.json({ files, name: user!.name });
}

export async function DELETE(req: Request) {
  const { user, error } = await venuesUser();
  if (error) return error;
  const q = new URL(req.url).searchParams;
  const id = String(q.get('id') ?? ''), fid = String(q.get('file') ?? '');
  let removed = '';
  const files = await setVenueFiles(id, (list) => list.filter((f) => (f.id === fid ? ((removed = f.name), false) : true)));
  if (removed) {
    await deleteVenueFile(fid);
    await logChanges(id, [{ at: Date.now(), by: user!.id, field: 'file', from: removed, to: 'Removed' }]);
  }
  return NextResponse.json({ files });
}

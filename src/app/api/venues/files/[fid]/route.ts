// Opens a venue file (Events team and super admins only).

import { NextResponse } from 'next/server';
import { venueFile } from '@/lib/venues/files';
import { venuesUser } from '../../guard';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ fid: string }> }) {
  const { error } = await venuesUser();
  if (error) return error;
  const f = await venueFile((await params).fid);
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(f.bytes), {
    headers: { 'Content-Type': f.meta.type, 'Content-Disposition': `inline; filename="${f.meta.name}"`, 'Cache-Control': 'private, max-age=3600' },
  });
}

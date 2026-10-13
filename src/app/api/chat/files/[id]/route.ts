// One chat file. The person it belongs to (and super admins) open it with their session; the assistant
// routine opens it with the signed link the hub put in its message (?t=…).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { fileBytes, fileMeta, validFileToken } from '@/lib/chat/files';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const meta = await fileMeta(params.id);
  const token = url.searchParams.get('t');
  if (token) {
    if (!meta || !(await validFileToken(params.id, token))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } else {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    if (!meta || (meta.owner !== user.id && !isSuperAdmin(user))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const bytes = await fileBytes(meta);
  if (!bytes) return NextResponse.json({ error: 'This file has expired' }, { status: 410 });
  const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': meta.type,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `${disposition}; filename="${meta.name}"`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

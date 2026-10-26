// A pasted SOP step screenshot, served as an image to anyone signed in.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sopById } from '@/data/sop';
import { getSopShot } from '@/lib/sop';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, props: { params: Promise<{ id: string; step: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const article = sopById(params.id);
  const shot = article ? await getSopShot(article.id, Number(params.step)) : null;
  if (!shot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new Response(Buffer.from(shot.data, 'base64'), {
    // The URL carries ?v=<pasted at>, so a new paste gets a new URL and the old one can be cached.
    headers: { 'Content-Type': shot.type, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}

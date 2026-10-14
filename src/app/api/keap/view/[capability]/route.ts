// Read-only Keap views for the Keap tab. Super admins only; the client refuses anything but reads.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { callKeap, KeapError } from '@/lib/integrations/keap/client';
import { keapMessage } from '@/lib/integrations/keap/contacts';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;

export async function GET(req: Request, props: { params: Promise<{ capability: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Only Miguel, Omerson or Camille can browse Keap' }, { status: 403 });

  const query: Record<string, unknown> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (/^[a-zA-Z_]{1,40}$/.test(k)) query[k] = v.slice(0, 200);
  if (query.limit) query.limit = Math.min(Number(query.limit) || 50, MAX_LIMIT);

  try {
    return NextResponse.json({ data: await callKeap(params.capability, query) });
  } catch (e) {
    const err = e as KeapError;
    return NextResponse.json({ error: keapMessage(err), details: err.details }, { status: err.status === 404 ? 404 : err.status === 403 ? 403 : 502 });
  }
}

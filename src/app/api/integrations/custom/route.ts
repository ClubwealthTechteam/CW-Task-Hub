import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canManageIntegrations } from '@/lib/access';
import { addCustom, callCustom, listCustom, removeCustom, toPublic } from '@/lib/integrations/custom';

async function guard() {
  const user = await getCurrentUser();
  return canManageIntegrations(user) ? user : null;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  return NextResponse.json((await listCustom()).map(toPublic));
}

export async function POST(req: Request) {
  const user = await guard();
  if (!user) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'test') {
    try { return NextResponse.json(await callCustom(String(b.id), { test: true, from: 'CW Task Hub', at: new Date().toISOString() })); }
    catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 }); }
  }

  const name = String(b.name ?? '').trim().slice(0, 80);
  const url = String(b.url ?? '').trim();
  if (!name || !/^https:\/\//.test(url)) return NextResponse.json({ error: 'Name and an https:// URL are required' }, { status: 400 });
  const item = await addCustom({
    name, url,
    type: b.type === 'rest_api' ? 'rest_api' : 'webhook',
    description: String(b.description ?? '').slice(0, 300),
    authHeader: String(b.authHeader ?? '').trim().slice(0, 60) || undefined,
    secret: String(b.secret ?? '').trim() || undefined,
    createdBy: user.id,
  });
  return NextResponse.json(toPublic(item));
}

export async function DELETE(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (id) await removeCustom(id);
  return NextResponse.json({ ok: true });
}

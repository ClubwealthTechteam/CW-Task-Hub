import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canManageIntegrations } from '@/lib/access';
import { triggerZap, zapierHooks } from '@/lib/integrations/zapier';
import { addToFeed } from '@/lib/integrations/zapier-feed';

export async function GET() {
  const user = await getCurrentUser();
  if (!canManageIntegrations(user)) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  return NextResponse.json(Object.keys(zapierHooks()));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canManageIntegrations(user)) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  const { name, payload } = await req.json().catch(() => ({}));
  try {
    const result = await triggerZap(String(name), { ...(payload ?? {}), triggeredBy: user!.id });
    await addToFeed({ direction: 'out', zap: String(name), event: result.ok ? 'Started from the hub' : `Start failed (${result.status})`, by: user!.id, data: payload ?? undefined });
    return NextResponse.json(result);
  }
  catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 }); }
}

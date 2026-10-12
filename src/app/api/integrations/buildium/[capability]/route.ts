import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canManageIntegrations } from '@/lib/access';
import { callBuildium } from '@/lib/integrations/buildium/client';
import type { IntegrationError } from '@/lib/integrations/http';

// Direct Buildium actions from the Integrations page. Super admins only; automations call the client directly.
export async function POST(req: Request, { params }: { params: { capability: string } }) {
  const user = await getCurrentUser();
  if (!canManageIntegrations(user)) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, data: await callBuildium(params.capability, body.params ?? {}) });
  } catch (e) {
    const err = e as IntegrationError;
    return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status || 500 });
  }
}

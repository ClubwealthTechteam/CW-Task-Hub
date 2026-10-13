// New clients from Keap (read-only) with where each one is in the welcome-post process.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { canUseWelcome } from '@/lib/welcome/access';
import { clearClientCache, newClients } from '@/lib/welcome/keap-clients';
import { getSettings, listRecords } from '@/lib/welcome/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const settings = await getSettings();
  if (!keapConfigured()) return NextResponse.json({ keap: false, settings, clients: [], records: {} });
  if (new URL(req.url).searchParams.has('refresh')) clearClientCache();
  try {
    const [clients, records] = await Promise.all([newClients(settings), listRecords()]);
    return NextResponse.json({ keap: true, settings, clients, records });
  } catch (e) {
    return NextResponse.json({ keap: true, settings, clients: [], records: await listRecords(), error: keapMessage(e as IntegrationError) });
  }
}

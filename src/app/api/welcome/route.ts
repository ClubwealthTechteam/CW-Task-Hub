// New clients from Keap (read-only) with where each one is in the welcome-post process.

import { NextResponse } from 'next/server';
import { getCurrentUser, getViewer } from '@/lib/auth/current-user';
import { runWelcomeAutomation } from '@/lib/welcome/auto';
import { collectFinding, REFIND_MS, startFinding } from '@/lib/welcome/finder';
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
  const q = new URL(req.url).searchParams;
  if (q.has('refresh')) clearClientCache();
  const preview = Boolean((await getViewer())?.preview);
  try {
    // Claude finds the new clients: on first visit, every 12 hours, or when asked to look again.
    let finding = settings.find === 'claude' ? await collectFinding() : null;
    if (settings.find === 'claude' && !preview && finding?.status !== 'thinking'
      && (!finding || q.has('find') || finding.days !== settings.days || Date.now() - finding.at > REFIND_MS)) {
      finding = await startFinding(user, settings.days);
    }
    const [clients, saved] = await Promise.all([newClients(settings), listRecords()]);
    // Fill in captions, calendar slots and graphics automatically (not while previewing someone).
    const records = preview ? saved : await runWelcomeAutomation(clients, saved, settings, user);
    const found = finding && { status: finding.status, at: finding.at, looked: finding.looked, count: finding.clients.length, error: finding.error };
    return NextResponse.json({ keap: true, settings, clients, records, finding: found });
  } catch (e) {
    return NextResponse.json({ keap: true, settings, clients: [], records: await listRecords(), error: keapMessage(e as IntegrationError) });
  }
}

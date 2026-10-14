// Make (or remake) a client's welcome graphic: the assistant makes it in a background chat and the board
// picks it up when it's ready.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome } from '@/lib/welcome/access';
import { requestGraphic } from '@/lib/welcome/auto';
import { newClients } from '@/lib/welcome/keap-clients';
import { getSettings, listRecords, saveRecord } from '@/lib/welcome/store';
import { chatIsConfigured } from '@/lib/chat/routine';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, props: { params: Promise<{ contactId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!chatIsConfigured()) return NextResponse.json({ error: 'The assistant isn’t switched on yet' }, { status: 503 });
  const id = Number(params.contactId);
  const client = (await newClients(await getSettings())).find((c) => c.contactId === id);
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  const rec = (await listRecords())[id];
  if (rec?.graphic?.status === 'pending' && Date.now() - rec.graphic.at < 10 * 60 * 1000) return NextResponse.json({ error: 'A graphic is already being made' }, { status: 409 });
  const graphic = await requestGraphic(user, client, rec);
  return NextResponse.json({ record: await saveRecord(id, { graphic }, user.id) });
}

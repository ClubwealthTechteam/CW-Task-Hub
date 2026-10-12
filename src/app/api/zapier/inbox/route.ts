// Zaps post updates here. Zapier action: Webhooks by Zapier → POST, URL /api/zapier/inbox?key=<ZAPIER_INBOUND_SECRET>,
// payload type json (or form). Fields `zap`, `event` and `summary` are shown in the feed; the rest is kept as data.
// This only records what Zapier sends: nothing else happens and nothing is changed anywhere.

import { NextResponse } from 'next/server';
import { addToFeed, inboxKeyValid } from '@/lib/integrations/zapier-feed';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 32_000;

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!inboxKeyValid(url.searchParams.get('key') ?? req.headers.get('x-hub-key'))) {
    return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'Too large' }, { status: 413 });

  let body: Record<string, unknown> = {};
  try {
    body = (req.headers.get('content-type') ?? '').includes('json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return NextResponse.json({ ok: false, error: 'Send JSON or form fields' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = { value: body };

  const { zap, event, summary, ...data } = body as Record<string, unknown>;
  const entry = await addToFeed({
    direction: 'in',
    zap: String(zap ?? url.searchParams.get('zap') ?? 'Unnamed Zap').slice(0, 120),
    event: event ? String(event).slice(0, 120) : undefined,
    summary: summary ? String(summary).slice(0, 500) : undefined,
    data,
  });
  return NextResponse.json({ ok: true, id: entry.id });
}

import { NextResponse } from 'next/server';
import { getJSON, storeIsPersistent } from '@/lib/store';
import { chatIsConfigured } from '@/lib/chat/routine';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { signInMode } from '@/lib/auth/access-codes';
import { inboxConfigured } from '@/lib/integrations/zapier-feed';
import { sheetsConfigured, sheetsKeyState } from '@/lib/integrations/google/sheets';
import { zapierHooks } from '@/lib/integrations/zapier';
import { canvaConfigured } from '@/lib/canva/client';
import { councilConfigured } from '@/lib/council/run';
import { recentErrors } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// Public: says only whether each piece is switched on, never any values.
// errors24h: how many errors the hub logged in the last day (the count only).
// ?speed=1 also times one storage read, to show how far the server is from the storage (for tuning).
export const GET = async (req: Request) => {
  let storageMs: number | undefined;
  if (new URL(req.url).searchParams.has('speed') && storeIsPersistent()) {
    const t = Date.now(); await getJSON('health:ping', null).catch(() => null); storageMs = Date.now() - t;
  }
  const errors24h = storeIsPersistent() ? (await recentErrors(24)).count : null;
  return NextResponse.json({
  ok: true,
  errors24h,
  app: 'cw-task-hub',
  signIn: signInMode(),
  storage: storeIsPersistent(),
  assistant: chatIsConfigured(),
  keap: keapConfigured(),
  eventbrite: eventbriteConfigured(),
  zapierInbox: inboxConfigured(),
  googleSheets: sheetsConfigured(),
  googleSheetsKey: sheetsKeyState(),
  canva: canvaConfigured(),
  council: councilConfigured(),
  councilSchedule: Boolean(process.env.CRON_SECRET),
  zapsToStart: Object.keys(zapierHooks()).length,
  ...(storageMs !== undefined && { storageMs, region: process.env.VERCEL_REGION ?? null }),
});
};

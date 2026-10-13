import { NextResponse } from 'next/server';
import { storeIsPersistent } from '@/lib/store';
import { chatIsConfigured } from '@/lib/chat/routine';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { signInMode } from '@/lib/auth/access-codes';
import { inboxConfigured } from '@/lib/integrations/zapier-feed';
import { sheetsConfigured, sheetsKeyState } from '@/lib/integrations/google/sheets';
import { zapierHooks } from '@/lib/integrations/zapier';
import { canvaConfigured } from '@/lib/canva/client';

export const dynamic = 'force-dynamic';

// Public: says only whether each piece is switched on, never any values.
export const GET = () => NextResponse.json({
  ok: true,
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
  zapsToStart: Object.keys(zapierHooks()).length,
});

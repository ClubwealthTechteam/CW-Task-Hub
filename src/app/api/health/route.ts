import { NextResponse } from 'next/server';
import { storeIsPersistent } from '@/lib/store';
import { chatIsConfigured } from '@/lib/chat/routine';
import { keapConfigured } from '@/lib/integrations/keap/client';

export const dynamic = 'force-dynamic';

// Public: says only whether each piece is switched on, never any values.
export const GET = () => NextResponse.json({
  ok: true,
  app: 'cw-task-hub',
  storage: storeIsPersistent(),
  assistant: chatIsConfigured(),
  keap: keapConfigured(),
});

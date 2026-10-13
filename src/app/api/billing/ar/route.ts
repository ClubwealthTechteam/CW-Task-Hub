// Jizel's daily overdue-balance list (read-only from Keap). Client Care and super admins only.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { arReport, canUseAr } from '@/lib/billing/ar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseAr(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!keapConfigured()) return NextResponse.json({ keap: false });
  try {
    return NextResponse.json({ keap: true, report: await arReport(new URL(req.url).searchParams.has('refresh')) });
  } catch (e) {
    return NextResponse.json({ keap: true, error: keapMessage(e as IntegrationError) });
  }
}

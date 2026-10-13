// Canva sends people back here after they approve the hub. Swaps the code for tokens and returns them to
// the task chat they connected from (or their department if something went wrong).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseCanva, finishAuth } from '@/lib/canva/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string, result: string) => NextResponse.redirect(new URL(`${path}${path.includes('?') ? '&' : '?'}canva=${result}`, url.origin));
  const user = await getCurrentUser();
  if (!user || !canUseCanva(user)) return back('/', 'not-allowed');
  const home = `/w/${user.departments[0]}`;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return back(home, url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'failed');
  try {
    return back(await finishAuth(user.id, code, state), 'connected');
  } catch (e) {
    console.error('Canva connect failed:', (e as Error).message);
    return back(home, 'failed');
  }
}

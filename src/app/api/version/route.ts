import { NextResponse } from 'next/server';
import { CHANGELOG } from '@/data/changelog';

export const dynamic = 'force-dynamic';

// Which deploy is live, and the newest changelog entry. The page compares this with the deploy it
// was loaded from to offer a reload (components/UpdateNotice.tsx).
export const GET = () => NextResponse.json(
  { build: process.env.NEXT_PUBLIC_BUILD_ID ?? null, latest: CHANGELOG[0]?.title ?? null },
  { headers: { 'Cache-Control': 'no-store' } },
);

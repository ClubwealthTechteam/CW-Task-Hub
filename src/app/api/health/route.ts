import { NextResponse } from 'next/server';
export const GET = () => NextResponse.json({ ok: true, app: 'cw-task-hub' });

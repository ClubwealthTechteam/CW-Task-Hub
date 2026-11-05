// Downloads every venue with the team's details as a CSV that opens in Excel.

import { personById } from '@/config/people';
import { allVenues } from '@/lib/venues/all';
import { allVenueInfo, FIELD_LABELS } from '@/lib/venues/info';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const { error } = await venuesUser();
  if (error) return error;
  const [{ venues }, info] = await Promise.all([allVenues(), allVenueInfo()]);
  const fields = Object.keys(FIELD_LABELS);
  const head = ['State', 'Venue', 'On Google map', 'Latitude', 'Longitude', ...fields.map((f) => FIELD_LABELS[f]), 'Files', 'Last updated', 'Updated by'];
  const rows = venues.map((v) => {
    const i = (info[v.id] ?? {}) as Record<string, unknown>;
    return [v.state, v.name, v.custom ? 'No (added in hub)' : 'Yes', v.lat, v.lng,
      ...fields.map((f) => (f === 'status' ? i.status ?? 'Not contacted yet' : f === 'address' ? i.address ?? v.address : i[f])),
      ((i.files as { name: string }[] | undefined) ?? []).map((x) => x.name),
      i.updatedAt ? new Date(i.updatedAt as number).toISOString().slice(0, 16).replace('T', ' ') : '',
      i.updatedBy ? personById(i.updatedBy as string)?.name ?? i.updatedBy : ''];
  });
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="CW-venues-${day}.csv"` } });
}

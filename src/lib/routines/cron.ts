// Minimal 5-field cron matcher (with an optional "CRON_TZ=Zone " prefix) for the Routines page: works out
// when a routine should have run last and when it runs next. Supports *, numbers, lists, ranges and steps.

function fieldMatches(spec: string, value: number, min: number, max: number): boolean {
  return spec.split(',').some((part) => {
    const [range, stepStr] = part.split('/');
    const step = stepStr ? Number(stepStr) : 1;
    let lo = min, hi = max;
    if (range !== '*') {
      const [a, b] = range.split('-').map(Number);
      lo = a; hi = b ?? (stepStr ? max : a);
    }
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

const parts = (zone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short',
});
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function matcher(cron: string) {
  const tz = cron.match(/^CRON_TZ=(\S+)\s+/);
  const zone = tz?.[1] ?? 'UTC';
  const f = cron.replace(/^CRON_TZ=\S+\s+/, '').trim().split(/\s+/);
  if (f.length !== 5) return null;
  const fmt = parts(zone);
  return (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return fieldMatches(f[0], Number(p.minute), 0, 59) && fieldMatches(f[1], Number(p.hour), 0, 23)
      && fieldMatches(f[2], Number(p.day), 1, 31) && fieldMatches(f[3], Number(p.month), 1, 12)
      && fieldMatches(f[4], DOW[p.weekday], 0, 6);
  };
}

const MIN = 60_000;
/** Next time at or after `from` the cron fires (searches 8 days), or null. */
export function nextRun(cron: string | undefined, from = Date.now()): number | null {
  const m = cron && matcher(cron);
  if (!m) return null;
  for (let t = Math.ceil(from / MIN) * MIN, end = from + 8 * 1440 * MIN; t <= end; t += MIN) if (m(t)) return t;
  return null;
}
/** Last time at or before `before` the cron fired (searches 8 days back), or null. */
export function prevRun(cron: string | undefined, before = Date.now()): number | null {
  const m = cron && matcher(cron);
  if (!m) return null;
  for (let t = Math.floor(before / MIN) * MIN, end = before - 8 * 1440 * MIN; t >= end; t -= MIN) if (m(t)) return t;
  return null;
}

// Zapier: the hub starts a Zap by posting to its "Catch Hook" URL. Zap URLs come from the
// ZAPIER_HOOKS env var (JSON map name → URL) or from custom webhook integrations added in the app.

export function zapierHooks(): Record<string, string> {
  try {
    const parsed = JSON.parse(process.env.ZAPIER_HOOKS || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function triggerZap(name: string, payload: Record<string, unknown>) {
  const url = zapierHooks()[name];
  if (!url) throw new Error(`No Zap named "${name}". Add it to ZAPIER_HOOKS.`);
  if (!/^https:\/\/hooks\.zapier\.com\//.test(url)) throw new Error('Zap URLs must start with https://hooks.zapier.com/');
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { ok: res.ok, status: res.status };
}

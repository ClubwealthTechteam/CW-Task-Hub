// Starts the "REality intro emails (Amrissa)" routine right after Am presses Send, so the emails go out within a
// minute instead of at the next hourly run. Needs REALITY_ROUTINE_TOKEN (the routine's API token).

const DEFAULT_ROUTINE_ID = 'trig_01D598veDZKKh5h5c4C2Y5N3';

export const realityRoutineConfigured = () => Boolean(process.env.REALITY_ROUTINE_TOKEN);

export async function fireRealityRoutine(text: string) {
  const id = process.env.REALITY_ROUTINE_ID || DEFAULT_ROUTINE_ID;
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${id}/fire`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REALITY_ROUTINE_TOKEN}`,
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`The REality routine couldn’t be started (${res.status}).`);
}

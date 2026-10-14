// Sends a chat message. With quick replies on, the server streams the answer (newline-delimited JSON);
// otherwise it answers with plain JSON and the reply arrives later (the chat polls for it).

import type { Conversation } from '@/lib/chat/store';

type Usage = { left: number | null; limit: number | null };
export interface PostResult { ok: boolean; error?: string; conversation?: Conversation; usage?: Usage }

export async function postChat(payload: Record<string, unknown>, on: {
  start: (conv: Conversation, usage?: Usage) => void;
  text: (soFar: string) => void;
}): Promise<PostResult> {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, stream: true }) });
  if (!(res.headers.get('content-type') ?? '').includes('application/x-ndjson') || !res.body) {
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, conversation: body.conversation, usage: body.usage } : { ok: false, error: body.error || 'Something went wrong', usage: body.usage };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', soFar = '', last: PostResult = { ok: true };
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === 'start') { on.start(ev.conversation, ev.usage); last = { ok: true, conversation: ev.conversation, usage: ev.usage }; }
      else if (ev.type === 'text') { soFar += ev.text; on.text(soFar); }
      else if (ev.type === 'done' || ev.type === 'handoff') last = { ...last, conversation: ev.conversation };
    }
    if (done) break;
  }
  return last;
}

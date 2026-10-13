// Tells the assistant routine about files in the conversation (with signed links to read them), and
// whether it may make graphics for this person (Social Media and super admins).

import type { Conversation } from './store';
import { fileToken } from './files';

const HUB = 'https://cw-ai-task-hub.vercel.app';
const MAX = 8;

export async function filesContext(conv: Conversation, canMakeGraphics: boolean, canvaConnected = false): Promise<string> {
  const files = conv.messages.flatMap((m) => (m.files ?? []).map((f) => ({ ...f, from: m.role }))).slice(-MAX);
  const lines = await Promise.all(files.map(async (f) => `- ${f.name} (${f.type}, ${Math.ceil(f.size / 1024)} KB, ${f.from === 'user' ? 'attached by them' : 'made by you earlier'}): ${HUB}/api/chat/files/${f.id}?t=${await fileToken(f.id)}`));
  const out: string[] = [];
  if (lines.length) out.push('', '', 'FILES IN THIS CHAT (newest last; download with curl to read them):', ...lines);
  out.push('', '', canMakeGraphics
    ? 'GRAPHICS: allowed. This person is on the Social Media team: if they ask for an image, graphic or post visual, make it (see GRAPHICS in your instructions).'
    : 'GRAPHICS: not available for this person. If they ask for an image, say graphics are only available to the Social Media team.');
  if (canvaConnected) out.push('', 'CANVA: connected. This person connected their Canva account: if they ask for it in Canva (or editable in Canva), also put it in their Canva (see CANVA in your instructions).');
  return out.join('\n');
}

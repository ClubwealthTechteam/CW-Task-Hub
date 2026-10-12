// The Keap contact a person picked in a task's panel, shared with that task's chat (same page, same browser).

export interface ChatContact { id: number; name: string; email: string | null; tags: string[] }

export const CONTACT_EVENT = 'cw-keap-contact';
const key = (taskId: string) => `cw-contact:${taskId}`;

export function loadContact(taskId: string): ChatContact | null {
  try { return JSON.parse(localStorage.getItem(key(taskId)) || 'null'); } catch { return null; }
}

export function shareContact(taskId: string, contact: ChatContact | null) {
  try {
    if (contact) localStorage.setItem(key(taskId), JSON.stringify(contact));
    else localStorage.removeItem(key(taskId));
  } catch { /* private window: still shared below for this page */ }
  window.dispatchEvent(new CustomEvent(CONTACT_EVENT, { detail: { taskId, contact } }));
}

/** Server side: keeps only a small, well-formed contact from the request body. */
export function cleanContact(raw: unknown): ChatContact | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const id = Number(c.id);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return {
    id,
    name: String(c.name ?? '').slice(0, 120),
    email: c.email ? String(c.email).slice(0, 200) : null,
    tags: Array.isArray(c.tags) ? c.tags.slice(0, 60).map((t) => String(t).slice(0, 100)) : [],
  };
}

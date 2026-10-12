// Shared request builder for allowlisted REST actions (Keap, Buildium, and future built-ins).

import type { HttpMethod } from './keap/capabilities';

export class IntegrationError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) {
    super(message);
  }
}

export interface RestAction { method: HttpMethod; path: string }

/** Fills {placeholders} in the path from params, sends the rest as query (GET/DELETE) or JSON body. */
export async function callRest(base: string, action: RestAction, params: Record<string, unknown>, headers: Record<string, string>) {
  const rest = { ...params };
  const path = action.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = rest[key];
    delete rest[key];
    if (value === undefined || value === null || value === '') throw new IntegrationError(`Missing "${key}"`, 400);
    return encodeURIComponent(String(value));
  });

  const url = new URL(base + path);
  const init: RequestInit = { method: action.method, headers: { Accept: 'application/json', ...headers }, cache: 'no-store' };
  if (action.method === 'GET' || action.method === 'DELETE') {
    for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  } else {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(rest);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) throw new IntegrationError(`Request failed (${res.status})`, res.status, body);
  return body;
}

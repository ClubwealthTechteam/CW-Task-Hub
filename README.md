# CW AI Task Hub

The Club Wealth AI Task Hub: one web app where each admin team opens its department, runs its automations, and (for super admins) connects the tools those automations use. It is built to sit inside **CW University** later as a tab (web-extension page), so it is a standalone site that can be framed by `learning.clubwealth.com`.

Stack: **Next.js 14 (App Router) + TypeScript**, deployed on **Vercel**. No database is required to start; runtime data (custom integrations, run log) goes to Upstash Redis when connected.

## Departments and access

| Tab | People |
|---|---|
| Events | Ali, Andrea, Liz |
| Client Care | Jowee, Jizel, Joshua |
| Social Media | Jay Mar, JP |
| Admin | Kathleen, Amrissa, Camille |
| Tech *(admins only)* | Miguel, Omerson |

- Everyone sees **only their own department**. Opening another department's page, automation or API returns 404.
- **Super admins** (Miguel, Omerson, Camille) see every department, the hidden Tech tab, the run log and **Integrations**.
- People and roles live in `src/config/people.ts`; the rules live in one file, `src/lib/access.ts`.

## Automations

Every request from the **CW AI AUDIT** sheet (10 per person) is an automation, filed under its owner's department (`src/data/audit.json` → `src/data/automations.ts`). Each one lists the tools it needs (Keap, Sheets, ProspectBoss, Buildium, …) detected from the audit text.

- **Skeleton** (default): the page shows the request, recommendation and difficulty; **Show the plan** returns a dry-run of the steps and which tools still need connecting. Nothing is changed anywhere.
- **Live**: already runs elsewhere (e.g. the Half-Day attendance automation, run by a Claude routine + Zapier).
- To build one, add a handler for its id in `HANDLERS` in `src/lib/automations/runner.ts`. It receives the automation, the user's input and the signed-in person, and can call `keap.*`, `triggerZap()` or `callCustom()`.

Joshua and JP have no audit requests yet; their sections fill in once their data is added to `audit.json`.

## Integrations

- **Keap** (`src/lib/integrations/keap/`): a server-side client plus an allowlist of 38 actions covering contacts, tags (apply/remove: how most Keap automations start), campaigns and sequences, **API goals** (the cleanest shortcut into a Campaign Builder automation), email, notes, tasks, opportunities, orders, products, subscriptions, users and REST hooks. Super admins can try any action on the Integrations page. Needs `KEAP_API_KEY`.
- **Zapier** (`src/lib/integrations/zapier.ts`): starts a Zap by posting to its Catch Hook URL. Zaps are listed in `ZAPIER_HOOKS`.
- **Add an integration** (`src/lib/integrations/custom.ts`): super admins add any webhook or REST API in the app (name, URL, optional auth header and key). Keys stay on the server and are never sent back to the browser. Use it for Buildium, ProspectBoss, Make, n8n, etc.
- Planned integrations needed by the audit requests are listed on the page.

## Sign-in (temporary)

Until CW University or Google sign-in is connected, people pick their name and type a shared access code (`HUB_ACCESS_CODE`). The session is an HMAC-signed cookie (`SESSION_SECRET`). Switching to real logins only changes `src/lib/auth/` and `src/app/api/auth/`; pages and APIs read the user from `getCurrentUser()`.

## Project layout

```
src/
  config/        departments.ts, people.ts      ← who belongs where
  data/          audit.json, automations.ts     ← the automation catalog
  lib/
    access.ts                                  ← every permission rule
    auth/        session.ts, current-user.ts   ← signed cookie, page guards
    automations/ runner.ts                     ← dry-run plans, handlers, run log
    integrations/ registry.ts, types.ts, zapier.ts, custom.ts, keap/{client,capabilities}.ts
    store.ts                                   ← Upstash Redis or in-memory
  middleware.ts                                ← sign-in required everywhere except /login
  app/           pages (/, /d/[dept], /a/[id], /integrations, /login) and api/ routes
  components/    Header, shared bits
```

## Run locally

```
npm install
cp .env.example .env.local   # fill in SESSION_SECRET and HUB_ACCESS_CODE
npm run dev                  # http://localhost:3000
npm run typecheck && npm run build
```

## Deploy on Vercel

1. Vercel → **Add New → Project** → import this GitHub repo (framework: Next.js, defaults are fine).
2. **Environment Variables**: `SESSION_SECRET` (long random string), `HUB_ACCESS_CODE`, and when ready `KEAP_API_KEY`, `ZAPIER_HOOKS`, `ANTHROPIC_API_KEY`.
3. Optional: **Storage → Upstash for Redis** → connect to the project (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`) so added integrations and the run log persist.
4. Deploy.

## Putting it inside CW University

The site sends `Content-Security-Policy: frame-ancestors 'self' https://learning.clubwealth.com https://*.clubwealth.com` (change with `FRAME_ANCESTORS`), and the session cookie is `SameSite=None; Secure`, so it can be shown as an iframe on a CWU "AI Task Hub" page. Some browsers block cookies inside iframes from another site; the long-term fix is serving the hub from a `clubwealth.com` subdomain (e.g. `hub.clubwealth.com`) and moving sign-in to CWU single sign-on.

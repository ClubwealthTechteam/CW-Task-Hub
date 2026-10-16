# CW AI Task Hub

The Club Wealth AI Task Hub: one web app where each admin team opens its department, runs its automations, and (for super admins) connects the tools those automations use. It is built to sit inside **CW University** later as a tab (web-extension page), so it is a standalone site that can be framed by `learning.clubwealth.com`.

Stack: **Next.js 14 (App Router) + TypeScript**, deployed on **Vercel**. The backend is the `src/app/api/` routes, which run as server functions on Vercel: every call to Keap, Eventbrite, Zapier or a custom integration goes through them, so API keys stay on the server and access rules are checked before anything runs. No database is required to start; runtime data (custom integrations, run log) goes to Upstash Redis when connected.

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

Every request from the **CW AI AUDIT** sheet (10 per person) is an automation, filed under its owner's department (`src/data/audit.json` → `src/data/automations.ts`). Each one lists the tools it needs (Keap, Sheets, ProspectBoss, …) detected from the audit text.

- **Skeleton** (default): the page shows the request, recommendation and difficulty; **Show the plan** returns a dry-run of the steps and which tools still need connecting. Nothing is changed anywhere.
- **Live**: already runs elsewhere (e.g. the Half-Day attendance automation, run by a Claude routine + Zapier).
- To build one, add a handler for its id in `HANDLERS` in `src/lib/automations/runner.ts`. It receives the automation, the user's input and the signed-in person, and can call `keap.*`, `triggerZap()` or `callCustom()`.

Joshua and JP have no audit requests yet; their sections fill in once their data is added to `audit.json`.

## Integrations

- **Keap** (`src/lib/integrations/keap/`): Club Wealth's database and the source of truth for client data. **The hub is view-only for Keap**: `callKeap` refuses anything but GET, so nothing in Keap is created, changed, deleted, sent or started from here (writes are listed in the allowlist for later, but blocked until approved). Super admins browse everything in the **Keap** tab (contacts with tags/emails/notes/tasks/orders, tags, campaigns with goals and sequences, v2 automations, emails, sales, users, webhooks). Team members search contacts in their Keap tasks' panel. Before each assistant message, the hub reads the picked contact and any contact whose email is in the message and attaches it (`src/lib/chat/keap-context.ts`). Needs `KEAP_API_KEY` (a Service Account Key or Personal Access Token).
- **Eventbrite** (`src/lib/integrations/eventbrite/`): **view-only** with a private token (`EVENTBRITE_TOKEN`; `EVENTBRITE_ORG_ID` optional). The client refuses anything but GET. The **Eventbrite** tab (Events team and super admins) shows upcoming/past events, tickets sold, ticket types, attendees with check-in, and orders. For event questions, the assistant gets the upcoming events and tickets sold (`src/lib/chat/eventbrite-context.ts`).
- **Google Sheets** (`src/lib/integrations/google/sheets.ts`): **read-only** through a service account (`GOOGLE_SERVICE_ACCOUNT_JSON`, scope spreadsheets.readonly). A sheet is readable once it's shared with the service account's email as Viewer; My spreadsheets shows which ones the hub can read. The assistant gets the first rows of the sheets linked to the task being chatted about (`src/lib/chat/sheets-context.ts`). The service account is `cw-task-hub-reader@cw-ai-task-hub.iam.gserviceaccount.com` (Google Cloud project CW AI Task Hub, under marketingclubwealth@gmail.com). **Planned: writing to specific sheets.** Same service account; only sheets shared with it as Editor and ticked on an allow-list by a super admin, each write shown as a draft and run only after Approve, and logged.
- **EOD Report Submissions sheet** (`src/lib/eod/sheet.ts`, `src/lib/integrations/google/sheets-write.ts`): the one sheet the hub writes to (`EOD_SHEET_ID`, defaults to the EOD Report Submissions sheet), with the same service account shared as **Editor**. Each submit rewrites that person's tab (a row per task) and the All submissions tab (a row per report) from the hub's data, values written RAW. Writes to any other sheet are refused in code.
- **Zapier** (`src/lib/integrations/zapier.ts`): starts a Zap by posting to its Catch Hook URL. Zaps are listed in `ZAPIER_HOOKS`. Zaps also post updates into the hub's Zapier feed: Webhooks by Zapier → POST to `/api/zapier/inbox?key=<ZAPIER_INBOUND_SECRET>` (JSON fields `zap`, `event`, `summary`, plus any others). The **CW AI Hub: Zap errors** Zap (Zapier Manager → New Zap Error) sends every failed Zap there with `zap` = Title, `summary` = Message and `link` = Task History Link.
- **Add an integration** (`src/lib/integrations/custom.ts`): super admins add any webhook or REST API in the app (name, URL, optional auth header and key). Keys stay on the server and are never sent back to the browser. Use it for ProspectBoss, Make, n8n, etc.
- Planned integrations needed by the audit requests are listed on the page.

## Workflow Process Form → tasks

The hub reads the form's responses sheet live (`src/lib/forms/`; read-only, cached 5 minutes) and turns every process a person described into a task under **From my process form** in their workspace, with a build plan: each step marked *Reads*, *Drafts for you*, *Needs approval* (changes Keap or another system; off until approved) or *Assists*, plus their ideal version and how long it takes by hand. Test rows and repeat submissions are skipped. **My process forms** in the sidebar shows the submissions themselves. The assistant gets the plan when chatting in a form task.

## CW Assistant (chat bubble)

Every signed-in page shows a Messenger-style bubble in the bottom-right corner (`src/components/chat/ChatWidget.tsx`): open, maximize, minimize, start and remove chats. It uses no Anthropic API key. Each message fires the claude.ai routine **"CW Assistant → Task Hub chat replies"** (`src/lib/chat/routine.ts`) with the person's name, department, visible automations and recent conversation. Claude writes the reply in its own session and posts it to `/api/chat/reply` with a one-time HMAC token; the widget polls until it arrives. Chats are stored in Upstash (`src/lib/chat/store.ts`), so the assistant needs both `CLAUDE_CHAT_ROUTINE_TOKEN` and storage. `/api/health` shows whether each is switched on.

**Canva (Jay, Marketing Graphics).** Jay connects his Canva account in the Marketing Graphics chat (OAuth with PKCE, `src/lib/canva/client.ts`; tokens encrypted in the store). Graphics get **Send to Canva** (the PNG becomes a design), and when he asks for a graphic "in Canva" the routine renders a PDF with Liberation Sans and posts it to `/api/chat/reply/canva`, which imports it as an editable design; replies show **Open in Canva**. Needs `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET`; `CANVA_USERS` limits who can connect (default `jaymar`). The hub only creates designs; it never edits or deletes existing ones.

**Files and graphics (Social Media and super admins).** In a Social Media task chat, people attach PNG, JPEG or PDF files (paperclip, drag and drop, or paste; up to 4 MB, big photos are scaled down in the browser). Files are kept 30 days in the store (`src/lib/chat/files.ts`, chunked). The routine gets a signed link per file (`/api/chat/files/<id>?t=…`) and reads them; when asked for a graphic it designs it in HTML, renders a PNG with headless Chromium, uploads it to `/api/chat/reply/file` with the reply token, and lists the ids in its reply. Graphics show in the chat with a Download button.

## Sign-in (temporary)

Until CW University or Google sign-in is connected, people pick their name and type their own access code (`HUB_ACCESS_CODES`, a JSON map of person id → code set only in Vercel; five wrong codes lock that name for 15 minutes). The old shared `HUB_ACCESS_CODE` only works while `HUB_ACCESS_CODES` is unset. The session is an HMAC-signed cookie (`SESSION_SECRET`). Switching to real logins only changes `src/lib/auth/` and `src/app/api/auth/`; pages and APIs read the user from `getCurrentUser()`.

## Project layout

```
src/
  config/        departments.ts, people.ts      ← who belongs where
  data/          audit.json, automations.ts     ← the automation catalog
  lib/
    access.ts                                  ← every permission rule
    auth/        session.ts, current-user.ts   ← signed cookie, page guards
    automations/ runner.ts                     ← dry-run plans, handlers, run log
    integrations/ registry.ts, types.ts, http.ts, zapier.ts, custom.ts,
                  keap/{client,capabilities}.ts
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
3. **Storage → Upstash for Redis** → connect to the project with the prefix `KV` (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`) so chats, added integrations and the run log persist.
4. For CW Assistant: generate an API token on the routine "CW Assistant → Task Hub chat replies" (claude.ai/code → Routines) and add it as `CLAUDE_CHAT_ROUTINE_TOKEN`.
5. Deploy.

## Putting it inside CW University

The site sends `Content-Security-Policy: frame-ancestors 'self' https://learning.clubwealth.com https://*.clubwealth.com` (change with `FRAME_ANCESTORS`), and the session cookie is `SameSite=None; Secure`, so it can be shown as an iframe on a CWU "AI Task Hub" page. Some browsers block cookies inside iframes from another site; the long-term fix is serving the hub from a `clubwealth.com` subdomain (e.g. `hub.clubwealth.com`) and moving sign-in to CWU single sign-on.

## Before launch: SOP and tutorials

When the Task Hub is finished, write the user documentation before rolling it out to the team:

- **SOP: How to use the CW AI Task Hub.** Signing in with your own access code, your workspace and tasks, the task assistant and drafts (Approve / Edit / Shorter), the Keap contact panel, My spreadsheets, My process forms, the CW Assistant chat bubble, and what "Needs approval" means. Add a short section for super admins: the overview page, Integrations (Keap, Eventbrite, Zapier), approving spreadsheet accounts, and access codes.
- **Tutorials:** short step-by-step guides with screenshots for each main job (for example: sign in for the first time, work a task with the assistant, add a spreadsheet, look up a Keap contact, read your process form flowchart), plus an in-app guided tour like the Workflow Process Form's.
- Keep both in plain, non-technical language, and update them whenever a feature changes.

# CW Hub Council: setup

Six AI agents check the CW AI Task Hub every morning (about 6:15 AM Pacific) and report on the **Council**
page (super admins only): Bug & Integration Inspector, Accuracy Checker, Senior Developer & Systems Engineer,
Database Secretary, Compliance Guard and Strategist. They only read and advise; nothing in Keap or any other
system is changed, and the Secretary's clean-ups (hub data only) wait for a super admin to press **Apply**.

## How it works
- The hub starts the **"CW Hub Council (daily review of the Task Hub)"** Claude routine
  (`trig_01WpqBqC29kwsC4Lz4HcyXUz`) with a run token that expires after 3 hours.
- The routine reads `/api/council/snapshot` (integration checks, errors, the assistant's record, recent chats,
  samples to fact-check, the data inventory; settings are listed only as present or missing, never their values),
  may look up clients in Keap read-only via `/api/council/keap`, and may clone the repo read-only to run the
  type check, build and audit. It posts one report to `/api/council/report`.
- A daily Vercel cron (`vercel.json`) calls `/api/council/run`; super admins can also press **Run the council now**.
- If the latest report has a problem, super admins see a banner on the home page.

## Switch it on (about 5 minutes)
1. In **claude.ai → Routines**, open **CW Hub Council (daily review of the Task Hub)** and create an **API token**
   for it (the same way as the CW Assistant routine's token). Keep it private.
2. In Vercel → cw-ai-task-hub → **Settings → Environment Variables**, add as **Secret** (Production):
   - `CLAUDE_COUNCIL_ROUTINE_TOKEN` = that token
   - `CRON_SECRET` = any long random text (Vercel sends it with the daily cron)
3. Redeploy, open **Council** in the top bar and press **Run the council now**. The first report takes 5–15 minutes.

# Canva setup (Jay · Marketing Graphics)

Lets Jay connect a Canva account to the CW AI Task Hub so the assistant can put designs into Canva.
Only Jay can use it (`CANVA_USERS`, default `jaymar`), and only in the **Marketing Graphics** task.

## 1. Create the Canva integration (about 10 minutes)
Do this signed in with the Canva account the designs should go to (Jay's own, or the company account).
According to Canva's docs, the account that creates the integration can connect it right away with no
Canva review; other accounts would need Canva's review or Canva Enterprise.

1. Go to **canva.dev** → **Your integrations** → **Create an integration**.
2. Turn on the **REST APIs** and tick these scopes:
   `asset:read`, `asset:write`, `design:content:read`, `design:content:write`, `design:meta:read`, `profile:read`
3. Under **Redirect URLs**, add:
   `https://cw-ai-task-hub.vercel.app/api/canva/callback`
4. Generate a **client secret**. Keep it private; don't paste it in chat.

## 2. Add the keys in Vercel
In the cw-ai-task-hub project → **Settings → Environment Variables**, add as **Secret** (Production and Preview):

| Key | Value |
|---|---|
| `CANVA_CLIENT_ID` | the Client ID from step 1 |
| `CANVA_CLIENT_SECRET` | the client secret from step 1 |

Then redeploy (or ask Claude to deploy and check it). `/api/health` shows `"canva": true` once the keys are in.

## 3. Connect
Jay opens **Social Media → Content Creation tabs → Marketing Graphics** and clicks **Connect Canva** at the top
of the chat, signs in to Canva and approves.

## What it does once connected
- **Send to Canva** on any graphic in that chat → the image becomes a design in Jay's Canva, with an **Open in Canva** button.
- Asking for a graphic **"in Canva"** → the assistant makes the normal PNG and an editable Canva version (real text Jay can change).
- The hub only creates designs; it never edits or deletes anything already in Canva. **Disconnect** at the top of the chat removes access.

# Canva setup (Jay, Andrea and Liz)

Lets Jay, Andrea and Liz connect a Canva account to the CW AI Task Hub so the assistant can put designs into Canva.
Allowed people: `CANVA_USERS` (default `jaymar,andrea,liz`). Jay sees it in the **Marketing Graphics** task; Andrea and Liz in all of their Events tasks (Andrea's **Canva Edit** task has edit templates).

## 1. Create the Canva integration (about 10 minutes)
Do this signed in with the **company Canva account** (the one the designs should go to).
Until Canva reviews an integration, only the account that created it can connect, so Jay, Andrea and Liz
all connect with that same company account (their designs land there, in one shared place). Letting each
person use their own Canva account would need Canva's review (a public integration) or Canva Enterprise.

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

## 3. Connect (each person, once)
- **Jay:** Social Media → Content Creation tabs → **Marketing Graphics** → **Connect Canva** at the top of the chat.
- **Andrea:** Events → **Canva Edit** (or any of her tasks) → **Connect Canva**.
- **Liz:** Events → any of her tasks → **Connect Canva**.

Each signs in to the company Canva account and clicks **Allow**. The bar then says "Canva connected".

## What it does once connected
- **Send to Canva** on any graphic in that chat → the image becomes a design in the connected Canva, with an **Open in Canva** button.
- Asking for a graphic **"in Canva"** → the assistant makes the normal PNG and an editable Canva version (real text they can change).
- The hub only creates designs; it never edits or deletes anything already in Canva. **Disconnect** at the top of the chat removes access.

# Push server

A small Cloudflare Worker that sends Lift & Lap notifications: workout reminders on training days and milestone notifications. It runs on Cloudflare's free plan.

## How it works

- **The app**
  - When you turn notifications on (Settings → Notifications on an iPhone, with the app opened from the Home Screen), the app subscribes to Web Push.
  - It sends this server the subscription, your time zone and reminder time, and the next four weeks of your plan.
  - It re-sends whenever you open it or finish a session, so finished days are skipped and the plan stays current.
- **The server**
  - One Durable Object keeps that and sets an alarm for the next reminder.
  - At the alarm it encrypts the message (RFC 8291) and posts it to Apple's push service, signed with its VAPID key (RFC 8292).
  - After the synced plan runs out it falls back to your weekly schedule.
  - Milestones are sent straight away.
- **Keys:** the VAPID keys are generated on first use and stored in the Durable Object. There are no secrets to manage on the server.

Endpoints, all from the app's origin only:
- `GET /vapid`
- `POST /sync`
- `POST /notify`
- `POST /unsubscribe`

## One-time setup

1. **Create a free Cloudflare account** at dash.cloudflare.com, and open **Workers & Pages** once.
2. **Create an API token.**
   - Go to **My Profile → API Tokens → Create Token**.
   - Use the **Edit Cloudflare Workers** template. Account resources: your account. Zone resources: All zones.
   - Create the token and copy it.
3. **Copy your account ID.** It's in the Workers & Pages sidebar, or in the dashboard URL.
4. **Add two GitHub secrets.** In this repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. **Deploy.** Run **Actions → Push server → Run workflow**.
   - It also deploys on every push to `main` that changes `server/`.
   - The run summary shows the address, `https://liftlap-push.<your-subdomain>.workers.dev`.
6. **Point the app at it.** Put that address in `PUSH_URL` in `js/notify.js`.

## Developing

- **Tests:** `node --test tests/push.test.mjs` covers:
  - encryption, checked against the RFC 8291 example;
  - VAPID;
  - time zones and daylight saving;
  - the hub with a fake push service.
- **Local run:** `npx wrangler dev` in this folder runs it in Cloudflare's own runtime, with no account needed.

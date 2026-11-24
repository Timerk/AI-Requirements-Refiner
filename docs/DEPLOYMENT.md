# Deploying the public demo

This guide takes the app from a fresh fork to a public Vercel deployment. Demo mode works from the first deploy. Live mode starts only after you add the OpenAI key and Redis. Every step that creates an account or enters a secret is done by you in the provider's dashboard. Nothing in this repository creates accounts or stores secrets.

Dashboard menus change over time. If a label below doesn't match, look for the closest equivalent.

## 0. Before you start

- CI is green on `main` (lint, typecheck, unit tests, build, Playwright demo flow).
- You have accounts on [Vercel](https://vercel.com), [Upstash](https://upstash.com), and the [OpenAI platform](https://platform.openai.com). The free tiers of Vercel and Upstash are enough.

## 1. Deploy in demo-only mode first

1. In Vercel, choose **Add New → Project** and import `Timerk/AI-Requirements-Refiner`. Framework preset: Next.js. Keep the default build settings.
2. Under **Environment Variables**, add only `DEMO_ONLY` = `true` for Production and Preview.
3. Deploy.
4. Open the deployment URL and check:
   - "Recorded example" is selected and **Live with Luna** shows "Switched off on this deployment".
   - Each of the three examples completes to the specification screen, and every screen shows the **Recorded example** label.
   - In the browser dev tools Network tab, `/api/analyze` and `/api/specification` return `source: "recorded"`.

The site is now safe to share: no request can reach OpenAI.

## 2. Create the Redis database (Upstash)

1. In the Upstash console, create a **Redis** database. Pick the region closest to your Vercel function region (default `iad1`, US East). The free plan is enough.
2. Open the database's **REST API** section and copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Alternatively, add Upstash for Redis from Vercel's **Storage / Marketplace** tab. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which the app also accepts. If the injected names differ, set the two `UPSTASH_*` variables yourself.

The token grants write access to the database. Keep it only in Vercel's environment variables.

## 3. Cap spending in OpenAI

Do this **before** adding the key to Vercel.

1. Create a dedicated **project** (for example "refiner-public-demo") so its usage and limits are separate from your other work.
2. In that project, create an API key. If your account offers restricted permissions, allow only the Responses API ("Model capabilities") and confirm `gpt-6-luna` is available to the project.
3. Set a **monthly budget** for the project, for example **$5**, and an **email alert** at a lower threshold, for example $3. You'll find both in the project's limits settings or in Organization → Billing → Limits.
4. Check whether your budget **blocks** requests once reached or only **notifies** you. If it only notifies, make prepaid credits the hard cap: buy a small credit balance (for example $5) and turn **auto-recharge off**.
5. Optional: turn on usage notifications so you see unusual spend early.

With the defaults (30 hosted runs per day, five calls each), the code allows at most 150 hosted calls per day. The budget is the backstop if anything in the code-level limits fails.

## 4. Add the live-mode environment variables

In Vercel → Project → **Settings → Environment Variables**, set these for **Production**. Leave Preview on `DEMO_ONLY=true` unless you deliberately want live previews.

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | The project key from step 3 |
| `UPSTASH_REDIS_REST_URL` | From step 2 |
| `UPSTASH_REDIS_REST_TOKEN` | From step 2 (mark it **Sensitive**) |
| `LIVE_RUNS_PER_IP_PER_DAY` | `3` |
| `LIVE_RUNS_GLOBAL_PER_DAY` | `30` |
| `DEMO_ONLY` | `false` |

Mark `OPENAI_API_KEY` as **Sensitive** too. Never add a `NEXT_PUBLIC_` prefix to any of these.

Then **redeploy** (Deployments → latest → Redeploy). Vercel applies changed variables only to new deployments.

## 5. Confirm bot protection

BotID is already wired in (`instrumentation-client.ts`, `next.config.ts`, and `checkBotId()` on the server), and basic mode needs no dashboard setup. Deep Analysis, under **Firewall**, is optional and depends on your plan.

To check it: open the site in a normal browser and run one live analysis, as in step 6. Then confirm that a scripted request without the browser challenge is refused:

```sh
curl -s -X POST https://<your-project>.vercel.app/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"description":"A request without the browser check.","complexity":"prototype","mode":"live"}'
```

Expected: HTTP 403 with `"code":"bot_detected"`, or 503 with `"code":"verification_unavailable"`. Either way, no paid call is made.

## 6. Verify demo mode and one live run

1. Open the site in a private window. Demo mode is the default, and the recorded walkthrough still works.
2. Choose **Live with Luna**. Leave the key field empty and enter a small idea, such as "A local reading list for my books."
3. Answer the required questions and generate the specification. Expect a few minutes and five OpenAI calls. The screens should show **Live output**.
4. In the Upstash data browser, you should see keys under `refiner:live` (hashed visitor IDs, no IP addresses).
5. In OpenAI → Usage for the project, the calls appear shortly afterwards.
6. Optional limit check: temporarily set `LIVE_RUNS_PER_IP_PER_DAY=1`, redeploy, and start a second live run. You should see the "You have used today's 1 free live runs" message and land back on the recorded examples. Then restore `3`.

If something fails, the error shows a request ID. Match it to `[refiner:api]` lines in Vercel → Logs.

## 7. Turn live mode off (kill switch)

Set `DEMO_ONLY=true` and redeploy. This stops every paid call, including runs with a visitor's own key, and the UI marks live mode as switched off. To stop spending immediately, before the redeploy finishes, revoke the OpenAI project key.

## 8. Publish the link

Replace the "Live demo" placeholder at the top of the README with the production URL.

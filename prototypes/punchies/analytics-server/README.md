# Punchies Beta analytics deployment

Source baseline: released Beta9f992a0 (POLSIA/punchies-beta-test,141026r0159). Dedicated Worker name and D1 database: `punchies-beta-analytics`; binding `DB`. Report secret: `REPORT_TOKEN`. Do not reuse or edit the rating Worker.

1. On the already-approved free Cloudflare account, create the D1 database once with existing Wrangler4.143.0. Read the returned database UUID and replace only `BUILD_MUST_BIND_CREATED_D1_ID` in this config. Existing GitHub secrets are CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID. Do not print credential values.
2. Apply migrations remotely with `wrangler d1 migrations apply punchies-beta-analytics --remote --config prototypes/punchies/analytics-server/wrangler.jsonc`.
3. Deploy using the same config. Install a cryptographically random report token with `wrangler secret put REPORT_TOKEN --config prototypes/punchies/analytics-server/wrangler.jsonc`; use a secret store or interactive input, never chat, command arguments, URLs or repository files. The deployment workflow is manual-dispatch only and reuses the rating workflow tooling; it runs tests, migrations and deployment, but secret setup remains Build-owned.
4. Verify the Worker /health URL and strict event CORS/schema. Expected endpoint on the existing workers.dev subdomain: `https://punchies-beta-analytics.tianz-88.workers.dev/v1/events` (verify actual deployment URL before setting the build).
5. Set public build env `VITE_PUNCHIES_ANALYTICS_URL` to that complete /v1/events URL only for the itchbeta package. Build and publish once with the new dummy portrait820142e. No new reset, no Master/CG release. Check those compiled bundles contain no collector endpoint and make zero collector requests.
6. In actual itch iframe, test default collection after boot, SettingsOFF +reload, DNT, and `?noanalytics=1` on the embed GAME URL. Do not claim top-level itch URL query propagation. Publish the owner-approved corrected notice mentioning Settings/game URL, preserving other page copy.

Example synthetic POST (no auth required; avoid leaving test rows in production reports unless explicitly marked test build):

```sh
curl -i -X POST "$ANALYTICS_ENDPOINT/v1/events" -H 'Origin: http://localhost:5310' -H 'Content-Type: text/plain' --data '{"v":1,"edition":"itchbeta","build":"141026r0000","sid":"00000000-0000-4000-8000-000000000001","pid":"00000000-0000-4000-8000-000000000002","events":[{"n":1,"t":0,"e":"boot_done","p":{"load":"fast","input":"desktop","viewport":"medium"}}]}'
```

`ANALYTICS_ENDPOINT` above is the Worker origin, not the /v1/events URL. Use a verified secret-store HTTP client to call GET /v1/funnel?days=7 with Authorization Bearer REPORT_TOKEN; never include the token in a URL, echo it, or pass it on a visible shell command line. Report JSON exposes aggregate step reach/drop-off, last-gameplay-event counts and next-day return counts, not IDs or event props.

Limits:50events/8192bytes per batch;500perload;5000perUTCday. Dropped cap excess returns200 silently. This caps normal D1 index/trigger writes conservatively under the free write quota, but cannot guarantee availability against malicious endpoint traffic. No IP-based rate limiter or stored IP/UA. Transactions plus triggers enforce accepted event caps atomically. Hourly deletion uses a server60-day cutoff on received_at and removes associated expired sessions and daily counters.

Run:
- `node scripts/test-punchies-beta-analytics.mjs` (real built-in SQLite, no new dependency)
- `node scripts/test-punchies-beta-analytics-editions.mjs` (compiled Master/CG zero collector side effects)
- `node scripts/test-punchies-beta.mjs`
- `node scripts/test-punchies-beta-callers.mjs`
- `node scripts/test-punchies-reward-reveal.mjs`
- `node scripts/test-punchies-first-fight.mjs`
- `node scripts/test-punchies-online-bo3.mjs`
- `node scripts/test-punchies-i18n.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`

No live Cloudflare migration/deployment, production report token, physical controller/iOS, or real two-device match is claimed by these local checks. Build supplies release/live receipts.

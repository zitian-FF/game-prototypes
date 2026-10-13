# Ranked online rating contract

Elo applies only to the explicit Ranked mode. Casual/private Online does not load/register a rating identity, create a rated match, report/poll a result, or settle quits/rematches. Ranked initially uses private Trystero room pairing; no global queue is claimed.
No global queue, ranks, seasons, leaderboard, accounts or replay verification.
Survival is separate (PR339) and never reports to this service.

## Pair and settle

Anonymous identity and bearer token persist through registered portal storage under
`punchies:rating:v1`, alongside retryable result reports. Never send the token
to peers or analytics. The Worker is authoritative for points and match counts.

Both peers exchange validated ID/points in hello. The host gives simultaneous
guests a 150 ms collection window and chooses the closest rating; a selected
guest waits for the host's paired message. This is a preference within a room,
not a global search. Guests without rating can still play, without rated results.

Host issues a fresh UUID nonce on character confirmation and each completed-set
rematch; it is retained across Bo3 rounds. Both clients create the same match
on sorted IDs + nonce. Session-level ratingSet handling survives scene transitions.
One completed set awards one result, not one per round. Results reporting captures
its current match promise before any later rematch can replace it, and continues
after presentation shuts down. Explicit mid-set Menu exit reports own quit/loss.

The SQLite Durable Object serializes settlement and transfers once. Two matching
reports settle (win/loss or draw/draw). Self-attested quit can settle one's own
loss. Missing, disconnected or disputed results expire after ten minutes without
points. A report is immutable; repeat submissions cannot move points again.
The client saves an unsent report before transport, retries it on status/load,
removes terminal reports, and never converts a network error into a pending claim.

Owner-approved math: initial1000, floor0; K40 first10 matches, then24, K16 above1400.
Use max participant K symmetrically. Farm factor1 for gap<=100, linear to.1 at300,
then.1. Expected score uses standard400 denominator. Round one transfer and apply
its exact negative, capped by the payer's balance. Draw result is.5.

Known accepted limits: agreed fake results can move points; disconnecting without
a self-quit is not penalized. Anonymous storage reset loses the identity. No extra
access rules or anti-cheat promises have been added.

## Art bindings and availability

`src/net/rating.ts`:

- `ratingConfigured():boolean` indicates whether a build has a service URL.
- `ratingServiceState()` / `onRatingState(listener)->unsubscribe`: status
  unconfigured, loading, error, or ready with rating/matches.
- `loadRating()->Promise<RatingIdentity|null>` registers or authenticates and
  retries saved reports. `currentRating()` is null unless state is ready.
- `createRatingMatch(opponentId,nonce)->Promise<string|null>`.
- `reportRating(matchId,score,quit=false)` / `ratingStatus(matchId)` return
  `{state:pending|settled|expired,rating,matches,delta}` or null for failure.
- `flushRatingReports()` retries unchanged claims; never print identities/tokens.

Use loading/ready/unavailable text in Lobby. Result null is unavailable/error,
not pending. Pending means service accepted a report and awaits settlement.
Settled shows signed delta and points; expired means no rating awarded. Polling
stops on settlement, expiry and scene shutdown; avoid overlapping requests.
Art owns final bounded, non-button status presentation and placement.

## Build/deployment handoff

No live service is claimed by this branch. Original brief requires owner plan
approval before deployment. Main/Build handle approval, merge and release.

Worker: `server/wrangler.jsonc`, SQLite RATINGS binding, migrationv1;
compatibility2026-10-03 matches pinned Wrangler4.143.0. Workflow
`deploy-punchies-rating.yml` uses existing CLOUDFLARE_API_TOKEN/ACCOUNT_ID secrets.
No secrets in source. Use explicit config path from repo root.

After approved Worker deployment, set repository variable PUNCHIES_RATING_URL to
the actual returned HTTPS Worker URL; WIP and profile builds pass it as
VITE_PUNCHIES_RATING_URL. Rebuild clients after setting it. An unset URL leaves
normal room play available but ratings unavailable. Do not claim live from local
runtime tests. Origin allowlist covers current itch.io/itch.zone, CrazyGames,
prototype GitHub Pages and local development. Check actual iframe origin in the
approved deployed smoke before changing this list.

## Reproduce tests

From repository root:

```
node scripts/test-punchies-rating.mjs
node scripts/test-punchies-rating-session.mjs
node scripts/test-punchies-series.mjs
npm run typecheck
npm run build
npx --yes wrangler@4.143.0 dev --config prototypes/punchies/server/wrangler.jsonc --local --port 5188 --persist-to .local/rating-worker
```

Then `node scripts/test-punchies-rating-runtime.mjs` against real local workerd.
This creates disposable test identities/results, never production data.
PUNCHIES_RATING_TEST_URL may target a specifically approved staging service.
In a second terminal set VITE_PUNCHIES_RATING_URL=http://127.0.0.1:5188 and run Vite
on5189. Brave pages: `/game-prototypes/tools/rating-review.html` (actual Lobby),
`/game-prototypes/tools/rating-flow-review.html` (actual client/Worker endpoints).

Verified: Node SQLite tests use the real Worker handler and real client module,
with mocked transport failure and Trystero pairing. Local Wrangler tests use the
actual workerd SQLite Durable Object. Brave showed Lobby1000, unilateral result
pending1000, agreed result1020 (+20), and1020 after Worker/browser restart; no
console errors. One existing Nostr relay emitted rate-limit/banned warnings during
the Lobby wait; a complete live two-peer fight remains a release smoke requirement.

## Ranked-only mode contract (owner correction, 2026-10-11)
- Menu calls Lobby with `{role,code,rated:true}` only for Ranked; absent/false means Casual. `new NetSession(code,role,ice,rated=false)` exposes readonly `session.rated`, which persists through CharSelect, Match and rematch.
- Casual uses the existing `room-CODE` relay namespace. Ranked uses `ranked-room-CODE`. Both hello and paired validate the explicit mode; legacy packets default to Casual. Casual discards rating payloads and ignores ratingSet. Mixed modes cannot pair or promote an existing casual room into Ranked.
- Ranked hello alone calls loadRating; beginRating/report are session-gated. CharSelect sends rated and a nonce only for Ranked, validates mode before applying host tuning, and Match suppresses all rating UI, reporting, polling and rematch nonce generation for Casual.
- `roomUrl(code,rated)` includes `ranked=1` only for Ranked; ArtBoot carries that flag into the guest Lobby so QR joins retain mode.
- Existing stored points are retained; no migration/reset. Previously settled private-room results are historical and are not reversed.
- Actual production Worker: https://punchies-rating.tianz-88.workers.dev, configured in release 143. This correction does not change or redeploy the Worker.
- Automated session tests verify zero Casual registration/match/report calls (including legacy and existing spoofed rating payloads), quit/rematch gating, mode mismatch and Ranked nonce/settlement. Series tests exercise the actual Match method with no Casual rating UI/API dependencies.
- Brave actual Lobby QA (`tools/ranked-lobby-review.html`) records rating endpoint requests while leaving fetch unchanged: fresh Casual zero requests/no points; Ranked /register and 1000 points from the live Worker; returning Casual no additional requests/no points. Evidence outputs/ranked-survival-fixes/{casual-no-rating-requests,ranked-live-points,casual-after-ranked-no-new-requests}.png. This is actual Lobby/client with no fake settlement, but does not claim a full Ranked knockout/rematch browser match.

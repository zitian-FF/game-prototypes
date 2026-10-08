# Punchies ranked play proposal

Draft for discussion, 8 October 2026. No ranked backend or rating changes are implemented.

## Recommended first release

One ranked queue: best of three, first to two wins. One account rating across owned fighters. Skins change portrait and rig only; they never change combat statistics. New fighters can have different stat tradeoffs, but MMR cannot make an overpowered fighter fair: character balance must be measured independently.

Use outcome-only Elo for the first ranked prototype, with a provisional flag and faster placement updates. This fits short 1v1 sets and is easy to audit. Re-evaluate uncertainty-aware Glicko-2 after collecting match volume. Glickman's specification tracks rating, deviation and volatility and notes that Glicko-2 works best with roughly 10–15 games per player per rating period; that is a reason to avoid pretending a tiny queue has reliable confidence estimates. [Glicko-2 specification](https://www.glicko.net/glicko/glicko2.pdf).

## Proposed rating rules (all numbers pending playtests)

- Start hidden MMR at 1500; show “Placement · N/10” for the first ten completed sets.
- Expected score: E = 1 / (1 + 10^((opponent rating − your rating)/400)).
- Set score is 1 for a win, 0 for a loss, and 0.5 for a completed drawn set if such an outcome is later supported. Round draws within Bo3 replay and do not update rating.
- Change = K × (score − E). Use symmetric K=48 when either participant is provisional, otherwise K=24. Update both players from their pre-set ratings in the same transaction, preserving zero-sum changes. Store decimals; round for display only.
- Equal settled players move ±12. A 1500 player against 1700 has expected score about .240: winning earns about +18.23; losing costs about −5.77. No HP-margin, KO-speed, punch accuracy or skin/ownership multipliers.
- One rating update per completed set, never per round. Rematches are separate signed match IDs. Bots, training, local versus and private friend matches are unrated.
- Later inactivity can make a player provisional again without erasing their rating. Do not silently lower MMR just because someone stopped playing.

An uncertainty-aware option remains worth considering: Microsoft’s TrueSkill tracks a skill estimate and uncertainty. This is a reference for the tradeoff, not a recommendation to copy a licensed implementation. [Microsoft Research](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/).

## Matchmaking and connection quality

Start with the nearest compatible region and the same protocol/tune/catalog versions. Proposed rating window ±100, widening by 50 every ten seconds to a cap of ±400. Never quietly replace a ranked opponent with a bot. Offer “Keep waiting” or “Play casual” when the queue is small. Connection quality is a constraint before MMR proximity; numeric latency thresholds require measurement.

Initially keep ranks derived from rating rather than a separate grind currency. Rank names and thresholds need population data; do not commit a Bronze-to-Champion ladder today. Display rating changes after a set and explain provisional status.

## Disconnects, forfeits and disputed outcomes

- Server-authenticated forfeits lose the set. Offer a proposed ten-second reconnect grace period; the authoritative simulation continues from the last acknowledged input with neutral input for the absent player. Never create a fresh fighter or reset stamina on reconnect.
- During the portrait showcase, a lost connection cancels the start after grace, without a rating update, because combat has not begun. Track repeated start cancellations separately to prevent queue disruption.
- Once a set starts, failure to return within grace is a forfeit. If both disconnect or the server fails, mark the set unresolved and do not invent a winner.
- Desyncs, invalid input streams or unsupported versions end as a reviewable technical failure, not an automatic accusation against either player. Keep bounded replay evidence.
- Match ID and settlement ID are unique. Retry, duplicate result packets and restarted processes must never settle a set twice. An accepted settlement is immutable; corrections are separate auditable adjustments.

## Backend required before this can be fair

The current peer-to-peer rollback clients are not an authority for ranked results. A hostile browser can claim any winner, wallet balance or unlock. Do not enable ranked merely by uploading a client MMR number.

Recommended architecture: an authenticated Worker API, one coordinator per ranked room, an authoritative validation/simulation process for each set, and transactional durable storage for account inventory and rating settlement. Cloudflare Durable Objects provide per-room coordination and WebSockets; hibernation is suitable for idle queue/lobby sockets, not a continuously ticking active simulation. Validate active-match CPU, latency and replay costs before choosing it for the live fight loop. [Cloudflare WebSocket documentation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

Store: account ID, rating/provisional state, owned fighters/skins, catalog version, queue region; match participants, selected fighter/skin, ruleset hash, per-round outcome, reason, replay/input references; settlement IDs and rating deltas. A central settlement coordinator or transactional database must update both accounts atomically. Two independent per-player writes are insufficient.

Account/session design must work in the itch iframe and survive browser storage restrictions. Guest progress can remain local for casual previews; ranked identity and real rewards need recoverable accounts. Decide the account provider before implementing auth. No services, secrets or billing changes are made in this proposal.

## Leaderboard

Show a seasonal ranked board with player display name, rating, rank and current fighter/skin icon. Require ten completed sets for eligibility. Paginate server-side; return top entries and an “Around you” slice. Hide account identifiers and all inventory/ad history. Ties use rating, then the earlier time reaching that rating; do not reward simply playing more matches.

Initial board can be global with region filtering. Treat seasons as snapshots first; avoid hard resets while the population is small. Display last updated time and use a short server cache. Handle banned/withdrawn accounts without exposing private moderation reasons.

## Fairness and shop relationship

Owned fighters and skins can be required for ranked, as requested, but the welcome fourth fighter should not be stronger than the starting cast. Track win rate by fighter, rating band, matchup, mirror matches and account experience. Compare equal-skill cohorts before tuning. MMR equalizes expected win rates for players; it does not erase an advantage within a match.

Prefer no duplicate pulls until the pool is exhausted. A finite unlock path makes “watch more ads and eventually own it” credible. If duplicates are retained, design conversion and a guarantee explicitly before release. Show exact costs, pool contents and real odds once the pool exists. The welcome pull must be described as a guaranteed fourth fighter, not random.

## Suggested implementation order

1. Confirm account identity, ownership rules, duplicate policy and fighter balance criteria.
2. Build server-verified inventory and idempotent match results in unranked private tests.
3. Validate a single authoritative Bo3 room, reconnects, result replay and version mismatches.
4. Shadow-rate real matches without showing ranks; audit calibration and technical failure rate.
5. Launch ranked with placement labels and a small leaderboard; tune queue widening from observed traffic.

## Decisions for tomorrow

Do we accept outcome-only Elo for the first prototype? Should regular pulls exclude duplicates? What are the fourth fighter’s identity and distinct but balanced playstyle? What costs and daily ad cap produce a realistic unlock timeline? Which account/login experience is acceptable? No implementation beyond the local shop draft should start until these are agreed.

# Simulation compatibility gate and Worker rollout

The relay APP_ID stays unchanged. Modern clients require protocol2 plus the same semantic simulation revision/hash in HELLO and PAIRED before readiness. Missing or mismatched stamps are rejected with localized `online.rules_mismatch`; legacy aliases/profiles can still use defaults, but legacy missing-rules clients are not accepted as compatible.

`net/rules.ts` hashes the semantic revision, sorted fighter registry and simulation-only SUPER config. Name/description keys, UI commits and artwork are excluded. Changing simulation algorithms requires a reviewed revision bump; changing mechanics/timing/config or registry changes the fingerprint. This is compatibility metadata, not proof of trusted client execution or an anti-cheat system.

START requires the same rules, a canonical hash of the actual host tune snapshot, valid settings, roster IDs, round/delay and ranked nonce. Guest local tuning is not compared to host tuning; the validated host snapshot is applied by the existing sync flow. Pairing alone cannot mark a game started. Inputs/hashes are not delivered before a compatible START; repeated compatible rematch readiness is two-sided, and cannot create another rating reservation twice.

Rating creation is deferred until compatible START/readiness. A future ratingSet nonce does not stop input delivery for a still-finishing previous round. The previous MatchScene captures its own rating promise, preventing a fast rematch from overwriting the prior result's match ID. Quitting before a new match starts creates no loss report. The existing actual-started Bo3 rating can still be forfeited between its rounds.

## Worker protocol2 dependency

Deploy the Worker migration BEFORE enabling the new ranked frontend. New clients require protocol2 and matching rules acknowledgement; an old Worker response causes an incompatible result and best-effort ticket cancellation, never a guessed compatible pairing.

The migration adds a rules column to queue tickets/pairs and matches, defaulting existing rows to legacy. New clients pair only with identical fingerprints; old clients remain in a separate legacy cohort. /match binds supplied rules to the authenticated pair. /report binds supplied rules to the persisted match, rejecting missing or forged different rules for modern matches. Existing legacy requests remain valid for legacy matches. /status remains an authenticated participant read. Pending legacy reports retain their old missing-rules marker rather than being relabeled as modern.

Authenticated /queue/cancel-pair releases a reservation only for its participant and exact rules, and only when no match with the reservation nonce exists. Cleanup is transactional, removes both queue reservations/baseline/pair and changes no rating. Active/settled rating records are not deleted. The implementation does not directly deploy Worker or frontend.

Dependencies: approved authoritative pairing/settlement snapshots dddecf0, CODE X core8d150e9 and the already-approved legacy fixture corrections. Apply the narrow gate commit on top of those merged sources; recompute locale coverage from the actual combined branch (title/shop branches retire old strings). The new rejection key is translated in six local JSON files; native Sheet alignment belongs to this CODE X staging batch, not the shop-only hotfix.

Validation: mixed/missing rules cannot pair/start or leak input/rating/forfeit events; host tuning differences are legal; malformed STARTs reject; no API rating before readiness; old Worker responses reject and clean tickets; SQLite migration is idempotent; rules cohorts stay distinct; missing/wrong match/report rules reject with no Elo changes; pre-match cleanup creates no loss; same-rules settlement, rematch and ordinary online/casual flows pass. CODE X replay/rollback, UI input, roster, ranked lobby/session/snapshot, series, strict localization and TypeScript checks pass. Staging integration must still verify both matching and mixed build clients against the deployed Worker; no browser/controller certification is claimed here.

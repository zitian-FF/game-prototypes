# Punchies owner-triggered build workflow

Effective 2026-10-13; supersedes prior automatic staging publication and automatic PR merge guidance for this project.

- Prepare edits and run focused checks without publishing. Collect one READY batch.
- Merge and deploy only when the owner explicitly triggers that batch. Main may queue work but cannot substitute a new trigger. Use one integration/release job; do not create follow-on releases automatically.
- Previously completed uploads remain recorded. Do not destructively cancel or roll back completed work when the policy changes.
- Reuse prepared asset archives and hashes. Asset compression is permitted only after the measured complete package exceeds 80% of its applicable cap: compact >16,000,000 bytes of 20,000,000; standard >32,000,000 bytes of 40,000,000.
- At or below those thresholds, do not re-encode or lower asset quality. Normal compilation, code minification, packaging and safety checks remain required.
- For an over-threshold content revision, perform one compression pass and cache by asset hash. Repeat only when new measured size or changed assets justify it.
- Preflight exact commands and Node22 once. Reuse passed evidence when the exact relevant source/contracts are unchanged; test affected behavior and capture one boot.
- Every receipt records available phase timing from existing logs: preparation/tests, assets/cache/compression, compile, browser, CI queue/run/retries, deployment/upload and coordination. Label estimates and unmeasured values; do not launch benchmarks to fill gaps.

Current hold: PR377 is ready for the parity runner dependency fix and Node22 alignment; it is OPEN with no auto-merge. No release job should be dispatched until the next explicit owner trigger. Stage182693b and production r0155 were already published before the hold took effect.

# Punchies owner-triggered build workflow

Effective 2026-10-13; supersedes prior automatic staging publication and automatic PR merge guidance for this project.

- Main owns requirements and resolves discussion or ambiguity with the owner, then sends executable scoped tasks.
- Specialists persist until their assigned task is finished and notify Main once DONE with source SHA, asset references, checks and limits. Partial work is not DONE; do not repeat stale setup.
- Each specialist owns a persistent ordered execution queue with active, queued, done and blocked states plus dependencies. Append new assignments or apply Main's explicit priority; never accidentally replace an unfinished active task. After DONE, continue the next executable queued task without waiting. If blocked, notify Main once with cause/options and continue independent queued work. Main retains the project-wide READY/PENDING queue.
- Resolve routine implementation choices and findings independently. Use direct technical coordination when needed, without redundant progress handoffs, permission requests or status loops.
- Surface genuine blockers or owner decisions to Main with a concise cause and recommended options. Main discusses them with the owner; continue unrelated authorized work.
- When the owner asks for a build, Main reports READY and PENDING items and freezes the requested batch. Prepare edits and focused checks without publishing.
- Merge and deploy only when the owner explicitly triggers that batch. Main may queue work but cannot substitute a new trigger. Use one integration/release job; do not create follow-on releases automatically.
- Previously completed uploads remain recorded. Do not destructively cancel or roll back completed work when the policy changes.
- Reuse prepared asset archives and hashes. Asset compression is permitted only after the measured complete package exceeds 80% of its applicable cap: compact >16,000,000 bytes of 20,000,000; standard >32,000,000 bytes of 40,000,000.
- At or below those thresholds, do not re-encode or lower asset quality. Normal compilation, code minification, packaging and safety checks remain required.
- For an over-threshold content revision, perform one compression pass and cache by asset hash. Repeat only when new measured size or changed assets justify it.
- Preflight exact commands and Node22 once. Reuse passed evidence when the exact relevant source/contracts are unchanged; test affected behavior and capture one boot.
- Every receipt records available phase timing from existing logs: preparation/tests, assets/cache/compression, compile, browser, CI queue/run/retries, deployment/upload and coordination. Label estimates and unmeasured values; do not launch benchmarks to fill gaps.

Current hold: PR377 is ready for the parity runner dependency fix and Node22 alignment; it is OPEN with no auto-merge. No release job should be dispatched until the next explicit owner trigger. Stage182693b and production r0155 were already published before the hold took effect.

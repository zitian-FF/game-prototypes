# Punchies Beta analytics dashboard

Owner-facing static report page, discovered by the normal GitHub Pages/Vite prototype build. It is excluded from Punchies asset-profile game packages. Expected Pages route: `/game-prototypes/prototypes/punchies-analytics/`.

Manual refresh only. The owner enters REPORT_TOKEN into a password field; it is kept in page memory, sent only as an Authorization Bearer header to the fixed trusted Worker, and never stored in URLs, cookies, browser storage, source files, analytics or logs. Clear access removes the token and displayed report. There are no external scripts, trackers or automatic refreshes. The CSP and redirect rejection prevent sending the token to another API.

The Worker must deploy protected `/v1/funnel` and `/v1/players`, permit report CORS from exactly `https://zitian-ff.github.io` (plus local QA), and apply D1 migration0002. Ingestion CORS stays unchanged. Reports remain inaccessible without the existing private secret; no anonymous public dashboard data.

Counts distinguish older completed-match-end events from unique new saved-completion events. Browser profiles are anonymous UUIDs, not people. Per-profile totals/unlocks are latest reported local-save snapshots in the selected retention window, not verified ownership. Missing history/opt-out/caps/reset/retention cannot be inferred or backfilled; no snapshot means Unknown.

No deployment is triggered by source completion. Build owns deployment at the next approved batch.

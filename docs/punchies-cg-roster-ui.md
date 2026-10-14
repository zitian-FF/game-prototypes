# CrazyGames roster UI

Dependency: Build src/edition.ts exports CRAZYGAMES_EDITION. CHARACTER_IDS must already be manifest-ordered (top Marco/Mia/Bruno/Roxy/Nadia; bottom Tee/Tyke/Dragon/Longan/Captain/Kai). Only CG geometry/nav changes; Master30 future slots preserved. No edition inferred from portal/URL; no second production allowlist.

CG targets62x66 logical pixels, row-wrap horizontal navigation, nearest-x vertical navigation and square-ish aspect-correct portrait frames. Existing skin/portrait/confirmation callbacks remain.

Focused checks: test-punchies-cg-grid.mjs, test-punchies-roster-grid.mjs, test-punchies-roster-headshots.mjs, tsc; local Brave640x360 fixture with all11 headshots, no new console errors after correcting fixture Kai path to existing approved asset patch. No ownership grants, match starts or release. Physical Xbox and actual final CG pipeline verification remain Build-owned.

Preview-only copies of Build edition.ts and sim/character.ts used for compilation are NOT part of this commit. No assets/localisation/tuning changes. Tools-only review fixture outside release entries.

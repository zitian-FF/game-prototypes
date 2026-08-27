# Changelog

Base-level (repo-wide) changes that individual prototypes should
account for the next time they're touched. Newest entries first.

## 2026-08-27 — mp-base renamed to mp-console, wired onto packages/mp-core

**What changed:** `prototypes/mp-base/` is now `prototypes/mp-console/`
(folder, Trystero `appId`, localStorage client-ID key, on-screen
labels, CI workflow, and every doc reference updated to match). It is
also now wired onto `packages/mp-core` - client-ID generation,
identity/hostUI/input/analogInput channel creation, and the
identity-matched roster match-or-create logic come from the shared
package instead of a locally duplicated copy, the same as mp-net and
suits-mp already were. See STACK.md's "Multiplayer networking"
section and `packages/mp-core/README.md`.

**Why:** The `mp-base` name undersold its actual role (a local/couch
QR-join multiplayer foundation, not a generic "base" every prototype
starts from) now that it sits alongside mp-net as a documented,
named networking choice in STACK.md. Wiring it onto `packages/
mp-core` removes the last of the three prototypes' duplicated
identity/reconnect implementations.

**Applies to:** `prototypes/mp-console/` (the renamed `mp-base`)
directly. mp-net, suits-mp, and digger are unaffected.

**Action needed per prototype:** None automatically for existing
prototypes. Any code, doc, or link elsewhere in the repo (or outside
it, e.g. bookmarks) still referencing `mp-base` by name or path is
stale and should be updated to `mp-console` on next touch. Two
different rename dependencies here, worth keeping distinct: the
GitHub Pages hub link (`index.html`) points at a relative in-repo
path served by the Pages build itself, so it resolves correctly as
soon as this change deploys, no further action needed. The itch.io
Butler deploy target, by contrast, was updated to push to
`zitian-ff.itch.io/mp-console`, but that project doesn't exist under
the new slug yet - the user is renaming it manually on itch.io's
side, on their own timeline, and the CI deploy will not succeed until
that happens.

## 2026-08-27 — React + Tailwind added for UI chrome

**What changed:** React and Tailwind CSS are now locked stack
additions (see CLAUDE.md Stack section), used exclusively for UI
chrome layered over the Phaser canvas. See CLAUDE.md's "UI
implementation split" section for the full rule.

**Why:** Claude Design produces React/Tailwind mockups natively.
Wiring those directly (no HTML/CSS translation step) avoids a
lossy port and enables a future shared UI component library
across prototypes.

**Applies to:** All prototypes, retroactively.

**Action needed per prototype:** None automatically. Adopt
React/Tailwind only when that prototype's next UI work begins
(Stage 3+ for suits-mp is the first case). Existing UI code is
not being force-migrated on its own.

# Changelog

Base-level (repo-wide) changes that individual prototypes should
account for the next time they're touched. Newest entries first.

## 2026-09-02 — Fix root package-lock.json drift breaking every deploy workflow

**What changed:** `package-lock.json` is regenerated to match the
`mp-core` 0.2.0 bump from the previous entry below, and `prototypes/
mp-net/package.json` and `prototypes/mp-console/package.json`'s own
`"mp-core"` dependency pins are bumped from `^0.1.0` to `^0.2.0` to
match. See STACK.md's mp-core section for the full two-part explanation
of why the stale pins had to move even though neither prototype's
source changed.

**Why:** When `packages/mp-core/package.json` moved to `0.2.0` (previous
entry), `package-lock.json` was never regenerated to match. Every
deploy workflow in this repo runs `npm ci` at the repo root as its
first substantive step, and `npm ci` fails loudly (`EUSAGE`, lockfile
out of sync) rather than reconciling - so every deploy, for every
prototype, on every push to `main`, has been failing at that step since
the bump, regardless of which prototype's files the triggering push
actually touched. Confirmed via GitHub Actions job logs: the "Install
dependencies" step failed identically on the Pages/hub deploy (11
consecutive failing runs) and on digger's itch.io deploy (the one run
that happened to trigger since the bump); suits-mp, mp-net, and
mp-console's own itch.io deploys hadn't been triggered again since the
bump but would have failed identically, since the failure is in a
step that runs before any prototype-specific work begins.

A second, more severe hazard was caught while fixing this: naively
running `npm install` (rather than fixing the pins first) silently
substituted an unrelated, deprecated package from the public npm
registry into mp-net/mp-console's own `node_modules` in place of the
real local `packages/mp-core` workspace folder, with no error at all.
This was caught before being committed. See STACK.md's mp-core section,
point 2, for the full mechanism - it's the more important takeaway of
the two for scoping any future shared-package version bump.

**Applies to:** Repo-wide CI/deploy infrastructure. No prototype's
source or runtime behavior changed - confirmed via byte-identical
mp-net/mp-console build output before and after, plus a clean
`npm run typecheck` / `npm run build` / `npm ci`.

**Action needed per prototype:** None. This is a lockfile/pin
correction only. Worth internalizing the pattern in STACK.md before
bumping any shared package's version again: bump *every* consumer's
declared pin for that package at the same time, even one that needs no
source changes, and regenerate the lockfile as part of the same
change - never as an afterthought.

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

## 2026-09-02 — Player display names, suits-mp Lobby consolidation, redistribution log

**What changed:**
- packages/mp-core bumped 0.1.0 → 0.2.0, additive only: new
  `createIdentityActionWithName` export and an optional `displayName`
  on `BaseRosterEntry`, alongside the original unchanged
  `createIdentityAction`. See STACK.md's mp-core section for the
  version-isolation limitation this surfaced and the pattern adopted
  going forward.
- suits-mp adopted 0.2.0. Two previously-parallel Lobby
  implementations - a canvas/Text-based one (`HostLobbyScene`/
  `PlayerLobbyScene`, the one actually wired to real networking) and an
  unwired DOM `LobbyFlow.tsx` (the Claude Design port, placeholder data
  only) - are now consolidated into one: `LobbyFlow.tsx` renders as a
  DOM overlay driven by the scenes' real networking, with a name-entry
  field feeding the new mp-core capability.
- Every in-game `P1`-`P4` display site in suits-mp (trick display,
  turn/waiting text, delegate-selection targets, god-reveal, DOM HUD
  tags) now shows a real player name, or an absolute-numbered
  `Player N` fallback if blank. This introduced a formal split between
  two numbering systems that must not be conflated: `P1`-`P4`
  (`ui/seating.ts`'s `SeatLabel`) is viewer-relative screen position,
  an internal geometry concept only, no longer shown as player-facing
  text anywhere; the `Player N` fallback is absolute seat order
  (`NetPlayerId` `p0`..`p3` → 1..4), consistent across every viewer and
  matching the Lobby's own numbering.
- The redistribution log (suits-mp) is fully implemented: per-trick
  entries from the viewing player's perspective, `'received'` vs.
  `'distributed'`, grouped by recipient, self-gifts excluded,
  distinguishing a direct Single-win redistribution from a Double-win
  delegate redistribution via `wonByDouble` (now persisted per-record
  in the rules engine, not just on the most recent trick). Host-side
  masking holds throughout - no perspective is inferred client-side.
- Repo-wide: auto-merge's actual mechanics were clarified in CLAUDE.md.
  The repo-level "Allow auto-merge" setting only permits auto-merge; it
  does not enable it per PR. Claude Code now runs the enable command
  explicitly on every PR it opens. There is still no
  `pull_request`-triggered CI check, so this currently means a PR
  merges immediately on open with no automated gate - an accepted,
  explicit tradeoff, not an oversight, pending the real CI-gate work.

**Why:** Player identity was previously invisible in suits-mp - every
screen showed viewer-relative `P1`-`P4` labels with no connection to a
real person, which made teammate deduction and general readability
harder than intended by the GDD's design.

**Applies to:** suits-mp directly. mp-console and mp-net gained the
mp-core capability but have not adopted it and are otherwise untouched.

**Action needed per prototype:** None automatically for mp-console/
mp-net - opt into mp-core 0.2.0 and wire display names only if/when a
future task calls for it.

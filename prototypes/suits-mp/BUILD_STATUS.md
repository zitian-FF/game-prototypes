## Current milestone

Local Victory animation + universal Victory Screen (win-by-suit-completion
only; stalemate has a minimal non-broken fallback, see Known issues), now
including a follow-up revision: Local Victory's hand cards get a real
front/back flip cycle plus randomized tilt, and the Victory Screen's
deity sprite sizing was re-verified and enlarged against the real mobile
viewport.

## What was implemented

**Part 1 - Local Victory** (client-side, fires only for the player whose
own hand actually completed their Deity Suit): the local player's own
hand-fan cards levitate slightly and gain a small randomized permanent
tilt (varying per card, not a uniform wave), each performs one full
front->back->front flip cycle on its own randomized start delay (a
staggered, chaotic-feeling ripple across the hand rather than a
synchronized wave), glow tinted to their own Deity's existing accent
color (reused, not invented - see Key technical decisions), then the
camera fades to solid white (`camera.fadeOut`, monotonic, no flashing)
which hands off directly into Part 2 with no gap.

**Part 2 - Victory Screen** (every client, via its own white-in): the
winning team's two Deity Face sprites enter from opposite screen edges,
cross paths, and settle on the side opposite where each started, each
then pulsing with an ongoing ambient glow in its own color. A DOM overlay
(`VictoryModal.tsx`) layers the team headline ("Team Chaos Won" / "Team
Cosmos Won"), trick count, all 4 players' revealed names/identities, and
a "Back to Menu" button on top.

Detection of "did *I* personally complete" is done by checking the local
player's own unmasked hand against their own god's 10 card ids directly
(`state.yourHand` vs `CARD_DEFS` filtered by `state.yourGod`) - there is
no player-id field on `WinInfo` to read this from, as the task itself
flagged.

## Key technical decisions

- Per-Deity accent colors were previously duplicated ad hoc inside
  `GameOverlay.tsx` (DOM-only). Extracted them into `rules/cards.ts` as
  `GOD_ACCENT_RGB`/`GOD_ACCENT_HEX`, a single shared source now used by
  both the DOM Suit Cycle UI and this canvas code - no new colors
  invented, per the task's explicit instruction.
- Local Victory's card glow is a plain additive color-wash rectangle
  (task only asked to reuse the *color tokens*), while the Victory
  Screen's settled deity glow reuses the actual BitmapMask-to-silhouette
  technique from the Powered card idle shimmer (`addPoweredIdleShimmer`),
  since that one specifically needed to read as an "ongoing ambient glow
  masked to the sprite's own shape," not a flash.
- The hand-card flip (`addVictoryCardFlipCycle`) deliberately reuses the
  exact scale-through-zero technique already established by the existing
  `playCardRevealFlip` (shrink a container's `scaleX` to 0, swap the
  visible face at the invisible zero-width midpoint, grow back out)
  rather than inventing a second flip mechanic - the only differences are
  flipping twice in a row (there and back, since this is a celebratory
  flourish on a card whose identity doesn't change) and mutating the
  existing hand-fan container's own children in place rather than
  destroying/redrawing a new one (there's no new `cardId` here). The
  real `card_back` texture (`cardComponent.ts`'s existing facedown
  branch) is what's swapped to mid-flip, and the exact same
  already-composited real-face content (including any live "Powered"
  Deity Card treatment) is what's swapped back - confirmed visually via
  fine-grained Playwright screenshots, including one frame that caught
  several hand cards mid-flip simultaneously at different phases (one
  edge-on/invisible, one showing card_back, one already back to its real
  face), proving the per-card stagger is real and not just randomized
  code that happens to render synchronized.
- `renderCardFan` now returns a `Map<CardId, Container>` of what it just
  drew, used only by the Local Victory levitation to get live tweenable
  handles on the fan's cards (this file rebuilds the whole hand fan from
  scratch every render otherwise).
- All choreography (levitate distance/duration, glow alpha, card tilt/
  flip timing, fade duration, deity entrance duration/easing/height, glow
  pulse) is in `tune.json`, Tweakpane-exposed automatically (no
  `debugPanel.ts` changes needed - it walks `tune.json` generically).
- **Deity sprite sizing was re-verified this revision, and the earlier
  0.42 height fraction was replaced with a properly measured 0.45.**
  Re-tried the task's literal "~70% of screen height" starting point and
  measured the actual rendered sprite bounds (not just estimated) via a
  temporary Playwright debug hook at the real 390px mobile viewport: at
  0.7, each sprite's real displayWidth is ~393px (this art's own measured
  ~0.666 width:height ratio), clipping ~96px off the *outer* edge of
  *both* sprites simultaneously - confirmed both by the measured numbers
  and by a real screenshot showing both characters' outer arms/hair
  visibly cut off at the screen edges. Solved for the largest height
  fraction that keeps both sprites' outer edges fully on-screen at the
  existing 0.16 rest-offset (`restOffset = targetHeight * 0.16` - the gap
  each sprite settles at from center), landing on 0.45 with ~7.8px of
  clearance on each edge, verified again via measured bounds and a real
  screenshot. Also tried shrinking that 0.16 rest-offset instead (to
  allow a *larger* height fraction while still fitting) - rejected after
  a real screenshot showed a much smaller offset (0.08) buries one
  sprite almost entirely behind the other (they're drawn in a fixed
  z-order, so the later-drawn one dominates), defeating the point of
  showing both deities. Left the offset alone and only grew the height
  fraction, since that was the tradeoff that actually stayed within
  "both fully visible, clearly readable side by side." Spot-checked both
  possible team pairings via real screenshots (Team Chaos's Cthulhu/
  Nyarlathotep and Team Cosmos's Shub-Niggurath/Yog-Sothoth) since all
  four Deity Face assets are expected to share one canvas aspect ratio
  per the root CLAUDE.md art pipeline rule ("source frames are exported
  at full canvas size with fixed registration") but hadn't both actually
  been rendered yet - both fit cleanly with no clipping.
- Deity entrance choreography (opposite edges -> cross -> settle on the
  opposite side from where each started) was watched frame-by-frame via
  fine-grained Playwright screenshot capture during real gameplay (not
  just assumed from the tween code): a clear mid-crossing overlap frame
  was captured between the "not yet visible" and "fully settled" frames,
  confirming the crossing is genuinely visible on screen, not hidden
  entirely behind the white fade-in. Reading confirmed correct as
  originally coded; no choreography change was needed.
- Navigation: the task's premise that a "Return to Main Menu" button
  already existed (Host-Disconnected lobby state) doesn't hold - no such
  button exists anywhere in this codebase. Flagging this per the "flag
  rather than guess" instruction rather than silently inventing a fake
  precedent. Used the actual canonical navigation pattern instead
  (`scene.start('Landing', { clientId, getIceServers })`), the same one
  every other lobby scene already uses.
- Fixed a real bug found during verification: the Victory Screen's "Back
  to Menu" button navigated the Phaser scene back to Landing but never
  closed the DOM `VictoryModal` overlay, so Landing rendered underneath
  a still-visible, still-interactive Victory Screen overlay. Fixed by
  calling `closeVictory()` before `navigateToLandingMenu()`.

## Open questions

None - `BRIEF.md` was not consulted mid-session for this task since the
task description (and the standing house rules restated within it) was
fully self-contained; nothing came up that required asking the user
beyond what the task itself already flagged as open (the stalemate
screen, addressed below).

## Known issues

- **Stalemate has no dedicated screen, by explicit design of this task.**
  `reason === 'stalemate'` never triggers Local Victory or the Victory
  Screen (both require a real winning team). It now falls through to a
  minimal, unstyled `renderGameOver` stub: plain text ("GAME OVER",
  the stalemate detail line, revealed identities) plus a working
  "Back to Menu" button (previously this screen had no button at all -
  a real dead end). Verified via a constructed two-opposing-completers
  redistribution (not just inspected in code) that this path is
  reachable and doesn't crash or hang; the stub's detail-line text can
  run past the right edge of a 390px viewport for a long stalemate
  detail string (pre-existing, not introduced by this task, out of
  scope to fix here). A dedicated stalemate screen is real scope for a
  separate future task.
## Next proposed step

Scope and design a dedicated stalemate screen (distinct framing from the
Victory Screen, since there's no "winning team" to feature) as its own
follow-up task, and consider trimming/wrapping the stalemate stub's
detail text so it doesn't run off-screen in the meantime.

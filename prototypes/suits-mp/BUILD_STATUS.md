## Current milestone

Landing screen art implemented and now confirmed live end-to-end: real
chrome for Create Room, Join Room, Single Player, Tutorial, and the
display-name input, replacing the placeholder gradient/clip-path bevels,
sourced from the real R2 bucket (no remaining pipeline gap). All
behavior/state/accessibility preserved.

## What was implemented

- `scripts/pack-assets.js`: new `ui_landing_*` optimization rule
  (maxDimension 1536, webp) ahead of the generic 512px card-art rule -
  these render as full-width DOM backgrounds (not small hand-fan cards),
  so they need more resolution headroom on a high-DPR phone.
- `godArtUrl.ts`: 4 new URL helpers (`landingButtonPrimaryUrl`,
  `landingButtonSecondaryUrl`, `landingButtonTutorialUrl`,
  `landingInputUrl`), same convention as every other DOM art URL here.
- `LobbyFlow.tsx`: the 4 landing buttons now carry the art via a CSS
  custom property (`--landing-control-art`, set inline per button) read
  by a shared `.landingControl::before` pseudo-element in CSS - real
  `<button>` stays transparent/borderless, decorative art sits behind the
  label at `z-index: -1`. The display-name `<input>` gets its background
  applied directly (not `::before` - `<input>` is a replaced element and
  doesn't reliably generate pseudo-element content) - matches the art
  handoff's own example, which does the same split. Removed the old
  hand-built two-layer gradient/clip-path bevel from all 5 controls.
- `LobbyFlow.css`: `.landingControl` base + `::before` recipe, hover
  (brightness + warm-gold glow, art layer only), pressed (translateY(1px)
  scale(0.99) + brightness dip, art layer only so the label stays crisp),
  disabled (saturate/opacity, ready for if these controls ever set
  `disabled`), `:focus-visible` (high-contrast outline outside the art).
  Input gets its own focus treatment (teal inset glow, visibly different
  from the button hover glow) plus the same focus-visible outline.
  `prefers-reduced-motion` guards the transform/transition declarations
  specifically (not the color/filter changes, which aren't motion).
  Removed the old `[data-ui='host-button']`/`[data-ui='join-button']`
  hover/active rules that belonged to the replaced chrome.

## Key technical decisions

- **R2 upload gap (previously flagged) is now resolved, confirmed by
  re-fetch.** The prior session found `suits-mp_landing_ui_assets_v001.zip`
  missing from R2 and used a Drive-downloaded copy for local verification
  only. The user has since confirmed the R2 upload; re-checking found
  R2 never gained that separately-named zip object (still 404) - instead
  the main `suits-mp_assets.zip` was re-uploaded with the 4
  `ui_landing_*.png` files folded directly into its own `loose/`. Detected
  via the main zip's ETag/size changing since the last fetch, confirmed
  by re-running the plain `npm run fetch:assets suits-mp` (no flags,
  no separate object) and finding all 4 files present. Re-verified
  integrity: each file's SHA256 hash matches byte-for-byte against the
  earlier Drive-downloaded copies, so this is genuinely the same
  unmodified art, delivered through the main package instead of a
  supplementary one. A speculative `--merge` flag was added to
  `scripts/fetch-assets.js` during the original implementation to support
  fetching a supplementary zip non-destructively; since the real delivery
  went through the main zip instead, that flag was never exercised
  against real R2 content and has been reverted - `fetch-assets.js` is
  back to its original single-zip, wipe-and-replace form. Re-ran
  `pack-assets.js` and a fresh Playwright screenshot against the real
  R2-sourced art; renders identically to the earlier Drive-sourced
  verification, no new console errors.
- **Verified package integrity per the existing standard**: valid zip,
  exactly the 4 `loose/*.png` files the manifest names, each confirmed
  2172×724 RGBA via `sharp` metadata - matches the manifest exactly, so
  treated as genuine, not corrupted.
- Mapped by role, not by the handoff's stale pre-rewrite names (`Open a
  Circle` etc., not used anywhere in this codebase) - `ui_landing_button_
  primary.png` on both `host-button` and `join-button` (equal weight,
  shared asset, per the manifest); `_secondary` on `single-player-button`;
  `_tutorial` on `tutorial-button`; `_input` on `display-name-input`.
- Kept existing button/input dimensions (78/78/52/34px heights, 58% width
  for Tutorial) rather than adopting the handoff's suggested "65-75% of
  primary width" - not asked to resize, and this preserves the existing,
  already-correct "Tutorial stays visibly smaller" requirement without
  touching layout the task didn't ask to change.
- Pressed-state brightness dip and hover-state brightness/glow both scope
  their `filter`/`box-shadow` to the `::before` art layer specifically
  (never the real button), so text stays fully legible/undimmed through
  every state - required a small self-correction mid-implementation (see
  Known issues note on this being non-obvious).

## Verification

`npm run typecheck`: pass
`npm run build`: pass

**Asset integrity**: fetched from the real R2 bucket via the plain
`npm run fetch:assets suits-mp` (main zip, no flags), exactly 4
`ui_landing_*.png` files present, each verified 2172×724 RGBA via
`sharp` and SHA256-matched byte-for-byte against the earlier
Drive-downloaded copies used for initial implementation. Packed output
verified 1536×512 (aspect preserved, no cropping) per file. Fresh
Playwright screenshot against this real R2-sourced art renders
identically to the earlier Drive-sourced verification.

**Real interaction test** (Chromium via Playwright, dev server):
- Create Room → real host flow, produced a genuine 5-character room code.
- Join Room → real join screen shown (no connection attempted yet).
- Single Player → left the landing screen (bypasses networking, as
  before).
- Tutorial → left the landing screen.
- Long name (22 chars entered, capped to `DISPLAY_NAME_MAX_LENGTH`=20):
  visually confirmed no collision with the input's bevel; value survives
  a Landing → Join → Landing round trip (shared state intact).
- Tab order: reaches `host-button` in the expected sequence.
- Hover: warm-gold glow + brightness increase, screenshot-confirmed,
  distinct per control.
- Keyboard focus (`:focus-visible`): high-contrast yellow outline drawn
  outside the art, screenshot-confirmed, visually distinct from hover.
- Input focus: restrained teal inset glow, screenshot-confirmed at max
  name length, clearly distinct from the buttons' gold hover glow.
- Pressed: screenshot-confirmed visible dimming of the art with the label
  text still crisp/undimmed.
- `prefers-reduced-motion: reduce`: confirmed via computed style that the
  button's `transitionProperty` for `transform` is not applied under
  reduced motion (falls back to the browser default), vs. `transform`
  when motion is not reduced.
- Join/Lobby screens: screenshot-confirmed visually unaffected (the
  Join screen's own `submit-join-button` and the Lobby screen's
  Room-Code panel/seat list are untouched, separate controls from this
  package's 4 assets).
- Console errors: only the pre-existing sandbox-only
  `ERR_CERT_AUTHORITY_INVALID` (Google Fonts) and one unrelated 404,
  identical to before this change - no new errors introduced.

Skipped, per this task's own standing agreement: exhaustive Playwright
proof of exact hover-glow feel/timing (pure visual polish) - kept full
rigor on the behavior/callback/state-preservation checklist above.

## Open questions

None required asking the user mid-session - the task's own "map by role,
not by name" instruction resolved the only real ambiguity (the handoff's
stale terminology) up front.

## Known issues

None outstanding. `suits-mp_landing_ui_assets_v001.zip` as a
separately-named R2 object never materialized and is no longer expected
to - the 4 landing files are live in R2 via the main
`suits-mp_assets.zip` instead, which is what the primary CI-invoked
`npm run fetch:assets suits-mp` already fetches.

## Next proposed step

None for this item - landing screen art is fully implemented and
confirmed live against real R2-hosted assets, with no remaining
blockers.

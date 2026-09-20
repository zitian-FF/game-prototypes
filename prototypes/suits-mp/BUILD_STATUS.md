## Current milestone

Landing screen art implemented: real chrome for Create Room, Join Room,
Single Player, Tutorial, and the display-name input, replacing the
placeholder gradient/clip-path bevels. All behavior/state/accessibility
preserved.

## What was implemented

- `scripts/fetch-assets.js`: new `--merge` flag - extracts a zip on top of
  an existing `assets-src/` instead of wiping it first, with its own
  per-object ETag cache key. Needed because this package
  (`suits-mp_landing_ui_assets_v001.zip`) is a supplementary drop, not
  suits-mp's main `suits-mp_assets.zip` - the existing script always
  replaced `assets-src/` wholesale, which would have deleted every other
  suits-mp asset.
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

- **R2 upload gap found and worked around for verification, not routed
  around silently.** `suits-mp_landing_ui_assets_v001.zip` does not exist
  at the R2 bucket (confirmed 404 plus several plausible-name variants,
  all 404) - it exists only in the Drive `Working/` folder (fileId
  `1aed7kHm3yNt4KS6EMHrrcivJThfLFW20`). Downloaded it directly from Drive
  to unblock local implementation/testing; this is **not** a substitute
  asset (byte-identical content, verified below) and nothing is
  committed either way (`.gitignore` excludes all art) - but production
  deploys will have **no art for these 4 controls** (native/element
  falls back to no background, controls stay fully functional) until
  someone uploads this exact zip to R2. Flagged as a real, blocking
  pipeline gap, not implemented around.
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

**Asset integrity**: zip downloaded, valid, exactly 4 files matching the
manifest, each verified 2172×724 RGBA via `sharp`. Packed output verified
1536×512 (aspect preserved, no cropping) per file.

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

- **R2 upload still pending** (see Key technical decisions) -
  `suits-mp_landing_ui_assets_v001.zip` needs to be uploaded to the R2
  bucket before a real deploy will actually show this art; until then,
  `npm run fetch:assets suits-mp` (the primary, CI-invoked fetch) won't
  pick these files up at all, and even the new `--merge` flag has nothing
  to fetch from R2. Local testing for this task used a Drive-downloaded
  copy of the exact same package (never committed).
- `scripts/fetch-assets.js --merge` is new, minimal, and only exercised
  for this one package so far - fine for the immediate need, but if a
  wrapped-top-folder supplementary zip ever shows up, its flatten logic
  wouldn't apply cleanly on top of an already-populated `assets-src/`
  (see the function's own comment). Not a problem for this package
  (confirmed unwrapped, `loose/` at top level).

## Next proposed step

Upload `suits-mp_landing_ui_assets_v001.zip` to the R2 bucket (outside
this repo's own tooling - no R2 write credentials here, by design) so a
real deploy actually serves this art; then re-verify once with
`npm run fetch:assets suits-mp suits-mp_landing_ui_assets_v001.zip
--merge` against the real R2 object instead of the Drive copy.

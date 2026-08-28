## Current milestone

Stage 3c (partial): the Rules overlay is now real content, replacing its
Stage 3a stub ("Rules - coming in a later pass."). This is the first DOM
(React + Tailwind) UI chrome in suits-mp - and in the repo - per root
CLAUDE.md's "UI implementation split" and STACK.md's "first expected use:
suits-mp's Stage 3 UI port." Redistribution-log content, Stage 3c's other
half, is still stubbed and out of scope for this session (see "Next
proposed step"). Version stamp counter is at 8 (`version.json`) -
unchanged this session, no deploy has run yet.

## What was implemented

- Ported the Claude Design handoff `Suit of Madness Rules.dc.html` (an
  accordion-style rules reference: intro line, 7 collapsible sections -
  Objective, Turning of Suits, Straying from the Suit, Taking a Trick,
  the Offerings/redistribution, the Invoker, the Fortieth Trick - plus a
  suit-cycle diagram, an off-suit/Twin-Awakening two-up info grid, and a
  fold/unfold-all + "Seal the book" close footer) as a pixel-matched
  React component, `src/dom/RulesModal.tsx`. Section copy/data ported
  verbatim into `src/dom/rulesContent.ts`; bespoke gradients/oklch
  colors/clip-path polygons stayed as inline styles (matching the
  source) rather than forced into Tailwind utility classes - see that
  file's header comment for why. Real `:hover`/`:active` states and the
  scrollbar/keyframe styling (expressed in the source via a
  design-tool-only `style-hover=`/`style-active=` convention, not real
  CSS) moved into `src/dom/RulesModal.css`.
- First-time repo infrastructure this unlocks: `@vitejs/plugin-react` and
  `@tailwindcss/vite` wired into the root `vite.config.ts` (both already
  sat in the root as devDependencies per STACK.md, unused until now);
  `react`/`react-dom` added as root dependencies; `tsconfig.json` gained
  `"jsx": "react-jsx"`. All repo-root changes, so every other prototype
  is unaffected (the plugins are no-ops on files that don't import JSX
  or `@import "tailwindcss"`).
- DOM-mounting layer (`src/dom/mountDom.tsx`, `DomRoot.tsx`,
  `domUiStore.ts`): one React root mounted into Phaser's own
  `game.domContainer` (`dom: { createContainer: true }`, already in
  `main.ts`'s game config) after the `ready` event, since
  `game.domContainer` doesn't exist until `Game#boot` runs post-
  `DOMContentLoaded`. `game.domContainer` sizes itself in *device*
  pixels (`WIDTH*PIXEL_RATIO x HEIGHT*PIXEL_RATIO`) to match the canvas
  backing store, not the 390x844 logical space every scene/mockup is
  authored in - `mountDom.tsx` compensates with a `scale(PIXEL_RATIO)`
  wrapper, the DOM equivalent of every scene's
  `camera.setZoom(PIXEL_RATIO)`. `domUiStore.ts` is a tiny external
  store (`useSyncExternalStore`) bridging the DOM layer and the Phaser
  canvas, which still owns `ui.overlay` (`PersistentUIState`, see
  `ui/renderGameView.ts`) - no new intent-layer work was needed since
  opening/closing/toggling the Rules modal is chrome-only and never
  reaches game logic or the network.
- Wired the *existing* in-canvas "Rules" button (top bar, already
  setting `ui.overlay = 'rules'` since Stage 3a) to this real modal
  instead of adding a second/competing trigger: `renderWithView` now
  special-cases `ui.overlay === 'rules'` to call `domUiStore.openRules()`
  with a close callback (resets `ui.overlay` and re-renders the canvas)
  and draws nothing further that frame; the DOM modal covers the
  screen. `renderOverlay`'s type narrowed to
  `Exclude<OverlayKind, 'none' | 'rules'>` now that 'rules' never
  reaches it, and its dead stub-text branch was removed.
- suits-mp's own `index.html` gained the three Google Fonts
  (`IM Fell English SC`, `Cormorant Unicase`, `EB Garamond`) the design
  specifies, matching the mockup's own `<helmet>` block - scoped to this
  prototype's own HTML entry point, not the shared root `index.html`.

## Key technical decisions

- Reused the existing Stage 3a "Rules" button/`ui.overlay` plumbing
  rather than adding a new DOM-side trigger button: a second button
  doing the same thing would have been redundant, and the existing one
  was already correctly wired end-to-end (tap intent, overlay state)
  down to its stub content - only the content needed replacing. Flagged
  to the user as a deliberate deviation from the originally-discussed
  "add a minimal button" framing once this was discovered mid-session
  (see Open questions).
- Kept the ornate/bespoke visual values (oklch colors, multi-stop
  gradients, clip-path octagon corners, custom serif/small-caps fonts)
  as inline React styles rather than translating them into Tailwind
  arbitrary-value utility classes - the source design is essentially
  entirely bespoke one-off values with no repeating utility pattern, so
  a utility-class translation would have been both less faithful to
  pixel fidelity and harder to read/maintain than the direct port.
  Tailwind is still wired in (`@import "tailwindcss"` in
  `RulesModal.css`) and available for future, more utility-shaped DOM
  chrome.
- Accordion open/closed state is local `useState` inside `RulesModal`,
  reset fresh every time it mounts (matches the source's own default
  `{ objective: true, cycle: true }`) rather than persisted - the
  design gives no indication this should survive a close/reopen, and
  nothing in suits-mp's `PersistentUIState` currently carries DOM-side
  UI preferences.

## Open questions

- Mid-session, the user was asked (before implementation started)
  whether to add React+Tailwind infra now and how to trigger the modal
  (a new button vs. the debug panel vs. no live trigger yet); they chose
  "add a minimal button." Reading the existing code afterward turned up
  the already-wired Stage 3a "Rules" button/stub, which made reusing it
  strictly better than adding a second button - a case the original
  question didn't anticipate. Not re-blocked on; documented here per
  CLAUDE.md's rule for exactly this kind of brief/reality mismatch.
  BRIEF.md may be worth a note that Stage 3c "wires the design in" means
  completing the existing stubbed trigger, not adding a new one.
- Redistribution-log content (Stage 3c's other half) was out of scope
  for this session (the design handoff's focus file was the Rules
  overlay only) and remains stubbed - see "Next proposed step."

## Known issues

- Google Fonts (`fonts.googleapis.com`) fail to load in this dev
  sandbox's network environment (`net::ERR_CONNECTION_RESET`, verified
  via an ad hoc Playwright check - no reusable screenshot script exists
  in `scripts/` yet for any prototype). The modal still renders and is
  fully legible on the `serif`/`Georgia` fallback stack; this is a
  sandbox network limitation, not a code defect, and should resolve
  under normal internet access.
- Carried over from Stage 3a, still true, untouched this session:
  facedown-card masking leak at the payload level
  (`host/mask.ts`'s `currentTrick`/`previousTrick` carry the real card
  id for offsuit plays to every peer; only patched at the UI layer);
  not live-verified against real human peers (masking, turn rotation,
  redistribution/delegate flow, reconnect, room-code refresh); the
  off-suit double-selection fan and `selectDelegate` phase are logic-
  verified but not pixel-verified live; the TURN worker fetch's
  swallowed `Failed to load resource` console error in the dev sandbox.

## Next proposed step

Redistribution-log content is Stage 3c's remaining half - same
treatment (a Claude Design handoff implemented as a DOM component), once
that design exists. Otherwise, the carried-over Known issues above still
stand: a real fix for the facedown-card masking leak in `host/mask.ts`,
and a user phone/live pass covering real-peer masking/reconnect and the
double-win/`selectDelegate` and off-suit-double-selection live rendering.

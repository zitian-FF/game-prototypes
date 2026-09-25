## Current milestone

The suits-mp interface is rendered in Phaser's canvas. The legacy React DOM overlay and the unused DOM join scene have been removed.

## What was implemented

- Added a persistent `CanvasUiScene` for the landing, join, host lobby, waiting, error, game HUD, menu, rules, redistribution log, end-game, victory, and tutorial interfaces.
- Moved name and room-code entry into an on-canvas keyboard. Host controls retain copy-code, copy-link, room refresh, bot management, and Start Game actions.
- Kept the existing scene-to-UI state stores as plain TypeScript under `src/uiState/` and removed the React components, styles, DOM mount, and Phaser DOM container.
- Nine-sliced the local nameplate, action slab, landing buttons, and landing input in canvas so carved end shapes keep their proportions.

## Verification

- `npm run typecheck` and `npm run build` pass.
- Browser checked at 390×844 and 523×1280. The board, nameplates, controls, keyboard, and menu render in the same canvas coordinates; the tall viewport places the canvas at y=74 with no second DOM layer.
- Single Player and Menu opened in browser without page errors. The Join screen and name-entry keyboard were exercised.

## Open questions

- The open-center nameplate and darker, list-based lobby remain separate working mockups awaiting visual review. This migration preserves the current shipped layout.

## Known limitations

- Modal styling has been recreated with canvas geometry and text; the old CSS blur, gradients, and decorative details are not pixel-identical.
- Multiplayer host/join behavior was not exercised with multiple peers in this local visual pass.

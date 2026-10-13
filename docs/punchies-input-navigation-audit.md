# Input and navigation audit

Base: origin/main d864d50. Focused Logic follow-up; no package build or deployment.

## Shared contract

input/modality.ts owns session-only `inputModality.kind/source/revision`, default touch. Meaningful pointerdown (mouse, pen, touch), nonrepeat noncomposing keyboard event, gamepad button edge or new stick direction registers modality. Hardware presence, held buttons/sticks, neutral jitter do not register. Stick hysteresis engages >.65 and releases below .35. DOM text entry is ignored. DeviceHub getters, tutorial/first-fight prompts, menu navigation and roster use the same owner. Global listeners install once for app lifetime; hint listeners belong to rows and remove on destruction. No save schema changes.

## Mapping

Primary menus: saved keyboard direction bindings plus arrows; Enter/Space confirm, Escape back. Xbox left stick/D-pad, A confirm, B back. Gameplay binding profiles remain unchanged. Roster: saved movement bindings/arrows; Enter/Space or existing player confirm aliases; Escape/back aliases; F1 / Xbox Y format (host only, absent training/Survival); F2/F3 / LB/RB difficulty (VsAI only). Legacy F/Q/E aliases remain only when not assigned to movement; dedicated function keys avoid saved-binding conflicts. Hints show relevant current device using existing passive Xbox circles/keycaps. Typing and capture own their events; no side shortcuts there.

Touch editor: each drawn handle is focusable. Confirm selects; arrows/D-pad or left stick nudge staged position by 1% (stick repeat220ms); Confirm/Back ends adjustment, then Save/Cancel/Reset normal. Drag remains supported. Invalid/overlapping layouts cannot save. Selection cyan outline; navigation/capture ownership cleans up on exit/shutdown.

## Audit matrix

| Flow | Reachability and ownership | Change/check |
|---|---|---|
| Main menu / mode choices / local input selection | titleButton/navRegister | Shared saved directions, live hints, focus bounds |
| Settings / language / credits / reset confirmation | registered titleButtons, highest depth modalBack | Back hint glyph follows device; existing nested modal tests |
| Roster all modes | custom scene handler, no second MenuNav owner | Last device; difficulty/format hints gated; keyboard repeat suppressed; simultaneous A/X/Start one confirm; Back priority; initial held pad suppressed |
| Skin cycling / locked fighters | roster left/right after selection, confirm blocked for unavailable | Existing ownership retained; movement bindings reused |
| Shop inspect / purchase / ad / reward acknowledgement | registered shop hits and modalBack / acknowledgement at610 | Shared hints; destroyed hits removed; ad/overlay suppression and held-edge regression |
| Profile alias / title / pages | titleButtons, textEntry typing, modalBack | Existing typing/IME ownership retained, shared directions outside typing |
| Casual code keypad / Ranked lobby | registered keypad, textEntry / lobby Back | Keypad typing/cleanup and lobby timeout regression; no automatic queue changes |
| Survival entry / overwrite / checkpoints / results | titleButtons and survivalChrome with explicit Back | Same shared navigation; no sim changes |
| First fight / tutorial | DeviceHub + bindingLabel prompts, registered actions | Shared modality now includes menus and all meaningful inputs; existing binding prompt test |
| Training reset / stance | FightStage registered buttons | Escape/Start opens game menu; fightMode preserves gameplay, primary nav used when engaged |
| Combat pause / settings / return confirmation / results | GameMenu separate scene / registered result buttons | Existing pause exclusion, nested modal and gameplay Hook preservation |
| Keyboard/controller binding editor | ownBindings + suspended DeviceHub | Existing capture/held/disconnect/save/cancel/reset tests |
| Touch-layout editor | previously pointer-only handle drag | Keyboard nudge/save focused regression added, controller equivalent implemented |

## Verification and limits

Focused VM tests exercise real source modules with simulated keyboard/gamepad events, not a physical Xbox controller. TypeScript and locale checks pass. Sheet rows486–490 match five new keys across six locale JSONs. Build owns actual Brave/mobile/layout/controller integration validation. Art source review found and corrected footer/touch-target overlap, glyph-label spacing and world-vs-logical scaling. Footer is one y334 row alternating with touch caption/notice; side hints center80/744 at97. Build should verify final localized fit. No physical controller or full scene playthrough claim.

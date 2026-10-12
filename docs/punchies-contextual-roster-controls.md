# Contextual roster controls

One Confirm commits the highlighted fighter and current owned skin. Navigation always moves through fighters. Back un-readies a committed pick or returns to the previous selection/menu step. Training and Survival begin on that single confirmation.

| Menu command | Keyboard 1 default | Keyboard 2 default | Xbox |
|---|---|---|---|
| Confirm | Enter | Numpad Enter in Local VS; Enter otherwise | A |
| Back | Escape | Backspace in Local VS; Escape otherwise | B |
| Previous / next skin | Saved Jab / Cross: J / K | Saved Jab / Cross: Num 1 / Num 2 | LT / RT |
| Previous / next difficulty | Saved Hook / Upper: L / I | Saved Hook / Upper: Num 3 / Num 5 | X / Y |
| Match format | Saved Dodge: Space | Saved Dodge: Num 0 | RB |
| Fighter navigation | Saved movement: WASD | Saved movement: arrows | D-pad / left stick |

Keyboard contextual commands follow saved bindings; dedicated Confirm/Back override all bindings, movement wins over ALT, then Jab/Cross/Hook/Upper/Dodge resolve in that order. Local VS routes only to a side owning that keyboard profile. A key shared between two owned keyboard profiles is ignored unless it is a dedicated menu key. Hints use the same dispatch resolver and omit ambiguous/unavailable keys; no function-key or legacy letter shortcuts remain. Saved keyboard bindings are not changed. Xbox menu controls are a fixed contextual map independent of combat layout; A/B are always dedicated and no other button confirms.

Difficulty exists only in VS AI; format is disabled in Training/Survival and only the online host can change it. Locked/remote sides cannot change skins or navigate. Each key/button edge triggers one command; repeat keydown, held buttons, typing, composition and modified keyboard shortcuts are ignored. Simultaneous pad edges prioritize Back, Confirm, skins, format, difficulty, navigation. Reconnect seeds held buttons without firing them.

Validation: actual CharSelectScene VM tests exercise single confirmation, all mode transitions, saved keyboard remaps, duplicate/cross-profile routing, movement and dedicated-key priority, no F-key dispatch, ownership, remote/locked guards, trigger/A/B/contextual edges, same-skin selection and typing/repeat guards. Passive hint tests verify actual bound keys and Xbox glyphs. These are simulated device tests; physical controller/mobile certification belongs to release QA.

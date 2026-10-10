## Current milestone
UI/input polish completed through an outsource CLI implementation pass, root review, Brave production-preview QA, and a second outsource cleanup pass.

## What was implemented
Tutorial actions sit below the full HUD in a readable lesson panel. Input Setup, room entry and lobby use shared cartoon styling and larger text. Settings, Credits, Input Setup, room entry and shop odds support scoped keyboard/controller Back; reset confirmations own Cancel. Pause chrome no longer captures result/practice navigation. Match format supports F / controller Y with visible hints and host authority. Training return confirmation uses practice wording. Transport diagnostics appear only in existing debug mode. Game-feel retune after a playtest comparison with the pre-layered-art build: view.fighterScale 1.5 to 1.25 and punches.jab.startup 6 to 4, both at owner request. Perfect guard, dodge cost and stamina left as they were.

## Key technical decisions
Preserved tiantian, tune values, combat controls and balance, roster layout, asset registration and progression/shop rules. Modal closure consumes one controller action and restores focus. Disabled scene input blocks menu shortcuts while controller edges continue sampling, preventing held-input activation after ads. Keypad presses retain rounded chrome and activate once on release inside. Localization rejects replacement characters. No new artwork or dependencies.

## Open questions
Portrait waist-crop consistency remains held for approved per-asset framing review. Real online pairing/background timeout and physical controller validation remain separate checks. Profile/progression screens and Veteran skins remain pending under release-plan section 8; this polish pass does not implement them. Cross reach (56 before scaling, longer than the jab) still makes the cross the neutral tool; a change is proposed to the owner but not applied. Movement speed and dodge buffer window were not retuned and remain candidates after a phone playtest.

## Known issues
Typecheck, production build, localization, navigation/keypad, game-menu, roster/grid, series, winner-result, onboarding, shop and reward regressions pass. Standard/web 16,354,182 bytes and compact/web 9,541,811 bytes pass their caps; asset keys, geometry, aliases and fighter pixels match. Brave verifies full-HUD tutorial action separation, Settings/Input Setup Back, room typing/deletion, F changing Best of 3 to Best of 1, readable control text and no browser error logs at 1280x720. Physical gamepads and real peer connectivity were not tested. Existing Vite chunk-size/import warnings remain.

## Next proposed step
Publish the validated polish and hand its checklist to Claude. Review held art framing and progression screen designs with the owner separately; verify online connectivity and physical controllers before launch. Playtest the 1.25 scale and 4-frame jab on a phone, then decide on movement speed, dodge buffer and the cross change.
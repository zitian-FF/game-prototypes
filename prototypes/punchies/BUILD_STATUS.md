## Current milestone
Saved local input layouts completed and validated on proto/punchies/saved-input-layouts from main 9ce9087. Ready for the live merge and normal WIP deployment.

## What was implemented
Settings > Input Setup > Local Inputs offers Touch, Keyboard 1/2 and Controller 1/2 editors. Save commits the selected profile; Cancel discards it; Reset defaults stages a reset. Touch buttons and the joystick hint can be dragged in a preview; Jab/Cross move together. Keyboard bindings use rounded keycaps, and controller bindings use Xbox labels and face-button colours. Runtime controls and tutorial prompts read saved bindings immediately, including after resuming a paused fight.

## Key technical decisions
Extended the registered punchies:localInputs:v1 save without breaking device assignments or old saves. Profiles remain independent. Physical keyboard codes, duplicate rejection, selected-controller rising edges, trigger threshold, held-input suppression and fixed menu navigation prevent capture leakage. Touch positions are normalized and constrained to safe areas without disc overlap; preview, runtime drawing, icons, labels and hit testing share geometry. The joystick retains its tuned radius and floating behaviour. No combat, tune, art, dependency or networking changes.

## Open questions
None for the requested scope.

## Known issues
No failing checks. Root passed typecheck, production build, input-layout/UI-input/game-menu/FirstFight/localization/portal checks and WIP release regressions. Standard and compact web builds pass budget checks and asset parity. Brave screenshots inspected at 1280x720 and 640x360: keyboard Jab remapped to Z and survived reload; controller pointer remap cancelled correctly; touch Hook dragging survived reload, applied in training and redrew immediately after saving from pause; clicking its new location performed the move. Captured browser error log is empty. Physical Xbox hardware was not connected, so controller capture, holds and disconnects were verified through automated fixtures rather than hardware.

## Next proposed step
Merge the verified PR and confirm the WIP itch.io upload. Follow up with a physical Xbox controller check when hardware is available. Profile/progression screens remain separate pending work.

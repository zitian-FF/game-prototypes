# SUPER presentation foundation

Separate approved future batch; not part of the Profile/Zombie release.

- Roster existing info area shows localized Rising Upper name and canonical star cost, bounded to the existing panel. Existing core stats remain.
- Combat action/charged label says SUPER. Saved keyboard/controller/touch semantic action remains uppercut, preserving layouts.
- HUD uses fighterSuper.starCost and superReady; one-to-four sockets centered in a bounded region next to stun. Filled sockets dim while ready so text is legible.
- Charged glow text style is cached; pulse uses alpha/scale only. Reduced motion holds a steady state.
- VFX helper dcf40e9 integrated by Art: shared 96KiB generated atlas, two narrow edge wisps, no text/socket interior overlap. Hidden UI/spent/lost charge clears readiness immediately; scene lifetime cleanup owned by helper.
- Charge-loss shatter is specifically a sweet hit crossing ready to below cost; Logic/VFX own event/cue. No generic attack-cancel additions by Art.
- Logic owns all locale and Sheet changes, canonical config and tutorial semantics. No unique abilities, cost/stat/tuning changes by Art. No new image files.

Focused checks completed against Logic core7aa3d62 (locale follow-up pending): TypeScript, HUD charge/spend/hide/reduced-motion regressions, cost1–4 geometry bounds, actual VFX helper lifecycle/perimeter tests. Build owns final device/render/package review; no direct build/deploy trigger.

Final full i18n gate must run after Logic locale/tutorial/Sheet follow-up; labels deliberately use agreed keys without temporary English literals. Original prerequisites: Logic7aa3d62 and VFXdcf40e9. Apply UI-only commit after originals; do not duplicate local dependency cherry-picks.

Owner follow-up: roster stats backing now extends103..225, name/cost at180 and description at202 (184px advanced-wrap width,30px bounded height). Portrait visible-bottom315 retained; body presentation budget82px keeps tallest reviewed1.05 factor above229, leaving description/backing gap. Name/archetype, skin arrows/tray and footer/button coordinates unchanged. Focused animation fixture verifies stable text/objects/no extra tween rasterization and description/portrait/control separation. Translation key super.rising_upper_description is owned by Logic; strict localization/device-render gate waits its follow-up. No combat/rank stats changed by this layout.

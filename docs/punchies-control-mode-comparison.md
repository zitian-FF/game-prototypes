# Settings controls comparison

Art branch `proto/punchies/control-mode-comparison`, base `9c30884`. One UI module plus five new keys in all six locales (coverage 510). No simulation, tuning, inputs, assets or publication changes.

`controlModePanel` retains the existing per-side selector callback/persistence. Passive Modern/Classic descriptions compare simple Normal+Super and automatic defence against full damage/manual control/Perfect Guard. Modern damage is 20% lower; contextual punch selection/no Perfect Guard remain tradeoffs. Supporting copy says no stamina, retained fatigue and a brief auto-dodge window after leaving neutral, with normal dodge penalties. Verified against current `sim/modernControls.ts` (`.8`, 12 frames) and `sim.ts` mode guards, not the older draft boundaries.

Native translation Sheet A532:H536 contains `controls.modern_pros`, `controls.modern_cons`, `controls.classic_pros`, `controls.classic_cons`, `controls.modern_note`. Existing cells preserved; new rows use peer wrap formatting and auto-sized heights. Values verified against source and native Sheet screenshot.

PASS tsc, locale check, existing Modern UI preferences/cleanup suite. Brave 640x360 rendered all six languages, no new console errors; P2 Classic persisted across reload, then original Modern restored. Descriptive text has no input regions or button chrome. Physical Xbox and production artifact checks remain unclaimed. Brave reconnected as browser5 during review; own tabs closed and viewport reset; Vite stopped.

Receipt/screenshots: outputs/control-mode-comparison-v1 under Art project. Main+Build should integrate this small commit in the next batch. No new deployment trigger.

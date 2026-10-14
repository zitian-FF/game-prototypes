# Settings controls comparison — designed-card follow-up

Art branch `proto/punchies/control-mode-comparison`. Initial comparison `edfab84` based on `9c30884`; the follow-up replaces the plain comparison with passive enamel/material cards, M/C emblems, separate Advantages/Trade-offs rows and check/minus markers. P1/P2 badges and card borders follow selected modes. Two additional section keys in six languages (coverage 512). No simulation, tuning, input contracts, assets or publication changes.

`controlModePanel` retains the existing per-side selector callback/persistence. Passive Modern/Classic descriptions compare simple Normal+Super and automatic defence against full damage/manual control/Perfect Guard. Modern damage is 20% lower; contextual punch selection/no Perfect Guard remain tradeoffs. Supporting copy says no stamina, retained fatigue and a brief auto-dodge window after leaving neutral, with normal dodge penalties. Verified against current `sim/modernControls.ts` (`.8`, 12 frames) and `sim.ts` mode guards, not the older draft boundaries.

Native translation Sheet A532:H536 retains the five accurate comparison keys unchanged. A537:H538 adds `controls.advantages` and `controls.tradeoffs` in all six languages. Existing cells preserved; new rows use peer wrap formatting and auto-sized heights. Values verified against source and native Sheet screenshot.

PASS tsc, locale check, existing Modern UI preferences/cleanup suite. Brave 640x360 rendered all six languages; P2 Classic moved its badge to the Classic card, persisted across reload, then original Modern restored. Descriptive cards/rows have no input regions or button pressed/hover states. Original selectors and MenuNav keyboard/Xbox registration retained. Physical Xbox and production artifact checks remain unclaimed. Own tabs closed and viewport reset; Vite stopped.

Follow-up receipt/screenshots: outputs/control-mode-polish-v2 under Art project. Main+Build should integrate the follow-up after `edfab84` in the authorized staging batch. No new live-deployment trigger.

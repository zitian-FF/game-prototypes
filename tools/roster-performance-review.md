# Roster navigation performance review

Base: 7281eab. No source artwork, downloads, simulation, or tuning changes.

Root causes: panel change detection compared the uppercut object to skin, causing confirm/status changes to replay the fighter clash; first-use palette portraits recomputed polygon membership and target HSV for every pixel; palette variants redundantly scanned identical alpha bounds. Fighter identity now owns slide/impact animation. Two reused impact graphics prevent allocation on each clash. Material scanline masks cache at most eight portraits; transient shade memo is capped at 50,000 entries. No portrait resolution reduction.

Desktop Brave actual scene, same mock-owned inventory and forceSetTimeOut preview clock, two full roster/skin navigation cycles: 82 panel rebuilds and 222 cached textures both versions. Original render P95/max 39.6/349.4ms; fixed 10.6/87.3ms. Frame P95/max 72.7/372.8ms -> 44/114.4ms. Frame median 28.9->29.6ms: preview clock/automation cadence prevents claiming foreground 60fps. Confirmation added3 tweens before,0 after. Settled active tweens0 both. First-use synchronous palette upload can still exceed a frame; this reduces its cost rather than promising zero cold stutter. Palette mask CPU equivalence and exact full RGBA comparison passed all21 palettes. Node isolated VM CPU test improves each palette by roughly63-83%; this is a microbenchmark, not browser FPS.

Regression: actual render method tests initial/confirm/status/skin no replay, new fighter slide, mid-slide status preservation, reduced motion. Material scanline grid equivalence, material protections, runtime palettes, all147 recolours, roster ownership/navigation, roster grid, UI input, TypeScript and Vite production build passed. Existing build warnings: Git ownership version-stamp fallback in elevated shell, locale dynamic/static import and Phaser bundle size. Release version stamping remains Build's job.

Reproduce preview: npx vite --host 127.0.0.1 --port 5214, open /game-prototypes/tools/roster-performance-review.html. This QA page uses in-memory collection storage; it never changes player saves. It is not included in production entrypoints.

Evidence: art workspace outputs/roster-performance/*.json and mobile-roster.png. Use ?mobile for a 640x360 CSS preview surface. Browser viewport override was not honored by the extension. Mobile landscape is a desktop responsive proxy, not physical-device performance. No new asset bytes; Build should measure final packaged delta after combining Logic/VFX.

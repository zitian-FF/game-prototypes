# Focused combat VFX pass

Baseline: `e1acc94`. This pass changes rendering only: directional sweet/sour impact bursts and uppercut flame silhouettes. It does not change simulation, damage, tuning, punch timing, fighter artwork, audio, UI, camera shake, or hit-stop. No imported assets, R2 uploads, textures, localisation keys, emitters, or additional post-processing passes.

## Implementation

- `render/combatVfx.ts`: eight scene-owned reusable Graphics bursts. A hard asymmetric contact flare gives way to directed, cel-coloured shards. Sweet bursts last 220 ms, sour bursts 145 ms; the caller's existing intensity and strike direction remain the inputs. Twelve streaks and three flecks maximum per burst. Overflow replaces the oldest burst. No particle/tween allocation. Update listener and Graphics are destroyed on shutdown.
- `render/Effects.ts`: delegates existing strike feedback to the pooled burst renderer. Other feedback stays intact.
- `render/puppet.ts`: uppercut fire retains its existing attachment, intensity, dimensions and timing; draws authored curled tongues with red/orange/gold/cream shading into the existing puppet Graphics.
- World depths remain 61 for sparks and the puppet's existing 10.4 for flames. Pooled sparks are adopted into the existing ring container and follow its fit/zoom. Canvas uses the same geometry, without requiring WebGL-specific effects.

## Evidence and limits

Screenshots and JSON evidence are outside Git at `outputs/combat-vfx-pass/` in the main art workspace. `before-*-desktop.png`, `after-*-desktop.png`, `before-*-mobile.png` and `after-*-mobile.png` show sweet, sour and uppercut contact previews. `actual-training-hit-desktop.png` and `actual-training-hit-mobile.png` show real keyboard movement/punch input in Training; the review harness freezes the first confirmed damage frame for inspection. `after-sweet-mobile-midzoom.png` and `canvas-midzoom.png` show camera alignment. These are local browser captures, not proof of a deployed build or a physical mobile device.

At 640×360, the same sweet-hit fixture changed from 129 world objects / 19 active tweens / 8 WebGL draw calls to 121 world objects / 3 active tweens / 7 calls. The remaining three tweens belong to unchanged damage/callout feedback. Idle adds eight reusable empty Graphics objects. Burst stress reaches the hard cap of eight, then drains to zero active sparks and zero tweens; observed peak draw calls were 11. Twenty browser scene restarts retained the same object/pool counts. Samples reported 60 FPS; these short desktop-browser samples are not a sustained hardware performance benchmark. Texture and emitter increase: zero. Existing ring post-processing is unchanged.

Tests: typecheck, full build, combat VFX lifecycle, actual pooled-object Canvas/WebGL world adoption and zoom alignment, existing local feedback. Build owner runs the remaining integrated regressions and standard/compact package budgets before release. Asset-package increase: 0 bytes; code-package increase is measured by the Build owner.

## Skill reference ledger

Read before implementation: `phaser-aaa-graphics-builder/SKILL.md`, `references/implementation-blueprint.md`, `render-recipes.md`, `model-recipes.md`, `checklists/performance-safe-visual-detail.md`. Read before this handoff: `visual-scorecard.md`, `checklists/aaa-game-quality-gate.md`, `checklists/aaa-visual-scorecard.md`. Asset source: procedural Phaser Graphics only. Credential probe: not needed, no generator invoked. No claim that this focused pass establishes whole-game AAA/premium quality; unrelated surfaces are explicitly outside this authorization.

## Release ownership

User approved this finite VFX rollout separately. Build and deployment owns reviewed PR, merge and normal live-WIP deployment after its checks. Do not bundle progression, Zombie or Elo into this release. Art must not create a PR that auto-merges before Build's regression gate.

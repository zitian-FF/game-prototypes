# Modern / Classic UI contract — 14 October 2026

Art accepts Logic's proposed interface: `ControlMode = 'modern' | 'classic'`; immutable `FighterOptions.controlMode`; optional held `FrameInput.normalAttack`; existing `uppercut` remains Super. Logic owns sim/types, input sampling/packing and intent-layer changes. Art owns TouchControls, Hud, Settings presentation and tutorial selector presentation. Logic owns match mode propagation, tutorial curriculum/scene state and first-fight behavior.

UI receives the canonical mode of each fighter from match state. It never substitutes local preferences for received match modes. The local side selects TouchControls mode; each HUD side shows its own badge and hides STM independently when Modern. Settings persist each local-side preference; existing Classic layouts/keybindings remain untouched. Settings changes apply next match.

TouchControls accepts an explicit mode (Classic fallback for existing callers until integration); Modern Normal writes held input through `IntentLayer.setNormalAttack(source, held)` and Super uses `tap('uppercut')`. Logic supplies `setNormalAttack` and clears held sources on `clearAll`; sampling preserves it. Touch controls reset on disable, hide, pointer cancel and scene shutdown. Modern shown IDs: stick/normalAttack/uppercut/fatigue. Classic IDs unchanged.

Modern layout: large blue Normal Attack mitt button lower right, smaller gold Super above it with charge/ready states, unchanged left movement stick. Rounded material buttons with one restrained outline. No manual guard/dodge or STM graphics. Mode badges: M in cyan rounded square, C in gold diamond; passive status, separate from hamburger.

Tutorial selector is a two-choice Modern/Classic control path with both labels visible and clear selected state. Its callback is scene-local, never writes saved match preference. Art provides presentation helper; Logic binds scene/curriculum reset and progress. Copy is localized; production keys must be aligned before release.

Implemented API: `FightStage.setControlModes(modes: ControlModes, normalAttack: NormalAttackSink)` binds HUD and the local side. `TouchControls.setMode(mode, sink)` requires a held-input sink for Modern; it throws rather than silently mapping Normal to Jab. Logic binds `(source, held) => stage.intents.setNormalAttack(source, held)`. Call once after canonical whole-match mode creation or tutorial path recreation, not every frame. Classic fallback preserves older callers until Logic explicitly wires them.

Saved schema under existing `KEYS.localInputs`: `controlModes: {p1:'modern'|'classic',p2:'modern'|'classic'}`. `input/controlPreferences.ts` exports `loadControlModes(): readonly [ControlMode,ControlMode]` and `saveControlMode(side:0|1,mode)`. Missing/corrupt mode defaults Modern, device/layout updates preserve the mode fields.

Tutorial presentation API: `tutorialControlPath(scene,x,y,initial,onPath,depth=130)` returns `{setMode,destroy,hit}`. Logic owns mounting it and scene-local curriculum/reset/progress; no automatic settings mutation. Place near tutorial header; don't overlap coaching or hamburger.

Source baseline: ad73923c279bff06c9b6d5d20256edd3f3ad6e72. Art worktree: work/punchies-modern-ui. Presentation adapter implemented; gameplay integration and tutorial mounting pending Logic. Focused typecheck, input/layout/preference/lifecycle tests, review build and Brave mixed HUD/settings rendering pass. No integrated gameplay or online-mode claim. Native Sheet rows519–523 updated with five keys in six languages.

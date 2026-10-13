# Tyke gloves / Tee materials — focused Art handoff

Base: 9a720c5. No tune, combat dimensions, glove asset swaps or bitmap changes.

Tyke's canonical left/right images were already anatomically assigned correctly. The diagonal cuff-to-centre vector was being treated as a vertical glove axis. `gloveRegistration` now receives anatomical hand and resolves Tyke's source cuff axis/distance per hand, using source registration (.22 width sideways, .32 height downward). All other characters retain their existing registration. The arm wrist remains at the authored cuff after rotation.

Tee now has separate authored region masks for white jacket fabric, dark clothing and glove leather, with exclusions for hair, skin and signature accents. Head/ponytail regions remain protected. Neutral pixels are tinted with continuous saturation/dark/highlight rolloffs and source value shading; bright highlights on dark leather remain exact. Masks use bounded scanline caches, without a new mask bundle or asset packing project.

Focused verification:
- `node scripts/test-punchies-tyke-gloves.mjs`: actual Puppet.draw, 4 Tyke skins, idle/guard/jab/cross/hook, 4 facing directions (80 cases), canonical source binding and finite transforms; authored cuff equals actual armPose wrist to <1e-6.
- `node scripts/test-punchies-tee-materials.mjs`: all 3 Tee palettes and 9 portrait/rig pieces; protected RGBA, alpha, head and both tail identities, smooth shade ordering, reused masks. Optional PUNCHIES_COMPACT_LOOSE selects actual compact input directory. Both standard and actual compact tested: 2,904,819 protected pixel checks; 689,994 recoloured material pixels.
- Existing material-mask and runtime-palette regression tests passed. TypeScript passed after generating ignored version files. Diff whitespace check passed.

Evidence (Art workspace outputs/tyke-tee-material-fix): source-parts.png; source-palette-comparison.png; compact-palette-comparison.png; tyke-runtime-pose-comparison.png; compact-source-comparison.json. Pose images are offline composites of transforms captured from actual Puppet.draw with renderer mocks, not browser gameplay screenshots. Shader comparisons use decoded actual runtime assets.

Compact archive SHA c8ae7287a817b622c1913d99c0cd2605ee9e8e625dce1cdcd4cfe7be8eeef600 matches live149 receipt. Compared compact loose files byte-for-byte with that archive. All inspected Tee/Tyke rig files equal standard source bytes. Tee portrait has identical 766x700 registration but changes 128686 -> 95350 bytes through compact recompression. Thus rig issues are not compact compression regressions; compact portrait colour noise is handled by the same protected-region/smooth shader path.

Limits: no live browser or physical mobile render validation this batch (Brave native activation failed access denied/minimized). Build owns final compact gameplay visual and combined regression/package validation. No full package build performed. No R2 art replacement required; this batch changes code only. Future skins with new art would need new authored regions rather than reusing Tee's base geometry. Mask bundling remains a separate unapproved proposal.

# Nadia torso registration correction

Source alpha>=128: Nadia torso111x128 full visible128; Mia90x128 visible113px. Shared torsoHeight40 produced Nadia40px high/34.69px wide versus Mia35.31px high/28.12px wide, with Nadia head23.2x24 vsMia24.4x24.

Measured presentation factor .79 yields Nadia31.6px high/27.4px wide. It follows Mia visibleheight35.31 × petite portrait identity ratio.82/.92≈31.47. Head registration, glove/boot sizes, fist paths, hip/ankle locations, movement scale and simulation are unchanged. No new art or neck stump.

Nadia-only shoulder connector roots move from±13.5 to±10.665px, because original roots sat outside the reduced opaque shoulder caps. Actual source-alpha samples pass at both roots and fixed hip roots across ±22degree torso twist and0/1.5/2.5px hit snap. This is a necessary local attachment adjustment, not whole-rig or hitbox scaling. Every Nadia palette uses the same registration.

Focused test scripts/test-punchies-nadia-torso.mjs; existing limb geometry regression. Build reserved actual Puppet/FightStage screenshots idle/move/guard/jab/cross/left-right hook plus palettes in next combined review. Runtime/device visual proof pending Build; no separate full build or deployment trigger.

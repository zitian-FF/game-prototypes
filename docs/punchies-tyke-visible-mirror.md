# Tyke visible glove mirror quickfix

Owner explicitly requires visually opposite thumb orientation, superseding pivot-only fix. Actual Puppet.draw now sets flipX=true on both Tyke glove GameObjects (base and cached palettes), and sets flipX=false on other fighters. No asset regeneration, palette-source edits or gameplay/tune changes.

Reflect measured source knuckle X .44/.56 -> .56/.44 and cuff X .70/.30 -> .30/.70. Keep Y .33/.82 and authored scale. Registration recomputes axis from mirrored cuff vector, maintaining cuff-to-wrist equality under Phaser's documented texture-center mirror. Compile and actual Puppet idle/guard transform+flip flags/wristjoin focused test pass. No broad40-direction fixture rerun.

Build must produce one large actual-render before/after idle and guard proof (source baseline7d47 versus thisSHA), preserving current gameplay/promotion changes. Offline transforms alone are not browser appearance evidence. Tyke quickfix independent from Zombie/productionpromotion; stage first for ownerreview.

# Kai Chen staging draft

Based on released 3f33ab1. Production balance is not approved. Runtime CHARACTER_IDS and isCharId exclude Kai outside STAGING_BUILD; all four progression items are earnOnly and artPending in production. Restored fighter and skin ownership cannot bypass readiness. Kai is fixed at roster slot29; milestone grant/catch-up is Logic-owned at levels6/14/22/32.

Requires Build asset payload62c069ab6463c332f9280dd355f6c010130cc694: six canonical WebPs141952 bytes total, manifest SHA256 bedd7a940c37fadc78b56a18dcc333ba30941178c660c36a25061741022bc53e. No duplicated palette rasters. Both left limbs use right canonical source mirrored Y after recolour. Helmet uses portable 256x64 atlas (mei,kangaroo,hand,panda); final texture canvases cached by mask-v2 key. Default helmet receives mei; approved palette emblems retain authored orientation.

Corrected semantic skin exclusion on neck/chest, elbow and exposed fingers. Jacket cream highlights follow palette hue. Preview-only lossless rasters prevent QA encoding speckles. Source palette review2,162,368 protected RGBA/alpha checks passed.

Exact Balancer object inserted from kai-staging-character-tune.json SHA256 dd210200ec212d7cc00524e60cfc10ce4f83df421bd170d00e9ba4db493a50df. HP85/STM95/stun80/walk117, proportion.90. Hook9 and six unfatigued throws (all spend stamina), long dodge1.15speed/1.25iframes/1duration, two-star Upper16. Logic daf09df +1a907d owns actual behavior and metadata; locale/Sheet alignment separately owned Logic. No unrelated fighter stat edits.

Focused checks: root tsc after version generation; staging/production availability and restored ownership, exact four earnOnly rewards/no chest pools/slot29, draft values; actual Puppet.draw80cases covering four skins/five poses/four facings with cuff-to-wrist equality. scripts/test-punchies-kai-rig.mjs accepts PUNCHIES_KAI_ASSETS or defaults tracked asset-patches/kai. Browser appearance and full gameplay are Build/owner review, not claimed by offline checks.

# Tee staged indexed-mask pilot

Owner authorized ONE bounded runtime pilot before mass migration. No other roster portrait or rig changes. No variant bitmap downloads.

Asset payload: prototypes/punchies/asset-patches/materialmask_tee.png → staging assets/loose/materialmask_tee.png, byte-exact indexed PNG14831B,766×700 matching canonical/compactportrait_tee.webp. JSON manifest records SHA256/basehash/dimensions/codec. Build must overlay this file in stage art zip, update asset manifest/hash and retain PNG; pack-assets materialmask rule bypasses resize/recompression. This commit does not upload R2 or replace live art profiles.

Only explicit STAGING_BUILD enables the pilot. Missing/invalid/mismatched mask falls back to unchanged current palette path. Unique skins/defaultTee/otherfighters/rigparts are untouched. Material ID0protected,1blackcloth,2gloves,3whitejacket,4highlightink. PNG RGB uses48×ID so Canvas alpha unpremultiplication rounding cannot change its semantic class. Alpha16coveragelevels; source portrait alpha always restored exactly.

Decode once into two compact arrays, cached by sourceimage WeakMap. Prewarm under existing ArtBoot splash. Palette math runs once as before, protected pixels restored and coverage blended once; ONE finalCanvasTexture cached under indexed-v1 key (avoids collision with pre-pilot texture).180 repeatedcachedcalls allocate/decode/compose nothing. Non-pilot fast paths retained. No layered portrait animation.

Focused proof across3Tee palettes:1414188protectedpixel checks,1608600alpha checks, no source mutation. Canvas alpha-rounding simulation retains material+coverage exactly; malformed/dimension mismatch safe; boot decode reuse and cachedsingletexture tests. Node CPU decode~35ms once underboot, maskcomposition~11–12ms/portrait. BrowserCanvas/WebGL actualtiming/GPUoverhead notclaimed. Idealbase4+classcoverage2+output4bytesperpixel≈5.36MB; actual browserbuffers/textures addoverhead. FinalportraitRGBA2.14MB same asoldcache plussharedmaskpayload/GPU/map.

TypeScript, stricti18n476keys and affected runtimepalettecache regression passed. Build after Main trigger owns combined stage zip/cap check, real640×360 edge comparison, Canvas+WebGL rendering, cold/warmperformance, decoded memory and no artifacts. Pilotcomparison/neck/hand/sleeveproofs remain in Art outputs/tee-indexed-mask-pilot. No mass migration or itch deployment decision is implied.

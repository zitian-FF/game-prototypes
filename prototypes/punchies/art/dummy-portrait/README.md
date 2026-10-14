# Connected wooden training dummy portrait

Owner-requested replacement for the rejected disconnected portrait. One plain
wooden head and torso; two readable shoulder/upper-arm/elbow/forearm/wrist/fist
chains. Bold navy contours, honey wood cel shading, restrained grain, red target.
Waist-up framing with top/side margins and the visible waist at the canvas bottom.

| Profile | File | Canvas | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| Standard | portrait-standard.webp | 1100x1166 | 140898 | 8b0eb13c99f3577ea22a8dfe0371a47c7711cefb8c8b4233e3cbfb802f0da0ff |
| Compact | portrait-compact.webp | 730x768 | 58654 | 98f297cffd12d960179bf248ab3abf56392d9118d481cff7b4bb5bc6f39f748f |

The canonical runtime texture key remains `punchies:portrait_training_dummy`.
Both profiles export `loose/portrait_training_dummy.webp`; the obsolete PNG
alternative is removed to avoid duplicate registration. Standard uses WebP Q90,
compact Q78, both alpha Q100 and within the existing 1280/768 portrait limits.

`applyDummyPortrait` runs at the end of standard packing and after profile art
overlays, before edition selection. `asset-profile.json.dummyPortraitArt` records
the hash. The live training dummy head/body/glove parts, atlases, rig and gameplay
are unchanged. Existing character selection alpha-bound/bottom anchoring applies.

Built-in imagegen made this new portrait using Marco/Bruno for style only. The
1134x1387 PNG master, prompt, review proof and derivative manifest are preserved
at Art `outputs/training-dummy-portrait-v2`. Derivatives crop empty margins only,
uniformly fit profile limits, and keep the complete connected silhouette.

This was completed after Build cut batch 9f992a0; integrate in the next batch.

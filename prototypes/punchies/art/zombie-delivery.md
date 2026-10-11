# Generic zombie rig v1 — review delivery
2026-10-11. Artwork only; no survival stats or tuning. Four top-down transparent masters: green head, ragged muted plum torso, ordinary fist, brown boot. Torso front is chest, hidden center connection, no neck stump. Existing navy contours and restrained cel shading.

Lossless source archive: https://drive.google.com/file/d/1Ih4GJYtnQSYDyiTrFA7qOkvrQ1mvTdMn/view
Archive SHA256: 61adb683c4a6a6e37ea7a68546ff6a806d3cd933c6fe20f60b99a71488887f15
Drive metadata readback verified file/folder and 1,825,020 bytes; remote checksum was not exposed.

Local staging: outputs/zombie-v1/runtime/loose (outside Git). Four lossless WebP parts + mirror metadata total 47,413 bytes. Standard/compact should share identical prepared pixels. See zombie-inventory.json for per-part hashes, dimensions, exact source crops and pivots. Merge mirror entries into the existing part-mirrors.json; never replace other aliases. Do not ship the full generated sheet or source ZIP.

Puppet visualId and FighterView.visualId are optional render-only overrides. Generic enemies retain Marco stat identity and render visualId zombie; no zombie entry is added to tune. Hand source points upward; existing glove axis pi/2. Left fist flips x; left boot flips y. No duplicated mirrored runtime files.

Preparation: copy the archived generated-sheet.png to outputs/zombie-v1/masters, then run `node scripts/prepare-punchies-zombie.mjs outputs/zombie-v1`. For review copy runtime/loose contents into tools/zombie-review-assets (untracked), run Vite and open tools/zombie-review.html in Brave. Review harness is not a production build entry; it uses no saves.

Brave proof in outputs/zombie-v1: assembled-and-parts.png, guard-and-parts.png, jab.png, leg-connections.png. Actual Puppet rendered complete enlarged and combat-scale assembly; rest/guard/jab/walk and hidden-upper-layer boot joins inspected. Existing torso naturally occludes most boots at rest; no geometry was retuned to expose them. Light checker and dark stage edges inspected; no console boot errors. Typecheck passes. Build must stage art, regenerate both release profiles, verify parity and budgets before deployment. No live R2 overwrite, merge or release performed here.

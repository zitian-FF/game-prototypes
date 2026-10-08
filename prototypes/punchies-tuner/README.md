# Punchies Balance Workshop

Development URL: `/game-prototypes/prototypes/punchies-tuner/`. Vite discovers its `index.html`, so the regular Pages build includes it without changing game UI or the itch target.

1. Open the page in Brave and click **Open tune.json**.
2. Select `prototypes/punchies/tune.json` in your local checkout. The game imports this JSON file; it is not an executable JavaScript file.
3. Pick a fighter and stat category. The editable **Tune value** is the stored multiplier or offset. **In game** and **Marco** apply the actual game formulas. Positive/negative denotes a numerical difference, not better/worse.
4. **Save to opened file** asks the browser for write access. The save rereads after permission is granted, merges only the numeric fields edited in this session, and aborts on a same-field conflict. Unrelated changes from Claude and unknown future fields are retained. This is a conflict check, not a lock against external processes writing during the final write.
5. Commit the changed file through your usual Git workflow or use the game's tune sync after it is committed. This page does not commit to GitHub. **Download JSON** exports a replacement copy on browsers without direct file access.

**Shared rules** exposes health/stamina/stun/movement/fatigue/stars and every shared punch property. Block/dodge are shared by the current simulation, so they cannot honestly be presented as independent character overrides. Their differences from Marco are 0%. Uppercut damage is Cross base damage × uppercut factor × character uppercut multiplier. Reach/hit radius include actual fighter size. Zero-valued Marco baselines show an undefined percentage rather than Infinity.

Files are parsed as JSON, never evaluated. The page requires no GitHub credential or remote service. Opened file handles are not persisted; draft JSON is stored only in localStorage, which is shared with other pages on the same origin. Only use the tool with game tuning files, not secrets. Other pages and scripts hosted on this origin must also remain trusted. HTTPS and a user gesture are required for native file access.

Tests: `node scripts/test-punchies-tuner.mjs` and `node scripts/test-punchies-tuner-file.mjs`. Native file picker permission prompts still need a manual Brave check; the file transaction logic is tested with mock handles.

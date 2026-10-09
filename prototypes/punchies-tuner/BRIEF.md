# Punchies Balance Workshop

Standalone GitHub Pages web tool for ZeeTea to edit Punchies `tune.json`. Group each character's values into core (HP, stamina, stun resistance, movement), jab, cross, hook, uppercut, block and dodge. Show stored values, effective in-game values, Marco's effective values, and signed percentage differences. Include all current character stats and shared punch/block/dodge properties.

Use existing tune metadata for descriptions and allowed ranges and existing simulation formulas for calculated values. No game balance edits or localisation changes are part of this tool's implementation.

Open and save an explicitly selected local JSON file through the browser File System Access API, with import/download fallback. Preserve unknown fields and unrelated concurrent edits. Refuse same-field conflicts. Drafts may be retained locally; no secrets, file uploads, remote commits or account authorisation.

User-authorised extension: add an optional local-only GitHub companion. Load latest reads the actual default branch's `prototypes/punchies/tune.json`; explicit Save commits only validated edited tune fields using this PC's authenticated GitHub CLI. Retain the server-side baseline and file SHA, preserve unrelated changes and reject same-field conflicts or write races. Show commit and workflow status. Bind only loopback and reject cross-origin writes. Never expose GitHub credentials in browser storage or Pages assets. The published Pages tool retains its local-file mode; implementation development must not change real tuning values.

Add Base to the fighter selector: the shared raw values from which every fighter derives its stats. Base uses raw-value tables rather than percentage comparisons. Include core, punch, block and dodge properties. Log previous/new Base values in numbered timestamped revisions, persisted with the tuning file and retained through local and GitHub saves. Base is a workshop entry, not a playable character; do not change tuned numbers as part of implementation.

## Perceived stats and archetypes

The coloured Health, Endurance, Speed, Power and Reach preview uses the same formulas as the game character selection screen. Base is the 80% benchmark for every bar; other characters scale against Base and bars cap at 100%. Numerical controls update the preview immediately. Base controls continue to show raw values.

The Character archetype textbox edits the fixed localisation key shown beside it (`char.base.nick` or the fighter's existing `char.<id>.nick`). Saved text lives in `balanceWorkshop.archetypes`, survives file/download/GitHub saves, and becomes the game's English fallback after tune sync or rebuild. The translation-sheet export includes these English overrides; existing translations remain unchanged and need review after wording changes. Text-only saves do not create a numeric Base revision. Same-key concurrent text edits are rejected; unrelated changes are preserved.

Run `npm run test:tuner:preview` for formula parity, the 80% benchmark, bar capping, text validation, merge conflicts, snapshot/restore and translation export checks.

# Punchies Balance Workshop

Standalone GitHub Pages web tool for ZeeTea to edit Punchies `tune.json`. Group each character's values into core (HP, stamina, stun resistance, movement), jab, cross, hook, uppercut, block and dodge. Show stored values, effective in-game values, Marco's effective values, and signed percentage differences. Include all current character stats and shared punch/block/dodge properties.

Use existing tune metadata for descriptions and allowed ranges and existing simulation formulas for calculated values. No game balance edits or localisation changes are part of this tool's implementation.

Open and save an explicitly selected local JSON file through the browser File System Access API, with import/download fallback. Preserve unknown fields and unrelated concurrent edits. Refuse same-field conflicts. Drafts may be retained locally; no secrets, file uploads, remote commits or account authorisation.

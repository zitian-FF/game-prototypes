## Current milestone
Standalone tuning tool ready for review and GitHub Pages.

## What was implemented
Four-character editor grouped into core, four punch types, block and dodge. Stored values, effective values, Marco baselines and signed deltas. Shared rules, per-field reset, changes review, browser draft restoration, JSON download, native local-file open/save and conflict-aware selective merge.

## Key technical decisions
Separate prototype folder and automatic Vite entry discovery. Reads existing tune.json/meta and simulation punch formulas. No tuning values, game scenes or localisation files changed. No credentials, remote commits or uploads. Save checks the latest file after obtaining permission and preserves unrelated fields; same-field conflicts abort the writable stream.

## Open questions
User was asked whether saving means the local file or direct GitHub commits. Local-file saving is implemented; remote account access remains out of scope pending that preference.

## Known issues
Native Brave permission/picker flow requires a manual test. Model, merge and file transaction logic have automated tests. Percentage signs are numerical, not gameplay desirability. Conflict checks cannot lock out external file writes during the final transaction.

## Next proposed step
Try the selected-file save flow on a copy of tune.json, then tune and commit balance changes through the usual workflow.

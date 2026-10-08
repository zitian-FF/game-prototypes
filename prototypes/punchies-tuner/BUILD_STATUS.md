## Current milestone
Local-only GitHub load/save companion implemented; implementation PR awaits user review/merge.

## What was implemented
- Optional local workshop at http://127.0.0.1:5187/ with Windows double-click launcher and npm command.
- Load latest from GitHub's actual default branch, explicit selective Save, commit link and manual workflow status.
- Server-side baseline, file SHA compare-and-swap, validation and existing three-way merge.
- Mock HTTP integration tests and Brave load/edit/save/build-status verification. Real GitHub read verified without tuning writes.

## Key technical decisions
- Reuse model.ts validation/merge; fixed repository and tune.json path, existing OS-authenticated gh CLI, no new dependencies.
- Loopback only; exact Origin/Host, JSON POST/custom header, session capability, dedicated static build and CSP. Never publish server/credentials.
- Preserve Pages local-file workflow and unrelated game/localisation work; no real tuned values changed.
- User explicitly requested review before merging implementation, overriding repository auto-merge default.

## Open questions
None.

## Known issues
- Local trusted-PC tool only; other local software/extensions are outside its security boundary.
- Native file picker permissions remain a manual check; existing file transaction tests pass.
- Commit success does not guarantee deployment success; check matching workflows manually.
- Local checkout is not updated by remote saves; restart requires a fresh GitHub load.

## Next proposed step
Review/merge the implementation PR, then launch the companion and use Load latest before real tuning edits.

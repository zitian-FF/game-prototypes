## Current milestone
Roxy, Nadia and all six language choices prepared for live deployment.
## What was implemented
Roxy and Nadia have independent portraits and overhead rigs, mirrored glove/foot aliases, locked fighter-pool entries, tuning metadata and the reserved second-row roster positions. Settings now offers English, Japanese, Korean, Chinese, Spanish and Arabic through 382-string frozen locale tables imported from the private translation Sheet. Longer shop and button labels fit their available widths.
## Key technical decisions
Preserve all existing owner tuning and workshop history. New fighter balance starts from Marco pending owner tuning; Nadia uses petite proportions. Verify both R2 art uploads by SHA-256. Pack repetitive tune metadata and locale tables without changing runtime values; standalone packages omit editor-only history and duplicate embedded art indexes. Keep source masters and recoverable source archives outside Git and shipping bundles.
## Open questions
Native-language copy review and distinct Roxy/Nadia balancing remain future work.
## Known issues
Remaining machine-translated copy is not native-reviewed. The private Sheet is not published or exposed for automated unauthenticated imports. Compact delivery has little budget headroom and must retain its mandatory 10 MB gate.
## Next proposed step
Merge the validated release, verify itch.io deployment and the published tuning roster, then hand off native copy review and fighter balancing.

## Current milestone
Validated presentation release, ready to merge and deploy.
## What was implemented
Epic/Legendary reward labels; settings language flags; higher tutorial panel; charged Uppercut glow; outlined hit sparks with subdued sour hits; layered pre-fight flames; shared Kunoichi waist crop; no repeated selection clash on confirmation; Nadia's approved V-sign portrait in both R2 art profiles. Approved combat terminology is regenerated from the private Sheet.
## Key technical decisions
Preserved main's tuning and individual Uppercut charges. Lossless build-index packing reconstructs exact frame names and retains full asset hashes. Sources and prior R2 bundles remain recoverable outside Git. Standard package 17,192,088 bytes; compact 9,970,545 bytes. Nadia standard portrait 187,768 bytes, compact 80,568 bytes.
## Open questions
Automatic approval review blocked aligning legacy char.*.nick Sheet cells with Claude's playstyle descriptions and adding two new base/tutorial rows; owner approval requested. Further editorial term changes remain unapproved.
## Known issues
Compact package has 29,455 bytes headroom. Existing localized archetype nicknames still need alignment with main's new playstyle descriptions; no speculative translations included.
## Next proposed step
Merge, monitor deployment and verify the live build; align the Sheet when approved. The English tutorial stamina text now matches the exhausted rules (guard and dodge work at half strength); the five translated versions still describe the old rule until the Google Sheet row tutorial.the_blue_bar_is_stamina is updated and re-imported.

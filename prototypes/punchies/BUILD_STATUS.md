## Current milestone
Punch Token display added to the main-menu Shop button; ranked ownership direction agreed.

## What was implemented
The green Shop button now contains a red-and-blue token badge with a glove symbol and initial zero balance. No wallet or ad grants exist yet.

## Key technical decisions
Draw the badge with Phaser vector graphics for sharp scaling. Ranked requires owned boxers and skins. Character balance must use stat tradeoffs; MMR alone does not remove roster-access differences.

## Open questions
Reward amounts, item prices and earning options remain unapproved. Actual rewarded ads, wallet ownership and MMR require subsequent design and implementation.

## Known issues
Token count is an initial zero display until a real wallet is implemented. Existing Phaser bundle warning remains.

## Next proposed step
Typecheck and production build pass. Verify local and released menu in Brave, then design catalog previews and earning pace.

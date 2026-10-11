// Test-build scaffold. The itch.io Current WIP slot (the default `web` build) is a test build,
// so testing aids are visible there without ?debug=1. Every portal build (CrazyGames, Poki,
// Playgama) drops them. See docs/release-plan.md, "Test scaffold to remove for the final build".
declare const __PUNCHIES_PORTAL__: string;
export const TEST_BUILD = __PUNCHIES_PORTAL__ === 'web';

// Tokens granted by the test-build shop button, enough to open every chest type repeatedly.
export const TEST_TOKENS = 999;

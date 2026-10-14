# Main-menu feedback action

Additive follow-up to Build's frozen Beta analytics candidate
`eaea7b35c8a7baf1d5e345f2ef32708dfa94df3e`; queue for the next release.
No analytics, gameplay, package/deployment or existing candidate changes.

The shared MenuScene adds a compact secondary blue button below settings/shop,
outside the Beta menu branches. It uses titleButton's release-inside pointer
handling, hover/press feedback and MenuNav keyboard/controller registration.
A code-native Discord-style face icon adds no image download. The return/error
message moves to the top of the left menu column to leave the footer clear.

Master/web, CrazyGames and Beta/web use the same action. Other portal adapters
retain their existing menus. CrazyGames permits secondary community links on
the main menu: https://docs.crazygames.com/requirements/gameplay/.

Only activation calls `window.open` with the owner's permanent invite
`https://discord.gg/jfugatFzX`, `_blank`, `noopener,noreferrer`, and a defensive
opener reset if the browser returns a child window. Boot, rendering and focus
are passive; blocked popups do not navigate away or break the game.

One key, `menu.feedback_discord`, is in all six source locales and the native
translation Sheet, `Punchies Translations!A540:H540`. Coverage is 514 per locale.
The preceding analytics row is unchanged. Native cell readback and visual proof
are in Art `outputs/discord-feedback-v1` with the menu screenshots.

Verification: TypeScript, locale coverage/placeholders, focused external-action
tests (scope, passive import/focus, exact invite, flags/opener reset, blocked
popup), actual Brave Master/Beta layout and Beta keyboard-focus/Enter activation.
Physical Xbox hardware was not exercised; its existing MenuNav path is reused.
The legacy game-menu test on this base has stale analytics mocks, independently
of this change; that harness was left unchanged for its owner to align.

`tools/discord-feedback-review.html` boots the real game with only a test DOM
readiness signal. It is not a production entry or delivered menu element.

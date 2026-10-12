# Approved title profile entry

Owner approved previously shown title-profile-entry-proposal/title-profile-entry.png for implementation.

- Top-right standard260×72 button region uses saved OWNED avatar, actual local alias, level, equipped title and XP. No mock stats or item grants.
- One shared MenuNav target opens Profile. Pointer feedback moves passive content by2px with the button. Existing title gym/ring/logo/play/shop/settings actions remain.
- Language button/flag anchors bottom-right136×32 with existing popup/selection behavior; pseudo debug locale omits a fictional flag. Old duplicate profile button removed.
- Portrait uses existing skinTexture/head crop and cached palette texture. Refresh on create/resume/group readiness, never per-frame. Shutdown/generation guard prevents stale async portrait replacement. Reset is reflected on fresh menu construction.
- Missing assets visually fall back through existing avatarTexture validation without changing saved ownership.
- Existing localization keys reused; old profile.menu key retired from six shipped tables/index. Logic asked to retire corresponding Sheet row, no concurrent Sheet writes by Art.

Focused test title-profile-entry: actual value changes, savedTeeRedline, resume/reset creation, stale group readiness, one navigation target/press response, view844×390/1033×390/844×532, no update listener, shutdown; stricti18n476keys and TypeScript passed. These are source/component harness checks, not physical browser/controller claims.

Renderer proof belongs consolidated Build review after Main trigger: check standard/compact real title at640×360+desktop, avatar+name/level/title/XP fit, long six-language text, language flag/popup and Profile roundtrip, Xbox/keyboard/touch focus. No new bitmap, asset zip change or direct deploy/build trigger.

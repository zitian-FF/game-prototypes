# Kai progression integration contract

Approved milestone IDs:
- Level6: `fighter-kai`.
- Level14: `skin-kai-kangaroo-turquoise`.
- Level22: `skin-kai-grabber-green`.
- Level32: `skin-kai-panda-pink`.

`progress-config.json` adds the named fighter and skin milestones. XP curve, cap, titles, old veteran skins and all existing chest schedules remain unchanged. New named fighter rewards use the collection ledger; no token charge or chest roll is involved.

`catchUpKaiRewards()` considers only these four approved new IDs and the player's actual XP-derived level. It never replays `applyMatch`, historical level-ups, chests, tokens, titles or XP. Persisted ownership is the idempotency record; repeated profile views/reloads do not regrant. Existing players above a milestone receive the item once when the real content is registered and ready. Both regular new level-up grants and catch-up reject unregistered, art-pending or non-earn-only Kai items. Palette grants also require Kai's fighter item to be ready. Pending milestones retry after readiness without resetting the player's rewardedLevel.

Content integration dependencies: Art owns the actual delivered portrait/head/torso/right glove/right boot, mirror aliases and approved runtime palette/emblem variants. Add real `CharId`, tune entry after the tuning handoff, roster slot29, and all four ShopItems with `earnOnly:true` and actual readiness flags. Do not use placeholder artwork or fabricated stats. Existing daily pool filters exclude earn-only rewards, including frozen daily offers. Logic does not register incomplete Kai content or add him to the shop pool.

The profile/result named-reward formatter uses the registered localized item name, with the approved canonical name as data fallback during development. Art's Kai registration must include six-language item-name keys/Sheet alignment before staging integration. This branch introduces no new generic UI text. Ordinary veteran skin labels remain unchanged.

Focused tests cover each threshold boundary, no grants before registration/readiness, four-item ownership idempotence/reload-style reads, old token/chest/XP/title ledgers unchanged, a newly reached level6 award shown once, and a pending new milestone delivered once after readiness. Progress, shop, avatar and TypeScript regressions pass. No build/release triggered.

# Shop draft review

Unpublished local branch: proto/punchies/shop-pulls-draft. Open the local game and choose SHOP.

The first shop visit grants one preview token. Spending it grants the fixed fourth fighter once, then changes the slot to a daily capped preview ad reward. Fighter pulls and skin pulls have separate prices. Collection ownership and preview token balance persist in an isolated localStorage key, with no production save changes.

Configurable starting values: fighter pull 100, skin pull 50, reward 10, five rewards per UTC day. All are placeholders in src/shop/draft-config.json. The draft uses equal odds among remaining rewards and excludes duplicates; this policy still needs review. The welcome fighter is excluded from the normal pool.

Fourth fighter and additional fighter cards use explicit silhouettes. Identity, portraits, rigs and stats are pending. Skin cards show tinted existing portraits and rigs as palette studies, not finished skin art or gameplay equips. No ad provider, real currency, ranked entitlement or backend is connected.

Verification: typecheck/build, model tests for one-time welcome, costs, insufficient funds, daily cap/reset, unique rewards, persistence, malformed saves. Brave UI checks confirm the welcome slot changes and balances persist across game reloads. Production QA fixes are separately deployed via PR 248.

Review decisions: costs/reward cap, fourth fighter identity, skin direction, duplicate policy, reset timezone, pull reveal presentation. Physical mobile/controller and two-device network QA remain pending.

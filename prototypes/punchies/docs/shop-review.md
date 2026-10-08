# Daily shop draft review

Unpublished local branch: proto/punchies/shop-pulls-draft. Open the local game and choose SHOP.

Three fixed columns replace tabs: left watch an ad for 1 token, middle choose from three skins at 5 tokens each, right one fighter at 10 tokens. These are direct purchases of visible daily offers, not random pulls. The existing one-time gifted token and guaranteed fourth-fighter introduction remains in the left slot before ads.

Daily rotation uses the available catalogue excluding already-owned items. Offers are stored for the UTC day and remain fixed after buying; the purchased item shows owned until the next rotation. At midnight new offers are selected from remaining items. A nearly completed collection can show fewer than three skins; a completed collection displays a completion message. The daily ad cap remains a configurable five rewards, using preview buttons with no real video.

Palette swaps recolour the same character. Unique skins use the same base fighter and stats but have distinct portrait and rig sprite asset entries. Unique artwork is explicitly pending and shown with placeholders. The current palette previews are studies, not finished equippable skins. Fighter identity, art and tuned stats remain placeholders.

The isolated preview wallet and ownership persist locally. No production unlocks, real ad service, ranked entitlement, secure wallet or equip flow is connected. Pricing and reset configuration live in src/shop/draft-config.json.

Verification: typecheck/build, daily storefront regression checks for 1/5/10 pricing, three skins and one fighter, stable offers after purchasing, ownership exclusion next day, duplicate/unavailable offer rejection, welcome persistence, daily cap/reset, palette and unique metadata. Brave visual check and clean browser console.

Review decisions: fourth fighter identity, palette/unique art direction, daily cap and reset timezone, production wallet/ad service. Physical mobile/controller tests remain pending.

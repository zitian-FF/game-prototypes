# Profile avatar data contract

Data-only follow-up; no Profile UI, Kai roster/tuning/rig, milestonelevel or retroactivegrant changes.

progress/profile exports ProfileAvatar {fighter:CharId,skin:string}, ownedAvatarChoices(state=loadShopDraft()), getProfileAvatar(), setProfileAvatar(raw:unknown):boolean. Choices are availableFighters x ownedSkins, including base default for each owned fighter. Getter validates current ownership and returns Marco/default for invalid/corrupt/unowned choice; does not mutate ownership or repair storage. Setter rejects invalid/unowned and returns false on storagefailure/readbackfailure. Optional avatar is stored beside alias/generated in KEYS.profile; alias/generated writes preserve avatar. Old saves default safely. LocalWireProfile remains alias/title/level only. Art handles missing portrait texture fallback separately; no scene/texture work in data layer.

progress/progress exports progressionLadder(now=Date.now()), backed by pure rules.rewardLadder(cfg,state,day). Exactly config.maxLevel rows (currently50), including emptyrewardlevels, with level,rewards,reached,current,totalXpRequired. Reached means level threshold attained, NOT proof that each cosmetic was granted/owned; use ownership if UI needs delivery status. Helper is read-only, no XP/claims/grants/config changes.

dailyOffers now excludes earnOnly as well as artPending, including frozen saved offerIds. Normalization retains legitimate ownership. No new earn-only/Kai registry entries created. Proposed Kai6/14/22/32 and catch-up remain pending.

Focused profile-avatar, progress, shop tests + TypeScript pass: owned/corrupt/unowned selection, reload, alias preserve, storagefailure, collectionisolation, no peeravatar; full50ladder thresholds/immutability/rewardparity; staleoffer exclusion and legitimateearn-onlyownership preservation. UI/mockup approval and combinedruntime remain Main/Art/Build owned.

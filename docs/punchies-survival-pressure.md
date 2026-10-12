# Approved Survival boss and pressure handoff

Separate owner-approved batch; Logic changed only survival sim/config/save/types plus focused tests and measurement script. Art owns approved HUD/scene integration and localization. No build/deploy by Logic.

Ordinary growth=max(0,wave-1): speed.55+.08 capped.95; chance.65+.10 capped1; successful cooldown100-8 floor60; failed retry12, denied/rejected retry6. Minimum zombie startup12. Global start gap24-2 floor12. Startup/active concurrency2 throughwave3,3 fromwave4. Ordinary spawn120-12 floor48, initial3/poolcap12. HP6–10/damage.35/heal3 retained.

Boss ordinal=floor(wave/3), firstordinal1 atwave3. Gate.70+.10*(ordinal-1) cap.90. NominalHP160+32*(ordinal-1) cap320, multiplied by boss normal maxHP/96 fixed roster average; never selected-player adaptation. Adds initial2/max4/fixed180frame interval. Atmost1 crowd startup/active alongsideboss. Boss intention queue atmost12 active frames, EasyAI defense/movement/selection retained. Offensive duel buffers cannot bypass coordinator; defensive dodge buffering preserved.

Boss remainingTicks0 active, untimed. Clear only bossSpawned && no livingboss; failedspawn remainsincoming. Playerdeath precedesclear. Common cleanup/healing/checkpoint invariant preserved; integer lastEnemyAttackTick and null bossPending required for new checkpoints. survival-v2 invalidates old saves, no migration.

survivalView.waveMode: timed|boss; boss null on ordinary, otherwise {state:incoming|alive|defeated,id:string|null,char:CharId,currentHP:number|null,maxHP:number|null}. Alive HP from actual fighter health / enemy.maxHealth (scaled spawnHP), not normalmaxHealth. Incoming HP/maxnull. Defeated aftercleanup HP0/maxnull/idnull. Art uses actualboss notclosestzombie, resets trails byrunId+wave.

scripts/measure-punchies-survival-dps.mjs: controlled60seconds/fighter realprocess/resolve/timers/hitstop/stamina/fatigue, movingregen and chargedupper, forcedcontact notcollision/skillbenchmark, no defense/counter/dodgebuff. Equal10fighter averages sweethead19.51, mixed12.36 (1sweetbody/1sweethead/1sourhead per3), sourhead4.68DPS. Mixed7.59–15.05; emergency36–46%; rosterHPavg96. Firstboss26–42s and later45–65s are budget estimates requiring livevalidation.

Focused Survival and TypeScript PASS: deterministic seeds/clones, ordinarytimer/sharedintro, boss survives30s+ andclearsdeath, simultaneousdefeatpriority, realHP/incoming, checkpoint->wave4, exactramp/caps,1000tickpressure fixtures waves1/3/4/6/9 startactualattacks andrespectgap/concurrency/windup/addcaps, queuedintentexpiry, fail/success/denialcooldowns, bufferedbypass, bossHPcap/playerindependence, oldsaveincompatibility. Existing glove/contact/stat/ownership tests retained. Build owns combined Brave/mobile/readability/actualbalance/performance/package validation. Integrate approved ArtHUD together before release.

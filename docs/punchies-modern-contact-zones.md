# Modern contact-zone correction

The r161 selector compared fighter-centre distance with raw fist extension. At the live1.25scale, Marco could not get closer than50worldunits while his raw Hook extension was38.75. His Cross selection band52.5–78 was entirely inside the early-core contact region ending at80.25, so stationary selected Crosses resolved sour before full extension. The same failure reproduced with Mia, Bruno, Roxy and Nadia; unchanged Classic contacts showed the resolver was functioning correctly.

Selection now measures actual contact geometry:
- Close Hook ends at its full-extension head contact: Hook reach + its glove hit radius + target core radius.
- Jab ends at the greater of Jab full-extension head contact or Cross last-early head contact plus a1e-6numerical boundary allowance.
- Cross runs above that Jab boundary through its full-extension NORMAL body contact distance plus20%of raw Cross extension for the owner's walk-in anticipation request. Beyond this, selection falls back to Jab.

Last-early extension is `reach * (startReachFrac + (1-startReachFrac)*sourEarly/(sourEarly+1))`. This uses the same unmodified trajectory as the live contact resolver. Target-size and per-character glove/reach scaling are included. There is no broad sum-of-body-envelopes offset, forced contact, forced sweet hit, range/damage buff, or Classic modification.

Examples against Marco, world centre distances:

| Attacker | Body contact | Hook through | Jab through | Stationary Cross contact through | Anticipating Cross through |
|---|---:|---:|---:|---:|---:|
| Marco |50|63.75|80.250001|105|118|
| Mia |47|54.19|67.258001|89.98|100.276|
| Bruno |53|69.9|88.380001|114.3|128.86|
| Roxy |50|63.75|77.487501|101.75|114.1|
| Nadia |47|57.6|72.120001|95.7|107.14|

These are SELECTOR boundaries, not new punch extension values. At closest contact a Hook may still be jammed/sour by the existing rules. Crosses thrown before an opponent moves close may also become jammed. The outside anticipation region can whiff against a stationary opponent; it never fabricates a hit.

`test-punchies-modern-contact.mjs` drives real simulation steps for all121roster pairs, tests closest Hook contacts, nonempty Jab contacts, sweet stationary near-boundary and outer-body Cross contacts, walk-in/retreat, stationary anticipation whiffs, real approach to an anchored opponent, guard/vulnerability, unchanged Classic geometry/damage parity and byte-identical tune data. Full-speed walk-ins at the anticipation edge yielded94sweet/27sour/0whiffs; retreat samples121whiffs. Fresh Marco at80.26lands Cross sweet on frame15 for8.8damage (Classic11×Modern0.8); its former78unit case landed sour on frame14 for4.4. Core quality is evaluated by the existing resolver, never relabeled.

Rules fingerprint is sim-modern-controls-11. Deploy only as an approved Beta fix batch; no live release was performed by Logic.

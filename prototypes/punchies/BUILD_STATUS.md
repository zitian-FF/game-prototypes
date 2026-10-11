## Current milestone
Owner corrections ready for Build integration: Zombie nearest targeting/5–10 HP and Ranked-only Elo.
## What was implemented
Survival reacquires closest living enemies during neutral hitstop and after movement/separation, preserves committed punch/dodge facing, and uses the closest enemy for stage context. Ordinary HP is a seeded inclusive 5–10 range at every wave; boss roster HP remains unchanged. Casual defaults unrated; only explicit Ranked can register, bind, report or display Elo.
## Key technical decisions
Readonly session.rated survives all scene transitions. Separate relay room namespaces plus validated hello/paired/start modes preserve legacy Casual behavior. QR links retain Ranked mode. Existing points remain. Latest HP range supersedes prior Zombie durability scaling; existing speed growth remains. Art owns menu entry/Profile/Marco integration; Build owns combined release.
## Open questions
Full played Ranked KO and rematch browser verification remains outstanding. Ranked uses code pairing initially; there is no global matchmaking queue.
## Known issues
Anonymous identity reset loses points; agreed fake claims and unreported disconnects remain accepted service limitations. Browser fixture saves/position controls are explicitly mocked; Lobby rating requests use the actual deployed Worker. No direct live changes or Worker deployment performed for these corrections.
## Next proposed step
Integrate ordered Logic commits with Art's 3579855 and 3f1e9b1, rerun combined UI/logic/profile gates and publish through Build after review.

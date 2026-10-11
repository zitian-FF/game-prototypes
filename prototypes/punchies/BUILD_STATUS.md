## Current milestone
Combined owner corrections ready: Ranked-only Elo, Zombie targeting/health, accessible Profile progression and slimmer Marco cosmetic torsos.

## What was implemented
Online exposes Casual and Ranked choices. Casual does not register or present Elo; Ranked retains settlement, rematch and quit guards. Profile exposes saved XP, levels, titles and reward records. Zombies occupy the practice menu with a hand icon. Ordinary Zombies have seeded inclusive 5–10 HP at every wave; nearest targeting refreshes during neutral hitstop and after movement while attacks/dodges keep facing. Marco cosmetic torso scale is .88; regular Marco, other fighters, source pixels and hitboxes retain prior behavior. Selectively applied 78 validated Sheet keys across six locales and updated coverage metadata.

## Key technical decisions
Integrated Logic f4e5c1b/a8ee397 then Art 3579855/3f1e9b1 from deployed main. Retained profile titles and Ranked guards in MatchScene. No Worker or R2 changes. Both quality profiles default to CrazyGames with explicit portal overrides. Combat VFX remains separate.

## Open questions
Full played two-peer Ranked KO/rematch remains browser-unverified; session regression tests cover the flow. Ranked uses room-code pairing.

## Known issues
Anonymous identity reset loses points; agreed fake claims and unreported disconnects remain service limitations. Translations passed Sheet completeness/placeholder checks; no native-speaker review is claimed. Art/Logic fixture checks use explicit mock saves where documented. Both packages pass inventory/parity and 40 MB/20 MB budgets.

## Next proposed step
Complete combined Brave proof and deploy corrections, then integrate separately validated VFX after its final handoff.

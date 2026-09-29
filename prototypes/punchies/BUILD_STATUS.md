## Current milestone

Training mode and online 1v1 PvP are both playable and deployed to the
Current WIP itch.io slot. Online was verified end-to-end in-browser over a
mock transport only; the real Nostr/WebRTC path is untested (see Known
issues).

## What was implemented

- Deterministic 60 Hz fight sim (`src/sim/`): punch phases (startup, early
  sour with the fist travelling out, sweet at full extension, late sour,
  recovery + per-punch whiff recovery), full hit table, counters, startup
  interrupt, Perfect Guard, High Guard, dodge, stars/uppercut, stamina,
  stun, fatigue, KO, 99 s timer with health-% decision / draw.
- Core = face: in Normal stance a hit reaching the core uses the
  Vulnerable row, outer ring uses the Normal row. Vulnerable stance: all
  hits on the Vulnerable row.
- Vulnerable windows: punch startup + recovery (incl. whiff), dodge tail +
  post-dodge window, stunned, 0 stamina. Active frames are not vulnerable.
- Low stamina: hitting 0 makes you Vulnerable until stamina regens to
  `exhaustRecoverAt` (30), at `exhaustedRegenMult` (0.35x) speed: about
  6 s idle vs 2 s normally. No crit on Vulnerable; guest view unmirrored
  (all confirmed by user, BRIEF.md updated).
- Hook: close-range tool (startReachFrac 0.75, 1 early-sour frame) and
  chips `guardChipMult` (40%) of its hit through High Guard.
- Training: dummy stance cycle (Normal / High Guard / Vulnerable), no HP
  refill until RESET, MENU button.
- "i" info panel: hitbox overlay + frame data + hit table, no pause.
- Online (`src/net/`, `MenuScene`, `LobbyScene`, `MatchScene`): Trystero
  (Nostr, pinned relays) + mp-net's TURN worker; 3-char room codes; host
  shows code + QR (`?room=CODE` URL); host measures ping and picks input
  delay; tune synced host -> guest at start; lockstep with redundant input
  packets; 1 Hz state-hash desync check; "waiting for opponent" indicator;
  result screen with REMATCH / MENU; disconnect handling; full-room and
  code-collision handling.
- Square 310x310 ring, responsive view, auto-rotate to landscape,
  in-canvas touch controls + HUD, WebAudio placeholder sounds, Tweakpane
  (?debug=1), version stamp.

## Key technical decisions

- Lockstep with fixed input delay (no rollback). Delay = one-way ping in
  frames + `net.extraDelayFrames`, clamped to `net.min/maxInputDelay`.
  Each packet carries the last `2*delay+4` local inputs, so a single lost
  packet never stalls. Local input history is kept that long because the
  peer can lag up to `delay+1` ticks.
- Lockstep core (`net/lockstep.ts`) has no Phaser dependency and was
  tested headless: 30 s with 60-100 ms one-way latency and 10% loss ->
  identical state hashes, ~4-5% stalled ticks at delay 6, combat included.
- Host = fighter 0 (left), guest = fighter 1 (right); no screen mirroring.
- Hit resolution: the fist passes through the outer ring and resolves when
  it touches the core or reaches full extension; that frame sets
  sweet/sour, touching the core sets the row.
- The Nostr room id is `room-<CODE>` under appId `punchies`.
- Shared stage (`scenes/FightStage.ts`) used by Training and Match.
- QR code uses the page's own URL. On itch.io that's the itch CDN iframe
  URL (html-classic.itch.zone/...), which opens the game directly.

## Open questions

- Hook chip vs "absorbed by normal guard": implemented as Hook chips only
  High Guard; vs Normal stance it follows the regular table. BRIEF.md
  updated; confirm.

## Known issues

- Real online play (Nostr relays + WebRTC + TURN) could not be tested from
  the build sandbox (outbound relay traffic blocked). Verified instead:
  headless lockstep sim, and two browser tabs over a BroadcastChannel mock
  of Trystero (lobby, QR, ?room join, ping/delay, match sync). Rematch
  flow not exercised in any test.
- Info panel overlaps the left edge of the ring on narrow views.
- All tune numbers are first-pass; only the ones the user asked for were
  changed deliberately.
- Rotation fallback patches Phaser internals; recheck on Phaser upgrades.

## Next proposed step

Real two-phone online test (host on one phone, scan the QR on the other),
then tune input delay / feel. Consider rollback if the delay feels heavy.

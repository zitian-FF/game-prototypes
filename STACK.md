# STACK.md

Human-readable overview of the shared infrastructure available to
prototypes in this repo. For house rules and enforcement, see
CLAUDE.md. This file describes what exists and what it's for, not
how to follow the rules around it.

## Core engine stack

Every prototype is built on Phaser 3 + TypeScript + Vite. This is
fixed and not optional. See CLAUDE.md's Stack section for the
full locked list (atlas packing, debug UI, verification, hosting,
art storage).

## UI chrome: React + Tailwind DOM overlay

For UI chrome (HUD, menus, lobby/join screens, hand/card displays,
logs, overlays), the repo uses a React + Tailwind DOM layer over
the Phaser canvas. Mockups are built in Claude Design and wired
in directly, no translation step. Game-world rendering (anything
needing WebGL effects, particles, shaders, Post FX) stays in
Phaser and is not a candidate for this layer. Full rule: CLAUDE.md
"UI implementation split" section.

Status: tooling (@vitejs/plugin-react, Tailwind) is installed at
the repo root. No prototype has adopted it yet. First expected
use: suits-mp's Stage 3 UI port.

## Multiplayer networking

Two networking foundations exist, both built on Trystero
(WebRTC via Nostr signaling relays, pinned to a known-reliable
relay set, see CLAUDE.md's Networking section):

- mp-console: local/couch multiplayer. One stationary host device
  (landscape), other players join by scanning a QR code shown on
  the host's screen. No internet NAT traversal concerns, all
  players are physically nearby.
- mp-net: remote/internet multiplayer. Any device can host
  (portrait for everyone, including host), players join via a
  typed room code or invite link. Adds TURN relay fallback (a
  dedicated Cloudflare Worker) for the ~15-20% of connections
  where STUN-based peer-to-peer connection fails on its own
  (mainly symmetric NAT / mobile carrier CGNAT).

Both build on the same shared package, packages/mp-core: client-ID
generation, identity/hostUI channel creation, generic input/
analogInput/inputDelta channel creators, and an identity-matched
reconnect handshake. Not every consumer uses every piece - e.g.
mp-console has no inputDelta channel, and its reconnect handling
differs from mp-net's in shape (see packages/mp-core/README.md and
each prototype's own BUILD_STATUS.md for the specifics).

Status: mp-net, suits-mp, and mp-console are all wired onto
packages/mp-core now - no prototype carries its own duplicated copy
of this logic anymore.

mp-core is now at 0.2.0, which adds an opt-in player display-name
capability: `createIdentityActionWithName` (a second identity-channel
creator, alongside the original `createIdentityAction`, which is
unchanged) and an optional `displayName` field on `BaseRosterEntry`.
suits-mp has adopted 0.2.0 and uses this for real player names
end-to-end (Lobby entry, in-game labels, redistribution log). mp-net
and mp-console remain pinned to 0.1.0 and are unaffected - this was
shipped additively specifically so their pins wouldn't need to move.

**Known limitation, worth knowing before scoping any future mp-core
change:** this repo's shared packages are not actually version-isolated
per consumer - it's a single local workspace package, not a real
registry. A consumer's declared semver pin (e.g. `^0.1.0`) is a
statement of intent, not an enforced boundary: a genuinely *breaking*
change to mp-core fails typecheck repo-wide regardless of what any
other consumer's package.json claims to pin. This was discovered
mid-brief when adding the display-name field - the first draft made
`createIdentityAction`'s payload change type and `displayName` a
required field, which broke mp-net/mp-console's build immediately even
though only suits-mp's pin was meant to move. The fix (and the pattern
to repeat for any future mp-core change) is: always ship additively -
new exports/optional fields alongside old ones unchanged, never a
changed signature or a newly-required field on an existing type - until
real per-consumer version isolation exists as its own piece of
infrastructure work.

## What "available to a prototype" means in practice

A new prototype starts with just the core engine stack above and
adds shared packages only as needed:

- Need couch/local multiplayer? Depend on mp-console (or
  packages/mp-core directly).
- Need internet multiplayer? Depend on mp-net (or packages/mp-core
  directly).
- Need UI chrome? Use the React + Tailwind DOM overlay pattern.
- Need none of the above? Build with just Phaser/TS/Vite, same as
  digger does today.

Adding a shared package to a prototype must never be able to break
a prototype that hasn't opted in. See CLAUDE.md's Purpose section
for the versioning/isolation rule this depends on.

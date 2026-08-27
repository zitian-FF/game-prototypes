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

- mp-console (formerly mp-base): local/couch multiplayer. One
  stationary host device (landscape), other players join by
  scanning a QR code shown on the host's screen. No internet NAT
  traversal concerns, all players are physically nearby.
- mp-net: remote/internet multiplayer. Any device can host
  (portrait for everyone, including host), players join via a
  typed room code or invite link. Adds TURN relay fallback (a
  dedicated Cloudflare Worker) for the ~15-20% of connections
  where STUN-based peer-to-peer connection fails on its own
  (mainly symmetric NAT / mobile carrier CGNAT).

Both share the same underlying reusable primitives: an intent-
style action set (input, analogInput, inputDelta, hostUI,
identity) and an identity-matched reconnect handshake.

Status: currently implemented as separate, duplicated code across
mp-base, mp-net, and suits-mp. Extraction into a shared
packages/mp-core package, consumed by all three, is planned as a
near-term follow-up. This document will be updated once that
lands.

## What "available to a prototype" means in practice

A new prototype starts with just the core engine stack above and
adds shared packages only as needed:

- Need couch/local multiplayer? Depend on mp-console (or
  packages/mp-core directly, once it exists).
- Need internet multiplayer? Depend on mp-net (or packages/mp-core
  directly, once it exists).
- Need UI chrome? Use the React + Tailwind DOM overlay pattern.
- Need none of the above? Build with just Phaser/TS/Vite, same as
  digger does today.

Adding a shared package to a prototype must never be able to break
a prototype that hasn't opted in. See CLAUDE.md's Purpose section
for the versioning/isolation rule this depends on.

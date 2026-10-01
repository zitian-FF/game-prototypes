## Current milestone

Design only. BRIEF.md drafted from the design discussion. No code has been
written for this prototype yet. Infrastructure setup (Cloudflare Worker and
Durable Object, deploy workflow, itch.io) has been handed to Codex.

## What was implemented

- `prototypes/firestorm-arena/BRIEF.md`: platform and stack, squad and
  power rules, node types, commands, combat formula with acceptance
  targets, turrets, fog of war, netcode model, win condition, tuning keys,
  out of scope list, and open questions.
- Offline combat model (throwaway Python in the session scratchpad, not
  committed) used to pick the power exponent of 6 so a 45m squad attacking
  a 60m squad ends at 0% against about 91% survivors.
- Handoff to Codex over the Agent Comms mailbox, thread
  `c284180f-7dbb-46ec-971d-d06ab6aa0e52`, covering Cloudflare and itch.io
  setup, with secrets kept in a local environment only.

## Key technical decisions

- Authoritative server on a Cloudflare Durable Object per match over
  WebSockets, free plan only. Chosen over Trystero because a 40 peer
  WebRTC mesh does not scale and fog of war needs a trusted authority.
- All rules live in a pure TypeScript sim package so the same code runs in
  the Durable Object, in Node bot tests, and in the client for march
  position derivation.
- Event-driven server using alarms, no fixed tick. Marches are records and
  clients derive positions from a synced server clock.
- Counter is a 1.2x power multiplier applied before the power exponent.
  Applying it as a 20% damage reduction would be worth only about a 3.7%
  power difference at exponent 6 and make the counter triangle nearly
  irrelevant.
- Variance is applied to power, not damage. 3.5% proposed. Variance on damage
  at 5-10% was shown to make fights almost deterministic.
- Phaser 3 stays over Godot: the shared TypeScript sim, the React + Tailwind
  UI pipeline and the existing JS tooling are the reasons.
- Free tier numbers (100k DO requests per day, 13,000 GB-s per day, 20:1
  incoming WebSocket billing, 100k rows written per day) came from search
  snippets only, not from Cloudflare's own docs, which the session proxy
  blocked. Codex was asked to verify them.
- CHANGELOG.md checked: the 2026-09-29 WIP slot entry and the mp-core
  version pin entry were reviewed. Neither changes this brief. The WIP slot
  decision is with Codex, and this prototype does not use mp-core.

## Open questions

- All 13 open questions at the bottom of BRIEF.md are unanswered.
- BRIEF.md itself covers decisions that were agreed in conversation rather
  than answered from an earlier brief, so it is the first version and
  should be treated as needing the user's review.
- Variance size (3.5%) and the troop variance around 3000 (10%) are
  proposed defaults, not user decisions.
- CLAUDE.md is out of date on phone support and hosting for this prototype.
  The user said it is outdated and prototypes may target the platform they
  need. CLAUDE.md was not edited.

## Known issues

- Cloudflare free-tier numbers are unverified (see above).
- Codex runs as a read-only CLI worker per the Agent Comms protocol, so it
  may only produce drafts rather than perform the setup. The user may need
  to apply or run what it returns.
- The Codex reply had not arrived when this status was written.

## Next proposed step

1. Review and answer BRIEF.md open questions, starting with 1, 2 and 6,
   which drive the map and sim data model.
2. Read Codex's reply on the mailbox thread and act on any manual steps.
3. Build milestone one: the pure `arena-sim` package with squad rolls,
   combat, stack fights, reserves and fog filtering, plus headless Node
   tests against the BRIEF's acceptance targets. No client or server yet.

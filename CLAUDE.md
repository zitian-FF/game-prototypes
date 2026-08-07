# CLAUDE.md

House rules for this repository. Read fully before starting any task.

## Purpose

This repo holds small browser-based game prototypes. Prototypes are
disposable. Favour clarity and speed of iteration over robustness,
abstraction, or reuse.

## Roles

- The user writes design briefs and produces all artwork.
- Claude Code writes all code, config, and CI.
- Each prototype is specified by its own `BRIEF.md`. The brief is the
  source of truth. If the brief does not ask for it, do not build it.

## Stack

Fixed. Do not add, swap, or upgrade any of these without asking first.

- Engine: Phaser 3
- Language: TypeScript (strict mode)
- Build: Vite
- Atlas packing: free-tex-packer-cli
- Debug UI: Tweakpane
- Visual verification: Playwright
- Hosting: GitHub Pages
- Art storage: Cloudflare R2

Do not add dependencies to solve problems the stack already solves.
If a new dependency seems necessary, ask before installing it.

## Repository layout

prototypes/<name>/     One self-contained prototype
  BRIEF.md             Spec for this prototype
  src/                 Game source
  tune.json            Tuned constants (see Tuning)
scripts/               Build, pack, fetch, screenshot
.github/workflows/     CI

No shared code library. If something is needed in two prototypes, copy
it. Only propose extracting shared code after the third copy exists.

## Art pipeline

Artwork lives in Cloudflare R2, never in this repository.

- Bucket public URL: https://pub-415572b047994ab8807f76b8462eda45.r2.dev
- Object per prototype: <proto-name>-assets.zip
- Fetched over plain HTTPS. No credentials required. Never add R2 API
  tokens or secrets to this repo.
- Never commit PNG, zip, or atlas files. Enforce via .gitignore.

Zip structure:

packed/<animation-key>/0001.png, 0002.png, ...
loose/<filename>.png

Rules:

- Folder names under packed/ are the animation keys. Derive Phaser
  animation configs from folder names and frame counts automatically.
  Never hand-maintain an animation list.
- Files under loose/ are loaded individually and must not be packed.
  Backgrounds, tiling textures, and tilemap tilesets belong here.
- Source frames are exported at full canvas size with fixed
  registration. Do not crop, offset, or re-align them.
- Trimming is done by the packer only, which records offsets in the
  atlas JSON. Never trim source frames.
- Keep individual atlases at or below 2048x2048. Spill to additional
  sheets rather than exceeding this.
- Art objects in R2 are overwritten in place and are not versioned.
  The CI asset cache must key on object ETag or content hash, never on
  filename. Keying on filename will silently serve stale art.
- Every build writes a manifest of art files with hashes and fetch
  timestamp into the build output.

## Input

Game logic must never read a key, pointer, or touch event directly.

All input goes through an intent layer: move, jump, primary,
secondary, pause. Devices bind to intents. Logic reads intents.

Every prototype must be playable on a phone, even when the brief
targets desktop. Remote playtesting happens on mobile. Crude touch
bindings are acceptable; absent ones are not.

## Placeholder-first

Build all mechanics with coloured rectangles first. Do not wait on
artwork, and do not treat missing art as a blocker. Art is swapped in
only after the loop is confirmed working.

## Tuning

All values affecting game feel (speeds, gravity, friction, durations,
easing, cooldowns) live in tune.json. Never hardcode them.

Every prototype ships a Tweakpane panel exposing these values,
available in production builds via ?debug=1, with a button that
copies current values to the clipboard as JSON.

Do not change tuned values unless explicitly asked. Those numbers were
set by a human playing the game and are not yours to optimise.

## Version stamping

Every prototype displays a version stamp in the top-left corner of the
canvas: tiny font, low-contrast, unobtrusive.

- Format: `DDMMYYrXXXX` (e.g. `070826r0001`). `XXXX` is a zero-padded
  4-digit running count.
- The counter is per-prototype: it lives inside that prototype's own
  folder (e.g. `prototypes/<name>/version.json`), not shared across the
  repo, and starts at `0000`.
- It increments automatically on every deploy of that prototype. No
  manual step, and never hand-edit the counter. The date portion is
  recomputed fresh on every deploy rather than stored.
- Implementation is up to the prototype: typically a small counter file
  read and incremented by the deploy workflow, injected into the boot
  scene as a version string.
- This rule applies to this prototype and all future ones going
  forward. Do not retrofit prototypes that predate this rule.

## Verification before reporting done

Run all of these. Do not report a task complete if any fail.

1. npm run typecheck passes with no errors
2. npm run build succeeds
3. Playwright screenshot script runs, and the screenshot is inspected
4. Browser console shows no errors on boot

Report what you actually verified. Do not describe untested behaviour
as working.

## Git

- One branch per task, named proto/<name>/<short-description>.
- Small, single-purpose PRs. Do not bundle unrelated changes.
- Never force-push to main.
- Commit messages: imperative mood, one line, no trailing period.

## Scope discipline

The Out of Scope section of a brief is binding. Do not implement
items listed there, and do not add polish, systems, menus, settings,
or content the brief did not request.

If something in a brief is ambiguous, ask rather than guessing.

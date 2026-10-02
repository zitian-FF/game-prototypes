# firestorm-arena client

Phaser 3 + TypeScript, built by the repo's Vite config (entry `index.html`).
All UI is drawn in the canvas (an immediate-mode toolkit in `src/ui/ui.ts`); the
only DOM is the `?debug=1` Tweakpane panel. Art is vector shapes drawn in code.

## Run locally

```
npx vite             # then open /game-prototypes/prototypes/firestorm-arena/index.html
```

The client connects to `ws://127.0.0.1:8787` on localhost and to the deployed Worker anywhere else. Override with
`?server=wss://host` or `VITE_SERVER_URL` at build time. The itch workflow builds with
`VITE_SERVER_URL=wss://firestorm-arena-server.tianz-88.workers.dev` (the deployed Worker).

`?debug=1` shows the Tweakpane panel for `client.tune.json` (with a copy-JSON
button) and exposes `window.__game` and `window.__session`. `?debug=1&autoplay=1`
creates a room, starts it with bots and plays on, for screenshots.

## Layout

| Path | Purpose |
|---|---|
| `src/net/session.ts` | socket, lobby and match state, server clock, toasts, save (`firestorm-arena:save:v1`) |
| `src/input/intents.ts` | the only code reading keys, pointer and wheel |
| `src/scenes/` | menu, lobby, game (world, HUD, panels) |
| `src/render/` | isometric projection, volcanic ground and fog textures, unit and node icons, effects |
| `client.tune.json` | client-only feel values; match rules stay in `tune.json` and come from the server |

## Controls

Left click inspects a node or HQ (garrison, scout reports, actions). Right click
sends the selected squad. Drag or WASD pans, wheel or +/- zooms, the minimap jumps.
Squad rows select a squad, toggle HQ defense, and recall marches. Esc backs out.

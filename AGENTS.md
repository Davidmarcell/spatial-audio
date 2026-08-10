# AGENTS.md

## Cursor Cloud specific instructions

**What this is:** Saudade — a static, frontend-only Vite + React 19 + TypeScript single-page app for composing ambient spatial soundscapes (Web Audio API, `globe.gl`/Three.js map, Silk sheet UI). There is no backend, database, or auth. Everything is bundled static assets served by Vite.

**Dependencies** are refreshed by the startup update script (`npm ci`). Node 20.19+/22.12+ is required for Vite 8; the VM's Node 22 works.

### Running the app (dev)
- `npm run dev` — Vite dev server with hot reload. Note `vite.config.ts` binds it to `0.0.0.0:5173` with `strictPort`, so it is reachable from outside the VM. The README's "always 127.0.0.1:5173" wording is about the local URL to open; the server itself listens on all interfaces.
- Run the dev server in a persistent tmux session (agent-started foreground processes stop when the turn ends).
- The app boots to a **landing gate** (a fan of location cards + a search pill + an Enter button), not straight into the workspace. To reach the spatial canvas you must first enter a place: click a location card (`button[aria-label^="Enter "]`), use the search, or press Enter (which opens the globe). The landing gate is on by default; the toggle is persisted in `localStorage` under `saudade:landing-gate-enabled` (`0` = skip landing).
- In dev mode several **dev-only tuner panels** render on top of the workspace (e.g. the "Radiance" panel on the right). They are expected and do not appear in production builds.
- Audio autoplay is gated by the browser; the first user gesture (click/keydown) unlocks the `AudioContext`. Headless automation should pass `--autoplay-policy=no-user-gesture-required` if it needs sound.

### Lint / test / build
- `npm run lint` — ESLint (flat config). It currently reports pre-existing errors/warnings in the source; that is a code state, not an environment problem.
- The "tests" are standalone validation/acceptance scripts run via `tsx` (see the `validate:*` and `test:*` scripts in `package.json`). Several are chained inside `npm run build`, so a full `npm run build` also runs them. They invoke `npx tsx ...`, which fetches `tsx` on first use (needs network) since it is not in the lockfile.
- `npm run build` runs all validators + `tsc -b` + `vite build`. `npm start` builds then serves a production preview on `127.0.0.1:4173`.

### Key selectors for UI automation
- Spatial canvas: `[aria-label="Spatial sound grid"]`; listener: `[aria-label="You — listener position"]`.
- Placed sound tiles: `[data-instance-id]` wrapper with an inner `[data-sound-icon]` button. Distance from centre ("You") drives volume; left/right drives stereo pan. Select a tile then use arrow keys to nudge (Shift = larger step; Delete/Backspace removes).
- Dock palette tiles: `button[aria-label^="Drag "]`; play/pause: `button[aria-label="Play audio"]`/`"Pause audio"`; world map: `button[aria-label="World map"]`.

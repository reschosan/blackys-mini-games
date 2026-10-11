# Architecture

Cat Kart is a static browser game built with Vite, strict TypeScript, plain Three.js, Lit web components, and Tailwind CSS. No application server is needed to run the production build.

## Runtime

- The simulation advances at a fixed 60 Hz, independent of rendering. Gameplay uses a seeded random number generator so the same seed can reproduce a run. Cosmetic rendering effects may use their own randomness.
- Gamepad and touch input are translated into actions such as steering, acceleration, braking, drifting, item use, and pause. Gameplay systems consume actions rather than device events. The mouse is a menu shortcut; keyboard gameplay input has been removed.
- `window.__game.getState()` exposes a JSON snapshot for browser tests. The tuning panel exists in the development server only.
- Driving values, items, cats, maps, and game options are configured as data rather than embedded in the main loop.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/games/<game>/` | Each game type, including kart racing, memory, walking, and jets |
| `src/party/` | Application shell, lobby, game selection, scoring, and guest screens |
| `src/shared/` | Simulation core, input, networking, audio, cats, UI, configuration, and localization |
| `public/` | Models and textures loaded at runtime |
| `tests/` and `e2e/` | Vitest logic tests and Playwright browser tests |
| `tools/https-preview/` | Local HTTPS preview for testing the camera and real phones |

`party` may depend on `games` and `shared`. A game may depend on `shared`, but games do not depend on each other. The rules are checked by `npm run deps`.

## Local multiplayer

One device hosts the simulation. Up to three guest phones can connect directly over WebRTC on the local network, send actions, and draw snapshots with their own camera. A shared-screen game with gamepads remains available. The connection uses QR exchange without a relay, STUN, or TURN server; some networks block direct connections. Host and guests must run the same build. The host ending the session ends it for everyone.

## Localization

English and German strings live in `src/shared/i18n/en/` and `src/shared/i18n/de/`. English is the fallback for unsupported browser languages. Display names from map data are translated through the place-name table. German translation files and language-specific test fixtures are intentionally present in this English-documented repository.

# Developer scripts

Run these from the repository root. They are development tools and are not part of the production build.

- `npm run manifest` regenerates `custom-elements.json` and `web-types.json` from the Lit components. Commit both generated files when their source changes.
- `CAT_KART_MAP_INDEX=1 node scripts/measureArchitecture.mjs <baseline-url> <current-url>` compares three runs of the same map on two development servers. The default map index is `1` (family house). Both servers must expose the development-only `window.__game.startEnduranceRace` hook. The report is written under `.dev-screenshots/architecture-performance/`, which Git ignores. Use the same browser and machine for both URLs.

# Developer scripts

Run these from the repository root. They are development tools and are not part of the production build.

- `node scripts/compressModels.mjs` compresses every model in `public/models/` except `cat.glb`: textures become WebP and the geometry uses `EXT_meshopt_compression`, which the game decodes with three.js's Meshopt decoder. Files that are already compressed are skipped, so run it after adding a model. Its packages are not dependencies of the game; install them first with `npm install --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp`.
- `npm run manifest` regenerates `custom-elements.json` and `web-types.json` from the Lit components. Commit both generated files when their source changes.
- `CAT_KART_MAP_INDEX=1 node scripts/measureArchitecture.mjs <baseline-url> <current-url>` compares three runs of the same map on two development servers. The default map index is `1` (family house). Both servers must expose the development-only `window.__game.startEnduranceRace` hook. The report is written under `.dev-screenshots/architecture-performance/`, which Git ignores. Use the same browser and machine for both URLs.

# Testing

Install dependencies with `npm install`. Browser tests use simulated gamepads and touch input; they do not prove the feel of a real controller or phone.

| Command | Checks |
| --- | --- |
| `npm run check` | TypeScript, ESLint, formatting, module boundaries, unused code, and Vitest |
| `npm run build` | Production TypeScript and Vite build |
| `npx playwright test --workers=1` | Browser behavior, including lobby, menus, games, gamepad simulation, and touch |
| `npm run test:e2e:layout` | All configured screen sizes and both languages |
| `npm run test:e2e:preview` | Static production preview without the development tuning panel |
| `npm run test:e2e:reality` | Selected end-to-end game and device profiles |
| `npm run test:e2e:sweep` | Screenshot sweep over the game and device matrix |

After a UI change, inspect the changed screen visually on desktop, phone, and tablet as applicable. The layout audit checks overlap, clipping, reachability, target size, text size, contrast, and horizontal overflow. For gameplay changes, play with a real controller and check the affected devices; automated tests cannot judge game feel.

The local HTTPS preview in [`tools/https-preview/`](../tools/https-preview/README.md) supports tests on real phones. WebRTC between real devices, iOS Safari behavior, GPU performance, and audio output require device testing.

For a focused reality run, set `REALITY_PROFILES` to a comma-separated list of device profiles (for example `desktop720,phonePortrait`) and `REALITY_GAMES` to a comma-separated list of games (for example `jets,memory`). The run writes screenshots and findings to `REALITY_DIR` (default `/tmp/reality`). The screenshot sweep writes to `SWEEP_DIR` (default `/tmp/sweep`). Inspect the actual images; green layout assertions alone do not establish visual quality.

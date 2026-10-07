# End-to-end tests

Real-browser checks of the main flows on an iPhone 13 viewport: setup, Today, workouts, swims, the library, settings, backups and reset.

```bash
npm run test:e2e            # all flows
npm run test:e2e -- kg      # only flows whose name contains "kg"
E2E_SHOTS=shots npm run test:e2e   # also save full-page screenshots
```

How it works:
- `harness.mjs` serves the repo folder on a random local port and opens Chromium through Playwright. The clock is fixed to Wednesday, October 7, 2026, 10:00 UTC, so "today" is always the same.
- Each test gets fresh storage. Service workers are blocked and every request outside the local server is cancelled, so no fonts, videos or thumbnails load.
- Motion is reduced unless a test asks for it, so screens change instantly and checks never race an animation.
- `run.mjs` holds the flows. When a screen changes, update its selectors here in the same commit.

Playwright isn't a dependency of the app. The harness looks for it in this order:
1. `PLAYWRIGHT_PATH` (a path to Playwright's `index.mjs`, or its folder).
2. A normal install: `npm i --no-save playwright && npx playwright install chromium`.
3. `/opt/node-tools/node_modules/playwright`, where Claude's cloud environment has it preinstalled.

CI runs the suite on every push (see `.github/workflows/ci.yml`).

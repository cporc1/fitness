# Revamp status and checkpoints

The spec is [`revamp-plan.md`](revamp-plan.md). Its section 0 lists the decisions from the review on October 7, 2026.

## How to resume

Start a new Claude Code session on `cporc1/fitness` and say:

> Continue the Lift & Lap revamp. Read `docs/revamp-status.md` and pick up at the first unchecked checkpoint.

**For the session picking this up:**
- Work in progress lives on the branch named under "Current state" below. Merge it into your own working branch first. Finished phases are already on `main`.
- Each checkpoint leaves the app working:
  1. Run `npm test` and `npm run test:e2e` (once 0.1 exists). Both must pass.
  2. Commit and push.
  3. Tick the box here, in the same commit.
- At the end of each phase, open a pull request into `main` and merge it once CI is green. That puts the phase on the live site.
- Keep the house style:
  - Use the `h()` / `put()` / `fill()` DOM helpers.
  - Put CSS tokens in `css/app.css`.
  - Write copy in plain sentence case.
  - Bump `VERSION` in `sw.js` and list new files in `SHELL`. A unit test checks this.

## Current state

- **Working branch:** `claude/wizardly-hopper-dy74jj`
- **Live on `main`:** v2, the pre-revamp app.
- **Next up:** Phase 0 pull request, then checkpoint 1.1.

## Checkpoints

### Phase 0: Groundwork (no visible layout changes)
- [x] **0.1 End-to-end suite in the repo.**
  - Adds `tests/e2e/` with Playwright smoke flows covering the regression list in plan section 7.7, and `npm run test:e2e`.
  - Playwright comes from `PLAYWRIGHT_PATH`, or the default install.
- [x] **0.2 Router.**
  - New `js/router.js` keeps a separate page stack for each tab.
  - Page changes go through `history.pushState`, so iOS swipe-back works. Tab switches unwind history.
  - Page and tab changes animate with view transitions.
  - `app.js` re-exports `go`, `back`, `replace` and `tab`, so views don't change.
- [x] **0.3 Sheets and tokens.**
  - Sheets: drag-to-dismiss, animated open and close, glass surface.
  - Tokens: glass and spring-motion tokens in CSS, plus `js/motion.js` (`reducedMotion()`).
  - Settings → Appearance gets Reduce motion and Reduce transparency.
- [ ] **Phase 0 PR merged.**

### Phase 1: Navigation and Today
- [ ] **1.1 Four tabs.**
  - Today · Plan · Progress · Learn in a floating glass tab bar.
  - The Learn tab merges Library, Learn and Tools.
  - Settings opens from a gear on Today.
  - The More and Log tabs are gone. History is reachable from Progress.
- [ ] **1.2 One exercise sheet and the Workout page.**
  - Exercises, strokes and drills always open in the same sheet; the exercise and drill pages are retired.
  - The Workout page replaces `template`: a hero, rows with thumbnails and a sticky Start button.
- [ ] **1.3 Today redesign.**
  - Picking a day updates Today in place; swipe the strip to change weeks.
  - Compact cards with thumbnails, Start and Details.
  - A "then" connector on combo days, a weekly rings card and a floating resume pill.
  - At most one banner at a time.
- [ ] **1.4 Plan restructure.**
  - Program header, 7 day chips, workouts in rotation, your workouts and the Program list.
- [ ] **Phase 1 PR merged.**

### Phase 2: Progress
- [ ] **2.1 Stats.**
  - `RANGES`, `buckets`, `progressSummary` and the per-mode sections in `js/stats.js`, with unit tests.
  - Tests check that totals match the buckets and that comparisons work across a month boundary.
- [ ] **2.2 Progress screen and History page.**
  - Total / Workout / Swim switch and 1 week / 8 weeks / 12 weeks / 6 months ranges.
  - KPIs compared with the previous period, and animated charts.
  - Records, recent sessions, milestones, and Body when it's turned on.
  - The History page holds the old Log content.
- [ ] **Phase 2 PR merged.**

### Phase 3: Live sessions
- [ ] **3.1 Steppers and rest pill.**
  - − / + weight and rep steppers that use real dumbbell sizes, machine pins and barbell steps.
  - A floating glass rest pill that opens the pace clock.
- [ ] **3.2 Focus mode.** A toggle in the workout's top bar, plus Settings → Workout → "Start workouts in". List stays the default.
- [ ] **3.3 Swim screen and celebration.**
  - The swim focus card dominates; the set list collapses; the dry warm-up shows once.
  - A celebration screen after Finish shows rings, confetti and records.
- [ ] **Phase 3 PR merged.**

### Phase 4: Polish
- [ ] **4.1 Visuals.**
  - Ambient background, swim caustics and the gym sheen.
  - Collapsing large titles and the black-translucent status bar.
  - Card-stack scaling behind sheets.
- [ ] **4.2 Quality pass.**
  - Accessibility: contrast and reduce motion.
  - Performance: at most 3 blur layers.
  - A dark-mode pass.
- [ ] **Phase 4 PR merged.**

## Log

- 2026-10-07: Plan reviewed and approved with changes (plan section 0). Checkpoints written.
- 2026-10-07: 0.1 done. `npm run test:e2e` runs 4 flows (39 checks) in about 7 seconds; CI runs it too.
- 2026-10-07: 0.2 done. `js/router.js` keeps per-tab stacks in step with history (`{ ll: depth }` entries); tab switches unwind with `history.go(-depth)`. Transitions are view transitions keyed by `html[data-vt]`. Finishing a session now *replaces* the live screen with its summary. 6 e2e flows pass.
- 2026-10-07: 0.3 done. `sheet()` in `js/ui.js` keeps its signature and now returns `{ close, panel, body }`. It drags to dismiss (grabber/header, or content at scroll top), animates out, closes the top sheet on Escape and returns focus. Settings → Appearance has Reduce motion and Reduce transparency (`settings.reduceMotion` / `reduceTransparency`, `html.reduce-*` classes). 7 e2e flows pass.

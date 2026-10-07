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
- **Live on `main`:** all phases (0–4) and the follow-up round (5.1–5.4).
- **Next up:** nothing required.
- **To check on a real iPhone:**
  - Edge swipe-back feel, and that it never animates twice.
  - Smoothness of the glass, caustics and card stack.
  - Whether the `black-translucent` status bar is worth it (white status text on the light theme).

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
- [x] **Phase 0 PR merged.** [cporc1/fitness#3](https://github.com/cporc1/fitness/pull/3)

### Phase 1: Navigation and Today
- [x] **1.1 Four tabs.**
  - Today · Plan · Progress · Learn in a floating glass tab bar.
  - The Learn tab merges Library, Learn and Tools.
  - Settings opens from a gear on Today.
  - The More and Log tabs are gone. History is reachable from Progress.
- [x] **1.2 One exercise sheet and the Workout page.**
  - Exercises, strokes and drills always open in the same sheet; the exercise and drill pages are retired.
  - The Workout page replaces `template`: a hero, rows with thumbnails and a sticky Start button.
- [x] **1.3 Today redesign.**
  - Picking a day updates Today in place; swipe the strip to change weeks.
  - Compact cards with thumbnails, Start and Details.
  - A "then" connector on combo days, a weekly rings card and a floating resume pill.
  - At most one banner at a time.
- [x] **1.4 Plan restructure.**
  - Program header, 7 day chips, workouts in rotation, your workouts and the Program list.
- [x] **Phase 1 PR merged.** [cporc1/fitness#4](https://github.com/cporc1/fitness/pull/4)

### Phase 2: Progress
- [x] **2.1 Stats.**
  - `RANGES`, `buckets`, `progressSummary` and the per-mode sections in `js/stats.js`, with unit tests.
  - Tests check that totals match the buckets and that comparisons work across a month boundary.
- [x] **2.2 Progress screen and History page.**
  - Total / Workout / Swim switch and 1 week / 8 weeks / 12 weeks / 6 months ranges.
  - KPIs compared with the previous period, and animated charts.
  - Records, recent sessions, milestones, and Body when it's turned on.
  - The History page holds the old Log content.
- [x] **Phase 2 PR merged.** [cporc1/fitness#5](https://github.com/cporc1/fitness/pull/5)

### Phase 3: Live sessions
- [x] **3.1 Steppers and rest pill.**
  - − / + weight and rep steppers that use real dumbbell sizes, machine pins and barbell steps.
  - A floating glass rest pill that opens the pace clock.
- [x] **3.2 Focus mode.** A toggle in the workout's top bar, plus Settings → Workout → "Start workouts in". List stays the default.
- [x] **3.3 Swim screen and celebration.**
  - The swim focus card dominates; the set list collapses; the dry warm-up shows once.
  - A celebration screen after Finish shows rings, confetti and records.
- [x] **Phase 3 PR merged.** [cporc1/fitness#6](https://github.com/cporc1/fitness/pull/6)

### Phase 4: Polish
- [x] **4.1 Visuals.**
  - Ambient background, swim caustics and the gym sheen.
  - Collapsing large titles and the black-translucent status bar.
  - Card-stack scaling behind sheets.
- [x] **4.2 Quality pass.**
  - Accessibility: contrast and reduce motion.
  - Performance: at most 3 blur layers.
  - A dark-mode pass.
- [x] **Phase 4 PR merged.** [cporc1/fitness#7](https://github.com/cporc1/fitness/pull/7)

### Follow-up round: feedback from using the app
- [x] **5.1 Finished workouts stay finished.**
  - Bug: a workout finished from Focus mode came back as "in progress" and blocked the swim.
  - Fix: late saves of a session that's no longer active are ignored, and Finish no longer redraws the live screen. On launch, a stuck copy of a saved workout is cleared.
  - Shipped on its own PR: [cporc1/fitness#9](https://github.com/cporc1/fitness/pull/9).
- [x] **5.2 Warm-up and cool-down as real steps.**
  - Warm-up: stretches first (they want more flexibility), then warm-up moves.
  - Cool-down: static stretches.
  - Each item is its own line with a photo and a target (hold time or reps), on the Workout page and in a live workout. In Focus mode each one is a page of its own.
  - Exercise photos come from Free Exercise DB (public domain), like the rest.
- [x] **5.3 Full-screen rest in Focus mode.**
  - Between sets and exercises, the rest takes over the screen: a big countdown, what's up next, and −15 s / +15 s / Skip.
  - When the rest ends, it says Go.
  - The list view keeps the floating rest pill.
- [x] **5.4 Animated swim demos.**
  - Strokes and drills get looping animations, like the exercise photos.
  - They're original drawings made in code, so there's nothing to license or credit. Openly licensed animations didn't cover the drills.
- [x] **Follow-up PR merged.** [cporc1/fitness#10](https://github.com/cporc1/fitness/pull/10)

## Log

- 2026-10-07: Plan reviewed and approved with changes (plan section 0). Checkpoints written.
- 2026-10-07: 0.1 done. `npm run test:e2e` runs 4 flows (39 checks) in about 7 seconds; CI runs it too.
- 2026-10-07: 0.2 done. `js/router.js` keeps per-tab stacks in step with history (`{ ll: depth }` entries); tab switches unwind with `history.go(-depth)`. Transitions are view transitions keyed by `html[data-vt]`. Finishing a session now *replaces* the live screen with its summary. 6 e2e flows pass.
- 2026-10-07: 0.3 done. `sheet()` in `js/ui.js` keeps its signature and now returns `{ close, panel, body }`. It drags to dismiss (grabber/header, or content at scroll top), animates out, closes the top sheet on Escape and returns focus. Settings → Appearance has Reduce motion and Reduce transparency (`settings.reduceMotion` / `reduceTransparency`, `html.reduce-*` classes). 7 e2e flows pass.
- 2026-10-07: Phase 0 merged (#3). 1.1 done: tabs are Today · Plan · Progress · Learn (`js/views/learn.js`, `tools.js`, `settings.js`; `more.js` deleted). Exercises and drills open as sheets everywhere. History is the old Log page, pushed from Progress. The resume pill floats above the tab bar on every tab.
- 2026-10-07: 1.2 done. `js/views/workout.js` (route `workout`, replaces `template`; exports `workoutSummary` for Today cards). `openExerciseSheet(id, { item, suggestion })` and `openDrillSheet(id, { target })` in `library.js` show today's target when opened from a workout.
- 2026-10-07: 1.3 done. Today keeps the selected day in module state (`showDay(iso)` jumps there from History). Day changes animate only `.day-content` (`html[data-vt=day-next|day-prev]`). The card → Workout page morph uses `sharedHero` in `router.js` and `view-transition-name: wk-hero`. The `day` route is gone.
- 2026-10-07: 1.4 done. Plan has a program card (About the program opens a sheet with the phases), 7 day chips, horizontal workout cards with "Up next", your workouts with a Create card, and the Program list.
- 2026-10-07: Phase 1 merged (#4). 2.1 done: `RANGES`, `buckets`, `periodKpis`, `progressSummary`, `setsByMuscleGroup`, `swimDistanceByStroke`, `weekRecords` in `js/stats.js` with 4 new unit tests (27 total).
- 2026-10-07: 2.2 done. `js/views/progress.js` rewritten: mode switch (pill slides via `html[data-vt=seg]`), range chips, 4 KPIs with count-up and comparison, stacked/single columns, Strength + muscle groups (Workout), pace + strokes (Swim), records, recent, Body and milestones (Total). Charts take `animate` (only on arrival or a switch). History opens from "See all history". 11 e2e flows.
- 2026-10-07: Phase 2 merged (#5). 3.1 + 3.2 done. `stepWeight()` in `program.js` (unit-tested). The rest timer is a floating glass pill. Focus mode lives in `session-gym.js`: `session.view` ('list' default, or 'focus' from Settings → Workout) and `session.focusIndex` persist with the active session and are stripped on save. A scroll-snap pager has warm-up and cool-down pages; steppers only appear in Focus.
- 2026-10-07: 3.3 done. Finish now saves right away and `replace`s to the `celebration` route (`js/views/celebration.js`): rings, confetti (`motion.confetti`), stats, medals, effort, and notes/time/distance. A gym session with no sets ticked asks first. The swim screen has a one-time "Before you get in" card with an Apple Watch hint, a ripple on Rep done (`motion.ripple`), "Next up", and all sets in a disclosure. `ring()` moved to `ui.js`. SW v5. 13 e2e flows.
- 2026-10-07: Phase 3 merged (#6). 4.1 done:
  - Tab bar, pills and mini titles render into `#chrome` (outside `#app`), so `html.sheet-open` can scale `#app` and `#chrome` like an iOS card stack.
  - Ambient light is `body::before`, tinted by `html[data-day]` from Today.
  - Caustics come from `media/caustics.webp` (generated, seamless, 25 KB) on swim cards, the swim hero and the live swim card. Gym cards get a sheen.
  - Collapsing titles: tab roots get `.mini-title`; pushed pages fill `.topbar .title` from their heading (`html.title-collapsed`).
  - Kept the default status bar: `black-translucent` forces white status text, which is unreadable on the light theme. Revisit on a real device.
  - SW v6.
- 2026-10-07: 4.2 done:
  - New `tests/contrast.test.mjs` checks WCAG AA (4.5:1) for every text/background token pair in light and dark mode. Fixes: `--muted` `#5e6e76`, `--pool` `#09709a`, `--iron` `#b16009`, plus new `--iron-ink` and `--good-ink` for text on tinted chips.
  - A new e2e flow checks ≤ 3 blur layers (scrolled tab, open sheet, resting in a workout), the card stack opening and closing, and that nothing loops with Reduce motion.
  - Dark mode: selected segments use `--pill`.
- 2026-10-07: Phase 4 merged (#7). All checkpoints done; the live site serves service worker v6.
- 2026-10-07: 5.1 done.
  - Cause: Finish saved the workout with an event that redrew the live screen first. That copy of the Focus screen got replaced right away, read its pager as page 0, and saved the session back as active.
  - Fixes:
    - `saveActive` ignores a session that isn't the active one.
    - `saveFinished` saves silently.
    - `updateDots` skips a detached pager.
    - `healActive()` in `app.js` clears a saved workout left behind as active.
  - New e2e flow; SW v7.
- 2026-10-07: 5.2 done.
  - New exercises: 16 stretches (new Stretching group in Learn), plus Bodyweight Squat and Incline Push-Up. Photos are from Free Exercise DB.
  - Routines: `WARMUPS` / `COOLDOWNS` in `plans.js`, one each for full, upper and lower days.
    - The warm-up is stretches first (gentle movement, holds of 30 s or less), then moves.
    - The cool-down is 30–45 s holds.
    - `routineKind()` in `program.js` picks the set; your own workouts are judged by their exercises.
  - Sessions carry `warmup` / `cooldown` items with `done` flags; a saved workout keeps `{ ex, done }` only.
  - Workout page: Warm-up · Exercises · Cool-down sections, every item a row with a photo that opens its sheet.
  - List view: a checkable card at each end.
  - Focus view:
    - One page per item, then a Finish page.
    - Holds get a timer with a 5 s "switch sides" gap; it ticks the item and moves on.
    - Green dots mark warm-up and cool-down pages.
  - The celebration and History show "Warm-up 7/7 · Cool-down 5/5". The swim's dry warm-up uses the same rows. SW v8.
- 2026-10-07: 5.3 done.
  - In Focus mode, `restScreen()` in `session-gym.js` covers the screen while a rest runs:
    - a countdown ring (`countdownRing()` in `timer.js`), −15 s / +15 s, and "Up next" with the set and its planned weight;
    - Skip rest, which becomes "Start set N" once the rest is over.
  - "Show workout" tucks it into the rest bar (`restBar({ visible })`); tapping the bar brings it back.
  - While a sheet scales the page, `html.sheet-open .rest-screen` pins it to the visible part.
  - The list view keeps the rest bar and the pace clock.
- 2026-10-07: 5.4 done.
  - `js/swim-anim.js` draws a side-view swimmer in SVG for all 4 stroke guides and all 15 drills:
    - keyframed joint angles (`track()` for Catmull-Rom loops, `poses()` for pose-to-pose);
    - `reach()` keeps feet on the floor and hands on the wall;
    - captions name the phase; bubbles show breathing out; there is a kickboard, buoy and wall where the drill uses them.
  - It runs only while on screen, at up to 30 fps; a tap pauses it. With reduced motion it holds one pose.
  - Where it shows:
    - the how-to sheet (above the video);
    - stills on Today's swim card and the Workout page rows;
    - the live swim card (tap for the how-to);
    - animated stroke tiles and drill stills in Learn.
  - The 18 new stretches and moves also got short demo videos, each checked to exist and allow embedding.
  - SW v9.
- 2026-10-07: Follow-up round merged (#9, #10). All checkpoints done; the live site serves service worker v9.

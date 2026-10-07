# Lift & Lap revamp plan: navigation, analytics, polish, Apple Health

Status: **proposed, waiting for review**. Nothing in the app has changed yet.
This is the build spec: each phase can be handed to whichever model executes it, and ships as its own pull request.

---

## 1. Why it feels confusing today

Observed in the current build (v2):

1. **Two places answer "what do I do?"** Today's card and Plan → This phase both show workouts, in different layouts.
2. **The Today card is a wall of text.** It lists every exercise with sets and reps, plus a focus line, a "tap an exercise" hint and an "add weight" line. A combo day shows a callout and two of these cards.
3. **Five tabs, two of them about the same thing.** Log and Progress both answer "how am I doing". More is a junk drawer: Learn, Library, Tools, Settings, Backup, Install.
4. **Exercise details open three different ways.** Inside a workout it's a sheet; from Plan or Today it's a full page; from the Library it's another page.
5. **Tapping a day in the week strip leaves Today.** It opens a separate "day" page with its own back button, instead of updating Today in place.
6. **The live workout shows everything at once.** Every exercise is expanded, each with a suggestion box, notes, a "Previous" column and add/remove buttons. That makes for a long scroll and no clear "what now".
7. **Stats are scattered.** They're split across the Today tiles, Progress charts, the Log calendar and the Plan timeline.
8. **Navigation goes three levels deep.** Plan → Workout page → Exercise page → back → back.

## 2. Goals and non-goals

**Goals**
- One obvious path from opening the app to "start today's workout": 1 tap.
- From Today, any exercise's demo is 2 taps away (card → Details → exercise). Inside a workout, it's 1 tap.
- Each screen has one job and shows the summary first, with details on tap.
- A Progress tab with a **Total / Gym / Swim** switch and time ranges, where every number and chart updates together.
- A premium feel: frosted glass chrome, fluid spring motion, signature moments for completing sets, swims and workouts.
- Save workouts to **Apple Health**.

**Non-goals**
- No framework rewrite: stay with plain ES modules, no build step, hosted on GitHub Pages.
- No changes to the program content (exercises, plans, swims) or the progression logic, except where this spec says so.
- No native iOS app in this plan (see 9.4 for that option).
- No breaking changes to stored data. New fields are optional and old backups still restore.

## 3. Constraints and platform facts (checked October 2026)

| Topic | Fact | Consequence |
| --- | --- | --- |
| View Transitions | Safari 18+ (iOS 18) supports same-document `document.startViewTransition` | Page and tab transitions and shared-element morphs. Instant swap fallback on older iOS. |
| CSS `linear()` easing | Safari 17.2+ | Real spring curves in CSS (tokens in 5.2) |
| Scroll-driven animations | Safari 26+ | Collapsing large titles in CSS where supported, with a small JS fallback |
| `backdrop-filter` blur/saturate | Supported (use the `-webkit-` prefix too) | Frosted glass works on iPhone |
| SVG refraction in `backdrop-filter` (`url(#filter)`) | Chromium only; Safari renders nothing | True Liquid Glass lensing is **not possible** on iPhone web. Use frosted glass with specular highlights. |
| Haptics from web | Only via the `<input switch>` hack, iOS 17.4–26.4; patched in iOS 26.5 | Skip it. Don't build on it. |
| Edge-swipe back in Home Screen apps | iOS supports back and forward swipe through history entries | Use the History API so swipe-back works for free. Skip our own animation when `popstate.hasUAVisualTransition` is true. |
| Apple Health | No web API. Native apps only. | Use an Apple Shortcuts bridge (section 9) |
| Performance | Each `backdrop-filter` layer is expensive on iOS | At most **3** live blur layers at once (tab bar, top bar, one sheet). Content cards use "faux glass" with no blur. |

Accessibility:
- Respect `prefers-reduced-motion`.
- Add in-app **Reduce motion** and **Reduce transparency** toggles, since Safari has no `prefers-reduced-transparency`.
- Text on glass must reach a 4.5:1 contrast ratio.

## 4. New information architecture

### 4.1 Tabs: 4 instead of 5

| Tab | Job | Replaces |
| --- | --- | --- |
| **Today** | What's on today and this week, with a 1-tap start | Today, and the day page |
| **Plan** | My week, my program, my workouts | Plan (slimmed), the template page |
| **Progress** | How am I doing? Total / Gym / Swim × W / M / 3M / 6M / Y, plus history | Progress and Log |
| **Learn** | Exercises, machines, strokes, drills, guides and tools | Library, Learn and Tools (out of More) |

**Settings** is the gear icon in the Today top bar, and More goes away. Program settings live in Plan → Program only, so nothing is duplicated in two places.

### 4.2 Navigation rules (put these in a code comment in `router.js`)
- **Tap a workout → its page.** Pushed pages slide in from the right, and swipe-back works.
- **Tap an exercise, stroke or drill → its card slides up** as a sheet, never a page.
- **Full-screen modes hide the tab bar:** live workout, live swim, celebration and setup.
- **Never more than 2 levels deep** under a tab.
- Each tab keeps its own stack and scroll position. Tapping the active tab pops to its root, or scrolls to the top if already there.

### 4.3 Route map

| Old route | New |
| --- | --- |
| `today` | `today` (tab root), with in-place day switching |
| `day` | **removed**: the selected day lives in Today's state |
| `plan` | `plan` (tab root), restructured |
| `template` | `workout` page: one design for program, swim and custom workouts |
| `builder` | `builder` (pushed from Plan) |
| `log` | `history` page (pushed from Progress) |
| `session-detail` | `session-detail` (unchanged content, restyled). Opened from History, Progress → Recent and done days on Today. |
| `progress` | `progress` (tab root), new design |
| `body-log`, `habits` | Shown only when Body & habits is on. Pushed from Settings. |
| `more` | **removed** |
| `learn`, `library`, `exercise`, `drill`, `guide`, `tools` | `learn` (tab root) with sections. Exercise, stroke and drill open as **sheets**; `guide` and `tools` are pushed pages. |
| `settings`, `data`, `install` | `settings` page (pushed from the Today gear), with `data`, `install` and (Phase 5) `health` as sub-pages |
| `session`, `swim-session`, `edit-session`, `edit-swim`, `onboarding` | Unchanged names. Full-screen. |
| (new) | `celebration`: full-screen, shown after Finish (6.6) |

## 5. Visual system

### 5.1 Glass

Two kinds of surface:

- **Chrome glass**, with real blur. Use it only for the floating tab bar, the top bars, sheets, the segmented control, the rest pill and the resume pill.
- **Faux glass**, with no blur. Use it for content cards: translucent fill, hairline highlight and a soft shadow over the ambient background.

```css
:root {
  --glass-tint: rgba(255, 255, 255, .58);
  --glass-edge: rgba(255, 255, 255, .7);
  --glass-shadow: 0 10px 30px rgba(15, 32, 41, .12);
  --glass-blur: 22px;
  --card-tint: color-mix(in srgb, var(--surface) 80%, transparent);
}
/* dark values in both dark blocks: --glass-tint: rgba(20, 31, 37, .52); --glass-edge: rgba(255, 255, 255, .14); --glass-shadow: 0 10px 30px rgba(0, 0, 0, .35) */

.glass {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, 0) 45%), /* sheen */
    var(--glass-tint);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255, 255, 255, .55); /* top specular rim */
}
.card-glass {
  background: var(--card-tint);
  border: 1px solid var(--line);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .5) inset, 0 6px 20px rgba(15, 32, 41, .06);
}
html.reduce-transparency .glass { background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
```

### 5.2 Ambient background

A fixed layer behind everything gives the glass something to blur:
- Three soft radial blobs in amber (gym), lane blue (swim) and teal.
- The blobs drift slowly, translating on a 40 s alternating loop.
- The tint follows the selected day's plan through `html[data-day="gym|swim|both|rest"]`.
- The drift pauses when the page is hidden and is off with Reduce motion.

### 5.3 Motion tokens

These spring curves were computed from real spring physics.

```css
:root {
  --ease-snappy: linear(0, 0.071, 0.217, 0.373, 0.521, 0.646, 0.742, 0.818, 0.872, 0.913, 0.942, 0.961, 0.975, 0.984, 0.99, 0.994, 0.996, 0.998, 0.999, 0.999, 1); /* 320ms */
  --ease-page:   linear(0, 0.093, 0.264, 0.437, 0.589, 0.705, 0.793, 0.857, 0.902, 0.933, 0.955, 0.97, 0.98, 0.986, 0.991, 0.994, 0.996, 0.997, 0.998, 0.999, 1); /* 430ms */
  --ease-bouncy: linear(0, 0.185, 0.547, 0.881, 1.09, 1.167, 1.152, 1.094, 1.034, 0.993, 0.973, 0.973, 0.981, 0.992, 1, 1.004, 1.005, 1.004, 1.002, 1, 1); /* 790ms, 17% overshoot */
  --dur-snappy: 320ms; --dur-page: 430ms; --dur-bouncy: 790ms;
}
```

### 5.4 Motion choreography

| Moment | What moves | Timing |
| --- | --- | --- |
| Tab switch | Content crossfades and rises 8 px. The tab bar's glass pill slides to the new tab. | 220 ms ease-out; pill uses `--ease-snappy` |
| Push page | New page slides in from the right; old page drifts 30% left and dims | `--dur-page` / `--ease-page` |
| Pop / swipe-back | Reverse of push. Skipped if `popstate.hasUAVisualTransition`. | same |
| Workout card → Workout page | Shared element: the card's header morphs into the page hero (`view-transition-name: wk-hero`) | `--ease-page` |
| Sheet open | Slides up and the scrim fades in. The page behind scales to 0.94 with rounded corners, iOS card-stack style. | `--ease-page` |
| Sheet drag | Follows the finger. Release past 30% of its height, or with a fast flick, to dismiss; otherwise it snaps to the nearest detent. | `--ease-snappy` |
| Day switch (Today) | Content slides 24 px in the direction of the date and fades | `--dur-snappy` / `--ease-snappy` |
| List entrance | Items fade in and rise 12 px, staggered 30 ms, at most 8 items. **Only when arriving on a screen, never on data refresh.** | 300 ms |
| Press | Scale to 0.97 on `:active` | 120 ms |
| Set complete | Check stroke draws, the row fill sweeps left to right, and the exercise's progress segment fills | `--ease-bouncy` |
| Rep done (swim) | A water ripple spreads from the tap point across the button | 600 ms |
| Rest starts | The button morphs into a floating glass rest pill at the top. Tapping the pill expands it into the pace-clock sheet. | `--ease-snappy` |
| KPI numbers | Count up from the previous value | 600 ms ease-out |
| Charts | Bars grow from the baseline, staggered 20 ms; lines draw in (`stroke-dashoffset`); the area fades in | 500–700 ms |
| Week rings | Arcs sweep to their value | `--ease-bouncy` |
| Celebration | Rings close, then a 1.6 s confetti burst in brand colors (custom canvas, about 80 lines, no library), then PR medals flip in with stagger | about 2 s total |

**Reduced motion:** everything becomes a 150 ms opacity fade. No confetti, drift, caustics or stagger.

### 5.5 Signature visuals (Phase 4)
- **Swim cards and the swim workout hero:** an animated water-caustics texture. Generate a seamless 512×512 WebP offline (Voronoi caustics, about 40 KB), then pan it with CSS `background-position` (cheap). Pause it when off-screen using an IntersectionObserver.
- **Gym cards:** a slow diagonal light sheen sweeping across every 6 s.
- **Status bar:** set `apple-mobile-web-app-status-bar-style` to `black-translucent` so the glass top bar runs under the status bar. This needs the top safe-area padding.
- **Typography:** keep Barlow Condensed and Barlow. Use iOS-style large titles that collapse into the glass top bar on scroll. Make big numbers bolder and larger.

## 6. Screen specs

### 6.1 Today

```
┌────────────────────────────────────┐
│ Wed, Oct 7 · Week 1 · Foundation  ⚙│  glass top bar (title fades in on scroll)
│ Good morning, <name>               │  large title
│ ‹  M   T  [W]  T   F   S   S  ›    │  week strip; swipe for other weeks
│    ◒   ○   ◑   ·   ◒   ○   ·       │  ◒ gym ○ swim ◑ both · rest ✓ done
├────────────────────────────────────┤
│ ┌ GYM · 1 of 2 ·········· ~45 min┐ │  compact workout card (faux glass)
│ │ Full Body A                    │ │
│ │ ▢ ▢ ▢ ▢ ▢ ▢   6 exercises      │ │  exercise photo thumbnails
│ │ ↑ Add weight on 2              │ │  ONE hint line, optional
│ │ [ Start workout ]   Details ›  │ │
│ └────────────────────────────────┘ │
│              then                  │  connector (combo days only)
│ ┌ SWIM · 2 of 2 ·········· 500 yd┐ │
│ │ Technique 1                    │ │
│ │ Warm-up · Kick · Drills · Main │ │
│ │ [ Start swim ]      Details ›  │ │
│ └────────────────────────────────┘ │
│ ◎ This week   Gym 1/3   Swim 0/2 › │  rings card → Progress (Total, W)
└────────────────────────────────────┘
      (  Today   Plan   Progress   Learn  )   floating glass tab bar
```

**Behavior**
- **Selecting a day** updates the content in place, using the day-switch motion from 5.4. A small "Today" pill appears in the top bar when another day is selected. Swiping the strip horizontally changes the week.
- **Day states:**
  - Planned: type icon.
  - Done: filled ring with a check, in the type's color.
  - Missed (a past planned day with no session): hollow, muted.
  - Rest: a dot.
  - Today: outlined.
- **Card content by day:**
  - Today: planned cards with Start and Details.
  - Future: cards with Details only. Starting is still possible from the Workout page.
  - Past: "Done" summary cards that open the session page, or "Missed. It's still next up."
  - Rest: a calm rest card with "Train anyway", which opens the start picker.
- **Card ⋯ menu:** "Do a different workout" (start picker) and "Edit my week", which jumps to Plan.
- **Banners:** at most one at a time, in this priority:
  1. A **resume pill**. It floats above the tab bar on every tab while a session is active.
  2. The backup reminder.
  3. The first-days intro.
- **Removed from Today:**
  - The stat tiles (now in Progress).
  - The big "Do a different workout" button (now in the ⋯ menu).
  - The full exercise list (now on the Workout page).
  - The tip of the day. It only shows on rest days.
- **Fit check:** on an iPhone 13, a single-session day shows the whole card and the rings without scrolling.

### 6.2 Workout page (pushed)

```
┌────────────────────────────────────┐
│ ‹                               ⋯ │  glass bar; title appears on scroll
│▓▓▓▓▓ hero: amber gradient (gym) ▓▓▓│  or caustics (swim); morphs from the card
│ GYM · Phase 1 Foundation           │
│ Full Body A                        │
│ ~45 min · 6 exercises · Machines,  │
│ dumbbells                          │
├────────────────────────────────────┤
│ Warm-up · 5 min                  › │  → sheet with checklist
│ ▢ Leg Press         3×10–15  ↑   › │  thumbnail, name, target, chip
│ ▢ Chest Press       3×10–15      › │  tap → Exercise sheet
│ …                                  │
│ Cool-down · 3 min                › │
└────────────────────────────────────┘
│ [          Start workout         ] │  sticky glass footer
```

- **Swim version:** block headers (Warm-up, Kick, …), with rows like `4 × 25 yd Freestyle · rest 30 s`. Tapping a row opens the stroke or drill sheet. A total and a lengths count sit in the hero.
- **Custom workouts:** an Edit button in the ⋯ menu.

### 6.3 Exercise, stroke and drill sheet (one component everywhere)

- **Medium detent (about 60% height):**
  - The looping demo photos. Strokes and drills show the video poster instead.
  - The name, and up to two "Also called" chips plus a "+N" chip.
  - The target, when opened from a workout.
  - The three key cues.
  - Buttons: **Watch video** (expands to the large detent and plays inline) and **How to do it** (expands).
- **Large detent:** full steps, the "Find it in the gym" card, the video, "Avoid" mistakes and the exercise's history (last 3 sessions plus best).
- **Opened from a live workout:** it also offers a **Swap exercise** action.
- **iOS gotcha:** remove the transform from the sheet once it has finished opening (`transform: none`). Otherwise the YouTube iframe can misplace its touch area.

### 6.4 Live workout: Focus mode (new default) and List mode

```
┌────────────────────────────────────┐
│ ✕  Full Body A · 12:31    ☰  Finish│  glass bar; ☰ = List mode
│ ▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱  one segment per set│
│ ┌────────────────────────────────┐ │
│ │      looping demo photo        │ │  tap → Exercise sheet
│ └────────────────────────────────┘ │
│ Leg Press                          │
│ Set 2 of 3 · 10–15 reps            │
│ ↑ Try 110 lb today              ⓘ │  one-line suggestion; ⓘ shows why
│ ✓ 1   100 lb × 12                  │  done sets collapse
│ ● 2   [−] 110 lb [+]  [−] 10 [+]   │  steppers: no keyboard needed
│ ○ 3   110 × –                      │
│ [         Complete set 2         ] │  big primary
│ + Add set                          │
└────────────────────────────────────┘
   swipe ← → between exercises
   (◔ 1:24 · Next: set 3 · Skip)  ← floating glass rest pill
```

- **Steppers:** − / + change the weight by one step. The step is the next real dumbbell size for dumbbells, one pin for machines, and 5 lb / 2.5 kg for barbells. `nextDumbbell` and the `inc` field already exist. Reps step by 1. Tapping the number still opens the keypad.
- **Page 0** is a warm-up card with the checklist and an "I'm warmed up →" button. **The last page** is the cool-down card with Finish.
- **Advancing:**
  - After the last set of an exercise, the rest pill says "Next: Chest Press".
  - When the rest ends, or when Next is tapped, the pager slides to the next exercise.
  - The user can swipe to any exercise at any time.
- **List mode:** today's card list, kept for overview and reordering. Settings → Workout sets the default mode, Focus or List.
- **Finish:** goes to the celebration (6.6).

### 6.5 Live swim
- The focus card stays and dominates: the current rep, the length chip, a big **Rep done** with the ripple, and a single "Next up" line.
- "All sets" becomes a collapsed accordion.
- Extra lengths move into the ⋯ menu.
- The on-deck warm-up becomes a dismissible "Before you get in" card that shows once, at the start.
- The rest pill and pace-clock sheet work the same as in the gym.

### 6.6 Celebration (after Finish)

```
        ◎◎  rings close, confetti
      Workout complete
      Full Body A · 47 min
 ┌ 15 sets ┐ ┌ 6,240 lb ┐ ┌ 2 PRs ┐
  🏅 Leg Press: heaviest ever (110 lb)        (medal icon, no emoji in UI)
  How did it feel?  [Easy] [Moderate] [Hard] [Max]
  Notes (optional, collapsed)
  [ Save ]        [ Send to Apple Health ]    (Phase 5)
```

Swims show distance, time and pace per 100, plus any records.

### 6.7 Plan

```
Plan
Week 3 of 12 · Foundation   ▰▰▰▱▱▱▱▱▱▱▱▱      ⓘ About the program
Your week
 ┌Mon┐┌Tue┐┌Wed┐┌Thu┐┌Fri┐┌Sat┐┌Sun┐   7 compact chips: icon + label
 │Gym││Swm││G+S││ · ││Gym││Swm││ · │   tap → sheet: Gym / Swim / Gym + Swim / Rest / custom
Workouts in rotation   → horizontal scrolling cards (tap → Workout page)
 [Full Body A] [Full Body B] [Technique 1] [Endurance 1]
Your workouts
 [+ Create]  [Arms & Abs]  …
Program
 Gym program · Full body ›  Swim level · Beginner ›  Swim workouts · Simple ›  Phase · Auto ›  Restart ›  Swaps ›
```

### 6.8 Progress

```
Progress
[  Total  |  Gym  |  Swim  ]        glass segmented control; sliding pill
[ W  M  3M  6M  Y ]                 range chips
┌───────────────┬───────────────┐
│ Workouts  9   │ Active time   │   KPI tiles (count up) with "vs previous period"
│ ↑2 vs last M  │ 6 h 40 m      │
├───────────────┼───────────────┤
│ Week streak 3 │ Swum 2,400 yd │
└───────────────┴───────────────┘
[ Main chart: one bar per day/week/month; scrub to read ]
[ Section 2 (by mode) ]
[ Records ]
Recent ─ last 5 sessions (filtered by mode)        See all history ›
```

**Ranges:**

| Range | Span | One bar per |
| --- | --- | --- |
| W | last 7 days | day |
| M | last 30 days | day |
| 3M | last 13 weeks | week |
| 6M | last 26 weeks | week |
| Y | last 12 months | month |

Each KPI compares against the previous period of the same length.

**Content by mode:**

| | Total | Gym | Swim |
| --- | --- | --- | --- |
| KPI tiles | Workouts, Active time, Week streak, Swim distance | Workouts, Volume lifted, Sets, PRs | Swims, Distance, Time in water, Avg pace per 100 |
| Main chart | Sessions per bucket, **stacked** gym (amber) + swim (blue), with a legend | Volume per bucket | Distance per bucket |
| Section 2 | Consistency calendar (month grid of dots) | **Strength:** lift chips + estimated 1RM trend line. **Muscle groups:** horizontal bars of sets per group. | **Pace trend** (line; lower is better, say so in the subtitle). **Distance by stroke** (horizontal bars). |
| Records | Longest streak, busiest week | PR list with dates | Longest swim, best pace |
| Recent | All sessions | Gym sessions | Swims |

- **Switching** mode or range: the segmented pill slides, KPIs count to their new values, and the chart area crossfades through a named view transition. Then the bars grow back in.
- **History page** (pushed from "See all history"): the existing Log content (month calendar, filter chips, grouped list), plus "Log another activity".
- **Charts** follow the dataviz rules already in `js/charts.js`: one axis, thin marks, a legend only when there are 2+ series, text in ink colors and never in the series colors.

### 6.9 Learn

```
Learn
[ 🔍 Search exercises, machines, strokes… ]   matches names and "also called" names
Exercises      [All][Legs][Chest][Back][Shoulders][Arms][Core][Cardio]
 ┌──────┐┌──────┐    2-column grid: photo, name, group; tap → Exercise sheet
 │ img  ││ img  │
Swimming       strokes (4 cards) · drills (list); tap → sheet
Guides         12 cards with read time → guide page
Tools          Plates · 1-rep max · Pace · Food → tools page
```

### 6.10 Settings (gear on Today)

The sections, in order:
1. **Profile:** name, units.
2. **Pool.**
3. **Workout:** rest times, sound, keep screen awake, default live view (Focus or List).
4. **Appearance:** theme, Reduce motion (default: follow the system), Reduce transparency.
5. **Apple Health:** a setup guide and a "Test" button (Phase 5).
6. **Body & daily habits:** a toggle. The Body log and Habits rows show when it's on.
7. **Backup & data.**
8. **Install on iPhone.**
9. **About.**

## 7. Architecture changes

### 7.1 `js/router.js` (new; takes over the navigation half of `app.js`)
- **State:** `{ tab, stacks: { today: [], plan: [], progress: [], learn: [] }, scroll: {} }`. Each stack entry is `{ name, params, key }`.
- **API:**
  - `go(name, params, { shared })`: push a page.
  - `back()`: calls `history.back()`.
  - `tab(id)`: switch tab, or pop to root if already active.
  - `replace(name, params)`.
  - `openFull(name)`: for session, swim-session, celebration and onboarding.
- **History:**
  - A push calls `history.pushState({ key }, '', '#/' + tab + '/' + name)`.
  - Tab switches call `replaceState`, so tabs don't pile up history entries.
  - `popstate` pops the stack and renders. If `event.hasUAVisualTransition` is true, render without our animation; iOS's swipe already animated it.
- **Transitions:** `withTransition(kind, update)`.
  - If `document.startViewTransition` exists and Reduce motion is off: set `document.documentElement.dataset.vt = kind` (`push | pop | tab | day | none`), then run `startViewTransition(update)`. Clear the attribute when it finishes.
  - Otherwise, just run `update()`.
- **`entering` flag:** pass `{ entering }` to view functions. It is true only on navigation, so list entrance animations never replay when data changes and the screen re-renders. **This is essential:** the app re-renders the whole view on every store change.
- **Persistent elements:** give the tab bar `view-transition-name: tabbar` so it doesn't animate with the page.
- **Shared element:** before pushing the Workout page, set `style.viewTransitionName = 'wk-hero'` on the tapped card's header. The page hero always carries `wk-hero`. At most one element may have that name at a time.

### 7.2 `js/sheet.js` (new; replaces `sheet()` in `ui.js` and keeps the same call signature, plus options)
- Signature: `openSheet(title, content, { detents: ['medium', 'large'], initial: 'medium', onClose })`.
- Drag works with pointer events on the grabber and header, and on the content once it's scrolled to the top. Add rubber-banding past the top detent. Dismiss below 30% of height or on a fast flick.
- While open, `#app` gets `sheet-open`: scale 0.94, `border-radius: 14px`, dimmed. Stacked sheets push the one below back.
- Trap focus inside; Escape closes; return focus to the trigger on close.
- `confirmDialog` and `toast` stay in `ui.js`, restyled as glass.

### 7.3 `js/motion.js` (new)
- `reducedMotion()`: true if the system setting or the in-app setting is on.
- `countUp(el, from, to, format)`, `drawPath(pathEl)`, `growBars(svg)`, `stagger(container)`.
- `ripple(button, event)`: the swim ripple.
- `confetti(colors)`: a canvas burst that removes itself.
- `rings(svg, values)`: the animated arcs.

### 7.4 Stats additions (`js/stats.js`, pure functions with unit tests)
- `RANGES` table and `buckets(rangeKey, todayIso)` → `[{ start, end, label }]`.
- `progressSummary(sessions, { mode, range, today, weightUnit, poolUnit })` → `{ kpis, prevKpis, series, section2, records, recent }`.
- `setsByMuscleGroup(sessions)` and `swimDistanceByStroke(sessions)`, from item strokes and done reps.
- `weekRings(sessions, schedule, todayIso)` → `{ gym: [done, planned], swim: [done, planned] }`.

### 7.5 Charts (`js/charts.js`)
- Add `stackedColumns` (2 series with a legend) and `hBars` (horizontal bars with labels).
- Add mount animations driven by `motion.js`, and make them respect Reduce motion.

### 7.6 Data model (all fields optional and backwards compatible)
- `settings.sessionView`: `'focus' | 'list'`, default `'focus'`.
- `settings.reduceMotion` and `settings.reduceTransparency`: `'system' | true | false`.
- `settings.health`: `{ enabled, shortcutName, bodyKg }`.
- `session.health`: `{ sentAt }`.

### 7.7 Housekeeping per phase
- Bump `VERSION` in `sw.js` and add every new file to `SHELL`. A test enforces this.
- **Phase 0 first task:** move the Playwright end-to-end scripts into `tests/e2e/`. Add an `npm run test:e2e` that serves the folder and runs them. Keep Playwright out of `package.json` so the app stays dependency-free: load it from `PLAYWRIGHT_PATH` when set, else a normal install. In Claude's cloud environment it is preinstalled at `/opt/node-tools/node_modules/playwright`. Document both in `tests/e2e/README.md`. Every later phase updates them.
  - The v2 QA scripts lived in a temporary folder and may not exist in the executing session. If they're missing, write the suite fresh (iPhone 13 viewport, light and dark), covering at least the flows below. All of them passed on v2.
    - **Setup and reset:** onboarding end to end; 2 training days default to Gym + Swim; "Delete all data" returns to setup step 1.
    - **Today:** a combo day shows the gym card then the swim card; after the gym session, a done row plus the swim card; both done shows "Done today"; future days alternate A/B (or Upper/Lower); no daily check-in by default.
    - **Exercise details:** demo photos, "Find it in the gym", video poster that turns into an inline player, no external links; alias search finds "Assisted Pull-Up".
    - **Sessions:** resume after reload; a typed weight survives reload; thumbnails in session cards; the in-session sheet shows "Find it in the gym"; the swim how-to has a video.
    - **Program logic:** Upper/Lower names in Plan; Simple swim mode has no drill items; a 50 m pool gives 1-length reps with scaled rest and the lane-rope note for novices; kg conversion in Progress and suggestions (leg press about 50 kg, real dumbbell sizes); "Plan complete" after week 12.
    - **Data:** backup round-trips exactly; an invalid backup file shows an error toast.
- One pull request per phase into `main`. CI (unit tests plus syntax check) must be green before merging.

## 8. Phases

Each phase ships on its own, so the live app improves step by step.

| Phase | Size | Ships |
| --- | --- | --- |
| 0. Groundwork | M | Router with history, view transitions and swipe-back; new sheet with detents, drag and card-stack; motion and glass tokens; e2e suite in the repo. No layout changes yet. |
| 1. Navigation and Today | L | 4 tabs and the glass tab bar; Settings behind the gear; Learn tab; Today redesign; Workout page; unified exercise sheet; Plan restructure; old routes retired |
| 2. Live sessions | L | Focus mode with pager, steppers and rest pill; List-mode toggle; swim simplification; celebration screen |
| 3. Progress | M | Total/Gym/Swim × W/M/3M/6M/Y; KPIs with comparison; animated charts; History page |
| 4. Polish | M | Ambient background, caustics, sheen, tickers, collapsing titles, black-translucent status bar, accessibility, performance and dark-mode pass |
| 5. Apple Health | S | Shortcut bridge, Settings guide, "Send to Apple Health" on the celebration screen |

### Acceptance checks (automate in `tests/e2e` wherever possible)

**Phase 0**
- Every existing e2e flow still passes.
- Push and pop animate, and tab switches crossfade.
- Swipe-back performs exactly one animation.
- With Reduce motion on, there are no transforms.
- Sheets open at medium, drag to large, and swipe down to close.

**Phase 1**
- Today → Start is 1 tap; Today → Details → exercise sheet is 2.
- Selecting another day doesn't change the route.
- No `more`, `log` or `day` routes remain.
- On an iPhone 13, a single-session day fits without scrolling.
- Tapping the active tab pops to its root.

**Phase 2**
- A full gym workout can be completed with steppers only, no keyboard.
- Data survives reloading in the middle of a set.
- Switching to List mode shows the same data.
- The celebration shows PRs.
- The swim focus card plus the collapsed set list works through a whole session.

**Phase 3**
- Every mode × range combination renders with no console errors.
- KPI totals match the sum of the chart buckets (unit test).
- Comparisons are correct across a month boundary (unit test).
- History lists everything.

**Phase 4**
- At most 3 `backdrop-filter` elements in the DOM at any time (e2e check).
- Text contrast is at least 4.5:1 in both themes, with spot checks on glass.
- Nothing animates with Reduce motion on.
- Caustics pause when off-screen.

**Phase 5**
- The payload unit test passes: yards become meters, and kcal is computed only when body weight is set.
- The URL is encoded correctly.
- Sessions are marked as sent, and a second send asks for confirmation.

### Guidance for the executing model
- Read this file and the existing code first. Keep the house style: `h()`, `put()` and `fill()` helpers, tokens in `css/app.css`, and copy in plain sentence case.
- Never re-animate on data refresh (7.1, the `entering` flag).
- Never let more than 3 blur layers exist at once. Cards use `.card-glass`.
- Keep every existing feature reachable. The route map in 4.3 is the checklist.
- Phases 0 and 2 carry the most risk (navigation engine and live session). Review them most carefully.

## 9. Apple Health

### 9.1 What's possible
- **Direct access: no.** Apple Health (HealthKit) is only available to native iPhone apps. There is no web API.
- **Practical: yes, one-way, through Apple Shortcuts.** The Shortcuts **Log Workout** action takes a type, start date, duration, calories and distance. A web app can launch a shortcut with data, using `shortcuts://run-shortcut?name=…&input=text&text=…`.
- **Reading back from Health (for example, weight) isn't practical.** Opening a link from Shortcuts lands in Safari, not the installed app, and the two keep separate storage.

### 9.2 The bridge
1. **Install once.** A guided page (Settings → Apple Health) walks through building the shortcut "Lift & Lap to Health" in five steps:
   1. **Get Dictionary from** Shortcut Input.
   2. **Get Dictionary Value** for `type`, `start`, `minutes`, `meters` and `kcal`.
   3. **If** `type` is `swim`: **Log Workout**, Type *Swimming*, with Start Date, Duration (minutes), Distance (meters) and Calories (kcal).
   4. **Otherwise:** **Log Workout**, Type *Traditional Strength Training* (or *Other* for logged activities), with Start Date, Duration and Calories.
   5. **Show Notification:** "Saved to Apple Health".
2. **Each workout.** The celebration and session pages get a **Send to Apple Health** button, which opens `shortcuts://run-shortcut?name=Lift%20%26%20Lap%20to%20Health&input=text&text=<urlencoded JSON>`.
   - Payload: `{ v: 1, type: 'strength' | 'swim' | 'other', start: ISO, minutes, meters?, kcal? }`.
   - **Distance is converted to meters,** because Log Workout's distance units don't include yards.
   - **Calories are estimated with net MET values:** `(MET − 1) × kg × hours`.
     - Strength: MET 3.5.
     - Swim: MET 6.0.
     - Logged activity: MET 3.0.
   - This needs a body weight, entered once in Settings → Apple Health and stored only there. If it's missing, calories are left out (if the action requires them, send 0 and say so in the guide).
3. **Returning to the app.** The user comes back through the app switcher; Shortcuts can't reopen a Home Screen web app. Mark `session.health.sentAt`, and ask for confirmation before sending again.
4. **Weight.** Log it directly in the Health app, or with a smart scale. The guide also shows an optional 2-action "Log Weight" shortcut for the Home Screen (Ask for Number → Log Health Sample: Weight). The app itself stays focused on training.
5. **Apple Watch owners.** Starting swims on the Watch gives automatic lap counting and logs to Health natively. The guide should say: if you record a workout on the Watch, don't also send it from Lift & Lap. Otherwise Health shows it twice.

### 9.3 Things to verify on a real iPhone during Phase 5
These can't be tested from the build machine:
- The exact names in Log Workout's Type list (*Swimming*, *Traditional Strength Training*).
- Whether Calories is required.
- That `shortcuts://` opens from the installed Home Screen app.

### 9.4 Later option: a native wrapper app (out of scope)
- Wrap this same web app with Capacitor and a HealthKit plugin (for example `@capacitor/health-fitness` or `@capgo/capacitor-health`). That would enable:
  - Two-way sync.
  - Reading Apple Watch workouts into the Progress charts.
  - Reading weight.
  - Writing richer swim workouts.
- Costs:
  - A Mac with Xcode. It can't be built or tested from this Linux environment.
  - An Apple Developer membership ($99/year), or reinstalling every 7 days with a free account.
  - A separate distribution path: TestFlight or the App Store.

## 10. Open questions for review

1. Tab names: **Today · Plan · Progress · Learn**?
2. Progress switch labels: **Total · Gym · Swim**, or your wording **Total · Workout · Swim**?
3. Live workout default: **Focus mode** (one exercise at a time) with a List toggle?
4. Time ranges: **W · M · 3M · 6M · Y**, replacing 8 weeks / 12 weeks / 6 months?
5. Do you use an Apple Watch? That decides whether swims should be recorded on the Watch or sent from the app.
6. Would you like a clickable mockup of the new Today screen and glass tab bar before Phase 1 is built?

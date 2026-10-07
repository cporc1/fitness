# Lift & Lap

A phone-first training app for a beginner with a full gym and a lap pool: a 12-week plan, a live workout logger, swim sets with a lap counter, progress charts, body tracking, habits and beginner guides. It is a static web app (plain HTML, CSS and JavaScript, no build step) that installs on an iPhone Home Screen and works offline at the pool.

## What's inside

| Area | What you get |
| --- | --- |
| **Today** | The plan for any day: tap a day in the week strip (or swipe to other weeks) and the cards update in place. Each session is a compact card with exercise photos, Start and Details; gym + swim days show both, in order. Past days show what you did, rest days a tip, and a rings card tracks this week's workouts and swims. Settings live behind the gear |
| **Workout page** | Details for any workout: time, equipment and a Start button. Gym workouts come in three parts: a warm-up (stretches first, then warm-up moves), the exercises, and a cool-down of longer stretches. Swims list every set with its target. Every row has a photo and opens its how-to sheet |
| **Plan** | Where you are in the 12-week program (three phases: Foundation → Build → Progress), your week as seven day chips (gym / swim / both / rest), the workouts in rotation with what's up next, your own workouts and a builder, and program settings (full body or upper/lower, swim level, Simple swims) |
| **Gym logger** | Sets × weight × reps with last session's numbers alongside, automatic weight suggestions (double progression), a floating rest timer that opens a pool pace clock, exercise swaps (today only or permanently), how-to for every exercise, warm-up and cool-down you tick off as you go, PR detection. List view by default, or Focus mode: one step per page, from the first stretch to Finish. It has − / + buttons that step to the next real dumbbell size or machine pin, so no keyboard is needed, and a hold timer for stretches that tells you when to switch sides. Finishing opens a celebration with this week's rings, your records and "How did it feel?" |
| **Swim logger** | A "Before you get in" card (with an Apple Watch Pool Swim reminder), then the current rep with a big "Rep done" button and what's next; all sets fold away underneath. Automatic rest countdown, stroke and drill how-tos with video, distance tracking in your pool's units (25 yd, 25 m or 50 m), a free-swim lap counter, and a Simple mode (just freestyle, breaststroke and kickboard) |
| **Progress** | Workouts per week, estimated 1-rep max per lift, weekly volume, swim distance and pace, milestones, and History: a calendar and list of every session with details, edit, delete and "log another activity" |
| **Learn** | 50 gym exercises with looping start/finish photos, an in-app video, step-by-step instructions and "Find it in the gym" (other names the machine goes by and what it looks like); 4 swim strokes and 15 drills with in-app videos; 12 beginner guides; tools (plate calculator, 1RM, swim pace, calories & protein). Search finds machines by their other names |
| **Settings** | Name and units, pool, rest timer, theme, Reduce motion and Reduce transparency, optional body and habit tracking, backup/restore and "Delete all data" to start over after a test run |

Moving around: every page you open can be closed by swiping from the left edge, each tab remembers where you were, and exercises, strokes and drills open as sheets you drag down to close.

### The program

- **Gym:** two alternating full-body days (A and B), or Upper / Lower for 4+ gym days a week. Weeks 1–4 use machines and dumbbells; weeks 5–8 introduce the squat and trap-bar deadlift with light weights; weeks 9–12 go heavier. Every exercise has a rep range; when you hit the top of the range on every set, the app suggests the next weight (the next real dumbbell size, one pin on a machine, 5 lb / 2.5 kg on a barbell).
- **Pool:** alternating technique and endurance swims, matched to your level: *learning to swim* (standing-depth water confidence, never full lengths), *beginner* (25–50 then rest) or *comfortable* (200+ continuous). Distances adapt to your pool length; in a 50 m pool rests grow with the longer swims.
- **Week:** you choose the days and whether each is gym, swim or both; program days pick the next session automatically, so a missed day never breaks the plan.

Demo photos come from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (public domain). Videos are embedded from YouTube creators credited under each one, and play inside the app.

## Using it on your iPhone

This repository is the source of truth for the app. GitHub Pages publishes whatever is on the `main` branch at **https://cporc1.github.io/fitness/**, and every change merged into `main` goes live within a minute or two.

One-time setup (GitHub Pages is free for public repositories; a private one needs a paid GitHub plan):

1. **Make the repository public:** Settings → General → Danger Zone → Change visibility → Change to public. The code contains no personal data.
2. **Turn on Pages:** Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. On your iPhone, open the address in **Safari** → **Share** → **Add to Home Screen** → **Add**.
4. Open Lift & Lap from the new icon and do the setup there. Always log from the icon: the installed app keeps its own storage, separate from Safari tabs.

## Your data

GitHub holds the app, not your workouts. Your workouts, weights and body measurements are personal, and a public repository would show them to everyone, so they are stored privately on your phone (`localStorage`, one small document per area plus one per month of workouts).

- **Settings (gear on Today) → Backup & data → Export backup** creates a backup file. On iPhone choose **Save to Files → iCloud Drive** so it survives losing or replacing your phone. **Restore backup** loads one back.
- The app reminds you on the Today screen when your last backup is more than three weeks old.
- If the app is opened as a Claude artifact instead, the same documents are mirrored to that artifact's private per-user store (`data/users/<you>/…`). That copy is separate from the GitHub Pages one; move data between them with export and restore.

## Development

No dependencies to install.

```bash
npm start      # serves the folder at http://localhost:8080 (or: python3 -m http.server 8080)
npm test       # unit tests for progression, plans, stats and plate math (node --test)
npm run test:e2e   # end-to-end flows in a real browser (needs Playwright; see tests/e2e/README.md)
```

Layout:

```
index.html            entry page (PWA meta, manifest, fonts)
sw.js                 offline cache; bump VERSION when shipping changes
css/app.css           all styles; colour tokens for light and dark at the top
js/app.js             state access, tab bar and rendering
js/router.js          page stacks per tab, history (swipe-back) and view transitions
js/motion.js          reduce-motion/transparency preferences and spring easings
js/store.js           storage (localStorage + optional Claude cloud mirror), backup
js/program.js         phases, schedule, next workout, weight suggestions
js/stats.js           1RM, PRs, weekly summaries, nutrition, plates
js/data/*.js          exercises, gym plans, swim workouts & drills, guides
js/views/*.js         screens
tests/                node:test unit tests; tests/e2e/ has the browser flows
```

When you add a file under `js/`, also list it in `SHELL` in `sw.js` (a test checks this) and bump `VERSION`.

---

General fitness guidance, not medical advice. Check with a doctor before starting if you have health concerns.

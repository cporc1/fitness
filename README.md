# Lift & Lap

A phone-first training app for a beginner with a full gym and a lap pool: a 12-week plan, a live workout logger, swim sets with a lap counter, progress charts, body tracking, habits and beginner guides. It is a static web app (plain HTML, CSS and JavaScript, no build step) that installs on an iPhone Home Screen and works offline at the pool.

## What's inside

| Area | What you get |
| --- | --- |
| **Today** | What to do today, a week strip, a one-tap start, weekly stats, streak, and a daily check-in (water, sleep, protein, body weight) |
| **Plan** | The 12-week program in three phases (Foundation → Build → Progress), your editable weekly schedule (gym / swim / rest per day), every workout in the current phase, and a builder for your own gym or swim workouts |
| **Gym logger** | Sets × weight × reps with last session's numbers alongside, automatic weight suggestions (double progression), a rest timer drawn as a pool pace clock, exercise swaps (today only or permanently), how-to for every exercise, warm-up checklist, PR detection |
| **Swim logger** | Warm-up / drills / main set / cool-down with a big "Rep done" button, automatic rest countdown, drill instructions, distance tracking in your pool's units (25 yd, 25 m or 50 m), and a free-swim lap counter |
| **Log** | Calendar and list of every session, details, edit and delete, plus "log another activity" for walks, classes and sports |
| **Progress** | Workouts per week, estimated 1-rep max per lift, weekly volume, swim distance and pace, body weight and waist trends, milestones |
| **More** | 12 beginner guides, a library of 50 gym exercises and 15 swim drills with step-by-step instructions and demo-video links, tools (plate calculator, 1RM, swim pace, calories & protein), habits history, settings, backup/restore |

### The program

- **Gym:** two alternating full-body days (A and B). Weeks 1–4 use machines and dumbbells; weeks 5–8 introduce the squat and trap-bar deadlift with light weights; weeks 9–12 go heavier. Every exercise has a rep range; when you hit the top of the range on every set, the app tells you to add weight next time.
- **Pool:** alternating technique and endurance swims, matched to your level: *learning to swim* (shallow-end water confidence), *beginner* (1–2 lengths then rest) or *comfortable* (200+ continuous). Distances adapt to your pool length.
- **Week:** you choose the days; program days pick the next session automatically, so a missed day never breaks the plan.

## Using it on your iPhone

The app has to be served from a web address. Two options:

### Option A: GitHub Pages (recommended: installs as an app, works offline)

GitHub Pages is free for **public** repositories (private repositories need a paid GitHub plan). The code holds no personal data; your workouts stay on your phone.

1. Merge this branch into `main`.
2. On GitHub: **Settings → General → Danger Zone → Change visibility → Public** (skip if you have GitHub Pro).
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
4. After a minute the site is live at `https://<your-username>.github.io/fitness/`.
5. Open that address in **Safari** on your iPhone → **Share** → **Add to Home Screen** → **Add**.
6. Open Lift & Lap from the new icon and do the setup there. The installed app keeps its own storage, separate from Safari tabs, so log from the icon.

### Option B: inside Claude

The same app can be published as a Claude artifact. Opened in the Claude app or claude.ai, your data syncs privately to your Claude account, so it is on every device you sign in on. It needs a connection to load and doesn't install to the Home Screen.

## Your data

- Everything is stored on the device (`localStorage`), as one small document per area plus one per month of workouts.
- **More → Backup & data → Export backup** saves a JSON file (on iPhone it opens the share sheet: save to Files or AirDrop it). **Restore backup** loads one back. Export every few weeks, and before switching phones.
- Inside Claude, the same documents are mirrored to the artifact's private per-user store (`data/users/<you>/…`); the newest copy of each document wins.

## Development

No dependencies to install.

```bash
npm start      # serves the folder at http://localhost:8080 (or: python3 -m http.server 8080)
npm test       # unit tests for progression, plans, stats and plate math (node --test)
```

Layout:

```
index.html            entry page (PWA meta, manifest, fonts)
sw.js                 offline cache; bump VERSION when shipping changes
css/app.css           all styles; colour tokens for light and dark at the top
js/app.js             navigation and rendering
js/store.js           storage (localStorage + optional Claude cloud mirror), backup
js/program.js         phases, schedule, next workout, weight suggestions
js/stats.js           1RM, PRs, weekly summaries, nutrition, plates
js/data/*.js          exercises, gym plans, swim workouts & drills, guides
js/views/*.js         screens
tests/                node:test unit tests
```

When you add a file under `js/`, also list it in `SHELL` in `sw.js` (a test checks this) and bump `VERSION`.

---

General fitness guidance, not medical advice. Check with a doctor before starting if you have health concerns.

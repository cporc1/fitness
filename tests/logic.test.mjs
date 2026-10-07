// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  e1rm, platesPerSide, weekStreak, nutritionTargets, detectPRs, weekSummary, convertDistance,
  buckets, progressSummary, setsByMuscleGroup, swimDistanceByStroke, weekRecords,
} from '../js/stats.js';
import {
  programWeek, currentPhase, defaultSchedule, nextGymTemplate, nextSwimWorkout, suggest,
  buildGymSession, buildSwimSession, computeSwimDistance, planForDay, stepWeight,
  routineKind, routineTarget, routineMinutes,
} from '../js/program.js';
import { expandForPool, workoutDistance, SWIM_WORKOUTS, getDrill } from '../js/data/swim.js';
import { GYM_TEMPLATES, WARMUPS, COOLDOWNS, getGymTemplate } from '../js/data/plans.js';
import { EXERCISES, getExercise } from '../js/data/exercises.js';
import { addDays, weekStart, parseClock, fmtClock } from '../js/util.js';

const gymSession = (id, date, exId, sets, extra = {}) => ({
  id, kind: 'gym', date, unit: 'lb', templateId: extra.templateId || 'p1-a',
  exercises: [{ ex: exId, type: getExercise(exId)?.type || 'weight', sets: sets.map(([w, r]) => ({ w, r, done: true })) }],
});

test('every program exercise and drill exists in the library', () => {
  for (const t of GYM_TEMPLATES) for (const item of t.exercises) assert.ok(getExercise(item.ex), `${t.id}: ${item.ex}`);
  for (const ex of EXERCISES) for (const alt of ex.alts || []) assert.ok(getExercise(alt), `${ex.id} alt ${alt}`);
  for (const [key, w] of Object.entries(SWIM_WORKOUTS)) {
    for (const b of w.blocks) for (const it of b.items) if (it.drill) assert.ok(getDrill(it.drill), `${key}: ${it.drill}`);
  }
  for (const level of ['learner', 'novice', 'comfortable']) {
    for (const p of [1, 2, 3]) for (const k of ['tech', 'endure']) assert.ok(SWIM_WORKOUTS[`${level}-p${p}-${k}`], `${level} p${p} ${k}`);
  }
});

test('e1rm uses Epley and passes singles through', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(Math.round(e1rm(100, 10)), 133);
  assert.equal(e1rm(0, 5), 0);
});

test('plate math loads the bar per side', () => {
  const r = platesPerSide(225, 45, [45, 35, 25, 10, 5, 2.5]);
  assert.deepEqual(r.perSide, [45, 45]);
  assert.equal(r.remainder, 0);
  const k = platesPerSide(62.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(k.perSide, [20, 1.25]);
  assert.equal(platesPerSide(30, 45, [45]).perSide.length, 0);
});

test('program week and phase follow the start date', () => {
  const profile = { startDate: '2026-01-05' };
  assert.equal(programWeek(profile, '2026-01-05'), 1);
  assert.equal(programWeek(profile, '2026-01-11'), 1);
  assert.equal(programWeek(profile, '2026-01-12'), 2);
  assert.equal(currentPhase(profile, '2026-02-02').id, 2); // week 5
  assert.equal(currentPhase(profile, '2026-03-02').id, 3); // week 9
  assert.equal(currentPhase(profile, '2026-12-01').id, 3); // past week 12 stays in phase 3
  assert.equal(currentPhase({ ...profile, phaseOverride: 1 }, '2026-03-02').id, 1);
});

test('gym days alternate A and B; swim days alternate technique and endurance', () => {
  assert.equal(nextGymTemplate([], 1).id, 'p1-a');
  assert.equal(nextGymTemplate([{ kind: 'gym', templateId: 'p1-a' }], 1).id, 'p1-b');
  assert.equal(nextGymTemplate([{ kind: 'gym', templateId: 'p1-b' }], 2).id, 'p2-a');
  assert.equal(nextSwimWorkout([], 'novice', 1).key, 'novice-p1-tech');
  assert.equal(nextSwimWorkout([{ kind: 'swim', templateId: 'swim:novice-p1-tech' }], 'novice', 1).key, 'novice-p1-endure');
});

test('gym + swim days and the upper/lower split', () => {
  const schedule = { days: ['both', 'rest', 'gym', 'rest', 'swim', 'rest', 'rest'] };
  const state = { profile: { startDate: '2026-10-05', swimLevel: 'novice' }, schedule, sessions: [], custom: { templates: [] } };
  const mon = planForDay(state, '2026-10-05');
  assert.equal(mon.slot, 'both');
  assert.deepEqual(mon.parts.map((p) => p.kind), ['gym', 'swim']);
  assert.equal(defaultSchedule(2).days.filter((d) => d === 'both').length, 2);
  const ul = { kind: 'gym', templateId: 'p1-u' };
  assert.equal(nextGymTemplate([], 1, 'upper-lower').id, 'p1-u');
  assert.equal(nextGymTemplate([ul], 1, 'upper-lower').id, 'p1-l');
  // a full-body history doesn't confuse the upper/lower rotation, and vice versa
  assert.equal(nextGymTemplate([{ kind: 'gym', templateId: 'p1-a' }], 1, 'upper-lower').id, 'p1-u');
  assert.equal(nextGymTemplate([ul], 1, 'full').id, 'p1-a');
});

test('learners never get full lengths; 50 m pools scale rest', async () => {
  const { SWIM_WORKOUTS, expandForPool } = await import('../js/data/swim.js');
  for (const [key, w] of Object.entries(SWIM_WORKOUTS)) {
    if (!key.startsWith('learner')) continue;
    for (const b of w.blocks) for (const it of b.items) assert.ok(!it.dist, `${key} has a distance item`);
  }
  const out = expandForPool([{ name: 'Main', items: [{ reps: 8, dist: 25, stroke: 'Free', rest: 40 }] }], 50, 'novice');
  assert.deepEqual([out[0].items[0].reps, out[0].items[0].dist, out[0].items[0].rest], [4, 50, 80]);
  assert.match(out[0].items[0].note, /lane rope/);
});

test('calorie target never drops below a safe floor', () => {
  const t = nutritionTargets({ weightKg: 50, heightCm: 155, age: 55, sex: 'female', activity: 'light', goal: 'lose' });
  assert.ok(t.target >= 1200);
  assert.ok(t.target >= t.bmr);
  const big = nutritionTargets({ weightKg: 136, heightCm: 178, age: 35, sex: 'male', activity: 'light', goal: 'lose' });
  assert.ok(big.proteinHigh < 200, `protein ${big.proteinHigh}`);
});

test('schedule and day plan', () => {
  const schedule = defaultSchedule(4);
  assert.equal(schedule.days.filter((d) => d !== 'rest').length, 4);
  const state = { profile: { startDate: '2026-10-05', swimLevel: 'novice' }, schedule, sessions: [], custom: { templates: [] } };
  const mon = planForDay(state, '2026-10-05');
  assert.equal(mon.slot, 'gym');
  assert.equal(mon.template.id, 'p1-a');
  const tue = planForDay(state, '2026-10-06');
  assert.equal(tue.slot, 'swim');
  assert.equal(planForDay(state, '2026-10-07').slot, 'rest');
});

test('double progression: add weight only after every set hits the top', () => {
  const target = { sets: 3, reps: [10, 12] };
  assert.equal(suggest('leg-press', target, [], 'lb').kind, 'new');

  const hit = [gymSession('a', '2026-10-01', 'leg-press', [[100, 12], [100, 12], [100, 12]])];
  const up = suggest('leg-press', target, hit, 'lb');
  assert.equal(up.kind, 'up');
  assert.equal(up.weight, 110);

  const partial = [gymSession('a', '2026-10-01', 'leg-press', [[100, 12], [100, 11], [100, 10]])];
  const same = suggest('leg-press', target, partial, 'lb');
  assert.equal(same.kind, 'same');
  assert.equal(same.weight, 100);
  assert.equal(same.reps, 12);

  const struggling = [
    gymSession('b', '2026-10-03', 'leg-press', [[100, 8], [100, 7], [100, 7]]),
    gymSession('a', '2026-10-01', 'leg-press', [[100, 9], [100, 8], [100, 8]]),
  ];
  const down = suggest('leg-press', target, struggling, 'lb');
  assert.equal(down.kind, 'down');
  assert.ok(down.weight < 100);

  // Below the range but improving: keep going, no back-off.
  const improving = [
    gymSession('b', '2026-10-03', 'lat-pulldown', [[60, 11], [60, 10], [60, 9]]),
    gymSession('a', '2026-10-01', 'lat-pulldown', [[60, 9], [60, 9], [60, 8]]),
  ];
  assert.equal(suggest('lat-pulldown', target, improving, 'lb').kind, 'same');
});

test('dumbbells move to the next real size; machines one pin', () => {
  const target = { sets: 3, reps: [10, 12] };
  const db = [gymSession('a', '2026-10-01', 'lateral-raise', [[10, 12], [10, 12], [10, 12]])];
  assert.equal(suggest('lateral-raise', target, db, 'lb').weight, 12);
  const dbKg = [gymSession('a', '2026-10-01', 'db-bench', [[12.5, 12], [12.5, 12], [12.5, 12]])];
  dbKg[0].unit = 'kg';
  assert.equal(suggest('db-bench', target, dbKg, 'kg').weight, 15);
  const assisted0 = [gymSession('a', '2026-10-01', 'assisted-pullup', [[0, 8], [0, 7], [0, 7]])];
  assert.match(suggest('assisted-pullup', { sets: 3, reps: [6, 10] }, assisted0, 'lb').text, /Full bodyweight/);
});

test('assisted exercises progress by reducing assistance', () => {
  const s = [gymSession('a', '2026-10-01', 'assisted-pullup', [[60, 10], [60, 10], [60, 10]])];
  const r = suggest('assisted-pullup', { sets: 3, reps: [6, 10] }, s, 'lb');
  assert.equal(r.kind, 'up');
  assert.equal(r.weight, 50);
});

test('suggestions convert units when the user switches lb/kg', () => {
  const s = [gymSession('a', '2026-10-01', 'leg-press', [[100, 12], [100, 12], [100, 12]])];
  const r = suggest('leg-press', { sets: 3, reps: [10, 12] }, s, 'kg');
  assert.equal(r.kind, 'up');
  assert.ok(Math.abs(r.weight - (45.36 + 5)) <= 0.5);
});

test('building a gym session pre-fills suggested weights and applies swaps', () => {
  const sessions = [gymSession('a', '2026-10-01', 'machine-chest-press', [[80, 15], [80, 15], [80, 15]])];
  const state = { profile: { units: 'lb', startDate: '2026-10-01' }, sessions, swaps: { 'leg-press': 'goblet-squat' } };
  const s = buildGymSession(GYM_TEMPLATES[0], state);
  assert.equal(s.exercises[0].ex, 'goblet-squat');
  const chest = s.exercises.find((e) => e.ex === 'machine-chest-press');
  assert.equal(chest.sets[0].w, 85);
  assert.equal(chest.sets.length, 3);
});

test('swim plans adapt to a 50 m pool and count distance', () => {
  const blocks = [{ name: 'Main', items: [{ reps: 6, dist: 25, stroke: 'Free', rest: 30 }, { reps: 4, dist: 75, stroke: 'Free', rest: 30 }] }];
  assert.equal(workoutDistance(blocks), 450);
  const fifty = expandForPool(blocks, 50);
  assert.deepEqual(fifty[0].items.map((i) => [i.reps, i.dist]), [[3, 50], [3, 100]]);
  const same = expandForPool(blocks, 25);
  assert.deepEqual(same[0].items.map((i) => [i.reps, i.dist]), [[6, 25], [4, 75]]);

  const w = { id: 'swim:novice-p1-tech', ...SWIM_WORKOUTS['novice-p1-tech'] };
  const session = buildSwimSession(w, { profile: { pool: { len: 25, unit: 'yd' } } });
  assert.equal(computeSwimDistance(session), 0);
  session.blocks[0].items[0].done = [true, true, false, false];
  session.freeLengths = 2;
  assert.equal(computeSwimDistance(session), 100);
});

test('weekly streak counts consecutive qualifying weeks', () => {
  const today = '2026-10-07';
  const thisWeek = weekStart(today);
  const mk = (d) => ({ id: d, kind: 'gym', date: d });
  const sessions = [
    mk(addDays(thisWeek, -7)), mk(addDays(thisWeek, -5)),
    mk(addDays(thisWeek, -14)), mk(addDays(thisWeek, -12)),
    mk(addDays(thisWeek, -28)),
  ];
  assert.equal(weekStreak(sessions, today), 2);
  assert.equal(weekStreak([...sessions, mk(thisWeek), mk(addDays(thisWeek, 1))], today), 3);
});

test('PR detection ignores first-time baselines', () => {
  const prior = [gymSession('a', '2026-10-01', 'leg-press', [[100, 10]])];
  const now = gymSession('b', '2026-10-03', 'leg-press', [[110, 8]]);
  assert.equal(detectPRs(now, prior, 'lb').length, 1);
  assert.equal(detectPRs(now, [], 'lb').length, 0);
});

test('nutrition targets are sensible', () => {
  const t = nutritionTargets({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate', goal: 'lose' });
  assert.equal(t.proteinLow, 128);
  assert.ok(t.maintenance > 2500 && t.maintenance < 3000);
  assert.ok(t.target < t.maintenance);
});

test('week summary converts swim distance units', () => {
  const sessions = [{ id: 'x', kind: 'swim', date: '2026-10-06', distance: 1000, pool: { len: 25, unit: 'm' } }];
  const sum = weekSummary(sessions, '2026-10-07', 'yd', 'lb');
  assert.equal(Math.round(sum.swimDistance), Math.round(convertDistance(1000, 'm', 'yd')));
  assert.equal(sum.swim, 1);
});

test('clock helpers', () => {
  assert.equal(parseClock('1:45'), 105);
  assert.equal(parseClock('90'), 90);
  assert.equal(parseClock(''), null);
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtClock(65), '1:05');
});

test('service worker precaches every app file', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  for (const file of [...walk('js'), 'css/app.css', 'index.html', 'manifest.webmanifest']) {
    assert.ok(sw.includes(`'${file}'`), `sw.js is missing ${file}`);
  }
});

test('simple swim mode keeps distance but removes drills', async () => {
  const { getSwimWorkout, workoutDistance, guideForItem, getDrill } = await import('../js/data/swim.js');
  for (const level of ['novice', 'comfortable']) {
    for (const p of [1, 2, 3]) {
      for (const k of ['tech', 'endure']) {
        const key = `${level}-p${p}-${k}`;
        const full = getSwimWorkout(key);
        const simple = getSwimWorkout(key, 'simple');
        assert.equal(workoutDistance(simple.blocks), workoutDistance(full.blocks), key);
        for (const b of simple.blocks) {
          for (const it of b.items) {
            assert.ok(['Free', 'Breast', 'Kick'].includes(it.stroke), `${key}: ${it.stroke}`);
            assert.ok(!it.drill || it.drill === 'kickboard', `${key}: drill ${it.drill}`);
          }
        }
      }
    }
  }
  // learner skills stay intact
  assert.ok(getSwimWorkout('learner-p1-tech', 'simple').blocks.some((b) => b.items.some((it) => it.stroke === 'Skill')));
  assert.equal(guideForItem({ stroke: 'Breast' }), 'stroke-breast');
  assert.equal(guideForItem({ stroke: 'Drill', drill: 'catch-up' }), 'catch-up');
  assert.ok(getDrill('stroke-free'));
});

test('demo media points at real exercises and files', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const { FRAMES, VIDEOS } = await import('../js/data/media.js');
  const { getDrill } = await import('../js/data/swim.js');
  for (const id of Object.keys(FRAMES)) {
    assert.ok(getExercise(id), `frames for unknown exercise ${id}`);
    for (const i of [0, 1]) assert.ok(fs.existsSync(path.join(root, `media/ex/${id}-${i}.jpg`)), `missing photo ${id}-${i}`);
  }
  for (const [id, v] of Object.entries(VIDEOS)) {
    assert.ok(getExercise(id) || getDrill(id), `video for unknown id ${id}`);
    assert.match(v.id, /^[A-Za-z0-9_-]{11}$/, `bad video id for ${id}`);
  }
});

test('progress ranges: 7 daily bars or calendar weeks ending this week', () => {
  const day = buckets('1w', '2026-10-07');
  assert.equal(day.length, 7);
  assert.equal(day[0].start, '2026-10-01');
  assert.equal(day[6].start, '2026-10-07');
  assert.equal(day[6].label, 'W');
  const wk = buckets('8w', '2026-10-07');
  assert.equal(wk.length, 8);
  assert.equal(wk[7].start, '2026-10-05');
  assert.equal(wk[0].start, '2026-08-17');
  assert.equal(wk[7].label, '10/5');
  assert.equal(buckets('6m', '2026-10-07').length, 26);
  assert.equal(buckets('12w', '2026-10-07', 1)[11].end, buckets('12w', '2026-10-07')[0].start);
});

test('progress totals match the chart buckets', () => {
  const swim = (id, date, distance) => ({ id, kind: 'swim', date, distance, durationSec: 1200, pool: { len: 25, unit: 'yd' } });
  const sessions = [
    gymSession('g1', '2026-10-05', 'leg-press', [[100, 10], [100, 10]]),
    gymSession('g2', '2026-09-29', 'leg-press', [[90, 12]]),
    swim('s1', '2026-10-06', 500), swim('s2', '2026-06-01', 400),
    { id: 'o1', kind: 'other', date: '2026-10-02', durationSec: 1800 },
  ];
  const total = progressSummary(sessions, { mode: 'total', range: '12w', today: '2026-10-07' });
  assert.equal(total.now.count, total.series.reduce((a, b) => a + b.value, 0));
  assert.equal(total.now.count, 4); // the June swim is outside 12 weeks
  assert.equal(total.series.reduce((a, b) => a + b.gym + b.swim + b.other, 0), 4);
  const lift = progressSummary(sessions, { mode: 'workout', range: '8w', today: '2026-10-07' });
  assert.equal(lift.now.volume, lift.series.reduce((a, b) => a + b.value, 0));
  assert.equal(lift.now.volume, 2000 + 1080);
  assert.equal(lift.now.sets, 3);
  const pool = progressSummary(sessions, { mode: 'swim', range: '1w', today: '2026-10-07' });
  assert.equal(pool.now.distance, 500);
  assert.equal(pool.series[5].value, 500); // Tuesday Oct 6
  assert.equal(pool.now.pace, 240);
});

test('progress compares with the previous period across a month boundary', () => {
  const sessions = [
    gymSession('a', '2026-09-25', 'leg-press', [[100, 10]]),
    gymSession('b', '2026-09-30', 'leg-press', [[100, 10]]),
    gymSession('c', '2026-10-02', 'leg-press', [[100, 10]]),
  ];
  const r = progressSummary(sessions, { mode: 'workout', range: '1w', today: '2026-10-03' });
  assert.equal(r.buckets[0].start, '2026-09-27');
  assert.equal(r.now.count, 2);
  assert.equal(r.prev.count, 1);
});

test('sets per muscle group, distance per stroke, week records', () => {
  const s1 = gymSession('a', '2026-10-05', 'leg-press', [[100, 10], [100, 10]]);
  s1.exercises.push({ ex: 'lat-pulldown', type: 'weight', sets: [{ w: 50, r: 10, done: true }, { w: 50, r: 10, done: false }] });
  const groups = setsByMuscleGroup([s1]);
  assert.deepEqual(groups.map((g) => [g.group, g.sets]), [['Legs', 2], ['Back', 1]]);
  const swim = {
    id: 's', kind: 'swim', date: '2026-10-06', pool: { len: 25, unit: 'm' }, freeLengths: 2,
    blocks: [{ name: 'Main set', items: [{ reps: 4, dist: 50, stroke: 'Free', done: [true, true, true, false] }, { reps: 2, dist: 25, stroke: 'Breast', done: [true, true] }] }],
  };
  const strokes = swimDistanceByStroke([swim], 'm');
  assert.deepEqual(strokes.map((x) => [x.stroke, x.distance]), [['Freestyle', 150], ['Breaststroke', 50], ['Lap counter', 50]]);
  const weeks = ['2026-09-07', '2026-09-08', '2026-09-14', '2026-09-15', '2026-09-28', '2026-09-29', '2026-09-30'];
  const rec = weekRecords(weeks.map((date, i) => ({ id: String(i), kind: 'gym', date })));
  assert.equal(rec.longestStreak, 2);
  assert.equal(rec.busiest.count, 3);
});

test('stepper steps: real dumbbell sizes, one pin on machines, never below zero', () => {
  assert.equal(stepWeight('lateral-raise', 10, 'lb', 1), 12);
  assert.equal(stepWeight('lateral-raise', 12, 'lb', -1), 10);
  assert.equal(stepWeight('lateral-raise', null, 'lb', 1), 3);
  assert.equal(stepWeight('db-bench', 12.5, 'kg', 1), 15);
  assert.equal(stepWeight('leg-press', 100, 'lb', 1), 110);
  assert.equal(stepWeight('leg-press', 100, 'lb', -1), 90);
  assert.equal(stepWeight('leg-press', 5, 'lb', -1), 0);
});

test('warm-up: stretches first, then moves; cool-down: longer holds; every item has photos', async () => {
  const { FRAMES } = await import('../js/data/media.js');
  for (const [kind, items] of Object.entries(WARMUPS)) {
    const parts = items.map((it) => it.part);
    assert.equal(parts[0], 'stretch', `${kind} starts with a stretch`);
    assert.ok(parts.lastIndexOf('stretch') < parts.indexOf('move'), `${kind}: all stretches before the moves`);
    for (const it of items) if (it.sec) assert.ok(it.sec <= 30, `${kind}: warm-up holds stay short (${it.ex})`);
  }
  for (const items of Object.values(COOLDOWNS)) for (const it of items) assert.ok(it.sec >= 30, `cool-down holds are 30 s or more (${it.ex})`);
  for (const items of [...Object.values(WARMUPS), ...Object.values(COOLDOWNS)]) {
    for (const it of items) {
      assert.ok(getExercise(it.ex), `unknown exercise ${it.ex}`);
      assert.ok(FRAMES[it.ex], `${it.ex} has demo photos`);
      assert.equal([it.reps, it.sec, it.min].filter(Boolean).length, 1, `${it.ex}: one target`);
    }
    const mins = routineMinutes(items);
    assert.ok(mins >= 5 && mins <= 12, `routine takes ${mins} min`);
  }
});

test('each workout gets the warm-up for its day', () => {
  assert.equal(routineKind(getGymTemplate('p1-a')), 'full');
  assert.equal(routineKind(getGymTemplate('p2-u')), 'upper');
  assert.equal(routineKind(getGymTemplate('p3-l')), 'lower');
  assert.equal(routineKind({ exercises: [{ ex: 'leg-press' }, { ex: 'plank' }] }), 'lower');
  assert.equal(routineKind({ exercises: [{ ex: 'db-curl' }, { ex: 'lat-pulldown' }] }), 'upper');
  assert.equal(routineKind({ exercises: [] }), 'full');
  const s = buildGymSession(getGymTemplate('p1-l'), { profile: { units: 'lb', startDate: '2026-10-01' }, sessions: [], swaps: {} });
  assert.deepEqual(s.warmup.map((it) => it.ex), WARMUPS.lower.map((it) => it.ex));
  assert.deepEqual(s.cooldown.map((it) => it.ex), COOLDOWNS.lower.map((it) => it.ex));
  assert.ok([...s.warmup, ...s.cooldown].every((it) => it.done === false));
  s.warmup[0].done = true;
  assert.equal(WARMUPS.lower[0].done, undefined, 'sessions get their own copy');
  assert.equal(routineTarget({ ex: 'hamstring-stretch', sec: 45 }), 'Hold 45 s per side');
  assert.equal(routineTarget({ ex: 'childs-pose', sec: 45 }), 'Hold 45 s');
  assert.equal(routineTarget({ ex: 'leg-swing', reps: 10 }), '10 per side');
  assert.equal(routineTarget({ ex: 'bike', min: 4 }), '4 min');
});

test('every swim stroke and drill has an animated demo with sane poses', async () => {
  const { SWIM_DEMO_IDS, swimPose, track } = await import('../js/swim-anim.js');
  const { DRILLS, STROKE_GUIDES } = await import('../js/data/swim.js');
  for (const d of [...DRILLS, ...STROKE_GUIDES]) assert.ok(SWIM_DEMO_IDS.includes(d.id), `${d.id} has a demo`);
  const finite = (v) => Number.isFinite(v);
  for (const id of SWIM_DEMO_IDS) {
    for (let t = 0; t < 1; t += 0.05) {
      const p = swimPose(id, t);
      const nums = [...p.hip, p.torso, ...p.arms.flatMap((a) => [a.a, a.f]), ...p.legs.flatMap((l) => [l.t, l.s])];
      assert.ok(nums.every(finite), `${id} at ${t.toFixed(2)}`);
      assert.ok(p.hip[0] > 0 && p.hip[0] < 300 && p.hip[1] > 0 && p.hip[1] < 150, `${id}: swimmer in the picture at ${t.toFixed(2)}`);
    }
  }
  // Tracks loop without a jump: one cycle later an angle has gained a full turn.
  const a = track([[0, 4], [0.5, 180], [1, 364]]);
  assert.ok(Math.abs(a(1) - a(0) - 360) < 1e-9);
  assert.ok(Math.abs(a(0.999) - a(1)) < 2);
});

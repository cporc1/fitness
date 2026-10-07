// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import { e1rm, platesPerSide, weekStreak, nutritionTargets, detectPRs, weekSummary, convertDistance } from '../js/stats.js';
import {
  programWeek, currentPhase, defaultSchedule, nextGymTemplate, nextSwimWorkout, suggest,
  buildGymSession, buildSwimSession, computeSwimDistance, planForDay,
} from '../js/program.js';
import { expandForPool, workoutDistance, SWIM_WORKOUTS, getDrill } from '../js/data/swim.js';
import { GYM_TEMPLATES } from '../js/data/plans.js';
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
  const sessions = [gymSession('a', '2026-10-01', 'machine-chest-press', [[80, 12], [80, 12], [80, 12]])];
  const state = { profile: { units: 'lb', startDate: '2026-10-01' }, sessions, swaps: { 'leg-press': 'goblet-squat' } };
  const s = buildGymSession(GYM_TEMPLATES[0], state);
  assert.equal(s.exercises[0].ex, 'goblet-squat');
  const chest = s.exercises.find((e) => e.ex === 'machine-chest-press');
  assert.equal(chest.sets[0].w, 90);
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

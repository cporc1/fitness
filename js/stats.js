// Pure calculations over logged sessions. No DOM, no storage: easy to test.

import { weekStart, addDays, weekdayIndex, round, KG_PER_LB } from './util.js';
import { getExercise } from './data/exercises.js';
import { STROKES } from './data/swim.js';

export const YD_PER_M = 1.0936133;

/** Epley estimated one-rep max. */
export function e1rm(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 15) / 30);
}

export function convertWeight(w, from, to) {
  if (w === null || w === undefined || from === to || !from || !to) return w;
  return from === 'lb' ? w * KG_PER_LB : w / KG_PER_LB;
}

export function convertDistance(d, from, to) {
  if (!d || from === to || !from || !to) return d || 0;
  return from === 'm' ? d * YD_PER_M : d / YD_PER_M;
}

export function workingSets(exEntry) {
  return (exEntry.sets || []).filter((st) => st.done && !st.warm);
}

/** Total kilos/pounds moved in a gym session (weight × reps, done sets). */
export function sessionVolume(session, unit) {
  if (session.kind !== 'gym') return 0;
  let total = 0;
  for (const ex of session.exercises || []) {
    for (const st of workingSets(ex)) {
      if (st.w && st.r) total += convertWeight(st.w, session.unit, unit) * st.r;
    }
  }
  return total;
}

export function swimDistance(session, unit) {
  if (session.kind !== 'swim') return 0;
  return convertDistance(session.distance || 0, session.pool?.unit, unit);
}

/** Per-session performance of one exercise, newest first. */
export function exerciseHistory(exId, sessions, unit) {
  const out = [];
  for (const s of sessions) {
    if (s.kind !== 'gym') continue;
    for (const ex of s.exercises || []) {
      if (ex.ex !== exId) continue;
      const sets = workingSets(ex).map((st) => ({ ...st, w: st.w != null ? convertWeight(st.w, s.unit, unit) : st.w }));
      if (!sets.length) continue;
      let best = null;
      for (const st of sets) {
        const score = st.w ? e1rm(st.w, st.r) : (st.r || st.sec || 0);
        if (!best || score > best.score) best = { ...st, score };
      }
      out.push({
        sessionId: s.id, date: s.date, sets, best,
        topWeight: Math.max(0, ...sets.map((st) => st.w || 0)),
        e1rm: Math.max(0, ...sets.map((st) => (st.w ? e1rm(st.w, st.r) : 0))),
        volume: sets.reduce((sum, st) => sum + (st.w || 0) * (st.r || 0), 0),
      });
    }
  }
  return out;
}

/** Personal records for an exercise in the given unit. */
export function exerciseRecords(exId, sessions, unit) {
  const hist = exerciseHistory(exId, sessions, unit);
  const rec = { heaviest: null, bestE1rm: null, mostReps: null, longest: null };
  for (const h of hist) {
    for (const st of h.sets) {
      if (st.w && (!rec.heaviest || st.w > rec.heaviest.w)) rec.heaviest = { ...st, date: h.date };
      if (st.w && st.r) {
        const v = e1rm(st.w, st.r);
        if (!rec.bestE1rm || v > rec.bestE1rm.value) rec.bestE1rm = { value: v, w: st.w, r: st.r, date: h.date };
      }
      if (st.r && (!rec.mostReps || st.r > rec.mostReps.r)) rec.mostReps = { ...st, date: h.date };
      if (st.sec && (!rec.longest || st.sec > rec.longest.sec)) rec.longest = { ...st, date: h.date };
    }
  }
  return rec;
}

/**
 * PRs set in `session` compared with everything before it.
 * Returns [{ exId, kind: 'weight'|'e1rm'|'reps'|'time', value, label }]
 */
export function detectPRs(session, priorSessions, unit) {
  const prs = [];
  if (session.kind !== 'gym') return prs;
  for (const ex of session.exercises || []) {
    const sets = workingSets(ex);
    if (!sets.length) continue;
    const hist = exerciseHistory(ex.ex, priorSessions.filter((s) => s.id !== session.id), unit);
    if (!hist.length) continue; // first time is a baseline, not a PR
    const prior = exerciseRecords(ex.ex, priorSessions.filter((s) => s.id !== session.id), unit);
    const conv = sets.map((st) => ({ ...st, w: st.w != null ? convertWeight(st.w, session.unit, unit) : st.w }));
    const heaviest = Math.max(0, ...conv.map((st) => st.w || 0));
    const bestE = Math.max(0, ...conv.map((st) => (st.w && st.r ? e1rm(st.w, st.r) : 0)));
    const longest = Math.max(0, ...conv.map((st) => st.sec || 0));
    const reps = Math.max(0, ...conv.filter((st) => !st.w).map((st) => st.r || 0));
    if (ex.type === 'assisted') continue; // less assistance is the goal; skip PR noise
    if (heaviest && prior.heaviest && heaviest > prior.heaviest.w + 1e-9) prs.push({ exId: ex.ex, kind: 'weight', value: heaviest });
    else if (bestE && prior.bestE1rm && bestE > prior.bestE1rm.value + 0.5) prs.push({ exId: ex.ex, kind: 'e1rm', value: bestE });
    if (longest && prior.longest && longest > prior.longest.sec) prs.push({ exId: ex.ex, kind: 'time', value: longest });
    if (reps && prior.mostReps && !heaviest && reps > prior.mostReps.r) prs.push({ exId: ex.ex, kind: 'reps', value: reps });
  }
  return prs;
}

export function swimPRs(session, priorSessions, unit) {
  const out = [];
  if (session.kind !== 'swim' || !session.distance) return out;
  const prior = priorSessions.filter((s) => s.kind === 'swim' && s.id !== session.id);
  if (!prior.length) return out;
  const dist = swimDistance(session, unit);
  const best = Math.max(0, ...prior.map((s) => swimDistance(s, unit)));
  if (dist > best) out.push({ kind: 'distance', value: dist });
  return out;
}

// ---------------- weeks & streaks ----------------

export function sessionsInRange(sessions, fromIso, toIsoExclusive) {
  return sessions.filter((s) => s.date >= fromIso && s.date < toIsoExclusive);
}

export function weekSummary(sessions, anyDayIso, poolUnit, weightUnit) {
  const from = weekStart(anyDayIso);
  const to = addDays(from, 7);
  const list = sessionsInRange(sessions, from, to);
  return {
    from, to,
    total: list.length,
    gym: list.filter((s) => s.kind === 'gym').length,
    swim: list.filter((s) => s.kind === 'swim').length,
    other: list.filter((s) => s.kind === 'other').length,
    swimDistance: list.reduce((sum, s) => sum + swimDistance(s, poolUnit), 0),
    volume: list.reduce((sum, s) => sum + sessionVolume(s, weightUnit), 0),
    minutes: list.reduce((sum, s) => sum + (s.durationSec || 0) / 60, 0),
    dates: new Set(list.map((s) => s.date)),
  };
}

/** Consecutive weeks (ending this week or last) with at least `min` sessions. */
export function weekStreak(sessions, todayIso, min = 2) {
  const counts = new Map();
  for (const s of sessions) {
    const w = weekStart(s.date);
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  let week = weekStart(todayIso);
  let streak = 0;
  // The current week counts only once it qualifies; it never breaks a streak.
  if ((counts.get(week) || 0) >= min) streak += 1;
  week = addDays(week, -7);
  while ((counts.get(week) || 0) >= min) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

/** Series of the last `n` weeks: [{ week, value }] oldest first. */
export function weeklySeries(sessions, todayIso, n, valueFn) {
  const out = [];
  let w = weekStart(todayIso);
  for (let i = 0; i < n; i++) {
    const to = addDays(w, 7);
    out.unshift({ week: w, value: valueFn(sessionsInRange(sessions, w, to)) });
    w = addDays(w, -7);
  }
  return out;
}

// ---------------- progress: ranges, buckets, summaries ----------------

export const RANGES = [
  { id: '1w', label: '1 week', bucket: 'day', count: 7 },
  { id: '8w', label: '8 weeks', bucket: 'week', count: 8 },
  { id: '12w', label: '12 weeks', bucket: 'week', count: 12 },
  { id: '6m', label: '6 months', bucket: 'week', count: 26 },
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const shortDate = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/**
 * Chart buckets for a range, oldest first: [{ start, end (exclusive), label }].
 * 1 week is the last 7 days, one bar per day; the others are calendar weeks
 * (Monday first) ending with this week. offset 1 = the period before.
 */
export function buckets(rangeId, todayIso, offset = 0) {
  const r = RANGES.find((x) => x.id === rangeId) || RANGES[2];
  const out = [];
  if (r.bucket === 'day') {
    const last = addDays(todayIso, -offset * r.count);
    for (let i = r.count - 1; i >= 0; i--) {
      const d = addDays(last, -i);
      out.push({ start: d, end: addDays(d, 1), label: DAY_LETTERS[weekdayIndex(d)] });
    }
  } else {
    const lastWeek = addDays(weekStart(todayIso), -7 * offset * r.count);
    for (let i = r.count - 1; i >= 0; i--) {
      const w = addDays(lastWeek, -7 * i);
      out.push({ start: w, end: addDays(w, 7), label: shortDate(w) });
    }
  }
  return out;
}

export const MODES = ['total', 'workout', 'swim'];
const inMode = (mode) => (x) => mode === 'total' || (mode === 'workout' ? x.kind === 'gym' : x.kind === 'swim');
const sumOf = (list, fn) => list.reduce((acc, x) => acc + (fn(x) || 0), 0);
const setCount = (x) => (x.exercises || []).reduce((n, ex) => n + workingSets(ex).length, 0);

/** Headline numbers for a list of sessions in one mode. */
export function periodKpis(list, mode, { weightUnit = 'lb', poolUnit = 'yd' } = {}) {
  const minutes = sumOf(list, (x) => (x.durationSec || 0) / 60);
  if (mode === 'workout') {
    return { count: list.length, volume: sumOf(list, (x) => sessionVolume(x, weightUnit)), sets: sumOf(list, setCount), prs: sumOf(list, (x) => x.prs?.length), minutes };
  }
  if (mode === 'swim') {
    const timed = list.filter((x) => x.durationSec && swimDistance(x, poolUnit));
    return {
      count: list.length, distance: sumOf(list, (x) => swimDistance(x, poolUnit)), minutes,
      pace: pacePer100(sumOf(timed, (x) => swimDistance(x, poolUnit)), sumOf(timed, (x) => x.durationSec)),
    };
  }
  return {
    count: list.length, minutes, days: new Set(list.map((x) => x.date)).size,
    gym: list.filter((x) => x.kind === 'gym').length, swim: list.filter((x) => x.kind === 'swim').length, other: list.filter((x) => x.kind === 'other').length,
  };
}

/**
 * Everything the Progress tab shows for one mode and range: the buckets with
 * their chart values, this period's numbers and the previous period's.
 * Total: value = sessions (split gym/swim/other); workout: volume; swim: distance.
 */
export function progressSummary(sessions, { mode = 'total', range = '12w', today, weightUnit = 'lb', poolUnit = 'yd' }) {
  const cur = buckets(range, today);
  const prev = buckets(range, today, 1);
  const pick = inMode(mode);
  const within = (b0, b1) => sessions.filter((x) => pick(x) && x.date >= b0.start && x.date < b1.end);
  const list = within(cur[0], cur[cur.length - 1]);
  const prevList = within(prev[0], prev[prev.length - 1]);
  const units = { weightUnit, poolUnit };
  const series = cur.map((b) => {
    const inB = list.filter((x) => x.date >= b.start && x.date < b.end);
    if (mode === 'workout') return { ...b, value: sumOf(inB, (x) => sessionVolume(x, weightUnit)) };
    if (mode === 'swim') return { ...b, value: sumOf(inB, (x) => swimDistance(x, poolUnit)) };
    return { ...b, value: inB.length, gym: inB.filter((x) => x.kind === 'gym').length, swim: inB.filter((x) => x.kind === 'swim').length, other: inB.filter((x) => x.kind === 'other').length };
  });
  return { mode, range, buckets: cur, series, list, now: periodKpis(list, mode, units), prev: periodKpis(prevList, mode, units) };
}

/** Sets per muscle group (gym sessions), most first. */
export function setsByMuscleGroup(list) {
  const counts = new Map();
  for (const x of list) {
    if (x.kind !== 'gym') continue;
    for (const ex of x.exercises || []) {
      const n = workingSets(ex).length;
      if (!n) continue;
      const group = getExercise(ex.ex)?.group || 'Other';
      counts.set(group, (counts.get(group) || 0) + n);
    }
  }
  return [...counts.entries()].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets);
}

/** Distance swum per stroke from the reps actually done (plus lap-counter lengths), most first. */
export function swimDistanceByStroke(list, poolUnit) {
  const totals = new Map();
  const add = (label, d) => { if (d > 0) totals.set(label, (totals.get(label) || 0) + d); };
  for (const x of list) {
    if (x.kind !== 'swim') continue;
    const from = x.pool?.unit;
    for (const b of x.blocks || []) {
      for (const it of b.items || []) {
        if (!it.dist) continue;
        const done = (it.done || []).filter(Boolean).length;
        add(STROKES[it.stroke] || it.stroke || 'Other', convertDistance(it.dist * done, from, poolUnit));
      }
    }
    if (x.freeLengths) add('Lap counter', convertDistance(x.freeLengths * (x.pool?.len || 25), from, poolUnit));
  }
  return [...totals.entries()].map(([stroke, distance]) => ({ stroke, distance })).sort((a, b) => b.distance - a.distance);
}

/** Longest run of weeks with at least `min` sessions, and the busiest week. */
export function weekRecords(sessions, min = 2) {
  const counts = new Map();
  for (const x of sessions) {
    const w = weekStart(x.date);
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const weeks = [...counts.keys()].sort();
  let longest = 0;
  let run = 0;
  let busiest = null;
  if (weeks.length) {
    for (let w = weeks[0]; w <= weeks[weeks.length - 1]; w = addDays(w, 7)) {
      const n = counts.get(w) || 0;
      run = n >= min ? run + 1 : 0;
      longest = Math.max(longest, run);
      if (n && (!busiest || n > busiest.count)) busiest = { week: w, count: n };
    }
  }
  return { longestStreak: longest, busiest };
}

/** Pace per 100 (yd or m) in seconds, or null. */
export function pacePer100(distance, seconds) {
  if (!distance || !seconds) return null;
  return (seconds / distance) * 100;
}

// ---------------- nutrition ----------------

/** Mifflin-St Jeor. weightKg, heightCm, age years, sex 'male'|'female'|'other' */
export function bmr({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint when not specified
}

export const ACTIVITY = [
  { id: 'light', label: 'Desk job + 2–4 workouts a week (most beginners)', factor: 1.375 },
  { id: 'moderate', label: 'On your feet a lot, or 5–6 workouts a week', factor: 1.55 },
  { id: 'very', label: 'Physical job plus hard training most days', factor: 1.725 },
];

export function nutritionTargets({ weightKg, heightCm, age, sex, activity = 'light', goal = 'health' }) {
  const b = bmr({ weightKg, heightCm, age, sex });
  if (!b) return null;
  const factor = (ACTIVITY.find((a) => a.id === activity) || ACTIVITY[0]).factor;
  const maintenance = b * factor;
  const adjust = goal === 'lose' ? -Math.min(500, maintenance * 0.2) : goal === 'muscle' ? 250 : 0;
  // Never suggest eating below resting needs or common minimums.
  const floor = Math.max(b * 1.1, sex === 'male' ? 1500 : 1200);
  const raw = maintenance + adjust;
  const floored = goal === 'lose' && raw < floor;
  // With a high BMI, base protein on a healthier reference weight (BMI 25).
  const hM = heightCm / 100;
  const refKg = weightKg / (hM * hM) > 30 ? 25 * hM * hM : weightKg;
  return {
    bmr: round(b, 10),
    maintenance: round(maintenance, 10),
    target: round(floored ? Math.min(maintenance, floor) : raw, 10),
    floored,
    proteinLow: Math.round(refKg * 1.6),
    proteinHigh: Math.round(refKg * 2.2),
    waterLiters: Math.min(3.7, round(weightKg * 0.03, 0.1)),
  };
}

// ---------------- plates ----------------

export const DEFAULT_PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
export const DEFAULT_BAR = { lb: 45, kg: 20 };

/** Plates per side to load `target` on a bar. Greedy works for standard sets. */
export function platesPerSide(target, bar, plates) {
  if (!target || target <= bar) return { perSide: [], loaded: bar, remainder: Math.max(0, (target || 0) - bar) };
  let side = (target - bar) / 2;
  const perSide = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side -= p;
    }
  }
  const loaded = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, loaded, remainder: Math.round((target - loaded) * 100) / 100 };
}

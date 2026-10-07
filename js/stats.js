// Pure calculations over logged sessions. No DOM, no storage: easy to test.

import { weekStart, addDays, round, KG_PER_LB } from './util.js';

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
  { id: 'light', label: 'Lightly active: desk job + 3 workouts/week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active: 4–5 workouts/week', factor: 1.55 },
  { id: 'very', label: 'Very active: hard training most days or active job', factor: 1.725 },
];

export function nutritionTargets({ weightKg, heightCm, age, sex, activity = 'moderate', goal = 'health' }) {
  const b = bmr({ weightKg, heightCm, age, sex });
  if (!b) return null;
  const factor = (ACTIVITY.find((a) => a.id === activity) || ACTIVITY[1]).factor;
  const maintenance = b * factor;
  const adjust = goal === 'lose' ? -400 : goal === 'muscle' ? 250 : 0;
  return {
    bmr: round(b, 10),
    maintenance: round(maintenance, 10),
    target: round(maintenance + adjust, 10),
    proteinLow: Math.round(weightKg * 1.6),
    proteinHigh: Math.round(weightKg * 2.2),
    waterLiters: round(weightKg * 0.035, 0.1),
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

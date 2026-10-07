// Program logic: which week/phase you're in, what's scheduled, which workout
// comes next, and the weight to try for each exercise (double progression).

import { daysBetween, weekdayIndex, round, uid, todayISO, addDays } from './util.js';
import { PHASES, phaseForWeek, gymTemplatesForPhase, getGymTemplate } from './data/plans.js';
import { getSwimWorkout, swimTemplateKeys, expandForPool } from './data/swim.js';
import { getExercise } from './data/exercises.js';
import { convertWeight, workingSets } from './stats.js';

export const PROGRAM_WEEKS = 12;

export function programWeek(profile, dateIso = todayISO()) {
  if (!profile?.startDate) return 1;
  const days = daysBetween(profile.startDate, dateIso);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Phase in effect: a manual override wins, else derived from the week. */
export function currentPhase(profile, dateIso = todayISO()) {
  if (profile?.phaseOverride) return PHASES.find((p) => p.id === profile.phaseOverride) || PHASES[0];
  return phaseForWeek(Math.min(programWeek(profile, dateIso), PROGRAM_WEEKS));
}

/** Default weekly layouts by number of training days. Mon..Sun */
export function defaultSchedule(daysPerWeek) {
  const layouts = {
    2: ['gym', 'rest', 'rest', 'swim', 'rest', 'rest', 'rest'],
    3: ['gym', 'rest', 'swim', 'rest', 'gym', 'rest', 'rest'],
    4: ['gym', 'swim', 'rest', 'gym', 'rest', 'swim', 'rest'],
    5: ['gym', 'swim', 'gym', 'rest', 'swim', 'gym', 'rest'],
    6: ['gym', 'swim', 'gym', 'swim', 'gym', 'swim', 'rest'],
  };
  return { days: [...(layouts[daysPerWeek] || layouts[4])] };
}

export function slotForDate(schedule, dateIso) {
  return schedule?.days?.[weekdayIndex(dateIso)] || 'rest';
}

function isProgramGym(s) { return s.kind === 'gym' && typeof s.templateId === 'string' && /^p\d-[ab]$/.test(s.templateId); }
function isProgramSwim(s) { return s.kind === 'swim' && typeof s.templateId === 'string' && s.templateId.startsWith('swim:'); }

/** Next gym template: alternates A/B based on the last program gym session. */
export function nextGymTemplate(sessions, phaseId) {
  const templates = gymTemplatesForPhase(phaseId);
  const last = sessions.find(isProgramGym);
  if (!last) return templates[0];
  const lastSlot = last.templateId.endsWith('-a') ? 'A' : 'B';
  return templates.find((t) => t.slot !== lastSlot) || templates[0];
}

/** Next swim workout: alternates technique / endurance. */
export function nextSwimWorkout(sessions, level, phaseId, mode = 'full') {
  const [tech, endure] = swimTemplateKeys(level || 'novice', phaseId);
  const last = sessions.find(isProgramSwim);
  const lastWasTech = last ? last.templateId.endsWith('-tech') : false;
  return getSwimWorkout(lastWasTech ? endure : tech, mode);
}

/**
 * How many sessions of `slot` sit between today and `dateIso` (exclusive),
 * so future days preview the right A/B or technique/endurance rotation.
 */
function slotsAhead(state, slot, dateIso) {
  const today = todayISO();
  if (dateIso <= today) return 0;
  let n = 0;
  for (let d = today; d < dateIso; d = addDays(d, 1)) {
    if (slotForDate(state.schedule, d) !== slot) continue;
    if (d === today && state.sessions.some((s) => s.date === today && s.kind === slot)) continue;
    n += 1;
  }
  return n;
}

/** What's on for a given day. */
export function planForDay(state, dateIso = todayISO()) {
  const { profile, schedule, sessions, custom } = state;
  const phase = currentPhase(profile, dateIso);
  const slot = slotForDate(schedule, dateIso);
  const doneToday = sessions.filter((s) => s.date === dateIso);
  if (slot === 'gym') {
    let t = nextGymTemplate(sessions, phase.id);
    if (slotsAhead(state, slot, dateIso) % 2 === 1) t = gymTemplatesForPhase(phase.id).find((x) => x.id !== t.id) || t;
    return { slot, phase, template: t, doneToday };
  }
  if (slot === 'swim') {
    const mode = state.settings?.swimMode || 'full';
    let w = nextSwimWorkout(sessions, profile?.swimLevel, phase.id, mode);
    if (slotsAhead(state, slot, dateIso) % 2 === 1) {
      const [tech, endure] = swimTemplateKeys(profile?.swimLevel || 'novice', phase.id);
      w = getSwimWorkout(w.key === tech ? endure : tech, mode);
    }
    return { slot, phase, template: w, doneToday };
  }
  if (slot && slot.startsWith('custom:')) {
    const t = custom?.templates?.find((c) => c.id === slot.slice(7));
    if (t) return { slot: t.kind, phase, template: t, doneToday, custom: true };
  }
  return { slot: 'rest', phase, template: null, doneToday };
}

// ---------------- progression ----------------

/** Most recent logged performance of an exercise. */
export function lastPerformance(exId, sessions, beforeSessionId) {
  for (const s of sessions) {
    if (s.kind !== 'gym' || s.id === beforeSessionId) continue;
    const entry = (s.exercises || []).find((e) => e.ex === exId && workingSets(e).length);
    if (entry) return { session: s, entry, sets: workingSets(entry) };
  }
  return null;
}

function incrementFor(def, unit) {
  const inc = def?.inc?.[unit];
  if (inc) return inc;
  return unit === 'kg' ? 2.5 : 5;
}

/**
 * Suggest today's target for an exercise.
 * Returns { kind: 'new'|'up'|'same'|'down'|'reps', weight, reps, text, last }
 */
export function suggest(exId, target, sessions, unit, beforeSessionId) {
  const def = getExercise(exId);
  const type = def?.type || 'weight';
  const [repMin, repMax] = target?.reps || [8, 12];
  const perf = lastPerformance(exId, sessions, beforeSessionId);
  if (!perf) {
    const text = {
      weight: 'Start light: pick a weight you could lift about 15 times, then do the target reps. Adjust next set if needed.',
      assisted: 'Start with plenty of assistance so every rep is smooth.',
      bodyweight: 'Do what you can with good form. Use an easier version if needed.',
      time: `Hold as long as you can with good form, up to ${repMax} s.`,
      weight_time: 'Pick dumbbells you can carry with tall posture.',
      cardio: 'Easy to moderate pace. You should be able to talk.',
    }[type] || 'Start light.';
    return { kind: 'new', weight: null, reps: repMin, text, last: null };
  }

  const sets = perf.sets.map((st) => ({ ...st, w: st.w != null ? convertWeight(st.w, perf.session.unit, unit) : st.w }));
  const last = { date: perf.session.date, sets };

  if (type === 'cardio') {
    const st = sets[0];
    return { kind: 'same', weight: null, reps: st?.min || repMin, text: 'Same as last time, or a little longer.', last };
  }

  if (type === 'time') {
    const best = Math.max(...sets.map((st) => st.sec || 0));
    if (sets.length >= (target?.sets || 1) && sets.every((st) => (st.sec || 0) >= repMax)) {
      return { kind: 'reps', weight: null, reps: repMax, text: `You held ${repMax} s on every set. Try a harder version, or add 10 s.`, last };
    }
    return { kind: 'same', weight: null, reps: Math.min(repMax, best + 5), text: `Last best ${best} s. Aim for ${Math.min(repMax, best + 5)} s.`, last };
  }

  if (type === 'bodyweight') {
    const allTop = sets.length >= (target?.sets || 1) && sets.every((st) => (st.r || 0) >= repMax);
    if (allTop) return { kind: 'reps', weight: null, reps: repMax, text: 'You owned the top of the range. Slow the lowering to 3 seconds, or use a harder version.', last };
    const best = Math.max(...sets.map((st) => st.r || 0));
    return { kind: 'same', weight: null, reps: Math.min(repMax, best + 1), text: `Beat last time: aim for ${Math.min(repMax, best + 1)} reps.`, last };
  }

  // weight-based (weight, assisted, weight_time)
  const topW = Math.max(...sets.map((st) => st.w || 0));
  const atTop = sets.filter((st) => (st.w || 0) === topW);
  const measure = (st) => (type === 'weight_time' ? (st.sec || 0) : (st.r || 0));
  const inc = incrementFor(def, unit);
  const step = unit === 'kg' ? 1 : 2.5; // rounding for back-off weights
  const hitTop = atTop.length >= (target?.sets || 1) && atTop.every((st) => measure(st) >= repMax);

  if (!topW) {
    return { kind: 'same', weight: null, reps: repMin, text: 'Add a weight this time so the app can track your progress.', last };
  }
  if (hitTop) {
    const next = type === 'assisted' ? Math.max(0, topW - inc) : topW + inc;
    const text = type === 'assisted'
      ? `You hit ${repMax} on every set. Lower the assistance to ${fmtW(next)} ${unit}.`
      : `You hit ${repMax} on every set. Go up to ${fmtW(next)} ${unit} and aim for ${repMin}+ reps.`;
    return { kind: 'up', weight: Math.round(next * 2) / 2, reps: repMin, text, last };
  }

  // Two sessions in a row below the range at the same weight → back off.
  const below = atTop.some((st) => measure(st) < repMin);
  if (below) {
    const prev = lastPerformance(exId, sessions.filter((s) => s.id !== perf.session.id), beforeSessionId);
    if (prev) {
      const prevSets = prev.sets.map((st) => ({ ...st, w: st.w != null ? convertWeight(st.w, prev.session.unit, unit) : st.w }));
      const prevTop = Math.max(...prevSets.map((st) => st.w || 0));
      if (Math.abs(prevTop - topW) < 0.01 && prevSets.some((st) => measure(st) < repMin)) {
        const lighter = type === 'assisted' ? topW + inc : Math.max(step, Math.min(topW - step, round(topW * 0.9, step)));
        return { kind: 'down', weight: lighter, reps: repMin, text: `Two sessions below ${repMin} reps. Drop to ${fmtW(lighter)} ${unit}, rebuild, and beat it.`, last };
      }
    }
  }
  const bestReps = Math.max(...atTop.map(measure));
  const aim = Math.min(repMax, Math.max(repMin, bestReps + 1));
  const unitWord = type === 'weight_time' ? 's' : 'reps';
  return { kind: 'same', weight: topW, reps: aim, text: `Same weight. Beat last time: aim for ${aim} ${unitWord} per set.`, last };
}

function fmtW(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''); }

// ---------------- building sessions ----------------

function blankSet(type, sugg, target) {
  const base = { done: false };
  if (type === 'time') return { ...base, sec: null, target: sugg?.reps ?? target.reps[0] };
  if (type === 'cardio') return { ...base, min: null, dist: null, target: target.reps[0] };
  if (type === 'weight_time') return { ...base, w: sugg?.weight ?? null, sec: null };
  if (type === 'bodyweight') return { ...base, r: null };
  return { ...base, w: sugg?.weight ?? null, r: null };
}

export function exerciseEntry(exId, target, sessions, unit) {
  const def = getExercise(exId);
  const type = def?.type || 'weight';
  const t = { sets: target?.sets || 3, reps: target?.reps || [8, 12], rest: target?.rest || null };
  const sugg = suggest(exId, t, sessions, unit);
  return {
    id: uid('e'), ex: exId, type, target: t, note: target?.note || '',
    suggestion: sugg,
    sets: Array.from({ length: t.sets }, () => blankSet(type, sugg, t)),
  };
}

export function buildGymSession(template, state, opts = {}) {
  const { profile, sessions, swaps } = state;
  const unit = profile?.units || 'lb';
  const exercises = (template.exercises || []).map((item) => {
    const exId = (opts.applySwaps !== false && swaps?.[item.ex]) || item.ex;
    return { ...exerciseEntry(exId, item, sessions, unit), orig: item.ex };
  });
  const date = opts.date || todayISO();
  return {
    id: uid('s'), kind: 'gym', templateId: template.id, name: template.name,
    date, startedAt: new Date().toISOString(), endedAt: null, durationSec: 0,
    unit, week: programWeek(profile, date), phase: template.phase || null,
    exercises, notes: '', rpe: null,
  };
}

export function buildSwimSession(workout, state, opts = {}) {
  const { profile } = state;
  const pool = { len: profile?.pool?.len || 25, unit: profile?.pool?.unit || 'yd' };
  const blocks = expandForPool(workout.blocks || [], pool.len).map((b) => ({
    name: b.name,
    items: b.items.map((it) => ({ ...it, done: Array.from({ length: it.reps }, () => false) })),
  }));
  const date = opts.date || todayISO();
  return {
    id: uid('s'), kind: 'swim', templateId: workout.id, name: workout.name, focus: workout.focus || '',
    date, startedAt: new Date().toISOString(), endedAt: null, durationSec: 0,
    week: programWeek(profile, date), pool, blocks, freeLengths: 0, distance: 0, notes: '', rpe: null,
  };
}

export function buildOtherSession(fields) {
  return {
    id: uid('s'), kind: 'other', name: fields.name || 'Activity', templateId: null,
    date: fields.date || todayISO(), startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
    durationSec: fields.durationSec || 0, notes: fields.notes || '', rpe: fields.rpe || null,
  };
}

/** Distance swum: completed reps with a distance plus free-swim lengths. */
export function computeSwimDistance(session) {
  let total = 0;
  for (const b of session.blocks || []) {
    for (const it of b.items) {
      if (!it.dist) continue;
      total += it.dist * (it.done || []).filter(Boolean).length;
    }
  }
  total += (session.freeLengths || 0) * (session.pool?.len || 25);
  return total;
}

export function plannedSwimDistance(session) {
  let total = 0;
  for (const b of session.blocks || []) for (const it of b.items) total += (it.dist || 0) * (it.reps || 0);
  return total;
}

export function templateById(id, custom, mode = 'full') {
  if (!id) return null;
  if (id.startsWith('swim:')) return getSwimWorkout(id.slice(5), mode);
  return getGymTemplate(id) || custom?.templates?.find((t) => t.id === id) || null;
}

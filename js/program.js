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
    2: ['both', 'rest', 'rest', 'both', 'rest', 'rest', 'rest'],
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

/** Program session kinds a schedule slot contains ('both' = gym, then swim). */
export function slotKinds(slot) {
  if (slot === 'both') return ['gym', 'swim'];
  if (slot === 'gym' || slot === 'swim') return [slot];
  return [];
}

function isProgramGym(s) { return s.kind === 'gym' && typeof s.templateId === 'string' && /^p\d-[abul]$/.test(s.templateId); }
function isProgramSwim(s) { return s.kind === 'swim' && typeof s.templateId === 'string' && s.templateId.startsWith('swim:'); }

/**
 * Next gym template: alternates A/B (full body) or Upper/Lower based on the
 * last program gym session done in the same style.
 */
export function nextGymTemplate(sessions, phaseId, split = 'full') {
  const templates = gymTemplatesForPhase(phaseId, split);
  const style = templates[0]?.split;
  const last = sessions.find((s) => isProgramGym(s) && getGymTemplate(s.templateId)?.split === style);
  if (!last) return templates[0];
  const lastSlot = getGymTemplate(last.templateId)?.slot;
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
function slotsAhead(state, kind, dateIso) {
  const today = todayISO();
  if (dateIso <= today) return 0;
  let n = 0;
  for (let d = today; d < dateIso; d = addDays(d, 1)) {
    if (!slotKinds(slotForDate(state.schedule, d)).includes(kind)) continue;
    if (d === today && state.sessions.some((s) => s.date === today && s.kind === kind)) continue;
    n += 1;
  }
  return n;
}

/**
 * What's on for a given day:
 * { slot, phase, parts: [{ kind: 'gym'|'swim', template, done }], doneToday, template }
 * `template` is the first part's, for callers that only need one.
 */
export function planForDay(state, dateIso = todayISO()) {
  const { profile, schedule, sessions, custom } = state;
  const phase = currentPhase(profile, dateIso);
  const slot = slotForDate(schedule, dateIso);
  const doneToday = sessions.filter((s) => s.date === dateIso);
  const split = profile?.split || 'full';
  const mode = state.settings?.swimMode || 'full';
  const parts = [];
  for (const kind of slotKinds(slot)) {
    let template;
    if (kind === 'gym') {
      template = nextGymTemplate(sessions, phase.id, split);
      if (slotsAhead(state, 'gym', dateIso) % 2 === 1) template = gymTemplatesForPhase(phase.id, split).find((x) => x.id !== template.id) || template;
    } else {
      template = nextSwimWorkout(sessions, profile?.swimLevel, phase.id, mode);
      if (slotsAhead(state, 'swim', dateIso) % 2 === 1) {
        const [tech, endure] = swimTemplateKeys(profile?.swimLevel || 'novice', phase.id);
        template = getSwimWorkout(template.key === tech ? endure : tech, mode);
      }
    }
    parts.push({ kind, template, done: doneToday.some((s) => s.kind === kind) });
  }
  if (slot && slot.startsWith('custom:')) {
    const t = custom?.templates?.find((c) => c.id === slot.slice(7));
    if (t) parts.push({ kind: t.kind, template: t, done: doneToday.some((s) => s.templateId === t.id), custom: true });
  }
  const effective = parts.length ? (slot === 'both' ? 'both' : parts[0].kind) : 'rest';
  return { slot: effective, phase, parts, doneToday, template: parts[0]?.template || null };
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

// Dumbbells come in fixed sizes, so suggest the next pair that exists.
const DB_LADDER = {
  lb: [3, 5, 8, 10, 12, 15, 17.5, 20, 22.5, 25, ...Array.from({ length: 25 }, (_, i) => 30 + i * 5)],
  kg: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, ...Array.from({ length: 20 }, (_, i) => 32.5 + i * 2.5)],
};
export function nextDumbbell(w, unit, dir = 1) {
  const ladder = DB_LADDER[unit] || DB_LADDER.lb;
  if (dir > 0) return ladder.find((x) => x > w + 0.01) ?? w + (unit === 'kg' ? 2.5 : 5);
  return [...ladder].reverse().find((x) => x < w - 0.01) ?? ladder[0];
}

/**
 * The weight one stepper tap away: the next real dumbbell size up or down,
 * otherwise the exercise's usual jump (one pin on a machine, 5 lb / 2.5 kg on
 * a barbell). Never below zero.
 */
export function stepWeight(exId, w, unit, dir = 1) {
  const def = getExercise(exId);
  const cur = w || 0;
  if (def?.equipment === 'Dumbbell') return nextDumbbell(cur, unit, dir);
  const inc = incrementFor(def, unit);
  return Math.max(0, Math.round((cur + dir * inc) * 100) / 100);
}

function totalReps(sets, measure) { return sets.reduce((sum, st) => sum + measure(st), 0); }

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
      weight: 'Start light: pick a weight you could lift about 15 times, then do the target reps. Adjust the next set if needed.',
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
      return { kind: 'reps', weight: null, reps: repMax, text: `You held ${repMax} s on every set. Move to a harder version (feet closer together, or lift one foot).`, last };
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
  const isDumbbell = def?.equipment === 'Dumbbell';
  const isStack = def?.equipment === 'Machine' || def?.equipment === 'Cable';
  const hitTop = atTop.length >= (target?.sets || 1) && atTop.every((st) => measure(st) >= repMax);
  const unitWord = type === 'weight_time' ? 's' : 'reps';

  if (!topW && type !== 'assisted') {
    return { kind: 'same', weight: null, reps: repMin, text: 'Add a weight this time so the app can track your progress.', last };
  }
  if (type === 'assisted' && !topW) {
    const best = Math.max(...sets.map(measure));
    const aim = Math.min(repMax, best + 1);
    return { kind: 'reps', weight: 0, reps: aim, text: `Full bodyweight pull-ups! Aim for ${aim} reps.`, last };
  }
  if (hitTop) {
    if (type === 'assisted') {
      const next = Math.max(0, topW - inc);
      return { kind: 'up', weight: next, reps: repMin, text: `You hit ${repMax} on every set. Lower the assistance to ${fmtW(next)} ${unit} (less help = harder).`, last };
    }
    if (isDumbbell) {
      const next = nextDumbbell(topW, unit, 1);
      return { kind: 'up', weight: next, reps: repMin, text: `You hit ${repMax} on every set. Use the next dumbbells up (${fmtW(next)} ${unit}). Fewer reps than last time is normal; aim for ${repMin}+.`, last };
    }
    const next = Math.round((topW + inc) * 2) / 2;
    const text = isStack
      ? `You hit ${repMax} on every set. Go up one pin (about ${fmtW(next)} ${unit}), or add the small add-on weight. Aim for ${repMin}+ reps.`
      : `You hit ${repMax} on every set. Go up to ${fmtW(next)} ${unit} and aim for ${repMin}+ reps.`;
    return { kind: 'up', weight: next, reps: repMin, text, last };
  }

  // Back off only after two sessions at this weight that started below the
  // range AND made no progress in total reps.
  const firstBelow = measure(atTop[0]) < repMin;
  if (firstBelow) {
    const prev = lastPerformance(exId, sessions.filter((s) => s.id !== perf.session.id), beforeSessionId);
    if (prev) {
      const prevSets = prev.sets.map((st) => ({ ...st, w: st.w != null ? convertWeight(st.w, prev.session.unit, unit) : st.w }));
      const prevTop = Math.max(...prevSets.map((st) => st.w || 0));
      const prevAtTop = prevSets.filter((st) => (st.w || 0) === prevTop);
      const sameWeight = Math.abs(prevTop - topW) < 0.01;
      const noProgress = totalReps(atTop, measure) <= totalReps(prevAtTop, measure);
      if (sameWeight && prevAtTop.length && measure(prevAtTop[0]) < repMin && noProgress) {
        if (type === 'assisted') {
          const more = topW + inc;
          return { kind: 'down', weight: more, reps: repMin, text: `No progress for two sessions. Add assistance: use ${fmtW(more)} ${unit}, rebuild, and beat it.`, last };
        }
        let lighter;
        if (isDumbbell) lighter = nextDumbbell(topW, unit, -1);
        else if (isStack) lighter = Math.max(inc, topW - inc);
        else {
          const step = unit === 'kg' ? 2.5 : 5;
          lighter = Math.max(step, Math.min(topW - step, round(topW * 0.9, step)));
        }
        const how = isStack ? ` (one pin lighter)` : isDumbbell ? ' (one dumbbell size lighter)' : '';
        return { kind: 'down', weight: lighter, reps: repMin, text: `No progress for two sessions. Drop to ${fmtW(lighter)} ${unit}${how} and build back up.`, last };
      }
    }
  }
  const bestReps = Math.max(...atTop.map(measure));
  const aim = Math.min(repMax, Math.max(repMin, bestReps + 1));
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
  const blocks = expandForPool(workout.blocks || [], pool.len, profile?.swimLevel).map((b) => ({
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

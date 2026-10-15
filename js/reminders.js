// What the push server needs to remind you (see server/): the next four
// weeks of your plan as short notification texts, program news such as a
// new phase starting, your weekly schedule for after that, and the days
// you've already trained. Plain functions of the app state, so they're
// easy to test.

import { addDays, todayISO } from './util.js';
import { planForDay } from './program.js';
import { PHASES } from './data/plans.js';
import { expandForPool, workoutDistance } from './data/swim.js';

export const PLAN_DAYS = 28;

function swimLine(template, state) {
  const poolLen = state.profile?.pool?.len || 25;
  const unit = state.profile?.pool?.unit || 'yd';
  const dist = workoutDistance(expandForPool(template.blocks || [], poolLen, state.profile?.swimLevel));
  return dist ? `${dist} ${unit}` : '';
}

/** Title and body for a training day, from the parts not done yet. */
export function workoutText(parts, state) {
  const gym = parts.find((p) => p.kind === 'gym');
  const swim = parts.find((p) => p.kind === 'swim');
  if (gym && swim) {
    const dist = swimLine(swim.template, state);
    return { title: 'Gym and swim today', body: `${gym.template.name}, then ${swim.template.name}${dist ? ` (${dist})` : ''}.` };
  }
  if (gym) {
    const n = gym.template.exercises?.length || 0;
    return { title: `Gym today: ${gym.template.name}`, body: n ? `${n} exercises, with a warm-up and cool-down. Tap to start.` : 'Tap to start.' };
  }
  const dist = swimLine(swim.template, state);
  return { title: `Swim today: ${swim.template.name}`, body: dist ? `${dist}. Tap to start.` : 'Tap to start.' };
}

/** Program news on the day it happens: Phase 2 and 3 starting, and the final week. */
export function programNews(state, from, to) {
  const p = state.profile;
  if (!p?.startDate || p.phaseOverride) return [];
  const weekStart = (w) => addDays(p.startDate, (w - 1) * 7);
  return [
    { date: weekStart(5), title: `Phase 2 starts today: ${PHASES[1].name}`, body: PHASES[1].summary },
    { date: weekStart(9), title: `Phase 3 starts today: ${PHASES[2].name}`, body: PHASES[2].summary },
    { date: weekStart(12), title: 'Final week of your 12-week program', body: 'This week, compare your weights and swim distances with week 1.' },
  ].filter((n) => n.date >= from && n.date < to).map((n) => ({ ...n, kind: 'program' }));
}

/** Everything the server keeps for reminders, for the PLAN_DAYS from `today`. */
export function reminderPlan(state, today = todayISO()) {
  const plan = [];
  const done = [];
  for (let i = 0; i < PLAN_DAYS; i++) {
    const date = addDays(today, i);
    const day = planForDay(state, date);
    const open = day.parts.filter((p) => !p.done);
    if (open.length) plan.push({ date, kind: 'workout', ...workoutText(open, state) });
    else if (day.parts.length) done.push(date);
  }
  plan.push(...programNews(state, today, addDays(today, PLAN_DAYS)));
  return { plan, done, week: state.schedule?.days?.length === 7 ? state.schedule.days : null };
}

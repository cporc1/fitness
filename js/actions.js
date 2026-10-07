// Starting, saving and finishing sessions, shared by several views.

import * as store from './store.js';
import { h, icon, ICONS, todayISO, parseClock } from './util.js';
import { ctx, go, replace, render, tab, invalidateSessions } from './app.js';
import {
  buildGymSession, buildSwimSession, buildOtherSession, computeSwimDistance, currentPhase,
  nextGymTemplate, nextSwimWorkout,
} from './program.js';
import { gymTemplatesForPhase } from './data/plans.js';
import { getSwimWorkout, swimTemplateKeys, workoutDistance, expandForPool } from './data/swim.js';
import { getExercise } from './data/exercises.js';
import { detectPRs, swimPRs } from './stats.js';
import { sheet, confirmDialog, toast, input, field, listItem } from './ui.js';
import { stopRest } from './timer.js';

export async function ensureNoActive() {
  const { active } = ctx();
  if (!active) return true;
  const ok = await confirmDialog({
    title: 'Workout in progress',
    message: `You have an unfinished "${active.name}". Discard it and start a new one?`,
    confirm: 'Discard and start', danger: true,
  });
  if (ok) {
    stopRest();
    store.set('active', null);
  }
  return ok;
}

export async function startGym(template) {
  if (!(await ensureNoActive())) return;
  const state = ctx();
  const session = buildGymSession(template, state);
  session.view = state.settings?.sessionView === 'focus' ? 'focus' : 'list';
  store.set('active', session);
  go('session');
}

export async function startSwim(workout) {
  if (!(await ensureNoActive())) return;
  const session = buildSwimSession(workout, ctx());
  store.set('active', session);
  go('swim-session');
}

export async function startEmptyGym() {
  await startGym({ id: 'empty', name: 'Gym workout', exercises: [] });
}

export async function startFreeSwim() {
  await startSwim({ id: 'free-swim', name: 'Free swim', focus: 'Count your lengths and swim at your own pace.', blocks: [] });
}

export function resumeActive() {
  const { active } = ctx();
  if (!active) return;
  go(active.kind === 'swim' ? 'swim-session' : 'session');
}

/**
 * Persist the in-progress session without re-rendering the app. Late saves
 * (a debounced edit, a screen that was already replaced) for a session that
 * was finished or discarded meanwhile are ignored, so it can't come back.
 */
export function saveActive(session) {
  if (store.get('active')?.id !== session.id) return;
  store.set('active', session, { silent: true });
}

export async function discardActive() {
  const ok = await confirmDialog({ title: 'Discard workout?', message: 'Nothing from this session will be saved.', confirm: 'Discard', danger: true });
  if (!ok) return;
  stopRest();
  store.set('active', null);
  tab('today');
}

function cleanGymSession(session) {
  // Keep only sets that were completed; drop exercises with nothing done.
  // The suggestion's text and last-session copy are only needed live; keep saved sessions small.
  const exercises = session.exercises
    .map((ex) => ({
      ...ex,
      sets: ex.sets.filter((st) => st.done),
      suggestion: ex.suggestion ? { kind: ex.suggestion.kind, weight: ex.suggestion.weight ?? null } : null,
    }))
    .filter((ex) => ex.sets.length);
  const { view, focusIndex, ...rest } = session;
  return { ...rest, exercises };
}

/**
 * Finish: save straight away and open the celebration screen, where effort,
 * notes, time and distance can still be changed. A gym session with no sets
 * ticked asks first.
 */
export async function finishSession(session) {
  const isSwim = session.kind === 'swim';
  const now = new Date();
  const durationSec = Math.round((now - new Date(session.startedAt)) / 1000);
  const { profile, sessions } = ctx();
  const unit = profile?.units || 'lb';

  let draft = { ...session, endedAt: now.toISOString(), durationSec };
  if (isSwim) draft.distance = computeSwimDistance(draft);
  else draft = cleanGymSession(draft);

  if (!isSwim && !draft.exercises.length) {
    const ok = await confirmDialog({
      title: 'No sets ticked yet',
      message: 'Tick the check on each set you finish (or tap Complete set). Save the workout anyway?',
      confirm: 'Save anyway', cancel: 'Keep going',
    });
    if (!ok) return;
  }
  saveFinished(draft, sessions, unit);
}

function saveFinished(session, priorSessions, unit) {
  stopRest();
  const prs = session.kind === 'gym' ? detectPRs(session, priorSessions, unit) : swimPRs(session, priorSessions, session.pool?.unit);
  session.prs = prs;
  // Silent, so the live screen isn't drawn again for a session that's over;
  // the celebration screen renders next.
  store.saveSession(session, { silent: true });
  store.set('active', null, { silent: true });
  invalidateSessions();
  replace('celebration', { id: session.id });
}

/** Sheet listing every workout you can start right now. */
export function openStartPicker() {
  const state = ctx();
  const phase = currentPhase(state.profile);
  const split = state.profile?.split || 'full';
  const nextGym = nextGymTemplate(state.sessions, phase.id, split);
  const swimMode = state.settings?.swimMode || 'full';
  const nextSwim = nextSwimWorkout(state.sessions, state.profile?.swimLevel, phase.id, swimMode);
  const poolLen = state.profile?.pool?.len || 25;
  const unitD = state.profile?.pool?.unit || 'yd';
  sheet('Start a workout', (close) => {
    const pickGym = (t) => () => { close(); startGym(t); };
    const pickSwim = (w) => () => { close(); startSwim(w); };
    const gymItems = gymTemplatesForPhase(phase.id, split).map((t) => listItem({
      title: `${t.name}${t.id === nextGym.id ? ' · up next' : ''}`,
      sub: `${t.exercises.length} exercises · ${t.focus}`,
      leading: h('span', { class: 'sr-icon gym' }, icon(ICONS.dumbbell)),
      onclick: pickGym(t),
    }));
    const swimItems = swimTemplateKeys(state.profile?.swimLevel || 'novice', phase.id).map((k) => {
      const w = getSwimWorkout(k, swimMode);
      const dist = workoutDistance(expandForPool(w.blocks, poolLen));
      return listItem({
        title: `${w.name}${w.id === nextSwim?.id ? ' · up next' : ''}`,
        sub: `${dist ? `${dist} ${unitD} · ` : ''}${w.focus}`,
        leading: h('span', { class: 'sr-icon swim' }, icon(ICONS.wave)),
        onclick: pickSwim(w),
      });
    });
    const customItems = (state.custom?.templates || []).map((t) => listItem({
      title: t.name,
      sub: t.kind === 'swim' ? 'Your swim workout' : `${t.exercises.length} exercises · your workout`,
      leading: h('span', { class: `sr-icon ${t.kind}` }, icon(t.kind === 'swim' ? ICONS.wave : ICONS.dumbbell)),
      onclick: () => { close(); if (t.kind === 'swim') startSwim(t); else startGym(t); },
    }));
    return h('div', { class: 'stack lg session-row' },
      h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, `Gym · Phase ${phase.id}: ${phase.name}`), h('div', { class: 'card flush' }, h('div', { class: 'list' }, gymItems))),
      h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Pool'), h('div', { class: 'card flush' }, h('div', { class: 'list' }, swimItems,
        listItem({ title: 'Free swim', sub: 'Just swim and count lengths', leading: h('span', { class: 'sr-icon swim' }, icon(ICONS.wave)), onclick: () => { close(); startFreeSwim(); } })))),
      customItems.length ? h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Your workouts'), h('div', { class: 'card flush' }, h('div', { class: 'list' }, customItems))) : null,
      h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Other'), h('div', { class: 'card flush' }, h('div', { class: 'list' },
        listItem({ title: 'Empty gym workout', sub: 'Add exercises as you go', leading: h('span', { class: 'sr-icon gym' }, icon(ICONS.plus)), onclick: () => { close(); startEmptyGym(); } }),
        listItem({ title: 'Log another activity', sub: 'Walk, run, class, sport…', leading: h('span', { class: 'sr-icon other' }, icon(ICONS.note)), onclick: () => { close(); openLogOther(); } })))));
  });
}

export function openLogOther(dateIso = todayISO()) {
  const name = input({ id: 'oth-name', placeholder: 'e.g. Walk, Yoga class, Tennis', autocapitalize: 'sentences' });
  const date = input({ id: 'oth-date', type: 'date', value: dateIso, max: todayISO() });
  const mins = input({ id: 'oth-min', inputmode: 'numeric', placeholder: '30' });
  const notes = h('textarea', { class: 'input', id: 'oth-notes', placeholder: 'Optional' });
  sheet('Log activity', (close) => h('div', { class: 'stack lg' },
    field('Activity', name),
    h('div', { class: 'field-row' }, field('Date', date), field('Minutes', mins)),
    field('Notes', notes),
    h('button', {
      class: 'btn good block lg',
      onclick: () => {
        const minutes = parseClock(mins.value) || 0;
        const session = buildOtherSession({
          name: name.value.trim() || 'Activity', date: date.value || dateIso, durationSec: Math.round(minutes * 60), notes: notes.value.trim(),
        });
        store.saveSession(session);
        close();
        toast('Activity logged');
      },
    }, 'Save')));
}

export function exerciseName(id) {
  return getExercise(id)?.name || id;
}

export { render };

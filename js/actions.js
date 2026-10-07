// Starting, saving and finishing sessions, shared by several views.

import * as store from './store.js';
import { h, icon, ICONS, todayISO, fmtDuration, parseClock, fmtNum } from './util.js';
import { ctx, go, render, tab, invalidateSessions } from './app.js';
import {
  buildGymSession, buildSwimSession, buildOtherSession, computeSwimDistance, currentPhase,
  nextGymTemplate, nextSwimWorkout,
} from './program.js';
import { gymTemplatesForPhase } from './data/plans.js';
import { getSwimWorkout, swimTemplateKeys, workoutDistance, expandForPool } from './data/swim.js';
import { getExercise } from './data/exercises.js';
import { detectPRs, swimPRs } from './stats.js';
import { sheet, confirmDialog, toast, input, field, segmented, listItem } from './ui.js';
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
  const session = buildGymSession(template, ctx());
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

/** Persist the in-progress session without re-rendering the app. */
export function saveActive(session) {
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
  return { ...session, exercises };
}

/** Finish flow: summary sheet with effort + notes, then save. */
export function finishSession(session) {
  const isSwim = session.kind === 'swim';
  const now = new Date();
  const durationSec = Math.round((now - new Date(session.startedAt)) / 1000);
  const { profile, sessions } = ctx();
  const unit = profile?.units || 'lb';

  let draft = { ...session, endedAt: now.toISOString(), durationSec };
  if (isSwim) draft.distance = computeSwimDistance(draft);
  else draft = cleanGymSession(draft);

  const doneSets = isSwim ? 0 : draft.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const durInput = input({ id: 'fin-dur', value: String(Math.max(1, Math.round(durationSec / 60))), inputmode: 'numeric', type: 'text' });
  const notes = h('textarea', { class: 'input', id: 'fin-notes', placeholder: 'How did it go? Anything to remember next time?' }, session.notes || '');
  let rpe = session.rpe || null;
  const distInput = isSwim ? input({ id: 'fin-dist', value: String(draft.distance || ''), inputmode: 'numeric' }) : null;

  sheet('Finish workout', (close) => h('div', { class: 'stack lg' },
    h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Time'), h('span', { class: 'v' }, fmtDuration(durationSec))),
      isSwim
        ? h('div', null, h('span', { class: 'k' }, 'Distance'), h('span', { class: 'v' }, `${fmtNum(draft.distance, 0)} ${draft.pool.unit}`))
        : h('div', null, h('span', { class: 'k' }, 'Sets done'), h('span', { class: 'v' }, String(doneSets))),
      isSwim ? null : h('div', null, h('span', { class: 'k' }, 'Exercises'), h('span', { class: 'v' }, String(draft.exercises.length)))),
    !isSwim && doneSets === 0 ? h('div', { class: 'callout warn' }, 'No sets are ticked yet. Tap the check button on each set you finish, or save anyway to log the session.') : null,
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'How hard was it overall? (RPE)'),
      segmented([
        { value: 4, label: 'Easy' }, { value: 6, label: 'Moderate' }, { value: 8, label: 'Hard' }, { value: 10, label: 'Max' },
      ], rpe, (v) => { rpe = v; }, 'Session effort')),
    h('div', { class: 'field-row' },
      field('Duration (min)', durInput),
      isSwim ? field(`Distance (${draft.pool.unit})`, distInput, 'Adjust if you swam more or less') : null),
    field('Notes', notes),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost', onclick: close }, 'Keep going'),
      h('button', {
        class: `btn ${isSwim ? 'pool' : 'iron'}`,
        onclick: () => {
          const mins = Number(durInput.value);
          draft.durationSec = Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : durationSec;
          draft.notes = notes.value.trim();
          draft.rpe = rpe;
          if (isSwim) {
            const d = Number(distInput.value);
            if (Number.isFinite(d) && d >= 0) draft.distance = d;
          }
          close();
          saveFinished(draft, sessions, unit);
        },
      }, icon(ICONS.check, 20), 'Save workout'))));
}

function saveFinished(session, priorSessions, unit) {
  stopRest();
  const prs = session.kind === 'gym' ? detectPRs(session, priorSessions, unit) : swimPRs(session, priorSessions, session.pool?.unit);
  session.prs = prs;
  store.saveSession(session);
  store.set('active', null, { silent: true });
  invalidateSessions();
  go('session-detail', { id: session.id, celebrate: true });
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

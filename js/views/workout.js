// Workout page: one design for program gym days, program swims and your own
// workouts. A hero with the essentials, then one row per exercise or swim set;
// tapping a row opens its how-to sheet.

import * as store from '../store.js';
import { h, icon, ICONS, fmtClock, put } from '../util.js';
import { go, back, registerRoute } from '../app.js';
import { sharedHero } from '../router.js';
import { PHASES, WARMUP_GYM, COOLDOWN_GYM } from '../data/plans.js';
import { SWIM_LEVELS, expandForPool, workoutDistance, guideForItem } from '../data/swim.js';
import { getExercise } from '../data/exercises.js';
import { templateById, suggest } from '../program.js';
import { startGym, startSwim } from '../actions.js';
import { topbar, listItem, sheet, confirmDialog, lanes } from '../ui.js';
import { exThumb, openExerciseSheet, openDrillSheet, targetText } from './library.js';
import { describeItem } from './session-swim.js';

const EQUIPMENT_WORD = { Machine: 'machines', Dumbbell: 'dumbbells', Barbell: 'barbell', Cable: 'cables', Bodyweight: 'bodyweight', 'Cardio machine': 'cardio' };

export const isSwimWorkout = (t) => t?.kind === 'swim' || String(t?.id || '').startsWith('swim:');

/** What a card or page needs to summarise a workout. */
export function workoutSummary(t, state) {
  if (isSwimWorkout(t)) {
    const poolLen = state.profile?.pool?.len || 25;
    const unitD = state.profile?.pool?.unit || 'yd';
    const blocks = expandForPool(t.blocks || [], poolLen, state.profile?.swimLevel);
    return { kind: 'swim', blocks, dist: workoutDistance(blocks), unitD, poolLen };
  }
  const unit = state.profile?.units || 'lb';
  const swaps = t.split ? (state.swaps || {}) : {}; // permanent swaps apply to program workouts
  const items = (t.exercises || []).map((item) => {
    const exId = swaps[item.ex] || item.ex;
    return { item, exId, def: getExercise(exId), swapped: !!swaps[item.ex], sugg: suggest(exId, item, state.sessions, unit) };
  });
  const minutes = Math.round((t.exercises || []).reduce((m, e) => m + e.sets * (1 + (e.rest || 90) / 60), 0) + 8);
  const equipment = [...new Set(items.map((x) => x.def?.equipment).filter(Boolean))].map((e) => EQUIPMENT_WORD[e] || e.toLowerCase());
  return { kind: 'gym', items, minutes, ups: items.filter((x) => x.sugg.kind === 'up').length, equipment };
}

function checklistSheet(title, items) {
  sheet(title, h('ul', { class: 'checklist' }, items.map((x) => h('li', null, x))));
}

function eyebrowFor(t, state) {
  if (isSwimWorkout(t)) {
    if (!String(t.id).startsWith('swim:')) return 'Your swim';
    const level = SWIM_LEVELS.find((l) => l.id === state.profile?.swimLevel);
    return `Swim · ${level?.name || 'Beginner swimmer'}`;
  }
  if (t.phase) return `Gym · Phase ${t.phase}: ${PHASES.find((p) => p.id === t.phase)?.name || ''}`;
  return 'Your workout';
}

registerRoute('workout', ({ id }, state) => {
  const t = templateById(id, state.custom, state.settings?.swimMode || 'full');
  if (!t) return h('div', { class: 'view' }, topbar({ title: 'Workout', onBack: back }), h('p', { class: 'muted' }, 'This workout no longer exists.'));
  const isCustom = !!state.custom?.templates?.find((c) => c.id === id);
  const sum = workoutSummary(t, state);
  const swim = sum.kind === 'swim';

  const meta = swim
    ? [sum.dist ? `${sum.dist} ${sum.unitD}` : 'Skills session', sum.dist ? `${sum.dist / sum.poolLen} lengths` : null]
    : [`~${sum.minutes} min`, `${sum.items.length} ${sum.items.length === 1 ? 'exercise' : 'exercises'}`, sum.equipment.join(', ')];

  const view = h('div', { class: 'view' },
    topbar({
      title: '', onBack: back,
      actions: isCustom ? [h('button', { class: 'icon-btn', 'aria-label': 'Edit workout', onclick: () => go('builder', { id }) }, icon(ICONS.edit))] : [],
    }),
    h('section', { class: `wk-hero ${swim ? 'swim' : 'gym'}`, style: sharedHero.id === id ? { viewTransitionName: 'wk-hero' } : null },
      lanes(swim ? 'swim' : 'gym'),
      h('div', { class: 'eyebrow' }, eyebrowFor(t, state)),
      h('h1', null, t.name),
      t.focus ? h('p', { class: 'ink-2' }, t.focus) : null,
      h('div', { class: 'wk-meta' }, meta.filter(Boolean).map((m) => h('span', null, m))),
      h('button', {
        class: `btn ${swim ? 'pool' : 'iron'} lg block`, onclick: () => (swim ? startSwim(t) : startGym(t)),
      }, icon(ICONS.play, 20), swim ? 'Start swim' : 'Start workout')));

  if (swim) {
    for (const b of sum.blocks) {
      put(view, h('section', { class: 'section' },
        h('div', { class: 'eyebrow group-title' }, b.name),
        h('div', { class: 'card flush' }, h('div', { class: 'list' }, b.items.map((it) => {
          const guide = guideForItem(it);
          const lengths = it.dist && Number.isInteger(it.dist / sum.poolLen) ? `${it.dist / sum.poolLen} ${it.dist / sum.poolLen === 1 ? 'length' : 'lengths'} each` : null;
          const rest = it.rest ? `rest ${it.rest} s` : 'no rest';
          return listItem({
            title: `${it.reps} × ${describeItem(it, sum.unitD)}`,
            sub: [rest, lengths, it.note].filter(Boolean).join(' · '),
            leading: h('span', { class: 'sr-icon swim' }, icon(ICONS.wave)),
            onclick: guide ? () => openDrillSheet(guide, { target: `${it.reps} × ${describeItem(it, sum.unitD)} · ${rest}` }) : null,
            trailing: guide ? undefined : null,
          });
        })))));
    }
  } else {
    const rows = [
      listItem({ title: 'Warm-up', sub: '5–8 min · easy cardio and mobility', leading: h('span', { class: 'sr-icon other' }, icon(ICONS.timer)), onclick: () => checklistSheet('Warm-up', WARMUP_GYM) }),
      ...sum.items.map(({ item, exId, def, swapped, sugg }) => listItem({
        title: def?.name || exId,
        sub: `${targetText(item, def)}${item.rest ? ` · rest ${fmtClock(item.rest)}` : ''}${swapped ? ' · swapped' : ''}`,
        leading: exThumb(exId) || h('span', { class: 'sr-icon gym' }, icon(ICONS.dumbbell)),
        trailing: sugg.kind === 'up' ? h('span', { class: 'chip good' }, icon(['M12 19V5', 'M5 12l7-7 7 7'], 12), 'Add weight') : undefined,
        onclick: () => openExerciseSheet(exId, { item, suggestion: sugg }),
      })),
      listItem({ title: 'Cool-down', sub: '3–5 min · easy stretches', leading: h('span', { class: 'sr-icon other' }, icon(ICONS.rest)), onclick: () => checklistSheet('Cool-down', COOLDOWN_GYM) }),
    ];
    put(view, h('div', { class: 'card flush session-row' }, h('div', { class: 'list' }, rows)));
    if (sum.ups) put(view, h('p', { class: 'small muted' }, `You hit the top of the range last time on ${sum.ups === 1 ? 'one exercise' : `${sum.ups} exercises`}, so the app will suggest a little more weight.`));
  }

  if (isCustom) {
    put(view, h('button', {
      class: 'btn ghost', onclick: async () => {
        const ok = await confirmDialog({ title: 'Delete this workout?', message: 'Logged sessions stay in your history.', confirm: 'Delete', danger: true });
        if (!ok) return;
        store.update('custom', (c) => { c.templates = c.templates.filter((x) => x.id !== id); return c; });
        store.update('schedule', (s) => { if (s) s.days = s.days.map((d) => (d === `custom:${id}` ? 'rest' : d)); return s; });
        back();
      },
    }, icon(ICONS.trash, 18), 'Delete workout'));
  }
  return view;
});

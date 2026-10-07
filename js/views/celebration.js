// After Finish: the workout is already saved, so this screen celebrates it.
// The week's rings close, confetti flies, records get medals, and you can
// say how it felt, add notes, or fix the time and distance.

import * as store from '../store.js';
import { h, icon, ICONS, fmtNum, fmtDuration, toNumber, weekStart, addDays } from '../util.js';
import { ctx, registerRoute, tab } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { sessionVolume, pacePer100, swimDistance } from '../stats.js';
import { slotForDate } from '../program.js';
import { confetti } from '../motion.js';
import { segmented, ring } from '../ui.js';

const cel = { open: false };

function weekCounts(state, kind, excludeId) {
  const from = weekStart(state.sessions.find((x) => x.id === excludeId)?.date || new Date().toISOString().slice(0, 10));
  const to = addDays(from, 7);
  const inWeek = state.sessions.filter((x) => x.kind === kind && x.date >= from && x.date < to);
  let planned = 0;
  for (let i = 0; i < 7; i++) {
    const slot = slotForDate(state.schedule, addDays(from, i));
    if (slot === kind || slot === 'both') planned += 1;
  }
  return { done: inWeek.length, before: inWeek.filter((x) => x.id !== excludeId).length, planned };
}

function prText(pr, unit, poolUnit) {
  if (pr.kind === 'distance') return `Longest swim: ${fmtNum(pr.value, 0)} ${poolUnit}`;
  const name = getExercise(pr.exId)?.name || pr.exId;
  if (pr.kind === 'weight') return `${name}: heaviest ever, ${fmtNum(pr.value, 1)} ${unit}`;
  if (pr.kind === 'e1rm') return `${name}: best estimated 1-rep max, ${fmtNum(pr.value, 0)} ${unit}`;
  if (pr.kind === 'time') return `${name}: longest hold, ${pr.value} s`;
  return `${name}: most reps, ${pr.value}`;
}

/** "Warm-up 7/7 · Cool-down 5/5": stretching counts too. */
export function routineChips(x) {
  const chip = (label, items) => {
    if (!items?.length) return null;
    const n = items.filter((it) => it.done).length;
    return h('span', { class: `chip ${n === items.length ? 'good' : 'plain'}` }, n === items.length ? icon(ICONS.check, 14) : null, `${label} ${n}/${items.length}`);
  };
  const chips = [chip('Warm-up', x.warmup), chip('Cool-down', x.cooldown)].filter(Boolean);
  return chips.length ? h('div', { class: 'routine-chips' }, chips) : null;
}

registerRoute('celebration', ({ id }, state, { entering }) => {
  const x = state.sessions.find((it) => it.id === id);
  if (!x) { setTimeout(() => tab('today'), 0); return h('div', { class: 'view' }); }
  const save = (patch) => store.saveSession({ ...state.sessions.find((it) => it.id === id), ...patch });
  const unit = x.unit || state.profile?.units || 'lb';
  const poolUnit = x.pool?.unit || state.profile?.pool?.unit || 'yd';
  const swim = x.kind === 'swim';
  const counts = weekCounts(state, x.kind, id);

  const stats = swim
    ? [['Time', x.durationSec ? fmtDuration(x.durationSec) : '—'], ['Distance', `${fmtNum(swimDistance(x, poolUnit), 0)} ${poolUnit}`],
      ['Per 100', (() => { const p = pacePer100(x.distance, x.durationSec); return p ? `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}` : '—'; })()]]
    : [['Time', x.durationSec ? fmtDuration(x.durationSec) : '—'], ['Sets', String((x.exercises || []).reduce((n, ex) => n + ex.sets.length, 0))],
      ['Lifted', `${fmtNum(sessionVolume(x, unit), 0)} ${unit}`]];

  const minutes = h('input', {
    class: 'input', id: 'cel-min', inputmode: 'numeric', value: String(Math.max(1, Math.round((x.durationSec || 0) / 60))),
    onchange: (e) => { const m = toNumber(e.target.value); if (m > 0) save({ durationSec: Math.round(m * 60) }); },
  });
  const distance = swim ? h('input', {
    class: 'input', id: 'cel-dist', inputmode: 'numeric', value: String(x.distance || 0),
    onchange: (e) => { const d = toNumber(e.target.value); if (d >= 0) save({ distance: d }); },
  }) : null;
  const notes = h('textarea', {
    class: 'input', id: 'cel-notes', placeholder: 'How did it go? Anything to remember next time?',
    onchange: (e) => save({ notes: e.target.value.trim() }),
  }, x.notes || '');

  if (entering) { cel.open = false; setTimeout(() => confetti(), 380); }

  return h('div', { class: 'view full celebrate', 'data-full': 'true' },
    h('div', { class: 'cel-hero' },
      h('div', { class: 'cel-ring' },
        ring(counts.planned ? counts.done / counts.planned : 1, swim ? 'swim' : 'gym', entering, counts.planned ? counts.before / counts.planned : 0, 120),
        h('span', { class: 'cel-check' }, icon(ICONS.check, 40))),
      h('h1', null, swim ? 'Swim complete' : 'Workout complete'),
      h('p', { class: 'ink-2' }, `${x.name}${counts.planned ? ` · ${counts.done} of ${counts.planned} ${swim ? 'swims' : 'workouts'} this week` : ''}`)),
    h('div', { class: 'cel-stats' }, stats.map(([k, v]) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, k), h('span', { class: 'kpi-value' }, v)))),
    routineChips(x),
    x.prs?.length ? h('div', { class: 'pr-list' }, x.prs.map((pr, i) => h('div', { class: 'pr medal', style: { '--i': String(i) } },
      icon(ICONS.trophy, 22), h('span', null, prText(pr, unit, poolUnit))))) : null,
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'How did it feel?'),
      segmented([
        { value: 4, label: 'Easy' }, { value: 6, label: 'Moderate' }, { value: 8, label: 'Hard' }, { value: 10, label: 'Max' },
      ], x.rpe || null, (v) => save({ rpe: v }), 'Session effort')),
    h('details', { class: 'disclosure', open: cel.open, ontoggle: (e) => { cel.open = e.target.open; } },
      h('summary', null, 'Notes, time and distance'),
      h('div', { class: 'stack lg' },
        h('div', { class: 'field-row' },
          h('div', { class: 'field' }, h('label', { for: 'cel-min' }, 'Minutes'), minutes),
          swim ? h('div', { class: 'field' }, h('label', { for: 'cel-dist' }, `Distance (${poolUnit})`), distance) : null),
        h('div', { class: 'field' }, h('label', { for: 'cel-notes' }, 'Notes'), notes))),
    h('button', { class: `btn ${swim ? 'pool' : 'iron'} lg block`, onclick: () => tab('today') }, 'Done'));
});

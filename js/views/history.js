// History (pushed from Progress): calendar + list of past sessions, and session details.

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, toISODate, fmtDate, fmtMonth, fmtDuration, fmtNum, parseISODate, relativeDay, put } from '../util.js';
import { ctx, go, back, registerRoute, render } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { sessionVolume, pacePer100 } from '../stats.js';
import { pageHead, topbar, confirmDialog, toast } from '../ui.js';
import { openLogOther } from '../actions.js';
import { showDay } from './today.js';
import { fmtSet, openExerciseSheet } from './library.js';
import { describeItem } from './session-swim.js';
import { routineChips } from './celebration.js';

const KIND_ICON = { gym: ICONS.dumbbell, swim: ICONS.wave, other: ICONS.note };

export function sessionSummary(s, profile) {
  const parts = [];
  if (s.durationSec) parts.push(fmtDuration(s.durationSec));
  if (s.kind === 'gym') {
    const sets = (s.exercises || []).reduce((n, ex) => n + ex.sets.length, 0);
    const n = (s.exercises || []).length;
    parts.push(`${n} ${n === 1 ? 'exercise' : 'exercises'}`, `${sets} ${sets === 1 ? 'set' : 'sets'}`);
    const vol = sessionVolume(s, profile?.units || 'lb');
    if (vol) parts.push(`${fmtNum(vol, 0)} ${profile?.units || 'lb'} lifted`);
  }
  if (s.kind === 'swim') parts.push(`${fmtNum(s.distance || 0, 0)} ${s.pool?.unit || ''}`);
  return parts.join(' · ');
}

export function sessionRow(s, profile) {
  return h('button', { class: 'list-item session-row', type: 'button', onclick: () => go('session-detail', { id: s.id }) },
    h('span', { class: `sr-icon ${s.kind}` }, icon(KIND_ICON[s.kind] || ICONS.note)),
    h('div', { class: 'grow' },
      h('div', { class: 'li-title' }, s.name),
      h('div', { class: 'li-sub' }, `${relativeDay(s.date)} · ${sessionSummary(s, profile)}`)),
    s.prs?.length ? h('span', { class: 'chip good' }, `${s.prs.length} PR`) : null,
    h('span', { class: 'chev' }, icon(ICONS.chevron, 18)));
}

const cal = { year: null, month: null };

function monthGrid(sessions) {
  const now = new Date();
  if (cal.year === null) { cal.year = now.getFullYear(); cal.month = now.getMonth(); }
  const first = new Date(cal.year, cal.month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(cal.year, cal.month + 1, 0).getDate();
  const byDate = new Map();
  for (const s of sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s.kind);
  }
  const today = todayISO();
  const cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('div', { class: 'm-head' }, d));
  const totalCells = Math.ceil((offset + daysIn) / 7) * 7;
  let count = 0;
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(cal.year, cal.month, i - offset + 1);
    const iso = toISODate(date);
    const kinds = byDate.get(iso) || [];
    const inMonth = date.getMonth() === cal.month;
    if (inMonth) count += kinds.length ? 1 : 0;
    cells.push(h('button', {
      class: `m-day${inMonth ? '' : ' out'}${iso === today ? ' today' : ''}`, type: 'button',
      'aria-label': `${fmtDate(iso)}${kinds.length ? `: ${kinds.length} sessions` : ''}`,
      onclick: () => showDay(iso),
    }, h('span', null, String(date.getDate())), h('span', { class: 'm-dots' }, kinds.slice(0, 3).map((k) => h('i', { class: k })))));
  }
  const shift = (d) => {
    cal.month += d;
    if (cal.month < 0) { cal.month = 11; cal.year -= 1; }
    if (cal.month > 11) { cal.month = 0; cal.year += 1; }
    render();
  };
  return h('div', { class: 'card' },
    h('div', { class: 'row between' },
      h('button', { class: 'icon-btn sm', 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon(ICONS.back, 18)),
      h('div', { class: 'stack', style: { gap: 0, alignItems: 'center' } },
        h('strong', { class: 'display', style: { fontSize: 'var(--fs-lg)' } }, fmtMonth(cal.year, cal.month)),
        h('span', { class: 'xs muted' }, `${count} active ${count === 1 ? 'day' : 'days'}`)),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Next month', onclick: () => shift(1) }, icon(ICONS.chevron, 18))),
    h('div', { class: 'month' }, cells),
    h('div', { class: 'row', style: { justifyContent: 'center', gap: '14px' } },
      ...[['gym', 'Gym'], ['swim', 'Swim'], ['other', 'Other']].map(([k, l]) => h('span', { class: 'row xs muted', style: { gap: '5px' } }, h('span', { class: 'm-dots' }, h('i', { class: k, style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: k === 'gym' ? 'var(--iron)' : k === 'swim' ? 'var(--pool)' : 'var(--good)' } })), l))));
}

const filterState = { kind: 'all' };

registerRoute('history', (_p, state) => {
  const list = state.sessions.filter((s) => filterState.kind === 'all' || s.kind === filterState.kind);
  const view = h('div', { class: 'view' },
    topbar({ title: '', onBack: back }),
    pageHead('History', `${state.sessions.length} ${state.sessions.length === 1 ? 'workout' : 'workouts'} logged`),
    monthGrid(state.sessions),
    h('div', { class: 'row between' },
      h('div', { class: 'filter-row', style: { margin: 0, padding: 0 } }, [['all', 'All'], ['gym', 'Gym'], ['swim', 'Swim'], ['other', 'Other']].map(([k, l]) => h('button', {
        'aria-pressed': String(filterState.kind === k), onclick: () => { filterState.kind = k; render(); },
      }, l))),
      h('button', { class: 'btn text', onclick: () => openLogOther() }, icon(ICONS.plus, 18), 'Log')));
  if (!list.length) {
    put(view, h('div', { class: 'chart-empty' }, state.sessions.length ? 'Nothing here for this filter.' : 'No workouts yet. Your first one will show up here.'));
  } else {
    let lastMonth = '';
    let card = null;
    for (const s of list.slice(0, 200)) {
      const m = s.date.slice(0, 7);
      if (m !== lastMonth) {
        lastMonth = m;
        const d = parseISODate(s.date);
        put(view, h('div', { class: 'eyebrow' }, fmtMonth(d.getFullYear(), d.getMonth())));
        card = h('div', { class: 'list' });
        put(view, h('div', { class: 'card flush' }, card));
      }
      put(card, sessionRow(s, state.profile));
    }
  }
  return view;
});

// ---------------- detail ----------------

registerRoute('session-detail', ({ id }, state) => {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return h('div', { class: 'view' }, topbar({ title: 'Workout', onBack: back }), h('p', { class: 'muted' }, 'This workout was deleted.'));
  const unit = state.profile?.units || 'lb';
  const view = h('div', { class: 'view' },
    topbar({ title: '', onBack: back }),
    h('div', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, `${fmtDate(s.date, { weekday: true, year: true })}${s.week ? ` · Week ${s.week}` : ''}`),
      h('h1', null, s.name)));


  const kv = [h('div', null, h('span', { class: 'k' }, 'Time'), h('span', { class: 'v' }, s.durationSec ? fmtDuration(s.durationSec) : '—'))];
  if (s.kind === 'gym') {
    const sets = (s.exercises || []).reduce((n, ex) => n + ex.sets.length, 0);
    kv.push(h('div', null, h('span', { class: 'k' }, 'Sets'), h('span', { class: 'v' }, String(sets))));
    kv.push(h('div', null, h('span', { class: 'k' }, 'Volume'), h('span', { class: 'v' }, `${fmtNum(sessionVolume(s, unit), 0)} ${unit}`)));
  }
  if (s.kind === 'swim') {
    kv.push(h('div', null, h('span', { class: 'k' }, 'Distance'), h('span', { class: 'v' }, `${fmtNum(s.distance || 0, 0)} ${s.pool?.unit || ''}`)));
    const pace = pacePer100(s.distance, s.durationSec);
    if (pace) kv.push(h('div', null, h('span', { class: 'k' }, `Per 100 ${s.pool?.unit}`), h('span', { class: 'v' }, `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}`)));
  }
  if (s.rpe) kv.push(h('div', null, h('span', { class: 'k' }, 'Effort'), h('span', { class: 'v' }, `${s.rpe}/10`)));
  put(view, h('div', { class: 'card' }, h('div', { class: 'kv' }, kv)), routineChips(s));

  if (s.prs?.length) {
    put(view, h('div', { class: 'pr-list' }, s.prs.map((pr) => h('div', { class: 'pr' }, icon(ICONS.trophy, 20),
      h('span', null, pr.kind === 'distance'
        ? `Longest swim: ${fmtNum(pr.value, 0)} ${s.pool?.unit}`
        : `${getExercise(pr.exId)?.name || pr.exId}: ${pr.kind === 'weight' ? `heaviest ever, ${fmtNum(pr.value, 1)} ${unit}` : pr.kind === 'e1rm' ? `best estimated 1RM, ${fmtNum(pr.value, 0)} ${unit}` : pr.kind === 'time' ? `longest hold, ${pr.value} s` : `most reps, ${pr.value}`}`)))));
  }

  if (s.kind === 'gym') {
    for (const ex of s.exercises || []) {
      const def = getExercise(ex.ex);
      put(view, h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('strong', null, def?.name || ex.ex), h('button', { class: 'btn text sm', onclick: () => openExerciseSheet(ex.ex) }, 'History')),
        h('div', { class: 'stack', style: { gap: '4px' } }, ex.sets.map((st, i) => h('div', { class: 'row num small' },
          h('span', { class: 'muted', style: { width: '48px' } }, `Set ${i + 1}`),
          h('span', null, fmtSet(st, ex.type || def?.type, s.unit || unit)))))));
    }
  }
  if (s.kind === 'swim') {
    for (const b of s.blocks || []) {
      put(view, h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, b.name),
        b.items.map((it) => h('div', { class: 'row between small' },
          h('span', null, `${it.reps} × ${describeItem(it, s.pool?.unit)}`),
          h('span', { class: 'muted num' }, `${it.done.filter(Boolean).length}/${it.reps} done`)))));
    }
    if (s.freeLengths) put(view, h('div', { class: 'card' }, h('span', null, `Extra lengths: ${s.freeLengths} (${s.freeLengths * (s.pool?.len || 25)} ${s.pool?.unit})`)));
  }
  if (s.notes) put(view, h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Notes'), h('p', { class: 'ink-2', style: { whiteSpace: 'pre-wrap' } }, s.notes)));

  put(view, h('div', { class: 'btn-row' },
    s.kind !== 'other' ? h('button', { class: 'btn ghost', onclick: () => go(s.kind === 'swim' ? 'edit-swim' : 'edit-session', { id: s.id }) }, icon(ICONS.edit, 18), 'Edit') : null,
    h('button', {
      class: 'btn ghost', style: { color: 'var(--danger)' }, onclick: async () => {
        const ok = await confirmDialog({ title: 'Delete workout?', message: 'This cannot be undone.', confirm: 'Delete', danger: true });
        if (!ok) return;
        store.deleteSession(s.id);
        toast('Workout deleted');
        back();
      },
    }, icon(ICONS.trash, 18), 'Delete')));
  return view;
});

export { ctx };

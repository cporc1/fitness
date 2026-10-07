// Exercise & swim-drill library, plus the shared exercise detail content.

import * as store from '../store.js';
import { h, icon, ICONS, fmtDate, fmtNum, uid, put, fill } from '../util.js';
import { ctx } from '../app.js';
import { GROUPS, getExercise, allExercises } from '../data/exercises.js';
import { getDrill } from '../data/swim.js';
import { framesFor } from '../data/media.js';
import { demoMedia, demoVideo } from '../media.js';
import { exerciseHistory, exerciseRecords } from '../stats.js';
import { lineChart } from '../charts.js';
import { listItem, sheet, input, field, select, toast, confirmDialog } from '../ui.js';

const TYPE_LABEL = {
  weight: 'Weight × reps', bodyweight: 'Bodyweight reps', assisted: 'Assisted (assistance × reps)',
  time: 'Timed hold', weight_time: 'Weight × time', cardio: 'Cardio (minutes)',
};

export function fmtSet(st, type, unit) {
  if (type === 'time') return `${st.sec ?? '–'} s`;
  if (type === 'cardio') return `${st.min ?? '–'} min${st.dist ? ` · ${st.dist}` : ''}`;
  if (type === 'weight_time') return `${fmtNum(st.w, 1)} ${unit} × ${st.sec ?? '–'} s`;
  if (type === 'bodyweight') return `${st.r ?? '–'} reps${st.w ? ` +${fmtNum(st.w, 1)}` : ''}`;
  if (st.w === null || st.w === undefined) return `${st.r ?? '–'} reps`;
  return `${fmtNum(st.w, 1)} × ${st.r ?? '–'}`;
}

/** Instructions + personal history for one exercise. */
export function exerciseInfo(exId, { compact = false } = {}) {
  const def = getExercise(exId);
  if (!def) return h('p', { class: 'muted' }, 'Exercise not found.');
  const { sessions, profile } = ctx();
  const unit = profile?.units || 'lb';
  const hist = exerciseHistory(exId, sessions, unit);
  const rec = exerciseRecords(exId, sessions, unit);

  const parts = [
    h('div', { class: 'row wrap' },
      h('span', { class: 'chip gym' }, def.group),
      h('span', { class: 'chip plain' }, def.equipment),
      def.unilateral ? h('span', { class: 'chip plain' }, 'One side at a time') : null),
    h('p', { class: 'ink-2' }, h('strong', null, 'Works: '), def.muscles),
    demoMedia(exId, def.name),
    findIt(def),
  ];
  if (def.steps?.length) parts.push(h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, 'How to do it'), h('ol', { class: 'steps' }, def.steps.map((t) => h('li', null, t)))));
  if (def.cues?.length) parts.push(h('div', { class: 'callout' }, h('strong', null, 'Cues: '), def.cues.join(' · ')));
  if (def.mistakes?.length) parts.push(h('div', { class: 'callout warn' }, h('strong', null, 'Avoid: '), def.mistakes.join(' · ')));

  if (hist.length) {
    const recRows = [];
    if (rec.heaviest) recRows.push(h('div', null, h('span', { class: 'k' }, 'Heaviest'), h('span', { class: 'v' }, `${fmtNum(rec.heaviest.w, 1)} ${unit}`)));
    if (rec.bestE1rm) recRows.push(h('div', null, h('span', { class: 'k' }, 'Est. 1-rep max'), h('span', { class: 'v' }, `${fmtNum(rec.bestE1rm.value, 0)} ${unit}`)));
    if (rec.longest) recRows.push(h('div', null, h('span', { class: 'k' }, 'Longest'), h('span', { class: 'v' }, `${rec.longest.sec} s`)));
    if (!rec.heaviest && rec.mostReps) recRows.push(h('div', null, h('span', { class: 'k' }, 'Most reps'), h('span', { class: 'v' }, String(rec.mostReps.r))));
    parts.push(h('div', { class: 'section' },
      h('div', { class: 'eyebrow' }, 'Your history'),
      recRows.length ? h('div', { class: 'kv' }, recRows) : null,
      !compact && hist.length > 1 && hist.some((x) => x.e1rm)
        ? lineChart({ points: hist.filter((x) => x.e1rm).map((x) => ({ x: x.date, y: x.e1rm })).reverse(), color: 'var(--iron)', fmt: (v) => `${fmtNum(v, 0)}` , tipFmt: (p) => `${fmtDate(p.x)}: est. 1RM ${fmtNum(p.y, 0)} ${unit}` })
        : null,
      h('div', { class: 'card flush' }, h('div', { class: 'list' }, hist.slice(0, compact ? 3 : 8).map((x) => h('div', { class: 'list-item', style: { cursor: 'default' } },
        h('div', { class: 'grow' },
          h('div', { class: 'li-title' }, fmtDate(x.date, { weekday: true })),
          h('div', { class: 'li-sub num' }, x.sets.map((st) => fmtSet(st, def.type, unit)).join(' · ')))))))));
  } else {
    parts.push(h('p', { class: 'small muted' }, 'You have not logged this exercise yet.'));
  }
  return h('div', { class: 'stack lg' }, ...parts);
}

/** "Find it in the gym": other names and what the equipment looks like. */
export function findIt(def) {
  if (!def.find && !def.aka?.length) return null;
  return h('div', { class: 'find-card' },
    h('div', { class: 'eyebrow' }, 'Find it in the gym'),
    def.aka?.length ? h('div', { class: 'stack', style: { gap: '6px' } },
      h('span', { class: 'small ink-2' }, 'Also called'),
      h('div', { class: 'row wrap', style: { gap: '6px' } }, def.aka.map((a) => h('span', { class: 'chip plain' }, a)))) : null,
    def.find ? h('p', null, h('strong', null, 'Look for: '), def.find) : null);
}

/** Matches an exercise against a search, including its other names. */
export function exerciseMatches(e, q) {
  if (!q) return true;
  return [e.name, e.muscles, e.equipment, ...(e.aka || [])].some((t) => t && t.toLowerCase().includes(q));
}

/** Small first-frame thumbnail for list rows (null when there's no photo). */
export function exThumb(exId) {
  const f = framesFor(exId);
  return f ? h('img', { class: 'ex-thumb', src: f.srcs[0], alt: '', loading: 'lazy', decoding: 'async' }) : null;
}

export function openExerciseSheet(exId) {
  const def = getExercise(exId);
  sheet(def?.name || 'Exercise', (close) => h('div', { class: 'stack lg' },
    exerciseInfo(exId, { compact: true }),
    def?.custom ? h('button', {
      class: 'btn ghost', onclick: async () => {
        const ok = await confirmDialog({ title: `Delete ${def.name}?`, message: 'Workouts you already logged keep it.', confirm: 'Delete', danger: true });
        if (!ok) return;
        store.update('custom', (c) => { c.exercises = c.exercises.filter((x) => x.id !== exId); return c; });
        close();
      },
    }, icon(ICONS.trash, 18), 'Delete this exercise') : null));
}

export function drillInfo(drillId) {
  const d = getDrill(drillId);
  if (!d) return h('p', { class: 'muted' }, 'Drill not found.');
  return h('div', { class: 'stack lg' },
    h('p', { class: 'ink-2' }, d.purpose),
    demoVideo(drillId),
    h('div', { class: 'section' }, h('div', { class: 'eyebrow' }, 'How to do it'), h('ol', { class: 'steps' }, d.steps.map((t) => h('li', null, t)))),
    h('div', { class: 'callout' }, h('strong', null, 'Focus on: '), d.cues.join(' · ')));
}

export function openDrillSheet(drillId) {
  const d = getDrill(drillId);
  sheet(d?.name || 'Drill', drillInfo(drillId));
}

/**
 * Searchable exercise picker. onPick(id). Optional `suggested` ids shown first.
 */
export function exercisePicker({ title = 'Add exercise', suggested = [], onPick }) {
  let query = '';
  let group = 'All';
  const listWrap = h('div', { class: 'card flush' });
  const renderList = () => {
    const q = query.trim().toLowerCase();
    let items = allExercises().filter((e) => (group === 'All' || e.group === group) && exerciseMatches(e, q));
    if (!q && group === 'All' && suggested.length) {
      const sug = suggested.map((id) => getExercise(id)).filter(Boolean);
      items = [...sug, ...items.filter((e) => !suggested.includes(e.id))];
    }
    fill(listWrap, h('div', { class: 'list' }, items.length ? items.slice(0, 80).map((e) => listItem({
      title: e.name,
      leading: exThumb(e.id),
      sub: `${suggested.includes(e.id) && !q ? 'Suggested · ' : ''}${e.group} · ${e.equipment}`,
      onclick: () => onPick(e.id),
      trailing: icon(ICONS.plus, 18),
    })) : h('div', { class: 'list-item muted' }, 'No matches. Add your own exercise in Learn with the + button.')));
  };
  const search = input({ id: 'ex-search', type: 'search', placeholder: 'Search exercises', oninput: (e) => { query = e.target.value; renderList(); } });
  const filters = h('div', { class: 'filter-row' }, ['All', ...GROUPS].map((g) => h('button', {
    type: 'button', 'aria-pressed': String(g === group),
    onclick: (e) => {
      group = g;
      for (const b of filters.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      renderList();
    },
  }, g)));
  renderList();
  return sheet(title, h('div', { class: 'stack' },
    h('div', { class: 'search' }, icon(ICONS.search, 18), search), filters, listWrap));
}

export function openCustomExerciseForm() {
  const name = input({ id: 'cx-name', placeholder: 'e.g. Hack Squat', autocapitalize: 'words' });
  const group = select(GROUPS.map((g) => ({ value: g, label: g })), 'Legs', { id: 'cx-group' });
  const type = select(Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })), 'weight', { id: 'cx-type' });
  const equip = select(['Machine', 'Dumbbell', 'Barbell', 'Cable', 'Bodyweight', 'Kettlebell', 'Cardio machine', 'Other'].map((v) => ({ value: v, label: v })), 'Machine', { id: 'cx-eq' });
  sheet('New exercise', (close) => h('div', { class: 'stack lg' },
    field('Name', name), h('div', { class: 'field-row' }, field('Muscle group', group), field('Equipment', equip)), field('Logged as', type),
    h('button', {
      class: 'btn pool block lg',
      onclick: () => {
        if (!name.value.trim()) { toast('Give the exercise a name'); return; }
        store.update('custom', (c) => {
          const doc = c || { templates: [], exercises: [] };
          doc.exercises = doc.exercises || [];
          doc.exercises.push({
            id: uid('x-'), name: name.value.trim(), group: group.value, equipment: equip.value, type: type.value,
            compound: false, muscles: group.value, inc: { lb: 5, kg: 2.5 }, custom: true, steps: [], cues: [], mistakes: [], alts: [],
          });
          return doc;
        });
        close();
        toast('Exercise added');
      },
    }, 'Save exercise')));
}

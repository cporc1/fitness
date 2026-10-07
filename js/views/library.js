// Exercise & swim-drill library, plus the shared exercise detail content.

import * as store from '../store.js';
import { h, icon, ICONS, fmtDate, fmtNum, fmtClock, uid, fill } from '../util.js';
import { ctx } from '../app.js';
import { GROUPS, getExercise, allExercises } from '../data/exercises.js';
import { getDrill } from '../data/swim.js';
import { framesFor } from '../data/media.js';
import { demoFrames, demoVideo } from '../media.js';
import { swimDemo, swimThumb } from '../swim-anim.js';
import { exerciseHistory, exerciseRecords } from '../stats.js';
import { routineTarget } from '../program.js';
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

/** "3 × 10–15 per side" for a workout item. */
export function targetText(item, def) {
  const unitWord = def?.type === 'time' ? ' s' : def?.type === 'cardio' ? ' min' : '';
  const [lo, hi] = item.reps;
  return `${item.sets} × ${lo === hi ? lo : `${lo}–${hi}`}${unitWord}${def?.unilateral ? ' per side' : ''}`;
}

function cueCard(cues) {
  return h('div', { class: 'cue-card' },
    h('div', { class: 'eyebrow' }, 'Focus on'),
    h('ul', { class: 'cues' }, cues.slice(0, 3).map((c) => h('li', null, c))));
}

function stepsDisclosure(steps, open = false) {
  return h('details', { class: 'disclosure', open },
    h('summary', null, `Step by step · ${steps.length} steps`),
    h('ol', { class: 'steps' }, steps.map((t) => h('li', null, t))));
}

function historyBlock(exId, def, sessions, unit) {
  const hist = exerciseHistory(exId, sessions, unit);
  if (!hist.length) return h('p', { class: 'small muted' }, 'You haven\'t logged this exercise yet.');
  const rec = exerciseRecords(exId, sessions, unit);
  const recRows = [];
  if (rec.heaviest) recRows.push(h('div', null, h('span', { class: 'k' }, 'Heaviest'), h('span', { class: 'v' }, `${fmtNum(rec.heaviest.w, 1)} ${unit}`)));
  if (rec.bestE1rm) recRows.push(h('div', null, h('span', { class: 'k' }, 'Est. 1-rep max'), h('span', { class: 'v' }, `${fmtNum(rec.bestE1rm.value, 0)} ${unit}`)));
  if (rec.longest) recRows.push(h('div', null, h('span', { class: 'k' }, 'Longest'), h('span', { class: 'v' }, `${rec.longest.sec} s`)));
  if (!rec.heaviest && rec.mostReps) recRows.push(h('div', null, h('span', { class: 'k' }, 'Most reps'), h('span', { class: 'v' }, String(rec.mostReps.r))));
  return h('div', { class: 'section' },
    h('div', { class: 'eyebrow' }, 'Your history'),
    recRows.length ? h('div', { class: 'kv' }, recRows) : null,
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, hist.slice(0, 3).map((x) => h('div', { class: 'list-item', style: { cursor: 'default' } },
      h('div', { class: 'grow' },
        h('div', { class: 'li-title' }, fmtDate(x.date, { weekday: true })),
        h('div', { class: 'li-sub num' }, x.sets.map((st) => fmtSet(st, def.type, unit)).join(' · '))))))));
}

const STRETCH_TIP = 'Ease into a mild stretch, never pain, and breathe slowly. No bouncing.';

/**
 * Everything about one exercise, most useful first: the moving photos, how to
 * find the machine, today's target, three cues, the video, then the details.
 * From a warm-up or cool-down, pass routine: { label, item } instead of item.
 */
export function exerciseInfo(exId, { item, suggestion, routine } = {}) {
  const def = getExercise(exId);
  if (!def) return h('p', { class: 'muted' }, 'Exercise not found.');
  const { sessions, profile } = ctx();
  const unit = profile?.units || 'lb';
  return h('div', { class: 'stack lg' },
    demoFrames(exId, def.name),
    h('div', { class: 'row wrap', style: { gap: '6px' } },
      h('span', { class: 'chip gym' }, def.group),
      h('span', { class: 'chip plain' }, def.equipment),
      def.unilateral ? h('span', { class: 'chip plain' }, 'One side at a time') : null),
    h('p', { class: 'small ink-2' }, h('strong', null, 'Works: '), def.muscles),
    routine ? h('div', { class: 'target-card' },
      h('div', { class: 'eyebrow' }, routine.label),
      h('div', { class: 'tc-main' }, routineTarget(routine.item)),
      routine.item.note ? h('div', { class: 'small ink-2' }, routine.item.note) : null) : null,
    !routine && item ? h('div', { class: `target-card${suggestion?.kind === 'up' ? ' up' : ''}` },
      h('div', { class: 'eyebrow' }, 'In this workout'),
      h('div', { class: 'tc-main' }, `${targetText(item, def)}${item.rest ? ` · rest ${fmtClock(item.rest)}` : ''}`),
      suggestion?.text ? h('div', { class: 'small ink-2' }, suggestion.text) : null) : null,
    def.group === 'Stretching' ? h('p', { class: 'small ink-2' }, STRETCH_TIP) : null,
    findIt(def),
    def.cues?.length ? cueCard(def.cues) : null,
    demoVideo(exId),
    def.steps?.length ? stepsDisclosure(def.steps) : null,
    def.mistakes?.length ? h('div', { class: 'callout warn' }, h('strong', null, 'Avoid: '), def.mistakes.join(' · ')) : null,
    routine || def.group === 'Stretching' ? null : historyBlock(exId, def, sessions, unit));
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

/** Rows for warm-up or cool-down items, with "Stretch" / "Warm up" labels between the parts. */
export function routineRows(items, row) {
  const out = [];
  let part = null;
  items.forEach((it, i) => {
    if (it.part && it.part !== part) {
      part = it.part;
      out.push(h('div', { class: 'list-sub' }, part === 'stretch' ? 'Stretch' : 'Warm up'));
    }
    out.push(row(it, i));
  });
  return out;
}

/** Small first-frame thumbnail for list rows (null when there's no photo). */
export function exThumb(exId) {
  const f = framesFor(exId);
  return f ? h('img', { class: 'ex-thumb', src: f.srcs[0], alt: '', loading: 'lazy', decoding: 'async' }) : null;
}

/** The exercise sheet. Opened from a workout, pass { item, suggestion } to show today's target. */
export function openExerciseSheet(exId, opts = {}) {
  const def = getExercise(exId);
  return sheet(def?.name || 'Exercise', (close) => h('div', { class: 'stack lg' },
    exerciseInfo(exId, opts),
    def?.custom ? h('button', {
      class: 'btn ghost', onclick: async () => {
        const ok = await confirmDialog({ title: `Delete ${def.name}?`, message: 'Workouts you already logged keep it.', confirm: 'Delete', danger: true });
        if (!ok) return;
        store.update('custom', (c) => { c.exercises = c.exercises.filter((x) => x.id !== exId); return c; });
        close();
      },
    }, icon(ICONS.trash, 18), 'Delete this exercise') : null));
}

/** A swim stroke or drill: video first, then what to focus on and the steps. */
export function drillInfo(drillId, { target } = {}) {
  const d = getDrill(drillId);
  if (!d) return h('p', { class: 'muted' }, 'Drill not found.');
  const demo = swimDemo(drillId, { name: d.name });
  return h('div', { class: 'stack lg' },
    demo ? h('figure', { class: 'demo-figure' }, demo, h('figcaption', { class: 'xs muted' }, 'Seen from the side, looping. Tap to pause.')) : null,
    h('p', { class: 'ink-2' }, d.purpose),
    target ? h('div', { class: 'target-card swim' }, h('div', { class: 'eyebrow' }, 'In this workout'), h('div', { class: 'tc-main' }, target)) : null,
    demoVideo(drillId),
    d.cues?.length ? cueCard(d.cues) : null,
    d.steps?.length ? stepsDisclosure(d.steps, true) : null);
}

export function openDrillSheet(drillId, opts = {}) {
  const d = getDrill(drillId);
  return sheet(d?.name || 'Drill', drillInfo(drillId, opts));
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

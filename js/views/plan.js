// Plan tab: where you are in the program, your week, the workouts in rotation,
// your own workouts, program settings, and the custom workout builder.

import * as store from '../store.js';
import { h, icon, ICONS, WEEKDAYS_SHORT, WEEKDAYS_LONG, todayISO, weekdayIndex, fmtDate, uid, toNumber, deepClone, put } from '../util.js';
import { go, back, registerRoute, render } from '../app.js';
import { PHASES, SPLITS, gymTemplatesForPhase } from '../data/plans.js';
import { SWIM_LEVELS, swimTemplateKeys, getSwimWorkout, STROKES, DRILLS } from '../data/swim.js';
import { getExercise } from '../data/exercises.js';
import { programWeek, currentPhase, PROGRAM_WEEKS, nextGymTemplate, nextSwimWorkout } from '../program.js';
import { pageHead, sectionHead, sheet, listItem, confirmDialog, toast, topbar, input, field, select, segmented } from '../ui.js';
import { exercisePicker } from './library.js';
import { describeItem } from './session-swim.js';
import { workoutSummary } from './workout.js';

function slotInfo(slot, custom) {
  if (slot === 'gym') return { kind: 'gym', short: 'Gym', long: 'Gym' };
  if (slot === 'swim') return { kind: 'swim', short: 'Swim', long: 'Swim' };
  if (slot === 'both') return { kind: 'both', short: 'Both', long: 'Gym + Swim' };
  if (slot?.startsWith('custom:')) {
    const t = custom?.templates?.find((c) => c.id === slot.slice(7));
    if (t) return { kind: t.kind, short: 'Yours', long: t.name };
  }
  return { kind: 'rest', short: 'Rest', long: 'Rest' };
}

const KIND_ICON = { gym: ICONS.dumbbell, swim: ICONS.wave, rest: ICONS.rest };

function phaseTimeline(state) {
  const week = Math.min(programWeek(state.profile), PROGRAM_WEEKS + 1);
  const active = currentPhase(state.profile);
  return h('div', { class: 'stack lg' },
    h('p', { class: 'ink-2' }, 'Twelve weeks in three phases. Each phase builds on the last, and the app moves you on automatically.'),
    h('div', { class: 'stack' }, PHASES.map((p) => h('div', { class: 'row', style: { alignItems: 'flex-start', opacity: p.id === active.id ? 1 : 0.7 } },
      h('span', { class: `chip ${p.id === active.id ? 'swim' : 'plain'}`, style: { marginTop: '2px' } }, `Wk ${p.weeks[0]}–${p.weeks[1]}`),
      h('div', { class: 'grow stack', style: { gap: '2px' } },
        h('strong', null, `${p.name}${p.id === active.id ? ' · now' : ''}`),
        h('span', { class: 'small ink-2' }, p.summary),
        p.id === active.id ? h('span', { class: 'small muted' }, p.effort) : null)))),
    week > PROGRAM_WEEKS ? h('div', { class: 'callout' }, 'You finished all 12 weeks. Keep going in Phase 3, or restart from week 1 in Program below with your new, heavier weights.') : null,
    h('button', { class: 'btn ghost', onclick: () => go('guide', { id: 'start' }) }, 'Read "Start here: how this plan works"'));
}

function programCard(state) {
  const week = Math.min(programWeek(state.profile), PROGRAM_WEEKS + 1);
  const active = currentPhase(state.profile);
  return h('button', { class: 'program-card', type: 'button', onclick: () => sheet('About the program', phaseTimeline(state)) },
    h('div', { class: 'row between' },
      h('span', { class: 'eyebrow' }, week > PROGRAM_WEEKS ? 'Plan complete' : `Week ${week} of ${PROGRAM_WEEKS}`),
      h('span', { class: 'pc-link' }, 'About the program', icon(ICONS.chevron, 14))),
    h('div', { class: 'pc-title' }, `Phase ${active.id}: ${active.name}`),
    h('p', { class: 'small ink-2' }, active.summary),
    h('div', { class: 'pc-bar', 'aria-hidden': 'true' }, Array.from({ length: PROGRAM_WEEKS }, (_, i) => h('span', {
      class: i + 1 < week ? 'done' : i + 1 === week ? 'now' : '',
    }))),
    state.profile?.phaseOverride ? h('span', { class: 'chip plain', style: { alignSelf: 'flex-start' } }, 'Phase set manually') : null);
}

function weekChips(state) {
  const days = state.schedule?.days || Array(7).fill('rest');
  const todayIdx = weekdayIndex(todayISO());
  return h('div', { class: 'day-chips' }, days.map((slot, i) => {
    const info = slotInfo(slot, state.custom);
    const mark = info.kind === 'both'
      ? h('span', { class: 'both-icons' }, icon(ICONS.dumbbell, 13), icon(ICONS.wave, 13))
      : icon(KIND_ICON[info.kind] || ICONS.dumbbell, 18);
    return h('button', {
      class: `day-chip ${info.kind}${i === todayIdx ? ' is-today' : ''}`, type: 'button',
      'aria-label': `${WEEKDAYS_LONG[i]}: ${info.long}. Change`, onclick: () => editDay(i, state),
    }, h('span', { class: 'dc-day' }, WEEKDAYS_SHORT[i]), h('span', { class: 'dc-mark' }, mark), h('span', { class: 'dc-kind' }, info.short));
  }));
}

function editDay(i, state) {
  const choose = (value, close) => {
    store.update('schedule', (s) => {
      const doc = s || { days: Array(7).fill('rest') };
      doc.days[i] = value;
      return doc;
    });
    close();
  };
  sheet(WEEKDAYS_LONG[i], (close) => h('div', { class: 'card flush' }, h('div', { class: 'list' },
    listItem({ title: 'Gym', sub: 'Next program gym session', leading: h('span', { class: 'chip gym' }, 'Gym'), onclick: () => choose('gym', close), trailing: null }),
    listItem({ title: 'Swim', sub: 'Next program swim (technique / endurance)', leading: h('span', { class: 'chip swim' }, 'Swim'), onclick: () => choose('swim', close), trailing: null }),
    listItem({ title: 'Gym + Swim', sub: 'Both on the same day: lift first, then swim', leading: h('span', { class: 'chip both' }, 'Both'), onclick: () => choose('both', close), trailing: null }),
    ...(state.custom?.templates || []).map((t) => listItem({ title: t.name, sub: 'Your workout', leading: h('span', { class: `chip ${t.kind}` }, t.kind === 'swim' ? 'Swim' : 'Gym'), onclick: () => choose(`custom:${t.id}`, close), trailing: null })),
    listItem({ title: 'Rest', sub: 'Recovery day', leading: h('span', { class: 'chip' }, 'Rest'), onclick: () => choose('rest', close), trailing: null }))));
}

function workoutCard(state, t, badge) {
  const sum = workoutSummary(t, state);
  return h('button', { class: `rot-card ${sum.kind}`, type: 'button', onclick: () => go('workout', { id: t.id }) },
    h('span', { class: 'rot-top' },
      h('span', { class: `sr-icon ${sum.kind}` }, icon(sum.kind === 'swim' ? ICONS.wave : ICONS.dumbbell)),
      badge ? h('span', { class: 'chip good' }, badge) : null),
    h('span', { class: 'rot-name' }, t.name),
    h('span', { class: 'rot-sub' }, sum.kind === 'swim'
      ? (sum.dist ? `${sum.dist} ${sum.unitD}` : 'Skills session')
      : `${sum.items.length} exercises · ~${sum.minutes} min`));
}

function rotation(state) {
  const phase = currentPhase(state.profile);
  const split = state.profile?.split || 'full';
  const mode = state.settings?.swimMode || 'full';
  const nextGym = nextGymTemplate(state.sessions, phase.id, split);
  const nextSwim = nextSwimWorkout(state.sessions, state.profile?.swimLevel, phase.id, mode);
  const gym = gymTemplatesForPhase(phase.id, split);
  const swim = swimTemplateKeys(state.profile?.swimLevel || 'novice', phase.id).map((k) => getSwimWorkout(k, mode));
  return h('div', { class: 'hscroll' },
    gym.map((t) => workoutCard(state, t, t.id === nextGym.id ? 'Up next' : null)),
    swim.map((w) => workoutCard(state, w, w.id === nextSwim?.id ? 'Up next' : null)));
}

function customCards(state) {
  const items = state.custom?.templates || [];
  return h('div', { class: 'hscroll' },
    h('button', { class: 'rot-card create', type: 'button', onclick: () => go('builder', {}) },
      h('span', { class: 'sr-icon other' }, icon(ICONS.plus)),
      h('span', { class: 'rot-name' }, 'Create a workout'),
      h('span', { class: 'rot-sub' }, 'Your own gym or swim session')),
    items.map((t) => workoutCard(state, t, null)));
}

function programSettings(state) {
  const p = state.profile || {};
  const level = SWIM_LEVELS.find((l) => l.id === p.swimLevel) || SWIM_LEVELS[1];
  const swapCount = Object.keys(state.swaps || {}).length;
  return h('div', { class: 'card flush' }, h('div', { class: 'list' },
    listItem({ title: 'Gym program', sub: (SPLITS.find((x) => x.id === (p.split || 'full')) || SPLITS[0]).name, onclick: () => editSplit(state) }),
    listItem({ title: 'Swim level', sub: level.name, onclick: () => editSwimLevel(p) }),
    listItem({ title: 'Swim workouts', sub: state.settings?.swimMode === 'simple' ? 'Simple: freestyle, breaststroke, kickboard' : 'With technique drills', onclick: () => editSwimMode(state) }),
    listItem({ title: 'Phase', sub: p.phaseOverride ? `Fixed at Phase ${p.phaseOverride}` : 'Automatic (follows the week)', onclick: () => editPhase(p) }),
    listItem({ title: 'Restart the plan', sub: `Started ${fmtDate(p.startDate || todayISO())}. Restart from week 1 today.`, onclick: () => restartPlan() }),
    swapCount ? listItem({ title: 'Exercise swaps', sub: `${swapCount} permanent ${swapCount === 1 ? 'swap' : 'swaps'}`, onclick: () => editSwaps(state) }) : null));
}

function editSwimLevel(p) {
  sheet('Swim level', (close) => h('div', { class: 'choice-grid' }, SWIM_LEVELS.map((l) => h('button', {
    class: 'choice', 'aria-pressed': String(p.swimLevel === l.id),
    onclick: () => { store.update('profile', (x) => ({ ...x, swimLevel: l.id })); close(); },
  }, h('span', { class: 'c-title' }, l.name), h('span', { class: 'c-sub' }, l.desc)))));
}

function gymDaysPerWeek(schedule) {
  return (schedule?.days || []).filter((d) => d === 'gym' || d === 'both').length;
}

function editSplit(state) {
  const cur = state.profile?.split || 'full';
  const gymDays = gymDaysPerWeek(state.schedule);
  const recommended = gymDays >= 4 ? 'upper-lower' : 'full';
  sheet('Gym program', (close) => h('div', { class: 'stack lg' },
    h('p', { class: 'small ink-2' }, `You have ${gymDays} gym ${gymDays === 1 ? 'day' : 'days'} a week. Each muscle grows best when trained about twice a week, so ${recommended === 'full' ? 'full body fits your week best' : 'upper / lower fits your week best'}.`),
    h('div', { class: 'choice-grid' }, SPLITS.map((o) => h('button', {
      class: 'choice', 'aria-pressed': String(cur === o.id),
      onclick: () => { store.update('profile', (x) => ({ ...x, split: o.id })); close(); },
    }, h('span', { class: 'c-title' }, `${o.name}${o.id === recommended ? ' · recommended' : ''}`), h('span', { class: 'c-sub' }, o.sub))))));
}

function editSwimMode(state) {
  const cur = state.settings?.swimMode || 'full';
  const opts = [
    { id: 'simple', name: 'Simple', sub: 'Just freestyle, breaststroke and a kickboard. No technique drills.' },
    { id: 'full', name: 'With technique drills', sub: 'Adds short drills that improve your stroke faster. Each one has a how-to video.' },
  ];
  sheet('Swim workouts', (close) => h('div', { class: 'choice-grid' }, opts.map((o) => h('button', {
    class: 'choice', 'aria-pressed': String(cur === o.id),
    onclick: () => { store.update('settings', (x) => ({ ...x, swimMode: o.id })); close(); },
  }, h('span', { class: 'c-title' }, o.name), h('span', { class: 'c-sub' }, o.sub)))));
}

function editPhase(p) {
  const opts = [{ id: 0, name: 'Automatic', sub: 'Moves with the calendar: weeks 1–4, 5–8, 9–12' }, ...PHASES.map((ph) => ({ id: ph.id, name: `Phase ${ph.id}: ${ph.name}`, sub: ph.summary }))];
  sheet('Phase', (close) => h('div', { class: 'choice-grid' }, opts.map((o) => h('button', {
    class: 'choice', 'aria-pressed': String((p.phaseOverride || 0) === o.id),
    onclick: () => { store.update('profile', (x) => ({ ...x, phaseOverride: o.id || null })); close(); },
  }, h('span', { class: 'c-title' }, o.name), h('span', { class: 'c-sub' }, o.sub)))));
}

async function restartPlan() {
  const ok = await confirmDialog({ title: 'Restart from week 1?', message: 'Your logged workouts and weights stay. Only the week counter resets, so the plan starts again at Phase 1 with your current weights.', confirm: 'Restart' });
  if (!ok) return;
  store.update('profile', (x) => ({ ...x, startDate: todayISO(), phaseOverride: null }));
  toast('Plan restarted at week 1');
}

function editSwaps(state) {
  sheet('Exercise swaps', (close) => h('div', { class: 'stack' },
    h('p', { class: 'small muted' }, 'These replacements apply every time the program calls for the original exercise.'),
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, Object.entries(state.swaps || {}).map(([from, to]) => listItem({
      title: `${getExercise(from)?.name || from} → ${getExercise(to)?.name || to}`, sub: 'Tap to remove',
      trailing: icon(ICONS.trash, 18),
      onclick: () => { store.update('swaps', (sw) => { delete sw[from]; return sw; }); close(); },
    }))))));
}

registerRoute('plan', (_p, state) => h('div', { class: 'view' },
  pageHead('Plan', '12-week gym + swim program'),
  programCard(state),
  h('section', { class: 'section' },
    sectionHead('Your week'),
    weekChips(state),
    h('p', { class: 'xs muted' }, 'Tap a day to change it. Program days pick the right workout automatically.')),
  h('section', { class: 'section' }, sectionHead('Workouts in rotation'), rotation(state)),
  h('section', { class: 'section' }, sectionHead('Your workouts'), customCards(state)),
  h('section', { class: 'section' }, sectionHead('Program'), programSettings(state))));

// ---------------- builder ----------------

const builderDrafts = new Map();

registerRoute('builder', ({ id }, state) => {
  const key = id || 'new';
  if (!builderDrafts.has(key)) {
    const existing = id ? state.custom?.templates?.find((t) => t.id === id) : null;
    builderDrafts.set(key, existing ? deepClone(existing) : { id: uid('t-'), kind: 'gym', name: '', exercises: [], blocks: [] });
  }
  const d = builderDrafts.get(key);
  const unitD = state.profile?.pool?.unit || 'yd';
  const view = h('div', { class: 'view' });
  const redraw = () => render();

  const nameInput = input({ id: 'b-name', value: d.name, placeholder: d.kind === 'swim' ? 'e.g. Saturday long swim' : 'e.g. Upper body + core', oninput: (e) => { d.name = e.target.value; } });

  put(view, 
    topbar({ title: id ? 'Edit workout' : 'New workout', onBack: () => { builderDrafts.delete(key); back(); } }),
    field('Name', nameInput),
    id ? null : segmented([{ value: 'gym', label: 'Gym' }, { value: 'swim', label: 'Swim' }], d.kind, (v) => { d.kind = v; redraw(); }, 'Workout type'));

  const num = (obj, k, label, opts = {}) => input({
    id: `${label}-${Math.random().toString(36).slice(2, 7)}`, inputmode: 'numeric', value: obj[k] ?? '', 'aria-label': label,
    style: { textAlign: 'center', padding: '8px 4px' }, ...opts,
    oninput: (e) => { obj[k] = toNumber(e.target.value); },
  });

  if (d.kind === 'gym') {
    d.exercises.forEach((item, i) => {
      const def = getExercise(item.ex);
      const repsObj = { lo: item.reps[0], hi: item.reps[1] };
      const lo = num(repsObj, 'lo', 'Reps from', { oninput: (e) => { item.reps[0] = toNumber(e.target.value) || 1; } });
      const hi = num(repsObj, 'hi', 'Reps to', { oninput: (e) => { item.reps[1] = toNumber(e.target.value) || item.reps[0]; } });
      put(view, h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('strong', { class: 'grow' }, def?.name || item.ex),
          i > 0 ? h('button', { class: 'icon-btn sm', 'aria-label': 'Move up', onclick: () => { d.exercises.splice(i - 1, 0, d.exercises.splice(i, 1)[0]); redraw(); } }, icon(['M12 19V5', 'M5 12l7-7 7 7'], 18)) : null,
          h('button', { class: 'icon-btn sm', 'aria-label': 'Remove', onclick: () => { d.exercises.splice(i, 1); redraw(); } }, icon(ICONS.trash, 18))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' } },
          field('Sets', num(item, 'sets', 'Sets')), field('Reps from', lo), field('to', hi), field('Rest (s)', num(item, 'rest', 'Rest seconds')))));
    });
    put(view, h('button', {
      class: 'btn quiet block', onclick: () => {
        const picker = exercisePicker({
          onPick: (exId) => {
            picker.close();
            const def = getExercise(exId);
            d.exercises.push({ ex: exId, sets: 3, reps: def?.type === 'time' ? [20, 40] : [8, 12], rest: def?.compound ? 120 : 75 });
            redraw();
          },
        });
      },
    }, icon(ICONS.plus, 18), 'Add exercise'));
  } else {
    const blockNames = ['Warm-up', 'Drills', 'Kick', 'Main set', 'Cool-down'];
    const flat = [];
    for (const b of d.blocks) for (const it of b.items) flat.push({ block: b.name, it });
    flat.forEach(({ block, it }, i) => {
      const strokeSel = select(Object.entries(STROKES).map(([value, label]) => ({ value, label })), it.stroke || 'Free', { id: `st-${i}`, onchange: (e) => { it.stroke = e.target.value; } });
      const drillSel = select([{ value: '', label: 'No drill' }, ...DRILLS.map((dr) => ({ value: dr.id, label: dr.name }))], it.drill || '', { id: `dr-${i}`, onchange: (e) => { it.drill = e.target.value || undefined; } });
      const blockSel = select(blockNames.map((n) => ({ value: n, label: n })), block, {
        id: `bl-${i}`, onchange: (e) => { moveItem(d, it, e.target.value); redraw(); },
      });
      put(view, h('div', { class: 'card' },
        h('div', { class: 'row' }, h('strong', { class: 'grow' }, `${it.reps || '?'} × ${describeItem(it, unitD)}`),
          h('button', { class: 'icon-btn sm', 'aria-label': 'Remove', onclick: () => { removeItem(d, it); redraw(); } }, icon(ICONS.trash, 18))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } },
          field('Reps', num(it, 'reps', 'Reps')), field(`Distance (${unitD})`, num(it, 'dist', 'Distance')), field('Rest (s)', num(it, 'rest', 'Rest'))),
        h('div', { class: 'field-row' }, field('Section', blockSel), field('Stroke', strokeSel)),
        field('Drill (optional)', drillSel)));
    });
    put(view, h('button', {
      class: 'btn quiet block', onclick: () => {
        const last = flat[flat.length - 1];
        const blockName = last ? last.block : 'Warm-up';
        let b = d.blocks.find((x) => x.name === blockName);
        if (!b) { b = { name: blockName, items: [] }; d.blocks.push(b); }
        b.items.push({ reps: 4, dist: 50, stroke: 'Free', rest: 30 });
        redraw();
      },
    }, icon(ICONS.plus, 18), 'Add set'));
  }

  put(view, h('button', {
    class: `btn ${d.kind === 'swim' ? 'pool' : 'iron'} lg block`,
    onclick: () => {
      if (!d.name.trim()) { toast('Give your workout a name'); return; }
      if (d.kind === 'gym' && !d.exercises.length) { toast('Add at least one exercise'); return; }
      if (d.kind === 'swim' && !d.blocks.some((b) => b.items.length)) { toast('Add at least one set'); return; }
      const clean = d.kind === 'gym'
        ? { id: d.id, kind: 'gym', name: d.name.trim(), exercises: d.exercises.map((x) => ({ ...x, sets: Math.max(1, x.sets || 1), reps: [x.reps[0] || 8, Math.max(x.reps[0] || 8, x.reps[1] || 12)] })) }
        : { id: d.id, kind: 'swim', name: d.name.trim(), focus: '', blocks: orderBlocks(d.blocks).map((b) => ({ name: b.name, items: b.items.map((x) => ({ ...x, reps: Math.max(1, x.reps || 1), dist: x.dist || undefined, rest: x.rest || 0 })) })) };
      store.update('custom', (c) => {
        const doc = c || { templates: [], exercises: [] };
        doc.templates = doc.templates || [];
        const i = doc.templates.findIndex((t) => t.id === clean.id);
        if (i >= 0) doc.templates[i] = clean; else doc.templates.push(clean);
        return doc;
      });
      builderDrafts.delete(key);
      toast('Workout saved');
      back();
    },
  }, 'Save workout'));
  return view;
});

const BLOCK_ORDER = ['Warm-up', 'Drills', 'Kick', 'Main set', 'Cool-down'];
function orderBlocks(blocks) {
  return blocks.filter((b) => b.items.length).sort((a, b) => BLOCK_ORDER.indexOf(a.name) - BLOCK_ORDER.indexOf(b.name));
}
function removeItem(d, it) {
  for (const b of d.blocks) b.items = b.items.filter((x) => x !== it);
}
function moveItem(d, it, blockName) {
  removeItem(d, it);
  let b = d.blocks.find((x) => x.name === blockName);
  if (!b) { b = { name: blockName, items: [] }; d.blocks.push(b); }
  b.items.push(it);
  d.blocks = orderBlocks(d.blocks);
}

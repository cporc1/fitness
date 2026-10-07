// Plan tab: phases, weekly schedule, workout templates, custom workout builder.

import * as store from '../store.js';
import { h, icon, ICONS, WEEKDAYS_LONG, todayISO, fmtDate, uid, toNumber, deepClone, fmtClock, put, fill } from '../util.js';
import { ctx, go, back, registerRoute, render } from '../app.js';
import { PHASES, SPLITS, gymTemplatesForPhase, WARMUP_GYM, COOLDOWN_GYM } from '../data/plans.js';
import { SWIM_LEVELS, swimTemplateKeys, getSwimWorkout, expandForPool, workoutDistance, STROKES, getDrill, DRILLS, guideForItem } from '../data/swim.js';
import { getExercise } from '../data/exercises.js';
import { programWeek, currentPhase, PROGRAM_WEEKS, templateById } from '../program.js';
import { startGym, startSwim } from '../actions.js';
import { pageHead, sectionHead, sheet, listItem, confirmDialog, toast, topbar, input, field, select, segmented } from '../ui.js';
import { exercisePicker, exThumb, openExerciseSheet, openDrillSheet } from './library.js';
import { describeItem, howToLink } from './session-swim.js';

function slotLabel(slot, custom) {
  if (slot === 'gym') return ['gym', 'Gym · program'];
  if (slot === 'swim') return ['swim', 'Swim · program'];
  if (slot === 'both') return ['both', 'Gym + Swim'];
  if (slot?.startsWith('custom:')) {
    const t = custom?.templates?.find((c) => c.id === slot.slice(7));
    if (t) return [t.kind, t.name];
  }
  return ['', 'Rest'];
}

function phaseTimeline(state) {
  const week = Math.min(programWeek(state.profile), PROGRAM_WEEKS + 1);
  const active = currentPhase(state.profile);
  return h('div', { class: 'card' },
    h('div', { class: 'row between' },
      h('div', { class: 'eyebrow' }, week > PROGRAM_WEEKS ? 'Plan complete' : `Week ${week} of ${PROGRAM_WEEKS}`),
      state.profile?.phaseOverride ? h('span', { class: 'chip plain' }, 'Phase set manually') : null),
    h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${PROGRAM_WEEKS}, 1fr)`, gap: '3px' }, 'aria-hidden': 'true' },
      Array.from({ length: PROGRAM_WEEKS }, (_, i) => h('span', {
        style: {
          height: '8px', borderRadius: '4px',
          background: i + 1 < week ? 'var(--good)' : i + 1 === week ? 'var(--pool)' : 'var(--surface-2)',
        },
      }))),
    h('div', { class: 'stack' }, PHASES.map((p) => h('div', { class: 'row', style: { alignItems: 'flex-start', opacity: p.id === active.id ? 1 : 0.6 } },
      h('span', { class: `chip ${p.id === active.id ? 'swim' : 'plain'}`, style: { marginTop: '2px' } }, `Wk ${p.weeks[0]}–${p.weeks[1]}`),
      h('div', { class: 'grow stack', style: { gap: '2px' } },
        h('strong', null, `${p.name}${p.id === active.id ? ' · now' : ''}`),
        h('span', { class: 'small ink-2' }, p.summary),
        p.id === active.id ? h('span', { class: 'small muted' }, p.effort) : null)))));
}

function scheduleCard(state) {
  const days = state.schedule?.days || Array(7).fill('rest');
  return h('div', { class: 'card flush' }, h('div', { class: 'list' }, days.map((slot, i) => {
    const [kind, label] = slotLabel(slot, state.custom);
    return h('button', { class: 'list-item', type: 'button', onclick: () => editDay(i, state) },
      h('span', { style: { width: '92px', fontWeight: 600 } }, WEEKDAYS_LONG[i]),
      h('span', { class: 'grow' }, kind ? h('span', { class: `chip ${kind}` }, label) : h('span', { class: 'muted' }, label)),
      icon(ICONS.chevron, 18));
  })));
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

function workoutsThisPhase(state) {
  const phase = currentPhase(state.profile);
  const poolLen = state.profile?.pool?.len || 25;
  const unitD = state.profile?.pool?.unit || 'yd';
  const gym = gymTemplatesForPhase(phase.id, state.profile?.split).map((t) => listItem({
    title: t.name, sub: `${t.exercises.length} exercises · ${t.focus}`,
    leading: h('span', { class: 'sr-icon gym' }, icon(ICONS.dumbbell)),
    onclick: () => go('workout', { id: t.id }),
  }));
  const swim = swimTemplateKeys(state.profile?.swimLevel || 'novice', phase.id).map((k) => {
    const w = getSwimWorkout(k, state.settings?.swimMode || 'full');
    const dist = workoutDistance(expandForPool(w.blocks, poolLen));
    return listItem({
      title: w.name, sub: `${dist ? `${dist} ${unitD} · ` : ''}${w.focus}`,
      leading: h('span', { class: 'sr-icon swim' }, icon(ICONS.wave)),
      onclick: () => go('workout', { id: w.id }),
    });
  });
  return h('div', { class: 'card flush session-row' }, h('div', { class: 'list' }, gym, swim));
}

function customList(state) {
  const items = state.custom?.templates || [];
  return h('div', { class: 'card flush session-row' }, h('div', { class: 'list' },
    items.map((t) => listItem({
      title: t.name, sub: t.kind === 'swim' ? 'Swim' : `${t.exercises.length} exercises`,
      leading: h('span', { class: `sr-icon ${t.kind}` }, icon(t.kind === 'swim' ? ICONS.wave : ICONS.dumbbell)),
      onclick: () => go('workout', { id: t.id }),
    })),
    listItem({ title: 'Create a workout', sub: 'Build your own gym or swim session', leading: h('span', { class: 'sr-icon other' }, icon(ICONS.plus)), onclick: () => go('builder', {}) })));
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
  phaseTimeline(state),
  h('section', { class: 'section' }, sectionHead('Your week'), h('p', { class: 'small muted' }, 'Tap a day to change it. Program days pick the right session automatically.'), scheduleCard(state)),
  h('section', { class: 'section' }, sectionHead('This phase'), workoutsThisPhase(state)),
  h('section', { class: 'section' }, sectionHead('Your workouts'), customList(state)),
  h('section', { class: 'section' }, sectionHead('Program settings'), programSettings(state))));

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

// Live gym workout logger (also used to edit a saved gym session).
// Two views of the same data: List (every exercise as a card, the default)
// and Focus (one exercise per page, swipe between them, − / + steppers so you
// never need the keyboard). The toggle sits in the top bar.

import * as store from '../store.js';
import { h, icon, ICONS, fmtClock, fmtNum, toNumber, fmtDate, debounce, put, fill } from '../util.js';
import { ctx, back, tab, registerRoute, go, render } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { WARMUP_GYM, COOLDOWN_GYM } from '../data/plans.js';
import { exerciseEntry, stepWeight } from '../program.js';
import { finishSession, discardActive, saveActive } from '../actions.js';
import { exercisePicker, openExerciseSheet, fmtSet, exThumb } from './library.js';
import { demoFrames } from '../media.js';
import { sheet, toast } from '../ui.js';
import { reducedMotion } from '../motion.js';
import { startRest, stopRest, restBar, paceClock, onRestChange, restState } from '../timer.js';

const SUGG_CHIP = {
  up: ['good', 'Add weight'], same: ['plain', 'Same weight'], down: ['danger', 'Go lighter'],
  new: ['plain', 'First time'], reps: ['good', 'Level up'],
};

const LIST_ICON = ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'];
const FOCUS_ICON = ['M4 5h16v14H4z', 'M9 19V5', 'M15 19V5'];

function columnsFor(type, unit) {
  switch (type) {
    case 'time': return { cls: 'timed', cols: ['Set', 'Previous', 'Sec', ''] };
    case 'cardio': return { cls: 'cardio', cols: ['Set', 'Min', 'Dist', ''] };
    case 'bodyweight': return { cls: 'timed', cols: ['Set', 'Previous', 'Reps', ''] };
    case 'weight_time': return { cls: '', cols: ['Set', 'Previous', unit, 'Sec', ''] };
    case 'assisted': return { cls: '', cols: ['Set', 'Previous', `Assist ${unit}`, 'Reps', ''] };
    default: return { cls: '', cols: ['Set', 'Previous', unit, 'Reps', ''] };
  }
}

function defaultRest(entry, settings) {
  if (entry.target?.rest) return entry.target.rest;
  const def = getExercise(entry.ex);
  return def?.compound ? (settings?.restCompound || 120) : (settings?.restIsolation || 75);
}

const usesWeight = (type) => ['weight', 'assisted', 'weight_time'].includes(type);
const usesReps = (type) => ['weight', 'assisted', 'bodyweight'].includes(type);

/**
 * mode 'live' edits the active session; mode 'edit' edits a saved one.
 */
function sessionEditor(session, mode) {
  const { settings, profile } = ctx();
  const unit = session.unit || profile?.units || 'lb';
  const live = mode === 'live';
  const focus = live && session.view === 'focus';
  const persist = live ? debounce(() => saveActive(session), 250) : () => {};
  const persistNow = live ? () => saveActive(session) : () => {};

  const view = h('div', { class: `view full${focus ? ' focus-mode' : ''}`, 'data-full': 'true' });
  const cardsWrap = h('div', { class: 'stack lg' });
  const progressFill = h('span');
  const clockEl = h('span', { class: 'sh-clock' });

  function updateProgress() {
    const total = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const done = session.exercises.reduce((n, ex) => n + ex.sets.filter((st) => st.done).length, 0);
    progressFill.style.width = total ? `${(done / total) * 100}%` : '0%';
    clockEl.textContent = live
      ? `${fmtClock((Date.now() - new Date(session.startedAt)) / 1000)} · ${done}/${total} sets`
      : `${fmtDate(session.date, { weekday: true })} · ${done}/${total} sets`;
  }

  // Redraw whatever view is showing after the exercises change.
  function refreshAll() { if (focus) drawPager(); else rerenderCards(); }
  function refreshOne(i) { if (focus) refreshPage(i); else refreshCard(i); }

  function rerenderCards() {
    fill(cardsWrap, ...session.exercises.map((ex, i) => exerciseCard(ex, i)));
    updateProgress();
  }

  function refreshCard(i) {
    const old = cardsWrap.children[i];
    if (old) old.replaceWith(exerciseCard(session.exercises[i], i));
    updateProgress();
  }

  function setInput(entry, st, key, { placeholder, label, decimal = true }) {
    return h('input', {
      class: 'set-input', type: 'text', inputmode: decimal ? 'decimal' : 'numeric', enterkeyhint: 'done',
      value: st[key] ?? '', placeholder: placeholder ?? '', 'aria-label': label,
      onfocus: (e) => e.target.select(),
      oninput: (e) => { st[key] = toNumber(e.target.value); persist(); },
    });
  }

  function prevFor(entry, i) {
    const last = entry.suggestion?.last;
    if (!last?.sets?.length) return '—';
    const st = last.sets[i] || last.sets[last.sets.length - 1];
    return fmtSet(st, entry.type, unit);
  }

  /** Fill blanks from the suggestion, so one tap logs the planned set. */
  function fillBlanks(entry, st) {
    const sugg = entry.suggestion || {};
    if (usesWeight(entry.type) && st.w == null && sugg.weight != null) st.w = sugg.weight;
    if (usesReps(entry.type) && st.r == null) st.r = sugg.reps ?? entry.target.reps[0];
    if (entry.type === 'time' && st.sec == null) st.sec = sugg.reps ?? entry.target.reps[0];
    if (entry.type === 'weight_time' && st.sec == null) st.sec = entry.target.reps[0];
    if (entry.type === 'cardio' && st.min == null) st.min = entry.target.reps[0];
  }

  /** Tick or untick a set; starts the rest timer when a set is completed. */
  function toggleSet(entry, i, si) {
    const st = entry.sets[si];
    if (!st.done) {
      fillBlanks(entry, st);
      st.done = true;
      const next = entry.sets[si + 1];
      if (next && !next.done && st.w != null && next.w == null) next.w = st.w;
      if (live && si < entry.sets.length - 1) {
        startRest(defaultRest(entry, settings), { label: `Rest · next: set ${si + 2}`, kind: 'gym' });
      } else if (live) {
        const nextEx = session.exercises[i + 1];
        if (nextEx) startRest(defaultRest(entry, settings), { label: `Rest · next: ${getExercise(nextEx.ex)?.name || 'exercise'}`, kind: 'gym' });
        else stopRest();
      }
    } else {
      st.done = false;
    }
    persistNow();
    refreshOne(i);
  }

  function exerciseMenu(entry, i) {
    const def = getExercise(entry.ex);
    sheet(def?.name || 'Exercise', (close) => h('div', { class: 'card flush' }, h('div', { class: 'list' },
      menuItem(ICONS.info, 'How to do it', () => { close(); openExerciseSheet(entry.ex, { item: entry.target, suggestion: entry.suggestion }); }),
      menuItem(ICONS.swap, 'Swap exercise', () => { close(); openSwap(entry, i); }),
      i > 0 ? menuItem(ICONS.back, 'Move earlier', () => { close(); move(i, -1); }) : null,
      i < session.exercises.length - 1 ? menuItem(ICONS.chevron, 'Move later', () => { close(); move(i, 1); }) : null,
      menuItem(ICONS.trash, 'Remove from this workout', () => {
        close();
        session.exercises.splice(i, 1);
        persistNow();
        refreshAll();
      }))));
  }

  function move(i, d) {
    const [x] = session.exercises.splice(i, 1);
    session.exercises.splice(i + d, 0, x);
    if (focus) session.focusIndex = i + d + 1;
    persistNow();
    refreshAll();
  }

  function openSwap(entry, i) {
    const def = getExercise(entry.ex);
    let always = false;
    const picker = exercisePicker({
      title: 'Swap for…',
      suggested: def?.alts || [],
      onPick: (newId) => {
        picker.close();
        const { sessions } = ctx();
        const replacement = { ...exerciseEntry(newId, entry.target, sessions, unit), orig: entry.orig || entry.ex };
        session.exercises[i] = replacement;
        if (always && entry.orig) store.update('swaps', (sw) => ({ ...(sw || {}), [entry.orig]: newId }), { silent: true });
        persistNow();
        refreshAll();
        toast(always ? 'Swapped for this and future workouts' : 'Swapped for today');
      },
    });
    if (entry.orig) {
      const check = h('label', { class: 'check-row' },
        h('input', { type: 'checkbox', id: 'swap-always', onchange: (e) => { always = e.target.checked; } }),
        h('span', null, 'Always use the new exercise in my plan'));
      picker.body.prepend(check);
    }
  }

  function targetLine(entry) {
    const def = getExercise(entry.ex);
    const [lo, hi] = entry.target.reps;
    const repWord = entry.type === 'time' ? 's' : entry.type === 'cardio' ? 'min' : entry.type === 'weight_time' ? 's' : 'reps';
    return `${entry.sets.length} × ${lo === hi ? lo : `${lo}–${hi}`} ${repWord}${def?.unilateral ? ' per side' : ''} · rest ${fmtClock(defaultRest(entry, settings))}`;
  }

  function addSet(entry, i) {
    const lastSet = entry.sets[entry.sets.length - 1];
    entry.sets.push({ ...(lastSet ? { w: lastSet.w ?? null } : {}), done: false });
    persistNow();
    refreshOne(i);
  }

  // ---------------- list view ----------------

  function exerciseCard(entry, i) {
    const def = getExercise(entry.ex);
    const { cls, cols } = columnsFor(entry.type, unit);
    const sugg = entry.suggestion;
    const allDone = entry.sets.length && entry.sets.every((st) => st.done);
    const [lo] = entry.target.reps;

    const rows = entry.sets.map((st, si) => {
      const cells = [h('div', { class: 'set-no' }, String(si + 1))];
      if (entry.type === 'cardio') {
        cells.push(setInput(entry, st, 'min', { placeholder: String(lo), label: `Set ${si + 1} minutes` }));
        cells.push(setInput(entry, st, 'dist', { placeholder: 'opt.', label: `Set ${si + 1} distance` }));
      } else {
        cells.push(h('div', { class: 'prev' }, prevFor(entry, si)));
        if (usesWeight(entry.type)) {
          cells.push(setInput(entry, st, 'w', { placeholder: sugg?.weight != null ? fmtNum(sugg.weight, 1) : unit, label: `Set ${si + 1} weight` }));
        }
        if (entry.type === 'time' || entry.type === 'weight_time') {
          cells.push(setInput(entry, st, 'sec', { placeholder: String(sugg?.reps ?? lo), label: `Set ${si + 1} seconds`, decimal: false }));
        } else {
          cells.push(setInput(entry, st, 'r', { placeholder: String(sugg?.reps ?? lo), label: `Set ${si + 1} reps`, decimal: false }));
        }
      }
      cells.push(h('button', {
        class: 'set-check', type: 'button', 'aria-label': st.done ? `Undo set ${si + 1}` : `Complete set ${si + 1}`, 'aria-pressed': String(!!st.done),
        onclick: () => toggleSet(entry, i, si),
      }, icon(ICONS.check, 22)));
      return h('div', { class: `set-row ${cls}${st.done ? ' done' : ''}` }, cells);
    });

    const chip = sugg ? SUGG_CHIP[sugg.kind] : null;
    return h('article', { class: `ex-card${allDone ? ' complete' : ''}` },
      h('div', { class: 'ex-head' },
        exThumb(entry.ex) ? h('button', { style: { all: 'unset', cursor: 'pointer' }, 'aria-label': `Photo and how-to for ${def?.name}`, onclick: () => openExerciseSheet(entry.ex, { item: entry.target, suggestion: sugg }) }, exThumb(entry.ex)) : null,
        h('div', { class: 'grow stack', style: { gap: '2px' } },
          h('button', { style: { all: 'unset', cursor: 'pointer' }, onclick: () => openExerciseSheet(entry.ex, { item: entry.target, suggestion: sugg }) },
            h('div', { class: 'ex-name' }, def?.name || entry.ex)),
          h('div', { class: 'ex-target' }, targetLine(entry))),
        h('button', { class: 'icon-btn', 'aria-label': `How to do ${def?.name}`, onclick: () => openExerciseSheet(entry.ex, { item: entry.target, suggestion: sugg }) }, icon(ICONS.info)),
        h('button', { class: 'icon-btn', 'aria-label': 'Exercise options', onclick: () => exerciseMenu(entry, i) }, icon(ICONS.dots))),
      sugg && live ? h('div', { class: `ex-sugg ${sugg.kind}` }, chip ? h('span', { class: `chip ${chip[0]}` }, chip[1]) : null, h('span', null, sugg.text)) : null,
      entry.note ? h('p', { class: 'ex-note' }, entry.note) : null,
      h('div', { class: 'set-table' },
        h('div', { class: `set-row head ${cls}` }, cols.map((c, ci) => h('div', { style: { textAlign: ci === 0 ? 'center' : (ci === 1 && entry.type !== 'cardio' ? 'left' : 'center') } }, c))),
        rows),
      h('div', { class: 'ex-actions' },
        h('button', { class: 'btn text', onclick: () => addSet(entry, i) }, icon(ICONS.plus, 18), 'Add set'),
        entry.sets.length > 1 ? h('button', {
          class: 'btn text', style: { color: 'var(--muted)' }, onclick: () => {
            entry.sets.pop();
            persistNow();
            refreshOne(i);
          },
        }, icon(ICONS.minus, 18), 'Remove set') : null));
  }

  // ---------------- focus view ----------------

  const pager = h('div', { class: 'pager' });
  const dots = h('div', { class: 'pager-dots', 'aria-hidden': 'true' });
  const pageCount = () => session.exercises.length + 2; // warm-up, exercises, cool-down

  function goToPage(idx, smooth = true) {
    const n = Math.max(0, Math.min(pageCount() - 1, idx));
    pager.scrollTo({ left: n * pager.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'instant' });
  }

  function updateDots() {
    if (!pager.isConnected) return; // a replaced screen reads as page 0
    const idx = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
    if (session.focusIndex !== idx) { session.focusIndex = idx; persist(); }
  }

  /** − value + with an editable number in the middle. */
  function stepper({ label, value, onStep, onType, decimal = true }) {
    const field = h('input', {
      class: 'st-input', type: 'text', inputmode: decimal ? 'decimal' : 'numeric', enterkeyhint: 'done', 'aria-label': label,
      value: value ?? '', placeholder: '–', onfocus: (e) => e.target.select(),
      oninput: (e) => onType(toNumber(e.target.value)),
    });
    const bump = (dir) => () => { field.value = fmtNum(onStep(dir), 2).replace(/,/g, ''); };
    return h('div', { class: 'stepper' },
      h('button', { class: 'st-btn', type: 'button', 'aria-label': `Less ${label}`, onclick: bump(-1) }, icon(ICONS.minus, 22)),
      h('div', { class: 'st-mid' }, field, h('span', { class: 'st-label' }, label)),
      h('button', { class: 'st-btn', type: 'button', 'aria-label': `More ${label}`, onclick: bump(1) }, icon(ICONS.plus, 22)));
  }

  function currentSteppers(entry, st) {
    const parts = [];
    if (usesWeight(entry.type)) {
      parts.push(stepper({
        label: entry.type === 'assisted' ? `assist ${unit}` : unit, value: st.w,
        onStep: (dir) => { st.w = stepWeight(entry.ex, st.w, unit, dir); persist(); return st.w; },
        onType: (v) => { st.w = v; persist(); },
      }));
    }
    if (usesReps(entry.type)) {
      parts.push(stepper({
        label: 'reps', value: st.r, decimal: false,
        onStep: (dir) => { st.r = Math.max(0, (st.r ?? entry.target.reps[0]) + dir); persist(); return st.r; },
        onType: (v) => { st.r = v; persist(); },
      }));
    }
    if (entry.type === 'time' || entry.type === 'weight_time') {
      parts.push(stepper({
        label: 'sec', value: st.sec, decimal: false,
        onStep: (dir) => { st.sec = Math.max(0, (st.sec ?? entry.target.reps[0]) + dir * 5); persist(); return st.sec; },
        onType: (v) => { st.sec = v; persist(); },
      }));
    }
    if (entry.type === 'cardio') {
      parts.push(stepper({
        label: 'min', value: st.min, decimal: false,
        onStep: (dir) => { st.min = Math.max(0, (st.min ?? entry.target.reps[0]) + dir); persist(); return st.min; },
        onType: (v) => { st.min = v; persist(); },
      }));
    }
    return h('div', { class: 'steppers' }, parts);
  }

  function exercisePage(entry, i) {
    const def = getExercise(entry.ex);
    const sugg = entry.suggestion;
    const cur = entry.sets.findIndex((st) => !st.done);
    const allDone = cur < 0;
    const chip = sugg ? SUGG_CHIP[sugg.kind] : null;
    if (!allDone) {
      // Pre-fill the set you're on so the steppers start from the suggestion.
      const st = entry.sets[cur];
      const before = entry.sets[cur - 1];
      if (usesWeight(entry.type) && st.w == null) st.w = sugg?.weight ?? before?.w ?? null;
      if (usesReps(entry.type) && st.r == null) st.r = sugg?.reps ?? entry.target.reps[0];
    }
    const rows = entry.sets.map((st, si) => {
      const state = st.done ? 'done' : si === cur ? 'now' : 'later';
      if (state === 'now') {
        return h('div', { class: 'fset now' },
          h('div', { class: 'fset-head' }, h('span', { class: 'fset-no' }, `Set ${si + 1}`), h('span', { class: 'xs muted' }, `Last time: ${prevFor(entry, si)}`)),
          currentSteppers(entry, st));
      }
      return h('button', {
        class: `fset ${state}`, type: 'button', 'aria-label': st.done ? `Undo set ${si + 1}` : `Set ${si + 1}`,
        onclick: st.done ? () => toggleSet(entry, i, si) : null,
      },
      h('span', { class: 'fset-mark' }, st.done ? icon(ICONS.check, 16) : String(si + 1)),
      h('span', { class: 'grow' }, st.done ? fmtSet(st, entry.type, unit) : (st.w != null ? `${fmtNum(st.w, 1)} ${unit}` : 'Up next')),
      st.done ? h('span', { class: 'xs muted' }, 'Undo') : null);
    });
    return h('section', { class: 'fpage', 'aria-label': `${def?.name}, exercise ${i + 1} of ${session.exercises.length}` },
      h('button', { class: 'fpage-media', type: 'button', 'aria-label': `How to do ${def?.name}`, onclick: () => openExerciseSheet(entry.ex, { item: entry.target, suggestion: sugg }) },
        demoFrames(entry.ex, def?.name || '') || h('span', { class: 'tile-ph', style: { height: '100%' } }, icon(ICONS.dumbbell, 36))),
      h('div', { class: 'row', style: { alignItems: 'flex-start' } },
        h('div', { class: 'grow stack', style: { gap: '2px' } },
          h('span', { class: 'eyebrow' }, `Exercise ${i + 1} of ${session.exercises.length}`),
          h('h2', { class: 'fpage-name' }, def?.name || entry.ex),
          h('span', { class: 'ex-target' }, targetLine(entry))),
        h('button', { class: 'icon-btn', 'aria-label': 'Exercise options', onclick: () => exerciseMenu(entry, i) }, icon(ICONS.dots))),
      sugg ? h('div', { class: `ex-sugg ${sugg.kind}`, style: { margin: 0 } }, chip ? h('span', { class: `chip ${chip[0]}` }, chip[1]) : null, h('span', { class: 'clamp-2' }, sugg.text)) : null,
      h('div', { class: 'fsets' }, rows),
      allDone
        ? h('button', { class: 'btn good lg block', onclick: () => goToPage(i + 2) }, icon(ICONS.check, 20), i < session.exercises.length - 1 ? 'Done · next exercise' : 'Done · cool down')
        : h('button', { class: 'btn iron lg block complete-set', onclick: () => toggleSet(entry, i, cur) }, icon(ICONS.check, 20), `Complete set ${cur + 1}`),
      h('button', { class: 'btn text', onclick: () => addSet(entry, i) }, icon(ICONS.plus, 18), 'Add a set'));
  }

  function warmupPage() {
    return h('section', { class: 'fpage' },
      h('span', { class: 'eyebrow' }, 'Before you start'),
      h('h2', { class: 'fpage-name' }, 'Warm-up · 5–8 min'),
      h('ul', { class: 'checklist' }, WARMUP_GYM.map((t) => h('li', null, t))),
      h('button', { class: 'btn iron lg block', onclick: () => goToPage(1) }, 'I\'m warmed up', icon(ICONS.chevron, 18)),
      h('p', { class: 'small muted' }, 'Swipe sideways to move between exercises. Tap the photo for how to do it.'));
  }

  function cooldownPage() {
    return h('section', { class: 'fpage' },
      h('span', { class: 'eyebrow' }, 'Last step'),
      h('h2', { class: 'fpage-name' }, 'Cool-down · 3–5 min'),
      h('ul', { class: 'checklist' }, COOLDOWN_GYM.map((t) => h('li', null, t))),
      h('button', { class: 'btn iron lg block', onclick: () => { persistNow(); finishSession(session); } }, icon(ICONS.check, 20), 'Finish workout'),
      h('button', { class: 'btn quiet block', onclick: addExercise }, icon(ICONS.plus, 18), 'Add an exercise'),
      h('button', { class: 'btn ghost block', onclick: () => discardActive() }, 'Discard workout'));
  }

  function drawPager() {
    const idx = session.focusIndex ?? (session.exercises.some((e) => e.sets.some((st) => st.done)) ? 1 : 0);
    fill(pager, warmupPage(), ...session.exercises.map((ex, i) => exercisePage(ex, i)), cooldownPage());
    fill(dots, ...Array.from({ length: pageCount() }, () => h('span')));
    updateProgress();
    requestAnimationFrame(() => { goToPage(idx, false); updateDots(); });
  }

  function refreshPage(i) {
    const old = pager.children[i + 1];
    if (old) old.replaceWith(exercisePage(session.exercises[i], i));
    updateProgress();
    const entry = session.exercises[i];
    // Finished the last set: slide on to the next exercise while you rest.
    if (entry.sets.length && entry.sets.every((st) => st.done) && (session.focusIndex ?? 0) === i + 1) {
      setTimeout(() => { if (pager.isConnected) goToPage(i + 2); }, 650);
    }
  }

  pager.addEventListener('scroll', debounce(updateDots, 60), { passive: true });

  function menuItem(ic, label, onclick) {
    return h('button', { class: 'list-item', type: 'button', onclick }, icon(ic, 20), h('span', { class: 'grow li-title' }, label));
  }

  function addExercise() {
    const picker = exercisePicker({
      onPick: (id) => {
        picker.close();
        const def = getExercise(id);
        const { sessions } = ctx();
        const target = def?.type === 'cardio' ? { sets: 1, reps: [10, 20] }
          : def?.type === 'time' ? { sets: 2, reps: [20, 40], rest: 45 }
            : { sets: 3, reps: [8, 12] };
        session.exercises.push(exerciseEntry(id, target, sessions, unit));
        if (focus) session.focusIndex = session.exercises.length; // the new exercise's page
        persistNow();
        refreshAll();
        if (!focus) setTimeout(() => cardsWrap.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      },
    });
  }

  function switchView() {
    session.view = focus ? 'list' : 'focus';
    if (session.view === 'focus') {
      const firstOpen = session.exercises.findIndex((e) => e.sets.some((st) => !st.done));
      session.focusIndex = firstOpen >= 0 ? firstOpen + 1 : 0;
    }
    persistNow();
    render();
  }

  // ----- header -----
  const head = h('header', { class: 'session-head' },
    h('button', {
      class: 'icon-btn', 'aria-label': live ? 'Minimize workout' : 'Back',
      onclick: () => { if (live) { persistNow(); tab('today'); } else back(); },
    }, icon(live ? ICONS.close : ICONS.back)),
    h('div', { class: 'sh-title' }, h('span', { class: 'sh-name' }, session.name), clockEl),
    live ? h('button', {
      class: 'icon-btn view-toggle', 'aria-label': focus ? 'Show all exercises' : 'One exercise at a time',
      title: focus ? 'List' : 'Focus', onclick: switchView,
    }, icon(focus ? LIST_ICON : FOCUS_ICON, 22)) : null,
    live
      ? h('button', { class: 'btn iron sm', onclick: () => { persistNow(); finishSession(session); } }, 'Finish')
      : h('button', {
        class: 'btn good sm', onclick: () => {
          session.exercises = session.exercises.map((ex) => ({ ...ex, sets: ex.sets.filter((st) => st.done) })).filter((ex) => ex.sets.length);
          store.saveSession(session);
          toast('Changes saved');
          back();
        },
      }, 'Save'));

  if (focus) {
    drawPager();
    put(view, head, h('div', { class: 'progress-track', 'aria-hidden': 'true' }, progressFill), dots, pager);
  } else {
    const warmup = live && session.exercises.length ? h('details', { class: 'card' },
      h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Warm-up (5–8 min)'),
      h('ul', { class: 'checklist' }, WARMUP_GYM.map((t) => h('li', null, t)))) : null;
    rerenderCards();
    put(view,
      head,
      h('div', { class: 'progress-track', 'aria-hidden': 'true' }, progressFill),
      session.focus ? h('p', { class: 'small ink-2' }, session.focus) : null,
      warmup,
      session.exercises.length ? null : h('div', { class: 'chart-empty' }, 'No exercises yet. Add your first one below.'),
      cardsWrap,
      h('button', { class: 'btn quiet block lg', onclick: addExercise }, icon(ICONS.plus, 20), 'Add exercise'),
      live
        ? h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => discardActive() }, 'Discard workout'),
          h('button', { class: 'btn iron', onclick: () => { persistNow(); finishSession(session); } }, 'Finish workout'))
        : null);
  }

  if (live) {
    const bar = restBar({ onOpen: openClockSheet });
    put(view, bar.el);
    const timerId = setInterval(() => {
      if (!view.isConnected) { clearInterval(timerId); bar.destroy(); return; }
      updateProgress();
    }, 1000);
  }
  return view;
}

export function openClockSheet() {
  const clock = paceClock();
  let off = null;
  const s = sheet('Rest', h('div', { class: 'stack lg' },
    clock.el,
    h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'The red hand follows the seconds like a pool pace clock. The arc is the rest you have left.')), {
    onClose: () => { off?.(); clearInterval(spin); },
  });
  off = onRestChange((rs) => clock.update(rs));
  const spin = setInterval(() => { if (!s.panel.isConnected) clearInterval(spin); else clock.update(restState()); }, 100);
}

registerRoute('session', () => {
  const { active } = ctx();
  if (!active || active.kind !== 'gym') {
    setTimeout(() => tab('today'), 0);
    return h('div', { class: 'view' });
  }
  return sessionEditor(active, 'live');
});

registerRoute('edit-session', ({ id }) => {
  const s = ctx().sessions.find((x) => x.id === id);
  if (!s) { setTimeout(back, 0); return h('div', { class: 'view' }); }
  return sessionEditor(JSON.parse(JSON.stringify(s)), 'edit');
});

export { go };

// Live gym workout logger (also used to edit a saved gym session).
// Two views of the same data: List (every exercise as a card, the default)
// and Focus (one step per page, swipe between them, − / + steppers so you
// never need the keyboard). The toggle sits in the top bar.
// A live workout runs in three parts: warm-up (stretches, then warm-up
// moves), the exercises, and the cool-down stretches.

import * as store from '../store.js';
import { h, icon, ICONS, fmtClock, fmtNum, toNumber, fmtDate, debounce, put, fill } from '../util.js';
import { ctx, back, tab, registerRoute, go, render } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { RAMP_UP_NOTE } from '../data/plans.js';
import { exerciseEntry, stepWeight, routineTarget } from '../program.js';
import { finishSession, discardActive, saveActive } from '../actions.js';
import { exercisePicker, openExerciseSheet, fmtSet, exThumb, routineRows } from './library.js';
import { demoFrames } from '../media.js';
import { sheet, toast } from '../ui.js';
import { reducedMotion } from '../motion.js';
import { startRest, stopRest, adjustRest, restBar, paceClock, onRestChange, restState, countdownRing, beep } from '../timer.js';

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
        restNext = { i, si: si + 1 };
        restTucked = false;
        startRest(defaultRest(entry, settings), { label: `Rest · next: set ${si + 2}`, kind: 'gym' });
      } else if (live) {
        const nextEx = session.exercises[i + 1];
        if (nextEx) {
          restNext = { i: i + 1, si: Math.max(0, nextEx.sets.findIndex((x) => !x.done)) };
          restTucked = false;
          startRest(defaultRest(entry, settings), { label: `Rest · next: ${getExercise(nextEx.ex)?.name || 'exercise'}`, kind: 'gym' });
        } else stopRest();
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
    if (focus) session.focusIndex = exPage(i + d);
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

  // ---------------- full-screen rest (Focus) ----------------
  // In Focus mode the rest between sets takes over the screen, so the next
  // set can't start before it's over: a big countdown, −15 / +15, what's
  // next, and Skip. "Show workout" tucks it into the rest bar for the rest
  // of this rest; tapping the bar brings it back.

  let restNext = null; // { i, si }: the set that follows this rest
  let restTucked = false;

  /** For a rest that started elsewhere (e.g. in the list view): the next set not done. */
  function guessNext() {
    const cur = (session.focusIndex ?? 0) - W();
    for (let k = cur >= 0 && cur < session.exercises.length ? cur : 0; k < session.exercises.length; k++) {
      const si = session.exercises[k].sets.findIndex((st) => !st.done);
      if (si >= 0) return { i: k, si };
    }
    return { i: -1, si: 0 };
  }

  /** "100 lb × 10" for a set you haven't done yet: what's entered, else the suggestion. */
  function plannedLine(entry, st) {
    const sugg = entry.suggestion || {};
    const planned = { ...st };
    if (usesWeight(entry.type) && planned.w == null) planned.w = sugg.weight ?? null;
    if (usesReps(entry.type) && planned.r == null) planned.r = sugg.reps ?? entry.target.reps[0];
    if ((entry.type === 'time' || entry.type === 'weight_time') && planned.sec == null) planned.sec = entry.target.reps[0];
    if (entry.type === 'cardio' && planned.min == null) planned.min = entry.target.reps[0];
    return fmtSet(planned, entry.type, unit);
  }

  function upNextCard(nx) {
    const entry = session.exercises[nx.i];
    if (!entry) {
      return h('div', { class: 'rs-next' }, h('span', { class: 'sr-icon other' }, icon(ICONS.rest)),
        h('span', { class: 'grow' }, h('span', { class: 'eyebrow' }, 'Up next'), h('span', { class: 'rs-next-name' }, 'Cool-down')));
    }
    const name = getExercise(entry.ex)?.name || entry.ex;
    return h('button', {
      class: 'rs-next', type: 'button', 'aria-label': `Up next: ${name}. How to do it.`,
      onclick: () => openExerciseSheet(entry.ex, { item: entry.target, suggestion: entry.suggestion }),
    },
    exThumb(entry.ex) || h('span', { class: 'sr-icon gym' }, icon(ICONS.dumbbell)),
    h('span', { class: 'grow' },
      h('span', { class: 'eyebrow' }, 'Up next'),
      h('span', { class: 'rs-next-name' }, name),
      h('span', { class: 'rs-next-sub' }, `Set ${nx.si + 1} of ${entry.sets.length} · ${plannedLine(entry, entry.sets[nx.si] || {})}`)));
  }

  function restScreen(onTuck) {
    const ring = countdownRing('rs-ring');
    const time = h('span', { class: 'rs-time' });
    const label = h('span', { class: 'rs-label' });
    const nextWrap = h('div');
    const go = h('button', { class: 'btn lg block rs-go', type: 'button', onclick: () => stopRest() });
    const el = h('div', { class: 'rest-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Rest', hidden: true },
      h('div', { class: 'rs-top' },
        h('span', { class: 'eyebrow' }, 'Rest'),
        h('button', { class: 'btn text', type: 'button', onclick: () => { restTucked = true; update(restState()); onTuck(); } }, 'Show workout')),
      h('div', { class: 'rs-dial', role: 'timer' }, ring.el, h('div', { class: 'rs-read' }, time, label)),
      h('div', { class: 'rs-adjust' },
        h('button', { class: 'btn quiet', type: 'button', 'aria-label': 'Subtract 15 seconds', onclick: () => adjustRest(-15) }, '−15 s'),
        h('button', { class: 'btn quiet', type: 'button', 'aria-label': 'Add 15 seconds', onclick: () => adjustRest(15) }, '+15 s')),
      nextWrap,
      go);
    let drawn = null;
    function update(rs) {
      const show = rs.running && !restTucked;
      if (el.hidden === show) {
        el.hidden = !show;
        // Close the keyboard if a number was being typed.
        if (show && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
      if (!show) return;
      const over = rs.remaining <= 0;
      el.classList.toggle('over', over);
      time.textContent = over ? `+${fmtClock(-rs.remaining)}` : fmtClock(Math.ceil(rs.remaining));
      label.textContent = over ? 'Go!' : 'Rest';
      ring.update(over ? 1 : rs.remaining, over ? 1 : rs.duration);
      if (!restNext) restNext = guessNext();
      if (restNext !== drawn) { drawn = restNext; fill(nextWrap, upNextCard(restNext)); }
      go.className = `btn lg block rs-go ${over ? 'good' : 'iron'}`;
      go.textContent = over ? (session.exercises[restNext.i] ? `Start set ${restNext.si + 1}` : 'Continue') : 'Skip rest';
    }
    const off = onRestChange(update);
    update(restState());
    return { el, update: () => update(restState()), destroy: off };
  }

  // ---------------- warm-up and cool-down ----------------

  const ROUTINE = {
    warmup: { title: 'Warm-up', label: 'In this warm-up' },
    cooldown: { title: 'Cool-down', label: 'In this cool-down' },
  };
  const routineItems = (key) => (live ? session[key] || [] : []);

  function openRoutineSheet(key, it) {
    openExerciseSheet(it.ex, { routine: { label: ROUTINE[key].label, item: it } });
  }

  function setRoutineDone(key, i, done) {
    session[key][i].done = done;
    persistNow();
    if (focus) refreshRoutinePage(key, i); else refreshRoutineCard(key);
  }

  /** List view: one card per part, each item a row you can tick. */
  function routineCard(key) {
    const items = routineItems(key);
    const doneN = items.filter((x) => x.done).length;
    const rows = routineRows(items, (it, i) => {
      const name = getExercise(it.ex)?.name || it.ex;
      return h('div', { class: `rt-row${it.done ? ' done' : ''}` },
        h('button', { class: 'rt-main', type: 'button', 'aria-label': `How to do ${name}`, onclick: () => openRoutineSheet(key, it) },
          exThumb(it.ex) || h('span', { class: 'sr-icon other' }, icon(ICONS.timer)),
          h('span', { class: 'grow' }, h('span', { class: 'li-title' }, name), h('span', { class: 'li-sub' }, routineTarget(it)))),
        h('button', {
          class: 'set-check', type: 'button', 'aria-pressed': String(!!it.done), 'aria-label': it.done ? `Undo ${name}` : `Done: ${name}`,
          onclick: () => setRoutineDone(key, i, !it.done),
        }, icon(ICONS.check, 22)));
    });
    return h('section', { class: `routine-card ${key}${doneN === items.length ? ' complete' : ''}`, 'data-routine': key },
      h('div', { class: 'rt-head' },
        h('span', { class: 'rt-title' }, ROUTINE[key].title),
        h('span', { class: 'xs muted' }, `${doneN} of ${items.length} done`)),
      h('div', { class: 'list' }, rows),
      key === 'warmup' ? h('p', { class: 'xs muted rt-foot' }, RAMP_UP_NOTE) : null);
  }

  function refreshRoutineCard(key) {
    const old = view.querySelector(`[data-routine="${key}"]`);
    if (old) old.replaceWith(routineCard(key));
  }

  // Focus view: a timer for holds and timed moves. One runs at a time, and
  // it lives here rather than in a page, so redrawing a page keeps it going.
  const SWITCH_SEC = 5;
  let hold = null; // { key, i, side, sides, phase: 'hold' | 'switch', total, endsAt }
  let holdTick = null;
  const holdWidgets = new Map();
  const holdTotal = (it) => (it.min ? it.min * 60 : it.sec);
  const holdSides = (it) => (!it.min && getExercise(it.ex)?.unilateral ? 2 : 1);

  function startHold(key, i) {
    const it = session[key][i];
    hold = { key, i, side: 0, sides: holdSides(it), phase: 'hold', total: holdTotal(it), endsAt: Date.now() + holdTotal(it) * 1000 };
    clearInterval(holdTick);
    holdTick = setInterval(tickHold, 200);
    paintHolds();
  }

  function stopHold() {
    hold = null;
    clearInterval(holdTick);
    holdTick = null;
    paintHolds();
  }

  function tickHold() {
    if (!hold) return;
    if (!view.isConnected) { stopHold(); return; }
    if (hold.endsAt > Date.now()) { paintHolds(); return; }
    if (hold.phase === 'hold' && hold.side + 1 < hold.sides) {
      beep([0, 0.2], 660);
      Object.assign(hold, { phase: 'switch', endsAt: Date.now() + SWITCH_SEC * 1000 });
    } else if (hold.phase === 'switch') {
      beep([0], 880);
      Object.assign(hold, { phase: 'hold', side: hold.side + 1, endsAt: Date.now() + hold.total * 1000 });
    } else {
      beep([0, 0.25, 0.5], 880);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      completeRoutine(hold.key, hold.i);
      return;
    }
    paintHolds();
  }

  function paintHolds() {
    for (const [id, w] of holdWidgets) {
      if (!w.el.isConnected && pager.isConnected) { holdWidgets.delete(id); continue; }
      w.paint();
    }
  }

  function holdTimer(key, i) {
    const it = session[key][i];
    const total = holdTotal(it);
    const sides = holdSides(it);
    const ring = countdownRing();
    const time = h('span', { class: 'ht-time' });
    const label = h('span', { class: 'ht-label' });
    const btn = h('button', { class: 'btn lg block', type: 'button' });
    const el = h('div', { class: 'hold-timer', role: 'timer' },
      h('div', { class: 'ht-dial' }, ring.el, h('div', { class: 'ht-read' }, time, label)),
      btn);
    const paint = () => {
      const mine = !!hold && hold.key === key && hold.i === i;
      const switching = mine && hold.phase === 'switch';
      const rem = mine ? Math.max(0, (hold.endsAt - Date.now()) / 1000) : total;
      el.classList.toggle('running', mine);
      el.classList.toggle('switching', switching);
      time.textContent = fmtClock(Math.ceil(rem));
      if (switching) label.textContent = 'Switch sides';
      else if (sides === 2) label.textContent = mine && hold.side === 1 ? 'Second side' : 'First side';
      else label.textContent = it.min ? 'Easy pace' : 'Hold';
      ring.update(rem, switching ? SWITCH_SEC : total);
      btn.className = `btn lg block ${mine ? 'quiet' : 'iron'}`;
      btn.replaceChildren(...(mine
        ? [icon(ICONS.close, 20), 'Stop timer']
        : [icon(ICONS.play, 20), `Start ${it.min ? `${it.min} min` : `${total} s`}${sides === 2 ? ' each side' : ''}`]));
      btn.onclick = mine ? stopHold : () => startHold(key, i);
    };
    holdWidgets.set(`${key}:${i}`, { el, paint });
    paint();
    return el;
  }

  /** Tick an item off and move on to the next step. */
  function completeRoutine(key, i) {
    if (hold && hold.key === key && hold.i === i) stopHold();
    const it = session[key][i];
    if (!it.done) { it.done = true; persistNow(); }
    refreshRoutinePage(key, i);
    const page = routinePageIdx(key, i);
    setTimeout(() => { if (pager.isConnected && (session.focusIndex ?? 0) === page) goToPage(page + 1); }, 500);
  }

  function routinePage(key, i) {
    const items = routineItems(key);
    const it = items[i];
    const def = getExercise(it.ex);
    const name = def?.name || it.ex;
    const page = routinePageIdx(key, i);
    const timed = !!(it.sec || it.min);
    const kindWord = key === 'warmup' && it.part === 'move' ? 'Warm up' : 'Stretch';
    return h('section', { class: `fpage rt-page ${key}${it.done ? ' done' : ''}`, 'aria-label': `${name}, ${ROUTINE[key].title.toLowerCase()} ${i + 1} of ${items.length}` },
      h('button', { class: 'fpage-media', type: 'button', 'aria-label': `How to do ${name}`, onclick: () => openRoutineSheet(key, it) },
        demoFrames(it.ex, name) || h('span', { class: 'tile-ph', style: { height: '100%' } }, icon(ICONS.timer, 36))),
      h('div', { class: 'stack', style: { gap: '2px' } },
        h('span', { class: 'eyebrow' }, `${ROUTINE[key].title} · ${i + 1} of ${items.length}`),
        h('h2', { class: 'fpage-name' }, name),
        h('span', { class: 'ex-target' }, `${kindWord} · ${routineTarget(it)}`)),
      it.note ? h('p', { class: 'small ink-2' }, it.note) : null,
      def?.cues?.length ? h('ul', { class: 'cues' }, def.cues.slice(0, 2).map((c) => h('li', null, c))) : null,
      it.done
        ? h('div', { class: 'stack' },
          h('div', { class: 'rt-done-badge' }, icon(ICONS.check, 18), 'Done'),
          h('button', { class: 'btn good lg block', onclick: () => goToPage(page + 1) }, 'Next', icon(ICONS.chevron, 18)),
          h('button', { class: 'btn text', onclick: () => setRoutineDone(key, i, false) }, 'Undo'))
        : h('div', { class: 'stack' },
          timed ? holdTimer(key, i) : h('button', { class: 'btn iron lg block rt-done', onclick: () => completeRoutine(key, i) }, icon(ICONS.check, 20), 'Done'),
          h('div', { class: 'row', style: { justifyContent: 'center' } },
            timed ? h('button', { class: 'btn text', onclick: () => completeRoutine(key, i) }, 'Mark done') : null,
            h('button', { class: 'btn text', onclick: () => goToPage(page + 1) }, 'Skip'))),
      key === 'warmup' && i === 0 ? h('p', { class: 'small muted' }, 'Swipe sideways to move between steps. Tap the photo for how to do it.') : null);
  }

  function refreshRoutinePage(key, i) {
    const old = pager.children[routinePageIdx(key, i)];
    if (old) old.replaceWith(routinePage(key, i));
    refreshFinish();
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

  // Pages: each warm-up item, each exercise, each cool-down item, then Finish.
  const pager = h('div', { class: 'pager' });
  const dots = h('div', { class: 'pager-dots', 'aria-hidden': 'true' });
  const W = () => routineItems('warmup').length;
  const exPage = (i) => W() + i;
  const coolPage = (k) => W() + session.exercises.length + k;
  const finishIdx = () => coolPage(routineItems('cooldown').length);
  const pageCount = () => finishIdx() + 1;
  const routinePageIdx = (key, i) => (key === 'warmup' ? i : coolPage(i));

  /** The first step not done yet. Once any set is ticked, the warm-up counts as over. */
  function firstOpenPage() {
    const started = session.exercises.some((e) => e.sets.some((st) => st.done));
    const w = routineItems('warmup').findIndex((x) => !x.done);
    if (w >= 0 && !started) return w;
    const e = session.exercises.findIndex((x) => x.sets.some((st) => !st.done));
    if (e >= 0) return exPage(e);
    const c = routineItems('cooldown').findIndex((x) => !x.done);
    return c >= 0 ? coolPage(c) : finishIdx();
  }

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
        ? h('button', { class: 'btn good lg block', onclick: () => goToPage(exPage(i) + 1) }, icon(ICONS.check, 20),
          i < session.exercises.length - 1 ? 'Done · next exercise' : routineItems('cooldown').length ? 'Done · cool down' : 'Done · finish')
        : h('button', { class: 'btn iron lg block complete-set', onclick: () => toggleSet(entry, i, cur) }, icon(ICONS.check, 20), `Complete set ${cur + 1}`),
      h('button', { class: 'btn text', onclick: () => addSet(entry, i) }, icon(ICONS.plus, 18), 'Add a set'));
  }

  function finishPage() {
    const sets = session.exercises.reduce((n, ex) => n + ex.sets.filter((st) => st.done).length, 0);
    const part = (key) => {
      const items = routineItems(key);
      return items.length ? `${ROUTINE[key].title}: ${items.filter((x) => x.done).length} of ${items.length}` : null;
    };
    return h('section', { class: 'fpage finish-page' },
      h('span', { class: 'eyebrow' }, 'Last step'),
      h('h2', { class: 'fpage-name' }, 'Finish workout'),
      h('ul', { class: 'checklist' }, [part('warmup'), `Exercises: ${sets} ${sets === 1 ? 'set' : 'sets'} done`, part('cooldown')]
        .filter(Boolean).map((t) => h('li', null, t))),
      h('button', { class: 'btn iron lg block', onclick: () => { persistNow(); finishSession(session); } }, icon(ICONS.check, 20), 'Finish workout'),
      h('button', { class: 'btn quiet block', onclick: addExercise }, icon(ICONS.plus, 18), 'Add an exercise'),
      h('button', { class: 'btn ghost block', onclick: () => discardActive() }, 'Discard workout'));
  }

  function refreshFinish() {
    const old = pager.children[finishIdx()];
    if (old) old.replaceWith(finishPage());
  }

  function drawPager() {
    const idx = session.focusIndex ?? firstOpenPage();
    holdWidgets.clear();
    fill(pager,
      ...routineItems('warmup').map((_, i) => routinePage('warmup', i)),
      ...session.exercises.map((ex, i) => exercisePage(ex, i)),
      ...routineItems('cooldown').map((_, i) => routinePage('cooldown', i)),
      finishPage());
    // Warm-up and cool-down dots are green, with a little space between the parts.
    const coolStart = coolPage(0);
    fill(dots, ...Array.from({ length: pageCount() }, (_, i) => h('span', {
      class: [(i < W() || (i >= coolStart && i < finishIdx())) && 'rt', i > 0 && [W(), coolStart, finishIdx()].includes(i) && 'gap'],
    })));
    updateProgress();
    requestAnimationFrame(() => { goToPage(idx, false); updateDots(); });
  }

  function refreshPage(i) {
    const old = pager.children[exPage(i)];
    if (old) old.replaceWith(exercisePage(session.exercises[i], i));
    refreshFinish();
    updateProgress();
    const entry = session.exercises[i];
    // Finished the last set: slide on to the next step while you rest.
    if (entry.sets.length && entry.sets.every((st) => st.done) && (session.focusIndex ?? 0) === exPage(i)) {
      setTimeout(() => { if (pager.isConnected) goToPage(exPage(i) + 1); }, 650);
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
        if (focus) session.focusIndex = exPage(session.exercises.length - 1); // the new exercise's page
        persistNow();
        refreshAll();
        if (!focus) setTimeout(() => cardsWrap.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      },
    });
  }

  function switchView() {
    session.view = focus ? 'list' : 'focus';
    if (session.view === 'focus') session.focusIndex = firstOpenPage();
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
    const warm = routineItems('warmup').length > 0;
    rerenderCards();
    put(view,
      head,
      h('div', { class: 'progress-track', 'aria-hidden': 'true' }, progressFill),
      session.focus ? h('p', { class: 'small ink-2' }, session.focus) : null,
      warm ? routineCard('warmup') : null,
      warm ? h('div', { class: 'eyebrow group-title' }, 'Exercises') : null,
      session.exercises.length ? null : h('div', { class: 'chart-empty' }, 'No exercises yet. Add your first one below.'),
      cardsWrap,
      h('button', { class: 'btn quiet block lg', onclick: addExercise }, icon(ICONS.plus, 20), 'Add exercise'),
      routineItems('cooldown').length ? routineCard('cooldown') : null,
      live
        ? h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => discardActive() }, 'Discard workout'),
          h('button', { class: 'btn iron', onclick: () => { persistNow(); finishSession(session); } }, 'Finish workout'))
        : null);
  }

  if (live) {
    // List: the floating rest bar. Focus: the full-screen rest, with the bar
    // only while it's tucked away.
    let screen = null;
    const bar = restBar({
      onOpen: focus ? () => { restTucked = false; screen.update(); bar.update(); } : openClockSheet,
      visible: () => !focus || restTucked,
      openLabel: focus ? 'Show rest' : 'Show pace clock',
    });
    screen = focus ? restScreen(() => bar.update()) : null;
    put(view, bar.el, screen?.el);
    const timerId = setInterval(() => {
      if (!view.isConnected) { clearInterval(timerId); bar.destroy(); screen?.destroy(); return; }
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

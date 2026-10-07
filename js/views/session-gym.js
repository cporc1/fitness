// Live gym workout logger (also used to edit a saved gym session).

import * as store from '../store.js';
import { h, icon, ICONS, fmtClock, fmtNum, toNumber, fmtDate, debounce, put, fill } from '../util.js';
import { ctx, back, tab, registerRoute, go } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { WARMUP_GYM } from '../data/plans.js';
import { exerciseEntry } from '../program.js';
import { finishSession, discardActive, saveActive } from '../actions.js';
import { exercisePicker, openExerciseSheet, fmtSet } from './library.js';
import { sheet, toast } from '../ui.js';
import { startRest, stopRest, restBar, paceClock, onRestChange, restState } from '../timer.js';

const SUGG_CHIP = {
  up: ['good', 'Add weight'], same: ['plain', 'Same weight'], down: ['danger', 'Go lighter'],
  new: ['plain', 'First time'], reps: ['good', 'Level up'],
};

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

/**
 * mode 'live' edits the active session; mode 'edit' edits a saved one.
 */
function sessionEditor(session, mode) {
  const { settings, profile } = ctx();
  const unit = session.unit || profile?.units || 'lb';
  const live = mode === 'live';
  const persist = live ? debounce(() => saveActive(session), 250) : () => {};
  const persistNow = live ? () => saveActive(session) : () => {};

  const view = h('div', { class: 'view full', 'data-full': 'true' });
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
    const el = h('input', {
      class: 'set-input', type: 'text', inputmode: decimal ? 'decimal' : 'numeric', enterkeyhint: 'done',
      value: st[key] ?? '', placeholder: placeholder ?? '', 'aria-label': label,
      onfocus: (e) => e.target.select(),
      oninput: (e) => { st[key] = toNumber(e.target.value); persist(); },
    });
    return el;
  }

  function prevFor(entry, i) {
    const last = entry.suggestion?.last;
    if (!last?.sets?.length) return '—';
    const st = last.sets[i] || last.sets[last.sets.length - 1];
    return fmtSet(st, entry.type, unit);
  }

  function toggleSet(entry, i, si) {
    const st = entry.sets[si];
    const sugg = entry.suggestion || {};
    if (!st.done) {
      // Fill blanks from the placeholders so one tap logs the planned set.
      if (['weight', 'assisted', 'weight_time'].includes(entry.type) && st.w == null && sugg.weight != null) st.w = sugg.weight;
      if (['weight', 'assisted', 'bodyweight'].includes(entry.type) && st.r == null) st.r = sugg.reps ?? entry.target.reps[0];
      if (entry.type === 'time' && st.sec == null) st.sec = sugg.reps ?? entry.target.reps[0];
      if (entry.type === 'weight_time' && st.sec == null) st.sec = entry.target.reps[0];
      if (entry.type === 'cardio' && st.min == null) st.min = entry.target.reps[0];
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
    refreshCard(i);
  }

  function exerciseMenu(entry, i) {
    const def = getExercise(entry.ex);
    sheet(def?.name || 'Exercise', (close) => h('div', { class: 'card flush' }, h('div', { class: 'list' },
      menuItem(ICONS.info, 'How to do it', () => { close(); openExerciseSheet(entry.ex); }),
      menuItem(ICONS.swap, 'Swap exercise', () => { close(); openSwap(entry, i); }),
      i > 0 ? menuItem(ICONS.back, 'Move up', () => { close(); move(i, -1); }) : null,
      i < session.exercises.length - 1 ? menuItem(ICONS.chevron, 'Move down', () => { close(); move(i, 1); }) : null,
      menuItem(ICONS.trash, 'Remove from this workout', () => {
        close();
        session.exercises.splice(i, 1);
        persistNow();
        rerenderCards();
      }))));
  }

  function move(i, d) {
    const [x] = session.exercises.splice(i, 1);
    session.exercises.splice(i + d, 0, x);
    persistNow();
    rerenderCards();
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
        rerenderCards();
        toast(always ? 'Swapped for this and future workouts' : 'Swapped for today');
      },
    });
    if (entry.orig) {
      const check = h('label', { class: 'check-row' },
        h('input', { type: 'checkbox', id: 'swap-always', onchange: (e) => { always = e.target.checked; } }),
        h('span', null, 'Always use the new exercise in my plan'));
      picker.panel.insertBefore(check, picker.panel.children[2]);
    }
  }

  function exerciseCard(entry, i) {
    const def = getExercise(entry.ex);
    const { cls, cols } = columnsFor(entry.type, unit);
    const sugg = entry.suggestion;
    const allDone = entry.sets.length && entry.sets.every((st) => st.done);
    const [lo, hi] = entry.target.reps;
    const repWord = entry.type === 'time' ? 's' : entry.type === 'cardio' ? 'min' : entry.type === 'weight_time' ? 's' : 'reps';
    const targetText = `${entry.sets.length} × ${lo === hi ? lo : `${lo}–${hi}`} ${repWord}${def?.unilateral ? ' per side' : ''} · rest ${fmtClock(defaultRest(entry, settings))}`;

    const rows = entry.sets.map((st, si) => {
      const cells = [h('div', { class: 'set-no' }, String(si + 1))];
      if (entry.type === 'cardio') {
        cells.push(setInput(entry, st, 'min', { placeholder: String(lo), label: `Set ${si + 1} minutes` }));
        cells.push(setInput(entry, st, 'dist', { placeholder: 'opt.', label: `Set ${si + 1} distance` }));
      } else {
        cells.push(h('div', { class: 'prev' }, prevFor(entry, si)));
        if (['weight', 'assisted', 'weight_time'].includes(entry.type)) {
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
        h('div', { class: 'grow stack', style: { gap: '2px' } },
          h('button', { style: { all: 'unset', cursor: 'pointer' }, onclick: () => openExerciseSheet(entry.ex) },
            h('div', { class: 'ex-name' }, def?.name || entry.ex)),
          h('div', { class: 'ex-target' }, targetText)),
        h('button', { class: 'icon-btn', 'aria-label': `How to do ${def?.name}`, onclick: () => openExerciseSheet(entry.ex) }, icon(ICONS.info)),
        h('button', { class: 'icon-btn', 'aria-label': 'Exercise options', onclick: () => exerciseMenu(entry, i) }, icon(ICONS.dots))),
      sugg && live ? h('div', { class: `ex-sugg ${sugg.kind}` }, chip ? h('span', { class: `chip ${chip[0]}` }, chip[1]) : null, h('span', null, sugg.text)) : null,
      entry.note ? h('p', { class: 'ex-note' }, entry.note) : null,
      h('div', { class: 'set-table' },
        h('div', { class: `set-row head ${cls}` }, cols.map((c, ci) => h('div', { style: { textAlign: ci === 0 ? 'center' : (ci === 1 && entry.type !== 'cardio' ? 'left' : 'center') } }, c))),
        rows),
      h('div', { class: 'ex-actions' },
        h('button', {
          class: 'btn text', onclick: () => {
            const lastSet = entry.sets[entry.sets.length - 1];
            entry.sets.push({ ...(lastSet ? { w: lastSet.w ?? null } : {}), done: false });
            persistNow();
            refreshCard(i);
          },
        }, icon(ICONS.plus, 18), 'Add set'),
        entry.sets.length > 1 ? h('button', {
          class: 'btn text', style: { color: 'var(--muted)' }, onclick: () => {
            entry.sets.pop();
            persistNow();
            refreshCard(i);
          },
        }, icon(ICONS.minus, 18), 'Remove set') : null));
  }

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
        persistNow();
        rerenderCards();
        setTimeout(() => cardsWrap.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      },
    });
  }

  // ----- header -----
  const head = h('header', { class: 'session-head' },
    h('button', {
      class: 'icon-btn', 'aria-label': live ? 'Minimize workout' : 'Back',
      onclick: () => { if (live) { persistNow(); tab('today'); } else back(); },
    }, icon(live ? ICONS.close : ICONS.back)),
    h('div', { class: 'sh-title' }, h('span', { class: 'sh-name' }, session.name), clockEl),
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

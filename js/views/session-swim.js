// Live swim session: current-rep focus card, lap counter and the full set list.

import * as store from '../store.js';
import { h, icon, ICONS, fmtClock, fmtNum, fmtDate, put, fill } from '../util.js';
import { ctx, back, tab, registerRoute } from '../app.js';
import { STROKES, getDrill, guideForItem, SWIM_WARMUP_DRY } from '../data/swim.js';
import { computeSwimDistance, plannedSwimDistance, routineTarget } from '../program.js';
import { finishSession, discardActive, saveActive } from '../actions.js';
import { openDrillSheet, openExerciseSheet, exThumb } from './library.js';
import { getExercise } from '../data/exercises.js';
import { toast, listItem } from '../ui.js';
import { ripple } from '../motion.js';
import { startRest, stopRest, restBar, beep } from '../timer.js';
import { openClockSheet } from './session-gym.js';

export function describeItem(it, unit) {
  const stroke = STROKES[it.stroke] || it.stroke || '';
  const drill = it.drill ? getDrill(it.drill) : null;
  let what;
  if (it.dist) what = `${it.dist} ${unit} ${drill && it.stroke === 'Drill' ? drill.name : stroke}`;
  else if (it.secs) what = `${it.secs} s ${it.label || drill?.name || stroke}`;
  else what = it.label || drill?.name || stroke;
  if (it.dist && it.label) what = `${it.dist} ${unit} ${it.label}`;
  return what;
}

/** "How to: Freestyle" link for a set: its drill, or the stroke it uses. */
export function howToLink(it, onOpen = openDrillSheet, arrow = '') {
  const id = guideForItem(it);
  const g = id ? getDrill(id) : null;
  return g ? h('button', { class: 'drill-link', type: 'button', onclick: (e) => { e.stopPropagation(); onOpen(g.id); } }, `How to: ${g.name}${arrow}`) : null;
}

function lengthsLabel(it, poolLen) {
  if (!it.dist) return '';
  const n = it.dist / poolLen;
  return Number.isInteger(n) ? `${n} ${n === 1 ? 'length' : 'lengths'}` : '';
}

const swimUi = { allOpen: false };

function swimEditor(session, mode) {
  const live = mode === 'live';
  const unit = session.pool?.unit || 'yd';
  const poolLen = session.pool?.len || 25;
  const persist = live ? () => saveActive(session) : () => {};
  const isFree = !(session.blocks || []).length;

  const view = h('div', { class: 'view full', 'data-full': 'true' });
  const clockEl = h('span', { class: 'sh-clock' });
  const body = h('div', { class: 'stack lg' });

  function updateHead() {
    const dist = computeSwimDistance(session);
    const planned = plannedSwimDistance(session);
    const time = live ? fmtClock((Date.now() - new Date(session.startedAt)) / 1000) : fmtDate(session.date, { weekday: true });
    clockEl.textContent = `${time} · ${fmtNum(dist, 0)}${planned ? ` / ${fmtNum(planned, 0)}` : ''} ${unit}`;
  }

  function currentRep() {
    for (let bi = 0; bi < session.blocks.length; bi++) {
      const b = session.blocks[bi];
      for (let ii = 0; ii < b.items.length; ii++) {
        const it = b.items[ii];
        const ri = it.done.findIndex((d) => !d);
        if (ri >= 0) return { bi, ii, ri, block: b, item: it };
      }
    }
    return null;
  }

  function nextAfter(cur) {
    // Look for the rep that follows the current one.
    let seen = false;
    for (const b of session.blocks) {
      for (const it of b.items) {
        for (let r = 0; r < it.done.length; r++) {
          if (seen && !it.done[r]) return { item: it, block: b };
          if (it === cur.item && r === cur.ri) seen = true;
        }
      }
    }
    return null;
  }

  function completeRep(cur, point) {
    cur.item.done[cur.ri] = true;
    const next = nextAfter(cur);
    if (live) {
      if (next && cur.item.rest) {
        startRest(cur.item.rest, { label: `Rest · next: ${describeItem(next.item, unit)}`, kind: 'swim' });
      } else if (!next) {
        stopRest();
        beep([0, 0.15, 0.3, 0.45], 990);
        toast('Workout complete. Nice swimming!');
      }
    }
    persist();
    draw();
    ripple(body.querySelector('.big-tap'), point);
  }

  function focusCard() {
    const cur = currentRep();
    if (!cur) {
      return h('section', { class: 'focus-card' },
        h('div', { class: 'eyebrow' }, 'All sets done'),
        h('div', { class: 'fc-what' }, `${fmtNum(computeSwimDistance(session), 0)} ${unit}`),
        h('p', { class: 'fc-sub' }, 'Cool down with some easy lengths if you like, then finish and save.'),
        live ? h('button', { class: 'big-tap good', onclick: () => finishSession(session) }, icon(ICONS.check, 30), 'Finish') : null);
    }
    const { item, block, ri } = cur;
    const next = nextAfter(cur);
    return h('section', { class: 'focus-card', 'aria-live': 'polite' },
      h('div', { class: 'row between' },
        h('div', { class: 'eyebrow' }, `${block.name} · rep ${ri + 1} of ${item.reps}`),
        lengthsLabel(item, poolLen) ? h('span', { class: 'chip swim' }, lengthsLabel(item, poolLen)) : null),
      h('div', { class: 'fc-what' }, describeItem(item, unit)),
      item.note ? h('p', { class: 'fc-sub' }, item.note) : null,
      howToLink(item, openDrillSheet, ' →'),
      h('div', { class: 'small ink-2' }, item.rest ? `Rest ${item.rest} s after each rep` : 'No set rest: move straight on'),
      h('button', { class: 'big-tap', onclick: (e) => completeRep(cur, { x: e.clientX, y: e.clientY }) }, icon(ICONS.check, 30), 'Rep done'),
      next ? h('div', { class: 'next-up' }, h('span', { class: 'eyebrow' }, 'Next up'), h('span', null, `${next.block.name}: ${describeItem(next.item, unit)}`)) : null);
  }

  function beforeYouGetIn() {
    return h('section', { class: 'card before-swim' },
      h('div', { class: 'row between' }, h('strong', null, 'Before you get in · 2 min'), h('span', { class: 'chip swim' }, icon(ICONS.wave, 14), `${poolLen} ${unit} pool`)),
      h('div', { class: 'list dry-list' }, SWIM_WARMUP_DRY.map((it) => listItem({
        title: getExercise(it.ex)?.name || it.ex,
        sub: routineTarget(it),
        leading: exThumb(it.ex),
        onclick: () => openExerciseSheet(it.ex, { routine: { label: 'Before you swim', item: it } }),
      }))),
      h('p', { class: 'small ink-2' }, h('strong', null, 'Apple Watch? '), `Start a Pool Swim workout and set the pool length to ${poolLen} ${unit === 'yd' ? 'yards' : 'meters'}. It counts lengths and saves to Health; log the sets here.`),
      h('button', { class: 'btn pool block', onclick: () => { session.dryDone = true; persist(); draw(); } }, 'Got it, I\'m in the water'));
  }

  function lapCounter() {
    const add = (n) => {
      session.freeLengths = Math.max(0, (session.freeLengths || 0) + n);
      persist();
      draw();
    };
    const count = session.freeLengths || 0;
    return h('section', { class: isFree ? 'focus-card' : 'card' },
      h('div', { class: 'row between' },
        h('div', { class: 'eyebrow' }, isFree ? 'Lap counter' : 'Extra lengths'),
        h('span', { class: 'small muted num' }, `${fmtNum(count * poolLen, 0)} ${unit}`)),
      isFree ? h('div', { class: 'lap-count', 'aria-live': 'polite' }, String(count)) : h('div', { class: 'row' },
        h('span', { class: 'display', style: { fontSize: 'var(--fs-2xl)', fontWeight: 700 } }, String(count)),
        h('span', { class: 'muted small' }, count === 1 ? 'length' : 'lengths')),
      isFree ? h('p', { class: 'small ink-2', style: { textAlign: 'center' } }, 'Tap each time you are back at your phone: one tap = there and back (2 lengths).') : null,
      h('div', { class: 'btn-row tight' },
        h('button', { class: 'btn ghost', onclick: () => add(-1), 'aria-label': 'Remove one length' }, icon(ICONS.minus, 18), '1'),
        h('button', { class: 'btn ghost', onclick: () => add(1), 'aria-label': 'Add one length' }, icon(ICONS.plus, 18), '1'),
        isFree ? null : h('button', { class: 'btn quiet', onclick: () => add(2) }, icon(ICONS.plus, 18), '2')),
      isFree ? h('button', { class: 'big-tap', onclick: () => add(2) }, icon(ICONS.plus, 30), '2 lengths') : null);
  }

  function blockList() {
    return session.blocks.map((b) => h('section', { class: 'swim-block' },
      h('h3', null, b.name),
      b.items.map((it) => {
        const doneCount = it.done.filter(Boolean).length;
        const cur = currentRep();
        const isCurrent = cur && cur.item === it;
        return h('div', { class: `swim-item${isCurrent ? ' current' : ''}${doneCount === it.reps ? ' complete' : ''}` },
          h('div', { class: 'si-main' },
            h('span', { class: 'si-reps' }, `${it.reps} ×`),
            h('span', { class: 'si-what' }, describeItem(it, unit))),
          h('div', { class: 'si-meta' }, [
            it.rest ? `rest ${it.rest} s` : null,
            lengthsLabel(it, poolLen),
            it.dist ? `${it.dist * it.reps} ${unit} total` : null,
          ].filter(Boolean).join(' · ')),
          it.note ? h('div', { class: 'small ink-2' }, it.note) : null,
          howToLink(it),
          h('div', { class: 'rep-dots', role: 'group', 'aria-label': 'Reps' }, it.done.map((d, ri) => h('button', {
            class: `rep-dot${d ? ' done' : ''}`, type: 'button', 'aria-pressed': String(d), 'aria-label': `Rep ${ri + 1}`,
            onclick: () => { it.done[ri] = !it.done[ri]; persist(); draw(); },
          }, d ? icon(ICONS.check, 16) : String(ri + 1)))));
      })));
  }

  function draw() {
    const parts = [];
    const started = (session.blocks || []).some((b) => b.items.some((it) => it.done.some(Boolean)));
    if (live && !isFree && !started && !session.dryDone) parts.push(beforeYouGetIn());
    if (session.focus && !isFree) parts.push(h('p', { class: 'small ink-2' }, session.focus));
    if (isFree) parts.push(lapCounter());
    else {
      parts.push(focusCard());
      const total = session.blocks.reduce((n, b) => n + b.items.length, 0);
      parts.push(h('details', { class: 'disclosure all-sets', open: swimUi.allOpen || !live, ontoggle: (e) => { if (live) swimUi.allOpen = e.target.open; } },
        h('summary', null, `All sets · ${total} ${total === 1 ? 'set' : 'sets'}`),
        h('div', { class: 'stack lg' }, ...blockList(), lapCounter())));
    }
    if (live) {
      parts.push(h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => discardActive() }, 'Discard'),
        h('button', { class: 'btn pool', onclick: () => finishSession(session) }, 'Finish swim')));
    }
    fill(body, ...parts);
    updateHead();
  }

  const head = h('header', { class: 'session-head' },
    h('button', {
      class: 'icon-btn', 'aria-label': live ? 'Minimize swim' : 'Back',
      onclick: () => { if (live) { persist(); tab('today'); } else back(); },
    }, icon(live ? ICONS.close : ICONS.back)),
    h('div', { class: 'sh-title' }, h('span', { class: 'sh-name' }, session.name), clockEl),
    live
      ? h('button', { class: 'btn pool sm', onclick: () => finishSession(session) }, 'Finish')
      : h('button', {
        class: 'btn good sm', onclick: () => {
          session.distance = computeSwimDistance(session);
          store.saveSession(session);
          toast('Changes saved');
          back();
        },
      }, 'Save'));

  draw();
  put(view, head, body);
  if (live) {
    const bar = restBar({ onOpen: openClockSheet });
    put(view, bar.el);
    const id = setInterval(() => {
      if (!view.isConnected) { clearInterval(id); bar.destroy(); return; }
      updateHead();
    }, 1000);
  }
  return view;
}

registerRoute('swim-session', () => {
  const { active } = ctx();
  if (!active || active.kind !== 'swim') {
    setTimeout(() => tab('today'), 0);
    return h('div', { class: 'view' });
  }
  return swimEditor(active, 'live');
});

registerRoute('edit-swim', ({ id }) => {
  const s = ctx().sessions.find((x) => x.id === id);
  if (!s) { setTimeout(back, 0); return h('div', { class: 'view' }); }
  return swimEditor(JSON.parse(JSON.stringify(s)), 'edit');
});

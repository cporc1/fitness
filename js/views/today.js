// Today tab: the selected day's plan as compact cards (today by default; tap
// a day in the strip to look ahead or back without leaving the tab), this
// week's rings, and at most one banner.

import * as store from '../store.js';
import {
  h, s, icon, ICONS, todayISO, weekStart, addDays, parseISODate, WEEKDAYS_SHORT, WEEKDAYS_LONG,
  fmtDate, fmtNum, toNumber, daysBetween, put,
} from '../util.js';
import { go, registerRoute, render, tab } from '../app.js';
import { withTransition, sharedHero } from '../router.js';
import { planForDay, programWeek, PROGRAM_WEEKS, slotForDate, nextGymTemplate } from '../program.js';
import { TIPS } from '../data/guides.js';
import { weekSummary } from '../stats.js';
import { framesFor } from '../data/media.js';
import { startGym, startSwim, openStartPicker, openLogOther } from '../actions.js';
import { sectionHead, sheet, input, field, toast } from '../ui.js';
import { workoutSummary } from './workout.js';
import { sessionSummary } from './history.js';

const todayView = { date: null }; // null = today

/** Open Today on a given day (used by the History calendar). */
export function showDay(iso) {
  todayView.date = iso === todayISO() ? null : iso;
  tab('today');
}

function selectDay(iso) {
  const current = todayView.date || todayISO();
  if (iso === current) return;
  todayView.date = iso === todayISO() ? null : iso;
  withTransition(iso > current ? 'day-next' : 'day-prev', () => render());
}

function greeting(name) {
  const hr = new Date().getHours();
  const part = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

function kindOfSlot(state, slot) {
  if (slot.startsWith('custom:')) return state.custom?.templates?.find((t) => `custom:${t.id}` === slot)?.kind || 'gym';
  return slot;
}

// ---------------- week strip ----------------

function weekLabel(start, today) {
  const diff = daysBetween(weekStart(today), start) / 7;
  if (diff === 0) return 'This week';
  if (diff === -1) return 'Last week';
  if (diff === 1) return 'Next week';
  return `${fmtDate(start)} – ${fmtDate(addDays(start, 6))}`;
}

function weekStrip(state, date, today) {
  const start = weekStart(date);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    const kind = kindOfSlot(state, slotForDate(state.schedule, iso));
    const done = state.sessions.some((x) => x.date === iso);
    const missed = !done && iso < today && kind !== 'rest';
    let mark;
    if (done) mark = icon(ICONS.check, 15);
    else if (kind === 'both') mark = h('span', { class: 'both-icons' }, icon(ICONS.dumbbell, 11), icon(ICONS.wave, 11));
    else if (kind === 'gym') mark = icon(ICONS.dumbbell, 15);
    else if (kind === 'swim') mark = icon(ICONS.wave, 15);
    else mark = h('span', { class: 'rest-dot' });
    const label = { gym: 'gym', swim: 'swim', both: 'gym and swim', rest: 'rest' }[kind] || kind;
    cells.push(h('button', {
      class: `wday${iso === today ? ' is-today' : ''}`, type: 'button', 'aria-pressed': String(iso === date),
      'aria-label': `${WEEKDAYS_LONG[i]} ${fmtDate(iso)}: ${done ? 'done' : missed ? `${label}, missed` : label}`,
      onclick: () => selectDay(iso),
    },
    h('span', { class: 'wd-name' }, WEEKDAYS_SHORT[i].slice(0, 1)),
    h('span', { class: 'wd-num' }, String(parseISODate(iso).getDate())),
    h('span', { class: `wd-mark ${done ? 'done' : kind}${missed ? ' missed' : ''}` }, mark)));
  }
  const strip = h('div', { class: 'week-strip' }, cells);
  // Swipe sideways on the strip to change week.
  let touch = null;
  strip.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
  strip.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) selectDay(addDays(date, dx < 0 ? 7 : -7));
  });
  return h('div', { class: 'week' },
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Previous week', onclick: () => selectDay(addDays(date, -7)) }, icon(ICONS.back, 18)),
      h('span', { class: 'week-label' }, weekLabel(start, today)),
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Next week', onclick: () => selectDay(addDays(date, 7)) }, icon(ICONS.chevron, 18)),
      h('span', { class: 'grow' }),
      date !== today ? h('button', { class: 'today-pill', type: 'button', onclick: () => selectDay(today) }, 'Back to today') : null),
    strip);
}

// ---------------- cards ----------------

function kindChip(kind, step, total) {
  const label = kind === 'swim' ? 'Swim' : 'Gym';
  return h('span', { class: `chip ${kind}` }, icon(kind === 'swim' ? ICONS.wave : ICONS.dumbbell, 14), total > 1 ? `${label} · ${step} of ${total}` : label);
}

function thumbs(items) {
  const shown = items.slice(0, 5);
  return h('div', { class: 'wc-thumbs', 'aria-hidden': 'true' },
    shown.map(({ exId }) => {
      const f = framesFor(exId);
      return f ? h('img', { src: f.srcs[0], alt: '', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'wc-thumb-ph' }, icon(ICONS.dumbbell, 16));
    }),
    items.length > shown.length ? h('span', { class: 'wc-more' }, `+${items.length - shown.length}`) : null);
}

/** Compact card for one planned session: what it is, Start, and Details. */
function workoutCard(state, part, { step, total, canStart }) {
  const t = part.template;
  const sum = workoutSummary(t, state);
  const swim = sum.kind === 'swim';
  let card;
  const details = () => {
    card.style.viewTransitionName = 'wk-hero';
    sharedHero.id = t.id;
    go('workout', { id: t.id });
  };
  const body = swim
    ? [
      h('div', { class: 'wc-line' }, sum.blocks.map((b) => b.name).join(' · ')),
      t.focus ? h('p', { class: 'wc-hint' }, t.focus) : null]
    : [
      thumbs(sum.items),
      sum.ups
        ? h('p', { class: 'wc-hint up' }, icon(['M12 19V5', 'M5 12l7-7 7 7'], 14), `Ready to add weight on ${sum.ups} ${sum.ups === 1 ? 'exercise' : 'exercises'}`)
        : (t.focus ? h('p', { class: 'wc-hint' }, t.focus) : null)];
  card = h('article', { class: `wcard ${swim ? 'swim' : 'gym'}`, onclick: (e) => { if (!e.target.closest('button')) details(); } },
    h('div', { class: 'wc-head' },
      kindChip(sum.kind, step, total),
      h('span', { class: 'wc-meta' }, swim ? (sum.dist ? `${sum.dist} ${sum.unitD}` : 'Skills') : `~${sum.minutes} min · ${sum.items.length} exercises`)),
    h('h2', { class: 'wc-title' }, t.name),
    ...body,
    h('div', { class: 'wc-actions' },
      canStart ? h('button', {
        class: `btn ${swim ? 'pool' : 'iron'}`, type: 'button', onclick: () => (swim ? startSwim(t) : startGym(t)),
      }, icon(ICONS.play, 18), swim ? 'Start swim' : 'Start workout') : null,
      h('button', { class: 'btn quiet', type: 'button', onclick: details }, 'Details', icon(ICONS.chevron, 16))));
  if (sharedHero.id === t.id) {
    // Coming back from this workout's page: let its hero shrink back into the card.
    card.style.viewTransitionName = 'wk-hero';
    setTimeout(() => { if (sharedHero.id === t.id) sharedHero.id = null; card.style.viewTransitionName = ''; }, 700);
  }
  return card;
}

function doneCard(session, profile) {
  return h('button', { class: 'done-card', type: 'button', onclick: () => go('session-detail', { id: session.id }) },
    h('span', { class: `sr-icon ${session.kind}` }, icon(session.kind === 'swim' ? ICONS.wave : session.kind === 'gym' ? ICONS.dumbbell : ICONS.note)),
    h('span', { class: 'grow' },
      h('span', { class: 'dc-title' }, session.name),
      h('span', { class: 'dc-sub' }, sessionSummary(session, profile) || 'Logged')),
    h('span', { class: 'chip good' }, icon(ICONS.check, 14), 'Done'));
}

function restCard(state, date, isToday) {
  const d = parseISODate(date);
  const tip = TIPS[(d.getDate() + d.getMonth() * 31) % TIPS.length];
  const firstTime = isToday && !state.sessions.length;
  return h('section', { class: 'rest-card' },
    h('span', { class: 'chip', style: { alignSelf: 'flex-start' } }, icon(ICONS.rest, 14), 'Rest day'),
    h('h2', { class: 'wc-title' }, 'Recover and recharge'),
    h('p', { class: 'small ink-2' }, 'A 20–30 minute walk, good food, water and 7–9 hours of sleep. Rest is when you actually get stronger.'),
    h('div', { class: 'tip' }, icon(ICONS.info, 18), h('div', { class: 'stack', style: { gap: '2px' } }, h('span', { class: 'eyebrow' }, 'Tip of the day'), h('p', null, tip))),
    firstTime ? h('button', {
      class: 'btn iron lg block', type: 'button',
      onclick: () => startGym(nextGymTemplate(state.sessions, planForDay(state, date).phase.id, state.profile?.split)),
    }, icon(ICONS.play, 20), 'Start your first workout') : null,
    isToday ? h('div', { class: 'btn-row' },
      h('button', { class: 'btn quiet', type: 'button', onclick: openStartPicker }, firstTime ? 'Pick another' : 'Train anyway'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => openLogOther() }, 'Log a walk')) : null);
}

/** The cards for one day: planned sessions, done ones, or a rest card. */
function dayContent(state, date, today) {
  const isToday = date === today;
  const isPast = date < today;
  const plan = planForDay(state, date);
  const done = state.sessions.filter((x) => x.date === date);
  const out = [];

  if (isPast) {
    for (const x of done) out.push(doneCard(x, state.profile));
    if (!done.length && plan.parts.length) {
      out.push(h('div', { class: 'missed-card' },
        icon(ICONS.flag, 20),
        h('div', null,
          h('strong', null, `${plan.parts.map((p) => p.template.name).join(' + ')} was planned`),
          h('div', { class: 'small muted' }, 'Missed it? No problem: the plan doesn\'t skip ahead, so it\'s still next up.'))));
    }
    if (!done.length && !plan.parts.length) out.push(h('div', { class: 'missed-card' }, icon(ICONS.rest, 20), h('strong', null, 'Rest day')));
    out.push(h('button', { class: 'btn ghost', type: 'button', onclick: () => openLogOther(date) }, icon(ICONS.plus, 18), 'Log an activity on this day'));
    return out;
  }

  const pending = plan.parts.filter((p) => !(isToday && p.done));
  if (isToday && done.length && !pending.length) {
    out.push(h('section', { class: 'done-hero' },
      h('span', { class: 'chip good', style: { alignSelf: 'flex-start' } }, icon(ICONS.check, 14), 'Done today'),
      h('h2', { class: 'wc-title' }, 'Great work'),
      h('p', { class: 'small ink-2' }, 'Recover well: eat some protein, drink water and get a good night\'s sleep.'),
      h('button', { class: 'btn quiet', type: 'button', onclick: openStartPicker }, 'Train again')));
    for (const x of done) out.push(doneCard(x, state.profile));
    return out;
  }
  if (!plan.parts.length) {
    for (const x of done) out.push(doneCard(x, state.profile));
    out.push(restCard(state, date, isToday));
    return out;
  }

  const total = plan.parts.length;
  plan.parts.forEach((p, i) => {
    if (i > 0) out.push(h('div', { class: 'then', 'aria-hidden': 'true' }, 'then'));
    const doneOne = isToday && p.done && done.find((x) => x.kind === p.kind);
    out.push(doneOne ? doneCard(doneOne, state.profile) : workoutCard(state, p, { step: i + 1, total, canStart: isToday }));
  });
  // Anything else logged today (an extra swim, a walk) shows underneath.
  if (isToday) for (const x of done.filter((d) => !plan.parts.some((p) => p.kind === d.kind))) out.push(doneCard(x, state.profile));
  if (total > 1 && isToday && !done.length) out.push(h('p', { class: 'xs muted', style: { textAlign: 'center' } }, 'Lift first, then swim. Keep the swim easy if you\'re tired, or split them morning and evening.'));
  return out;
}

// ---------------- this week ----------------

function ring(frac, cls, animate) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return s('svg', { class: `ring ${cls}${animate ? ' animate' : ''}`, viewBox: '0 0 40 40', width: 40, height: 40, 'aria-hidden': 'true' },
    s('circle', { class: 'ring-track', cx: 20, cy: 20, r }),
    s('circle', {
      class: 'ring-fill', cx: 20, cy: 20, r,
      'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': (c * (1 - Math.min(1, frac))).toFixed(2), style: `--c: ${c.toFixed(2)}`,
    }));
}

function weekRings(state, today, entering) {
  const days = state.schedule?.days || [];
  const kinds = days.map((d) => kindOfSlot(state, d));
  const planned = {
    gym: kinds.filter((k) => k === 'gym' || k === 'both').length,
    swim: kinds.filter((k) => k === 'swim' || k === 'both').length,
  };
  const wk = weekSummary(state.sessions, today, state.profile?.pool?.unit || 'yd', state.profile?.units || 'lb');
  const item = (kind, label, doneN, plannedN) => h('div', { class: 'wr-item' },
    ring(plannedN ? doneN / plannedN : (doneN ? 1 : 0), kind, entering),
    h('div', null, h('div', { class: 'wr-value' }, `${doneN}`, h('span', null, `/${plannedN}`)), h('div', { class: 'wr-label' }, label)));
  return h('button', { class: 'week-rings', type: 'button', 'aria-label': `This week: ${wk.gym} of ${planned.gym} workouts and ${wk.swim} of ${planned.swim} swims. Open Progress.`, onclick: () => tab('progress') },
    h('div', { class: 'wr-head' }, h('span', { class: 'eyebrow' }, 'This week'), icon(ICONS.chevron, 16)),
    h('div', { class: 'wr-row' },
      item('gym', 'Workouts', wk.gym, planned.gym),
      item('swim', 'Swims', wk.swim, planned.swim),
      wk.swimDistance ? h('div', { class: 'wr-item' }, h('div', null, h('div', { class: 'wr-value' }, fmtNum(wk.swimDistance, 0), h('span', null, ` ${state.profile?.pool?.unit || 'yd'}`)), h('div', { class: 'wr-label' }, 'Swum'))) : null));
}

// ---------------- banners ----------------

function banner(state, today, week) {
  if (week > PROGRAM_WEEKS) {
    return h('div', { class: 'callout' }, h('strong', null, 'You finished the 12-week plan. '),
      'Keep going in Phase 3, or start a fresh cycle from Plan → Program with your new, heavier weights.');
  }
  // Data lives on the phone, so nudge for a backup every few weeks.
  const lastBackup = state.settings?.lastBackupAt?.slice(0, 10);
  if (store.sync.status !== 'synced' && state.sessions.length >= 3 && (!lastBackup || daysBetween(lastBackup, today) >= 21)) {
    return h('button', { class: 'card banner', type: 'button', onclick: () => go('data') },
      h('div', { class: 'eyebrow' }, lastBackup ? `Last backup ${fmtDate(lastBackup)}` : 'No backup yet'),
      h('div', { style: { fontWeight: 700 } }, `Back up your ${state.sessions.length} workouts (30 seconds) →`),
      h('div', { class: 'small muted' }, 'Your history is stored on this phone. A backup in iCloud Drive keeps it safe.'));
  }
  if (daysBetween(state.profile?.startDate || today, today) < 3 && !state.sessions.length) {
    return h('button', { class: 'card banner', type: 'button', onclick: () => go('guide', { id: 'start' }) },
      h('div', { class: 'eyebrow' }, 'New here?'),
      h('div', { style: { fontWeight: 700 } }, 'Read "Start here" (3 min) →'));
  }
  return null;
}

// ---------------- body & habits (only when turned on in Settings) ----------------

function checkIn(state, today) {
  const day = state.daily?.days?.[today] || {};
  const setDay = (patch) => store.update('daily', (d) => {
    const doc = d || { days: {} };
    doc.days = doc.days || {};
    doc.days[today] = { ...(doc.days[today] || {}), ...patch };
    return doc;
  });
  const counter = (label, key, step, max, unitText) => h('div', { class: 'counter' },
    h('button', { class: 'icon-btn', 'aria-label': `Less ${label}`, onclick: () => setDay({ [key]: Math.max(0, (day[key] || 0) - step) }) }, icon(ICONS.minus, 18)),
    h('div', { class: 'grow', style: { textAlign: 'center' } },
      h('div', { class: 'c-val num' }, `${fmtNum(day[key] || 0, 1)}`),
      h('div', { class: 'c-label' }, `${label}${unitText ? ` (${unitText})` : ''}`)),
    h('button', { class: 'icon-btn', 'aria-label': `More ${label}`, onclick: () => setDay({ [key]: Math.min(max, (day[key] || 0) + step) }) }, icon(ICONS.plus, 18)));
  const lastWeight = [...(state.body?.entries || [])].filter((e) => e.weight).sort((a, b) => b.date.localeCompare(a.date))[0];
  return h('section', { class: 'section' },
    sectionHead('Daily check-in', 'History', () => go('habits')),
    h('div', { class: 'checkin' },
      counter('Water', 'water', 1, 20, 'glasses'),
      counter('Sleep', 'sleep', 0.5, 14, 'hours'),
      h('button', { class: 'toggle-pill', 'aria-pressed': String(!!day.protein), onclick: () => setDay({ protein: !day.protein }) },
        icon(day.protein ? ICONS.check : ICONS.bolt, 18), 'Hit protein goal'),
      h('button', { class: 'toggle-pill', onclick: () => openWeighIn(state) },
        icon(ICONS.scale, 18), lastWeight?.date === today ? `${fmtNum(lastWeight.weight, 1)} ${state.profile?.units || 'lb'}` : 'Log weight')));
}

export function openWeighIn(state, dateIso = todayISO()) {
  const unit = state.profile?.units || 'lb';
  const existing = (state.body?.entries || []).find((e) => e.date === dateIso) || {};
  const weight = input({ id: 'wi-w', inputmode: 'decimal', value: existing.weight ?? '', placeholder: unit });
  const waist = input({ id: 'wi-waist', inputmode: 'decimal', value: existing.waist ?? '', placeholder: unit === 'kg' ? 'cm' : 'in' });
  sheet('Log body weight', (close) => h('div', { class: 'stack lg' },
    h('div', { class: 'field-row' }, field(`Weight (${unit})`, weight), field(`Waist (${unit === 'kg' ? 'cm' : 'in'}, optional)`, waist)),
    h('p', { class: 'small muted' }, 'Weigh in the morning, after the bathroom, before eating. Daily numbers bounce around; watch the weekly trend.'),
    h('button', {
      class: 'btn pool block lg', onclick: () => {
        const w = toNumber(weight.value);
        const wa = toNumber(waist.value);
        if (w == null && wa == null) { toast('Enter a weight or waist measurement'); return; }
        store.update('body', (b) => {
          const doc = b || { entries: [] };
          const i = doc.entries.findIndex((e) => e.date === dateIso);
          const entry = { ...(i >= 0 ? doc.entries[i] : { date: dateIso }), unit, weight: w ?? undefined, waist: wa ?? undefined };
          if (i >= 0) doc.entries[i] = entry; else doc.entries.push(entry);
          return doc;
        });
        close();
        toast('Saved');
      },
    }, 'Save')));
}

// ---------------- screen ----------------

registerRoute('today', (_params, state, { entering }) => {
  const today = todayISO();
  const date = todayView.date || today;
  const week = programWeek(state.profile, today);
  const programDone = week > PROGRAM_WEEKS;
  const view = h('div', { class: 'view' });
  put(view,
    h('header', { class: 'greet' },
      h('div', { class: 'row between' },
        h('div', { class: 'eyebrow' }, `${fmtDate(today, { weekday: true })} · ${programDone ? 'Plan complete' : `Week ${week} of ${PROGRAM_WEEKS}`}`),
        h('div', { class: 'row', style: { gap: '0', marginRight: '-10px' } },
          h('button', { class: 'icon-btn', 'aria-label': 'Start a different workout', onclick: openStartPicker }, icon(ICONS.plus, 24)),
          h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => go('settings') }, icon(ICONS.gear, 22)))),
      h('h1', null, greeting(state.profile?.name))),
    weekStrip(state, date, today),
    h('div', { class: 'day-content stack lg' },
      date !== today ? h('div', { class: 'eyebrow day-label' }, fmtDate(date, { weekday: true })) : null,
      dayContent(state, date, today)),
    weekRings(state, today, entering),
    banner(state, today, week),
    state.settings?.trackBody ? checkIn(state, today) : null);
  return view;
});

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, weekStart, addDays, parseISODate, WEEKDAYS_SHORT, WEEKDAYS_LONG, fmtDate, fmtNum, fmtClock, toNumber, daysBetween, put } from '../util.js';
import { go, back, registerRoute, render } from '../app.js';
import { planForDay, programWeek, PROGRAM_WEEKS, suggest, slotForDate, nextGymTemplate } from '../program.js';
import { expandForPool, workoutDistance } from '../data/swim.js';
import { getExercise } from '../data/exercises.js';
import { TIPS } from '../data/guides.js';
import { weekSummary, weekStreak } from '../stats.js';
import { startGym, startSwim, resumeActive, openStartPicker, openLogOther } from '../actions.js';
import { sectionHead, lanes, sheet, input, field, toast, topbar } from '../ui.js';

function greeting(name) {
  const hr = new Date().getHours();
  const part = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

function weekStrip(state, today) {
  const start = weekStart(today);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    const slot = slotForDate(state.schedule, iso);
    const done = state.sessions.some((s) => s.date === iso);
    const kind = slot.startsWith('custom:') ? (state.custom?.templates?.find((t) => `custom:${t.id}` === slot)?.kind || 'gym') : slot;
    let mark;
    if (done) mark = icon(ICONS.check, 16);
    else if (kind === 'both') mark = h('span', { class: 'both-icons' }, icon(ICONS.dumbbell, 12), icon(ICONS.wave, 12));
    else if (kind === 'gym') mark = icon(ICONS.dumbbell, 16);
    else if (kind === 'swim') mark = icon(ICONS.wave, 16);
    else mark = h('span', null, '·');
    const label = { gym: 'gym', swim: 'swim', both: 'gym and swim', rest: 'rest' }[kind] || kind;
    cells.push(h('button', {
      class: `wday${iso === today ? ' is-today' : ''}`, type: 'button',
      'aria-label': `${WEEKDAYS_LONG[i]}: ${done ? 'done' : label}`,
      onclick: () => go('day', { date: iso }),
    },
    h('span', { class: 'wd-name' }, WEEKDAYS_SHORT[i].slice(0, 3)),
    h('span', { class: 'wd-num' }, String(parseISODate(iso).getDate())),
    h('span', { class: `wd-mark ${done ? 'done' : kind}` }, mark)));
  }
  return h('div', { class: 'week-strip' }, cells);
}

function stepChip(kind, step) {
  const label = kind === 'swim' ? 'Swim' : 'Gym';
  return h('span', { class: `chip ${kind}` }, icon(kind === 'swim' ? ICONS.wave : ICONS.dumbbell, 14), step ? `${step} · ${label}` : label);
}

function swimHero(state, t, isToday, step) {
  const poolLen = state.profile?.pool?.len || 25;
  const poolUnit = state.profile?.pool?.unit || 'yd';
  const blocks = expandForPool(t.blocks || [], poolLen, state.profile?.swimLevel);
  const dist = workoutDistance(blocks);
  return h('section', { class: 'hero swim' },
    lanes('swim'),
    h('div', { class: 'row' }, stepChip('swim', step), h('span', { class: 'small muted' }, dist ? `${dist} ${poolUnit}` : 'Skills session')),
    h('h2', null, t.name),
    t.focus ? h('p', { class: 'ink-2' }, t.focus) : null,
    h('ul', { class: 'hero-list' }, blocks.map((b) => {
      const bd = b.items.reduce((sum, it) => sum + (it.dist || 0) * it.reps, 0);
      const reps = b.items.filter((it) => it.dist).map((it) => `${it.reps}×${it.dist}`).join(', ');
      const skills = b.items.length === 1 ? '1 skill' : `${b.items.length} skills`;
      return h('li', null, h('span', { class: 't' }, b.name), h('span', { class: 'v' }, bd ? `${reps} · ${bd} ${poolUnit}` : skills));
    })),
    isToday ? h('button', { class: 'btn pool lg block', onclick: () => startSwim(t) }, icon(ICONS.play, 20), 'Start swim') : null);
}

function gymHero(state, t, isToday, step) {
  const unit = state.profile?.units || 'lb';
  const exs = t.exercises || [];
  const swaps = t.split ? (state.swaps || {}) : {};
  const ups = exs.filter((item) => suggest(swaps[item.ex] || item.ex, item, state.sessions, unit).kind === 'up').length;
  return h('section', { class: 'hero gym' },
    lanes('gym'),
    h('div', { class: 'row' }, stepChip('gym', step), h('span', { class: 'small muted' }, `${exs.length} exercises · ~${Math.round(exs.reduce((m, e) => m + e.sets * (1 + (e.rest || 90) / 60), 0) + 8)} min`)),
    h('h2', null, t.name),
    t.focus ? h('p', { class: 'ink-2' }, t.focus) : null,
    h('ul', { class: 'hero-list' }, exs.map((item) => {
      const def = getExercise(swaps[item.ex] || item.ex);
      const w = def?.type === 'time' ? 's' : '';
      return h('li', null, h('button', { class: 'hero-link', type: 'button', onclick: () => go('exercise', { id: def?.id || item.ex }) },
        h('span', { class: 't' }, def?.name || item.ex),
        h('span', { class: 'v' }, `${item.sets} × ${item.reps[0]}–${item.reps[1]}${w}`, icon(ICONS.chevron, 14))));
    })),
    h('div', { class: 'xs muted' }, 'Tap an exercise to see how to do it.'),
    ups ? h('div', { class: 'small c-good', style: { fontWeight: 600 } }, `Ready to add weight on ${ups} ${ups === 1 ? 'exercise' : 'exercises'}`) : null,
    isToday ? h('button', { class: 'btn iron lg block', onclick: () => startGym(t) }, icon(ICONS.play, 20), 'Start workout') : null);
}

function doneRow(session) {
  return h('button', { class: 'done-row', type: 'button', onclick: () => go('session-detail', { id: session.id }) },
    h('span', { class: 'chip good' }, icon(ICONS.check, 14), 'Done'),
    h('span', { class: 'grow' }, session.name),
    icon(ICONS.chevron, 16));
}

/** The card(s) for a day's plan: one per session, or a rest/done card. */
export function planCard(state, dateIso) {
  const plan = planForDay(state, dateIso);
  const isToday = dateIso === todayISO();
  const pending = plan.parts.filter((p) => !(isToday && p.done));

  if (isToday && plan.doneToday.length && !pending.length) {
    const s = plan.doneToday[0];
    return h('section', { class: `hero ${s.kind === 'swim' ? 'swim' : s.kind === 'gym' ? 'gym' : ''}` },
      lanes(s.kind === 'swim' ? 'swim' : 'gym'),
      h('span', { class: 'chip good', style: { alignSelf: 'flex-start' } }, icon(ICONS.check, 14), 'Done today'),
      h('h2', null, plan.doneToday.map((x) => x.name).join(' + ')),
      h('p', { class: 'ink-2' }, 'Great work. Recover well: eat some protein, drink water, and get a good night\'s sleep.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => go('session-detail', { id: s.id }) }, 'View workout'),
        h('button', { class: 'btn quiet', onclick: openStartPicker }, 'Train again')));
  }

  if (!plan.parts.length) {
    return h('section', { class: 'hero' },
      h('span', { class: 'chip', style: { alignSelf: 'flex-start' } }, icon(ICONS.rest, 14), 'Rest day'),
      h('h2', null, 'Recover and recharge'),
      h('ul', { class: 'checklist' },
        h('li', null, 'A 20–30 minute walk keeps you moving without tiring you out'),
        h('li', null, 'Eat well and drink plenty of water'),
        h('li', null, 'Sleep 7–9 hours. This is when you actually get stronger')),
      isToday && !state.sessions.length ? h('div', { class: 'callout' }, 'Keen to get going? Your first session doesn\'t have to wait for a gym day.') : null,
      isToday && !state.sessions.length ? h('button', { class: 'btn iron lg block', onclick: () => startGym(nextGymTemplate(state.sessions, plan.phase.id, state.profile?.split)) }, icon(ICONS.play, 20), 'Start your first workout') : null,
      isToday ? h('div', { class: 'btn-row' },
        h('button', { class: 'btn quiet', onclick: openStartPicker }, state.sessions.length ? 'Train anyway' : 'Pick another'),
        h('button', { class: 'btn ghost', onclick: () => openLogOther() }, 'Log a walk')) : null);
  }

  const combo = plan.parts.length > 1;
  const cards = [];
  if (combo) {
    cards.push(h('div', { class: 'callout' }, h('strong', null, 'Gym + swim day. '),
      'Lift first, then swim. If your legs or shoulders are tired, keep the swim easy. Splitting them (morning and evening) works too.'));
  }
  plan.parts.forEach((p, i) => {
    const step = combo ? i + 1 : null;
    if (isToday && p.done) {
      const s = plan.doneToday.find((x) => x.kind === p.kind);
      if (s) { cards.push(doneRow(s)); return; }
    }
    cards.push(p.kind === 'swim' ? swimHero(state, p.template, isToday, step) : gymHero(state, p.template, isToday, step));
  });
  return cards.length === 1 ? cards[0] : h('div', { class: 'stack lg' }, cards);
}

function statTiles(state, today) {
  const poolUnit = state.profile?.pool?.unit || 'yd';
  const wk = weekSummary(state.sessions, today, poolUnit, state.profile?.units || 'lb');
  const planned = (state.schedule?.days || []).filter((d) => d !== 'rest').length;
  const streak = weekStreak(state.sessions, today, 2);
  return h('div', { class: 'stat-row' },
    h('div', { class: 'stat' }, h('span', { class: 's-label' }, 'This week'), h('span', null, h('span', { class: 's-val' }, String(wk.total)), h('span', { class: 's-unit' }, `/ ${planned}`))),
    h('div', { class: 'stat' }, h('span', { class: 's-label' }, 'Swum this week'), h('span', null, h('span', { class: 's-val' }, fmtNum(wk.swimDistance, 0)), h('span', { class: 's-unit' }, poolUnit))),
    h('div', { class: 'stat' }, h('span', { class: 's-label' }, 'Week streak'), h('span', null, h('span', { class: 's-val' }, String(streak)), h('span', { class: 's-unit' }, streak === 1 ? 'wk' : 'wks'))));
}

function checkIn(state, today) {
  const day = state.daily?.days?.[today] || {};
  const setDay = (patch) => store.update('daily', (d) => {
    const doc = d || { days: {} };
    doc.days = doc.days || {};
    doc.days[today] = { ...(doc.days[today] || {}), ...patch };
    return doc;
  });
  const counter = (label, key, step, max, unitText, ic) => h('div', { class: 'counter' },
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

registerRoute('today', (_params, state) => {
  const today = todayISO();
  const week = programWeek(state.profile, today);
  const plan = planForDay(state, today);
  const d = parseISODate(today);
  const tip = TIPS[(d.getDate() + d.getMonth() * 31) % TIPS.length];
  const programDone = week > PROGRAM_WEEKS;

  const view = h('div', { class: 'view' });
  put(view, 
    h('div', { class: 'greet' },
      h('div', { class: 'stack', style: { gap: '6px' } },
        h('div', { class: 'eyebrow' }, `${fmtDate(today, { weekday: true })} · ${programDone ? 'Plan complete' : `Week ${week} of ${PROGRAM_WEEKS}`} · ${plan.phase.name}`),
        h('h1', null, greeting(state.profile?.name))),
      h('button', { class: 'icon-btn', 'aria-label': 'Start a different workout', onclick: openStartPicker }, icon(ICONS.plus, 26))));

  if (state.active) {
    const a = state.active;
    const mins = Math.floor((Date.now() - new Date(a.startedAt)) / 1000);
    put(view, h('button', { class: 'resume-bar', onclick: resumeActive },
      h('span', { class: 'pulse' }),
      h('span', { class: 'grow' }, h('span', { class: 'r-title' }, `${a.name} in progress`), h('span', { class: 'r-sub' }, `Started ${fmtClock(mins)} ago · tap to continue`)),
      icon(ICONS.chevron)));
  }

  if (programDone) {
    put(view, h('div', { class: 'callout' }, h('strong', null, 'You finished the 12-week plan. '),
      'Keep going in Phase 3, or start a fresh cycle from Plan → Program settings with your new, heavier weights.'));
  }

  put(view, 
    weekStrip(state, today),
    planCard(state, today),
    h('button', { class: 'btn ghost', onclick: openStartPicker }, 'Do a different workout'),
    statTiles(state, today),
    state.settings?.trackBody ? checkIn(state, today) : null,
    h('div', { class: 'tip' }, icon(ICONS.info, 20), h('div', { class: 'stack', style: { gap: '2px' } }, h('span', { class: 'eyebrow' }, 'Tip of the day'), h('p', null, tip))));

  // Data lives on the phone, so nudge for a backup every few weeks.
  const lastBackup = state.settings?.lastBackupAt?.slice(0, 10);
  if (store.sync.status !== 'synced' && state.sessions.length >= 3 && (!lastBackup || daysBetween(lastBackup, today) >= 21)) {
    put(view, h('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => go('data') },
      h('div', { class: 'eyebrow' }, lastBackup ? `Last backup ${fmtDate(lastBackup)}` : 'No backup yet'),
      h('div', { style: { fontWeight: 700 } }, `Back up your ${state.sessions.length} workouts (30 seconds) →`),
      h('div', { class: 'small muted' }, 'Your history is stored on this phone. A backup in iCloud Drive keeps it safe.')));
  }

  if (daysBetween(state.profile?.startDate || today, today) < 3 && !state.sessions.length) {
    put(view, h('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => go('guide', { id: 'start' }) },
      h('div', { class: 'eyebrow' }, 'New here?'),
      h('div', { style: { fontWeight: 700 } }, 'Read "Start here" (3 min) →')));
  }
  return view;
});

registerRoute('day', ({ date }, state) => {
  const sessions = state.sessions.filter((s) => s.date === date);
  return h('div', { class: 'view' },
    topbar({ title: fmtDate(date, { weekday: true }), onBack: back }),
    planCard(state, date),
    sessions.length ? h('div', { class: 'card flush' }, h('div', { class: 'list' }, sessions.map((s) => h('button', { class: 'list-item', onclick: () => go('session-detail', { id: s.id }) },
      h('div', { class: 'grow' }, h('div', { class: 'li-title' }, s.name), h('div', { class: 'li-sub' }, 'Logged')), icon(ICONS.chevron, 18))))) : null,
    date <= todayISO() ? h('button', { class: 'btn ghost', onclick: () => openLogOther(date) }, 'Log an activity on this day') : null);
});

export { render };

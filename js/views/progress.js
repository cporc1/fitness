// Progress tab: Total / Workout / Swim over 1 week, 8 weeks, 12 weeks or 6
// months. The headline numbers compare with the period before; the charts,
// breakdowns, records and recent sessions all follow the switch.

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, fmtDate, fmtNum, addDays, fmtDuration, put } from '../util.js';
import { go, back, registerRoute, render } from '../app.js';
import { withTransition } from '../router.js';
import { countUp } from '../motion.js';
import { getExercise } from '../data/exercises.js';
import { GYM_TEMPLATES } from '../data/plans.js';
import {
  RANGES, progressSummary, setsByMuscleGroup, swimDistanceByStroke, weekRecords, weekStreak,
  exerciseHistory, swimDistance, sessionVolume, convertWeight, pacePer100,
} from '../stats.js';
import { lineChart, columnChart, stackedColumns, hBars } from '../charts.js';
import { pageHead, sectionHead, topbar, listItem, sheet, input, field, toast, confirmDialog } from '../ui.js';
import { openWeighIn } from './today.js';
import { sessionRow } from './history.js';

const MODE_LABEL = { total: 'Total', workout: 'Workout', swim: 'Swim' };
const PREVIOUS = { '1w': 'previous 7 days', '8w': 'previous 8 weeks', '12w': 'previous 12 weeks', '6m': 'previous 6 months' };
const view = { mode: 'total', range: '12w', lift: null, animate: false, shown: {} };

const fmtPace = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '—');
const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} m` : `${Math.round(m)} min`);

function setMode(m) {
  if (m === view.mode) return;
  view.mode = m;
  view.animate = true;
  withTransition('seg', () => render());
}

function setRange(r) {
  if (r === view.range) return;
  view.range = r;
  view.animate = true;
  render();
}

function modeSwitch() {
  return h('div', { class: 'mode-switch', role: 'tablist', 'aria-label': 'Show' }, Object.entries(MODE_LABEL).map(([m, label]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(m === view.mode), onclick: () => setMode(m),
  }, m === view.mode ? h('span', { class: 'mode-pill', 'aria-hidden': 'true' }) : null, h('span', { class: 'ms-label', style: `--ms: ms-${m}` }, label))));
}

function rangeChips() {
  return h('div', { class: 'range-chips', role: 'group', 'aria-label': 'Time range' }, RANGES.map((r) => h('button', {
    type: 'button', 'aria-pressed': String(r.id === view.range), onclick: () => setRange(r.id),
  }, r.label)));
}

/**
 * One headline number. better: 'up' (more is better) or 'down' (pace).
 * The value counts up when arriving, or from the last value after a switch.
 */
function kpi({ key, label, value, prev, format, deltaFormat = format, better = 'up', note }, animate) {
  const num = h('span', { class: 'kpi-value' });
  const last = view.shown[key];
  if (animate) countUp(num, last ?? 0, value || 0, format);
  else num.textContent = format(value || 0);
  view.shown[key] = value || 0;
  let delta = null;
  if (note) delta = h('span', { class: 'kpi-delta' }, note);
  else if (prev != null && value != null) {
    const diff = (value || 0) - (prev || 0);
    const good = better === 'up' ? diff > 0 : diff < 0;
    const text = Math.abs(diff) < 1e-9 ? `Same as ${PREVIOUS[view.range]}`
      : better === 'down' ? `${deltaFormat(Math.abs(diff))} ${diff < 0 ? 'faster' : 'slower'} than ${PREVIOUS[view.range]}`
        : `${diff > 0 ? '+' : '−'}${deltaFormat(Math.abs(diff))} vs ${PREVIOUS[view.range]}`;
    delta = h('span', { class: `kpi-delta${good ? ' good' : ''}` }, good ? icon(better === 'down' ? ['M12 5v14', 'M5 12l7 7 7-7'] : ['M12 19V5', 'M5 12l7-7 7 7'], 12) : null, text);
  }
  return h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, label), num, delta);
}

function kpiGrid(sum, state, animate) {
  const unit = state.profile?.units || 'lb';
  const unitD = state.profile?.pool?.unit || 'yd';
  const n = sum.now;
  const p = sum.prev;
  const whole = (v) => fmtNum(Math.round(v), 0);
  let items;
  if (sum.mode === 'workout') {
    items = [
      { key: 'w-count', label: 'Workouts', value: n.count, prev: p.count, format: whole },
      { key: 'w-volume', label: `Lifted (${unit})`, value: n.volume, prev: p.volume, format: whole },
      { key: 'w-sets', label: 'Sets', value: n.sets, prev: p.sets, format: whole },
      { key: 'w-prs', label: 'Personal records', value: n.prs, prev: p.prs, format: whole },
    ];
  } else if (sum.mode === 'swim') {
    items = [
      { key: 's-count', label: 'Swims', value: n.count, prev: p.count, format: whole },
      { key: 's-dist', label: `Distance (${unitD})`, value: n.distance, prev: p.distance, format: whole },
      { key: 's-time', label: 'Time in the water', value: n.minutes, prev: p.minutes, format: fmtMinutes, deltaFormat: (v) => fmtMinutes(v) },
      { key: 's-pace', label: `Pace per 100 ${unitD}`, value: n.pace || 0, prev: n.pace && p.pace ? p.pace : null, format: fmtPace, deltaFormat: (v) => `${Math.round(v)} s`, better: 'down', note: n.pace ? null : 'Finish a timed swim' },
    ];
  } else {
    items = [
      { key: 't-count', label: 'Sessions', value: n.count, prev: p.count, format: whole },
      { key: 't-time', label: 'Active time', value: n.minutes, prev: p.minutes, format: fmtMinutes, deltaFormat: (v) => fmtMinutes(v) },
      { key: 't-days', label: 'Active days', value: n.days, prev: p.days, format: whole },
      { key: 't-streak', label: 'Week streak', value: weekStreak(state.sessions, todayISO()), format: (v) => `${whole(v)} ${Math.round(v) === 1 ? 'week' : 'weeks'}`, note: 'Weeks in a row with 2+ sessions' },
    ];
  }
  return h('div', { class: 'kpi-grid' }, items.map((it) => kpi(it, animate)));
}

function bucketTitle(b) {
  return view.range === '1w' ? fmtDate(b.start, { weekday: true }) : `Week of ${fmtDate(b.start)}`;
}

function mainChart(sum, state, animate) {
  const per = view.range === '1w' ? 'day' : 'week';
  if (sum.mode === 'total') {
    return h('div', { class: 'card' },
      h('strong', null, `Sessions per ${per}`),
      stackedColumns({
        bars: sum.series.map((b) => ({ label: b.label, title: bucketTitle(b), values: { gym: b.gym, swim: b.swim, other: b.other } })),
        series: [{ key: 'gym', label: 'Workouts', color: 'var(--iron)' }, { key: 'swim', label: 'Swims', color: 'var(--pool)' }, { key: 'other', label: 'Other', color: 'var(--good)' }],
        unitWord: (label, v) => `${v} ${label.toLowerCase()}`,
        animate,
      }));
  }
  const unit = sum.mode === 'workout' ? (state.profile?.units || 'lb') : (state.profile?.pool?.unit || 'yd');
  return h('div', { class: 'card' },
    h('strong', null, sum.mode === 'workout' ? `Lifted per ${per} (${unit})` : `Swum per ${per} (${unit})`),
    columnChart({
      bars: sum.series.map((b) => ({ label: b.label, title: bucketTitle(b), value: Math.round(b.value) })),
      color: sum.mode === 'workout' ? 'var(--iron)' : 'var(--pool)', animate,
    }));
}

function liftedExercises(list) {
  const counts = new Map();
  for (const x of list) {
    if (x.kind !== 'gym') continue;
    for (const ex of x.exercises || []) {
      const def = getExercise(ex.ex);
      if (!def || !['weight', 'weight_time'].includes(def.type)) continue;
      counts.set(ex.ex, (counts.get(ex.ex) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function strength(sum, state, animate) {
  const unit = state.profile?.units || 'lb';
  const lifts = liftedExercises(sum.list);
  if (!lifts.length) {
    return h('div', { class: 'card' }, h('strong', null, 'Strength'), h('div', { class: 'chart-empty' }, 'Log a workout in this period to see your lifts.'));
  }
  if (!view.lift || !lifts.includes(view.lift)) view.lift = lifts[0];
  const from = sum.buckets[0].start;
  const hist = exerciseHistory(view.lift, state.sessions, unit).filter((x) => x.e1rm && x.date >= from).reverse();
  const first = hist[0];
  const last = hist[hist.length - 1];
  const change = first && last && hist.length > 1 ? last.e1rm - first.e1rm : 0;
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('strong', null, 'Strength'), h('span', { class: 'xs muted' }, 'Estimated 1-rep max')),
    h('div', { class: 'filter-row' }, lifts.slice(0, 8).map((id) => h('button', {
      type: 'button', 'aria-pressed': String(id === view.lift), onclick: () => { view.lift = id; view.animate = true; render(); },
    }, getExercise(id)?.name || id))),
    h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Now'), h('span', { class: 'v' }, last ? `${fmtNum(last.e1rm, 0)} ${unit}` : '—')),
      h('div', null, h('span', { class: 'k' }, 'Change'), h('span', { class: `v ${change > 0 ? 'c-good' : ''}` }, hist.length > 1 ? `${change >= 0 ? '+' : ''}${fmtNum(change, 0)}` : '—')),
      h('div', null, h('span', { class: 'k' }, 'Sessions'), h('span', { class: 'v' }, String(hist.length)))),
    lineChart({
      points: hist.map((x) => ({ x: x.date, y: x.e1rm })), color: 'var(--iron)', fmt: (v) => fmtNum(v, 0), animate,
      tipFmt: (p) => {
        const row = hist.find((x) => x.date === p.x);
        return `${fmtDate(p.x)}: est. 1RM ${fmtNum(p.y, 0)} ${unit}${row ? ` (best set ${fmtNum(row.best.w, 1)} × ${row.best.r})` : ''}`;
      },
    }),
    h('p', { class: 'xs muted' }, 'From your best set each session (Epley formula). You never need to test a true max.'));
}

function muscleGroups(sum, animate) {
  const groups = setsByMuscleGroup(sum.list);
  return h('div', { class: 'card' },
    h('strong', null, 'Sets per muscle group'),
    hBars({ items: groups.map((g) => ({ label: g.group, value: g.sets, display: `${g.sets}` })), color: 'var(--iron)', animate }));
}

function swimBreakdowns(sum, state, animate) {
  const unitD = state.profile?.pool?.unit || 'yd';
  const paced = sum.list.filter((x) => x.durationSec && swimDistance(x, unitD))
    .map((x) => ({ x: x.date, y: pacePer100(swimDistance(x, unitD), x.durationSec) })).reverse();
  const strokes = swimDistanceByStroke(sum.list, unitD);
  return [
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', null, `Pace per 100 ${unitD}`), h('span', { class: 'xs muted' }, 'Lower is fitter')),
      lineChart({ points: paced, color: 'var(--pool)', fmt: fmtPace, animate, tipFmt: (p) => `${fmtDate(p.x)}: ${fmtPace(p.y)} per 100 ${unitD}` }),
      h('p', { class: 'xs muted' }, 'Whole-session time divided by distance, rests included.')),
    h('div', { class: 'card' },
      h('strong', null, 'Distance by stroke'),
      hBars({ items: strokes.map((x) => ({ label: x.stroke, value: x.distance, display: `${fmtNum(x.distance, 0)} ${unitD}` })), color: 'var(--pool)', animate })),
  ];
}

function records(sum, state) {
  const rows = [];
  if (sum.mode === 'total') {
    const rec = weekRecords(state.sessions);
    rows.push(['Longest streak', rec.longestStreak ? `${rec.longestStreak} ${rec.longestStreak === 1 ? 'week' : 'weeks'}` : '—']);
    rows.push(['Busiest week', rec.busiest ? `${rec.busiest.count} sessions · ${fmtDate(rec.busiest.week)}` : '—']);
    rows.push(['All-time sessions', String(state.sessions.length)]);
  } else if (sum.mode === 'swim') {
    const unitD = state.profile?.pool?.unit || 'yd';
    const swims = state.sessions.filter((x) => x.kind === 'swim' && swimDistance(x, unitD));
    const longest = swims.reduce((best, x) => (!best || swimDistance(x, unitD) > swimDistance(best, unitD) ? x : best), null);
    const timed = swims.filter((x) => x.durationSec && swimDistance(x, unitD) >= 200);
    const fastest = timed.reduce((best, x) => {
      const pace = pacePer100(swimDistance(x, unitD), x.durationSec);
      return !best || pace < best.pace ? { x, pace } : best;
    }, null);
    rows.push(['Longest swim', longest ? `${fmtNum(swimDistance(longest, unitD), 0)} ${unitD} · ${fmtDate(longest.date)}` : '—']);
    rows.push(['Best session pace', fastest ? `${fmtPace(fastest.pace)} per 100 · ${fmtDate(fastest.x.date)}` : '—']);
  } else {
    const unit = state.profile?.units || 'lb';
    const prs = sum.list.flatMap((x) => (x.prs || []).map((pr) => ({ ...pr, date: x.date, unit: x.unit || unit }))).slice(0, 6);
    if (!prs.length) return h('div', { class: 'card' }, h('strong', null, 'Records'), h('p', { class: 'small muted' }, 'No new records in this period yet. They show up when you beat your best weight, reps or hold.'));
    return h('div', { class: 'card' }, h('strong', null, 'Records'),
      h('div', { class: 'pr-list' }, prs.map((pr) => h('div', { class: 'pr' }, icon(ICONS.trophy, 20),
        h('span', { class: 'grow' }, `${getExercise(pr.exId)?.name || pr.exId}: ${pr.kind === 'weight' ? `${fmtNum(convertWeight(pr.value, pr.unit, unit), 1)} ${unit}` : pr.kind === 'e1rm' ? `est. 1RM ${fmtNum(convertWeight(pr.value, pr.unit, unit), 0)} ${unit}` : pr.kind === 'time' ? `${pr.value} s hold` : `${pr.value} reps`}`),
        h('span', { class: 'xs muted' }, fmtDate(pr.date))))));
  }
  return h('div', { class: 'card' }, h('strong', null, 'Records'),
    h('div', { class: 'kv-rows' }, rows.map(([k, v]) => h('div', { class: 'row between' }, h('span', { class: 'small muted' }, k), h('strong', { class: 'num' }, v)))));
}

function recent(sum, state) {
  const pick = sum.mode === 'total' ? () => true : (x) => x.kind === (sum.mode === 'workout' ? 'gym' : 'swim');
  const list = state.sessions.filter(pick).slice(0, 5);
  return h('section', { class: 'section' },
    sectionHead('Recent', 'See all history', () => go('history')),
    list.length
      ? h('div', { class: 'card flush' }, h('div', { class: 'list' }, list.map((x) => sessionRow(x, state.profile))))
      : h('div', { class: 'chart-empty' }, 'Nothing logged yet. Your sessions will show up here.'));
}

function body(state) {
  const unit = state.profile?.units || 'lb';
  const entries = [...(state.body?.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
  const weights = entries.filter((e) => e.weight != null).map((e) => ({ x: e.date, y: convertWeight(e.weight, e.unit || unit, unit) }));
  const waists = entries.filter((e) => e.waist != null).map((e) => ({ x: e.date, y: e.waist }));
  const latest = weights[weights.length - 1];
  const monthAgo = weights.filter((p) => p.x <= addDays(todayISO(), -28)).pop();
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('strong', null, 'Body'), h('div', { class: 'row', style: { gap: '4px' } },
      h('button', { class: 'btn text sm', onclick: () => openWeighIn(state) }, icon(ICONS.plus, 16), 'Weight'),
      h('button', { class: 'btn text sm', onclick: () => openMeasurements(state) }, icon(ICONS.plus, 16), 'Measurements'))),
    h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Latest weight'), h('span', { class: 'v' }, latest ? `${fmtNum(latest.y, 1)} ${unit}` : '—')),
      h('div', null, h('span', { class: 'k' }, '4-week change'), h('span', { class: 'v' }, latest && monthAgo ? `${latest.y - monthAgo.y >= 0 ? '+' : ''}${fmtNum(latest.y - monthAgo.y, 1)}` : '—'))),
    lineChart({ points: weights, color: 'var(--pool)', fmt: (v) => fmtNum(v, 1) }),
    waists.length > 1 ? h('span', { class: 'small muted' }, `Waist (${unit === 'kg' ? 'cm' : 'in'})`) : null,
    waists.length > 1 ? lineChart({ points: waists, color: 'var(--good)', fmt: (v) => fmtNum(v, 1), height: 140 }) : null,
    h('button', { class: 'btn ghost sm', onclick: () => go('body-log') }, 'All entries'));
}

function openMeasurements(state, dateIso = todayISO()) {
  const unit = state.profile?.units || 'lb';
  const lenUnit = unit === 'kg' ? 'cm' : 'in';
  const existing = (state.body?.entries || []).find((e) => e.date === dateIso) || {};
  const keys = [['waist', 'Waist'], ['chest', 'Chest'], ['hips', 'Hips'], ['arm', 'Upper arm'], ['thigh', 'Thigh'], ['bodyFat', 'Body fat %']];
  const inputs = Object.fromEntries(keys.map(([k]) => [k, input({ id: `m-${k}`, inputmode: 'decimal', value: existing[k] ?? '', placeholder: k === 'bodyFat' ? '%' : lenUnit })]));
  sheet('Measurements', (close) => h('div', { class: 'stack lg' },
    h('p', { class: 'small muted' }, 'Measure once a month, same time of day, tape snug but not tight. Waist at the belly button.'),
    h('div', { class: 'field-row' }, keys.map(([k, l]) => field(k === 'bodyFat' ? l : `${l} (${lenUnit})`, inputs[k]))),
    h('button', {
      class: 'btn pool block lg', onclick: () => {
        store.update('body', (b) => {
          const doc = b || { entries: [] };
          const i = doc.entries.findIndex((e) => e.date === dateIso);
          const entry = { ...(i >= 0 ? doc.entries[i] : { date: dateIso, unit }) };
          for (const [k] of keys) {
            const v = Number(String(inputs[k].value).replace(',', '.'));
            entry[k] = inputs[k].value.trim() && Number.isFinite(v) ? v : undefined;
          }
          if (i >= 0) doc.entries[i] = entry; else doc.entries.push(entry);
          return doc;
        });
        close();
        toast('Measurements saved');
      },
    }, 'Save')));
}

const MILESTONES = [
  { id: 'first', title: 'First workout', sub: 'You showed up', test: (st) => st.sessions.length >= 1 },
  { id: 'first-swim', title: 'First swim', sub: 'In the water', test: (st) => st.sessions.some((s) => s.kind === 'swim') },
  { id: 'ten', title: '10 workouts', sub: 'A habit is forming', test: (st) => st.sessions.length >= 10 },
  { id: 'twentyfive', title: '25 workouts', sub: 'Officially a regular', test: (st) => st.sessions.length >= 25 },
  { id: 'fifty', title: '50 workouts', sub: 'Half a hundred', test: (st) => st.sessions.length >= 50 },
  { id: 'streak4', title: '4-week streak', sub: '2+ workouts, 4 weeks running', test: (st) => weekStreak(st.sessions, todayISO()) >= 4 },
  { id: 'mile', title: 'Swim a mile', sub: '1,760 yd / 1,609 m in total', test: (st) => st.sessions.reduce((sum, s) => sum + swimDistance(s, 'yd'), 0) >= 1760 },
  { id: 'k1', title: '1,000 in one swim', sub: 'One session, 1,000 yd/m', test: (st) => st.sessions.some((s) => s.kind === 'swim' && (s.distance || 0) >= 1000) },
  { id: 'pr', title: 'First PR', sub: 'Beat your own best', test: (st) => st.sessions.some((s) => s.prs?.length) },
  { id: 'phase2', title: 'Phase 2 started', sub: 'Barbell basics', test: (st) => st.sessions.some((s) => GYM_TEMPLATES.find((t) => t.id === s.templateId)?.phase >= 2) },
  { id: 'phase3', title: 'Phase 3 started', sub: 'Getting strong', test: (st) => st.sessions.some((s) => GYM_TEMPLATES.find((t) => t.id === s.templateId)?.phase >= 3) },
  { id: 'hundred-k', title: '100,000 lifted', sub: 'Total lb (or 45,000 kg)', test: (st) => st.sessions.reduce((sum, s) => sum + sessionVolume(s, 'lb'), 0) >= 100000 },
];

function milestones(state) {
  return h('div', { class: 'badge-grid' }, MILESTONES.map((m) => {
    const earned = m.test(state);
    return h('div', { class: `badge ${earned ? 'earned' : 'locked'}` },
      icon(ICONS.trophy, 22), h('span', { class: 'b-title' }, m.title), h('span', { class: 'b-sub' }, earned ? m.sub : `Locked · ${m.sub}`));
  }));
}

registerRoute('progress', (_p, state, { entering }) => {
  const animate = entering || view.animate;
  view.animate = false;
  if (entering) view.shown = {};
  const sum = progressSummary(state.sessions, {
    mode: view.mode, range: view.range, today: todayISO(),
    weightUnit: state.profile?.units || 'lb', poolUnit: state.profile?.pool?.unit || 'yd',
  });
  const v = h('div', { class: 'view' },
    pageHead('Progress', 'Your training, charted'),
    modeSwitch(),
    rangeChips(),
    kpiGrid(sum, state, animate),
    mainChart(sum, state, animate));
  if (sum.mode === 'workout') put(v, strength(sum, state, animate), muscleGroups(sum, animate));
  if (sum.mode === 'swim') put(v, ...swimBreakdowns(sum, state, animate));
  put(v, records(sum, state), recent(sum, state));
  if (sum.mode === 'total') {
    if (state.settings?.trackBody) put(v, body(state));
    put(v, h('section', { class: 'section' }, sectionHead('Milestones'), milestones(state)));
  }
  return v;
});

registerRoute('body-log', (_p, state) => {
  const unit = state.profile?.units || 'lb';
  const entries = [...(state.body?.entries || [])].sort((a, b) => b.date.localeCompare(a.date));
  return h('div', { class: 'view' },
    topbar({ title: 'Body log', onBack: back }),
    entries.length ? h('div', { class: 'card flush' }, h('div', { class: 'list' }, entries.map((e) => listItem({
      title: fmtDate(e.date, { weekday: true }),
      sub: [
        e.weight != null ? `${fmtNum(convertWeight(e.weight, e.unit || unit, unit), 1)} ${unit}` : null,
        e.waist != null ? `waist ${e.waist}` : null, e.chest != null ? `chest ${e.chest}` : null,
        e.hips != null ? `hips ${e.hips}` : null, e.arm != null ? `arm ${e.arm}` : null, e.thigh != null ? `thigh ${e.thigh}` : null,
        e.bodyFat != null ? `${e.bodyFat}% fat` : null,
      ].filter(Boolean).join(' · '),
      trailing: icon(ICONS.trash, 18),
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Delete this entry?', message: fmtDate(e.date, { weekday: true }), confirm: 'Delete', danger: true });
        if (!ok) return;
        store.update('body', (b) => { b.entries = b.entries.filter((x) => x.date !== e.date); return b; });
        toast('Entry deleted');
      },
    })))) : h('div', { class: 'chart-empty' }, 'No body entries yet.'),
    h('p', { class: 'small muted' }, 'Tap an entry to delete it.'));
});

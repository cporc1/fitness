// Progress tab: consistency, strength, swimming, body, milestones.

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, fmtDate, fmtNum, addDays, parseISODate } from '../util.js';
import { go, back, registerRoute, render } from '../app.js';
import { getExercise } from '../data/exercises.js';
import { GYM_TEMPLATES } from '../data/plans.js';
import {
  exerciseHistory, weeklySeries, swimDistance, sessionVolume, convertWeight, pacePer100, weekStreak,
} from '../stats.js';
import { lineChart, columnChart } from '../charts.js';
import { pageHead, sectionHead, segmented, topbar, listItem, sheet, input, field, toast, confirmDialog } from '../ui.js';
import { openWeighIn } from './today.js';

const view = { range: 12, lift: null };

function weekLabel(iso) {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function consistency(state) {
  const series = weeklySeries(state.sessions, todayISO(), view.range, (list) => list.length);
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('strong', null, 'Workouts per week'), h('span', { class: 'small muted' }, `${weekStreak(state.sessions, todayISO())} week streak`)),
    columnChart({ bars: series.map((w) => ({ label: weekLabel(w.week), title: `Week of ${fmtDate(w.week)}`, value: w.value })), color: 'var(--good)' }));
}

function liftedExercises(state) {
  const counts = new Map();
  for (const s of state.sessions) {
    if (s.kind !== 'gym') continue;
    for (const ex of s.exercises || []) {
      const def = getExercise(ex.ex);
      if (!def || !['weight', 'weight_time'].includes(def.type)) continue;
      counts.set(ex.ex, (counts.get(ex.ex) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function strength(state) {
  const unit = state.profile?.units || 'lb';
  const lifts = liftedExercises(state);
  if (!lifts.length) {
    return h('div', { class: 'card' }, h('strong', null, 'Strength'), h('div', { class: 'chart-empty' }, 'Log a gym workout to start tracking your lifts.'));
  }
  if (!view.lift || !lifts.includes(view.lift)) view.lift = lifts[0];
  const hist = exerciseHistory(view.lift, state.sessions, unit).filter((x) => x.e1rm).reverse();
  const first = hist[0];
  const last = hist[hist.length - 1];
  const change = first && last && hist.length > 1 ? last.e1rm - first.e1rm : 0;
  const sel = h('select', {
    class: 'input', id: 'lift-select', 'aria-label': 'Exercise',
    onchange: (e) => { view.lift = e.target.value; render(); },
  }, lifts.map((id) => h('option', { value: id, selected: id === view.lift }, getExercise(id)?.name || id)));

  const series = weeklySeries(state.sessions, todayISO(), view.range, (list) => list.reduce((sum, s) => sum + sessionVolume(s, unit), 0));
  return h('div', { class: 'card' },
    h('strong', null, 'Strength'),
    sel,
    h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Est. 1-rep max'), h('span', { class: 'v' }, last ? `${fmtNum(last.e1rm, 0)} ${unit}` : '—')),
      h('div', null, h('span', { class: 'k' }, 'Since first log'), h('span', { class: `v ${change > 0 ? 'c-good' : ''}` }, hist.length > 1 ? `${change >= 0 ? '+' : ''}${fmtNum(change, 0)}` : '—')),
      h('div', null, h('span', { class: 'k' }, 'Sessions'), h('span', { class: 'v' }, String(hist.length)))),
    lineChart({
      points: hist.map((x) => ({ x: x.date, y: x.e1rm })), color: 'var(--iron)', fmt: (v) => fmtNum(v, 0),
      tipFmt: (p) => {
        const row = hist.find((x) => x.date === p.x);
        return `${fmtDate(p.x)}: est. 1RM ${fmtNum(p.y, 0)} ${unit}${row ? ` (best set ${fmtNum(row.best.w, 1)} × ${row.best.r})` : ''}`;
      },
    }),
    h('p', { class: 'xs muted' }, 'Estimated 1-rep max from your best set each session (Epley formula). You never need to test a true max.'),
    h('div', { class: 'divider' }),
    h('strong', null, `Weekly volume (${unit} lifted)`),
    columnChart({ bars: series.map((w) => ({ label: weekLabel(w.week), title: `Week of ${fmtDate(w.week)}`, value: Math.round(w.value) })), color: 'var(--iron)' }));
}

function swimming(state) {
  const unitD = state.profile?.pool?.unit || 'yd';
  const swims = state.sessions.filter((s) => s.kind === 'swim' && s.distance);
  if (!swims.length) {
    return h('div', { class: 'card' }, h('strong', null, 'Swimming'), h('div', { class: 'chart-empty' }, 'Finish a swim to start tracking distance and pace.'));
  }
  const series = weeklySeries(state.sessions, todayISO(), view.range, (list) => list.reduce((sum, s) => sum + swimDistance(s, unitD), 0));
  const total = swims.reduce((sum, s) => sum + swimDistance(s, unitD), 0);
  const longest = Math.max(...swims.map((s) => swimDistance(s, unitD)));
  const paced = swims.filter((s) => s.durationSec).map((s) => ({ x: s.date, y: pacePer100(swimDistance(s, unitD), s.durationSec) })).reverse();
  return h('div', { class: 'card' },
    h('strong', null, 'Swimming'),
    h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Total'), h('span', { class: 'v' }, `${fmtNum(total, 0)} ${unitD}`)),
      h('div', null, h('span', { class: 'k' }, 'Longest session'), h('span', { class: 'v' }, `${fmtNum(longest, 0)}`)),
      h('div', null, h('span', { class: 'k' }, 'Swims'), h('span', { class: 'v' }, String(swims.length)))),
    h('span', { class: 'small muted' }, `Distance per week (${unitD})`),
    columnChart({ bars: series.map((w) => ({ label: weekLabel(w.week), title: `Week of ${fmtDate(w.week)}`, value: Math.round(w.value) })), color: 'var(--pool)' }),
    paced.length > 1 ? h('span', { class: 'small muted' }, `Session time per 100 ${unitD} (includes rests, lower is fitter)`) : null,
    paced.length > 1 ? lineChart({ points: paced, color: 'var(--pool)', fmt: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` }) : null);
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

registerRoute('progress', (_p, state) => h('div', { class: 'view' },
  pageHead('Progress', 'Your training, charted'),
  segmented([{ value: 8, label: '8 weeks' }, { value: 12, label: '12 weeks' }, { value: 26, label: '6 months' }], view.range, (v) => { view.range = v; render(); }, 'Time range'),
  consistency(state),
  strength(state),
  swimming(state),
  body(state),
  h('section', { class: 'section' }, sectionHead('Milestones'), milestones(state))));

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

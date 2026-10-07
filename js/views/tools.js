// Learn → Tools: plate calculator, 1-rep max, swim pace, calories & protein.

import * as store from '../store.js';
import { h, fmtNum, toNumber, parseClock, KG_PER_LB, fill } from '../util.js';
import { back, registerRoute, render } from '../app.js';
import { e1rm, platesPerSide, DEFAULT_PLATES, DEFAULT_BAR, nutritionTargets, ACTIVITY, pacePer100 } from '../stats.js';
import { topbar, segmented, input, field, select } from '../ui.js';

function plateTool(state) {
  const unit = state.profile?.units || 'lb';
  const plates = state.settings?.plates?.[unit] || DEFAULT_PLATES[unit];
  const out = h('div', { class: 'stack' });
  const target = input({ id: 'pl-target', inputmode: 'decimal', placeholder: unit === 'kg' ? '60' : '135' });
  const bar = input({ id: 'pl-bar', inputmode: 'decimal', value: String(DEFAULT_BAR[unit]) });
  const PLATE_COLORS = { 45: '#c0392b', 25: '#2c6fbb', 35: '#d4a017', 10: '#2e8b57', 5: '#555', 2.5: '#777', 20: '#2c6fbb', 15: '#d4a017', 1.25: '#888' };
  const calc = () => {
    const t = toNumber(target.value);
    const b = toNumber(bar.value) || DEFAULT_BAR[unit];
    if (!t) { fill(out, h('p', { class: 'small muted' }, 'Enter the total weight you want on the bar.')); return; }
    const r = platesPerSide(t, b, plates);
    const maxP = Math.max(...plates);
    const side = r.perSide.map((p) => h('div', {
      class: 'plate', title: `${p} ${unit}`,
      style: { background: PLATE_COLORS[p] || '#666', height: `${46 + (p / maxP) * 70}px`, width: `${p >= 10 ? 18 : 12}px` },
    }, String(p)));
    fill(out, 
      h('div', { class: 'plate-viz', 'aria-hidden': 'true' },
        h('div', { class: 'sleeve' }), ...[...side].reverse().map((n) => n.cloneNode(true)), h('div', { class: 'bar' }), ...side, h('div', { class: 'sleeve' })),
      h('p', null, r.perSide.length ? h('strong', null, `Each side: ${r.perSide.join(' + ')} ${unit}`) : h('strong', null, 'Just the bar')),
      r.remainder ? h('p', { class: 'small c-danger' }, `Closest you can load: ${fmtNum(r.loaded, 2)} ${unit} (${fmtNum(r.remainder, 2)} short).`) : null);
  };
  target.addEventListener('input', calc);
  bar.addEventListener('input', calc);
  calc();
  return h('div', { class: 'card' },
    h('strong', null, 'Plate calculator'),
    h('div', { class: 'field-row' }, field(`Target (${unit})`, target), field(`Bar (${unit})`, bar)),
    out,
    h('p', { class: 'xs muted' }, `Plates: ${plates.join(', ')} ${unit}. Standard Olympic bar is ${DEFAULT_BAR[unit]} ${unit}.`));
}

function oneRmTool(state) {
  const unit = state.profile?.units || 'lb';
  const w = input({ id: 'rm-w', inputmode: 'decimal', placeholder: unit });
  const r = input({ id: 'rm-r', inputmode: 'numeric', placeholder: 'reps' });
  const out = h('div');
  const calc = () => {
    const wv = toNumber(w.value);
    const rv = toNumber(r.value);
    if (!wv || !rv) { fill(out, h('p', { class: 'small muted' }, 'Enter a recent set to estimate your max and training weights.')); return; }
    const max = e1rm(wv, rv);
    fill(out, 
      h('div', { class: 'kv' }, h('div', null, h('span', { class: 'k' }, 'Estimated 1-rep max'), h('span', { class: 'v' }, `${fmtNum(max, 0)} ${unit}`))),
      h('div', { class: 'stack', style: { gap: '2px' } }, [[90, 3], [85, 5], [80, 8], [75, 10], [70, 12], [65, 15]].map(([pct, reps]) => h('div', { class: 'row between small num' },
        h('span', { class: 'muted' }, `${pct}% · about ${reps} reps`), h('strong', null, `${fmtNum(max * pct / 100, 0)} ${unit}`)))),
      rv > 12 ? h('p', { class: 'xs muted' }, 'Estimates get less accurate above 12 reps.') : null);
  };
  w.addEventListener('input', calc);
  r.addEventListener('input', calc);
  calc();
  return h('div', { class: 'card' }, h('strong', null, '1-rep max estimate'), h('div', { class: 'field-row' }, field(`Weight (${unit})`, w), field('Reps', r)), out);
}

function paceTool(state) {
  const unitD = state.profile?.pool?.unit || 'yd';
  const dist = input({ id: 'pc-d', inputmode: 'numeric', placeholder: '400' });
  const time = input({ id: 'pc-t', inputmode: 'text', placeholder: 'mm:ss' });
  const out = h('div');
  const calc = () => {
    const d = toNumber(dist.value);
    const t = parseClock(time.value);
    if (!d || !t) { fill(out, h('p', { class: 'small muted' }, 'Enter a distance and time (e.g. 400 and 9:30) to get your pace.')); return; }
    const pace = pacePer100(d, t);
    const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
    fill(out, h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, `Pace per 100 ${unitD}`), h('span', { class: 'v' }, fmt(pace))),
      h('div', null, h('span', { class: 'k' }, `Predicted 1,000 ${unitD}`), h('span', { class: 'v' }, fmt(pace * 10 * 1.05)))),
    h('p', { class: 'xs muted' }, 'Prediction adds 5% for the longer distance. Use your pace to set intervals: for 100s, leave about 15–20 s slower than your pace.'));
  };
  dist.addEventListener('input', calc);
  time.addEventListener('input', calc);
  calc();
  return h('div', { class: 'card' }, h('strong', null, 'Swim pace'), h('div', { class: 'field-row' }, field(`Distance (${unitD})`, dist), field('Time', time)), out);
}

function nutritionTool(state) {
  const p = state.profile || {};
  const unit = p.units || 'lb';
  const n = p.nutrition || {};
  const lastW = [...(state.body?.entries || [])].filter((e) => e.weight).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;
  const weight = input({ id: 'nu-w', inputmode: 'decimal', value: n.weight ?? lastW ?? '', placeholder: unit });
  const height = input({ id: 'nu-h', inputmode: 'decimal', value: n.height ?? '', placeholder: unit === 'kg' ? 'cm' : 'in' });
  const age = input({ id: 'nu-a', inputmode: 'numeric', value: n.age ?? '', placeholder: 'years' });
  const sex = select([{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Prefer not to say' }], n.sex || 'other', { id: 'nu-s' });
  const activity = select(ACTIVITY.map((a) => ({ value: a.id, label: a.label })), n.activity || 'light', { id: 'nu-act' });
  const goalMap = { lose: 'lose', muscle: 'muscle' };
  const goal = select([{ value: 'lose', label: 'Lose fat (−400 kcal)' }, { value: 'health', label: 'Maintain' }, { value: 'muscle', label: 'Build muscle (+250 kcal)' }], n.goal || goalMap[p.goal] || 'health', { id: 'nu-g' });
  const out = h('div');
  const calc = () => {
    const w = toNumber(weight.value);
    const hgt = toNumber(height.value);
    const a = toNumber(age.value);
    const weightKg = unit === 'kg' ? w : w * KG_PER_LB;
    const heightCm = unit === 'kg' ? hgt : hgt * 2.54;
    const t = w && hgt && a ? nutritionTargets({ weightKg, heightCm, age: a, sex: sex.value, activity: activity.value, goal: goal.value }) : null;
    if (!t) { fill(out, h('p', { class: 'small muted' }, 'Fill in your details for a starting estimate.')); return; }
    const pLow = t.proteinLow;
    const pHigh = t.proteinHigh;
    fill(out, 
      h('div', { class: 'kv' },
        h('div', null, h('span', { class: 'k' }, 'Daily calories'), h('span', { class: 'v' }, fmtNum(t.target, 0))),
        h('div', null, h('span', { class: 'k' }, 'Protein (g/day)'), h('span', { class: 'v' }, `${pLow}–${pHigh}`)),
        h('div', null, h('span', { class: 'k' }, 'Water (L/day)'), h('span', { class: 'v' }, `about ${fmtNum(t.waterLiters, 1)}`))),
      t.floored ? h('p', { class: 'small c-danger' }, 'Slower loss is safer at your size, so this target stops at a safe minimum. Talk to a dietitian before eating less.') : null,
      h('p', { class: 'xs muted' }, `Maintenance is about ${fmtNum(t.maintenance, 0)} kcal. This is an estimate: track your weight for 2–3 weeks and adjust by 100–200 kcal if it moves faster or slower than you want. Water: drink to thirst, plus about 0.5 L for each hour of training. Have kidney disease? Ask your doctor about protein first.`));
    store.update('profile', (x) => ({ ...x, nutrition: { weight: w, height: hgt, age: a, sex: sex.value, activity: activity.value, goal: goal.value } }), { silent: true });
  };
  for (const el of [weight, height, age]) el.addEventListener('change', calc);
  for (const el of [sex, activity, goal]) el.addEventListener('change', calc);
  calc();
  return h('div', { class: 'card' },
    h('strong', null, 'Calories & protein'),
    h('div', { class: 'field-row' }, field(`Weight (${unit})`, weight), field(`Height (${unit === 'kg' ? 'cm' : 'in'})`, height), field('Age', age)),
    h('div', { class: 'field-row' }, field('Sex', sex), field('Goal', goal)),
    field('Activity', activity),
    out);
}

const toolState = { tab: 'plates' };
registerRoute('tools', ({ tool }, state, { entering }) => {
  const tools = { plates: plateTool, max: oneRmTool, pace: paceTool, food: nutritionTool };
  if (entering && tools[tool]) toolState.tab = tool;
  return h('div', { class: 'view' },
    topbar({ title: 'Tools', onBack: back }),
    segmented([{ value: 'plates', label: 'Plates' }, { value: 'max', label: '1RM' }, { value: 'pace', label: 'Pace' }, { value: 'food', label: 'Food' }], toolState.tab, (v) => { toolState.tab = v; render(); }, 'Tool'),
    tools[toolState.tab](state));
});

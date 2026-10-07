// More tab: Learn, Library, Tools, Habits, Settings and backups.

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, addDays, fmtDate, fmtNum, toNumber, parseClock, KG_PER_LB, put, fill } from '../util.js';
import { ctx, go, back, tab, registerRoute, render } from '../app.js';
import { resetOnboarding } from './onboarding.js';
import { stopRest } from '../timer.js';
import { GUIDES } from '../data/guides.js';
import { e1rm, platesPerSide, DEFAULT_PLATES, DEFAULT_BAR, nutritionTargets, ACTIVITY, pacePer100 } from '../stats.js';
import { pageHead, topbar, listItem, segmented, input, field, select, confirmDialog, toast, sheet } from '../ui.js';

const POOL_OPTIONS = [
  { key: '25yd', len: 25, unit: 'yd', label: '25 yd' },
  { key: '25m', len: 25, unit: 'm', label: '25 m' },
  { key: '50m', len: 50, unit: 'm', label: '50 m' },
];

registerRoute('more', (_p, state) => {
  const syncLine = store.sync.status === 'synced' ? 'Synced to your Claude account'
    : store.sync.status === 'error' ? (store.sync.error || 'Sync paused')
      : store.sync.status === 'syncing' ? 'Syncing…' : 'Saved on this device';
  return h('div', { class: 'view' },
    pageHead('More', state.profile?.name ? `Hi ${state.profile.name}` : null),
    h('div', { class: 'card flush' }, h('div', { class: 'list' },
      listItem({ title: 'Learn', sub: `${GUIDES.length} short beginner guides`, leading: icon(ICONS.book), onclick: () => go('learn') }),
      listItem({ title: 'Exercise library', sub: 'How-to for every exercise and swim drill', leading: icon(ICONS.dumbbell), onclick: () => go('library') }),
      listItem({ title: 'Tools', sub: 'Plates, 1-rep max, swim pace, calories & protein', leading: icon(ICONS.tool), onclick: () => go('tools') }),
      listItem({ title: 'Habits', sub: 'Water, sleep and protein history', leading: icon(ICONS.drop), onclick: () => go('habits') }))),
    h('div', { class: 'card flush' }, h('div', { class: 'list' },
      listItem({ title: 'Settings', sub: 'Units, pool, rest timer, theme', leading: icon(ICONS.gear), onclick: () => go('settings') }),
      listItem({ title: 'Backup & data', sub: `${syncLine} · backup, restore, start over`, leading: icon(ICONS.download), onclick: () => go('data') }),
      listItem({ title: 'Install on iPhone', sub: 'Add to your Home Screen', leading: icon(ICONS.upload), onclick: () => go('install') }))),
    h('p', { class: 'xs muted', style: { textAlign: 'center' } }, 'Lift & Lap · general fitness guidance, not medical advice.'));
});

// ---------------- learn ----------------

registerRoute('learn', () => h('div', { class: 'view' },
  topbar({ title: 'Learn', onBack: back }),
  pageHead('Learn', 'Beginner essentials'),
  h('div', { class: 'card flush' }, h('div', { class: 'list' }, GUIDES.map((g) => listItem({
    title: g.title, sub: `${g.mins} min · ${g.summary}`, onclick: () => go('guide', { id: g.id }),
  }))))));

registerRoute('guide', ({ id }) => {
  const g = GUIDES.find((x) => x.id === id);
  if (!g) return h('div', { class: 'view' }, topbar({ title: 'Guide', onBack: back }));
  const i = GUIDES.indexOf(g);
  const next = GUIDES[i + 1];
  const blocks = g.body.map((b) => {
    if (b.h) return h('h3', null, b.h);
    if (b.p) return h('p', null, b.p);
    if (b.ul) return h('ul', null, b.ul.map((x) => h('li', null, x)));
    if (b.ol) return h('ol', null, b.ol.map((x) => h('li', null, x)));
    if (b.tip) return h('div', { class: 'callout' }, b.tip);
    if (b.warn) return h('div', { class: 'callout warn' }, b.warn);
    return null;
  });
  return h('div', { class: 'view' },
    topbar({ title: '', onBack: back }),
    pageHead(g.title, `${g.mins} min read`),
    h('article', { class: 'prose' }, blocks),
    next ? h('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => { back(); go('guide', { id: next.id }); } },
      h('div', { class: 'eyebrow' }, 'Next'), h('strong', null, `${next.title} →`)) : null);
});

// ---------------- tools ----------------

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
  const activity = select(ACTIVITY.map((a) => ({ value: a.id, label: a.label })), n.activity || 'moderate', { id: 'nu-act' });
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
    const pLow = unit === 'kg' ? t.proteinLow : Math.round(w * 0.7);
    const pHigh = unit === 'kg' ? t.proteinHigh : Math.round(w * 1.0);
    fill(out, 
      h('div', { class: 'kv' },
        h('div', null, h('span', { class: 'k' }, 'Daily calories'), h('span', { class: 'v' }, fmtNum(t.target, 0))),
        h('div', null, h('span', { class: 'k' }, 'Protein (g/day)'), h('span', { class: 'v' }, `${pLow}–${pHigh}`)),
        h('div', null, h('span', { class: 'k' }, 'Water (L/day)'), h('span', { class: 'v' }, `${fmtNum(t.waterLiters, 1)}+`))),
      h('p', { class: 'xs muted' }, `Maintenance is about ${fmtNum(t.maintenance, 0)} kcal. This is an estimate: track your weight for 2–3 weeks and adjust by 100–200 kcal if it moves faster or slower than you want.`));
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
registerRoute('tools', (_p, state) => {
  const tools = { plates: plateTool, max: oneRmTool, pace: paceTool, food: nutritionTool };
  return h('div', { class: 'view' },
    topbar({ title: 'Tools', onBack: back }),
    segmented([{ value: 'plates', label: 'Plates' }, { value: 'max', label: '1RM' }, { value: 'pace', label: 'Pace' }, { value: 'food', label: 'Food' }], toolState.tab, (v) => { toolState.tab = v; render(); }, 'Tool'),
    tools[toolState.tab](state));
});

// ---------------- habits ----------------

registerRoute('habits', (_p, state) => {
  const days = state.daily?.days || {};
  const today = todayISO();
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i);
    const v = days[d] || {};
    rows.push(h('div', { class: 'list-item', style: { cursor: 'default' } },
      h('div', { class: 'grow' }, h('div', { class: 'li-title' }, i === 0 ? 'Today' : fmtDate(d, { weekday: true }))),
      h('span', { class: 'small num', style: { width: '74px' } }, `${v.water || 0} glasses`),
      h('span', { class: 'small num', style: { width: '52px' } }, v.sleep ? `${v.sleep} h` : '– h'),
      h('span', { class: `chip ${v.protein ? 'good' : 'plain'}` }, v.protein ? 'Protein' : '—')));
  }
  const last7 = Array.from({ length: 7 }, (_, i) => days[addDays(today, -i)] || {});
  const avgSleep = last7.filter((d) => d.sleep).reduce((s, d, _i, arr) => s + d.sleep / arr.length, 0);
  const proteinDays = last7.filter((d) => d.protein).length;
  return h('div', { class: 'view' },
    topbar({ title: 'Habits', onBack: back }),
    h('div', { class: 'card' }, h('div', { class: 'kv' },
      h('div', null, h('span', { class: 'k' }, 'Avg sleep (7 days)'), h('span', { class: 'v' }, avgSleep ? `${fmtNum(avgSleep, 1)} h` : '—')),
      h('div', null, h('span', { class: 'k' }, 'Protein goal hit'), h('span', { class: 'v' }, `${proteinDays}/7`)))),
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, rows)),
    h('p', { class: 'small muted' }, 'Log these from the daily check-in on the Today tab.'));
});

// ---------------- settings ----------------

registerRoute('settings', (_p, state) => {
  const p = state.profile || {};
  const st = state.settings || {};
  const setProfile = (patch) => store.update('profile', (x) => ({ ...x, ...patch }));
  const setSettings = (patch) => store.update('settings', (x) => ({ ...x, ...patch }));
  const nameIn = input({ id: 'st-name', value: p.name || '', autocapitalize: 'words', onchange: (e) => setProfile({ name: e.target.value.trim() }) });
  const restC = input({ id: 'st-rc', inputmode: 'numeric', value: st.restCompound ?? 120, onchange: (e) => setSettings({ restCompound: toNumber(e.target.value) || 120 }) });
  const restI = input({ id: 'st-ri', inputmode: 'numeric', value: st.restIsolation ?? 75, onchange: (e) => setSettings({ restIsolation: toNumber(e.target.value) || 75 }) });
  const poolKey = `${p.pool?.len || 25}${p.pool?.unit || 'yd'}`;
  const toggle = (label, key, sub) => h('label', { class: 'check-row' },
    h('input', { type: 'checkbox', id: `st-${key}`, checked: st[key] !== false, onchange: (e) => setSettings({ [key]: e.target.checked }) }),
    h('span', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, label), sub ? h('div', { class: 'small muted' }, sub) : null));
  return h('div', { class: 'view' },
    topbar({ title: 'Settings', onBack: back }),
    h('div', { class: 'card' },
      field('Name', nameIn),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Weight units'),
        segmented([{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }], p.units || 'lb', (v) => setProfile({ units: v }), 'Weight units'),
        h('span', { class: 'hint' }, 'Past workouts convert automatically.')),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Pool'),
        segmented(POOL_OPTIONS.map((o) => ({ value: o.key, label: o.label })), poolKey, (v) => {
          const o = POOL_OPTIONS.find((x) => x.key === v);
          setProfile({ pool: { len: o.len, unit: o.unit } });
        }, 'Pool length')),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Swim workouts'),
        segmented([{ value: 'simple', label: 'Simple' }, { value: 'full', label: 'With drills' }], st.swimMode || 'full', (v) => setSettings({ swimMode: v }), 'Swim workout style'),
        h('span', { class: 'hint' }, 'Simple: just freestyle, breaststroke and kickboard. With drills: adds technique drills.'))),
    h('div', { class: 'card' },
      h('strong', null, 'Rest timer'),
      h('div', { class: 'field-row' }, field('Big lifts (s)', restC), field('Small lifts (s)', restI)),
      h('p', { class: 'xs muted' }, 'Program exercises use their own rest times. These apply to exercises you add yourself.'),
      toggle('Sound when rest is over', 'sound'),
      toggle('Keep screen awake during workouts', 'wakeLock', 'Stops your phone locking mid-set')),
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Appearance'),
        segmented([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], st.theme || 'auto', (v) => setSettings({ theme: v }), 'Theme'))));
});

// ---------------- data ----------------

function downloadJson(data, filename) {
  const text = JSON.stringify(data, null, 1);
  // Inside claude.ai the viewer blocks plain downloads; use the downloads capability there.
  if (window.claude?.use) {
    return window.claude.use('downloads').then((dl) => (dl ? dl.save({ filename, data: text }) : browserDownload(text, filename)));
  }
  return browserDownload(text, filename);
}

function browserDownload(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/json' }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file], title: 'Lift & Lap backup' }).catch((err) => {
      if (err?.name !== 'AbortError') throw err;
    });
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return Promise.resolve();
}

registerRoute('data', (_p, state) => {
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', id: 'restore-file', hidden: true,
    onchange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const ok = await confirmDialog({ title: 'Restore this backup?', message: 'Everything currently in the app will be replaced with the backup.', confirm: 'Restore', danger: true });
        if (!ok) return;
        store.importAll(data);
        toast('Backup restored');
      } catch (err) {
        toast(err.message?.includes('Lift & Lap') ? err.message : 'That file could not be read as a backup.');
      } finally {
        e.target.value = '';
      }
    },
  });
  const status = store.sync.status;
  return h('div', { class: 'view' },
    topbar({ title: 'Backup & data', onBack: back }),
    h('div', { class: 'card' },
      h('strong', null, 'Where your data lives'),
      h('p', { class: 'small ink-2' }, status === 'local'
        ? 'Everything is stored on this device, in this browser. Nothing is sent to a server. Export a backup now and then so you never lose your history.'
        : status === 'error' ? (store.sync.error || 'Cloud sync is paused.')
          : 'Your data is saved on this device and synced privately to your Claude account, so it is there on any device where you open this app.'),
      h('p', { class: 'xs muted' }, `${state.sessions.length} workouts · ${(state.body?.entries || []).length} body entries · last backup ${state.settings?.lastBackupAt ? fmtDate(state.settings.lastBackupAt.slice(0, 10)) : 'never'}`)),
    h('p', { class: 'small ink-2' }, 'On iPhone, Export opens the share sheet: choose "Save to Files" and pick iCloud Drive, so the backup survives losing or replacing your phone.'),
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn pool', onclick: () => {
          downloadJson(store.exportAll(), `lift-and-lap-backup-${todayISO()}.json`)
            .then(() => {
              store.update('settings', (x) => ({ ...x, lastBackupAt: new Date().toISOString() }));
              toast('Backup ready');
            })
            .catch(() => toast('Could not create the file here. Try again from the installed app.'));
        },
      }, icon(ICONS.download, 18), 'Export backup'),
      h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, icon(ICONS.upload, 18), 'Restore backup')),
    fileInput,
    h('div', { class: 'card' },
      h('strong', { class: 'c-danger' }, 'Start over'),
      h('p', { class: 'small ink-2' }, 'Finished a test run, or want a clean slate? This deletes every workout, measurement and setting on this device and takes you back to setup. Export a backup first if you might want it back.'),
      h('button', {
        class: 'btn danger', onclick: async () => {
          const ok = await confirmDialog({ title: 'Delete everything?', message: 'All workouts, body entries and settings will be erased and setup will start again. This cannot be undone.', confirm: 'Delete everything', danger: true });
          if (!ok) return;
          stopRest();
          resetOnboarding();
          store.resetAll();
          tab('today');
          toast('All data deleted. Set up again whenever you are ready.');
        },
      }, 'Delete all data')));
});

registerRoute('install', () => h('div', { class: 'view' },
  topbar({ title: 'Install on iPhone', onBack: back }),
  pageHead('Put it on your Home Screen', 'Works offline at the pool'),
  h('ol', { class: 'steps' },
    h('li', null, 'Open this app\'s web address in Safari on your iPhone.'),
    h('li', null, 'Tap the Share button (the square with an arrow pointing up).'),
    h('li', null, 'Scroll down and tap "Add to Home Screen", then "Add".'),
    h('li', null, 'Open Lift & Lap from the new icon. It runs full screen and keeps working without signal.')),
  h('div', { class: 'callout warn' }, 'Install before you start logging. The Home Screen app keeps its own storage, separate from Safari tabs. Already logged in Safari? Export a backup there, then restore it in the installed app.'),
  h('div', { class: 'callout' }, 'Your workouts are saved in the app on your phone. Use Backup & data → Export backup every few weeks, or before changing phones.'),
  h('div', { class: 'callout warn' }, 'Opened inside the Claude app instead? Then your data syncs to your Claude account automatically and there is nothing to install.')));

export { ctx, sheet };

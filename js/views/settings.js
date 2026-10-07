// Settings, opened from the gear on Today, plus its pages: Backup & data,
// Install on iPhone and Habits.

import * as store from '../store.js';
import { h, icon, ICONS, todayISO, addDays, fmtDate, fmtNum, toNumber } from '../util.js';
import { go, back, registerRoute, resetNav } from '../app.js';
import { resetOnboarding } from './onboarding.js';
import { stopRest } from '../timer.js';
import { topbar, pageHead, listItem, segmented, input, field, confirmDialog, toast } from '../ui.js';

const POOL_OPTIONS = [
  { key: '25yd', len: 25, unit: 'yd', label: '25 yd' },
  { key: '25m', len: 25, unit: 'm', label: '25 m' },
  { key: '50m', len: 50, unit: 'm', label: '50 m' },
];

function group(title, ...children) {
  return h('section', { class: 'section' }, h('div', { class: 'eyebrow group-title' }, title), ...children);
}

registerRoute('settings', (_p, state) => {
  const p = state.profile || {};
  const st = state.settings || {};
  const setProfile = (patch) => store.update('profile', (x) => ({ ...x, ...patch }));
  const setSettings = (patch) => store.update('settings', (x) => ({ ...x, ...patch }));
  const nameIn = input({ id: 'st-name', value: p.name || '', autocapitalize: 'words', onchange: (e) => setProfile({ name: e.target.value.trim() }) });
  const restC = input({ id: 'st-rc', inputmode: 'numeric', value: st.restCompound ?? 120, onchange: (e) => setSettings({ restCompound: toNumber(e.target.value) || 120 }) });
  const restI = input({ id: 'st-ri', inputmode: 'numeric', value: st.restIsolation ?? 75, onchange: (e) => setSettings({ restIsolation: toNumber(e.target.value) || 75 }) });
  const poolKey = `${p.pool?.len || 25}${p.pool?.unit || 'yd'}`;
  const row = (label, key, sub, { optIn = false } = {}) => h('label', { class: 'check-row' },
    h('input', {
      type: 'checkbox', id: `st-${key}`, checked: optIn ? st[key] === true : st[key] !== false,
      onchange: (e) => setSettings({ [key]: optIn ? (e.target.checked || undefined) : e.target.checked }),
    }),
    h('span', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, label), sub ? h('div', { class: 'small muted' }, sub) : null));
  const syncLine = store.sync.status === 'synced' ? 'Synced to your Claude account'
    : store.sync.status === 'error' ? (store.sync.error || 'Sync paused') : 'Saved on this phone';

  return h('div', { class: 'view' },
    topbar({ title: 'Settings', onBack: back }),
    group('Profile', h('div', { class: 'card' },
      field('Name', nameIn),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Weight units'),
        segmented([{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }], p.units || 'lb', (v) => setProfile({ units: v }), 'Weight units'),
        h('span', { class: 'hint' }, 'Past workouts convert automatically.')))),
    group('Pool', h('div', { class: 'card' },
      segmented(POOL_OPTIONS.map((o) => ({ value: o.key, label: o.label })), poolKey, (v) => {
        const o = POOL_OPTIONS.find((x) => x.key === v);
        setProfile({ pool: { len: o.len, unit: o.unit } });
      }, 'Pool length'),
      h('p', { class: 'xs muted' }, 'Swim level and Simple or drill workouts are in Plan → Program.'))),
    group('Workout', h('div', { class: 'card' },
      h('strong', null, 'Rest timer'),
      h('div', { class: 'field-row' }, field('Big lifts (s)', restC), field('Small lifts (s)', restI)),
      h('p', { class: 'xs muted' }, 'Program exercises use their own rest times. These apply to exercises you add yourself.'),
      row('Sound when rest is over', 'sound'),
      row('Keep screen awake during workouts', 'wakeLock', 'Stops your phone locking mid-set'))),
    group('Appearance', h('div', { class: 'card' },
      segmented([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], st.theme || 'auto', (v) => setSettings({ theme: v }), 'Theme'),
      row('Reduce motion', 'reduceMotion', 'Screens change without sliding or bouncing. The app also follows your iPhone\'s Reduce Motion setting.', { optIn: true }),
      row('Reduce transparency', 'reduceTransparency', 'Solid backgrounds instead of frosted glass.', { optIn: true }))),
    group('Body & daily habits', h('div', { class: 'card' },
      row('Track body and habits', 'trackBody', 'Body weight, measurements, water and sleep. Off keeps the app focused on workouts and swims.', { optIn: true })),
    st.trackBody ? h('div', { class: 'card flush' }, h('div', { class: 'list' },
      listItem({ title: 'Body log', sub: 'Weight and measurements', leading: icon(ICONS.scale), onclick: () => go('body-log') }),
      listItem({ title: 'Habits', sub: 'Water, sleep and protein history', leading: icon(ICONS.drop), onclick: () => go('habits') }))) : null),
    group('Your data', h('div', { class: 'card flush' }, h('div', { class: 'list' },
      listItem({ title: 'Backup & data', sub: `${syncLine} · backup, restore, start over`, leading: icon(ICONS.download), onclick: () => go('data') }),
      listItem({ title: 'Install on iPhone', sub: 'Add to your Home Screen', leading: icon(ICONS.upload), onclick: () => go('install') })))),
    h('p', { class: 'xs muted', style: { textAlign: 'center' } }, 'Lift & Lap · general fitness guidance, not medical advice.'));
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

// ---------------- backup & data ----------------

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
        if (!store.isBackup(data)) { toast('That file is not a Lift & Lap backup.'); return; }
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
          resetNav('today');
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

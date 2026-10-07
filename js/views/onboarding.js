import * as store from '../store.js';
import { h, icon, ICONS, todayISO, WEEKDAYS_SHORT, WEEKDAYS_LONG } from '../util.js';
import { render, registerRoute } from '../app.js';
import { SWIM_LEVELS } from '../data/swim.js';
import { SPLITS } from '../data/plans.js';
import { segmented, input, field } from '../ui.js';

const GOALS = [
  { id: 'health', title: 'Get fit and feel better', sub: 'Energy, health and a routine that sticks.' },
  { id: 'muscle', title: 'Build strength and muscle', sub: 'Get stronger and add muscle.' },
  { id: 'lose', title: 'Lose fat', sub: 'Get leaner while keeping your strength.' },
  { id: 'swim', title: 'Swim better', sub: 'Longer, smoother swims, plus strength to support them.' },
];

const POOLS = [
  { len: 25, unit: 'yd', label: '25 yards', sub: 'Most US gyms and schools' },
  { len: 25, unit: 'm', label: '25 meters', sub: 'Short-course meters' },
  { len: 50, unit: 'm', label: '50 meters', sub: 'Olympic size' },
];

const DEFAULT_PICKS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

const freshDraft = () => ({
  step: 0, name: '', units: 'lb', goal: 'health', pool: POOLS[0], swimLevel: 'novice', swimMode: 'full', split: null,
  days: [...DEFAULT_PICKS[4]], kinds: null,
});
const draft = freshDraft();

/** Forget anything typed during setup, so a later reset starts at step 1. */
export function resetOnboarding() {
  Object.assign(draft, freshDraft());
}

function assignKinds(days) {
  const sorted = [...days].sort((a, b) => a - b);
  const out = {};
  // With only 1–2 days, do both on each day so you still lift twice a week.
  sorted.forEach((d, i) => { out[d] = sorted.length <= 2 ? 'both' : i % 2 === 0 ? 'gym' : 'swim'; });
  return out;
}

const KIND_LABEL = { gym: 'Gym', swim: 'Swim', both: 'Gym + Swim' };
const NEXT_KIND = { gym: 'swim', swim: 'both', both: 'gym' };

function countKinds(kinds) {
  const vals = Object.values(kinds);
  return {
    gym: vals.filter((k) => k === 'gym' || k === 'both').length,
    swim: vals.filter((k) => k === 'swim' || k === 'both').length,
  };
}

function recommendedSplit(kinds) {
  return countKinds(kinds).gym >= 4 ? 'upper-lower' : 'full';
}

function choice(title, sub, pressed, onclick) {
  return h('button', { class: 'choice', type: 'button', 'aria-pressed': String(pressed), onclick },
    h('span', { class: 'c-title' }, title),
    sub ? h('span', { class: 'c-sub' }, sub) : null);
}

function finish() {
  const kinds = draft.kinds || assignKinds(draft.days);
  const days = Array.from({ length: 7 }, (_, i) => kinds[i] || 'rest');
  store.set('schedule', { days });
  store.set('profile', {
    name: draft.name.trim(), units: draft.units, goal: draft.goal,
    pool: { len: draft.pool.len, unit: draft.pool.unit }, swimLevel: draft.swimLevel,
    split: draft.split || recommendedSplit(kinds),
    startDate: todayISO(), onboarded: true, createdAt: new Date().toISOString(),
  });
  store.update('settings', (x) => ({ ...x, swimMode: draft.swimMode }));
  resetOnboarding();
}

function stepWelcome() {
  return [
    h('div', { class: 'stack lg' },
      logoMark(),
      h('h1', null, 'Lift & Lap'),
      h('p', { class: 'ink-2', style: { fontSize: 'var(--fs-lg)' } }, 'A 12-week beginner plan for the gym and the lap pool, with a workout logger, swim sets, progress charts and guides. Your data stays private to you.')),
    h('ul', { class: 'checklist' },
      h('li', null, 'Tells you exactly what to do each day, and how much weight to try'),
      h('li', null, 'Logs every set and every length, with a rest timer'),
      h('li', null, 'Exercise and swim-drill instructions for every movement'),
      h('li', null, 'Tracks your strength, swim distance, body weight and habits')),
  ];
}

function stepAboutYou() {
  const nameInput = input({ id: 'ob-name', value: draft.name, placeholder: 'Optional', autocapitalize: 'words', oninput: (e) => { draft.name = e.target.value; } });
  return [
    h('h1', null, 'About you'),
    field('First name', nameInput),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Weights in'),
      segmented([{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }], draft.units, (v) => { draft.units = v; }, 'Weight units')),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Main goal'),
      h('div', { class: 'choice-grid' }, GOALS.map((g) => choice(g.title, g.sub, draft.goal === g.id, () => { draft.goal = g.id; render(); })))),
  ];
}

function stepPool() {
  return [
    h('h1', null, 'Your pool'),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Pool length'),
      h('div', { class: 'choice-grid' }, POOLS.map((p) => choice(p.label, p.sub,
        draft.pool.len === p.len && draft.pool.unit === p.unit, () => { draft.pool = p; render(); })))),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Swimming right now'),
      h('div', { class: 'choice-grid' }, SWIM_LEVELS.map((l) => choice(l.name, l.desc, draft.swimLevel === l.id, () => { draft.swimLevel = l.id; render(); })))),
    draft.swimLevel !== 'learner' ? h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Swim workouts'),
      h('div', { class: 'choice-grid' },
        choice('Simple', 'Just freestyle, breaststroke and a kickboard. No technique drills.', draft.swimMode === 'simple', () => { draft.swimMode = 'simple'; render(); }),
        choice('With technique drills', 'Adds short drills that improve your stroke faster. Each one has a how-to video.', draft.swimMode === 'full', () => { draft.swimMode = 'full'; render(); })),
      h('div', { class: 'hint' }, 'You can switch any time in Settings.')) : null,
    draft.swimLevel === 'learner'
      ? h('div', { class: 'callout warn' }, 'Your swim sessions stay in the shallow end and build water confidence. Swim only when a lifeguard is on duty, and consider a few adult lessons. They speed things up a lot.')
      : null,
  ];
}

function stepSchedule() {
  const kinds = draft.kinds || assignKinds(draft.days);
  const picker = h('div', { class: 'day-picker', role: 'group', 'aria-label': 'Training days' },
    WEEKDAYS_SHORT.map((d, i) => h('button', {
      type: 'button', 'aria-pressed': String(draft.days.includes(i)), 'aria-label': WEEKDAYS_LONG[i],
      onclick: () => {
        draft.days = draft.days.includes(i) ? draft.days.filter((x) => x !== i) : [...draft.days, i];
        draft.kinds = null;
        render();
      },
    }, d.slice(0, 2))));
  const sorted = [...draft.days].sort((a, b) => a - b);
  return [
    h('h1', null, 'Your week'),
    h('div', { class: 'field' },
      h('span', { class: 'label' }, 'How many days a week can you train?'),
      segmented([2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })), draft.days.length, (n) => {
        draft.days = [...DEFAULT_PICKS[n]];
        draft.kinds = null;
        render();
      }, 'Days per week'),
      h('div', { class: 'hint' }, '4 is a great start: 2 gym + 2 swim. Short on time? Pick 2 and do the gym and the pool on the same day.')),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Which days?'), picker,
      sorted.length ? h('div', { class: 'hint' }, 'Tap a day below to switch it between Gym, Swim and Gym + Swim.') : null),
    sorted.length
      ? h('div', { class: 'card flush' }, h('div', { class: 'list' }, sorted.map((d) => {
        const k = kinds[d];
        return h('button', {
          class: 'list-item', type: 'button',
          onclick: () => { draft.kinds = { ...kinds, [d]: NEXT_KIND[k] || 'gym' }; draft.split = null; render(); },
        },
        h('div', { class: 'grow li-title' }, WEEKDAYS_LONG[d]),
        h('span', { class: `chip ${k}` }, KIND_LABEL[k]));
      })))
      : h('p', { class: 'muted' }, 'Pick at least one day.'),
    sorted.length ? h('div', { class: 'field' },
      h('span', { class: 'label' }, 'Gym program'),
      h('div', { class: 'choice-grid' }, SPLITS.map((o) => {
        const rec = recommendedSplit(kinds);
        const current = draft.split || rec;
        return choice(`${o.name}${o.id === rec ? ' · recommended' : ''}`, o.sub, current === o.id, () => { draft.split = o.id; render(); });
      }))) : null,
  ];
}

function stepDone() {
  const kinds = draft.kinds || assignKinds(draft.days);
  const { gym, swim } = countKinds(kinds);
  return [
    h('h1', null, draft.name ? `You're set, ${draft.name.trim()}.` : 'You\'re set.'),
    h('p', { class: 'ink-2', style: { fontSize: 'var(--fs-lg)' } },
      `Week 1 starts today: ${gym} gym ${gym === 1 ? 'session' : 'sessions'} and ${swim} swim ${swim === 1 ? 'session' : 'sessions'} a week.`),
    h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, 'Before your first session'),
      h('ul', { class: 'checklist' },
        h('li', null, 'Read "Start here" and "Your first week in the gym" in More → Learn (3 minutes each).'),
        h('li', null, 'Start lighter than you think. The app learns your weights as you log them.'),
        h('li', null, 'On iPhone in Safari, tap Share → Add to Home Screen now, and log from the installed app. It keeps its own data, separate from Safari.'))),
    h('p', { class: 'small muted' }, 'If you have any health conditions, check with your doctor before starting a new exercise program.'),
  ];
}

function logoMark() {
  return h('img', { class: 'splash-mark', src: 'icons/icon-192.png', alt: '', width: 88, height: 88 });
}

const STEPS = [stepWelcome, stepAboutYou, stepPool, stepSchedule, stepDone];

registerRoute('onboarding', () => {
  const step = draft.step;
  const isLast = step === STEPS.length - 1;
  const canNext = step !== 3 || draft.days.length > 0;
  return h('div', { class: 'onboard', 'data-full': 'true' },
    h('div', { class: 'ob-steps', 'aria-hidden': 'true' }, STEPS.map((_, i) => h('span', { class: i <= step ? 'on' : '' }))),
    h('div', { class: 'ob-body' }, ...STEPS[step]()),
    h('div', { class: 'ob-foot' },
      step > 0 ? h('button', { class: 'btn ghost lg', onclick: () => { draft.step -= 1; render({ scrollTop: true }); } }, icon(ICONS.back, 20), 'Back') : null,
      h('button', {
        class: 'btn pool lg', disabled: !canNext,
        onclick: () => {
          if (isLast) { finish(); return; }
          draft.step += 1;
          render({ scrollTop: true });
        },
      }, step === 0 ? 'Get started' : isLast ? 'Start my plan' : 'Continue')));
});

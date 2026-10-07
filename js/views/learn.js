// Learn tab: every exercise (searchable by the names gyms use for the
// machines), swim strokes and drills, beginner guides and tools. Exercises,
// strokes and drills open in a sheet; guides and tools are pages.

import { h, icon, ICONS, put, fill } from '../util.js';
import { go, back, replace, registerRoute } from '../app.js';
import { GROUPS, allExercises } from '../data/exercises.js';
import { DRILLS, STROKE_GUIDES } from '../data/swim.js';
import { GUIDES } from '../data/guides.js';
import { framesFor, videoFor } from '../data/media.js';
import { exerciseMatches, openExerciseSheet, openDrillSheet, openCustomExerciseForm } from './library.js';
import { topbar, pageHead, sectionHead, input, listItem } from '../ui.js';

const learn = { query: '', group: 'All', showAll: false, allDrills: false };
const PREVIEW = 8;

const TOOLS = [
  { id: 'plates', title: 'Plate calculator', sub: 'What to load on each side of the bar' },
  { id: 'max', title: '1-rep max', sub: 'Estimate your max from any set' },
  { id: 'pace', title: 'Swim pace', sub: 'Time per 100 and a 1,000 prediction' },
  { id: 'food', title: 'Calories & protein', sub: 'A starting point for your goal' },
];

function exerciseTile(e) {
  const f = framesFor(e.id);
  return h('button', { class: 'tile', type: 'button', onclick: () => openExerciseSheet(e.id) },
    f ? h('img', { class: 'tile-img', src: f.srcs[0], alt: '', loading: 'lazy', decoding: 'async' })
      : h('span', { class: 'tile-img tile-ph' }, icon(ICONS.dumbbell, 28)),
    h('span', { class: 'tile-name' }, e.name),
    h('span', { class: 'tile-sub' }, e.custom ? 'Your exercise' : e.group));
}

function strokeTile(g) {
  const v = videoFor(g.id);
  return h('button', { class: 'tile', type: 'button', onclick: () => openDrillSheet(g.id) },
    v ? h('img', { class: 'tile-img wide', src: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, alt: '', loading: 'lazy' })
      : h('span', { class: 'tile-img wide tile-ph swim' }, icon(ICONS.wave, 28)),
    h('span', { class: 'tile-name' }, g.name));
}

const drillRow = (d) => listItem({ title: d.name, sub: d.purpose, onclick: () => openDrillSheet(d.id) });
const guideRow = (g) => listItem({ title: g.title, sub: `${g.mins} min · ${g.summary}`, onclick: () => go('guide', { id: g.id }) });

function exercisesSection(redraw) {
  const items = allExercises().filter((e) => learn.group === 'All' || e.group === learn.group);
  const limited = learn.group === 'All' && !learn.showAll;
  const shown = limited ? items.slice(0, PREVIEW) : items;
  const chips = h('div', { class: 'filter-row' }, ['All', ...GROUPS].map((g) => h('button', {
    type: 'button', 'aria-pressed': String(g === learn.group),
    onclick: () => { learn.group = g; redraw(); },
  }, g)));
  return h('section', { class: 'section' },
    sectionHead('Exercises'),
    chips,
    h('div', { class: 'tile-grid' }, shown.map(exerciseTile)),
    limited && items.length > PREVIEW
      ? h('button', { class: 'btn quiet block', onclick: () => { learn.showAll = true; redraw(); } }, `Show all ${items.length} exercises`)
      : null);
}

function swimmingSection(redraw) {
  const drills = learn.allDrills ? DRILLS : DRILLS.slice(0, 5);
  return h('section', { class: 'section' },
    sectionHead('Swimming'),
    h('div', { class: 'tile-grid' }, STROKE_GUIDES.map(strokeTile)),
    h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, 'Drills and skills'),
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, drills.map(drillRow))),
    learn.allDrills ? null : h('button', { class: 'btn quiet block', onclick: () => { learn.allDrills = true; redraw(); } }, `Show all ${DRILLS.length} drills`));
}

function guidesSection() {
  return h('section', { class: 'section' },
    sectionHead('Guides'),
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, GUIDES.map(guideRow))));
}

function toolsSection() {
  return h('section', { class: 'section' },
    sectionHead('Tools'),
    h('div', { class: 'card flush' }, h('div', { class: 'list' }, TOOLS.map((t) => listItem({
      title: t.title, sub: t.sub, leading: icon(ICONS.tool), onclick: () => go('tools', { tool: t.id }),
    })))));
}

function searchResults(q) {
  const exercises = allExercises().filter((e) => exerciseMatches(e, q));
  const swim = [...STROKE_GUIDES, ...DRILLS].filter((d) => d.name.toLowerCase().includes(q) || d.purpose.toLowerCase().includes(q));
  const guides = GUIDES.filter((g) => g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q));
  if (!exercises.length && !swim.length && !guides.length) {
    return [h('div', { class: 'chart-empty' }, 'No matches. Tap + to add your own exercise.')];
  }
  return [
    exercises.length ? h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, `Exercises (${exercises.length})`), h('div', { class: 'tile-grid' }, exercises.map(exerciseTile))) : null,
    swim.length ? h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Swimming'), h('div', { class: 'card flush' }, h('div', { class: 'list' }, swim.map(drillRow)))) : null,
    guides.length ? h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Guides'), h('div', { class: 'card flush' }, h('div', { class: 'list' }, guides.map(guideRow)))) : null,
  ];
}

registerRoute('learn', () => {
  const body = h('div', { class: 'stack lg' });
  const draw = () => {
    const q = learn.query.trim().toLowerCase();
    fill(body, ...(q ? searchResults(q) : [exercisesSection(draw), swimmingSection(draw), guidesSection(), toolsSection()]));
  };
  const search = input({
    id: 'learn-search', type: 'search', placeholder: 'Search exercises, machines, strokes…', value: learn.query,
    oninput: (e) => { learn.query = e.target.value; draw(); },
  });
  draw();
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      pageHead('Learn', 'How to do every move'),
      h('button', { class: 'icon-btn', 'aria-label': 'Add your own exercise', onclick: openCustomExerciseForm }, icon(ICONS.plus))),
    h('div', { class: 'search' }, icon(ICONS.search, 18), search),
    body);
});

// ---------------- guides ----------------

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
    next ? h('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => replace('guide', { id: next.id }) },
      h('div', { class: 'eyebrow' }, 'Next'), h('strong', null, `${next.title} →`)) : null);
});

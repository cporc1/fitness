// Minimal SVG charts: line (with area wash), columns, stacked columns, and
// horizontal bars. Tap or drag on a chart to read exact values. Pass
// `animate: true` (only when arriving on a screen) for bars that grow in and
// lines that draw themselves.

import { h, s, parseISODate, fmtDate, fmtNum } from './util.js';

const W = 340;

function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

function niceScale(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

/**
 * points: [{ x: 'YYYY-MM-DD', y: number, label? }]
 */
export function lineChart({ points, color = 'var(--pool)', height = 180, fmt = (v) => fmtNum(v), tipFmt, zero = false, animate = false }) {
  if (!points || points.length < 2) {
    return h('div', { class: 'chart-empty' }, points?.length === 1
      ? `One entry so far (${fmt(points[0].y)}). Log again to see a trend.`
      : 'No data yet.');
  }
  const pad = { l: 40, r: 44, t: 12, b: 24 };
  const xs = points.map((p) => parseISODate(p.x).getTime());
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yMin = zero ? 0 : Math.min(...ys);
  const yMax = Math.max(...ys);
  const spread = yMax - yMin || Math.abs(yMax) * 0.1 || 1;
  const { lo, hi, ticks } = niceScale(zero ? 0 : yMin - spread * 0.15, yMax + spread * 0.15);
  const sx = (t) => pad.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const sy = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);

  const coords = points.map((p, i) => [sx(xs[i]), sy(p.y)]);
  const d = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const base = sy(lo);
  const area = `${d} L${coords[coords.length - 1][0].toFixed(1)},${base} L${coords[0][0].toFixed(1)},${base} Z`;
  const last = coords[coords.length - 1];

  const cross = s('line', { class: 'cross', x1: 0, x2: 0, y1: pad.t, y2: height - pad.b, visibility: 'hidden' });
  const focusDot = s('circle', { class: 'dot', r: 5, fill: color, visibility: 'hidden' });
  const svg = s('svg', { class: `chart${animate ? ' animate' : ''}`, viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': `Chart of ${points.length} entries` },
    ...ticks.map((t) => s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: sy(t), y2: sy(t) })),
    ...ticks.map((t) => s('text', { class: 'axis-label', x: pad.l - 6, y: sy(t), 'text-anchor': 'end', 'dominant-baseline': 'central' }, fmtNum(t, 1))),
    s('text', { class: 'axis-label', x: pad.l, y: height - 6 }, fmtDate(points[0].x)),
    s('text', { class: 'axis-label', x: W - pad.r, y: height - 6, 'text-anchor': 'end' }, fmtDate(points[points.length - 1].x)),
    s('path', { class: 'area', d: area, fill: color, 'fill-opacity': 0.1 }),
    s('path', { class: 'line', d, stroke: color, pathLength: 1 }),
    cross,
    s('circle', { class: 'dot', cx: last[0], cy: last[1], r: 4.5, fill: color }),
    s('text', { class: 'end-label', x: last[0] + 8, y: last[1], 'dominant-baseline': 'central' }, fmt(points[points.length - 1].y)),
    focusDot);

  const tip = h('div', { class: 'chart-tip' }, 'Tap the chart to read values');
  const describe = tipFmt || ((p) => `${fmtDate(p.x, { weekday: true })}: ${fmt(p.y)}`);
  function pick(evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < coords.length; i++) if (Math.abs(coords[i][0] - x) < Math.abs(coords[best][0] - x)) best = i;
    const [cx, cy] = coords[best];
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    focusDot.setAttribute('cx', cx); focusDot.setAttribute('cy', cy); focusDot.setAttribute('visibility', 'visible');
    tip.textContent = describe(points[best]);
  }
  svg.addEventListener('pointerdown', pick);
  svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) pick(e); });
  return h('div', { class: 'stack' }, svg, tip);
}

/**
 * bars: [{ label, value, title? }] oldest first.
 */
export function columnChart({ bars, color = 'var(--pool)', height = 170, fmt = (v) => fmtNum(v, 0), animate = false }) {
  if (!bars?.length || bars.every((b) => !b.value)) return h('div', { class: 'chart-empty' }, 'Nothing logged in this period yet.');
  const pad = { l: 40, r: 8, t: 18, b: 24 };
  const { lo, hi, ticks } = niceScale(0, Math.max(...bars.map((b) => b.value)), 3);
  const band = (W - pad.l - pad.r) / bars.length;
  const bw = Math.min(24, band * 0.62);
  const sy = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const base = sy(0);
  const tip = h('div', { class: 'chart-tip' }, 'Tap a bar to read its value');
  const marks = [];
  bars.forEach((b, i) => {
    const x = pad.l + i * band + (band - bw) / 2;
    const y = sy(b.value);
    const hgt = Math.max(0, base - y);
    const r = Math.min(4, hgt);
    const path = hgt > 0
      ? `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${base} Z`
      : '';
    const g = s('g', null,
      s('rect', { x: pad.l + i * band, y: pad.t, width: band, height: height - pad.t - pad.b, fill: 'transparent' }),
      path ? s('path', { class: 'bar', d: path, fill: color, 'fill-opacity': i === bars.length - 1 ? 1 : 0.55, style: `--i: ${i}` }) : null);
    g.addEventListener('pointerdown', () => { tip.textContent = `${b.title || b.label}: ${fmt(b.value)}`; });
    marks.push(g);
  });
  const lastBar = bars[bars.length - 1];
  const labelEvery = Math.ceil(bars.length / 7);
  const svg = s('svg', { class: `chart${animate ? ' animate' : ''}`, viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': `Column chart of ${bars.length} periods` },
    ...ticks.map((t) => s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: sy(t), y2: sy(t) })),
    ...ticks.map((t) => s('text', { class: 'axis-label', x: pad.l - 6, y: sy(t), 'text-anchor': 'end', 'dominant-baseline': 'central' }, fmt(t))),
    ...bars.map((b, i) => ((bars.length - 1 - i) % labelEvery === 0
      ? s('text', { class: 'axis-label', x: pad.l + i * band + band / 2, y: height - 6, 'text-anchor': 'middle' }, b.label)
      : null)),
    ...marks,
    lastBar.value ? s('text', { class: 'end-label', x: pad.l + (bars.length - 1) * band + band / 2, y: sy(lastBar.value) - 6, 'text-anchor': 'middle' }, fmt(lastBar.value)) : null);
  return h('div', { class: 'stack' }, svg, tip);
}

/**
 * Stacked columns. bars: [{ label, title, values: { key: number } }] oldest
 * first; series: [{ key, label, color }] bottom to top. Legend only when 2+
 * series have data.
 */
export function stackedColumns({ bars, series, height = 170, fmt = (v) => fmtNum(v, 0), unitWord = (k, v) => `${fmt(v)} ${k}`, animate = false }) {
  const total = (b) => series.reduce((a, sr) => a + (b.values[sr.key] || 0), 0);
  if (!bars?.length || bars.every((b) => !total(b))) return h('div', { class: 'chart-empty' }, 'Nothing logged in this period yet.');
  const used = series.filter((sr) => bars.some((b) => b.values[sr.key]));
  const pad = { l: 40, r: 8, t: 18, b: 24 };
  const { lo, hi, ticks } = niceScale(0, Math.max(...bars.map(total)), 3);
  const band = (W - pad.l - pad.r) / bars.length;
  const bw = Math.min(24, band * 0.62);
  const sy = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const tip = h('div', { class: 'chart-tip' }, 'Tap a bar to read its value');
  const marks = bars.map((b, i) => {
    const x = pad.l + i * band + (band - bw) / 2;
    let acc = 0;
    const parts = [];
    const nonZero = used.filter((sr) => b.values[sr.key]);
    nonZero.forEach((sr, j) => {
      const v = b.values[sr.key];
      const y0 = sy(acc);
      const y1 = sy(acc + v);
      acc += v;
      const top = j === nonZero.length - 1;
      const r = top ? Math.min(4, y0 - y1) : 0;
      const d = `M${x},${y0} L${x},${y1 + r} Q${x},${y1} ${x + r},${y1} L${x + bw - r},${y1} Q${x + bw},${y1} ${x + bw},${y1 + r} L${x + bw},${y0} Z`;
      parts.push(s('path', { d, fill: sr.color }));
    });
    // The whole stack grows from the baseline: the hit area spans down to it.
    const g = s('g', { class: 'bar', style: `--i: ${i}` }, s('rect', { x: pad.l + i * band, y: pad.t, width: band, height: height - pad.t - pad.b, fill: 'transparent' }), ...parts);
    g.addEventListener('pointerdown', () => {
      tip.textContent = `${b.title || b.label}: ${used.map((sr) => unitWord(sr.label, b.values[sr.key] || 0)).join(', ')}`;
    });
    return g;
  });
  const labelEvery = Math.ceil(bars.length / 7);
  const svg = s('svg', { class: `chart${animate ? ' animate' : ''}`, viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': `Stacked column chart of ${bars.length} periods` },
    ...ticks.map((t) => s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: sy(t), y2: sy(t) })),
    ...ticks.map((t) => s('text', { class: 'axis-label', x: pad.l - 6, y: sy(t), 'text-anchor': 'end', 'dominant-baseline': 'central' }, fmt(t))),
    ...bars.map((b, i) => ((bars.length - 1 - i) % labelEvery === 0
      ? s('text', { class: 'axis-label', x: pad.l + i * band + band / 2, y: height - 6, 'text-anchor': 'middle' }, b.label)
      : null)),
    ...marks);
  const legend = used.length > 1
    ? h('div', { class: 'legend' }, used.map((sr) => h('span', null, h('i', { style: { background: sr.color } }), sr.label)))
    : null;
  return h('div', { class: 'stack' }, legend, svg, tip);
}

/** Horizontal bars with labels: items [{ label, value, display }]. */
export function hBars({ items, color = 'var(--pool)', animate = false }) {
  if (!items?.length) return h('div', { class: 'chart-empty' }, 'Nothing logged in this period yet.');
  const max = Math.max(...items.map((it) => it.value), 1);
  return h('div', { class: `hbars${animate ? ' animate' : ''}` }, items.map((it, i) => h('div', { class: 'hbar' },
    h('span', { class: 'hb-label' }, it.label),
    h('span', { class: 'hb-track' }, h('span', { class: 'hb-fill', style: { width: `${Math.max(2, (it.value / max) * 100)}%`, background: color, '--i': String(i) } })),
    h('span', { class: 'hb-value' }, it.display ?? fmtNum(it.value, 0)))));
}

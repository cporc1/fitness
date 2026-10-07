// Text colours must stay readable: WCAG AA (4.5:1) for every pairing the
// app uses for text, in light and dark mode. Tokens come from css/app.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../css/app.css'), 'utf8');

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'], ['ink-2', 'bg'], ['ink-2', 'surface'],
  ['muted', 'bg'], ['muted', 'surface'],
  ['on-accent', 'pool'], ['on-accent', 'iron'], ['on-accent', 'good'], ['on-accent', 'danger'],
  ['pool', 'pool-wash'], ['iron-ink', 'iron-wash'], ['good-ink', 'good-wash'], ['danger', 'danger-wash'],
  ['pool', 'surface'], ['pool', 'bg'], ['good-ink', 'surface'],
];

for (const [name, selector] of [['light', ':root'], ['dark', ':root[data-theme="dark"]']]) {
  test(`text contrast meets WCAG AA in ${name} mode`, () => {
    const t = tokens(selector);
    const failures = PAIRS
      .map(([fg, bg]) => ({ fg, bg, ratio: contrast(t[fg], t[bg]) }))
      .filter((p) => !(p.ratio >= 4.5))
      .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)}`);
    assert.deepEqual(failures, []);
  });
}

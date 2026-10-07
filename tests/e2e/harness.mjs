// Tiny end-to-end harness: a static file server, Playwright on an iPhone 13
// profile with a fixed clock, and pass/fail bookkeeping. No dependencies
// beyond Playwright itself (see README.md in this folder).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PREFIX = 'liftlap:v1:';
// Wednesday. The default program in the tests starts on Monday, Oct 5.
export const NOW = '2026-10-07T10:00:00';

async function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try {
      const spec = t.startsWith('/') ? pathToFileURL(fs.statSync(t).isDirectory() ? path.join(t, 'index.mjs') : t).href : t;
      return await import(spec);
    } catch { /* try the next one */ }
  }
  throw new Error('Playwright not found. Install it (npm i -g playwright) or set PLAYWRIGHT_PATH to its index.mjs.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const tests = [];
export function test(name, fn, opts = {}) { tests.push({ name, fn, opts }); }

export async function run() {
  const { chromium, devices } = await loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const filter = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2].toLowerCase() : null;
  const shotsDir = process.env.E2E_SHOTS || null;
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  let failed = 0;
  let passed = 0;

  for (const t of tests) {
    if (filter && !t.name.toLowerCase().includes(filter)) continue;
    const errors = [];
    const results = [];
    const contexts = [];
    // Each test gets fresh storage. Motion is reduced unless a test asks for it,
    // so navigation renders synchronously and checks don't race animations.
    async function newPage({ time = NOW, motion = false, device = 'iPhone 13', colorScheme = 'light' } = {}) {
      const ctx = await browser.newContext({
        ...devices[device], serviceWorkers: 'block', timezoneId: 'UTC', acceptDownloads: true,
        reducedMotion: motion ? 'no-preference' : 'reduce', colorScheme,
      });
      contexts.push(ctx);
      await ctx.clock.install({ time: new Date(time) });
      await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      const page = await ctx.newPage();
      page.setDefaultTimeout(5000);
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`); });
      return page;
    }
    const api = {
      base, newPage,
      check: (name, ok, detail = '') => results.push({ name, ok: !!ok, detail }),
      shot: async (page, name, full = true) => { if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: full }); },
      /** Open the app with these storage documents (name -> value). */
      open: async (page, docs = null) => {
        await page.goto(base);
        if (docs) {
          await page.evaluate(([P, d]) => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(P + k, JSON.stringify(v)); }, [PREFIX, docs]);
          await page.reload();
        }
        await page.locator('#app > *').first().waitFor();
      },
      tmp: (name) => { const dir = path.join(ROOT, 'tests/e2e/.tmp'); fs.mkdirSync(dir, { recursive: true }); return path.join(dir, name); },
    };
    const started = Date.now();
    try {
      await t.fn(api);
    } catch (err) {
      const where = (err.stack || '').split('\n').find((l) => l.includes('/tests/e2e/') && !l.includes('harness.mjs'));
      results.push({ name: 'test threw', ok: false, detail: `${err.message.split('\n').filter((l) => l.trim()).slice(0, 3).join(' | ')}${where ? ` @ ${where.trim().replace(/^at /, '')}` : ''}` });
    }
    for (const c of contexts) await c.close().catch(() => {});
    for (const e of errors) results.push({ name: 'no page errors', ok: false, detail: e.slice(0, 300) });
    const bad = results.filter((r) => !r.ok);
    const mark = bad.length ? 'FAIL' : 'ok  ';
    console.log(`${mark} ${t.name} (${results.length} checks, ${Date.now() - started} ms)`);
    for (const r of bad) console.log(`       ✗ ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    if (bad.length) failed += 1; else passed += 1;
  }
  await browser.close();
  server.close();
  fs.rmSync(path.join(ROOT, 'tests/e2e/.tmp'), { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

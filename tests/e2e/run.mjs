// End-to-end flows on an iPhone 13 viewport. Run: npm run test:e2e [filter]
// Screenshots: E2E_SHOTS=/some/dir npm run test:e2e

import fs from 'node:fs';
import { test, run, PREFIX } from './harness.mjs';

const PROFILE = { name: 'Sam', units: 'lb', goal: 'health', pool: { len: 25, unit: 'yd' }, swimLevel: 'novice', split: 'full', startDate: '2026-10-05', onboarded: true };
const WEEK = { days: ['gym', 'swim', 'both', 'rest', 'gym', 'rest', 'rest'] }; // Wednesday (today) is gym + swim
const gymSession = (id, date, tpl, exercises) => ({
  id, kind: 'gym', templateId: tpl, name: 'Full Body A', date, unit: 'lb', startedAt: `${date}T10:00:00Z`, durationSec: 3000,
  exercises: exercises.map(([ex, sets]) => ({ ex, type: 'weight', sets: sets.map(([w, r]) => ({ w, r, done: true })) })),
});

const btn = (page, name) => page.getByRole('button', { name }).first();
/** Switch tab and land on its root page (tabs remember their pages, so tap again if needed). */
async function tabTo(page, name) {
  const bar = page.locator('.tabbar');
  await bar.getByRole('button', { name }).click();
  await bar.locator('[aria-current="page"]', { hasText: name }).waitFor();
  if (await page.locator('.topbar [aria-label="Back"]').count()) {
    await bar.getByRole('button', { name }).click();
    await page.locator('.topbar [aria-label="Back"]').waitFor({ state: 'detached' });
  }
}

test('setup, combo day, exercise details, reset', async ({ newPage, open, check, shot }) => {
  const page = await newPage();
  await open(page);
  await btn(page, 'Get started').click();
  await btn(page, 'Continue').click();
  await btn(page, 'Continue').click();
  await page.locator('.seg button', { hasText: '2' }).click();
  check('2 training days default to Gym + Swim', (await page.locator('.list-item .chip.both').count()) === 2);
  await page.locator('.seg button', { hasText: '3' }).click(); // Mon, Wed, Fri
  const wed = page.locator('.list-item', { hasText: 'Wednesday' });
  for (let i = 0; i < 3 && !(await wed.locator('.chip.both').count()); i++) await wed.click();
  check('Wednesday cycles to Gym + Swim', (await wed.locator('.chip.both').count()) === 1);
  check('Gym program choice shown', (await page.getByText('Full body · recommended').count()) === 1);
  await btn(page, 'Continue').click();
  await btn(page, 'Start my plan').click();
  await page.locator('.hero').first().waitFor();
  check('Today shows two session cards on a combo day', (await page.locator('.hero').count()) === 2);
  check('No daily check-in by default', (await page.getByText('Daily check-in').count()) === 0);
  await shot(page, 'today-combo');

  await page.locator('.hero-link').first().click();
  await page.locator('.demo').first().waitFor();
  check('Exercise details have two demo photos', (await page.locator('.demo img').count()) === 2);
  check('Exercise details have "Find it in the gym"', (await page.locator('.find-card').count()) === 1);
  check('Exercise details have a video poster', (await page.locator('.video-poster').count()) === 1);
  check('No links leave the app', (await page.locator('a[target=_blank]').count()) === 0);
  await page.locator('.video-poster').click();
  check('Video turns into an inline player', (await page.locator('.video iframe').count()) === 1);
  await btn(page, 'Back').click();

  await page.locator('.hero.gym').getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.ex-card').first().waitFor();
  check('Session cards have thumbnails', (await page.locator('.ex-card .ex-thumb').count()) > 0);
  for (let i = 0; i < 3; i++) await page.locator('.ex-card').first().locator('.set-check').nth(i).click();
  await page.locator('.ex-card').first().getByRole('button', { name: /Photo and how-to/ }).click();
  check('In-session sheet shows "Find it in the gym"', (await page.locator('.sheet .find-card').count()) === 1);
  await page.getByRole('button', { name: 'Close' }).last().click();
  await page.locator('.session-head').getByRole('button', { name: 'Finish' }).click();
  await btn(page, 'Save workout').click();
  await btn(page, 'Done').click();
  await page.locator('.done-row').waitFor();
  check('After the gym: a done row and the swim card', (await page.locator('.done-row').count()) === 1 && (await page.locator('.hero.swim').count()) === 1);

  await page.locator('.hero.swim').getByRole('button', { name: 'Start swim' }).click();
  await page.locator('.drill-link').first().click();
  check('Swim how-to sheet has a video', (await page.locator('.sheet .video-poster').count()) === 1);
  await page.getByRole('button', { name: 'Close' }).last().click();
  for (let i = 0; i < 4; i++) await btn(page, 'Rep done').click();
  await page.locator('.session-head').getByRole('button', { name: 'Finish' }).click();
  await btn(page, 'Save workout').click();
  await btn(page, 'Done').click();
  await page.getByText('Done today').waitFor();
  check('Both done shows "Done today"', (await page.getByText('Done today').count()) === 1);

  await tabTo(page, 'More');
  await page.locator('.list-item', { hasText: 'Backup & data' }).click();
  await btn(page, 'Delete all data').click();
  await btn(page, 'Delete everything').click();
  check('Reset returns to setup step 1', (await page.getByRole('button', { name: 'Get started' }).count()) === 1);
});

test('plan, library, settings', async ({ newPage, open, check, shot }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  await tabTo(page, 'Plan');
  await page.locator('.list-item', { hasText: 'Gym program' }).click();
  await page.locator('.sheet .choice', { hasText: 'Upper / lower' }).click();
  check('Plan lists Upper Body and Lower Body', (await page.locator('.list-item', { hasText: 'Upper Body' }).count()) === 1 && (await page.locator('.list-item', { hasText: 'Lower Body' }).count()) === 1);
  await page.locator('.list-item', { hasText: 'Friday' }).click();
  await page.locator('.sheet .list-item', { hasText: 'Gym + Swim' }).click();
  check('Friday becomes Gym + Swim', (await page.locator('.list-item', { hasText: 'Friday' }).locator('.chip.both').count()) === 1);
  await page.locator('.list-item', { hasText: 'Upper Body' }).click();
  await page.locator('.list-item').first().click();
  check('A plan exercise opens its details', (await page.locator('.find-card').count()) === 1);
  await shot(page, 'plan-exercise');
  await btn(page, 'Back').click();
  await btn(page, 'Back').click();

  await tabTo(page, 'More');
  await page.locator('.list-item', { hasText: 'Exercise library' }).click();
  await page.fill('#lib-search', 'gravitron');
  check('Search by other name finds Assisted Pull-Up', (await page.locator('.list-item', { hasText: 'Assisted Pull-Up' }).count()) === 1);
  await btn(page, 'Back').click();
  check('Habits hidden by default', (await page.locator('.list-item', { hasText: 'Habits' }).count()) === 0);
  await page.locator('.list-item', { hasText: 'Settings' }).click();
  await page.locator('.seg button', { hasText: 'Simple' }).click();
  await page.locator('#st-trackBody').check();
  await btn(page, 'Back').click();
  await tabTo(page, 'Today');
  check('Check-in shows once body tracking is on', (await page.getByText('Daily check-in').count()) === 1);
  await tabTo(page, 'Plan');
  await page.locator('.list-item', { hasText: /Easy Swim|Endurance/ }).first().click();
  check('Simple swim mode has no drills', (await page.locator('.swim-item', { hasText: /drill/i }).count()) === 0);
  await btn(page, 'Back').click();

  for (const t of ['Today', 'Plan', 'Log', 'Progress', 'More']) {
    await tabTo(page, t);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`No sideways scrolling on ${t}`, over <= 0, `${over}px`);
  }
});

test('resume after reload; 50 m pool swim', async ({ newPage, open, check }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  await page.locator('.hero.gym').getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.ex-card').first().locator('.set-input').nth(0).fill('77.5');
  await page.locator('.ex-card').first().locator('.set-input').nth(1).fill('11');
  await page.waitForTimeout(400); // typed values save after a short pause
  await page.reload();
  await page.locator('.resume-bar').waitFor();
  check('Resume bar after reload', (await page.locator('.resume-bar').count()) === 1);
  await page.locator('.resume-bar').click();
  const v = await page.locator('.ex-card').first().locator('.set-input').nth(0).inputValue();
  check('Typed weight survives reload', v === '77.5', v);
  await page.locator('.session-head').getByRole('button', { name: 'Minimize workout' }).click();

  await open(page, { profile: { ...PROFILE, pool: { len: 50, unit: 'm' } }, schedule: WEEK });
  await page.locator('.hero.swim').getByRole('button', { name: 'Start swim' }).click();
  const meta = await page.locator('.swim-item .si-meta').first().textContent();
  check('50 m pool: 1-length reps with longer rest', /length/.test(meta) && /rest 80 s/.test(meta), meta);
  check('50 m pool: lane-rope note for beginners', (await page.getByText('Hold the lane rope at halfway', { exact: false }).count()) > 0);
});

test('kg conversion, backup round trip, plan complete', async ({ newPage, open, check, tmp }) => {
  const page = await newPage();
  await open(page, {
    profile: PROFILE, schedule: { days: ['gym', 'swim', 'gym', 'rest', 'swim', 'gym', 'rest'] },
    'sessions-2026-09': { items: [gymSession('a1', '2026-09-28', 'p1-a', [['leg-press', [[100, 12], [100, 12], [100, 11]]], ['lateral-raise', [[10, 20], [10, 20]]]])] },
    'sessions-2026-10': { items: [gymSession('a2', '2026-10-05', 'p1-a', [['leg-press', [[100, 15], [100, 15], [100, 15]]], ['lateral-raise', [[10, 20], [10, 20]]]])] },
  });
  await tabTo(page, 'More');
  await page.locator('.list-item', { hasText: 'Settings' }).click();
  await page.locator('.seg button', { hasText: 'kg' }).click();
  await tabTo(page, 'Progress');
  const e1 = await page.locator('.kv .v').first().textContent();
  check('Progress converts to kg', /kg/.test(e1), e1);
  await tabTo(page, 'Plan');
  await page.locator('.list-item', { hasText: 'Full Body A' }).click();
  await btn(page, 'Start this workout').click();
  const lp = await page.locator('.ex-card').first().locator('.set-input').nth(0).inputValue();
  check('Leg press suggestion converts to kg (about 50)', Math.abs(Number(lp) - 50.5) <= 0.6, lp);
  const lr = await page.locator('.ex-card').filter({ hasText: 'Lateral Raise' }).locator('.set-input').nth(0).inputValue();
  check('Lateral raise uses a real dumbbell size in kg', ['4.5', '5', '6'].includes(lr), lr);
  await page.locator('.session-head').getByRole('button', { name: 'Minimize workout' }).click();

  await tabTo(page, 'More');
  await page.locator('.list-item', { hasText: 'Backup & data' }).click();
  const dlP = page.waitForEvent('download');
  await btn(page, 'Export backup').click();
  const file = tmp('backup.json');
  await (await dlP).saveAs(file);
  const before = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')).docs).map(([k, v]) => [PREFIX + k, JSON.stringify(v)]));
  const page2 = await newPage();
  await open(page2, { profile: { onboarded: true, units: 'lb', startDate: '2026-10-01' } });
  await tabTo(page2, 'More');
  await page2.locator('.list-item', { hasText: 'Backup & data' }).click();
  await page2.setInputFiles('#restore-file', file);
  await page2.locator('.dialog').getByRole('button', { name: 'Restore', exact: true }).click();
  await page2.locator('.toast').waitFor();
  const after = await page2.evaluate((P) => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith(P) && !k.endsWith('__meta')).map((k) => [k, localStorage.getItem(k)])), PREFIX);
  check('Backup round-trips exactly', Object.keys(before).length === Object.keys(after).length && Object.keys(before).every((k) => before[k] === after[k]), `${Object.keys(before).length} vs ${Object.keys(after).length}`);
  fs.writeFileSync(tmp('bad.json'), '{"nope":1}');
  await page2.setInputFiles('#restore-file', tmp('bad.json'));
  await page2.waitForFunction(() => document.querySelector('.toast')?.textContent.includes('not a Lift & Lap backup'));
  check('An invalid backup shows an error', true);

  const page3 = await newPage();
  await open(page3, { profile: { ...PROFILE, startDate: '2026-06-01' }, schedule: { days: ['gym', 'gym', 'both', 'gym', 'gym', 'rest', 'rest'] } });
  check('"Plan complete" after week 12', (await page3.getByText('Plan complete', { exact: false }).count()) > 0);
  await page3.locator('.wday').nth(3).click();
  const thu = await page3.locator('.hero h2').first().textContent();
  await btn(page3, 'Back').click();
  await page3.locator('.wday').nth(4).click();
  const fri = await page3.locator('.hero h2').first().textContent();
  check('Future gym days alternate A and B', thu !== fri, `${thu} / ${fri}`);
});

test('navigation: back, swipe-back, forward, tab stacks, scroll', async ({ newPage, open, check }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  const ll = () => page.evaluate(() => history.state?.ll);
  await tabTo(page, 'Plan');
  const item = page.locator('.list-item', { hasText: 'Full Body A' });
  await item.scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => window.scrollY);
  await item.click();
  await btn(page, 'Start this workout').waitFor();
  await page.locator('.list-item').first().click();
  await page.locator('.find-card').waitFor();
  check('Two pages deep = two history entries', (await ll()) === 2, String(await ll()));
  await page.goBack(); // what the iPhone edge swipe does
  await btn(page, 'Start this workout').waitFor();
  check('Swipe-back returns to the workout page', (await ll()) === 1);
  await page.locator('.tabbar').getByRole('button', { name: 'Today' }).click();
  await page.locator('.greet').waitFor();
  check('Switching tab unwinds history', (await ll()) === 0, String(await ll()));
  await page.locator('.tabbar').getByRole('button', { name: 'Plan' }).click();
  await btn(page, 'Start this workout').waitFor();
  check('Plan remembers its open page', (await ll()) === 1, String(await ll()));
  await page.locator('.tabbar').getByRole('button', { name: 'Plan' }).click();
  await page.locator('.page-head h1', { hasText: 'Plan' }).waitFor();
  check('Tapping the active tab pops to its root', (await ll()) === 0);
  const y1 = await page.evaluate(() => window.scrollY);
  check('Scroll position comes back', y0 > 0 && Math.abs(y1 - y0) < 2, `${y0} → ${y1}`);
  await page.goForward();
  await btn(page, 'Start this workout').waitFor();
  check('Forward restores the page', (await ll()) === 1);
  await btn(page, 'Back').click();
  await page.locator('.page-head h1', { hasText: 'Plan' }).waitFor();
  check('Back button pops through history', (await ll()) === 0);
});

test('screen changes animate unless motion is reduced', async ({ newPage, open, check }) => {
  const spy = () => {
    window.__vt = 0;
    const orig = Document.prototype.startViewTransition;
    if (orig) Document.prototype.startViewTransition = function (...args) { window.__vt += 1; return orig.apply(this, args); };
  };
  const flow = async (page) => {
    await page.locator('.tabbar').getByRole('button', { name: 'Plan' }).click();
    await page.locator('.page-head h1', { hasText: 'Plan' }).waitFor();
    await page.locator('.list-item', { hasText: 'Full Body A' }).click();
    await btn(page, 'Start this workout').waitFor();
    await page.waitForFunction(() => !document.documentElement.dataset.vt);
    return page.evaluate(() => window.__vt);
  };
  const moving = await newPage({ motion: true });
  await moving.addInitScript(spy);
  await open(moving, { profile: PROFILE, schedule: WEEK });
  check('Tab switch and push use view transitions', (await flow(moving)) >= 2);
  const still = await newPage();
  await still.addInitScript(spy);
  await open(still, { profile: PROFILE, schedule: WEEK });
  check('Reduced motion (iPhone setting) skips them', (await flow(still)) === 0);
  const inApp = await newPage({ motion: true });
  await inApp.addInitScript(spy);
  await open(inApp, { profile: PROFILE, schedule: WEEK, settings: { reduceMotion: true } });
  check('Reduce motion in Settings skips them', (await flow(inApp)) === 0);
  check('Reduce motion marks <html>', await inApp.evaluate(() => document.documentElement.classList.contains('reduce-motion')));
});

await run();

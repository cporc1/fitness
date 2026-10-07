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
const exerciseRow = (page) => page.locator('.list-item', { has: page.locator('.ex-thumb') }).first();
const closeSheet = (page) => page.locator('.sheet').last().getByRole('button', { name: 'Close' }).click();
async function openSettings(page) {
  await tabTo(page, 'Today');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.topbar .title', { hasText: 'Settings' }).waitFor();
}
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
  await page.locator('.wcard').first().waitFor();
  check('Today shows two session cards on a combo day', (await page.locator('.wcard').count()) === 2);
  check('Combo day cards are joined by "then"', (await page.locator('.then').count()) === 1);
  check('No daily check-in by default', (await page.getByText('Daily check-in').count()) === 0);
  await shot(page, 'today-combo');

  await page.locator('.wcard.gym').getByRole('button', { name: 'Details' }).click();
  await page.locator('.wk-hero').waitFor();
  await exerciseRow(page).click();
  await page.locator('.sheet .demo').first().waitFor();
  check('Exercise sheet has two demo photos', (await page.locator('.sheet .demo img').count()) === 2);
  check('Exercise sheet has "Find it in the gym"', (await page.locator('.sheet .find-card').count()) === 1);
  check('Exercise sheet has a video poster', (await page.locator('.sheet .video-poster').count()) === 1);
  check('No links leave the app', (await page.locator('a[target=_blank]').count()) === 0);
  await page.locator('.sheet .video-poster').click();
  check('Video turns into an inline player', (await page.locator('.sheet .video iframe').count()) === 1);
  await closeSheet(page);
  await btn(page, 'Back').click();

  await page.locator('.wcard.gym').getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.ex-card').first().waitFor();
  check('Session cards have thumbnails', (await page.locator('.ex-card .ex-thumb').count()) > 0);
  for (let i = 0; i < 3; i++) await page.locator('.ex-card').first().locator('.set-check').nth(i).click();
  await page.locator('.ex-card').first().getByRole('button', { name: /Photo and how-to/ }).click();
  check('In-session sheet shows "Find it in the gym"', (await page.locator('.sheet .find-card').count()) === 1);
  await page.getByRole('button', { name: 'Close' }).last().click();
  await page.locator('.session-head').getByRole('button', { name: 'Finish' }).click();
  await btn(page, 'Save workout').click();
  await btn(page, 'Done').click();
  await page.locator('.done-card').waitFor();
  check('After the gym: a done card and the swim card', (await page.locator('.done-card').count()) === 1 && (await page.locator('.wcard.swim').count()) === 1);

  await page.locator('.wcard.swim').getByRole('button', { name: 'Start swim' }).click();
  await page.locator('.drill-link').first().click();
  check('Swim how-to sheet has a video', (await page.locator('.sheet .video-poster').count()) === 1);
  await page.getByRole('button', { name: 'Close' }).last().click();
  for (let i = 0; i < 4; i++) await btn(page, 'Rep done').click();
  await page.locator('.session-head').getByRole('button', { name: 'Finish' }).click();
  await btn(page, 'Save workout').click();
  await btn(page, 'Done').click();
  await page.getByText('Done today').waitFor();
  check('Both done shows "Done today"', (await page.getByText('Done today').count()) === 1);

  await openSettings(page);
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
  check('Plan lists Upper Body and Lower Body', (await page.locator('.rot-card', { hasText: 'Upper Body' }).count()) === 1 && (await page.locator('.rot-card', { hasText: 'Lower Body' }).count()) === 1);
  await page.locator('.day-chip[aria-label^="Friday"]').click();
  await page.locator('.sheet .list-item', { hasText: 'Gym + Swim' }).click();
  await page.locator('.day-chip.both[aria-label^="Friday"]').waitFor();
  check('Friday becomes Gym + Swim', true);
  check('One workout is marked up next per kind', (await page.locator('.rot-card .chip', { hasText: 'Up next' }).count()) === 2);
  await page.locator('.rot-card', { hasText: 'Upper Body' }).click();
  await page.locator('.wk-hero').waitFor();
  check('Workout page shows the warm-up and cool-down rows', (await page.locator('.list-item', { hasText: 'Warm-up' }).count()) === 1 && (await page.locator('.list-item', { hasText: 'Cool-down' }).count()) === 1);
  await exerciseRow(page).click();
  await page.locator('.sheet .find-card').waitFor();
  check('A plan exercise opens its details in a sheet', (await page.locator('.sheet .find-card').count()) === 1);
  await shot(page, 'plan-exercise');
  await closeSheet(page);
  await btn(page, 'Back').click();

  await tabTo(page, 'Learn');
  await page.fill('#learn-search', 'gravitron');
  check('Search by other name finds Assisted Pull-Up', (await page.locator('.tile', { hasText: 'Assisted Pull-Up' }).count()) === 1);
  await page.locator('.tile', { hasText: 'Assisted Pull-Up' }).click();
  await page.locator('.sheet .find-card').waitFor();
  check('Learn opens exercises in a sheet', true);
  await closeSheet(page);
  await page.fill('#learn-search', '');
  await shot(page, 'learn');

  await openSettings(page);
  check('Habits hidden by default', (await page.locator('.list-item', { hasText: 'Habits' }).count()) === 0);
  await page.locator('#st-trackBody').check();
  await page.locator('.list-item', { hasText: 'Habits' }).waitFor();
  check('Habits and Body log appear once tracking is on', (await page.locator('.list-item', { hasText: 'Body log' }).count()) === 1);
  await shot(page, 'settings');
  await btn(page, 'Back').click();
  await page.getByText('Daily check-in').waitFor();
  check('Check-in shows once body tracking is on', (await page.getByText('Daily check-in').count()) === 1);
  await tabTo(page, 'Plan');
  await page.locator('.list-item', { hasText: 'Swim workouts' }).click();
  await page.locator('.sheet .choice', { hasText: 'Simple' }).click();
  await page.locator('.rot-card', { hasText: /Easy Swim|Endurance/ }).first().click();
  await page.locator('.wk-hero.swim').waitFor();
  check('Simple swim mode has no drills', (await page.locator('.list-item', { hasText: /drill/i }).count()) === 0);
  await page.locator('.list-item', { hasText: 'Free' }).first().click();
  await page.locator('.sheet .target-card').waitFor();
  check('Swim rows open the stroke sheet with the set target', (await page.locator('.sheet .video-poster').count()) === 1);
  await closeSheet(page);
  await btn(page, 'Back').click();

  for (const t of ['Today', 'Plan', 'Progress', 'Learn']) {
    await tabTo(page, t);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`No sideways scrolling on ${t}`, over <= 0, `${over}px`);
  }
});

test('resume after reload; 50 m pool swim', async ({ newPage, open, check }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  await page.locator('.wcard.gym').getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.ex-card').first().locator('.set-input').nth(0).fill('77.5');
  await page.locator('.ex-card').first().locator('.set-input').nth(1).fill('11');
  await page.waitForTimeout(400); // typed values save after a short pause
  await page.reload();
  await page.locator('.resume-pill').waitFor();
  check('Resume pill after reload', (await page.locator('.resume-pill').count()) === 1);
  await tabTo(page, 'Learn');
  check('Resume pill floats on other tabs too', (await page.locator('.resume-pill').count()) === 1);
  await page.locator('.resume-pill').click();
  const v = await page.locator('.ex-card').first().locator('.set-input').nth(0).inputValue();
  check('Typed weight survives reload', v === '77.5', v);
  await page.locator('.session-head').getByRole('button', { name: 'Minimize workout' }).click();

  await open(page, { profile: { ...PROFILE, pool: { len: 50, unit: 'm' } }, schedule: WEEK });
  await page.locator('.wcard.swim').getByRole('button', { name: 'Start swim' }).click();
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
  await openSettings(page);
  await page.locator('.seg button', { hasText: 'kg' }).click();
  await tabTo(page, 'Progress');
  await page.locator('.mode-switch').getByRole('tab', { name: 'Workout' }).click();
  await page.locator('.kpi-label', { hasText: 'Lifted (kg)' }).waitFor();
  const e1 = await page.locator('.kv .v').first().textContent();
  check('Progress converts to kg', /kg/.test(e1), e1);
  await tabTo(page, 'Plan');
  await page.locator('.rot-card', { hasText: 'Full Body A' }).click();
  await btn(page, 'Start workout').click();
  const lp = await page.locator('.ex-card').first().locator('.set-input').nth(0).inputValue();
  check('Leg press suggestion converts to kg (about 50)', Math.abs(Number(lp) - 50.5) <= 0.6, lp);
  const lr = await page.locator('.ex-card').filter({ hasText: 'Lateral Raise' }).locator('.set-input').nth(0).inputValue();
  check('Lateral raise uses a real dumbbell size in kg', ['4.5', '5', '6'].includes(lr), lr);
  await page.locator('.session-head').getByRole('button', { name: 'Minimize workout' }).click();

  await openSettings(page);
  await page.locator('.list-item', { hasText: 'Backup & data' }).click();
  const dlP = page.waitForEvent('download');
  await btn(page, 'Export backup').click();
  const file = tmp('backup.json');
  await (await dlP).saveAs(file);
  const before = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')).docs).map(([k, v]) => [PREFIX + k, JSON.stringify(v)]));
  const page2 = await newPage();
  await open(page2, { profile: { onboarded: true, units: 'lb', startDate: '2026-10-01' } });
  await openSettings(page2);
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
  const thu = await page3.locator('.wcard .wc-title').first().textContent();
  await page3.locator('.wday').nth(4).click();
  await page3.locator('.wday').nth(4).and(page3.locator('[aria-pressed="true"]')).waitFor();
  const fri = await page3.locator('.wcard .wc-title').first().textContent();
  check('Future gym days alternate A and B', thu !== fri, `${thu} / ${fri}`);
});

test('navigation: back, swipe-back, forward, tab stacks, scroll', async ({ newPage, open, check }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  const ll = () => page.evaluate(() => history.state?.ll);
  await tabTo(page, 'Plan');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const y0 = await page.evaluate(() => window.scrollY);
  await page.locator('.rot-card', { hasText: 'Full Body A' }).evaluate((el) => el.click()); // tap without scrolling first
  await btn(page, 'Start workout').waitFor();
  await exerciseRow(page).click();
  await page.locator('.sheet .find-card').waitFor();
  check('A sheet is not a history entry', (await ll()) === 1, String(await ll()));
  await closeSheet(page);

  await page.locator('.tabbar').getByRole('button', { name: 'Today' }).click();
  await page.locator('.greet').waitFor();
  check('Switching tab unwinds history', (await ll()) === 0, String(await ll()));
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.list-item', { hasText: 'Backup & data' }).click();
  await page.getByRole('button', { name: 'Export backup' }).waitFor();
  check('Two pages deep = two history entries', (await ll()) === 2, String(await ll()));
  await page.goBack(); // what the iPhone edge swipe does
  await page.locator('.topbar .title', { hasText: 'Settings' }).waitFor();
  check('Swipe-back returns one page', (await ll()) === 1);

  await page.locator('.tabbar').getByRole('button', { name: 'Plan' }).click();
  await btn(page, 'Start workout').waitFor();
  check('Plan remembers its open page', (await ll()) === 1, String(await ll()));
  await page.locator('.tabbar').getByRole('button', { name: 'Plan' }).click();
  await page.locator('.page-head h1', { hasText: 'Plan' }).waitFor();
  check('Tapping the active tab pops to its root', (await ll()) === 0);
  const y1 = await page.evaluate(() => window.scrollY);
  check('Scroll position comes back', y0 > 0 && Math.abs(y1 - y0) < 2, `${y0} → ${y1}`);
  await page.goForward();
  await btn(page, 'Start workout').waitFor();
  check('Forward restores the page', (await ll()) === 1);
  await btn(page, 'Back').click();
  await page.locator('.page-head h1', { hasText: 'Plan' }).waitFor();
  check('Back button pops through history', (await ll()) === 0);
  await page.locator('.tabbar').getByRole('button', { name: 'Today' }).click();
  await page.locator('.topbar .title', { hasText: 'Settings' }).waitFor();
  check('Today remembers Settings was open', (await ll()) === 1);
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
    await page.locator('.rot-card', { hasText: 'Full Body A' }).click();
    await btn(page, 'Start workout').waitFor();
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

test('sheets: drag to dismiss, snap back, escape, glass settings', async ({ newPage, open, check, shot }) => {
  const page = await newPage({ motion: true });
  await open(page, { profile: PROFILE, schedule: WEEK });
  const openPicker = async () => {
    await page.getByRole('button', { name: 'Start a different workout' }).click();
    await page.locator('.sheet').waitFor();
    await page.waitForTimeout(500); // let it finish sliding up
  };
  const dragTop = async (dy) => {
    const box = await page.locator('.sheet-top').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + 8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y + (dy * i) / 8); await page.waitForTimeout(16); }
    await page.mouse.up();
  };
  await openPicker();
  await shot(page, 'sheet-open', false);
  check('Open sheet has no leftover transform', await page.locator('.sheet').evaluate((el) => getComputedStyle(el).transform === 'none'));
  await dragTop(60);
  await page.waitForTimeout(450);
  check('A short drag snaps back', (await page.locator('.sheet').count()) === 1 && await page.locator('.sheet').evaluate((el) => getComputedStyle(el).transform === 'none'));
  const h = (await page.locator('.sheet').boundingBox()).height;
  await dragTop(h * 0.5);
  await page.locator('.scrim').waitFor({ state: 'detached' });
  check('Dragging past a third closes it', true);
  check('Page scrolls again after closing', await page.evaluate(() => document.body.style.overflow === ''));

  await openPicker();
  // Touch drag on the content while it's scrolled to the top.
  await page.locator('.sheet-body').evaluate(async (body) => {
    const fire = (type, y) => {
      const t = new Touch({ identifier: 1, target: body, clientX: 200, clientY: y });
      body.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
    };
    fire('touchstart', 300);
    for (let i = 1; i <= 10; i++) { fire('touchmove', 300 + i * 45); await new Promise((r) => setTimeout(r, 16)); }
    fire('touchend', 750);
  });
  await page.locator('.scrim').waitFor({ state: 'detached' });
  check('Pulling the content down from the top closes it', true);

  await openPicker();
  await page.keyboard.press('Escape');
  await page.locator('.scrim').waitFor({ state: 'detached' });
  check('Escape closes the sheet', true);

  await open(page, { profile: PROFILE, schedule: WEEK, settings: { reduceTransparency: true } });
  await page.getByRole('button', { name: 'Start a different workout' }).click();
  const bf = await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backdropFilter);
  check('Reduce transparency turns the glass solid', bf === 'none', bf);
});

test('today: pick a day in place, look ahead and back, rings', async ({ newPage, open, check, shot }) => {
  const page = await newPage();
  await open(page, {
    profile: PROFILE, schedule: WEEK,
    'sessions-2026-10': { items: [gymSession('a2', '2026-10-05', 'p1-a', [['leg-press', [[100, 15], [100, 15], [100, 15]]]])] },
  });
  await shot(page, 'today', false);
  const ll = () => page.evaluate(() => history.state?.ll);
  check('Rings card shows this week', (await page.locator('.week-rings').count()) === 1 && /1\/3/.test(await page.locator('.week-rings').textContent()));
  check('Monday shows as done in the strip', (await page.locator('.wday').nth(0).locator('.wd-mark.done').count()) === 1);
  check('Tuesday (planned, nothing logged) shows as missed', (await page.locator('.wday').nth(1).locator('.wd-mark.missed').count()) === 1);
  await page.locator('.wday').nth(4).click(); // Friday, gym
  await page.getByRole('button', { name: 'Back to today' }).waitFor();
  check('Picking a day stays on Today (no new page)', (await ll()) === 0);
  check('A future day offers Details but not Start', (await page.locator('.wcard').getByRole('button', { name: 'Start workout' }).count()) === 0 && (await page.locator('.wcard').getByRole('button', { name: 'Details' }).count()) === 1);
  await page.locator('.wday').nth(1).click(); // Tuesday, missed swim
  check('A missed day says what was planned', (await page.locator('.missed-card', { hasText: 'was planned' }).count()) === 1);
  await page.locator('.wday').nth(0).click(); // Monday, done
  check('A past day shows what was done', (await page.locator('.done-card', { hasText: 'Full Body A' }).count()) === 1);
  await page.getByRole('button', { name: 'Next week' }).click();
  check('Next week moves the strip', (await page.locator('.week-label').textContent()) === 'Next week');
  await page.getByRole('button', { name: 'Back to today' }).click();
  await page.locator('.week-label', { hasText: 'This week' }).waitFor();
  check('"Back to today" returns', (await page.locator('.wday.is-today[aria-pressed="true"]').count()) === 1);
  await page.locator('.week-rings').click();
  await page.locator('.tabbar [aria-current="page"]', { hasText: 'Progress' }).waitFor();
  check('Rings open Progress', true);
});

test('today: card morphs into the workout page and back', async ({ newPage, open, check }) => {
  const page = await newPage({ motion: true });
  await open(page, { profile: PROFILE, schedule: WEEK });
  await page.locator('.wcard.gym').getByRole('button', { name: 'Details' }).click();
  await page.locator('.wk-hero').waitFor();
  check('The page hero carries the shared name', (await page.locator('.wk-hero').evaluate((el) => el.style.viewTransitionName)) === 'wk-hero');
  await page.waitForFunction(() => !document.documentElement.dataset.vt);
  await btn(page, 'Back').click();
  await page.locator('.wcard.gym').waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.vt);
  await page.waitForTimeout(800);
  check('The name is cleared after coming back', (await page.locator('.wcard.gym').evaluate((el) => el.style.viewTransitionName)) === '');
});

test('every page renders without errors', async ({ newPage, open, check }) => {
  const page = await newPage();
  await open(page, {
    profile: PROFILE, schedule: WEEK, settings: { trackBody: true },
    'sessions-2026-10': { items: [gymSession('a2', '2026-10-05', 'p1-a', [['leg-press', [[100, 15], [100, 15], [100, 15]]]])] },
  });
  const visit = async (label, open, ready) => {
    await open();
    await ready.waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${label} renders without sideways scrolling`, over <= 0, `${over}px`);
  };
  await tabTo(page, 'Progress');
  await visit('History', () => page.getByRole('button', { name: 'See all history' }).click(), page.locator('.month'));
  await visit('Session details', () => page.locator('.session-row').first().click(), page.locator('.page-head h1', { hasText: 'Full Body A' }));
  await btn(page, 'Back').click();
  await page.locator('.m-day').nth(8).click(); // a day in the calendar jumps to Today
  await page.locator('.tabbar [aria-current="page"]', { hasText: 'Today' }).waitFor();
  check('Tapping a calendar day opens it on Today', (await page.locator('.wday[aria-pressed="true"]').count()) === 1);
  await tabTo(page, 'Learn');
  await visit('A guide', () => page.locator('.list-item', { hasText: 'Start here' }).click(), page.locator('.prose'));
  await btn(page, 'Back').click();
  for (const tool of ['Plate calculator', '1-rep max', 'Swim pace', 'Calories & protein']) {
    await visit(`Tool: ${tool}`, () => page.locator('.list-item', { hasText: tool }).click(), page.locator('.seg'));
    await btn(page, 'Back').click();
  }
  await openSettings(page);
  for (const [row, ready] of [['Backup & data', 'Export backup'], ['Install on iPhone', 'Put it on your Home Screen'], ['Habits', 'Avg sleep (7 days)'], ['Body log', 'Tap an entry to delete it.']]) {
    await visit(row, () => page.locator('.list-item', { hasText: row }).click(), page.getByText(ready).first());
    await btn(page, 'Back').click();
  }
  await tabTo(page, 'Plan');
  await visit('Workout builder', () => page.locator('.rot-card.create').click(), page.locator('#b-name'));
  await btn(page, 'Back').click();
  await visit('About the program sheet', () => page.locator('.program-card').click(), page.locator('.sheet', { hasText: 'Foundation' }));
});

test('progress: total, workout and swim over each range', async ({ newPage, open, check, shot }) => {
  const swim = (id, date, distance, durationSec) => ({
    id, kind: 'swim', date, name: 'Technique 1', templateId: 'swim:novice-p1-tech', distance, durationSec, pool: { len: 25, unit: 'yd' },
    blocks: [{ name: 'Main set', items: [{ reps: 8, dist: 25, stroke: 'Free', done: Array(8).fill(true) }, { reps: 4, dist: 25, stroke: 'Breast', done: Array(4).fill(true) }] }],
  });
  const page = await newPage();
  await open(page, {
    profile: PROFILE, schedule: WEEK,
    'sessions-2026-09': { items: [gymSession('g0', '2026-09-28', 'p1-a', [['leg-press', [[90, 12], [90, 12]]]]), swim('s0', '2026-09-29', 300, 900)] },
    'sessions-2026-10': { items: [
      { ...gymSession('g1', '2026-10-05', 'p1-a', [['leg-press', [[100, 15], [100, 15]]], ['lat-pulldown', [[60, 12]]]]), prs: [{ exId: 'leg-press', kind: 'weight', value: 100 }] },
      swim('s1', '2026-10-06', 300, 840),
    ] },
  });
  await tabTo(page, 'Progress');
  const kpiBox = (label) => page.locator('.kpi', { has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}`) }) });
  const kpi = async (label) => (await kpiBox(label).locator('.kpi-value').textContent()).trim();
  check('Total: 4 sessions in 12 weeks', (await kpi('Sessions')) === '4', await kpi('Sessions'));
  check('Total chart has a legend for workouts and swims', (await page.locator('.legend').textContent()).includes('Workouts'));
  await page.locator('.range-chips').getByRole('button', { name: '1 week' }).click();
  check('1 week: 2 sessions', (await kpi('Sessions')) === '2');
  check('1 week compares with the previous 7 days', (await kpiBox('Sessions').locator('.kpi-delta').textContent()).includes('Same as previous 7 days'));
  await shot(page, 'progress-total', true);
  await page.locator('.mode-switch').getByRole('tab', { name: 'Workout' }).click();
  await page.locator('.kpi-label', { hasText: 'Lifted' }).waitFor();
  check('Workout: lifted volume this week', (await kpi('Lifted')) === '3,720', await kpi('Lifted'));
  check('Workout: muscle groups', (await page.locator('.hbar', { hasText: 'Legs' }).count()) === 1 && (await page.locator('.hbar', { hasText: 'Back' }).count()) === 1);
  check('Workout: records list the PR', (await page.locator('.pr', { hasText: 'Leg Press' }).count()) === 1);
  await shot(page, 'progress-workout', true);
  await page.locator('.mode-switch').getByRole('tab', { name: 'Swim' }).click();
  await page.locator('.kpi-label', { hasText: 'Distance' }).waitFor();
  check('Swim: distance this week', (await kpi('Distance')) === '300');
  check('Swim: pace per 100', (await kpi('Pace')) === '4:40', await kpi('Pace'));
  check('Swim: pace improved vs last week', (await kpiBox('Pace').locator('.kpi-delta').textContent()).includes('20 s faster'));
  check('Swim: distance by stroke', (await page.locator('.hbar', { hasText: 'Freestyle' }).count()) === 1);
  for (const r of ['8 weeks', '12 weeks', '6 months']) {
    await page.locator('.range-chips').getByRole('button', { name: r }).click();
    check(`Swim over ${r} renders`, (await page.locator('.kpi').count()) === 4);
  }
  await shot(page, 'progress-swim', true);
  check('Recent lists swims only', (await page.locator('.session-row').count()) === 2);
});

test('focus mode: steppers, auto-advance, survives reload, same data as the list', async ({ newPage, open, check, shot }) => {
  const page = await newPage();
  await open(page, { profile: PROFILE, schedule: WEEK });
  await page.locator('.wcard.gym').getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.ex-card').first().waitFor();
  check('Workouts start in the list view by default', (await page.locator('.pager').count()) === 0);
  await page.getByRole('button', { name: 'One exercise at a time' }).click();
  await page.locator('.fpage .complete-set').first().waitFor();
  check('Focus opens on the first exercise', (await page.locator('.pager-dots span.on').count()) === 1 && (await page.evaluate(() => JSON.parse(localStorage.getItem('liftlap:v1:active')).focusIndex)) === 1);
  const pageEl = page.locator('.fpage').nth(1);
  const weight = pageEl.locator('.st-input').first();
  await pageEl.getByRole('button', { name: 'More lb' }).click();
  await pageEl.getByRole('button', { name: 'More lb' }).click();
  check('+ steps the weight by one machine pin', (await weight.inputValue()) === '20', await weight.inputValue());
  await pageEl.getByRole('button', { name: 'Less reps' }).click();
  const reps = await pageEl.locator('.st-input').nth(1).inputValue();
  await shot(page, 'focus', false);
  await pageEl.locator('.complete-set').click();
  check('Completing a set ticks it', (await page.locator('.fpage').nth(1).locator('.fset.done').count()) === 1);
  check('…and starts the rest timer', await page.locator('.rest-bar').isVisible());
  await page.locator('.fpage').nth(1).locator('.complete-set').click();
  await page.locator('.fpage').nth(1).locator('.complete-set').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('liftlap:v1:active')).focusIndex === 2, null, { timeout: 3000 });
  check('After the last set it slides to the next exercise', true);
  await page.reload();
  await page.locator('.resume-pill').click();
  await page.locator('.pager').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.pager-dots span.on').length === 1);
  check('Reload keeps Focus mode and the page', (await page.locator('.pager-dots span').nth(2).getAttribute('class')) === 'on');
  await page.getByRole('button', { name: 'Show all exercises' }).click();
  await page.locator('.ex-card').first().waitFor();
  check('List shows the same three sets done', (await page.locator('.ex-card').first().locator('.set-row.done').count()) === 3);
  const listW = await page.locator('.ex-card').first().locator('.set-input').nth(0).inputValue();
  const listR = await page.locator('.ex-card').first().locator('.set-input').nth(1).inputValue();
  check('…with the stepped weight and reps', listW === '20' && listR === reps, `${listW} × ${listR}`);
  await page.locator('.session-head').getByRole('button', { name: 'Minimize workout' }).click();

  const page2 = await newPage();
  await open(page2, { profile: PROFILE, schedule: WEEK, settings: { sessionView: 'focus' } });
  await page2.locator('.wcard.gym').getByRole('button', { name: 'Start workout' }).click();
  await page2.locator('.pager').waitFor();
  check('Settings can make Focus the starting view', (await page2.getByRole('button', { name: "I'm warmed up" }).count()) === 1);
});

await run();

// When to send what. Everything here is plain functions of a user record and
// the current time, so it's easy to test.
//
// User record (what the app syncs, plus a little server state):
// {
//   id, subscription: { endpoint, keys: { p256dh, auth } }, tz: 'America/New_York',
//   reminders: { on: true, time: '08:00' }, milestones: true,
//   plan: [{ date: 'YYYY-MM-DD', kind: 'workout' | 'program', title, body }],
//   week: ['gym', 'swim', 'both', 'rest', ...],  // Monday first: used after the plan runs out
//   done: ['YYYY-MM-DD', ...],                      // days you've already trained
//   lastReminder: 'YYYY-MM-DD'                      // set by the server
// }

export const GRACE_MS = 2 * 3600 * 1000; // a reminder more than 2 h late isn't sent
const LOOKAHEAD_DAYS = 400;

/** Minutes `tz` is ahead of UTC at instant `ms` (e.g. -240 for New York in summer). */
export function tzOffset(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The instant (ms) of local date `dateIso` at `hhmm` in `tz`. */
export function zonedInstant(dateIso, hhmm, tz) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const first = wall - tzOffset(wall, tz) * 60000;
  return wall - tzOffset(first, tz) * 60000; // settles across a daylight-saving change
}

/** Local calendar date in `tz` at instant `ms`. */
export function localDate(ms, tz) {
  return new Date(ms + tzOffset(ms, tz) * 60000).toISOString().slice(0, 10);
}

export function addDaysIso(dateIso, n) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const WEEK_TEXT = {
  gym: ['Gym day', 'Open Lift & Lap to start your next workout.'],
  swim: ['Swim day', 'Open Lift & Lap for today\'s swim.'],
  both: ['Gym and swim day', 'Open Lift & Lap to see today\'s plan.'],
};

/**
 * What to send on `date`, or null for nothing. Planned workouts are skipped
 * once you've trained that day; program news (a new phase) still goes out.
 * After the synced plan runs out, the weekly schedule gives a simpler nudge.
 */
export function messageFor(user, date) {
  const reminders = user.reminders?.on;
  const planned = (user.plan || []).filter((e) => e.date === date);
  const lastPlanned = (user.plan || []).reduce((max, e) => (e.date > max ? e.date : max), '');
  let workout = reminders ? planned.find((e) => e.kind === 'workout') : null;
  if (reminders && !workout && date > lastPlanned && user.week?.length === 7) {
    const [y, m, d] = date.split('-').map(Number);
    const slot = user.week[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
    const text = WEEK_TEXT[slot] || (slot && slot !== 'rest' ? ['Training day', 'Open Lift & Lap to start today\'s workout.'] : null);
    if (text) workout = { title: text[0], body: text[1] };
  }
  if (workout && (user.done || []).includes(date)) workout = null;
  const news = user.milestones ? planned.find((e) => e.kind === 'program') : null;
  if (!workout && !news) return null;
  if (workout && news) return { title: workout.title, body: `${workout.body}\n${news.title}. ${news.body}`, tag: 'reminder', url: './' };
  const one = workout || news;
  return { title: one.title, body: one.body, tag: 'reminder', url: './' };
}

/** The reminder time for a user: theirs when set, else 8:00. */
const timeOf = (user) => (/^\d{2}:\d{2}$/.test(user.reminders?.time || '') ? user.reminders.time : '08:00');

/**
 * The next send for a user after `now`: { at, date, message } or null. A
 * date already handled (lastReminder) is skipped, and so is one whose time
 * passed more than GRACE_MS ago.
 */
export function nextSend(user, now) {
  if (!user.subscription || !user.tz || !(user.reminders?.on || user.milestones)) return null;
  let date = localDate(now, user.tz);
  for (let i = 0; i < LOOKAHEAD_DAYS; i++, date = addDaysIso(date, 1)) {
    if (user.lastReminder && date <= user.lastReminder) continue;
    const at = zonedInstant(date, timeOf(user), user.tz);
    if (at + GRACE_MS < now) continue;
    const message = messageFor(user, date);
    if (message) return { at: Math.max(at, now), date, message };
  }
  return null;
}

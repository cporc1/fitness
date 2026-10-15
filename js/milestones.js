// Milestones: badges you earn from what you log. Progress shows them all;
// finishing a session celebrates any that are new, and can send a
// notification (js/notify.js).

import { todayISO } from './util.js';
import { GYM_TEMPLATES } from './data/plans.js';
import { weekStreak, swimDistance, sessionVolume } from './stats.js';

export const MILESTONES = [
  { id: 'first', title: 'First workout', sub: 'You showed up', test: (st) => st.sessions.length >= 1 },
  { id: 'first-swim', title: 'First swim', sub: 'In the water', test: (st) => st.sessions.some((s) => s.kind === 'swim') },
  { id: 'ten', title: '10 workouts', sub: 'A habit is forming', test: (st) => st.sessions.length >= 10 },
  { id: 'twentyfive', title: '25 workouts', sub: 'Officially a regular', test: (st) => st.sessions.length >= 25 },
  { id: 'fifty', title: '50 workouts', sub: 'Half a hundred', test: (st) => st.sessions.length >= 50 },
  { id: 'streak4', title: '4-week streak', sub: '2+ workouts, 4 weeks running', test: (st) => weekStreak(st.sessions, todayISO()) >= 4 },
  { id: 'mile', title: 'Swim a mile', sub: '1,760 yd / 1,609 m in total', test: (st) => st.sessions.reduce((sum, s) => sum + swimDistance(s, 'yd'), 0) >= 1760 },
  { id: 'k1', title: '1,000 in one swim', sub: 'One session, 1,000 yd/m', test: (st) => st.sessions.some((s) => s.kind === 'swim' && (s.distance || 0) >= 1000) },
  { id: 'pr', title: 'First PR', sub: 'Beat your own best', test: (st) => st.sessions.some((s) => s.prs?.length) },
  { id: 'phase2', title: 'Phase 2 started', sub: 'Barbell basics', test: (st) => st.sessions.some((s) => GYM_TEMPLATES.find((t) => t.id === s.templateId)?.phase >= 2) },
  { id: 'phase3', title: 'Phase 3 started', sub: 'Getting strong', test: (st) => st.sessions.some((s) => GYM_TEMPLATES.find((t) => t.id === s.templateId)?.phase >= 3) },
  { id: 'hundred-k', title: '100,000 lifted', sub: 'Total lb (or 45,000 kg)', test: (st) => st.sessions.reduce((sum, s) => sum + sessionVolume(s, 'lb'), 0) >= 100000 },
];

export const milestoneById = (id) => MILESTONES.find((m) => m.id === id) || null;

/** Milestones earned with `after` that weren't with `before` (arrays of sessions). */
export function newMilestones(before, after) {
  return MILESTONES.filter((m) => !m.test({ sessions: before }) && m.test({ sessions: after }));
}

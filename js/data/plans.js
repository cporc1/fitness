// The 12-week beginner gym program: three 4-week phases. Two styles:
//   'full'        Full Body A / Full Body B alternate (best for 2–3 gym days a week)
//   'upper-lower' Upper / Lower alternate (best for 4+ gym days a week)
//
// Exercise entry: { ex, sets, reps: [min, max], rest (seconds), note? }
// For 'time' exercises reps are seconds; for 'cardio' they are minutes.

export const PHASES = [
  {
    id: 1, name: 'Foundation', weeks: [1, 4],
    effort: 'RPE 6–7: finish each set feeling you could do 3–4 more reps.',
    summary: 'Learn the movements on stable machines and dumbbells, build the habit, and find your starting weights. Leave plenty in the tank.',
  },
  {
    id: 2, name: 'Build', weeks: [5, 8],
    effort: 'RPE 7–8: finish each set with 2–3 good reps left.',
    summary: 'Introduce the main barbell lifts with light weights, add a set here and there, and start pushing the double-progression system.',
  },
  {
    id: 3, name: 'Progress', weeks: [9, 12],
    effort: 'RPE 8 on main lifts (about 2 reps left), RPE 7–8 on the rest.',
    summary: 'Heavier main lifts in lower rep ranges and more total work. In week 12, compare your weights and swim distances with week 1.',
  },
];

export const SPLITS = [
  { id: 'full', name: 'Full body', sub: 'Every gym session trains your whole body. Best for 2–3 gym sessions a week.' },
  { id: 'upper-lower', name: 'Upper / lower', sub: 'Alternate upper-body and leg days. Best for 4 or more gym sessions a week.' },
];

const BARBELL_INTRO = 'First 2 sessions: empty bar, stop at RPE 7 while you learn the movement.';

export const GYM_TEMPLATES = [
  // ================= Full body =================
  // ---------- Phase 1 · Foundation ----------
  {
    id: 'p1-a', split: 'full', phase: 1, slot: 'A', name: 'Full Body A', focus: 'Machines to learn the patterns: push, pull, squat, hinge.',
    exercises: [
      { ex: 'leg-press', sets: 3, reps: [10, 15], rest: 120 },
      { ex: 'machine-chest-press', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'lat-pulldown', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'db-rdl', sets: 2, reps: [10, 12], rest: 90, note: 'Start light. Learn the hip hinge before adding weight.' },
      { ex: 'lateral-raise', sets: 2, reps: [12, 20], rest: 60 },
      { ex: 'plank', sets: 2, reps: [20, 40], rest: 45 },
    ],
  },
  {
    id: 'p1-b', split: 'full', phase: 1, slot: 'B', name: 'Full Body B', focus: 'Free-weight basics with dumbbells and cables.',
    exercises: [
      { ex: 'goblet-squat', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'seated-cable-row', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'db-shoulder-press', sets: 3, reps: [10, 12], rest: 90 },
      { ex: 'leg-curl', sets: 2, reps: [10, 15], rest: 75 },
      { ex: 'push-up', sets: 2, reps: [5, 12], rest: 75, note: 'Use a bench or bar to raise your hands if floor push-ups are too hard.' },
      { ex: 'dead-bug', sets: 2, reps: [6, 10], rest: 45 },
    ],
  },

  // ---------- Phase 2 · Build ----------
  {
    id: 'p2-a', split: 'full', phase: 2, slot: 'A', name: 'Full Body A', focus: 'Meet the barbell squat. Start with the empty bar.',
    exercises: [
      { ex: 'back-squat', sets: 3, reps: [6, 10], rest: 150, note: `Use the safety bars. ${BARBELL_INTRO} Not ready? Swap for Goblet Squat or Leg Press.` },
      { ex: 'db-bench', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'lat-pulldown', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'db-rdl', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'lateral-raise', sets: 2, reps: [12, 20], rest: 60 },
      { ex: 'db-curl', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'plank', sets: 2, reps: [30, 45], rest: 45 },
    ],
  },
  {
    id: 'p2-b', split: 'full', phase: 2, slot: 'B', name: 'Full Body B', focus: 'Learn the trap bar deadlift and single-leg work.',
    exercises: [
      { ex: 'trap-bar-deadlift', sets: 3, reps: [6, 10], rest: 150, note: `${BARBELL_INTRO} No trap bar? Use Leg Press for 3 × 8–12.` },
      { ex: 'db-shoulder-press', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'seated-cable-row', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'split-squat', sets: 2, reps: [8, 12], rest: 90 },
      { ex: 'face-pull', sets: 2, reps: [12, 15], rest: 60 },
      { ex: 'triceps-pushdown', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'pallof-press', sets: 2, reps: [10, 12], rest: 45 },
    ],
  },

  // ---------- Phase 3 · Progress ----------
  {
    id: 'p3-a', split: 'full', phase: 3, slot: 'A', name: 'Full Body A', focus: 'Heavier squat and bench. Main lifts get the longest rest.',
    exercises: [
      { ex: 'back-squat', sets: 4, reps: [5, 8], rest: 180 },
      { ex: 'bench-press', sets: 3, reps: [6, 10], rest: 150, note: `Bench in a rack with the safety pins set, or use Dumbbell Bench. ${BARBELL_INTRO}` },
      { ex: 'assisted-pullup', sets: 3, reps: [6, 10], rest: 120 },
      { ex: 'bb-rdl', sets: 3, reps: [8, 12], rest: 150, note: BARBELL_INTRO },
      { ex: 'lateral-raise', sets: 3, reps: [12, 20], rest: 60 },
      { ex: 'hammer-curl', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'hanging-knee-raise', sets: 2, reps: [8, 12], rest: 60 },
    ],
  },
  {
    id: 'p3-b', split: 'full', phase: 3, slot: 'B', name: 'Full Body B', focus: 'Heavier deadlift and overhead press.',
    exercises: [
      { ex: 'trap-bar-deadlift', sets: 3, reps: [5, 8], rest: 180 },
      { ex: 'ohp', sets: 3, reps: [6, 10], rest: 150, note: `${BARBELL_INTRO} Seated Dumbbell Shoulder Press is a fine swap.` },
      { ex: 'chest-supported-row', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'walking-lunge', sets: 2, reps: [10, 12], rest: 90 },
      { ex: 'incline-db-press', sets: 2, reps: [10, 12], rest: 90 },
      { ex: 'face-pull', sets: 2, reps: [12, 15], rest: 60 },
      { ex: 'side-plank', sets: 2, reps: [20, 40], rest: 45 },
    ],
  },

  // ================= Upper / lower =================
  // ---------- Phase 1 · Foundation ----------
  {
    id: 'p1-u', split: 'upper-lower', phase: 1, slot: 'U', name: 'Upper Body', focus: 'Chest, back, shoulders and arms on machines and dumbbells.',
    exercises: [
      { ex: 'machine-chest-press', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'lat-pulldown', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'db-shoulder-press', sets: 2, reps: [10, 12], rest: 90 },
      { ex: 'seated-cable-row', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'lateral-raise', sets: 2, reps: [12, 20], rest: 60 },
      { ex: 'triceps-pushdown', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'db-curl', sets: 2, reps: [10, 15], rest: 60 },
    ],
  },
  {
    id: 'p1-l', split: 'upper-lower', phase: 1, slot: 'L', name: 'Lower Body', focus: 'Legs, hips and core on stable machines.',
    exercises: [
      { ex: 'leg-press', sets: 3, reps: [10, 15], rest: 120 },
      { ex: 'db-rdl', sets: 3, reps: [10, 12], rest: 90, note: 'Start light. Learn the hip hinge before adding weight.' },
      { ex: 'leg-curl', sets: 2, reps: [10, 15], rest: 75 },
      { ex: 'leg-extension', sets: 2, reps: [10, 15], rest: 75 },
      { ex: 'calf-raise', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'plank', sets: 2, reps: [20, 40], rest: 45 },
      { ex: 'dead-bug', sets: 2, reps: [6, 10], rest: 45 },
    ],
  },

  // ---------- Phase 2 · Build ----------
  {
    id: 'p2-u', split: 'upper-lower', phase: 2, slot: 'U', name: 'Upper Body', focus: 'Free-weight pressing and rows.',
    exercises: [
      { ex: 'db-bench', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'lat-pulldown', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'db-shoulder-press', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'seated-cable-row', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'face-pull', sets: 2, reps: [12, 15], rest: 60 },
      { ex: 'db-curl', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'triceps-pushdown', sets: 2, reps: [10, 15], rest: 60 },
    ],
  },
  {
    id: 'p2-l', split: 'upper-lower', phase: 2, slot: 'L', name: 'Lower Body', focus: 'Meet the barbell squat. Start with the empty bar.',
    exercises: [
      { ex: 'back-squat', sets: 3, reps: [6, 10], rest: 150, note: `Use the safety bars. ${BARBELL_INTRO} Not ready? Swap for Goblet Squat or Leg Press.` },
      { ex: 'db-rdl', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'split-squat', sets: 2, reps: [8, 12], rest: 90 },
      { ex: 'leg-curl', sets: 2, reps: [10, 15], rest: 75 },
      { ex: 'calf-raise', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'pallof-press', sets: 2, reps: [10, 12], rest: 45 },
    ],
  },

  // ---------- Phase 3 · Progress ----------
  {
    id: 'p3-u', split: 'upper-lower', phase: 3, slot: 'U', name: 'Upper Body', focus: 'Heavier bench and overhead press.',
    exercises: [
      { ex: 'bench-press', sets: 3, reps: [6, 10], rest: 150, note: `Bench in a rack with the safety pins set, or use Dumbbell Bench. ${BARBELL_INTRO}` },
      { ex: 'assisted-pullup', sets: 3, reps: [6, 10], rest: 120 },
      { ex: 'ohp', sets: 3, reps: [6, 10], rest: 150, note: `${BARBELL_INTRO} Seated Dumbbell Shoulder Press is a fine swap.` },
      { ex: 'chest-supported-row', sets: 3, reps: [8, 12], rest: 90 },
      { ex: 'lateral-raise', sets: 3, reps: [12, 20], rest: 60 },
      { ex: 'hammer-curl', sets: 2, reps: [10, 15], rest: 60 },
      { ex: 'overhead-triceps', sets: 2, reps: [10, 15], rest: 60 },
    ],
  },
  {
    id: 'p3-l', split: 'upper-lower', phase: 3, slot: 'L', name: 'Lower Body', focus: 'Heavier squat and hinge. Main lifts get the longest rest.',
    exercises: [
      { ex: 'back-squat', sets: 4, reps: [5, 8], rest: 180 },
      { ex: 'bb-rdl', sets: 3, reps: [8, 12], rest: 150, note: BARBELL_INTRO },
      { ex: 'walking-lunge', sets: 2, reps: [10, 12], rest: 90 },
      { ex: 'leg-curl', sets: 2, reps: [10, 15], rest: 75 },
      { ex: 'calf-raise', sets: 3, reps: [10, 15], rest: 60 },
      { ex: 'hanging-knee-raise', sets: 2, reps: [8, 12], rest: 60 },
    ],
  },
];

export const WARMUP_GYM = [
  '5 minutes easy cardio (bike, rower or incline walk)',
  '10 leg swings each side, 10 arm circles each way',
  '10 bodyweight squats and 10 hip hinges',
  'Warm-up sets before each barbell lift, and before your first lift: empty bar or light × 8–10, about 50% × 8, then 75% × 4',
];

export const COOLDOWN_GYM = [
  '3–5 minutes easy walking',
  'Optional stretches: hip flexors, hamstrings, chest doorway stretch (30 s each)',
];

export function phaseForWeek(week) {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[PHASES.length - 1];
}

export function gymTemplatesForPhase(phaseId, split = 'full') {
  return GYM_TEMPLATES.filter((t) => t.phase === phaseId && t.split === (split === 'upper-lower' ? 'upper-lower' : 'full'));
}

export function getGymTemplate(id) {
  return GYM_TEMPLATES.find((t) => t.id === id) || null;
}

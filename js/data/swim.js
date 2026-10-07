// Swim drills and the 12-week swim progression.
//
// Swim workouts are written in a 25-unit pool (yards or meters). An item:
//   { reps, dist?, secs?, stroke, drill?, rest, label?, note? }
//   dist  distance per rep (25, 50, 100 ...). Omitted for count- or time-based items.
//   secs  seconds per rep for time-based items (e.g. kicking at the wall).
//   rest  seconds of rest after each rep.
// expandForPool() adapts the 25-based plan to a 50 m pool.

export const SWIM_LEVELS = [
  {
    id: 'learner', name: 'Learning to swim',
    desc: 'I can\'t swim a full length yet, or I\'m nervous in the water.',
  },
  {
    id: 'novice', name: 'Beginner swimmer',
    desc: 'I can swim 1–2 lengths, then I need to stop and catch my breath.',
  },
  {
    id: 'comfortable', name: 'Comfortable swimmer',
    desc: 'I can swim 200+ yards/meters without stopping.',
  },
];

export const STROKES = {
  Free: 'Freestyle',
  Back: 'Backstroke',
  Breast: 'Breaststroke',
  Kick: 'Kick',
  Pull: 'Pull',
  Drill: 'Drill',
  Choice: 'Any stroke',
  Skill: 'Skill',
};

export const DRILLS = [
  {
    id: 'bobs', name: 'Bobs (bubble breathing)', purpose: 'Learn to breathe out underwater, the #1 skill for relaxed swimming.',
    steps: [
      'Stand in chest-deep water holding the wall.',
      'Take a breath, sink down until your head is under, and hum or blow bubbles out through your nose and mouth.',
      'Come up, take a quick breath in through your mouth, and go back down. Find a calm rhythm.',
    ],
    cues: ['Exhale fully underwater so you only need to inhale above it', 'Relax your shoulders'],
  },
  {
    id: 'front-float', name: 'Front float & stand up', purpose: 'Feel the water hold you up, and learn to recover to standing safely.',
    steps: [
      'In shallow water, take a breath and lean forward with your face in the water, arms reaching forward.',
      'Let your legs float up behind you. Hold for 5–10 seconds, blowing a few bubbles.',
      'To stand: pull your knees to your chest, press your hands down, lift your head, and put your feet down.',
    ],
    cues: ['Look at the bottom, not forward', 'Press your chest down to bring your hips up'],
  },
  {
    id: 'streamline-glide', name: 'Push-off & streamline glide', purpose: 'Every length starts here. A good streamline is free speed.',
    steps: [
      'Stand with your back to the wall, one foot on it.',
      'Stack your hands (one on top of the other), arms squeezing your ears.',
      'Sink under, push off hard with both feet, and glide face-down in a tight, long line until you slow down.',
    ],
    cues: ['Squeeze your ears with your arms', 'Point your toes', 'Exhale slowly through your nose'],
  },
  {
    id: 'kickboard', name: 'Flutter kick with kickboard', purpose: 'Build kick fitness and a level body position.',
    steps: [
      'Hold the far end of a kickboard with straight arms.',
      'Kick from your hips with mostly straight legs and loose ankles. Small, fast kicks.',
      'Put your face in and blow bubbles, lifting your chin forward to breathe when needed.',
    ],
    cues: ['Kick from the hips, not the knees', 'Toes pointed, ankles floppy', 'Splash just at the surface'],
  },
  {
    id: 'wall-kick', name: 'Kicking at the wall', purpose: 'Practice the flutter kick and breathing while holding the wall.',
    steps: [
      'Hold the pool edge with both hands, arms straight, body floating behind you.',
      'Flutter kick with straight legs and pointed toes.',
      'Face in the water, blow bubbles, turn your head to the side to breathe.',
    ],
    cues: ['Hips up near the surface', 'Turn your head to breathe, do not lift it'],
  },
  {
    id: 'side-kick', name: 'Side kick', purpose: 'Learn the body rotation and side breathing that freestyle depends on.',
    steps: [
      'Push off and roll onto your side, bottom arm stretched forward, top arm resting on your hip.',
      'Flutter kick on your side, face looking down at the bottom.',
      'Rotate your head (not your body) to breathe, keeping one goggle in the water.',
      'Switch sides each length. Fins help a lot if your pool allows them.',
    ],
    cues: ['Bottom arm long and relaxed', 'Head stays in line with your spine'],
  },
  {
    id: 'catch-up', name: 'Catch-up drill', purpose: 'Slows your stroke down so you can feel a long, full pull.',
    steps: [
      'Swim freestyle, but leave one hand stretched in front until the other hand comes over and touches it.',
      'Only then does the front hand start its pull.',
      'Breathe to the side of the arm that is pulling.',
    ],
    cues: ['Long body, long reach', 'Smooth, not rushed'],
  },
  {
    id: 'fingertip-drag', name: 'Fingertip drag', purpose: 'Teaches a high, relaxed elbow on the arm recovery.',
    steps: [
      'Swim freestyle, dragging your fingertips along the surface as your arm comes forward.',
      'Keep your elbow high and your hand relaxed, close to your body.',
    ],
    cues: ['Elbow leads, hand follows', 'Rotate your body so the arm can clear the water'],
  },
  {
    id: 'fist-drill', name: 'Fist drill', purpose: 'Makes you feel your forearm pulling water, not just your hand.',
    steps: [
      'Swim freestyle with your hands in loose fists.',
      'Focus on bending the elbow early and using your whole forearm like a paddle.',
      'Open your hands after a length and notice the extra grip on the water.',
    ],
    cues: ['Early bend of the elbow', 'Push water back, not down'],
  },
  {
    id: 'single-arm', name: 'Single-arm freestyle', purpose: 'Isolates rotation and timing on each side.',
    steps: [
      'Swim with one arm only, the other stretched in front (easier) or by your side (harder).',
      'Breathe to the side of the working arm.',
      'Switch arms every length.',
    ],
    cues: ['Rotate your hips and shoulders together', 'Keep kicking steady'],
  },
  {
    id: 'bilateral', name: 'Bilateral breathing (every 3 strokes)', purpose: 'Balances your stroke and builds breath control.',
    steps: [
      'Swim freestyle and breathe every third arm stroke, so you alternate sides.',
      'If it is too hard at first, breathe 2-2-3: two breaths to one side, then a 3-stroke switch.',
    ],
    cues: ['Exhale steadily the whole time your face is in', 'Turn, do not lift'],
  },
  {
    id: 'back-kick', name: 'Backstroke kick', purpose: 'Easy breathing, great for recovery and body position.',
    steps: [
      'Float on your back with ears in the water, looking straight up.',
      'Arms by your sides (or one hand on your belly).',
      'Flutter kick from the hips, keeping your knees under the surface.',
    ],
    cues: ['Hips up, chin neutral', 'Toes make small splashes at the surface'],
  },
  {
    id: 'pull-buoy', name: 'Pull with buoy', purpose: 'Rests your legs and focuses on your arm stroke.',
    steps: [
      'Squeeze a pull buoy between your thighs.',
      'Swim freestyle with arms only; let your legs trail without kicking.',
    ],
    cues: ['Rotate side to side', 'Long strokes, finish past your hip'],
  },
  {
    id: 'scull', name: 'Front scull', purpose: 'Builds a feel for the water with your hands and forearms.',
    steps: [
      'Lie face down with arms in front, a pull buoy between your legs.',
      'Sweep your hands outward and inward in small figure-8s, like spreading butter, to move forward.',
    ],
    cues: ['Hands just below the surface', 'Small, quick sweeps'],
  },
  {
    id: 'breast-kick', name: 'Breaststroke kick with board', purpose: 'Learn the whip kick for an easy, restful stroke.',
    steps: [
      'Hold a kickboard with straight arms.',
      'Bring your heels up toward your bottom, turn your feet out, then sweep them around and together.',
      'Glide with legs together for a moment before the next kick.',
    ],
    cues: ['Feet turned out like a duck', 'Kick, then glide'],
  },
];

// The swim strokes themselves, shown in Library → Swim and when you tap a set.
export const STROKE_GUIDES = [
  {
    id: 'stroke-free', name: 'Freestyle (front crawl)', kind: 'stroke',
    purpose: 'The fastest, most efficient stroke and the one most lap swimmers use.',
    steps: [
      'Float face down, looking at the bottom of the pool, body long and close to the surface.',
      'Reach one arm forward, hand entering the water in line with your shoulder.',
      'Bend your elbow and push the water back toward your feet, finishing past your hip.',
      'Lift that arm out with a relaxed, bent elbow and swing it forward. Alternate arms.',
      'Kick steadily from the hips with mostly straight legs and pointed toes.',
      'Breathe by rolling your head to the side as an arm pulls back. Exhale underwater between breaths.',
    ],
    cues: ['Eyes down, hips up', 'Breathe out underwater, in when you turn', 'Long, relaxed strokes beat fast ones'],
  },
  {
    id: 'stroke-free-breathing', name: 'Freestyle breathing', kind: 'stroke',
    purpose: 'The skill that makes freestyle feel easy instead of exhausting.',
    steps: [
      'With your face in the water, breathe out steadily through your nose and mouth (bubbles).',
      'As one arm pulls back, roll your head with your body until your mouth clears the water. Keep one goggle in the water.',
      'Take a quick breath in through your mouth.',
      'Roll your face back down as that arm comes forward, and start exhaling again.',
      'Start by breathing every 2 strokes. Later, try every 3 strokes to alternate sides.',
    ],
    cues: ['Turn, don\'t lift your head', 'Never hold your breath underwater', 'Practice with bobs and side kick'],
  },
  {
    id: 'stroke-breast', name: 'Breaststroke', kind: 'stroke',
    purpose: 'A calm stroke where your head comes up every stroke. Great for easy laps and catching your breath.',
    steps: [
      'Start in a glide: arms straight in front, legs straight behind, face in the water.',
      'Pull: sweep your hands out and back in a heart shape, then bring them together under your chin. Lift your head to breathe.',
      'Kick: bring your heels toward your bottom, turn your feet out, and whip them around and together.',
      'Shoot your arms forward and put your face back in the water.',
      'Glide for a moment before the next stroke. The rhythm is: pull, breathe, kick, glide.',
    ],
    cues: ['Pull, breathe, kick, glide', 'Feet turned out on the kick', 'Don\'t rush: the glide is free speed'],
  },
  {
    id: 'stroke-back', name: 'Backstroke', kind: 'stroke',
    purpose: 'Your face stays out of the water, so breathing is easy. A good change of pace and recovery stroke.',
    steps: [
      'Float on your back, ears in the water, looking straight up. Hips near the surface.',
      'Flutter kick steadily from the hips, knees staying under the water.',
      'Lift one straight arm up out of the water, over your shoulder, and enter little finger first behind your head.',
      'Pull that arm down through the water to your hip while the other arm comes over. Alternate.',
      'Use the backstroke flags (5 m / 5 yd from the wall) to count strokes so you do not hit your head.',
    ],
    cues: ['Chin neutral, not tucked', 'Hips up', 'Count strokes from the flags to the wall'],
  },
];

const DRILL_MAP = new Map([...DRILLS, ...STROKE_GUIDES].map((d) => [d.id, d]));
/** A drill or a stroke guide by id. */
export function getDrill(id) { return DRILL_MAP.get(id) || null; }

/** The guide to show when someone taps a swim set: its drill, or its stroke. */
export function guideForItem(item) {
  if (item?.drill && DRILL_MAP.has(item.drill)) return item.drill;
  return { Free: 'stroke-free', Breast: 'stroke-breast', Back: 'stroke-back', Kick: 'kickboard', Pull: 'pull-buoy', Choice: 'stroke-free' }[item?.stroke] || null;
}

// ---------------- workouts ----------------
// key: `${level}-p${phase}-${kind}` with kind 'tech' | 'endure'

const W = (name, focus, blocks) => ({ name, focus, blocks });
const B = (name, items) => ({ name, items });

export const SWIM_WORKOUTS = {
  // ======== Learner: shallow end, building water confidence ========
  'learner-p1-tech': W('Water Confidence', 'Shallow end only. Relaxed breathing and floating. Swim where a lifeguard is on duty.', [
    B('Warm-up', [
      { reps: 2, stroke: 'Skill', label: 'Walk across the shallow end and back', rest: 30 },
    ]),
    B('Skills', [
      { reps: 3, stroke: 'Skill', drill: 'bobs', label: '10 bobs', rest: 30 },
      { reps: 5, stroke: 'Skill', drill: 'front-float', label: 'Front float, 5–10 s, then stand', rest: 30 },
      { reps: 4, secs: 20, stroke: 'Kick', drill: 'wall-kick', rest: 30 },
      { reps: 6, stroke: 'Skill', drill: 'streamline-glide', label: 'Push off and glide, then stand', rest: 30 },
    ]),
    B('Cool-down', [
      { reps: 2, stroke: 'Skill', drill: 'back-kick', label: 'Back float with a noodle or board, 15 s', rest: 30 },
    ]),
  ]),
  'learner-p1-endure': W('Kick & Glide', 'Shallow end. Build comfort moving through the water.', [
    B('Warm-up', [
      { reps: 2, stroke: 'Skill', drill: 'bobs', label: '10 bobs', rest: 30 },
    ]),
    B('Main set', [
      { reps: 6, stroke: 'Kick', drill: 'kickboard', label: 'Kickboard across the width', rest: 40 },
      { reps: 6, stroke: 'Skill', drill: 'streamline-glide', label: 'Glide + 5 kicks, then stand', rest: 30 },
      { reps: 4, secs: 30, stroke: 'Kick', drill: 'wall-kick', label: 'Wall kick with side breathing', rest: 30 },
    ]),
    B('Cool-down', [
      { reps: 2, stroke: 'Skill', drill: 'front-float', label: 'Easy float, 10 s', rest: 30 },
    ]),
  ]),
  'learner-p2-tech': W('First Strokes', 'Add arms. Stand up whenever you need; that is part of the plan.', [
    B('Warm-up', [
      { reps: 2, stroke: 'Skill', drill: 'bobs', label: '10 bobs', rest: 20 },
      { reps: 4, stroke: 'Skill', drill: 'streamline-glide', rest: 20 },
    ]),
    B('Skills', [
      { reps: 4, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 45, note: 'Stand up midway if you need to.' },
      { reps: 6, stroke: 'Skill', label: 'Glide + 3 arm strokes, then stand', rest: 30 },
      { reps: 4, stroke: 'Skill', drill: 'back-kick', label: 'Back kick across the width', rest: 30 },
    ]),
    B('Cool-down', [
      { reps: 2, stroke: 'Skill', drill: 'front-float', rest: 30 },
    ]),
  ]),
  'learner-p2-endure': W('Breathing Lengths', 'Linking breathing to movement. Shallow end or with a lane rope to hold.', [
    B('Warm-up', [
      { reps: 4, stroke: 'Skill', drill: 'streamline-glide', rest: 20 },
    ]),
    B('Main set', [
      { reps: 6, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 40, note: 'Face in, blow bubbles, lift chin to breathe.' },
      { reps: 4, secs: 30, stroke: 'Kick', drill: 'wall-kick', label: 'Wall kick, turn head to breathe', rest: 30 },
      { reps: 4, stroke: 'Skill', label: 'Glide + 6 arm strokes, then stand', rest: 30 },
    ]),
    B('Cool-down', [
      { reps: 2, stroke: 'Skill', drill: 'back-kick', rest: 30 },
    ]),
  ]),
  'learner-p3-tech': W('Freestyle Lengths', 'Your first full lengths. Stopping to stand is fine.', [
    B('Warm-up', [
      { reps: 4, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 30 },
    ]),
    B('Drills', [
      { reps: 4, dist: 25, stroke: 'Drill', drill: 'side-kick', rest: 40 },
    ]),
    B('Main set', [
      { reps: 4, dist: 25, stroke: 'Free', rest: 60, note: 'Swim as far as you can, stand, then continue.' },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 25, stroke: 'Back', drill: 'back-kick', rest: 30 },
    ]),
  ]),
  'learner-p3-endure': W('Linking Lengths', 'Build toward one full length without stopping.', [
    B('Warm-up', [
      { reps: 2, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 30 },
    ]),
    B('Main set', [
      { reps: 6, dist: 25, stroke: 'Free', rest: 60, note: 'Count your stops. Try to make it one fewer than last time.' },
      { reps: 4, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 40 },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 25, stroke: 'Back', drill: 'back-kick', rest: 30 },
    ]),
  ]),

  // ======== Novice: 1–2 lengths then rest ========
  'novice-p1-tech': W('Technique 1', 'Exhale underwater, turn to breathe. Easy pace, long rests.', [
    B('Warm-up', [
      { reps: 4, dist: 25, stroke: 'Choice', rest: 30, note: 'Easy. Any stroke.' },
    ]),
    B('Kick', [
      { reps: 4, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 30 },
    ]),
    B('Drills', [
      { reps: 4, dist: 25, stroke: 'Drill', drill: 'side-kick', rest: 30 },
    ]),
    B('Main set', [
      { reps: 6, dist: 25, stroke: 'Free', rest: 30, note: 'Blow bubbles the whole time your face is in.' },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 25, stroke: 'Back', rest: 30, note: 'Easy backstroke or breaststroke.' },
    ]),
  ]),
  'novice-p1-endure': W('Endurance 1', 'Short swims, short rests. Same easy pace on every rep.', [
    B('Warm-up', [
      { reps: 4, dist: 25, stroke: 'Choice', rest: 30 },
    ]),
    B('Main set', [
      { reps: 8, dist: 25, stroke: 'Free', rest: 20, note: 'Steady. Make the last one feel like the first.' },
      { reps: 4, dist: 50, stroke: 'Choice', rest: 45, note: 'Freestyle down, backstroke back is fine.' },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 25, stroke: 'Choice', rest: 20 },
    ]),
  ]),
  'novice-p2-tech': W('Technique 2', 'Rotation and breathing to both sides.', [
    B('Warm-up', [
      { reps: 4, dist: 50, stroke: 'Choice', rest: 30, note: 'Alternate freestyle and backstroke.' },
    ]),
    B('Kick', [
      { reps: 4, dist: 25, stroke: 'Kick', drill: 'kickboard', rest: 20 },
    ]),
    B('Drills', [
      { reps: 6, dist: 25, stroke: 'Drill', drill: 'catch-up', rest: 20 },
    ]),
    B('Main set', [
      { reps: 6, dist: 50, stroke: 'Free', drill: 'bilateral', rest: 30, note: 'Breathe every 3 strokes if you can.' },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 25, stroke: 'Choice', rest: 20 },
    ]),
  ]),
  'novice-p2-endure': W('Endurance 2', 'Your first 100s. Pick a pace you can hold for all four.', [
    B('Warm-up', [
      { reps: 4, dist: 50, stroke: 'Choice', rest: 20 },
    ]),
    B('Main set', [
      { reps: 4, dist: 100, stroke: 'Free', rest: 45, note: 'If you must stop, rest at the wall and continue.' },
      { reps: 4, dist: 25, stroke: 'Free', rest: 40, note: 'Faster, but smooth.' },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 50, stroke: 'Choice', rest: 20 },
    ]),
  ]),
  'novice-p3-tech': W('Technique 3', 'High elbow recovery and a strong kick.', [
    B('Warm-up', [
      { reps: 2, dist: 100, stroke: 'Choice', rest: 30 },
    ]),
    B('Drills', [
      { reps: 8, dist: 25, stroke: 'Drill', drill: 'fingertip-drag', rest: 20, note: 'Odd reps drill, even reps swim.' },
    ]),
    B('Kick', [
      { reps: 4, dist: 50, stroke: 'Kick', drill: 'kickboard', rest: 30 },
    ]),
    B('Main set', [
      { reps: 4, dist: 75, stroke: 'Free', drill: 'bilateral', rest: 30 },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 100, stroke: 'Choice', rest: 0 },
    ]),
  ]),
  'novice-p3-endure': W('Endurance 3', 'The 200 challenge. Week 12: try 400 without stopping.', [
    B('Warm-up', [
      { reps: 2, dist: 100, stroke: 'Choice', rest: 30 },
    ]),
    B('Main set', [
      { reps: 3, dist: 200, stroke: 'Free', rest: 60, note: 'Goal: the full 200 without stopping.' },
      { reps: 6, dist: 25, stroke: 'Free', rest: 30, note: 'Fast!' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 100, stroke: 'Choice', rest: 0 },
    ]),
  ]),

  // ======== Comfortable: 200+ continuous ========
  'comfortable-p1-tech': W('Technique 1', 'Smooth, long strokes. Rotation and breathing.', [
    B('Warm-up', [
      { reps: 3, dist: 100, stroke: 'Choice', rest: 20, note: 'Swim / kick / swim.' },
    ]),
    B('Drills', [
      { reps: 8, dist: 25, stroke: 'Drill', drill: 'catch-up', rest: 15 },
    ]),
    B('Main set', [
      { reps: 8, dist: 50, stroke: 'Free', drill: 'bilateral', rest: 20 },
    ]),
    B('Cool-down', [
      { reps: 2, dist: 100, stroke: 'Choice', rest: 15 },
    ]),
  ]),
  'comfortable-p1-endure': W('Endurance 1', 'Steady aerobic 200s. Hold an even pace.', [
    B('Warm-up', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 30 },
    ]),
    B('Main set', [
      { reps: 4, dist: 200, stroke: 'Free', rest: 30, note: 'Note your time for each. Keep them within 10 s of each other.' },
      { reps: 4, dist: 25, stroke: 'Free', rest: 30, note: 'Fast.' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 0 },
    ]),
  ]),
  'comfortable-p2-tech': W('Technique 2', 'Drill-swim pairs to lock in a better catch.', [
    B('Warm-up', [
      { reps: 3, dist: 100, stroke: 'Choice', rest: 20 },
    ]),
    B('Drills', [
      { reps: 8, dist: 50, stroke: 'Drill', drill: 'fist-drill', rest: 20, note: '25 drill, 25 swim.' },
    ]),
    B('Kick', [
      { reps: 4, dist: 50, stroke: 'Kick', drill: 'kickboard', rest: 20 },
    ]),
    B('Main set', [
      { reps: 6, dist: 75, stroke: 'Free', rest: 20, note: 'Build: start easy, finish fast.' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 0 },
    ]),
  ]),
  'comfortable-p2-endure': W('Endurance 2', 'Longer repeats with a negative split (second half faster).', [
    B('Warm-up', [
      { reps: 3, dist: 100, stroke: 'Choice', rest: 20 },
    ]),
    B('Main set', [
      { reps: 3, dist: 300, stroke: 'Free', rest: 45, note: 'Negative split: second half a little faster.' },
      { reps: 4, dist: 50, stroke: 'Free', rest: 30, note: 'Fast.' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 0 },
    ]),
  ]),
  'comfortable-p3-tech': W('Technique 3', 'Descending 50s and stroke variety.', [
    B('Warm-up', [
      { reps: 4, dist: 100, stroke: 'Choice', rest: 20, note: 'Swim, kick, pull, swim.' },
    ]),
    B('Drills', [
      { reps: 8, dist: 50, stroke: 'Drill', drill: 'single-arm', rest: 15 },
    ]),
    B('Main set', [
      { reps: 10, dist: 50, stroke: 'Free', rest: 15, note: 'Descend 1–5 and 6–10: each one a bit faster.' },
      { reps: 4, dist: 25, stroke: 'Back', rest: 20, note: 'Backstroke or breaststroke.' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 0 },
    ]),
  ]),
  'comfortable-p3-endure': W('Endurance 3', 'The long one: 800 continuous.', [
    B('Warm-up', [
      { reps: 3, dist: 100, stroke: 'Choice', rest: 20 },
    ]),
    B('Main set', [
      { reps: 1, dist: 800, stroke: 'Free', rest: 60, note: 'Steady. Split into 2 × 400 if needed.' },
      { reps: 4, dist: 100, stroke: 'Free', rest: 20, note: 'Hold your 800 pace.' },
      { reps: 4, dist: 50, stroke: 'Free', rest: 30, note: 'Fast.' },
    ]),
    B('Cool-down', [
      { reps: 1, dist: 200, stroke: 'Choice', rest: 0 },
    ]),
  ]),
};

export const SWIM_WARMUP_DRY = [
  'Arm circles forward and back, 10 each',
  'Shoulder hugs and chest openers, 10',
  'Leg swings, 10 each side',
];

/** The two swim sessions of a phase, technique first. */
export function swimTemplateKeys(level, phaseId) {
  return [`${level}-p${phaseId}-tech`, `${level}-p${phaseId}-endure`];
}

/**
 * mode 'simple' strips drills: every set becomes plain freestyle, breaststroke
 * or kickboard kicking. Learn-to-swim skills (floating, bobs) stay as they are.
 */
export function getSwimWorkout(key, mode = 'full') {
  const w = SWIM_WORKOUTS[key];
  if (!w) return null;
  const workout = { id: `swim:${key}`, key, ...w };
  return mode === 'simple' ? simplifyWorkout(workout) : workout;
}

export function simplifyItem(it) {
  if (it.stroke === 'Skill') return { ...it };
  if (it.stroke === 'Drill' || it.stroke === 'Pull') {
    return { reps: it.reps, dist: it.dist, secs: it.secs, rest: it.rest, stroke: 'Free', note: 'Easy freestyle. Long, relaxed strokes.' };
  }
  if (it.stroke === 'Back' || it.stroke === 'Choice') {
    return { reps: it.reps, dist: it.dist, secs: it.secs, rest: it.rest, stroke: 'Breast', note: 'Easy breaststroke (or freestyle if you prefer).' };
  }
  if (it.stroke === 'Kick') {
    const { label, ...rest } = it;
    return { ...rest, drill: it.dist ? 'kickboard' : it.drill, label: it.dist ? undefined : label };
  }
  const { drill, ...rest } = it; // plain freestyle/breaststroke: drop drill references
  return rest;
}

export function simplifyWorkout(workout) {
  const isLearner = workout.key?.startsWith('learner');
  const blocks = (workout.blocks || []).map((b) => ({
    name: b.name === 'Drills' ? 'Easy swim' : b.name,
    items: b.items.map(simplifyItem),
  }));
  return {
    ...workout,
    name: isLearner ? workout.name : workout.name.replace('Technique', 'Easy Swim'),
    blocks,
    simple: true,
    focus: isLearner ? workout.focus : 'Simple mode: just freestyle, breaststroke and kickboard. Swim smoothly and breathe out underwater.',
  };
}

/**
 * Adapt a 25-unit plan to the user's pool. In a 50 m pool, 25s become 50s
 * with half the reps so the total distance stays about the same.
 */
export function expandForPool(blocks, poolLen) {
  return blocks.map((b) => ({
    name: b.name,
    items: b.items.map((it) => {
      if (!it.dist || poolLen <= 25 || it.dist % poolLen === 0) return { ...it };
      const reps = Math.max(1, Math.ceil((it.reps * it.dist) / poolLen / Math.ceil(it.dist / poolLen)));
      const dist = Math.ceil(it.dist / poolLen) * poolLen;
      return { ...it, reps, dist };
    }),
  }));
}

export function itemDistance(item) {
  return (item.dist || 0) * (item.reps || 0);
}

export function workoutDistance(blocks) {
  return blocks.reduce((sum, b) => sum + b.items.reduce((s2, it) => s2 + itemDistance(it), 0), 0);
}

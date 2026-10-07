// Animated swim demos: a side-view swimmer for every stroke and drill, drawn
// in SVG so it stays sharp, follows the light and dark themes and costs
// nothing to download. Each demo is a loop of keyframed joint angles, with a
// caption naming the part of the stroke on screen. With reduced motion it
// holds one key pose instead.

import { s } from './util.js';
import { reducedMotion } from './motion.js';

const SURFACE = 54; // water line, in a 300 × 150 picture
const FLOOR = 140;
const RAD = Math.PI / 180;
const L = { torso: 70, neck: 19, head: 11.5, upper: 29, fore: 31, thigh: 38, shin: 35, foot: 10 };
const dir = (deg) => [Math.cos(deg * RAD), Math.sin(deg * RAD)];
const add = (p, deg, len) => { const [dx, dy] = dir(deg); return [p[0] + dx * len, p[1] + dy * len]; };

// ---------------- keyframes ----------------

/**
 * A looping keyframe track. keys: [[t, value], ...] for t from 0 to 1, where
 * the last key repeats the first one cycle later (an angle may gain 360).
 * Values follow a smooth Catmull-Rom curve through the keys. t can run past 1.
 */
export function track(keys) {
  const n = keys.length - 1;
  const lap = keys[n][1] - keys[0][1];
  const val = (i) => keys[((i % n) + n) % n][1] + Math.floor(i / n) * lap;
  return (time) => {
    const cycle = Math.floor(time);
    const f = time - cycle;
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= f) i++;
    const u = (f - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    const [p0, p1, p2, p3] = [val(i - 1), val(i), val(i + 1), val(i + 2)];
    const v = 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
    return v + cycle * lap;
  };
}

/** Pose to pose: eases from key to key and holds on repeated values (no curve overshoot). */
function poses(keys) {
  return (time) => {
    const f = time - Math.floor(time);
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] <= f) i++;
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    return v0 + (v1 - v0) * ease((f - t0) / (t1 - t0));
  };
}

/**
 * Two-joint reach: the angles for a limb of lengths a and b from `from` so its
 * end lands on `to`, bending the middle joint toward `bend` (+1 or -1).
 */
function reach(from, to, a, b, bend = 1) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx) / RAD;
  const inner = Math.acos((a * a + d * d - b * b) / (2 * a * d)) / RAD;
  const first = base - bend * inner;
  const mid = add(from, first, a);
  return [first, Math.atan2(to[1] - mid[1], to[0] - mid[0]) / RAD];
}

const frac = (t) => t - Math.floor(t);
/** 0 → 1 → 0 over [a, b] of the cycle, smoothly. */
const bump = (t, a, b) => { const f = frac(t); return f <= a || f >= b ? 0 : Math.sin(Math.PI * (f - a) / (b - a)); };
const inside = (t, a, b) => { const f = frac(t); return f >= a && f < b; };
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;

// Freestyle arm, from the hand entering the water: catch, pull, push,
// then a high-elbow recovery. World angles: 0 points forward (the way the
// swimmer goes), 90 down, 180 back, 270 up.
const FREE_A = track([[0, 4], [0.14, 10], [0.28, 38], [0.42, 88], [0.56, 148], [0.64, 184], [0.76, 232], [0.88, 300], [1, 364]]);
const FREE_F = track([[0, 6], [0.14, 14], [0.28, 82], [0.42, 106], [0.56, 160], [0.64, 196], [0.75, 122], [0.87, 66], [1, 6]]);
// Over the water the arm swings out to the side, so from the side it looks shorter.
const freeArm = (t) => ({ a: FREE_A(t), f: FREE_F(t), len: 1 - 0.35 * bump(t, 0.6, 1) });

// Backstroke arm: straight-arm recovery over the face, bent-elbow pull along the side.
const BACK_A = track([[0, 2], [0.15, 30], [0.3, 80], [0.45, 150], [0.55, 182], [0.7, 232], [0.85, 300], [1, 362]]);
const BACK_F = track([[0, 4], [0.15, 40], [0.3, 150], [0.45, 175], [0.55, 182], [0.7, 232], [0.85, 300], [1, 364]]);

// Breaststroke, from the glide: pull, breathe, kick, glide.
const BR_A = track([[0, 2], [0.25, 4], [0.38, 48], [0.5, 100], [0.62, 6], [1, 2]]);
const BR_F = track([[0, 2], [0.25, 6], [0.38, 96], [0.5, -24], [0.62, 0], [1, 2]]);
const BR_T = track([[0, 180], [0.5, 180], [0.62, 142], [0.7, 150], [0.8, 180], [1, 180]]);
const BR_S = track([[0, 180], [0.5, 182], [0.62, 290], [0.7, 260], [0.8, 180], [1, 180]]);

/** Flutter kick: small kicks from the hip, knees soft, toes pointed. */
function flutter(t, kicks, size = 1, supine = false) {
  return [0, Math.PI].map((phase) => {
    const p = 2 * Math.PI * kicks * t + phase;
    const thigh = 180 + 7 * size * Math.sin(p);
    const bend = (9 + 9 * Math.sin(p + 1.3)) * size;
    return { t: thigh, s: thigh + (supine ? -bend : bend) };
  });
}

const STILL_LEGS = [{ t: 181, s: 181 }, { t: 183, s: 183 }];

// ---------------- the demos ----------------
// Each returns a pose for time t (in cycles): hip, torso angle, arms [near,
// far], legs [near, far], breathe (0–1, head turned or lifted to breathe),
// bubbles, caption and extras. speed is how fast the water slides past.

function freestyle(t, { arms = [freeArm(t), freeArm(t + 0.5)], breathAt = [0.5, 0.78], captions = true } = {}) {
  const breathe = bump(t, ...breathAt);
  return {
    hip: [104, SURFACE + 9 + Math.sin(4 * Math.PI * t)], torso: -2, arms, legs: flutter(t, 3),
    breathe, bubbles: breathe < 0.05, speed: 46,
    caption: captions ? (breathe > 0.05 ? 'Turn to breathe' : 'Breathe out') : '',
  };
}

const DEMOS = {
  'stroke-free': { period: 2.4, still: 0.3, pose: (t) => ({ ...freestyle(t), caption: '' }) },
  'stroke-free-breathing': { period: 2.8, still: 0.62, pose: (t) => freestyle(t) },
  'bilateral': {
    period: 7.2, still: 0.53,
    pose: (t) => {
      // Three strokes and breathe to the right; three more and breathe to the left.
      const l3 = frac(t) * 3;
      const right = Math.floor(l3) === 1 ? bump(l3, 0.45, 0.75) : 0; // the near side is the swimmer's right
      const farPhase = (l3 + 0.5) % 3;
      const left = Math.floor(farPhase) === 0 ? bump(farPhase, 0.45, 0.75) : 0;
      const since = l3 >= 0.1 && l3 < 1.6 ? l3 - 0.1 : (l3 + 3 - 1.6) % 3;
      const n = since < 0.4 ? 0 : since < 0.9 ? 1 : since < 1.4 ? 2 : 3;
      return {
        ...freestyle(l3, { breathAt: [2, 2] }), breathe: Math.max(right, left * 0.6), turnAway: left > 0.05, bubbles: right + left < 0.05,
        caption: right > 0.05 ? 'Breathe to the right' : left > 0.05 ? 'Breathe to the left' : n ? `Stroke ${n}` : 'Breathe out',
      };
    },
  },
  'stroke-breast': {
    period: 2.6, still: 0.47,
    pose: (t) => {
      const breathe = bump(t, 0.32, 0.62);
      const leg = { t: BR_T(t), s: BR_S(t) };
      const f = frac(t);
      return {
        hip: [100, SURFACE + 10 + 3 * breathe], torso: -2 - 12 * breathe, arms: [{ a: BR_A(t), f: BR_F(t) }, { a: BR_A(t) + 2, f: BR_F(t) + 2 }],
        legs: [leg, { t: leg.t + 2, s: leg.s + 2 }], breathe, bubbles: f < 0.3 || f > 0.85, speed: 30 + 40 * bump(t, 0.68, 1),
        caption: f < 0.25 || f >= 0.82 ? 'Glide' : f < 0.4 ? 'Pull' : f < 0.6 ? 'Breathe' : 'Kick',
      };
    },
  },
  'stroke-back': {
    period: 2.6, still: 0.62,
    pose: (t) => ({
      hip: [100, SURFACE + 10], torso: 0, supine: true,
      arms: [{ a: BACK_A(t), f: BACK_F(t) }, { a: BACK_A(t + 0.5), f: BACK_F(t + 0.5) }],
      legs: flutter(t, 3, 1, true), speed: 44, caption: 'Face up, ears in the water',
    }),
  },
  'back-kick': {
    period: 1.6, still: 0.2,
    pose: (t) => ({
      hip: [116, SURFACE + 10], torso: 0, supine: true, arms: [{ a: 178, f: 180 }, { a: 176, f: 178 }],
      legs: flutter(t, 3, 1.2, true), speed: 26, caption: 'Hips up, small kicks',
    }),
  },
  'kickboard': {
    period: 2.2, still: 0.3,
    pose: (t) => {
      const breathe = bump(t, 0.68, 0.94);
      return {
        hip: [86, SURFACE + 9 + 2 * breathe], torso: -4 - 5 * breathe, arms: [{ a: -6, f: -3 }, { a: -5, f: -2 }],
        legs: flutter(t, 4, 1.25), breathe, bubbles: breathe < 0.05, board: true, speed: 30,
        caption: breathe > 0.05 ? 'Chin forward to breathe' : 'Kick from the hips',
      };
    },
  },
  'wall-kick': {
    period: 2.2, still: 0.3,
    pose: (t) => {
      const breathe = bump(t, 0.66, 0.92);
      return {
        hip: [154, SURFACE + 9], torso: -4, arms: [{ a: -4, f: -2 }, { a: -3, f: -1 }], legs: flutter(t, 4, 1.2),
        breathe, bubbles: breathe < 0.05, wall: 'right', speed: 0,
        caption: breathe > 0.05 ? 'Turn your head to breathe' : 'Blow bubbles, kick',
      };
    },
  },
  'side-kick': {
    period: 2.6, still: 0.3,
    pose: (t) => {
      const breathe = bump(t, 0.6, 0.85);
      return {
        hip: [104, SURFACE + 10], torso: -1, arms: [{ a: 176, f: 178 }, { a: 4, f: 4 }], legs: flutter(t, 4),
        breathe, bubbles: breathe < 0.05, speed: 30,
        caption: breathe > 0.05 ? 'Rotate your head to breathe' : 'On your side, bottom arm long',
      };
    },
  },
  'catch-up': {
    period: 3.2, still: 0.15,
    pose: (t) => {
      // Each arm strokes in turn while the other waits out in front.
      const f = frac(t);
      const near = f < 0.5 ? freeArm(f * 2) : freeArm(0);
      const far = f >= 0.5 ? freeArm((f - 0.5) * 2) : freeArm(0);
      return {
        ...freestyle(t, { arms: [near, { ...far, a: far.a + 1 }], breathAt: [0.22, 0.4] }),
        caption: inside(t, 0.42, 0.5) || inside(t, 0.92, 1) ? 'Hands touch, then switch' : 'One arm waits in front',
      };
    },
  },
  'single-arm': {
    period: 2.4, still: 0.35,
    pose: (t) => ({ ...freestyle(t, { arms: [freeArm(t), { a: 4, f: 4 }] }), caption: 'One arm pulls, the other stays in front' }),
  },
  'fingertip-drag': {
    period: 2.6, still: 0.8,
    pose: (t) => {
      const base = freestyle(t, { captions: false });
      return { ...base, drag: true, caption: inside(t, 0.66, 0.98) || inside(t, 0.16, 0.48) ? 'Fingertips drag along the water' : 'Elbow high' };
    },
  },
  'fist-drill': {
    period: 2.4, still: 0.42,
    pose: (t) => ({ ...freestyle(t, { captions: false }), fist: true, caption: 'Loose fists: pull with your forearm' }),
  },
  'pull-buoy': {
    period: 2.4, still: 0.42,
    pose: (t) => ({ ...freestyle(t, { captions: false }), legs: STILL_LEGS, buoy: true, caption: 'Arms only, legs rest on the buoy' }),
  },
  'scull': {
    period: 1.1, still: 0.25,
    pose: (t) => {
      const p = 2 * Math.PI * t;
      return {
        hip: [104, SURFACE + 9], torso: -2,
        arms: [{ a: 16 + 4 * Math.sin(p), f: 34 + 22 * Math.sin(p) }, { a: 18 + 4 * Math.sin(p + Math.PI), f: 36 + 22 * Math.sin(p + Math.PI) }],
        legs: STILL_LEGS, buoy: true, bubbles: true, speed: 14, caption: 'Small figure-8 sweeps',
      };
    },
  },
  'breast-kick': {
    period: 2.2, still: 0.62,
    pose: (t) => {
      const leg = { t: BR_T(t), s: BR_S(t) };
      const f = frac(t);
      return {
        hip: [92, SURFACE + 10], torso: -6, arms: [{ a: -6, f: -3 }, { a: -5, f: -2 }],
        legs: [leg, { t: leg.t + 2, s: leg.s + 2 }], board: true, breathe: 0.6, speed: 18 + 34 * bump(t, 0.68, 1),
        caption: f < 0.5 || f >= 0.82 ? 'Glide' : f < 0.66 ? 'Heels up, feet out' : 'Kick around and together',
      };
    },
  },
  'streamline-glide': {
    period: 3.4, still: 0.5,
    pose: (t) => {
      const f = frac(t);
      const push = ease((f - 0.12) / 0.16); // legs extend off the wall
      const glide = 1 - (1 - Math.min(1, Math.max(0, (f - 0.2) / 0.75))) ** 2.2; // fast, then slowing
      const tuck = 1 - push;
      return {
        hip: [70 + 96 * glide, SURFACE + 24 - 5 * glide], torso: -3, arms: [{ a: -6, f: -3 }, { a: -5, f: -2 }],
        legs: [{ t: lerp(148, 182, push), s: lerp(222, 182, push) }, { t: lerp(150, 184, push), s: lerp(224, 184, push) }],
        wall: 'left', bubbles: f > 0.25, speed: 0, alpha: Math.min(1, (1 - f) / 0.06, f / 0.04 + 0.001),
        tuck, caption: f < 0.25 ? 'Push off the wall' : 'Arms squeeze your ears, glide',
      };
    },
  },
  'front-float': {
    period: 5.4, still: 0.25, scale: 0.72,
    pose: (t) => {
      // Float face down, then knees in, press down, lift the head, feet down.
      const k = (keys) => poses(keys)(t);
      const f = frac(t);
      const stand = ease((f - 0.5) / 0.24);
      const hip = [k([[0, 116], [0.46, 116], [0.6, 140], [0.74, 172], [1, 172]]), k([[0, SURFACE + 7], [0.46, SURFACE + 7], [0.6, SURFACE + 18], [0.74, FLOOR - 50], [1, FLOOR - 50]])];
      const torso = k([[0, -2], [0.46, -2], [0.6, -48], [0.74, -86], [1, -86]]);
      const arm = { a: k([[0, -4], [0.48, -4], [0.6, 70], [0.74, 100], [1, 100]]), f: k([[0, -2], [0.48, -2], [0.6, 110], [0.74, 96], [1, 96]]) };
      const legs = stand > 0.6
        ? [0, 1].map((i) => { const [tt, ss] = reach(hip, [hip[0] + 6 - 4 * i, FLOOR - 2], L.thigh * 0.72, L.shin * 0.72, -1); return { t: tt, s: ss }; })
        : [0, 1].map((i) => ({ t: k([[0, 184], [0.46, 184], [0.6, 40], [1, 40]]) + 3 * i, s: k([[0, 186], [0.46, 186], [0.6, 150], [1, 150]]) + 3 * i }));
      return {
        hip, torso, arms: [arm, { a: arm.a + 3, f: arm.f + 3 }], legs, breathe: stand, bubbles: f < 0.45, floor: true, speed: 0,
        alpha: Math.min(1, (1 - f) / 0.05, f / 0.04 + 0.001),
        caption: f < 0.47 ? 'Float: face down, arms forward' : 'Knees in, then stand',
      };
    },
  },
  'bobs': {
    period: 3.2, still: 0.85, scale: 0.72,
    pose: (t) => {
      // Holding the wall: sink until your head is under and blow bubbles, then up for a breath.
      const down = poses([[0, 0], [0.12, 0], [0.3, 1], [0.62, 1], [0.8, 0], [1, 0]])(t);
      const hip = [222, FLOOR - 50 + 30 * down];
      const torso = -90 + 18 * down;
      const shoulder = add(hip, torso, L.torso * 0.72);
      const grip = [270, SURFACE - 3];
      const [ua, fa] = reach(shoulder, grip, L.upper * 0.72, L.fore * 0.72, -1);
      const legs = [0, 1].map((i) => { const [tt, ss] = reach(hip, [hip[0] + 4 - 4 * i, FLOOR - 2], L.thigh * 0.72, L.shin * 0.72, -1); return { t: tt, s: ss }; });
      return {
        hip, torso, arms: [{ a: ua, f: fa }, { a: ua - 4, f: fa - 4 }], legs, breathe: 1 - down, bubbles: down > 0.7,
        floor: true, wall: 'right', wallX: 272, speed: 0,
        caption: down > 0.5 ? 'Under: blow bubbles' : 'Up: quick breath in',
      };
    },
  },
};

/** Which demos exist: every stroke guide and drill. */
export const SWIM_DEMO_IDS = Object.keys(DEMOS);
/** The pose of demo `id` at time t (in cycles), for tests. */
export const swimPose = (id, t) => DEMOS[id]?.pose(t) ?? null;

// ---------------- drawing ----------------

const set = (el, attrs) => { for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, typeof v === 'number' ? v.toFixed(1) : v); };
const line = (el, a, b) => set(el, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] });

/** Build the picture once; draw(pose, time) moves the parts. */
function scene(id) {
  const surfacePath = s('path', { class: 'sa-surface' });
  const lane = s('line', { class: 'sa-lane', x1: 0, x2: 300, y1: FLOOR - 4, y2: FLOOR - 4 });
  const floor = s('rect', { class: 'sa-floor', x: 0, y: FLOOR, width: 300, height: 150 - FLOOR });
  const wall = s('rect', { class: 'sa-wall', y: 22, width: 16, height: 128, rx: 3 });
  const limb = (cls) => s('line', { class: `sa-limb ${cls}` });
  const parts = {
    far: { upper: limb('sa-far sa-arm'), fore: limb('sa-far sa-arm'), fist: s('circle', { class: 'sa-far sa-fist', r: 4.6 }), thigh: limb('sa-far sa-leg'), shin: limb('sa-far sa-leg'), foot: limb('sa-far sa-foot') },
    near: { upper: limb('sa-near sa-arm'), fore: limb('sa-near sa-arm'), fist: s('circle', { class: 'sa-near sa-fist', r: 4.6 }), thigh: limb('sa-near sa-leg'), shin: limb('sa-near sa-leg'), foot: limb('sa-near sa-foot') },
  };
  const torso = limb('sa-near sa-torso');
  const head = s('circle', { class: 'sa-head', r: L.head });
  const cap = s('path', { class: 'sa-cap' });
  const breath = s('path', { class: 'sa-breath' });
  const board = s('rect', { class: 'sa-board', width: 46, height: 9, rx: 4.5 });
  const buoy = s('g', { class: 'sa-buoy' }, s('ellipse', { rx: 7.5, ry: 5.5, cx: -5 }), s('ellipse', { rx: 7.5, ry: 5.5, cx: 6 }));
  const bubbles = Array.from({ length: 6 }, () => s('circle', { class: 'sa-bubble' }));
  const splash = s('path', { class: 'sa-splash' });
  const caption = s('text', { class: 'sa-caption', x: 14, y: 30 });
  const swimmer = s('g', { class: 'sa-swimmer' },
    parts.far.upper, parts.far.fore, parts.far.fist, parts.far.thigh, parts.far.shin, parts.far.foot,
    torso, head, cap, parts.near.thigh, parts.near.shin, parts.near.foot, buoy, parts.near.upper, parts.near.fore, parts.near.fist,
    board, splash, breath);
  const svg = s('svg', { class: 'swim-anim', viewBox: '0 0 300 150', role: 'img', 'aria-label': `Animation: ${id}` },
    s('rect', { class: 'sa-water', x: 0, y: SURFACE, width: 300, height: 150 - SURFACE }),
    floor, lane, wall, swimmer, ...bubbles, surfacePath, caption);

  function draw(p, time, scale = 1) {
    const L2 = scale === 1 ? L : Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v * scale]));
    // Water: ripples and floor marks slide past at the swimmer's speed.
    const shift = (time * (p.speed ?? 30)) % 300;
    let d = '';
    for (let x = -10; x <= 310; x += 10) {
      const y = SURFACE + 1.6 * Math.sin((x + shift) / 13);
      d += `${x === -10 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    surfacePath.setAttribute('d', d);
    lane.setAttribute('stroke-dashoffset', (shift % 24).toFixed(1));
    lane.style.display = p.floor ? 'none' : '';
    floor.style.display = p.floor ? '' : 'none';
    wall.style.display = p.wall ? '' : 'none';
    if (p.wall) wall.setAttribute('x', p.wall === 'left' ? '-4' : String(p.wallX ?? 288));

    const hip = p.hip;
    const shoulder = add(hip, p.torso, L2.torso);
    const headC = add(add(shoulder, p.torso, L2.neck), p.torso + (p.supine ? 90 : -90), (p.supine ? 1 : -1) * 1.5 * (p.breathe || 0) - 1);
    line(torso, hip, shoulder);
    set(head, { cx: headC[0], cy: headC[1], r: L2.head });
    // The cap covers the back of the head; the face looks down (or up on your back).
    const face = p.supine ? p.torso - 80 : p.torso + 80 - 70 * (p.breathe || 0) * (p.turnAway ? 0.3 : 1);
    const c0 = add(headC, face + 70, L2.head + 0.6);
    const c1 = add(headC, face + 250, L2.head + 0.6);
    cap.setAttribute('d', `M${c0[0].toFixed(1)} ${c0[1].toFixed(1)} A${L2.head + 0.6} ${L2.head + 0.6} 0 0 1 ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} Z`);
    const mouth = add(headC, face, L2.head);
    // Breathing in: two small arcs by the mouth.
    if ((p.breathe || 0) > 0.5 && !p.turnAway) {
      const m = add(headC, face - 30, L2.head + 5);
      breath.setAttribute('d', `M${(m[0] - 1).toFixed(1)} ${(m[1] - 5).toFixed(1)} q5 4 0 9 M${(m[0] + 5).toFixed(1)} ${(m[1] - 7).toFixed(1)} q6 6 0 13`);
      breath.style.opacity = String(Math.min(1, ((p.breathe || 0) - 0.5) * 3));
    } else breath.style.opacity = '0';

    ['near', 'far'].forEach((side, i) => {
      const parts2 = parts[side];
      const arm = p.arms[i];
      const elbow = add(shoulder, arm.a, L2.upper * (arm.len ?? 1));
      const foreLen = (p.fist ? L2.fore - 5 : L2.fore) * (arm.len ?? 1);
      let foreAngle = arm.f;
      // Fingertip drag: during the recovery the hand skims the surface.
      if (p.drag && elbow[1] < SURFACE - 2) {
        const down = Math.asin(Math.min(1, (SURFACE - elbow[1]) / foreLen)) / RAD;
        const a = ((arm.a % 360) + 360) % 360;
        foreAngle = a > 270 || a < 90 ? down : 180 - down;
      }
      const hand = add(elbow, foreAngle, foreLen);
      line(parts2.upper, shoulder, elbow);
      line(parts2.fore, elbow, hand);
      parts2.fist.style.display = p.fist ? '' : 'none';
      if (p.fist) set(parts2.fist, { cx: hand[0], cy: hand[1] });
      if (i === 0) {
        const near = p.drag && Math.abs(hand[1] - SURFACE) < 2.5 && elbow[1] < SURFACE;
        splash.style.opacity = near ? '1' : '0';
        if (near) splash.setAttribute('d', `M${(hand[0] - 7).toFixed(1)} ${(SURFACE - 2).toFixed(1)} l-4 -4 M${(hand[0] - 3).toFixed(1)} ${(SURFACE - 3).toFixed(1)} l-1 -6`);
      }
      const leg = p.legs[i];
      const knee = add(hip, leg.t, L2.thigh);
      const ankle = add(knee, leg.s, L2.shin);
      line(parts2.thigh, hip, knee);
      line(parts2.shin, knee, ankle);
      // Pointed toes when swimming; flat feet when standing on the bottom.
      const footAngle = p.floor && Math.abs(leg.s - 90) < 30 ? leg.s - 80 : leg.s + (p.supine ? -14 : 14);
      line(parts2.foot, ankle, add(ankle, footAngle, L2.foot));
    });

    board.style.display = p.board ? '' : 'none';
    if (p.board) {
      const hand = add(add(shoulder, p.arms[0].a, L2.upper), p.arms[0].f, L2.fore);
      set(board, { x: hand[0] - 32, y: SURFACE - 6 });
    }
    buoy.style.display = p.buoy ? '' : 'none';
    if (p.buoy) { const m = add(hip, p.legs[0].t, L2.thigh * 0.45); buoy.setAttribute('transform', `translate(${m[0].toFixed(1)} ${(m[1] - 1).toFixed(1)}) rotate(${(p.torso).toFixed(1)})`); }

    // Bubbles rise from the mouth while breathing out underwater.
    bubbles.forEach((b, k) => {
      const age = frac(time * 1.4 + k / bubbles.length);
      const x = mouth[0] - age * 14 - k;
      const y = mouth[1] + 2 - age * 26;
      const show = p.bubbles && y > SURFACE + 1 && mouth[1] > SURFACE;
      set(b, { cx: x, cy: y, r: 2 + age * 2.4 });
      b.style.opacity = show ? String(0.9 - 0.6 * age) : '0';
    });

    swimmer.style.opacity = String(p.alpha ?? 1);
    caption.textContent = p.caption || '';
  }
  return { svg, draw };
}

/**
 * The animated demo for a stroke or drill, or null when there isn't one.
 * It runs only while on screen (at up to 30 frames a second), pauses when
 * tapped unless it sits inside a button, and holds a still pose with
 * reduced motion.
 */
export function swimDemo(id, { name = '', caption = true, pausable = true } = {}) {
  const demo = DEMOS[id];
  if (!demo) return null;
  const { svg, draw } = scene(id);
  if (name) svg.setAttribute('aria-label', `${name}: animation`);
  if (!caption) svg.classList.add('no-caption');
  draw(demo.pose(demo.still), 0, demo.scale);
  if (reducedMotion()) return svg;
  let raf = 0;
  let last = 0;
  let drawn = 0;
  let elapsed = 0;
  let paused = false;
  const frame = (now) => {
    if (!svg.isConnected && drawn) { raf = 0; io?.disconnect(); return; }
    seen = true;
    if (last && !paused) elapsed += Math.min(100, now - last) / 1000;
    last = now;
    if (now - drawn >= 32) {
      drawn = now;
      draw(demo.pose(demo.still + elapsed / demo.period), elapsed, demo.scale);
    }
    raf = requestAnimationFrame(frame);
  };
  let seen = false;
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    // Once it has been on a page and is gone again, stop watching it.
    if (seen && !svg.isConnected) { io.disconnect(); cancelAnimationFrame(raf); raf = 0; return; }
    seen = seen || svg.isConnected;
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
  }) : null;
  if (io) io.observe(svg);
  else raf = requestAnimationFrame(frame);
  if (pausable) {
    svg.addEventListener('click', () => { paused = !paused; svg.classList.toggle('paused', paused); });
  }
  return svg;
}

/** A small still of the demo for list rows and cards. */
export function swimThumb(id) {
  const demo = DEMOS[id];
  if (!demo) return null;
  const { svg, draw } = scene(id);
  svg.classList.add('thumb');
  svg.setAttribute('viewBox', '24 14 252 126');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('role');
  draw({ ...demo.pose(demo.still), caption: '' }, 0, demo.scale);
  return svg;
}

/** For tests and previews: draw demo `id` at time t (in cycles) into a fresh picture. */
export function swimFrame(id, t) {
  const demo = DEMOS[id];
  const { svg, draw } = scene(id);
  draw(demo.pose(t), t * demo.period, demo.scale);
  return svg;
}

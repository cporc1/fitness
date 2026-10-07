// Demo media for exercises, strokes and drills.
//
// FRAMES: start/finish photos in media/ex/<id>-0.jpg and -1.jpg, shown as a
// looping two-frame animation. Photos come from Free Exercise DB
// (github.com/yuhonas/free-exercise-db), released into the public domain.
// The numbers are the image width and height.
//
// VIDEOS: one YouTube demo per exercise/stroke/drill, checked to exist and
// allow embedding. { id, title, channel, short }

export const PHOTO_CREDIT = 'Photos: Free Exercise DB (public domain)';

export const FRAMES = {
  'leg-press': [480, 320],
  'goblet-squat': [480, 321],
  'back-squat': [480, 320],
  'split-squat': [480, 720],
  'walking-lunge': [480, 320],
  'step-up': [480, 320],
  'db-rdl': [480, 320],
  'bb-rdl': [480, 320],
  'trap-bar-deadlift': [480, 720],
  'deadlift': [480, 320],
  'leg-curl': [480, 320],
  'leg-extension': [480, 320],
  'hip-thrust': [480, 320],
  'glute-bridge': [480, 320],
  'calf-raise': [480, 320],
  'machine-chest-press': [480, 320],
  'db-bench': [480, 320],
  'incline-db-press': [480, 320],
  'bench-press': [480, 320],
  'push-up': [480, 320],
  'pec-deck': [480, 320],
  'lat-pulldown': [480, 320],
  'seated-cable-row': [480, 320],
  'db-row': [480, 320],
  'chest-supported-row': [480, 320],
  'assisted-pullup': [480, 720],
  'face-pull': [480, 320],
  'back-extension': [480, 320],
  'db-shoulder-press': [480, 320],
  'machine-shoulder-press': [480, 320],
  'ohp': [480, 320],
  'lateral-raise': [480, 320],
  'rear-delt-fly': [480, 320],
  'db-curl': [480, 320],
  'hammer-curl': [480, 320],
  'triceps-pushdown': [480, 320],
  'overhead-triceps': [480, 320],
  'plank': [480, 320],
  'side-plank': [480, 320],
  'dead-bug': [480, 270],
  'pallof-press': [480, 270],
  'hanging-knee-raise': [480, 320],
  'cable-crunch': [480, 320],
  'farmers-carry': [480, 320],
  'treadmill': [480, 321],
  'bike': [480, 321],
  'rower': [480, 321],
  'elliptical': [480, 321],
  'stair-climber': [480, 321],
};

export const VIDEOS = {};

export function framesFor(id) {
  const dims = FRAMES[id];
  return dims ? { srcs: [`media/ex/${id}-0.jpg`, `media/ex/${id}-1.jpg`], w: dims[0], h: dims[1] } : null;
}

export function videoFor(id) {
  return VIDEOS[id] || null;
}

// Demo media: an animated start/finish photo pair and a tap-to-play video.

import { h, icon, ICONS, youtubeSearch } from './util.js';
import { framesFor, videoFor, PHOTO_CREDIT } from './data/media.js';

/** Two photos (start and finish) that cross-fade in a loop. Tap to pause. */
export function demoFrames(id, name) {
  const f = framesFor(id);
  if (!f) return null;
  const imgs = f.srcs.map((src, i) => h('img', {
    src, alt: `${name}: ${i === 0 ? 'start' : 'finish'} position`, loading: 'lazy', decoding: 'async',
    class: `f${i}`, width: f.w, height: f.h,
  }));
  const labels = [h('span', { class: 'demo-tag t0' }, 'Start'), h('span', { class: 'demo-tag t1' }, 'Finish')];
  const box = h('button', {
    class: 'demo', type: 'button', style: { aspectRatio: `${f.w} / ${f.h}` },
    'aria-label': `${name} demonstration. Tap to pause or play.`,
    onclick: () => box.classList.toggle('paused'),
  }, ...imgs, ...labels);
  return h('figure', { class: 'demo-figure' },
    box,
    h('figcaption', { class: 'xs muted' }, `Start and finish positions, looping. Tap to pause. ${PHOTO_CREDIT}.`));
}

/**
 * A video thumbnail that becomes an embedded YouTube player when tapped.
 * Falls back to a YouTube search link when there's no curated video.
 */
export function demoVideo(id, searchQuery) {
  const v = videoFor(id);
  if (!v) {
    return h('a', { class: 'btn ghost', href: youtubeSearch(searchQuery), target: '_blank', rel: 'noopener' },
      icon(ICONS.external, 18), 'Find demo videos on YouTube');
  }
  const watchUrl = v.short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
  const frame = h('div', { class: `video${v.short ? ' short' : ''}` });
  const load = () => {
    frame.replaceChildren(h('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      title: v.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    }));
  };
  frame.append(h('button', { class: 'video-poster', type: 'button', onclick: load, 'aria-label': `Play video: ${v.title}` },
    h('img', { src: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, alt: '', loading: 'lazy' }),
    h('span', { class: 'video-play' }, icon(ICONS.play, 30))));
  return h('div', { class: 'stack', style: { gap: '6px' } },
    frame,
    h('div', { class: 'row between small', style: { alignItems: 'flex-start' } },
      h('span', { class: 'muted grow' }, `${v.title} · ${v.channel}`),
      h('a', { href: watchUrl, target: '_blank', rel: 'noopener', class: 'small', style: { whiteSpace: 'nowrap', fontWeight: 600 } }, 'Open in YouTube')));
}

/** Media block for an exercise or swim guide: photos (if any) then video. */
export function demoMedia(id, name, searchQuery) {
  return h('div', { class: 'stack' }, demoFrames(id, name), demoVideo(id, searchQuery));
}

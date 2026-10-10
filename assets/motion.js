/* Shared scroll motion for every page (paired with assets/motion.css).
   1. Lenis smooth wheel scrolling (touch stays native).
   2. Content fades/slides in as it enters the viewport, staggered per batch.
   3. Images inside clipped frames drift slightly with scroll. */
(function () {
  var doc = document.documentElement;

  /* ---------- 0. Every page opens at the very top ----------
     Also after a reload, back/forward, or a link carrying a #hash. Stops as soon as the visitor scrolls. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var touched = false;
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (t) {
    addEventListener(t, function () { touched = true; }, { passive: true, once: true });
  });
  function toTop() {
    if (touched) return;
    if (window.lenis) window.lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }
  toTop();
  addEventListener('DOMContentLoaded', toTop);
  addEventListener('load', function () { toTop(); requestAnimationFrame(toTop); });
  addEventListener('pageshow', function (e) { if (e.persisted) { touched = false; toTop(); } });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  /* ---------- 1. Smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis) {
    document.querySelectorAll('.scrollshot, [data-scroll-inner]').forEach(function (el) { el.setAttribute('data-lenis-prevent', ''); });
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, anchors: { offset: -96 } });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    window.lenis = lenis;
  }

  /* ---------- 2. Reveal on scroll ---------- */
  /* Areas with their own motion (hero orbit, pinned testimonials, tabbed gallery, marquee, nav) are left alone */
  var SKIP = '.topnav, #nav, .orbit, .words, .cabinet, .marquee, .toc, .crumbs, .breadcrumb, [data-m-skip]';
  var PICK = [
    'h1', 'h2', 'h3', 'h4', 'p', 'blockquote', 'figure', 'table', 'pre',
    '.eyebrow', '.kicker', '.btn', '.pill', '.tag', '.chip', '.chips', '.tags',
    '.card', '.pcard', '.folder-item', '.shot', '.scrollshot-wrap', '.scrollshot', '.banner', '.cover-shot', '.browser',
    '.portrait', '.callout-box', '.quote', '.toggle', '.exp li', '.tl li', '.timeline li', '.contact a',
    '.footer__card', '.cta', 'main li', 'main img', 'section img'
  ].join(',');
  var MEDIA = 'figure, img, .shot, .scrollshot-wrap, .scrollshot, .banner, .cover-shot, .browser, .portrait, .card, .pcard, .folder-item, .cta, .footer__card';

  var items = [];
  document.querySelectorAll(PICK).forEach(function (el) {
    if (el.closest(SKIP)) return;
    if (el.parentElement && el.parentElement.closest('.m-item')) return;   /* outermost match only */
    if (!el.closest('main, section, footer, article')) return;
    el.classList.add('m-item');
    if (el.matches(MEDIA)) el.classList.add('m-media');
    items.push(el);
  });
  doc.classList.add('m-on');

  function show(batch) {
    batch.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    batch.forEach(function (el, k) {
      if (el.classList.contains('m-in')) return;
      el.style.setProperty('--md', Math.min(k, 7) * 0.07 + 's');
      el.classList.add('m-in');
      io.unobserve(el);
      /* drop the delay once it has played, so hover/tab transitions stay snappy */
      setTimeout(function () { el.style.removeProperty('--md'); }, 1600);
    });
  }
  var io = new IntersectionObserver(function (entries) {
    show(entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; }));
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  items.forEach(function (el) { io.observe(el); });

  /* Position-based backup, so nothing stays hidden if the observer is slow to report
     (deep links, background tabs). Items above the viewport show at once. */
  var pending = false;
  function check() {
    pending = false;
    var vh = innerHeight, batch = [];
    /* at the very bottom nothing can scroll further, so show whatever is on screen */
    var atEnd = scrollY + vh >= document.documentElement.scrollHeight - 2;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.classList.contains('m-in')) continue;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;            /* display:none (filtered / collapsed) */
      if ((r.top < vh * 0.94 || (atEnd && r.top < vh)) && r.bottom > 0) batch.push(el);
      else if (r.bottom <= 0) { el.classList.add('m-in'); io.unobserve(el); }
    }
    if (batch.length) show(batch);
  }
  function queue() { if (!pending) { pending = true; setTimeout(check, 60); } }
  if (lenis) lenis.on('scroll', queue);
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  addEventListener('load', check);
  document.addEventListener('click', queue);          /* tabs, filters, toggles reveal new content */
  setTimeout(check, 400);

  /* ---------- 3. Gentle parallax inside clipped frames ---------- */
  var frames = [];
  document.querySelectorAll('.banner, .cover-shot, .portrait, .pcard__cover').forEach(function (f) {
    if (f.closest(SKIP)) return;
    var img = f.querySelector(':scope > img');
    if (!img) return;
    img.classList.add('m-par');
    frames.push([f, img]);
  });
  if (!frames.length) return;
  var ticking = false;
  function par() {
    ticking = false;
    var vh = innerHeight;
    for (var i = 0; i < frames.length; i++) {
      var r = frames[i][0].getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);   /* -1 (above) .. 1 (below) */
      p = Math.max(-1, Math.min(1, p));
      frames[i][1].style.translate = '0 ' + (p * 4).toFixed(2) + '%';
    }
  }
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(par); } }
  if (lenis) lenis.on('scroll', kick); else addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  par();
})();

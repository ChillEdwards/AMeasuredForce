/* =====================================================================
   AMFScroll — single source of truth for "where is the page scrolling".

   On DESKTOP the window/document scrolls (unchanged behavior). On MOBILE/
   TABLET the page content scrolls inside #scroll-root (an inner scroll
   container) so the document never scrolls and the fixed WebGL canvas stays
   truly pinned. Every scroll read/listen/observe/scroll-to in main.js,
   shader-bg.js and router.js goes through this so the two modes share one
   breakpoint: (max-width: 900px), (pointer: coarse) — matching shader-bg's
   NARROW / _narrowDevice.

   Loaded before all other scripts. Methods return window-based values when
   isMobile() is false, so desktop is byte-for-byte the original behavior.
   ===================================================================== */
(function () {
  if (window.AMFScroll) return;
  var mq = window.matchMedia('(max-width: 900px), (pointer: coarse)');
  window.AMFScroll = {
    _mq: mq,
    isMobile: function () { return mq.matches; },
    el: function () { return document.getElementById('scroll-root'); },
    y: function () {
      if (this.isMobile()) { var e = this.el(); return e ? e.scrollTop : 0; }
      return window.scrollY || document.documentElement.scrollTop || 0;
    },
    vh: function () {
      if (this.isMobile()) { var e = this.el(); if (e) return e.clientHeight; }
      return window.innerHeight;
    },
    onScroll: function (fn, opts) {
      var o = opts || { passive: true };
      var target = this.isMobile() ? (this.el() || window) : window;
      target.addEventListener('scroll', fn, o);
      return function () { target.removeEventListener('scroll', fn, o); };
    },
    obsRoot: function () { return this.isMobile() ? (this.el() || null) : null; },
    to: function (y, behavior) {
      var b = behavior || 'auto';
      if (this.isMobile()) {
        var e = this.el();
        if (e) e.scrollTo({ top: y, behavior: b });
      } else {
        window.scrollTo({ top: y, behavior: b });
      }
    }
  };
})();

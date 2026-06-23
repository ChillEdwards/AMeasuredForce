/* ============================================================================
   relief-info.js — sculpture info card

   Bridges the WebGL relief layer (shader-bg.js) to a small on-brand info card.
   shader-bg raycasts the pointer/tap against the reliefs and fires
   `amf:relief-click` with the sculpture's metadata + its current screen
   position. We open a paper card beside the sculpture, blur the rest of the
   page (the #shaderBg canvas stays sharp, so the sculpture reads crisp), and
   dismiss on the × button, click-outside, or Esc.

   The card is appended to <body> — a sibling of the blurred content layers —
   so the blur never touches it. Filled generically from whichever relief was
   clicked, so adding a sculpture later is data-only (a `meta` block in
   shader-bg.js's fragmentsByPage).
   ========================================================================== */
(function () {
  'use strict';

  const FIELDS = ['name', 'artist', 'period', 'material', 'location'];
  // Display labels (the data key stays `name`; it just shows as "Title").
  const LABELS = { name: 'Title', artist: 'Artist', period: 'Period',
                   material: 'Material', location: 'Location' };
  const VIEWPORT_MARGIN = 16;  // keep the card this far from any screen edge
  const SCULPTURE_GAP = 28;    // breathing room between sculpture and card

  let cardEl = null;
  let closeBtn = null;
  let isOpen = false;
  let lastFocus = null;

  function ensureCard() {
    if (cardEl) return;
    cardEl = document.createElement('aside');
    cardEl.className = 'relief-card';
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-modal', 'true');
    cardEl.setAttribute('aria-label', 'Sculpture details');
    cardEl.tabIndex = -1;  // focus the dialog itself (no button focus ring)
    cardEl.innerHTML =
      '<div class="relief-card-paper">' +
        '<button class="relief-card-close" type="button" aria-label="Close details">&times;</button>' +
        '<dl class="relief-card-fields">' +
          FIELDS.map((f) =>
            '<div class="relief-row"><dt>' + LABELS[f] +
            '</dt><dd data-field="' + f + '"></dd></div>'
          ).join('') +
        '</dl>' +
      '</div>';
    document.body.appendChild(cardEl);
    closeBtn = cardEl.querySelector('.relief-card-close');
    closeBtn.addEventListener('click', close);
  }

  function isMobile() {
    if (window.AMFScroll && window.AMFScroll.isMobile) return window.AMFScroll.isMobile();
    return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  }

  // Position the card relative to the click point, vertically centered on it,
  // then clamp to the viewport. Measured after fields are set (clip-path doesn't
  // change the layout box, so offsetWidth/Height are full size).
  //  - Desktop: always opens to the LEFT of the click.
  //  - Mobile: opens to whichever side the click is away from — click on the
  //    left half opens right, click on the right half opens left.
  function placeCard(pos) {
    const cw = cardEl.offsetWidth;
    const ch = cardEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    if (isMobile()) {
      left = (pos.x < vw / 2) ? pos.x + SCULPTURE_GAP : pos.x - SCULPTURE_GAP - cw;
    } else {
      left = pos.x - SCULPTURE_GAP - cw;
    }
    let top = pos.y - ch / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - cw - VIEWPORT_MARGIN));
    top  = Math.max(VIEWPORT_MARGIN, Math.min(top,  vh - ch - VIEWPORT_MARGIN));
    cardEl.style.left = left + 'px';
    cardEl.style.top  = top + 'px';
  }

  function open(meta, screenPos) {
    if (isOpen || !meta) return;
    ensureCard();
    FIELDS.forEach((f) => {
      const dd = cardEl.querySelector('[data-field="' + f + '"]');
      if (!dd) return;
      const val = meta[f] != null ? String(meta[f]).trim() : '';
      dd.textContent = val;
      const row = dd.closest('.relief-row');
      if (row) row.style.display = val ? '' : 'none';  // hide fields absent on the source page
    });
    document.documentElement.classList.add('relief-zoom-open');  // blur + scroll-lock
    placeCard(screenPos || { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    // Commit the rolled-up (inactive) state, force a reflow, THEN activate so the
    // parchment unroll transitions instead of snapping open. Synchronous reflow
    // (not rAF) so it's immune to background-tab frame throttling.
    cardEl.classList.remove('active');
    void cardEl.offsetHeight;  // flush the closed state so the entrance transitions
    cardEl.classList.add('active');
    isOpen = true;
    lastFocus = document.activeElement;
    cardEl.focus();
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onOutside, true);  // capture: pre-empt re-pick/nav
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    cardEl.classList.remove('active');
    document.documentElement.classList.remove('relief-zoom-open');
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onOutside, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function onOutside(e) {
    if (cardEl.contains(e.target)) return;  // clicks inside the card pass through
    // Swallow the dismiss click so it can't re-trigger a relief pick (shader-bg)
    // or a router navigation.
    e.stopPropagation();
    e.preventDefault();
    close();
  }

  window.addEventListener('amf:relief-click', (e) => {
    open(e.detail && e.detail.meta, e.detail && e.detail.screenPos);
  });
  // Back/forward navigation — force-close so no blur/scroll-lock leaks pages.
  // SPA pushState nav is handled by the router calling AMFReliefInfo.close().
  window.addEventListener('popstate', close);

  window.AMFReliefInfo = { close: close, isOpen: function () { return isOpen; } };
})();

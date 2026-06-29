/* ========================================
   A MEASURED FORCE — Premium Interactions v4
   SPA-aware: page-scoped init/teardown.

   - bootOnce()       — runs once at DOMContentLoaded, binds to elements
                        that survive every navigation (cursor, menu,
                        invert dot).
   - bootPage(main)   — runs at DOMContentLoaded AND every time the SPA
                        router swaps <main>. Binds to elements that
                        live inside main; tracks rAF / observers /
                        listeners so teardownPage() can fully clean up.
   - teardownPage()   — called by bootPage() before any new init, and
                        by the SPA router on unload. Aborts the page
                        controller (which removes every listener added
                        with { signal }), cancels every tracked rAF,
                        and disconnects every tracked observer.
   ======================================== */
(function () {

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  /* ---- Scroll source (window on desktop, #scroll-root on mobile) -------
     AMFScroll (js/scroll.js) is loaded first; these wrappers stay defensive
     in case it's missing, falling back to window = current desktop behavior. */
  function scrollPos() { return window.AMFScroll ? window.AMFScroll.y() : (window.scrollY || 0); }
  function scrollVH()  { return window.AMFScroll ? window.AMFScroll.vh() : window.innerHeight; }
  function obsRoot()   { return window.AMFScroll ? window.AMFScroll.obsRoot() : null; }
  function scrollToY(y, b) {
    if (window.AMFScroll) window.AMFScroll.to(y, b);
    else window.scrollTo({ top: y, behavior: b || 'auto' });
  }

  /* ---- Statue-first hero cascade timings ------------------------------
     Every page's relief/statue emerges first, then the hero text fades in
     after it (triggered by the 'amf:relief-emerged' event from shader-bg).
     The reveal mechanics are identical across breakpoints — only these
     magic numbers differ. Desktop's relief emerges slower (2.8s vs mobile's
     1.3s) and the GLB is heavier to load, so desktop needs longer staggers
     and a longer fallback safety timer (the fallback is measured from boot,
     not from relief load, so a short one could fire before the statue
     surfaces). Under reduced motion the relief snaps to its target and
     'amf:relief-emerged' never fires — the fallback is the ONLY reveal, so
     collapse it to near-instant. */
  function seqTimings() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { fallback: 120, cardsFallback: 120, step: 0, aboutHeader: 0, aboutSub: 0,
               cardsTrail: 0, aiFallback: 120, aboutFallback: 120 };
    }
    const mobile = !!(window.AMFScroll && window.AMFScroll.isMobile());
    return mobile
      ? { fallback: 2000, cardsFallback: 2700, step: 0.35, aboutHeader: 600, aboutSub: 1600,
          cardsTrail: 700,  aiFallback: 1800, aboutFallback: 1600 }
      : { fallback: 3600, cardsFallback: 4400, step: 0.45, aboutHeader: 550, aboutSub: 1300,
          cardsTrail: 1000, aiFallback: 3600, aboutFallback: 3600 };
  }

  /* The About-page "Core Capabilities" / "Operating Principles" coordinated
     top-to-bottom cascade is desktop-only — its row grouping assumes the
     4-column layout. On mobile the columns stack tall, so we keep the natural
     per-element scroll reveal (the generic observers) instead. */
  function studioCascadeActive() { return !(window.AMFScroll && window.AMFScroll.isMobile()); }
  function inStudioCascadeSection(el) {
    return studioCascadeActive() && !!el.closest('.studio-services, .studio-approach');
  }

  /* ---- Page-scoped teardown registry --------------------------------- */
  let pageController = null;
  let pageRafIds = [];
  let pageObservers = [];
  let pageTeardowns = [];

  function trackRaf(id) { pageRafIds.push(id); return id; }
  function trackObs(obs) { pageObservers.push(obs); return obs; }
  function trackTeardown(fn) { if (typeof fn === 'function') pageTeardowns.push(fn); }
  function pageSignal() { return pageController ? pageController.signal : undefined; }

  function teardownPage() {
    pageRafIds.forEach((id) => { try { cancelAnimationFrame(id); } catch (e) {} });
    pageRafIds = [];
    pageObservers.forEach((o) => { try { o.disconnect(); } catch (e) {} });
    pageObservers = [];
    pageTeardowns.forEach((fn) => { try { fn(); } catch (e) {} });
    pageTeardowns = [];
    if (pageController) {
      try { pageController.abort(); } catch (e) {}
      pageController = null;
    }
  }

  /* ============ SPLIT TEXT UTILITIES ============ */

  function splitChars(el) {
    if (el.dataset.amfSplit === 'chars') return;
    el.dataset.amfSplit = 'chars';
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let charIndex = 0;

    // MOBILE ONLY: emit inter-word spaces as real (breakable) text nodes so long
    // headings wrap between words on phones. Desktop keeps the nbsp .char span
    // (adjacent inline-blocks with no source whitespace give no break point) — but
    // desktop is wide enough that these headings never need to wrap, so it stays
    // byte-identical. charIndex still advances on spaces so the stagger matches.
    const breakSpaces = !!(window.AMFScroll && window.AMFScroll.isMobile());

    // Emit one span.char per glyph, wrapping each word's glyphs in a span.cw so
    // the word can't break across lines (the .cw gets white-space:nowrap on
    // small screens — a no-op on desktop where words already fit). Inter-word
    // spaces are breakable text nodes on mobile / nbsp .char spans on desktop
    // (see breakSpaces above).
    function emit(target, text) {
      let word = null;
      for (let i = 0; i < text.length; i++) {
        const isSpace = text[i] === ' ';
        if (isSpace) {
          word = null;
          if (breakSpaces) {
            target.appendChild(document.createTextNode(' '));
          } else {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = '\u00a0';
            span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
            target.appendChild(span);
          }
          charIndex++;
          continue;
        }
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = text[i];
        span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
        if (!word) {
          word = document.createElement('span');
          word.className = 'cw';
          target.appendChild(word);
        }
        word.appendChild(span);
        charIndex++;
      }
    }

    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        emit(el, node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          el.appendChild(node.cloneNode());
          return;
        }
        const clone = node.cloneNode(false);
        emit(clone, node.textContent);
        el.appendChild(clone);
      }
    });
  }

  function splitWords(el) {
    if (el.dataset.amfSplit === 'words') return;
    el.dataset.amfSplit = 'words';
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let wordIndex = 0;

    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/);
        words.forEach((word) => {
          if (word.match(/^\s+$/)) {
            el.appendChild(document.createTextNode(' '));
          } else if (word) {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            span.style.transitionDelay = (wordIndex * 0.05) + 's';
            el.appendChild(span);
            el.appendChild(document.createTextNode(' '));
            wordIndex++;
          }
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        const words = node.textContent.split(/(\s+)/);
        words.forEach((word) => {
          if (word.match(/^\s+$/)) {
            clone.appendChild(document.createTextNode(' '));
          } else if (word) {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            span.style.transitionDelay = (wordIndex * 0.05) + 's';
            clone.appendChild(span);
            clone.appendChild(document.createTextNode(' '));
            wordIndex++;
          }
        });
        // Drop the trailing space inside the inline element so punctuation
        // immediately following it (e.g. "<em>…Force</em>,") isn't pushed off.
        const last = clone.lastChild;
        if (last && last.nodeType === Node.TEXT_NODE && last.textContent === ' ') {
          clone.removeChild(last);
        }
        el.appendChild(clone);
      }
    });
  }

  function setupLineReveal(el) {
    if (el.querySelector('.line-reveal-inner')) return;
    const inner = document.createElement('div');
    inner.className = 'line-reveal-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
  }

  function indexLines(container) {
    const lines = container.querySelectorAll('.line-inner');
    lines.forEach((line, i) => line.style.setProperty('--line-i', i));
    return lines;
  }
  function revealLines(container) {
    container.querySelectorAll('.line-inner').forEach((line) => line.classList.add('revealed'));
  }

  function initTextSplits(root) {
    root.querySelectorAll('.split-chars').forEach(splitChars);
    root.querySelectorAll('.split-words').forEach(splitWords);
    root.querySelectorAll('.line-reveal').forEach(setupLineReveal);
  }

  /* ============ CUSTOM CURSOR (persistent) ============ */

  let cursorEl = null;
  let cursorX = 0, cursorY = 0, targetX = 0, targetY = 0;
  let cursorBooted = false;

  function bootCursor() {
    if (cursorBooted) return;
    cursorBooted = true;
    cursorEl = document.getElementById('cursor');
    if (isTouchDevice || !cursorEl) return;

    document.addEventListener('mousemove', (e) => { targetX = e.clientX; targetY = e.clientY; });

    function animateCursor() {
      cursorX += (targetX - cursorX) * 0.15;
      cursorY += (targetY - cursorY) * 0.15;
      cursorEl.style.left = cursorX + 'px';
      cursorEl.style.top  = cursorY + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('mousemove', () => cursorEl.classList.add('visible'), { once: true });
    document.addEventListener('mouseleave', () => cursorEl.style.opacity = '0');
    document.addEventListener('mouseenter', () => cursorEl.style.opacity = '');

    // Event delegation so new <main> contents get hover states automatically.
    // mouseover / mouseout bubble (unlike mouseenter / mouseleave).
    const WORK_SEL = '.works-cycle-item a, .works-card';
    const HOVER_SEL = 'a, button, input, textarea, .pill-btn, .studio-pill';

    // The header logo + wordmark are "disabled" while on the home page and
    // still within the first section — clicks do nothing in that state (see
    // router.js). Match that here so the cursor doesn't enlarge over a link
    // that has no effect.
    function isHeaderLogoLinkDisabled(el) {
      const link = el && el.closest && (el.closest('.header-logo a') || el.closest('.header-center-name a'));
      if (!link) return false;
      const onHome = location.pathname === '/' || /\/index\.html?$/.test(location.pathname);
      return onHome && scrollPos() <= scrollVH() * 0.8;
    }

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t.closest && t.closest(WORK_SEL)) {
        cursorEl.classList.remove('hovering');
        cursorEl.classList.add('hovering-work');
      } else if (t.closest && t.closest(HOVER_SEL)) {
        if (isHeaderLogoLinkDisabled(t)) return;
        if (!cursorEl.classList.contains('hovering-work')) cursorEl.classList.add('hovering');
      }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target;
      const r = e.relatedTarget;
      const wasWork  = t.closest && t.closest(WORK_SEL);
      const wasHover = t.closest && t.closest(HOVER_SEL);
      const stillWork  = r && r.closest && r.closest(WORK_SEL);
      const stillHover = r && r.closest && r.closest(HOVER_SEL);
      if (wasWork && !stillWork) cursorEl.classList.remove('hovering-work');
      if (wasHover && !stillHover && !cursorEl.classList.contains('hovering-work')) {
        cursorEl.classList.remove('hovering');
      }
    });

    // WebGL sculptures: deliberately do NOT grow the cursor. In dark mode the
    // small cursor IS the warm WebGL glow on the statue — enlarging it would just
    // cover that glow. The sculpture stays clickable (shader-bg dispatches
    // amf:relief-click → the info card); the cursor simply stays its small self.
  }

  /* ============ MENU OVERLAY (persistent) ============ */

  function bootMenu() {
    const menuTrigger = document.getElementById('menuTrigger');
    const menuOverlay = document.getElementById('menuOverlay');
    if (!menuTrigger || !menuOverlay) return;

    const openMenu = () => {
      menuOverlay.classList.remove('is-navigating');
      menuOverlay.classList.add('is-open');
      menuTrigger.classList.add('is-open');
      menuTrigger.setAttribute('aria-expanded', 'true');
      menuOverlay.setAttribute('aria-hidden', 'false');
      menuTrigger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('menu-open');
      if (window.MenuShader) window.MenuShader.start();
    };
    const closeMenu = () => {
      menuOverlay.classList.remove('is-open');
      menuTrigger.classList.remove('is-open');
      menuTrigger.setAttribute('aria-expanded', 'false');
      menuOverlay.setAttribute('aria-hidden', 'true');
      menuTrigger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('menu-open');
      if (window.MenuShader) window.MenuShader.stop();
    };
    // Expose so the router can close the menu after a swap.
    window.AMFMenu = { open: openMenu, close: closeMenu };

    menuTrigger.addEventListener('click', () => {
      menuTrigger.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuTrigger.classList.contains('is-open')) closeMenu();
    });
    // The router itself handles closing the menu after navigation.
  }

  /* ============ INVERT TOGGLE (persistent) ============ */

  function bootInvert() {
    const invertDot = document.getElementById('invertDot');
    if (!invertDot) return;
    invertDot.addEventListener('click', () => {
      document.documentElement.classList.toggle('inverted');
    });
  }

  /* ============ HERO ANIMATION ============ */

  function initHero(root) {
    const headline = root.querySelector('.hero-headline h1');
    const meta = root.querySelector('.hero-meta');
    const t = seqTimings();

    // Statue-first: the headline is hidden from first paint (CSS holds the h1 at
    // opacity:0) and is the SOLE responsibility of initHero — it's excluded from
    // the generic char observer so nothing animates it early. Once the goat
    // relief has emerged we add .hero-revealed to fade the whole h1 in as one
    // unit (CSS 2.8s ease), then the meta trails behind. Fallback covers
    // reduced-motion / missing relief.
    if (meta) {
      meta.style.opacity = '0';
      meta.style.transform = 'translateY(15px)';
      meta.style.transition = 'opacity 1.1s cubic-bezier(0.16,1,0.3,1), transform 1.1s cubic-bezier(0.16,1,0.3,1)';
    }

    let started = false;
    let fb;
    const start = () => {
      if (started) return;
      started = true;
      clearTimeout(fb);
      window.removeEventListener('amf:relief-emerged', start);
      window.removeEventListener('amf:hero-reveal', start);
      if (headline) {
        requestAnimationFrame(() => headline.classList.add('hero-revealed'));
      }
      if (meta) {
        setTimeout(() => {
          meta.style.opacity = '1';
          meta.style.transform = 'translateY(0)';
        }, 600);
      }
    };
    // On the home first-load intro the timeline drives this via 'amf:hero-reveal';
    // otherwise (SPA nav back to home) the relief emerging triggers it as before.
    window.addEventListener('amf:relief-emerged', start);
    window.addEventListener('amf:hero-reveal', start);
    fb = setTimeout(start, t.fallback);
  }

  /* ============ PAGE HERO / STUDIO HERO ============ */

  function initPageHero(root) {
    const pageHero = root.querySelector('.page-hero');
    const caseHero = root.querySelector('.case-hero');
    const studioHero = root.querySelector('.studio-hero');
    const heroEl = pageHero || caseHero;

    if (heroEl) {
      // On .page-fade pages the hero uses the same unified opacity fade as the
      // homepage hero headline — no slide, no stagger.
      const fade = document.body.classList.contains('page-fade');
      const children = heroEl.querySelectorAll(
        '.section-label, .page-hero-title, .page-hero-sub, .case-label, .case-title, .case-hero-right, .case-hero-tags'
      );
      // Contact page: the sculpture emerges first, THEN everything fades
      // in one by one, top-down — Contact → Let's Talk → subheader → email → phone
      // → location → form. Hold them all hidden and reveal staggered on the
      // 'amf:relief-emerged' signal (fallback timer if no relief).
      const seqContact = !!(pageHero && root.querySelector('.contact-page'));
      if (seqContact) {
        const t = seqTimings();
        const seqEls = [
          heroEl.querySelector('.section-label'),
          heroEl.querySelector('.page-hero-title'),
          heroEl.querySelector('.page-hero-sub'),
          ...root.querySelectorAll('.contact-page-info .contact-block'),
          root.querySelector('.contact-page-form'),
        ].filter(Boolean);
        seqEls.forEach((el) => {              // hard-hide instantly (no fade-out)
          el.style.transform = 'none';
          el.style.transition = 'none';
          el.style.opacity = '0';
        });
        let done = false;
        let fb;
        const go = () => {
          if (done) return;
          done = true;
          clearTimeout(fb);
          window.removeEventListener('amf:relief-emerged', go);
          seqEls.forEach((el, i) => { el.style.transition = `opacity 0.9s ease ${i * t.step}s`; });
          requestAnimationFrame(() => seqEls.forEach((el) => { el.style.opacity = '1'; }));
        };
        window.addEventListener('amf:relief-emerged', go);
        fb = setTimeout(go, t.fallback);
        return;
      }
      children.forEach((el, i) => {
        el.style.opacity = '0';
        if (fade) {
          el.style.transform = 'none';
          el.style.transition = 'opacity 2.8s ease';
        } else {
          el.style.transform = 'translateY(20px)';
          el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s`;
        }
      });
      setTimeout(() => {
        children.forEach((el) => {
          el.style.opacity = '1';
          if (!fade) el.style.transform = 'translateY(0)';
        });
      }, 50);
    }

    if (studioHero) {
      const badge = studioHero.querySelector('.studio-badge');
      const heading = studioHero.querySelector('.studio-heading');
      if (badge) {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(15px)';
        badge.style.transition = 'opacity 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s';
        setTimeout(() => {
          badge.style.opacity = '1';
          badge.style.transform = 'translateY(0)';
        }, 50);
      }
      if (heading) setTimeout(() => heading.classList.add('animated'), 400);
    }
  }

  /* ============ SCROLL-TRIGGERED REVEALS ============ */

  function initScrollReveals(root) {
    const scrollRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          indexLines(entry.target);
          entry.target.classList.add('in-view');
          revealLines(entry.target);
          scrollRevealObserver.unobserve(entry.target);
        }
      });
    }, { root: obsRoot(), threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    trackObs(scrollRevealObserver);
    root.querySelectorAll('.scroll-reveal').forEach((el) => scrollRevealObserver.observe(el));

    const charObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          charObserver.unobserve(entry.target);
        }
      });
    }, { root: obsRoot(), threshold: 0.2, rootMargin: '0px 0px -80px 0px' });
    trackObs(charObserver);
    const studioHero = root.querySelector('.studio-hero');
    root.querySelectorAll('.split-chars').forEach((el) => {
      if (inStudioCascadeSection(el)) return;   // studio cascade handles these
      if (el.closest('.hero-headline')) return; // home hero — initHero is its sole controller
      if (!studioHero || !studioHero.contains(el)) charObserver.observe(el);
    });

    const wordObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          wordObserver.unobserve(entry.target);
        }
      });
    }, { root: obsRoot(), threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    trackObs(wordObserver);

    // About hero (mobile): play the intro in sequence — (1) the sculpture emerges
    // (WebGL), then (2) the headline fades in, then (3) the sub-paragraph. Hold
    // both lines out of the generic word observer and trigger them off the
    // 'amf:relief-emerged' signal that shader-bg fires once the relief surfaces,
    // with a timer fallback for reduced motion (where the emerge is skipped).
    // Desktop keeps the simultaneous page-fade.
    const t = seqTimings();
    const aboutLarge = root.querySelector('.studio-about-large');
    const aboutSub = root.querySelector('.studio-about-sub');
    const sequenceAboutHero = aboutLarge && aboutSub;

    // AI page: mercury appears first, then the opening beat's text fades
    // in after it (held out of the word observer, triggered on 'amf:relief-emerged').
    const aiFirstLine = root.querySelector('.ai-beat--left .ai-beat-line');
    const aiFirstLabel = aiFirstLine ? root.querySelector('.ai-beat--left .ai-beat-label') : null;

    root.querySelectorAll('.split-words').forEach((el) => {
      if (sequenceAboutHero && (el === aboutLarge || el === aboutSub)) return;  // sequenced below
      if (el === aiFirstLine) return;                                           // sequenced below (AI)
      if (inStudioCascadeSection(el)) return;             // studio cascade
      wordObserver.observe(el);
    });

    if (aiFirstLine) {
      if (aiFirstLabel) { aiFirstLabel.style.transition = 'none'; aiFirstLabel.style.opacity = '0'; }
      let aiStarted = false;
      let aiFb;
      const aiStart = () => {
        if (aiStarted) return;
        aiStarted = true;
        clearTimeout(aiFb);
        window.removeEventListener('amf:relief-emerged', aiStart);
        if (aiFirstLabel) {
          aiFirstLabel.style.transition = 'opacity 0.9s ease';
          requestAnimationFrame(() => { aiFirstLabel.style.opacity = '1'; });
        }
        aiFirstLine.classList.add('animated');
      };
      window.addEventListener('amf:relief-emerged', aiStart);
      aiFb = setTimeout(aiStart, t.aiFallback);  // sculpture missing/instant → don't stall the text
    }

    if (sequenceAboutHero) {
      // Hide the Info eyebrow + rule so they fade in at the top of the cascade
      // (sculpture → Info → line → header → sub), like the other pages.
      const aboutEyebrow = root.querySelector('.studio-about-eyebrow');
      const aboutRule = root.querySelector('.studio-about-rule');
      [aboutEyebrow, aboutRule].forEach((el) => {
        if (el) { el.style.transition = 'none'; el.style.opacity = '0'; }
      });
      let started = false;
      let fallback;
      const startSequence = () => {
        if (started) return;
        started = true;
        clearTimeout(fallback);
        window.removeEventListener('amf:relief-emerged', startSequence);
        if (aboutEyebrow) {                                                  // 1. Info eyebrow
          aboutEyebrow.style.transition = 'opacity 0.9s ease';
          requestAnimationFrame(() => { aboutEyebrow.style.opacity = '1'; });
        }
        if (aboutRule) {                                                     // 1b. line, just after
          aboutRule.style.transition = `opacity 0.9s ease ${t.step}s`;
          requestAnimationFrame(() => { aboutRule.style.opacity = '1'; });
        }
        setTimeout(() => aboutLarge.classList.add('animated'), t.aboutHeader); // 2. header
        setTimeout(() => aboutSub.classList.add('animated'), t.aboutSub);      // 3. sub
      };
      window.addEventListener('amf:relief-emerged', startSequence);
      fallback = setTimeout(startSequence, t.aboutFallback);  // sculpture missing/instant → don't stall the text
    }

    const lineObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          lineObserver.unobserve(entry.target);
        }
      });
    }, { root: obsRoot(), threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    trackObs(lineObserver);
    root.querySelectorAll('.line-reveal').forEach((el, i) => {
      if (inStudioCascadeSection(el)) return;   // studio cascade handles these
      const inner = el.querySelector('.line-reveal-inner');
      if (inner) inner.style.transitionDelay = (i % 7 * 0.04) + 's';
      lineObserver.observe(el);
    });

    const revealSelectors = [
      '.section-label', '.intro-head', '.intro-rule', '.intro-content h2', '.intro-sub', '.pill-btn',
      '.stat',
      '.services-headline', '.service-col',
      '.process-title', '.process-subtitle', '.process-step',
      '.contact-block', '.contact-cta',
      '.about-detail-left', '.about-detail-right',
      '.contact-page-info', '.contact-page-form',
      '.case-hero', '.case-meta', '.case-bleed', '.case-story-block', '.case-impact',
      '.case-section', '.case-results', '.case-next',
      '.logo-ticker',
      '.studio-tagline-h2', '.studio-tagline-pills', '.studio-about-dot',
      '.studio-logos',
      '.logo-cell',
      /* .ai-beat-line is split-words — let that single page-fade handle it; adding
         .reveal too made it double-animate (two observers → uneven/out-of-order). */
      '.ai-beat-label',
      '.amf-wired-in__header', '.amf-wired-in__diagram',
      '.ai-principles-eyebrow', '.ai-principle-num',
      '.ai-principle-title', '.ai-principle-body',
      '.ai-works-eyebrow',
      '.ai-build-name', '.ai-build-outcome',
      '.ai-cta-pretitle', '.ai-cta-display'
    ].join(', ');

    const revealEls = root.querySelectorAll(revealSelectors);
    revealEls.forEach((el) => {
      if (inStudioCascadeSection(el)) return;   // studio cascade handles these
      el.classList.add('reveal');
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { root: obsRoot(), threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
    trackObs(observer);
    revealEls.forEach((el) => {
      if (el === aiFirstLabel) return;
      if (inStudioCascadeSection(el)) return;   // studio cascade
      observer.observe(el);
    });

    root.querySelectorAll('.logo-cell').forEach((cell, i) => {
      cell.style.transitionDelay = (i * 0.04) + 's';
    });
  }

  /* ============ STUDIO SECTION CASCADE ============
     The About page's "Core Capabilities" and "Operating Principles" sections
     reveal as a coordinated top-to-bottom wave when they scroll into view:
     heading starts, then the sub-paragraph, then each row of content (the
     capability pills + their list items, or the approach cards) fades in
     from top to bottom. These elements are excluded from the generic
     char/word/line/reveal observers (above) so this is their sole driver. */
  function initStudioCascade(root) {
    if (!studioCascadeActive()) return;   // mobile keeps the natural scroll reveal
    const sections = root.querySelectorAll('.studio-services, .studio-approach');
    sections.forEach((section) => {
      const heading = section.querySelector('.studio-section-heading');
      const sub = section.querySelector('.studio-approach-sub');
      const isServices = section.classList.contains('studio-services');

      // Ordered groups revealed after the heading + sub, top-to-bottom.
      const groups = [];
      if (isServices) {
        const cols = [...section.querySelectorAll('.service-col')];
        const pills = cols.map((c) => c.querySelector('.service-pill')).filter(Boolean);
        if (pills.length) groups.push({ type: 'fade', els: pills });        // the buttons row
        const maxLi = Math.max(0, ...cols.map((c) => c.querySelectorAll('li').length));
        for (let i = 0; i < maxLi; i++) {                                    // each list row
          const rowEls = cols.map((c) => c.querySelectorAll('li')[i]).filter(Boolean);
          if (rowEls.length) groups.push({ type: 'line', els: rowEls });
        }
      } else {
        [...section.querySelectorAll('.approach-card')].forEach((card) => {
          groups.push({ type: 'line', els: [card] });
        });
      }

      // Hold the fade elements (pills) hidden; line-reveal items + split text
      // are already hidden by their CSS base.
      groups.forEach((g) => {
        if (g.type === 'fade') g.els.forEach((el) => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(14px)';
          el.style.transition = 'none';
        });
      });

      let done = false;
      const revealGroup = (g) => g.els.forEach((el) => {
        if (g.type === 'fade') {
          el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
          requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; });
        } else {
          el.classList.add('revealed');
        }
      });
      const run = () => {
        if (done) return;
        done = true;
        if (heading) heading.classList.add('animated');                       // 1. header
        if (sub) setTimeout(() => sub.classList.add('animated'), 300);         // 2. sub
        groups.forEach((g, i) => setTimeout(() => revealGroup(g), 550 + i * 150)); // 3+. top→bottom
      };

      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { run(); obs.unobserve(e.target); } });
      }, { root: obsRoot(), threshold: 0.25 });
      trackObs(obs);
      obs.observe(heading || section);
    });
  }

  /* ============ "AI" SERIF-I ============ */
  // In sans label/caption text, render the "I" of the word "AI" in the serif
  // face (the bracketed capital-I with top + bottom bars). Used for static
  // labels (applySerifAI) and for dynamically-bound captions (serifAIHtml).
  function serifAIHtml(str) {
    const esc = String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/\bAI\b/g, 'A<span class="serif-i">I</span>');
  }
  function applySerifAI(root) {
    const SEL = '.section-label, .ai-beat-label, .intro-eyebrow, .studio-about-eyebrow,' +
      ' .works-cycle-label, .works-cycle-names a, .works-cycle-tags, .ai-works-eyebrow, .ai-works-label-tag,' +
      ' .ai-works-label-index, .service-pill, .ai-principles-eyebrow';
    root.querySelectorAll(SEL).forEach((el) => {
      // Only plain-text labels (no child markup) that contain the standalone word AI.
      if (el.children.length === 0 && /\bAI\b/.test(el.textContent)) {
        el.innerHTML = serifAIHtml(el.textContent);
      }
    });
  }

  // Mobile card captions (home works-cycle, AI works, brand-work cards) are
  // normally drawn from data-* attributes via CSS ::before/::after, which can't
  // hold a styled letter. On mobile, replace them with real caption spans (so
  // the serif "I" works) and flag the card so the pseudo versions switch off.
  function injectCardCaptions(root) {
    if (!(window.AMFScroll && window.AMFScroll.isMobile())) return;
    const mk = (cls, val) => {
      const s = document.createElement('span');
      s.className = cls;
      s.innerHTML = serifAIHtml(val);
      return s;
    };
    const add = (sel, nameAttr, tagAttr) => {
      root.querySelectorAll(sel).forEach((c) => {
        if (c.classList.contains('has-cap')) return;       // already injected
        if (nameAttr && c.dataset[nameAttr]) c.appendChild(mk('card-cap-name', c.dataset[nameAttr]));
        if (tagAttr && c.dataset[tagAttr])   c.appendChild(mk('card-cap-tags', c.dataset[tagAttr]));
        c.classList.add('has-cap');
      });
    };
    add('.works-cycle-item[data-name]', 'name', 'tags');
    add('.ai-works-card[data-name]',    'name', 'tag');
    add('.works-card[data-tags]',       null,   'tags');   // brand-work name is the <h3>
  }

  /* ============ WORKS CYCLE (vertical scroll-through) ============ */

  function initWorksCycle(root) {
    const section = root.querySelector('.works-cycle');
    if (!section) return;
    const items = Array.from(section.querySelectorAll('.works-cycle-item'));
    if (!items.length) return;
    const nameLinks = Array.from(section.querySelectorAll('.works-cycle-names a'));
    const tagsEl  = section.querySelector('[data-bind="tags"]');
    const indexEl = section.querySelector('[data-bind="index"]');
    let activeIdx = -1;

    function setActive(idx) {
      idx = Math.max(0, Math.min(items.length - 1, idx));
      if (idx === activeIdx) return;
      activeIdx = idx;
      items.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      nameLinks.forEach((a, i) => a.classList.toggle('is-active', i === idx));
      const item = items[idx];
      if (tagsEl)  tagsEl.innerHTML   = serifAIHtml(item.dataset.tags || '');
      if (indexEl) indexEl.textContent = item.dataset.index || '';
    }

    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    const mobileFocus = () => window.AMFScroll && window.AMFScroll.isMobile();
    let rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = scrollPos();
      if (sy !== lastScroll) {
        lastScroll = sy;
        const vh = scrollVH();
        const center = vh / 2;
        let bestIdx = activeIdx >= 0 ? activeIdx : 0;
        let bestDist = Infinity;
        const onMobile = mobileFocus();
        for (let i = 0; i < items.length; i++) {
          const r = items[i].getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - center);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
          if (onMobile) {
            // Continuous scale tied to distance from viewport center — cards
            // grow/shrink fluidly as you scroll instead of snapping. Full size
            // at center, easing down to 0.9 ~one viewport away.
            const t = Math.min(1, d / (vh * 0.6));
            const eased = t * t * (3 - 2 * t);          // smoothstep
            const scale = 1 - eased * 0.1;
            const a = items[i].firstElementChild;       // the image <a>
            if (a) a.style.transform = 'scale(' + scale.toFixed(4) + ')';
          }
        }
        setActive(bestIdx);
      }
      if (isVisible) rafId = trackRaf(requestAnimationFrame(tick));
    }

    const visObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isVisible = e.isIntersecting;
        if (isVisible && !rafId) {
          rafId = trackRaf(requestAnimationFrame(tick));
        } else if (!isVisible && rafId) {
          cancelAnimationFrame(rafId); rafId = null;
        }
      });
    }, { root: obsRoot(), threshold: 0 });
    trackObs(visObs);
    visObs.observe(section);

    nameLinks.forEach((link, i) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = items[i];
        if (!target) return;
        const r = target.getBoundingClientRect();
        const targetY = scrollPos() + r.top - (scrollVH() - r.height) / 2;
        scrollToY(targetY, 'smooth');
      }, { signal: pageSignal() });
    });
  }

  /* ============ AI WORKS — MOBILE SCROLL FOCUS ============ */
  /* On mobile the AI work cards are a vertical stack; give them the same focus
     behaviour as the homepage work cards — the card nearest the viewport centre
     goes full colour and full size, the others grey out and shrink slightly. */
  function initAiWorksMobileFocus(root) {
    if (!(window.AMFScroll && window.AMFScroll.isMobile())) return;
    const rail = root.querySelector('.ai-works-rail');
    if (!rail) return;
    const cards = Array.from(rail.querySelectorAll('.ai-works-card'));
    if (!cards.length) return;
    let activeIdx = -1, rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = scrollPos();
      if (sy !== lastScroll) {
        lastScroll = sy;
        const vh = scrollVH();
        const center = vh / 2;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - center);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
          const t = Math.min(1, d / (vh * 0.6));
          const eased = t * t * (3 - 2 * t);            // smoothstep
          const scale = 1 - eased * 0.12;               // 1.0 at centre → 0.88 away
          const img = cards[i].querySelector('img');
          if (img) img.style.transform = 'scale(' + scale.toFixed(4) + ')';
        }
        if (bestIdx !== activeIdx) {
          activeIdx = bestIdx;
          cards.forEach((c, i) => c.classList.toggle('is-active', i === bestIdx));
        }
      }
      if (isVisible) rafId = trackRaf(requestAnimationFrame(tick));
    }
    const visObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isVisible = e.isIntersecting;
        if (isVisible && !rafId) rafId = trackRaf(requestAnimationFrame(tick));
        else if (!isVisible && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      });
    }, { root: obsRoot(), threshold: 0 });
    trackObs(visObs);
    visObs.observe(rail);
  }

  /* Brand Work page — mobile scroll-focus (mirrors initAiWorksMobileFocus):
     the card nearest viewport centre gets is-active (full colour) + grows,
     others fade to greyscale + shrink. Plain vertical stack, no loop. */
  function initWorksScrollMobileFocus(root) {
    if (!(window.AMFScroll && window.AMFScroll.isMobile())) return;
    const scroll = root.querySelector('#worksScroll');
    if (!scroll) return;
    const cards = Array.from(scroll.querySelectorAll('.works-card'));
    if (!cards.length) return;
    let activeIdx = -1, rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = scrollPos();
      if (sy !== lastScroll) {
        lastScroll = sy;
        const vh = scrollVH();
        const center = vh / 2;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - center);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
          const t = Math.min(1, d / (vh * 0.6));
          const eased = t * t * (3 - 2 * t);            // smoothstep
          const scale = 1 - eased * 0.12;               // 1.0 at centre → 0.88 away
          const img = cards[i].querySelector('img');
          if (img) img.style.transform = 'scale(' + scale.toFixed(4) + ')';
        }
        if (bestIdx !== activeIdx) {
          activeIdx = bestIdx;
          cards.forEach((c, i) => c.classList.toggle('is-active', i === bestIdx));
        }
      }
      if (isVisible) rafId = trackRaf(requestAnimationFrame(tick));
    }
    const visObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isVisible = e.isIntersecting;
        if (isVisible && !rafId) rafId = trackRaf(requestAnimationFrame(tick));
        else if (!isVisible && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      });
    }, { root: obsRoot(), threshold: 0 });
    trackObs(visObs);
    visObs.observe(scroll);
  }

  /* ============ AI WORKS HORIZONTAL ============ */

  function initAiWorks(root) {
    const section = root.querySelector('.ai-works-pin');
    if (!section) return;
    const rail = section.querySelector('[data-rail]');
    const cards = Array.from(rail ? rail.children : []);
    const labelTop    = section.querySelector('[data-label-top]');
    const labelBottom = section.querySelector('[data-label-bottom]');
    const nameEl  = section.querySelector('[data-bind="name"]');
    const indexEl = section.querySelector('[data-bind="index"]');
    const tagEl   = section.querySelector('[data-bind="tag"]');
    if (!rail || !cards.length) return;

    const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

    let cardCenters = [];
    let centerProgress = [];
    let sectionTop = 0, sectionHeight = 0;
    let vw = window.innerWidth, vh = window.innerHeight;
    let railWidth = 0;
    let startX = 0, endX = 0, travel = 0;
    let activeIdx = -1;
    let disabled = false;

    function measure() {
      disabled = prefersReducedMotion() || isNarrow();
      if (disabled) { rail.style.transform = ''; return; }
      vw = window.innerWidth; vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      sectionTop = rect.top + scrollPos();
      sectionHeight = section.offsetHeight;
      cardCenters = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
      railWidth = rail.scrollWidth;
      startX = vw; endX = -railWidth; travel = startX - endX;
      centerProgress = cardCenters.map((c) => (startX - (vw / 2 - c)) / travel);
    }

    function applyLabel(idx) {
      if (idx === activeIdx) return;
      activeIdx = idx;
      const card = cards[idx];
      if (!card) return;
      if (nameEl)  nameEl.innerHTML   = serifAIHtml(card.dataset.name || '');
      if (indexEl) indexEl.textContent = card.dataset.index || '';
      if (tagEl)   tagEl.innerHTML    = card.dataset.tag ? serifAIHtml('— ' + card.dataset.tag) : '';
    }

    let rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = scrollPos();
      if (sy !== lastScroll) {
        lastScroll = sy;
        const denom = Math.max(1, sectionHeight - vh);
        let progress = (sy - sectionTop) / denom;
        if (progress < 0) progress = 0;
        else if (progress > 1) progress = 1;

        const railX = startX - progress * travel;
        rail.style.transform = 'translate3d(' + railX + 'px, -50%, 0)';

        let nearestIdx = 0, nearestDist = Infinity;
        for (let i = 0; i < cards.length; i++) {
          const d = Math.abs(progress - centerProgress[i]);
          if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
        }
        applyLabel(nearestIdx);

        const pixelDist = nearestDist * travel;
        const fadeWidth = vw * 0.22;
        let opacity = 1 - pixelDist / fadeWidth;
        if (opacity < 0) opacity = 0;
        else if (opacity > 1) opacity = 1;
        opacity = opacity * opacity * (3 - 2 * opacity);
        if (labelTop)    labelTop.style.opacity    = opacity;
        if (labelBottom) labelBottom.style.opacity = opacity;
      }
      if (isVisible && !disabled) rafId = trackRaf(requestAnimationFrame(tick));
    }

    const visObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isVisible = e.isIntersecting;
        if (isVisible && !rafId && !disabled) {
          lastScroll = -1;
          rafId = trackRaf(requestAnimationFrame(tick));
        } else if (!isVisible && rafId) {
          cancelAnimationFrame(rafId); rafId = null;
        }
      });
    }, { root: obsRoot(), threshold: 0 });
    trackObs(visObs);
    visObs.observe(section);

    measure();
    requestAnimationFrame(() => {
      lastScroll = -1;
      if (!disabled) tick();
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measure();
        lastScroll = -1;
        if (!disabled && isVisible && !rafId) rafId = trackRaf(requestAnimationFrame(tick));
        if (disabled && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }, 120);
    }, { signal: pageSignal() });
  }

  /* ============ WORKS PAGE — Studio375-style infinite scroll ============ */

  function initWorksScroll(root) {
    // Mobile uses a plain vertical stack with scroll-focus (initWorksScrollMobileFocus),
    // not the desktop infinite-loop / wheel-hijack scroll.
    if (window.AMFScroll && window.AMFScroll.isMobile()) return;
    const worksScroll = root.querySelector('#worksScroll');
    const worksRight  = root.querySelector('.works-right');
    if (!worksScroll || !worksRight) return;

    const originalCards = Array.from(worksScroll.children);
    const cardCount = originalCards.length;
    for (let i = 0; i < 2; i++) {
      originalCards.forEach((card) => worksScroll.appendChild(card.cloneNode(true)));
    }

    // Cursor hover on cards is handled by the persistent event delegation.

    let targetY = 0, currentY = 0, velocity = 0, prevCurrentY = 0, setHeight = 0;
    const ease = 0.07;
    const scrollMultiplier = 1.2;

    function measureSetHeight() {
      const gap = parseFloat(getComputedStyle(worksScroll).gap) || 20;
      let h = 0;
      for (let i = 0; i < cardCount; i++) {
        h += worksScroll.children[i].offsetHeight + gap;
      }
      setHeight = h;
      targetY = -setHeight;
      currentY = -setHeight;
    }

    const signal = pageSignal();
    window.addEventListener('wheel', (e) => {
      if (!worksRight.isConnected) return;
      e.preventDefault();
      targetY -= e.deltaY * scrollMultiplier;
    }, { passive: false, signal });

    let touchLastY = 0;
    worksRight.addEventListener('touchstart', (e) => { touchLastY = e.touches[0].clientY; }, { passive: true, signal });
    worksRight.addEventListener('touchmove', (e) => {
      const dy = touchLastY - e.touches[0].clientY;
      touchLastY = e.touches[0].clientY;
      targetY -= dy * scrollMultiplier;
    }, { passive: true, signal });

    const allCards = worksScroll.querySelectorAll('.works-card');
    const autoDrift = -0.4;

    let rafId = null;
    function tick() {
      targetY += autoDrift;
      currentY += (targetY - currentY) * ease;
      velocity = currentY - prevCurrentY;
      prevCurrentY = currentY;

      if (currentY < -setHeight * 2) {
        currentY += setHeight; targetY += setHeight; prevCurrentY += setHeight;
      }
      if (currentY > 0) {
        currentY -= setHeight; targetY -= setHeight; prevCurrentY -= setHeight;
      }

      const viewH = window.innerHeight;
      const viewCenter = viewH / 2;
      const blurZoneStart = viewH * 0.75;

      allCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardMid = rect.top + rect.height / 2;
        const img = card.querySelector('img');
        if (!img) return;
        const fromCenter = (cardMid - viewCenter) / viewCenter;
        const drag = fromCenter * velocity * 0.8;
        img.style.transform = `translateY(${drag}px)`;
        const blurZoneEnd = viewH * 0.25;
        // Append invert(1) inline when the page is inverted so the dynamic
        // blur/grayscale composes correctly (the CSS rule for inverted .works-
        // card img is no longer !important, so the inline style wins).
        const invertTail = document.documentElement.classList.contains('inverted') ? ' invert(1)' : '';
        if (cardMid > blurZoneStart) {
          const progress = Math.min((cardMid - blurZoneStart) / (viewH - blurZoneStart), 1.0);
          const blur = progress * 6;
          const bright = 0.85 - progress * 0.25;
          img.style.filter = `brightness(${bright}) blur(${blur}px) grayscale(${progress})${invertTail}`;
        } else if (cardMid < blurZoneEnd) {
          const progress = Math.min((blurZoneEnd - cardMid) / blurZoneEnd, 1.0);
          const blur = progress * 6;
          const bright = 0.85 - progress * 0.25;
          img.style.filter = `brightness(${bright}) blur(${blur}px) grayscale(${progress})${invertTail}`;
        } else {
          img.style.filter = `brightness(0.85)${invertTail}`;
        }
      });

      worksScroll.style.transform = `translateY(${currentY}px)`;
      rafId = trackRaf(requestAnimationFrame(tick));
    }

    // Images may not have loaded yet on SPA arrival — defer until next frame
    // when layout has settled, rather than waiting for window.load (which
    // only fires once on first navigation).
    requestAnimationFrame(() => {
      measureSetHeight();
      rafId = trackRaf(requestAnimationFrame(tick));
    });
    window.addEventListener('resize', measureSetHeight, { signal });
  }

  /* ============ WORKS SPLIT entrance animations ============ */

  function initWorksSplitEntrance(root) {
    const worksLeft = root.querySelector('.works-left');
    const t = seqTimings();
    const mobileSeq = true;   // statue-first cascade on all breakpoints
    if (worksLeft) {
      const els = worksLeft.querySelectorAll('.section-label, .works-left-title, .works-left-sub, .works-count');
      if (mobileSeq) {
        // The sculpture emerges first, THEN the Brand Work label + title
        // fade in one by one — matching the AI / contact pages. Hold them hidden
        // and reveal staggered on 'amf:relief-emerged' (fallback timer if none).
        els.forEach((el) => {
          el.style.transform = 'none';
          el.style.transition = 'none';
          el.style.opacity = '0';
        });
        let done = false, fb;
        const go = () => {
          if (done) return;
          done = true;
          clearTimeout(fb);
          window.removeEventListener('amf:relief-emerged', go);
          els.forEach((el, i) => { el.style.transition = `opacity 0.9s ease ${i * t.step}s`; });
          requestAnimationFrame(() => els.forEach((el) => { el.style.opacity = '1'; }));
          worksLeft.classList.add('revealed');   // fade in the divider line too
        };
        window.addEventListener('amf:relief-emerged', go);
        fb = setTimeout(go, t.fallback);
      } else {
        els.forEach((el, i) => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(20px)';
          el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s`;
        });
        setTimeout(() => {
          els.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        }, 50);
      }
    }

    const worksCards = root.querySelectorAll('.works-card');
    if (mobileSeq) {
      // Mobile: hold the cards hidden until just after the sculpture emerges and
      // the hero text has begun, THEN each card fades up as it scrolls into view
      // (no pop-in on load) — so the order is statue → hero text → cards.
      worksCards.forEach((card) => {       // hard-hide instantly (no fade-out flash)
        card.style.transition = 'none';
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
      });
      let started = false, fb;
      const startCards = () => {
        if (started) return;
        started = true;
        clearTimeout(fb);
        window.removeEventListener('amf:relief-emerged', onEmerge);
        worksCards.forEach((card) => {
          card.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)';
        });
        const cardObs = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.style.opacity = '1';
              entry.target.style.transform = 'translateY(0)';
              cardObs.unobserve(entry.target);
            }
          });
        }, { root: obsRoot(), threshold: 0.15 });
        trackObs(cardObs);
        worksCards.forEach((card) => cardObs.observe(card));
      };
      // Trail the hero text so cards come after the label/title.
      const onEmerge = () => setTimeout(startCards, t.cardsTrail);
      window.addEventListener('amf:relief-emerged', onEmerge);
      fb = setTimeout(startCards, t.cardsFallback);
    } else {
      worksCards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s`;
      });
      if (worksCards.length) {
        setTimeout(() => {
          worksCards.forEach((card) => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; });
        }, 50);
      }
    }
  }

  /* ============ CASE STUDY IMAGES ============ */

  function initCaseImages(root) {
    root.querySelectorAll('.case-hero-img, .case-full-img').forEach((img) => {
      img.style.opacity = '0';
      img.style.transform = 'translateY(30px)';
      img.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)';

      const imgObs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            imgObs.unobserve(entry.target);
          }
        });
      }, { root: obsRoot(), threshold: 0.1 });
      trackObs(imgObs);
      imgObs.observe(img);
    });
  }

  /* ============ SMOOTH ANCHORS ============ */

  function initSmoothAnchors(root) {
    const signal = pageSignal();
    root.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          if (window.AMFScroll && window.AMFScroll.isMobile()) {
            // Document doesn't scroll on mobile — scroll the wrapper explicitly.
            const r = target.getBoundingClientRect();
            scrollToY(scrollPos() + r.top, 'smooth');
          } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, { signal });
    });
  }

  /* ============ PARALLAX ============ */

  function initParallax(root) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouchDevice || reducedMotion) return;

    const items = Array.from(root.querySelectorAll('[data-parallax-speed]'))
      .map((el) => ({ el, speed: parseFloat(el.dataset.parallaxSpeed) || 0, inView: false }));
    if (!items.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const item = items.find((i) => i.el === e.target);
        if (item) item.inView = e.isIntersecting;
      });
    }, { root: obsRoot(), rootMargin: '50px 0px' });
    trackObs(io);
    items.forEach((i) => io.observe(i.el));

    let lastScroll = -1;
    function tick() {
      const sy = window.scrollY;
      if (sy !== lastScroll) {
        lastScroll = sy;
        const vCenter = window.innerHeight / 2;
        for (const item of items) {
          if (!item.inView) continue;
          const r = item.el.getBoundingClientRect();
          const eCenter = r.top + r.height / 2;
          const offset = (vCenter - eCenter) * item.speed;
          item.el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
        }
      }
      trackRaf(requestAnimationFrame(tick));
    }
    trackRaf(requestAnimationFrame(tick));
  }

  /* ============ CONTACT FORM ============ */

  function initContactForm(root) {
    const contactForm = root.querySelector('#contactForm');
    if (!contactForm) return;
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('.form-submit');
      const orig = btn.textContent;
      btn.textContent = 'Message Sent!';
      btn.style.background = '#00C9DB';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
        contactForm.reset();
      }, 3000);
    }, { signal: pageSignal() });
  }

  /* ============ SYSTEM DIAGRAM ============ */

  function initSystemDiagram(root) {
    if (!window.AMFSystemDiagram) return;
    const svg = root.querySelector('#system-svg');
    if (!svg) return;
    const handle = window.AMFSystemDiagram.init(svg);
    if (handle && handle.teardown) trackTeardown(handle.teardown);
  }

  /* ============ AI PRINCIPLES — scroll-driven crossfade stage ============ */

  function initAiPrinciplesStage(root) {
    const section = root.querySelector('.ai-principles');
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('.ai-principle-card'));
    const segs  = Array.from(section.querySelectorAll('.ai-principles-progress span'));
    if (!cards.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      cards.forEach((c) => c.classList.add('is-active'));
      segs.forEach((s) => s.classList.add('is-active'));
      return;
    }
    // Mobile: skip the sticky parallax (whose per-frame inline opacity/transform
    // writes would otherwise overlap the cards in their absolute 50% columns).
    // CSS stacks the cards in normal flow; just mark them all visible.
    if (window.matchMedia('(max-width: 768px)').matches) {
      cards.forEach((c) => c.classList.add('is-active'));
      segs.forEach((s) => s.classList.add('is-active'));
      return;
    }

    let inView = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { inView = e.isIntersecting; });
    }, { root: obsRoot(), rootMargin: '0px' });
    trackObs(io);
    io.observe(section);

    const n = cards.length;
    let lastIdx = -1;
    function update() {
      const r = section.getBoundingClientRect();
      const total = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -r.top / total));
      // Each card peaks at (i + 0.5) / n. Continuous distance from peak
      // drives both opacity and a parallax translateY — cards rise from
      // below into focus, then lift up and fade as scroll passes them.
      let activeIdx = 0;
      let activeOp = -1;
      for (let i = 0; i < n; i++) {
        const peak = (i + 0.5) / n;
        const dist = (progress - peak) * n;     // -∞..+∞, 0 = peak
        const opacity = Math.max(0, Math.min(1, 1 - Math.abs(dist) * 1.4));
        const translateY = -dist * 90;          // px
        const c = cards[i];
        c.style.opacity = opacity.toFixed(3);
        c.style.transform = `translateY(${translateY.toFixed(1)}px)`;
        if (opacity > activeOp) { activeOp = opacity; activeIdx = i; }
      }
      if (activeIdx !== lastIdx) {
        cards.forEach((c, i) => c.classList.toggle('is-active', i === activeIdx));
        lastIdx = activeIdx;
      }
    }
    function tick() {
      if (inView) update();
      trackRaf(requestAnimationFrame(tick));
    }
    trackRaf(requestAnimationFrame(tick));
    update();
  }

  /* ============ BOOT ORCHESTRATION ============ */

  /* ============ CLIENT LOGO TICKER (mobile infinite + swipe) ============ */
  // Desktop uses the CSS transform marquee. On mobile the row is a native
  // horizontal scroller (swipeable); here we auto-advance scrollLeft for an
  // infinite loop that coexists with manual dragging. The logo list is
  // duplicated (two identical halves), so wrapping at half-width is seamless.
  function initLogoTicker(root) {
    if (!(window.AMFScroll && window.AMFScroll.isMobile())) return;
    const ticker = root.querySelector('.logo-ticker');
    const inner = ticker && ticker.querySelector('.logo-ticker-inner');
    if (!ticker || !inner) return;
    const signal = pageSignal();
    const SPEED = 0.8;            // px per frame (~48px/s at 60fps)
    let paused = false;
    let resumeAt = 0;
    // Accumulate position as a FLOAT: element.scrollLeft reads back rounded to an
    // integer, so sub-pixel increments would floor away and never advance.
    let pos = 0;
    ticker.addEventListener('touchstart', () => { paused = true; resumeAt = Infinity; }, { passive: true, signal });
    const release = () => { resumeAt = performance.now() + 450; };
    ticker.addEventListener('touchend', release, { passive: true, signal });
    ticker.addEventListener('touchcancel', release, { passive: true, signal });
    function step(now) {
      const half = inner.scrollWidth / 2;
      if (half > 0) {
        if (paused && now >= resumeAt) { paused = false; pos = ticker.scrollLeft; }
        if (!paused) {
          pos += SPEED;
          if (pos >= half) pos -= half;
          ticker.scrollLeft = pos;
        } else if (ticker.scrollLeft >= half) {
          ticker.scrollLeft -= half;   // keep manual position in the seamless range
        }
      }
      trackRaf(requestAnimationFrame(step));
    }
    trackRaf(requestAnimationFrame(step));
  }

  function bootPage(mainEl) {
    if (!mainEl) return;
    teardownPage();
    pageController = new AbortController();

    initTextSplits(mainEl);
    initHero(mainEl);
    initPageHero(mainEl);
    initScrollReveals(mainEl);
    initStudioCascade(mainEl);
    initWorksCycle(mainEl);
    initAiWorks(mainEl);
    initAiWorksMobileFocus(mainEl);
    initWorksScroll(mainEl);
    initWorksScrollMobileFocus(mainEl);
    initWorksSplitEntrance(mainEl);
    injectCardCaptions(mainEl);
    applySerifAI(mainEl);
    initCaseImages(mainEl);
    initSmoothAnchors(mainEl);
    initParallax(mainEl);
    initContactForm(mainEl);
    initSystemDiagram(mainEl);
    initAiPrinciplesStage(mainEl);
    initLogoTicker(mainEl);
  }

  /* ============ HEADER SCROLL-HIDE (persistent) ============ */

  // Hide the left logo + right actions while scrolling down past a small
  // top guard; show them again on scroll-up. Center wordmark is untouched.
  function bootHeaderScrollHide() {
    const TOP_GUARD = 80;
    const DELTA = 6;
    let lastY = scrollPos();
    let detach = null;
    function onScroll() {
      const y = scrollPos();
      if (Math.abs(y - lastY) < DELTA) return;
      if (y > lastY && y > TOP_GUARD) {
        document.body.classList.add('header-hidden');
      } else {
        document.body.classList.remove('header-hidden');
      }
      lastY = y;
    }
    function bind() {
      if (detach) detach();
      lastY = scrollPos();
      detach = window.AMFScroll
        ? window.AMFScroll.onScroll(onScroll, { passive: true })
        : (window.addEventListener('scroll', onScroll, { passive: true }),
           () => window.removeEventListener('scroll', onScroll, { passive: true }));
    }
    bind();
    // Re-bind to the correct scroller if the breakpoint flips (e.g. desktop
    // window resized across 900px) — this is the only once-bound scroll listener.
    if (window.AMFScroll && window.AMFScroll._mq.addEventListener) {
      window.AMFScroll._mq.addEventListener('change', bind);
    }
  }

  function bootOnce() {
    bootCursor();
    bootMenu();
    bootInvert();
    bootHeaderScrollHide();
  }

  /* ============ FIRST-LOAD HOME INTRO SEQUENCE ============
     Choreographed entrance, in order: (1) the centred wordmark fades in,
     (2) the logo + hamburger follow, (3) the hero text, (4) the light ignites
     (mobile: drops from the top / desktop: ignites at the cursor — shader-bg.js),
     (5) the goat finally emerges. Runs once, only on a full load of home (the
     `intro-seq` class is on <html> in index.html). Reduced motion shows it all at
     once. shader-bg.js holds the goat's emerge until the 'amf:emerge-go' cue. */
  let homeIntroRan = false;
  function bootHomeIntro() {
    const html = document.documentElement;
    if (homeIntroRan || !html.classList.contains('intro-seq')) return;
    homeIntroRan = true;
    const name = document.querySelector('.header-center-name');
    const logo = document.querySelector('.header-logo');
    const actions = document.querySelector('.header-actions');
    const show = (el) => { if (el) el.style.opacity = '1'; };
    const cleanup = () => {
      html.classList.remove('intro-seq');
      [name, logo, actions].forEach((el) => { if (el) el.style.opacity = ''; });
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show(name); show(logo); show(actions); cleanup();
      window.dispatchEvent(new Event('amf:emerge-go'));
      return;
    }
    // Timeline (ms) — tunable. Desktop is compressed so the goat arrives sooner.
    const mobile = !!(window.AMFScroll && window.AMFScroll.isMobile());
    const T = mobile
      ? { name: 250, header: 650, heroText: 1300, light: 2200, goat: 2900 }
      : { name: 250, header: 600, heroText: 1100, light: 1700, goat: 2050 };
    setTimeout(() => show(name), T.name);                          // 1) wordmark
    setTimeout(() => { show(logo); show(actions); }, T.header);    // 2) logo + hamburger
    setTimeout(cleanup, T.header + 1000);                          // release header holds
    setTimeout(() => window.dispatchEvent(new Event('amf:hero-reveal')), T.heroText);      // 3) hero text
    setTimeout(() => window.dispatchEvent(new Event('amf:hero-entrance-done')), T.light);  // 4) light
    setTimeout(() => window.dispatchEvent(new Event('amf:emerge-go')), T.goat);            // 5) goat
  }

  /* ---- Public API used by the SPA router ----------------------------- */
  window.AMFPage = {
    boot: bootPage,
    teardown: teardownPage,
  };

  document.addEventListener('DOMContentLoaded', () => {
    bootOnce();
    const main = document.querySelector('main');
    bootPage(main);
    bootHomeIntro();  // after bootPage so initHero's 'amf:hero-reveal' listener is ready
  });

})();

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

    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        for (let i = 0; i < text.length; i++) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = text[i] === ' ' ? ' ' : text[i];
          span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
          el.appendChild(span);
          charIndex++;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          el.appendChild(node.cloneNode());
          return;
        }
        const clone = node.cloneNode(false);
        const innerText = node.textContent;
        for (let i = 0; i < innerText.length; i++) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = innerText[i] === ' ' ? ' ' : innerText[i];
          span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
          clone.appendChild(span);
          charIndex++;
        }
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

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t.closest && t.closest(WORK_SEL)) {
        cursorEl.classList.remove('hovering');
        cursorEl.classList.add('hovering-work');
      } else if (t.closest && t.closest(HOVER_SEL)) {
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

    if (headline) {
      // Defer to next frame so split spans exist before adding .animated.
      requestAnimationFrame(() => {
        headline.classList.add('animated');
        const allChars = headline.querySelectorAll('.char');
        const lastChar = allChars[allChars.length - 1];
        if (lastChar) {
          lastChar.addEventListener('animationend', () => {
            allChars.forEach((ch) => {
              ch.style.animation = 'none';
              ch.style.opacity = '1';
              ch.style.transform = '';
            });
            if (window._enableHeroGrow) window._enableHeroGrow();
          }, { once: true });
        }
      });
    }

    if (meta) {
      meta.style.opacity = '0';
      meta.style.transform = 'translateY(15px)';
      meta.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s';
      setTimeout(() => {
        meta.style.opacity = '1';
        meta.style.transform = 'translateY(0)';
      }, 50);
    }
  }

  function initHeroGrow(root) {
    const heroSection = root.querySelector('.hero');
    const heroH1 = root.querySelector('.hero-headline h1');
    if (!heroSection || !heroH1) return;

    const radius = 150;
    let growReady = false;
    function enableGrow() { growReady = true; }
    window._enableHeroGrow = enableGrow;
    trackTeardown(() => { if (window._enableHeroGrow === enableGrow) delete window._enableHeroGrow; });

    const signal = pageSignal();
    heroSection.addEventListener('mousemove', (e) => {
      if (!growReady) return;
      const allChars = heroH1.querySelectorAll('.char');
      const mx = e.clientX, my = e.clientY;
      allChars.forEach((ch) => {
        const r = ch.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        if (d < radius) {
          const scale = 1 + 0.15 * (1 - d / radius);
          ch.style.transform = `scale(${scale})`;
          ch.style.transition = 'transform 0.2s ease-out';
        } else {
          ch.style.transform = 'scale(1)';
          ch.style.transition = 'transform 0.4s ease-out';
        }
      });
    }, { signal });

    heroSection.addEventListener('mouseleave', () => {
      if (!growReady) return;
      heroH1.querySelectorAll('.char').forEach((ch) => {
        ch.style.transform = 'scale(1)';
        ch.style.transition = 'transform 0.4s ease-out';
      });
    }, { signal });
  }

  /* ============ PAGE HERO / STUDIO HERO ============ */

  function initPageHero(root) {
    const pageHero = root.querySelector('.page-hero');
    const caseHero = root.querySelector('.case-hero');
    const studioHero = root.querySelector('.studio-hero');
    const heroEl = pageHero || caseHero;

    if (heroEl) {
      const children = heroEl.querySelectorAll(
        '.section-label, .page-hero-title, .page-hero-sub, .case-label, .case-title, .case-hero-right, .case-hero-tags'
      );
      children.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s`;
      });
      setTimeout(() => {
        children.forEach((el) => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
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
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    trackObs(scrollRevealObserver);
    root.querySelectorAll('.scroll-reveal').forEach((el) => scrollRevealObserver.observe(el));

    const charObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          charObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -80px 0px' });
    trackObs(charObserver);
    const studioHero = root.querySelector('.studio-hero');
    root.querySelectorAll('.split-chars').forEach((el) => {
      if (!studioHero || !studioHero.contains(el)) charObserver.observe(el);
    });

    const wordObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          wordObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    trackObs(wordObserver);
    root.querySelectorAll('.split-words').forEach((el) => wordObserver.observe(el));

    const lineObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          lineObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    trackObs(lineObserver);
    root.querySelectorAll('.line-reveal').forEach((el, i) => {
      const inner = el.querySelector('.line-reveal-inner');
      if (inner) inner.style.transitionDelay = (i % 7 * 0.04) + 's';
      lineObserver.observe(el);
    });

    const revealSelectors = [
      '.section-label', '.intro-content h2', '.intro-text', '.intro-dot',
      '.stat',
      '.services-headline', '.service-col',
      '.process-title', '.process-subtitle', '.process-step',
      '.contact-block', '.contact-cta',
      '.about-detail-left', '.about-detail-right',
      '.contact-page-info', '.contact-page-form',
      '.case-section', '.case-results', '.case-next',
      '.logo-ticker',
      '.studio-tagline-h2', '.studio-tagline-pills', '.studio-about-dot',
      '.studio-logos',
      '.logo-cell',
      '.ai-beat-line', '.ai-principle-title', '.ai-principle-body',
      '.ai-build-name', '.ai-build-outcome',
      '.ai-cta-pretitle', '.ai-cta-display'
    ].join(', ');

    const revealEls = root.querySelectorAll(revealSelectors);
    revealEls.forEach((el) => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
    trackObs(observer);
    revealEls.forEach((el) => observer.observe(el));

    root.querySelectorAll('.logo-cell').forEach((cell, i) => {
      cell.style.transitionDelay = (i * 0.04) + 's';
    });
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
      if (tagsEl)  tagsEl.textContent  = item.dataset.tags  || '';
      if (indexEl) indexEl.textContent = item.dataset.index || '';
    }

    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    let rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = window.scrollY;
      if (sy !== lastScroll) {
        lastScroll = sy;
        const center = window.innerHeight / 2;
        let bestIdx = activeIdx >= 0 ? activeIdx : 0;
        let bestDist = Infinity;
        for (let i = 0; i < items.length; i++) {
          const r = items[i].getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - center);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        setActive(bestIdx);
      }
      if (isVisible) rafId = trackRaf(requestAnimationFrame(tick));
    }

    const visObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        isVisible = e.isIntersecting;
        if (isVisible && !rafId && !isMobile()) {
          rafId = trackRaf(requestAnimationFrame(tick));
        } else if (!isVisible && rafId) {
          cancelAnimationFrame(rafId); rafId = null;
        }
      });
    }, { threshold: 0 });
    trackObs(visObs);
    visObs.observe(section);

    nameLinks.forEach((link, i) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = items[i];
        if (!target) return;
        const r = target.getBoundingClientRect();
        const targetY = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }, { signal: pageSignal() });
    });
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
      sectionTop = rect.top + window.scrollY;
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
      if (nameEl)  nameEl.textContent  = card.dataset.name || '';
      if (indexEl) indexEl.textContent = card.dataset.index || '';
      if (tagEl)   tagEl.textContent   = card.dataset.tag ? '— ' + card.dataset.tag : '';
    }

    let rafId = null, isVisible = false, lastScroll = -1;
    function tick() {
      const sy = window.scrollY;
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
    }, { threshold: 0 });
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
        if (cardMid > blurZoneStart) {
          const progress = Math.min((cardMid - blurZoneStart) / (viewH - blurZoneStart), 1.0);
          const blur = progress * 6;
          const bright = 0.85 - progress * 0.25;
          img.style.filter = `brightness(${bright}) blur(${blur}px)`;
        } else if (cardMid < blurZoneEnd) {
          const progress = Math.min((blurZoneEnd - cardMid) / blurZoneEnd, 1.0);
          const blur = progress * 6;
          const bright = 0.85 - progress * 0.25;
          img.style.filter = `brightness(${bright}) blur(${blur}px)`;
        } else {
          img.style.filter = 'brightness(0.85)';
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
    if (worksLeft) {
      const els = worksLeft.querySelectorAll('.section-label, .works-left-title, .works-left-sub, .works-count');
      els.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s`;
      });
      setTimeout(() => {
        els.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
      }, 50);
    }

    const worksCards = root.querySelectorAll('.works-card');
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
      }, { threshold: 0.1 });
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
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    }, { rootMargin: '50px 0px' });
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

  /* ============ BOOT ORCHESTRATION ============ */

  function bootPage(mainEl) {
    if (!mainEl) return;
    teardownPage();
    pageController = new AbortController();

    initTextSplits(mainEl);
    initHero(mainEl);
    initHeroGrow(mainEl);
    initPageHero(mainEl);
    initScrollReveals(mainEl);
    initWorksCycle(mainEl);
    initAiWorks(mainEl);
    initWorksScroll(mainEl);
    initWorksSplitEntrance(mainEl);
    initCaseImages(mainEl);
    initSmoothAnchors(mainEl);
    initParallax(mainEl);
    initContactForm(mainEl);
    initSystemDiagram(mainEl);
  }

  function bootOnce() {
    bootCursor();
    bootMenu();
    bootInvert();
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
  });

})();

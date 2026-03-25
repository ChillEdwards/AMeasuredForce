/* ========================================
   A MEASURED FORCE — Premium Interactions v4
   AJAX routing + split-text animations +
   375.studio-inspired motion design
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  /* ============ SPLIT TEXT UTILITIES ============ */

  function splitChars(el) {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let charIndex = 0;
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        for (let i = 0; i < text.length; i++) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
          span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
          el.appendChild(span);
          charIndex++;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') { el.appendChild(node.cloneNode()); return; }
        const clone = node.cloneNode(false);
        const innerText = node.textContent;
        for (let i = 0; i < innerText.length; i++) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = innerText[i] === ' ' ? '\u00A0' : innerText[i];
          span.style.setProperty('--char-delay', (charIndex * 0.08) + 's');
          clone.appendChild(span);
          charIndex++;
        }
        el.appendChild(clone);
      }
    });
  }

  function splitWords(el) {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let wordIndex = 0;
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/);
        words.forEach(word => {
          if (word.match(/^\s+$/)) { el.appendChild(document.createTextNode(' ')); }
          else if (word) {
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
        words.forEach(word => {
          if (word.match(/^\s+$/)) { clone.appendChild(document.createTextNode(' ')); }
          else if (word) {
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

  function setupLineReveals() {
    document.querySelectorAll('.line-reveal').forEach(el => {
      if (el.querySelector('.line-reveal-inner')) return;
      const inner = document.createElement('div');
      inner.className = 'line-reveal-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    });
  }

  function indexLines(container) {
    const lines = container.querySelectorAll('.line-inner');
    lines.forEach((line, i) => line.style.setProperty('--line-i', i));
    return lines;
  }

  function revealLines(container) {
    container.querySelectorAll('.line-inner').forEach(line => line.classList.add('revealed'));
  }

  /* ============ CUSTOM CURSOR (global, runs once) ============ */
  const cursor = document.getElementById('cursor');
  let cursorX = 0, cursorY = 0, targetX = 0, targetY = 0;

  if (!isTouchDevice && cursor) {
    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    function animateCursor() {
      cursorX += (targetX - cursorX) * 0.08;
      cursorY += (targetY - cursorY) * 0.08;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('mousemove', (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      targetX = e.clientX;
      targetY = e.clientY;
      cursor.classList.add('visible');
    }, { once: true });

    document.addEventListener('mouseleave', () => cursor.style.opacity = '0');
    document.addEventListener('mouseenter', () => cursor.style.opacity = '');
  }

  function initCursorHovers() {
    if (isTouchDevice || !cursor) return;
    document.querySelectorAll('a, button, input, textarea, .pill-btn, .studio-pill').forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (!cursor.classList.contains('hovering-work')) cursor.classList.add('hovering');
      });
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
    document.querySelectorAll('.featured-item, .works-card').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.remove('hovering');
        cursor.classList.add('hovering-work');
      });
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering-work'));
    });
  }

  /* ============ LENIS SMOOTH SCROLL (global) ============ */
  let lenis = null;

  function initLenis() {
    if (lenis) { lenis.destroy(); lenis = null; }
    const isWorksSplitPage = !!document.querySelector('.works-split');
    if (!isWorksSplitPage && typeof Lenis !== 'undefined') {
      lenis = new Lenis({
        duration: 1.6,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5
      });
      function raf(time) {
        if (!lenis) return;
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  /* ============ PAGE CONTENT INITIALIZATION ============ */
  /* Everything that needs to re-run when <main> content changes */

  let activeObservers = [];
  let worksRAF = null;

  function cleanupPage() {
    activeObservers.forEach(obs => obs.disconnect());
    activeObservers = [];
    if (worksRAF) { cancelAnimationFrame(worksRAF); worksRAF = null; }
    window._enableHeroGrow = null;
  }

  function initPage() {
    cleanupPage();

    /* ---- Text splits ---- */
    document.querySelectorAll('.split-chars').forEach(el => splitChars(el));
    document.querySelectorAll('.split-words').forEach(el => splitWords(el));
    setupLineReveals();

    /* ---- Cursor hovers for new content ---- */
    initCursorHovers();

    /* ---- Loader (homepage only) ---- */
    const loader = document.getElementById('loader');
    if (loader) {
      const loaderBar = document.getElementById('loaderBar');
      const loaderPercent = document.getElementById('loaderPercent');
      let progress = 0;
      document.body.style.overflow = 'hidden';
      const loadInterval = setInterval(() => {
        progress += Math.random() * 8 + 2;
        if (progress >= 100) {
          progress = 100;
          clearInterval(loadInterval);
          setTimeout(() => {
            loader.classList.add('hidden');
            document.body.style.overflow = '';
            setTimeout(() => animateHero(), 800);
          }, 600);
        }
        if (loaderBar) loaderBar.style.width = progress + '%';
        if (loaderPercent) loaderPercent.textContent = Math.floor(progress) + '%';
      }, 150);
    }

    /* ---- Hero animation ---- */
    function animateHero() {
      const headline = document.querySelector('.hero-headline h1');
      const meta = document.querySelector('.hero-meta');
      if (headline) {
        headline.classList.add('animated');
        const allChars = headline.querySelectorAll('.char');
        const lastChar = allChars[allChars.length - 1];
        if (lastChar) {
          lastChar.addEventListener('animationend', () => {
            allChars.forEach(ch => { ch.style.animation = 'none'; ch.style.opacity = '1'; ch.style.transform = ''; });
            if (window._enableHeroGrow) window._enableHeroGrow();
          }, { once: true });
        }
      }
      if (meta) {
        meta.style.opacity = '0';
        meta.style.transform = 'translateY(15px)';
        meta.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s';
        setTimeout(() => { meta.style.opacity = '1'; meta.style.transform = 'translateY(0)'; }, 50);
      }
    }

    /* ---- Hero char proximity grow ---- */
    const heroSection = document.querySelector('.hero');
    const heroH1 = document.querySelector('.hero-headline h1');
    if (heroSection && heroH1) {
      const radius = 150;
      let growReady = false;
      function enableGrow() { growReady = true; }
      heroSection.addEventListener('mousemove', (e) => {
        if (!growReady) return;
        const allChars = heroH1.querySelectorAll('.char');
        const mx = e.clientX, my = e.clientY;
        allChars.forEach(ch => {
          const rect = ch.getBoundingClientRect();
          const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
          const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
          if (dist < radius) {
            ch.style.transform = `scale(${1 + 0.15 * (1 - dist / radius)})`;
            ch.style.transition = 'transform 0.2s ease-out';
          } else {
            ch.style.transform = 'scale(1)';
            ch.style.transition = 'transform 0.4s ease-out';
          }
        });
      });
      heroSection.addEventListener('mouseleave', () => {
        if (!growReady) return;
        heroH1.querySelectorAll('.char').forEach(ch => {
          ch.style.transform = 'scale(1)';
          ch.style.transition = 'transform 0.4s ease-out';
        });
      });
      window._enableHeroGrow = enableGrow;
    }

    if (!loader) {
      const heroHeadline = document.querySelector('.hero-headline h1.split-chars');
      if (heroHeadline) setTimeout(() => animateHero(), 100);
    }

    /* ---- Page hero animation (inner pages) ---- */
    const pageHero = document.querySelector('.page-hero');
    const caseHero = document.querySelector('.case-hero');
    const studioHero = document.querySelector('.studio-hero');
    const heroEl = pageHero || caseHero;

    if (heroEl && !loader) {
      const children = heroEl.querySelectorAll(
        '.section-label, .page-hero-title, .page-hero-sub, .case-label, .case-title, .case-hero-right, .case-hero-tags'
      );
      children.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.1}s`;
      });
      setTimeout(() => {
        children.forEach(el => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
      }, 50);
    }

    if (studioHero && !loader) {
      const badge = studioHero.querySelector('.studio-badge');
      const heading = studioHero.querySelector('.studio-heading');
      if (badge) {
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(15px)';
        badge.style.transition = 'opacity 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s';
        setTimeout(() => { badge.style.opacity = '1'; badge.style.transform = 'translateY(0)'; }, 50);
      }
      if (heading) setTimeout(() => heading.classList.add('animated'), 400);
    }

    /* ---- Scroll-triggered reveals ---- */
    const scrollRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          indexLines(entry.target);
          entry.target.classList.add('in-view');
          revealLines(entry.target);
          scrollRevealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    activeObservers.push(scrollRevealObserver);
    document.querySelectorAll('.scroll-reveal').forEach(el => scrollRevealObserver.observe(el));

    const charObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('animated'); charObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -80px 0px' });
    activeObservers.push(charObserver);
    document.querySelectorAll('.split-chars').forEach(el => {
      if (!studioHero || !studioHero.contains(el)) charObserver.observe(el);
    });

    const wordObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('animated'); wordObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    activeObservers.push(wordObserver);
    document.querySelectorAll('.split-words').forEach(el => wordObserver.observe(el));

    const lineObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('revealed'); lineObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    activeObservers.push(lineObserver);
    document.querySelectorAll('.line-reveal').forEach((el, i) => {
      const inner = el.querySelector('.line-reveal-inner');
      if (inner) inner.style.transitionDelay = (i % 7 * 0.04) + 's';
      lineObserver.observe(el);
    });

    /* ---- General scroll reveal ---- */
    const revealSelectors = [
      '.section-label', '.intro-content h2', '.intro-text', '.intro-dot',
      '.stat', '.services-headline', '.service-col',
      '.process-title', '.process-subtitle', '.process-step',
      '.contact-block', '.contact-cta',
      '.about-detail-left', '.about-detail-right',
      '.contact-page-info', '.contact-page-form',
      '.case-section', '.case-results', '.case-next',
      '.logo-ticker',
      '.studio-tagline-h2', '.studio-tagline-pills', '.studio-about-dot',
      '.studio-logos', '.logo-cell'
    ].join(', ');

    const revealEls = document.querySelectorAll(revealSelectors);
    revealEls.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
    activeObservers.push(observer);
    revealEls.forEach(el => observer.observe(el));

    document.querySelectorAll('.logo-cell').forEach((cell, i) => {
      cell.style.transitionDelay = (i * 0.04) + 's';
    });

    /* ---- Featured items ---- */
    document.querySelectorAll('.featured-item').forEach(item => {
      const fObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const text = entry.target.querySelector('.featured-text');
            if (text) {
              text.style.opacity = '0';
              text.style.transform = 'translateY(30px)';
              text.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s';
              requestAnimationFrame(() => { text.style.opacity = '1'; text.style.transform = 'translateY(0)'; });
            }
            fObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      activeObservers.push(fObserver);
      fObserver.observe(item);
    });

    /* ---- Works page scroll engine ---- */
    const worksScroll = document.getElementById('worksScroll');
    const worksRight = document.querySelector('.works-right');

    if (worksScroll && worksRight) {
      const originalCards = Array.from(worksScroll.children);
      const cardCount = originalCards.length;
      for (let i = 0; i < 2; i++) {
        originalCards.forEach(card => worksScroll.appendChild(card.cloneNode(true)));
      }

      if (!isTouchDevice && cursor) {
        worksScroll.querySelectorAll('.works-card').forEach(el => {
          el.addEventListener('mouseenter', () => { cursor.classList.remove('hovering'); cursor.classList.add('hovering-work'); });
          el.addEventListener('mouseleave', () => cursor.classList.remove('hovering-work'));
        });
      }

      let wTargetY = 0, wCurrentY = 0, wVelocity = 0, wPrevY = 0, setHeight = 0;
      const ease = 0.07, scrollMultiplier = 1.2, autoDrift = -0.4;

      function measureSetHeight() {
        const gap = parseFloat(getComputedStyle(worksScroll).gap) || 20;
        let h = 0;
        for (let i = 0; i < cardCount; i++) h += worksScroll.children[i].offsetHeight + gap;
        setHeight = h;
        wTargetY = -setHeight;
        wCurrentY = -setHeight;
      }

      const wheelHandler = (e) => { e.preventDefault(); wTargetY -= e.deltaY * scrollMultiplier; };
      window.addEventListener('wheel', wheelHandler, { passive: false });

      let touchLastY = 0;
      worksRight.addEventListener('touchstart', (e) => { touchLastY = e.touches[0].clientY; }, { passive: true });
      worksRight.addEventListener('touchmove', (e) => {
        const dy = touchLastY - e.touches[0].clientY;
        touchLastY = e.touches[0].clientY;
        wTargetY -= dy * scrollMultiplier;
      }, { passive: true });

      const allCards = worksScroll.querySelectorAll('.works-card');

      function tick() {
        wTargetY += autoDrift;
        wCurrentY += (wTargetY - wCurrentY) * ease;
        wVelocity = wCurrentY - wPrevY;
        wPrevY = wCurrentY;

        if (wCurrentY < -setHeight * 2) { wCurrentY += setHeight; wTargetY += setHeight; wPrevY += setHeight; }
        if (wCurrentY > 0) { wCurrentY -= setHeight; wTargetY -= setHeight; wPrevY -= setHeight; }

        const viewH = window.innerHeight, viewCenter = viewH / 2, blurZoneStart = viewH * 0.75;

        allCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const cardMid = rect.top + rect.height / 2;
          const img = card.querySelector('img');
          if (!img) return;
          const fromCenter = (cardMid - viewCenter) / viewCenter;
          const drag = fromCenter * wVelocity * 0.8;
          img.style.transform = `translateY(${drag}px)`;
          const blurZoneEnd = viewH * 0.25;
          if (cardMid > blurZoneStart) {
            const p = Math.min((cardMid - blurZoneStart) / (viewH - blurZoneStart), 1.0);
            img.style.filter = `brightness(${0.85 - p * 0.25}) blur(${p * 6}px)`;
          } else if (cardMid < blurZoneEnd) {
            const p = Math.min((blurZoneEnd - cardMid) / blurZoneEnd, 1.0);
            img.style.filter = `brightness(${0.85 - p * 0.25}) blur(${p * 6}px)`;
          } else {
            img.style.filter = 'brightness(0.85)';
          }
        });

        worksScroll.style.transform = `translateY(${wCurrentY}px)`;
        worksRAF = requestAnimationFrame(tick);
      }

      window.addEventListener('load', () => { measureSetHeight(); worksRAF = requestAnimationFrame(tick); });
      window.addEventListener('resize', measureSetHeight);
    }

    /* ---- Works split entrance ---- */
    const worksLeft = document.querySelector('.works-left');
    if (worksLeft && !loader) {
      const els = worksLeft.querySelectorAll('.section-label, .works-left-title, .works-left-sub, .works-count');
      els.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s`;
      });
      setTimeout(() => { els.forEach(el => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }); }, 50);
    }

    const worksCards = document.querySelectorAll('.works-card');
    worksCards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s`;
    });
    if (worksCards.length) {
      setTimeout(() => { worksCards.forEach(card => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }); }, 50);
    }

    /* ---- Case study image reveal ---- */
    document.querySelectorAll('.case-hero-img, .case-full-img').forEach(img => {
      img.style.opacity = '0';
      img.style.transform = 'translateY(30px)';
      img.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)';
      const imgObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; imgObs.unobserve(entry.target); }
        });
      }, { threshold: 0.1 });
      activeObservers.push(imgObs);
      imgObs.observe(img);
    });

    /* ---- Mobile menu ---- */
    const menuToggle = document.getElementById('menuToggle');
    const mobileNav = document.getElementById('mobileNav');
    let menuOpen = false;
    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', () => {
        menuOpen = !menuOpen;
        mobileNav.classList.toggle('open', menuOpen);
        menuToggle.querySelector('span').textContent = menuOpen ? 'Close' : 'Menu';
      });
      document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
          menuOpen = false;
          mobileNav.classList.remove('open');
          menuToggle.querySelector('span').textContent = 'Menu';
        });
      });
    }

    /* ---- Header scroll ---- */
    const header = document.getElementById('header');
    if (header) {
      window.addEventListener('scroll', () => {
        header.style.background = 'transparent';
        header.style.backdropFilter = 'none';
        header.style.webkitBackdropFilter = 'none';
        header.style.mixBlendMode = 'difference';
      }, { passive: true });
    }

    /* ---- Smooth anchors ---- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          if (lenis) lenis.scrollTo(target, { offset: 0 });
          else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    /* ---- Contact form ---- */
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('.form-submit');
        const orig = btn.textContent;
        btn.textContent = 'Message Sent!';
        btn.style.background = '#00C9DB';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; contactForm.reset(); }, 3000);
      });
    }

    /* ---- Wire up AJAX navigation on all internal links ---- */
    initRouter();
  }

  /* ============ AJAX ROUTER ============ */
  /* Fetches pages in background, swaps <main> + <footer>, no full reload */

  let isNavigating = false;

  function initRouter() {
    document.querySelectorAll('a[href]').forEach(link => {
      // Skip if already wired
      if (link.dataset.routerBound) return;
      link.dataset.routerBound = '1';

      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (!href || href === '#' || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
        if (isNavigating) return;

        e.preventDefault();
        navigateTo(href);
      });
    });
  }

  function navigateTo(url) {
    isNavigating = true;
    const main = document.querySelector('main');
    const footer = document.querySelector('footer');

    // Fade out current content
    main.style.transition = 'opacity 0.4s ease';
    footer.style.transition = 'opacity 0.4s ease';
    main.style.opacity = '0';
    footer.style.opacity = '0';

    // Fetch new page while fading out
    fetch(url)
      .then(res => res.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newMain = doc.querySelector('main');
        const newFooter = doc.querySelector('footer');
        const newTitle = doc.querySelector('title');

        // Wait for fade out to finish
        setTimeout(() => {
          // Swap content
          if (newMain) main.replaceWith(newMain);
          if (newFooter) footer.replaceWith(newFooter);
          if (newTitle) document.title = newTitle.textContent;

          // Update nav active states
          const newNav = doc.querySelector('.header-nav');
          const currentNav = document.querySelector('.header-nav');
          if (newNav && currentNav) currentNav.innerHTML = newNav.innerHTML;

          // Update URL
          history.pushState({}, '', url);

          // Scroll to top
          window.scrollTo(0, 0);
          if (lenis) lenis.scrollTo(0, { immediate: true });

          // Re-init Lenis for new page
          initLenis();

          // Start new content hidden, then fade in
          const freshMain = document.querySelector('main');
          const freshFooter = document.querySelector('footer');
          freshMain.style.opacity = '0';
          freshMain.style.transition = 'opacity 0.5s ease';
          freshFooter.style.opacity = '0';
          freshFooter.style.transition = 'opacity 0.5s ease';

          // Re-initialize all page content
          initPage();

          // Fade in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              freshMain.style.opacity = '1';
              freshFooter.style.opacity = '1';
              setTimeout(() => {
                freshMain.style.transition = '';
                freshFooter.style.transition = '';
                isNavigating = false;
              }, 550);
            });
          });
        }, 420);
      })
      .catch(() => {
        // If fetch fails, fall back to normal navigation
        window.location.href = url;
      });
  }

  // Handle back/forward buttons
  window.addEventListener('popstate', () => {
    navigateTo(location.pathname);
  });

  /* ============ INIT ============ */
  initLenis();
  initPage();

});

/* ========================================
   A MEASURED FORCE — Premium Interactions v3
   Split-text animations, page transitions,
   375.studio-inspired motion design
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  /* ============ SPLIT TEXT UTILITIES ============ */

  // Split element text into individual character spans
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
        if (node.tagName === 'BR') {
          el.appendChild(node.cloneNode());
          return;
        }
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

  // Split element text into individual word spans
  function splitWords(el) {
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';
    let wordIndex = 0;

    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/);
        words.forEach(word => {
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
        // Preserve child elements (like <em>, <a>) and wrap their words
        const clone = node.cloneNode(false);
        const words = node.textContent.split(/(\s+)/);
        words.forEach(word => {
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

  // Wrap line-reveal content in inner div
  function setupLineReveals() {
    document.querySelectorAll('.line-reveal').forEach(el => {
      if (el.querySelector('.line-reveal-inner')) return;
      const inner = document.createElement('div');
      inner.className = 'line-reveal-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    });
  }

  /* ============ INITIALIZE TEXT SPLITS ============ */

  document.querySelectorAll('.split-chars').forEach(el => splitChars(el));
  document.querySelectorAll('.split-words').forEach(el => splitWords(el));
  setupLineReveals();


  /* ============ CUSTOM CURSOR ============ */
  const cursor = document.getElementById('cursor');
  let cursorX = 0, cursorY = 0, targetX = 0, targetY = 0;

  if (!isTouchDevice && cursor) {
    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    function animateCursor() {
      cursorX += (targetX - cursorX) * 0.15;
      cursorY += (targetY - cursorY) * 0.15;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('mousemove', () => cursor.classList.add('visible'), { once: true });

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

    document.addEventListener('mouseleave', () => cursor.style.opacity = '0');
    document.addEventListener('mouseenter', () => cursor.style.opacity = '');
  }

  /* ============ PAGE TRANSITIONS ============ */
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#' || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;

      e.preventDefault();
      document.body.classList.add('transitioning');
      setTimeout(() => { window.location.href = href; }, 700);
    });
  });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('transitioning');
  });

  /* ============ LINE-MASK REVEAL SYSTEM ============ */
  /*
   * Assigns stagger index (--line-i) to each .line-inner,
   * then triggers reveal by adding .revealed class.
   * Used for hero on load, and scroll-triggered sections.
   */

  // Index all line-inners within a container for stagger timing
  function indexLines(container) {
    const lines = container.querySelectorAll('.line-inner');
    lines.forEach((line, i) => {
      line.style.setProperty('--line-i', i);
    });
    return lines;
  }

  // Reveal all line-inners in a container
  function revealLines(container) {
    const lines = container.querySelectorAll('.line-inner');
    lines.forEach(line => line.classList.add('revealed'));
  }

  /* ============ HERO ANIMATION ============ */
  function animateHero() {
    const headline = document.querySelector('.hero-headline h1');
    const meta = document.querySelector('.hero-meta');

    // Trigger split-chars animation on headline
    if (headline) {
      headline.classList.add('animated');

      // After all animations complete, enable hover grow
      const allChars = headline.querySelectorAll('.char');
      const lastChar = allChars[allChars.length - 1];
      if (lastChar) {
        lastChar.addEventListener('animationend', () => {
          allChars.forEach(ch => {
            ch.style.animation = 'none';
            ch.style.opacity = '1';
            ch.style.transform = '';
          });
          if (window._enableHeroGrow) window._enableHeroGrow();
        }, { once: true });
      }
    }

    // Fade in meta with delay
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

  /* ============ HERO CHAR PROXIMITY GROW ============ */
  // Letters near the cursor grow, creating a magnifying effect.
  // Uses the .hero section as the mousemove target so the full
  // area is covered, not just the text bounding box.
  const heroSection = document.querySelector('.hero');
  const heroH1 = document.querySelector('.hero-headline h1');
  if (heroSection && heroH1) {
    const radius = 150;
    let growReady = false;

    // Only enable grow after the float-up animation has fully completed
    function enableGrow() { growReady = true; }

    heroSection.addEventListener('mousemove', (e) => {
      if (!growReady) return;
      const allChars = heroH1.querySelectorAll('.char');
      const mx = e.clientX;
      const my = e.clientY;

      allChars.forEach(ch => {
        const rect = ch.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);

        if (dist < radius) {
          const scale = 1 + 0.15 * (1 - dist / radius);
          ch.style.transform = `scale(${scale})`;
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

    // Expose enableGrow so animateHero can call it after animations finish
    window._enableHeroGrow = enableGrow;
  }

  // Animate hero on initial load.
  const heroHeadline = document.querySelector('.hero-headline h1.split-chars');
  if (heroHeadline) {
    setTimeout(() => animateHero(), 100);
  }

  /* ============ PAGE HERO ANIMATION (inner pages) ============ */
  const pageHero = document.querySelector('.page-hero');
  const caseHero = document.querySelector('.case-hero');
  const studioHero = document.querySelector('.studio-hero');
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
      children.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    }, 50);
  }

  // Studio hero — badge fades in, then chars animate
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

    if (heading) {
      setTimeout(() => heading.classList.add('animated'), 400);
    }
  }

  /* ============ SCROLL-TRIGGERED LINE-MASK REVEALS ============ */
  /*
   * .scroll-reveal containers: when they enter the viewport,
   * index their .line-inner children and trigger reveal.
   * Same motion language as the hero, applied on scroll.
   */
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

  document.querySelectorAll('.scroll-reveal').forEach(el => {
    scrollRevealObserver.observe(el);
  });

  /* ============ SCROLL-TRIGGERED TEXT ANIMATIONS ============ */

  // Observe split-chars elements
  const charObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        charObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -80px 0px' });

  document.querySelectorAll('.split-chars').forEach(el => {
    if (!studioHero || !studioHero.contains(el)) {
      charObserver.observe(el);
    }
  });

  // Observe split-words elements
  const wordObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        wordObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.split-words').forEach(el => wordObserver.observe(el));

  // Observe line-reveal elements
  const lineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        lineObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.line-reveal').forEach((el, i) => {
    // Stagger siblings
    const inner = el.querySelector('.line-reveal-inner');
    if (inner) inner.style.transitionDelay = (i % 7 * 0.04) + 's';
    lineObserver.observe(el);
  });

  /* ============ GENERAL SCROLL REVEAL ============ */
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
    '.logo-cell'
  ].join(', ');

  const revealEls = document.querySelectorAll(revealSelectors);
  revealEls.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  revealEls.forEach(el => observer.observe(el));

  // Stagger logo cells
  document.querySelectorAll('.logo-cell').forEach((cell, i) => {
    cell.style.transitionDelay = (i * 0.04) + 's';
  });

  /* ============ FEATURED ITEMS — text reveal on scroll ============ */
  document.querySelectorAll('.featured-item').forEach(item => {
    const fObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const text = entry.target.querySelector('.featured-text');
          if (text) {
            text.style.opacity = '0';
            text.style.transform = 'translateY(30px)';
            text.style.transition = 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s';
            requestAnimationFrame(() => {
              text.style.opacity = '1';
              text.style.transform = 'translateY(0)';
            });
          }
          fObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    fObserver.observe(item);
  });

  /* ==========================================================
     WORKS PAGE — Studio375-inspired scroll interaction engine
     - Smooth inertia-based scroll driving the image column
     - Infinite seamless loop in both directions
     - Scroll-velocity-driven distortion (skew + scale)
     - Per-card parallax: slight drift offset per card
     - Bottom-of-viewport blur + purple atmospheric tint
     ========================================================== */

  const worksScroll = document.getElementById('worksScroll');
  const worksRight = document.querySelector('.works-right');

  if (worksScroll && worksRight) {

    /* ---- 1. Clone cards for seamless infinite loop ---- */
    const originalCards = Array.from(worksScroll.children);
    const cardCount = originalCards.length;

    // Clone two full sets (before + after) so wrapping is invisible
    for (let i = 0; i < 2; i++) {
      originalCards.forEach(card => worksScroll.appendChild(card.cloneNode(true)));
    }

    /* ---- 2. Cursor listeners on all cards (including clones) ---- */
    if (!isTouchDevice && cursor) {
      worksScroll.querySelectorAll('.works-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
          cursor.classList.remove('hovering');
          cursor.classList.add('hovering-work');
        });
        el.addEventListener('mouseleave', () => cursor.classList.remove('hovering-work'));
      });
    }

    /* ---- 3. Scroll state ---- */
    let targetY = 0;        // where scroll wants to be (immediate from input)
    let currentY = 0;       // smoothly interpolated position
    let velocity = 0;       // current scroll velocity (for distortion)
    let prevCurrentY = 0;   // previous frame position (to derive velocity)
    let setHeight = 0;      // height of one full card set

    // Easing: lower = smoother/slower follow. 0.07 feels cinematic.
    const ease = 0.07;
    // How much wheel input translates to scroll distance
    const scrollMultiplier = 1.2;

    /* ---- 4. Measure one card set height ---- */
    function measureSetHeight() {
      const gap = parseFloat(getComputedStyle(worksScroll).gap) || 20;
      let h = 0;
      for (let i = 0; i < cardCount; i++) {
        h += worksScroll.children[i].offsetHeight + gap;
      }
      setHeight = h;
      // Start in the middle set so we can scroll both directions
      targetY = -setHeight;
      currentY = -setHeight;
    }

    /* ---- 5. Input: wheel ---- */
    window.addEventListener('wheel', (e) => {
      if (!worksRight) return;
      e.preventDefault();
      targetY -= e.deltaY * scrollMultiplier;
    }, { passive: false });

    /* ---- 6. Input: touch ---- */
    let touchLastY = 0;
    worksRight.addEventListener('touchstart', (e) => {
      touchLastY = e.touches[0].clientY;
    }, { passive: true });
    worksRight.addEventListener('touchmove', (e) => {
      const dy = touchLastY - e.touches[0].clientY;
      touchLastY = e.touches[0].clientY;
      targetY -= dy * scrollMultiplier;
    }, { passive: true });

    /* ---- 7. Per-card parallax offsets (subtle drift variation) ---- */
    // Each card drifts at a slightly different rate for editorial depth
    const parallaxFactors = [];
    const allCards = worksScroll.querySelectorAll('.works-card');
    allCards.forEach((_, i) => {
      // Alternate between slight speed-up and slow-down per card
      parallaxFactors.push(1.0 + (((i % cardCount) % 3) - 1) * 0.04);
    });

    /* ---- 8. Auto-scroll drift ---- */
    const autoDrift = -0.4; // px per frame, negative = upward

    /* ---- 9. Animation loop ---- */
    function tick() {
      // Constant auto-scroll drift
      targetY += autoDrift;

      // Smooth interpolation toward target
      currentY += (targetY - currentY) * ease;

      // Derive velocity from frame-to-frame position change
      velocity = currentY - prevCurrentY;
      prevCurrentY = currentY;

      // Infinite wrap: when we've scrolled past a full set, snap back
      if (currentY < -setHeight * 2) {
        currentY += setHeight;
        targetY += setHeight;
        prevCurrentY += setHeight;
      }
      if (currentY > 0) {
        currentY -= setHeight;
        targetY -= setHeight;
        prevCurrentY -= setHeight;
      }

      const viewH = window.innerHeight;
      const viewCenter = viewH / 2;
      const blurZoneStart = viewH * 0.75;

      // Apply per-card drag offset from center
      // Cards far from center lag behind, creating a "pulled from middle" feel
      allCards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const cardMid = rect.top + rect.height / 2;
        const img = card.querySelector('img');
        if (!img) return;

        // How far from center, normalized -1 to 1
        const fromCenter = (cardMid - viewCenter) / viewCenter;
        // Drag offset: cards further from center resist more
        // velocity is negative when scrolling up, positive when down
        // This makes outer cards lag behind the scroll = hard drag feel
        const drag = fromCenter * velocity * 0.8;

        img.style.transform = `translateY(${drag}px)`;

        // Top and bottom blur + dim
        const blurZoneEnd = viewH * 0.25; // top 25%
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

      // Move the entire scroll container
      worksScroll.style.transform = `translateY(${currentY}px)`;

      requestAnimationFrame(tick);
    }

    // Wait for images to load so heights are correct, then start
    window.addEventListener('load', () => {
      measureSetHeight();
      requestAnimationFrame(tick);
    });

    // Recalculate on resize
    window.addEventListener('resize', measureSetHeight);
  }

  /* ============ WORKS SPLIT — entrance animations ============ */
  const worksLeft = document.querySelector('.works-left');
  if (worksLeft) {
    const els = worksLeft.querySelectorAll('.section-label, .works-left-title, .works-left-sub, .works-count');
    els.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.12}s`;
    });
    setTimeout(() => {
      els.forEach(el => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    }, 50);
  }

  const worksCards = document.querySelectorAll('.works-card');
  worksCards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s`;
  });
  if (worksCards.length) {
    setTimeout(() => {
      worksCards.forEach(card => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; });
    }, 50);
  }

  /* ============ CASE STUDY IMAGE REVEAL ============ */
  document.querySelectorAll('.case-hero-img, .case-full-img').forEach(img => {
    img.style.opacity = '0';
    img.style.transform = 'translateY(30px)';
    img.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)';

    const imgObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          imgObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    imgObs.observe(img);
  });

  /* ============ MOBILE MENU ============ */
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

  /* ============ HEADER SCROLL ============ */
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.background = 'transparent';
      header.style.backdropFilter = 'none';
      header.style.webkitBackdropFilter = 'none';
      header.style.mixBlendMode = 'difference';
    }, { passive: true });
  }

  /* ============ SMOOTH ANCHORS ============ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const id = this.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ============ CONTACT FORM ============ */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
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
    });
  }

});

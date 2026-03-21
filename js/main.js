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
          span.style.transitionDelay = (charIndex * 0.025) + 's';
          el.appendChild(span);
          charIndex++;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Preserve child elements (like <em>) but split their text too
        const clone = node.cloneNode(false);
        const innerText = node.textContent;
        for (let i = 0; i < innerText.length; i++) {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = innerText[i] === ' ' ? '\u00A0' : innerText[i];
          span.style.transitionDelay = (charIndex * 0.025) + 's';
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

  /* ============ LOADER (homepage only) ============ */
  const loader = document.getElementById('loader');
  if (loader) {
    const loaderBar = document.getElementById('loaderBar');
    const loaderPercent = document.getElementById('loaderPercent');
    let progress = 0;
    document.body.style.overflow = 'hidden';

    const loadInterval = setInterval(() => {
      progress += Math.random() * 12 + 3;
      if (progress >= 100) {
        progress = 100;
        clearInterval(loadInterval);
        setTimeout(() => {
          loader.classList.add('hidden');
          document.body.style.overflow = '';
          animateHero();
        }, 500);
      }
      if (loaderBar) loaderBar.style.width = progress + '%';
      if (loaderPercent) loaderPercent.textContent = Math.floor(progress) + '%';
    }, 120);
  }

  /* ============ HERO ANIMATION ============ */
  function animateHero() {
    const headline = document.querySelector('.hero-headline');
    const meta = document.querySelector('.hero-meta');

    [headline, meta].forEach((el, i) => {
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(25px)';
        el.style.transition = `opacity 1s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.25}s, transform 1s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.25}s`;
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      }
    });
  }

  /* ============ PAGE HERO ANIMATION (inner pages) ============ */
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
      children.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    }, 50);
  }

  // Studio hero — badge fades in, then chars animate
  if (studioHero && !loader) {
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

  /* ============ WORKS SPLIT — entrance animations ============ */
  const worksLeft = document.querySelector('.works-left');
  if (worksLeft && !loader) {
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
      if (window.scrollY > 80) {
        header.style.background = 'rgba(0,0,0,0.9)';
        header.style.backdropFilter = 'blur(20px)';
        header.style.webkitBackdropFilter = 'blur(20px)';
        header.style.mixBlendMode = 'normal';
      } else {
        header.style.background = 'transparent';
        header.style.backdropFilter = 'none';
        header.style.webkitBackdropFilter = 'none';
        header.style.mixBlendMode = 'difference';
      }
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

/* =====================================================================
   Smoke renderer — used twice on every page:
     1. Inside the menu overlay (fades in as the menu opens).
     2. Inside a full-screen page-transition overlay (covers between any
        two pages so navigation always looks like the same zoom-in /
        zoom-out smoke).

   Public API (attached to window):
     MenuShader.start()  // called by js/main.js on menu open
     MenuShader.stop()   // called by js/main.js on menu close

   The page-transition layer is fully self-contained — it intercepts
   internal `<a>` clicks in the capture phase and drives the transition
   itself, using sessionStorage to hand the "we just arrived" signal
   over to the new page.
   ===================================================================== */
(function () {
  if (typeof THREE === 'undefined') return;

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;

    varying vec2 vUv;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform vec2  uMouse;
    uniform float uDepth;

    const vec3 PAPER = vec3(0.937, 0.922, 0.898);
    const vec3 INK   = vec3(0.090, 0.082, 0.071);

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.05;
        a *= 0.5;
      }
      return v;
    }

    float field(vec2 uv, vec2 m, float t) {
      vec2 q = uv + vec2(
        fbm(uv + vec2(0.0, t * 0.06)),
        fbm(uv + vec2(5.2, -t * 0.05))
      );
      float d = length(uv - m);
      vec2 stir = (uv - m) * exp(-d * 3.5) * 0.35 * uDepth;
      q += stir;
      vec2 r = q + vec2(
        fbm(q + vec2(1.7, 9.2) + t * 0.04),
        fbm(q + vec2(8.3, 2.8) - t * 0.03)
      );
      return fbm(r);
    }

    void main() {
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      float scale = mix(7.5, 2.2, uDepth);
      vec2 uv = (vUv - 0.5) * aspect * scale;
      vec2 m  = (uMouse - 0.5) * aspect * scale;
      float t = uTime;

      float f = field(uv, m, t);
      float k = smoothstep(0.30, 0.78, f);
      vec3 col = mix(PAPER, INK, k * 0.55 * uDepth);

      float md = length(uv - m);
      float ir = exp(-md * 4.0) * 0.10 * uDepth;
      if (ir > 0.001) {
        float fr = field(uv + vec2( 0.012, 0.0), m, t);
        float fb = field(uv + vec2(-0.012, 0.0), m, t);
        vec3  shimmer = vec3(
          mix(PAPER.r, INK.r, smoothstep(0.30, 0.78, fr) * 0.55),
          col.g,
          mix(PAPER.b, INK.b, smoothstep(0.30, 0.78, fb) * 0.55)
        );
        col = mix(col, shimmer, ir);
      }

      float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.018 * uDepth;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------- Shared smoke factory ------------------- */
  function createSmoke(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
        uDepth:      { value: 0 },
      },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    let depth = 0;
    let depthTarget = 0;
    let arriveFactor = 0.04;
    let recedeFactor = 0.10;

    // Shared time reference + last-known mouse via sessionStorage so the
    // noise field stays visually continuous across page navigations and
    // across the menu/transition canvases on the same page.
    let timeOrigin = parseInt(sessionStorage.getItem('amfSmokeT'), 10);
    if (!Number.isFinite(timeOrigin)) {
      timeOrigin = Date.now();
      sessionStorage.setItem('amfSmokeT', String(timeOrigin));
    }
    let mouse = { x: 0.5, y: 0.5 };
    try {
      const stored = sessionStorage.getItem('amfSmokeM');
      if (stored) { const m = JSON.parse(stored); mouse.x = +m.x; mouse.y = +m.y; }
    } catch (e) {}
    let mouseTarget = { x: mouse.x, y: mouse.y };

    let running = false;
    let rafId = 0;

    function size() {
      const w = canvas.clientWidth  || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      material.uniforms.uResolution.value.set(canvas.width, canvas.height);
    }

    function loop() {
      if (!running) return;
      const now = (Date.now() - timeOrigin) / 1000;

      mouse.x += (mouseTarget.x - mouse.x) * 0.08;
      mouse.y += (mouseTarget.y - mouse.y) * 0.08;

      const factor = depthTarget > depth ? arriveFactor : recedeFactor;
      depth += (depthTarget - depth) * factor;

      material.uniforms.uTime.value = now;
      material.uniforms.uMouse.value.set(mouse.x, mouse.y);
      material.uniforms.uDepth.value = depth;
      renderer.render(scene, camera);

      if (depthTarget === 0 && depth < 0.005) {
        running = false;
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(loop);
    }

    function ensureRunning() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    }

    function setDepth(target, opts) {
      depthTarget = target;
      if (opts) {
        if (typeof opts.arriveFactor === 'number') arriveFactor = opts.arriveFactor;
        if (typeof opts.recedeFactor === 'number') recedeFactor = opts.recedeFactor;
        if (opts.immediate) {
          depth = target;
          material.uniforms.uDepth.value = depth;
          // Render the new state synchronously so the canvas shows the
          // smoke at the new depth on this same paint — avoids a paper-
          // flat frame between menu-shader.js running and the first rAF.
          material.uniforms.uTime.value = (Date.now() - timeOrigin) / 1000;
          material.uniforms.uMouse.value.set(mouse.x, mouse.y);
          material.uniforms.uResolution.value.set(canvas.width, canvas.height);
          renderer.render(scene, camera);
        }
      }
      ensureRunning();
    }

    let mouseWriteAt = 0;
    function setMouse(x, y) {
      mouseTarget.x = x;
      mouseTarget.y = y;
      // Persist for cross-page continuity, throttled to avoid spamming
      // sessionStorage on every pointermove event.
      const t = Date.now();
      if (t - mouseWriteAt > 80) {
        mouseWriteAt = t;
        sessionStorage.setItem('amfSmokeM', JSON.stringify({ x, y }));
      }
    }

    window.addEventListener('resize', () => size(), { passive: true });
    size();

    return { setDepth, setMouse, size };
  }

  /* ------------------- Menu shader ------------------- */
  let menuSmoke = null;
  let menuOverlayEl = null;
  let menuCloseTimer = null;
  const MENU_CLOSE_DELAY_MS = 400;

  function ensureMenuSmoke() {
    if (reducedMotion) return null;
    if (menuSmoke) return menuSmoke;
    menuOverlayEl = document.getElementById('menuOverlay')
      || document.querySelector('.menu-overlay');
    if (!menuOverlayEl) return null;
    const c = document.createElement('canvas');
    c.className = 'menu-shader-canvas';
    c.setAttribute('aria-hidden', 'true');
    menuOverlayEl.insertBefore(c, menuOverlayEl.firstChild);
    menuSmoke = createSmoke(c);
    menuOverlayEl.addEventListener('pointermove', (e) => {
      const r = menuOverlayEl.getBoundingClientRect();
      menuSmoke.setMouse(
        (e.clientX - r.left) / r.width,
        1.0 - (e.clientY - r.top) / r.height
      );
    }, { passive: true });
    return menuSmoke;
  }

  window.MenuShader = {
    start() {
      if (reducedMotion) return;
      const s = ensureMenuSmoke();
      if (!s) return;
      if (menuCloseTimer) { clearTimeout(menuCloseTimer); menuCloseTimer = null; }
      s.setDepth(1, { arriveFactor: 0.04, recedeFactor: 0.10, resetTime: true });
    },
    stop() {
      if (!menuSmoke) return;
      if (menuCloseTimer) clearTimeout(menuCloseTimer);
      menuCloseTimer = setTimeout(() => {
        menuSmoke.setDepth(0);
        menuCloseTimer = null;
      }, MENU_CLOSE_DELAY_MS);
    }
  };

  /* ------------------- Submenu injector ------------------- */
  (function injectSubmenu() {
    const list = document.querySelector('#menuOverlay .menu-overlay-list');
    if (!list) return;
    const workLi = list.firstElementChild;
    if (!workLi || workLi.classList.contains('has-submenu')) return;
    const workLink = workLi.querySelector('a');
    if (!workLink || !/work\.html$/i.test(workLink.getAttribute('href') || '')) return;

    const path = window.location.pathname;
    const projPrefix =
      path.includes('/work/')     ? ''            :
      path.includes('/services/') ? '../../work/' :
                                    'work/';
    const assetPrefix =
      path.includes('/work/')     ? '../assets/'    :
      path.includes('/services/') ? '../../assets/' :
                                    'assets/';

    const wix = (slug, ext) =>
      'https://static.wixstatic.com/media/' + slug + '/v1/fill/w_900,h_560,al_c,q_85/image.' + ext;

    const PROJECTS = [
      ['rep-materials.html',    '01', 'Rep Materials Co.',                wix('1f7c26_7c659f0d2eb04829b2dbc0ffc7a16160~mv2.jpg',  'jpg')],
      ['zuma-lighting.html',    '02', 'Zuma Lighting',                    wix('1f7c26_a0fa6951377940a69f23ff743cbc1615~mv2.jpeg', 'jpg')],
      ['luxxev.html',           '03', 'LUXXEV',                           wix('1f7c26_77672e88ad814f4da0616bdb7f153133~mv2.jpeg', 'jpg')],
      ['clif-kid.html',         '04', 'CLIF KID',                         wix('1f7c26_6d025a7a72c04f848e1735face0b2826~mv2.png',  'png')],
      ['therasurf.html',        '05', 'THERAsurf',                        wix('1f7c26_f10586a72d9541eaa93616084c133358~mv2.jpg',  'jpg')],
      ['johnson-johnson.html',  '06', 'Johnson & Johnson',                assetPrefix + 'work/johnson-johnson-hero.png'],
      ['obama-fatherhood.html', '07', 'A Conversation About Fatherhood',  assetPrefix + 'work/obama-fatherhood-hero.png'],
      ['fab-tech.html',         '08', 'Fab Tech',                         wix('1f7c26_4e7fa9745ca2452cbeaedad443a8ef23~mv2.jpeg', 'jpg')],
      ['custom-packaging.html', '09', 'Custom Packaging',                 wix('1f7c26_03d7e8e8aee649d6bd9273916c969a4a~mv2.png',  'png')],
    ];

    workLi.classList.add('has-submenu');
    const wrap = document.createElement('div');
    wrap.className = 'menu-submenu-wrap';

    const sub = document.createElement('ol');
    sub.className = 'menu-submenu';
    sub.setAttribute('aria-label', 'Projects');
    PROJECTS.forEach(([file, num, name, hero]) => {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = projPrefix + file;
      a.dataset.hero = hero;
      a.innerHTML =
        '<span class="menu-submenu-num">' + num + '</span>' +
        '<span class="menu-submenu-name">' + name + '</span>';
      li.appendChild(a);
      sub.appendChild(li);
    });
    wrap.appendChild(sub);

    const preview = document.createElement('div');
    preview.className = 'menu-submenu-preview';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    preview.appendChild(img);
    wrap.appendChild(preview);

    workLi.appendChild(wrap);

    sub.querySelectorAll('a').forEach((a) => {
      a.addEventListener('mouseenter', () => {
        if (img.getAttribute('src') !== a.dataset.hero) img.setAttribute('src', a.dataset.hero);
        preview.classList.add('is-active');
      });
      a.addEventListener('focus', () => {
        if (img.getAttribute('src') !== a.dataset.hero) img.setAttribute('src', a.dataset.hero);
        preview.classList.add('is-active');
      });
    });
    workLi.addEventListener('mouseleave', () => {
      preview.classList.remove('is-active');
    });
  })();

  /* ------------------- Page transition ------------------- */
  let transSmoke = null;
  let transEl = null;
  const TRANSITION_KEY = 'amfTransition';
  // Unified with the menu's open/close pace so every transition reads
  // the same. Smoke advances over ~1.2s and recedes over ~0.6s after a
  // 400ms hold — mirrors .menu-overlay's CSS transitions and the
  // MENU_CLOSE_DELAY_MS above.
  const OUT_DURATION_MS = 1200;
  const RECEDE_DELAY_MS = 400;

  function ensureTransition() {
    if (reducedMotion) return null;
    if (transSmoke) return transSmoke;
    transEl = document.createElement('div');
    transEl.className = 'page-transition';
    transEl.setAttribute('aria-hidden', 'true');
    const c = document.createElement('canvas');
    c.className = 'page-transition-canvas';
    transEl.appendChild(c);
    document.body.appendChild(transEl);
    transSmoke = createSmoke(c);
    transSmoke.size();
    return transSmoke;
  }

  function isInternalLink(a) {
    const href = a.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    try {
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return false;
      // Same page, no hash change — skip.
      if (url.pathname === location.pathname && url.search === location.search && !url.hash) return false;
      return true;
    } catch (e) { return false; }
  }

  function navigateWithTransition(href) {
    if (reducedMotion) { window.location.href = href; return; }
    const s = ensureTransition();
    if (!s) { window.location.href = href; return; }

    sessionStorage.setItem(TRANSITION_KEY, '1');

    // If the hamburger menu is already open, the smoke is already
    // covering. Skip the entry phase; just fade the menu words out
    // first so they don't snap to nothing on page unload, then
    // navigate. The new page handles the zoom-out.
    const menuOpen = menuOverlayEl && menuOverlayEl.classList.contains('is-open');
    if (menuOpen) {
      menuOverlayEl.classList.add('is-navigating');
      setTimeout(() => { window.location.href = href; }, 400);
      return;
    }

    // Fresh navigation from page content: full zoom-in, then navigate.
    transEl.classList.add('is-in');
    s.setDepth(1, { arriveFactor: 0.04, resetTime: true });
    setTimeout(() => { window.location.href = href; }, OUT_DURATION_MS);
  }

  // Arrival from a transition: overlay must be visible on the first
  // paint without animating in (otherwise the new page would flash for
  // 1.2s). Use .is-arriving (transition:none, opacity:1, smoke at full)
  // for the initial frame, then swap to .is-out so the exit transition
  // takes over.
  if (sessionStorage.getItem(TRANSITION_KEY) && !reducedMotion) {
    sessionStorage.removeItem(TRANSITION_KEY);
    const s = ensureTransition();
    if (s) {
      transEl.classList.add('is-arriving');
      s.setDepth(1, { immediate: true, resetTime: true });
      // The page-transition canvas is now covering, so the early
      // paper cover (set by the inline <head> script for FOUC
      // prevention) can come off.
      document.documentElement.classList.remove('amf-transitioning');
      setTimeout(() => {
        // Same recede factor as MenuShader.stop → identical pull-back pace.
        s.setDepth(0, { recedeFactor: 0.10 });
        transEl.classList.remove('is-arriving');
        transEl.classList.add('is-out');
        // 0.4s delay + 0.6s fade = 1.0s; small buffer before cleanup.
        setTimeout(() => transEl.classList.remove('is-out'), 1200);
      }, RECEDE_DELAY_MS);
    }
  }

  // Capture-phase click interceptor — every internal nav goes through the
  // transition. Capture phase + stopImmediatePropagation means other
  // anchor click handlers (e.g. main.js menu close) don't fire and the
  // browser doesn't navigate yet.
  document.addEventListener('click', (e) => {
    if (reducedMotion) return;
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    const a = e.target.closest && e.target.closest('a');
    if (!a || !isInternalLink(a)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    navigateWithTransition(a.href);
  }, true);
})();

/* =====================================================================
   Smoke renderer — single instance, inside the menu overlay.

   The full-screen menu overlay paints a translucent ink-on-plaster smoke
   field while the menu is open. The canvas is alpha:true and outputs
   `vec4(INK, density)` so the live shader-bg plaster wall (with normal
   map + lighting + relief sculptures) shows through wherever the smoke
   is sparse. The wall stays visible behind the menu the whole time.

   Public API (called by js/main.js's menu open/close):
     window.MenuShader.start()
     window.MenuShader.stop()

   Page transitions are NOT handled here — the SPA router in js/router.js
   intercepts links, swaps <main> in place, and tells shader-bg to swap
   reliefs against the same wall. There is no page-unload, so there is
   no cover, no snapshot, and no click interceptor in this file.
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

    const vec3 PAPER = vec3(0.9451, 0.9294, 0.9059);
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
      // density is the alpha — where smoke is sparse the canvas is
      // transparent, letting the shader-bg plaster wall show through.
      float density = k * 0.55 * uDepth;

      vec3 col = INK;

      float md = length(uv - m);
      float ir = exp(-md * 4.0) * 0.10 * uDepth;
      if (ir > 0.001) {
        float fr = field(uv + vec2( 0.012, 0.0), m, t);
        float fb = field(uv + vec2(-0.012, 0.0), m, t);
        vec3  shimmer = vec3(
          mix(INK.r, PAPER.r, smoothstep(0.30, 0.78, fr) * 0.55),
          INK.g,
          mix(INK.b, PAPER.b, smoothstep(0.30, 0.78, fb) * 0.55)
        );
        col = mix(col, shimmer, ir);
      }

      float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.018 * uDepth;

      gl_FragColor = vec4(col, density);
    }
  `;

  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------- Smoke factory ------------------- */
  function createSmoke(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);

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

    const timeOrigin = Date.now();
    let mouse = { x: 0.5, y: 0.5 };
    let mouseTarget = { x: 0.5, y: 0.5 };

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
      }
      ensureRunning();
    }

    function setMouse(x, y) {
      mouseTarget.x = x;
      mouseTarget.y = y;
    }

    window.addEventListener('resize', () => size(), { passive: true });
    size();

    return { setDepth, setMouse, size };
  }

  /* ------------------- Menu shader instance ------------------- */
  let menuSmoke = null;
  let menuOverlayEl = null;
  let menuCloseTimer = null;
  const MENU_CLOSE_DELAY_MS = 0;

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
      s.setDepth(1, { arriveFactor: 0.04, recedeFactor: 0.04 });
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

  /* ------------------- Submenu injector -------------------
     Builds the Work submenu inside the menu overlay. The menu overlay
     itself is persistent across SPA navigation, so this only runs once
     per page load. URLs are absolute so they resolve correctly from
     any current URL after a pushState. */
  (function injectSubmenu() {
    const list = document.querySelector('#menuOverlay .menu-overlay-list');
    if (!list) return;
    const workLink = Array.from(list.querySelectorAll('a')).find(
      (a) => /work\.html$/i.test(a.getAttribute('href') || '')
    );
    if (!workLink) return;
    const workLi = workLink.closest('li');
    if (!workLi || workLi.classList.contains('has-submenu')) return;

    const wix = (slug, ext) =>
      'https://static.wixstatic.com/media/' + slug + '/v1/fill/w_900,h_560,al_c,q_85/image.' + ext;

    const PROJECTS = [
      ['/work/clif-kid.html',         '01', 'CLIF KID',                         wix('1f7c26_6d025a7a72c04f848e1735face0b2826~mv2.png',  'png')],
      ['/work/johnson-johnson.html',  '02', 'Johnson & Johnson',                '/assets/work/johnson-johnson-hero.png'],
      ['/work/obama-fatherhood.html', '03', 'The Obama Foundation',  '/assets/work/obama-fatherhood-hero.png'],
      ['/work/rep-materials.html',    '04', 'Rep Materials Co.',                wix('1f7c26_7c659f0d2eb04829b2dbc0ffc7a16160~mv2.jpg',  'jpg')],
      ['/work/zuma-lighting.html',    '05', 'Zuma Lighting',                    wix('1f7c26_a0fa6951377940a69f23ff743cbc1615~mv2.jpeg', 'jpg')],
      ['/work/luxxev.html',           '06', 'LUXXEV',                           wix('1f7c26_77672e88ad814f4da0616bdb7f153133~mv2.jpeg', 'jpg')],
      ['/work/fab-tech.html',         '07', 'Fab Tech',                         wix('1f7c26_4e7fa9745ca2452cbeaedad443a8ef23~mv2.jpeg', 'jpg')],
      ['/work/therasurf.html',        '08', 'THERAsurf',                        wix('1f7c26_f10586a72d9541eaa93616084c133358~mv2.jpg',  'jpg')],
      ['/work/custom-packaging.html', '09', 'Custom Packaging',                 wix('1f7c26_03d7e8e8aee649d6bd9273916c969a4a~mv2.png',  'png')],
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
      a.href = file;
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
})();

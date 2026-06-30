/* ========================================
   A MEASURED FORCE — Cursor-lit Ruins Wall
   Three.js scene. A plaster wall with fragments of ancient
   marble sculpture half-embedded in it. A short-range point
   light tracks the cursor; carvings "emerge" where the light
   grazes them.
   ======================================== */

(function () {
  const canvas = document.getElementById('shaderBg');
  if (!canvas) return;
  if (!window.THREE) return;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, preserveDrawingBuffer: true,
  });
  // Cap device-pixel-ratio lower on phones/tablets — rendering the relief
  // meshes at 2-3x on a mobile GPU tanks the frame rate and makes scroll stutter.
  const _narrowDevice =
    window.innerWidth <= 900 || window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, _narrowDevice ? 1.25 : 2));

  // Largest plausible viewport height (URL bar retracted). Locked on mobile so
  // the URL bar sliding in/out during scroll can't resize the canvas and
  // re-stretch the scene. Desktop just uses the live innerHeight.
  function stableHeight() {
    return _narrowDevice
      ? Math.max(window.innerHeight, document.documentElement.clientHeight, window.screen.height)
      : window.innerHeight;
  }
  let lockedW = window.innerWidth;

  // Mobile render-pause: keep the canvas a STATIC composited layer once the
  // scene settles, so iOS keeps it pinned during scroll (a fixed canvas that
  // repaints every frame is re-rasterized and drifts/judders with the swipe).
  // wake() opens a short render window after discrete changes (relief load,
  // page swap, resize, inverted toggle); sceneIsAnimating() keeps drawing while
  // an emerge/retreat/light transition is in flight. Desktop ignores all this
  // and renders every frame as before.
  let forceRenderUntil = 0;
  let mobileSettledFrame = false;
  function wake() {
    forceRenderUntil = performance.now() / 1000 + 0.3;
    mobileSettledFrame = false;
  }
  function sceneIsAnimating(tNow) {
    // Camera still easing toward the scroll target (parallax in flight).
    if (Math.abs(scrollCamY - camera.position.y) > 1e-3) return true;
    if (Math.abs(targetPos.x - currentPos.x) > 1e-3 ||
        Math.abs(targetPos.y - currentPos.y) > 1e-3 ||
        Math.abs(WALL_LIGHT_Z - currentPos.z) > 1e-3) return true;
    for (let i = 0; i < emerging.length; i++) {
      const e = emerging[i].userData.emerge;
      if (!e) continue;
      if (e.retreatStart >= 0 && (tNow - e.retreatStart) / e.retreatDuration < 1) return true;
      if (e.startTime >= 0 && !e.done) return true;
    }
    // Mobile floating light is always in gentle motion → keep drawing (it parks
    // only when a card is open or under reduced motion).
    if (NARROW && !cardOpen && !prefersReducedMotion) return true;
    // Lights still easing toward target (card dissipate / inverted fade) → draw.
    if (Math.abs(lightTarget.ambient - ambient.intensity) > 1e-3 ||
        Math.abs(lightTarget.hemi - hemi.intensity) > 1e-3 ||
        Math.abs(lightTarget.cursorIntensity - cursorLight.intensity) > 1e-3 ||
        Math.abs(lightTarget.cursorDist - cursorLight.distance) > 1e-3) return true;
    return false;
  }

  renderer.setSize(window.innerWidth, stableHeight());
  renderer.setClearColor(0xf1ede7, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42, window.innerWidth / stableHeight(), 0.1, 100
  );
  camera.position.set(0, 0, 6);

  /* ---- Wall plane (plaster) ---- */
  // The wall's normal-map JPG loads async, so the first paint shows a flat wall
  // that then "snaps" to textured when it arrives. Hide the canvas until the
  // texture is in + a textured frame has rendered, then fade it in — masking the
  // staged load. Applied on all devices.
  let canvasRevealed = false;
  function revealCanvas() {
    if (canvasRevealed) return;
    canvasRevealed = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = '1'; }));
  }
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.9s ease';
  setTimeout(revealCanvas, 1400);   // fallback if the texture is cached/fails

  const texLoader = new THREE.TextureLoader();
  const normal = texLoader.load('/assets/wall-normal.jpg', () => { wake(); revealCanvas(); });
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const wallMat = new THREE.MeshStandardMaterial({
    normalMap: normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0xf1ede7,
    roughness: 0.95,
    metalness: 0.0,
  });

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), wallMat);
  scene.add(wall);

  function visibleAtZ(z) {
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const h = 2 * Math.tan(fovRad / 2) * Math.abs(camera.position.z - z);
    return { w: h * camera.aspect, h };
  }

  function fitWall() {
    const v = visibleAtZ(0);
    wall.scale.set(v.w * 1.15, v.h * 1.15, 1);
    const repeatX = (v.w * 1.15) / 3.5;
    const repeatY = (v.h * 1.15) / 3.5;
    normal.repeat.set(repeatX, repeatY);
  }

  /* ---- Relief material (no plaster normalMap — the carved geometry
         itself gives the detail; a tiled normalMap would muddy it). ---- */
  const reliefMat = new THREE.MeshStandardMaterial({
    color: 0xe8e3db,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  // Faceted variant — opt-in per relief (cfg.flatShade) to give a smooth,
  // low-detail sculpt crisp surface definition so its planes catch the
  // raking cursor light like the high-detail scans do.
  const reliefMatFlat = reliefMat.clone();
  reliefMatFlat.flatShading = true;

  /* ---- Load the ruins fragments ---- */
  // Each entry: file, target diameter in world units, flatten-z factor,
  // world x,y, rotation-z, extra-rotation-x (tilt into wall).
  // One large fragment per scroll "band" (≈ one viewport of scroll). The head
  // anchors the hero; as the user scrolls, it drifts up and off-screen and
  // the next fragment comes in from below.
  const VIEWPORT_WORLD_H = 4.6;   // rough world-space height of one viewport
  const fragmentsByPage = {
    home: [
      { src: '/assets/reliefs/goat.glb',           size: 7.0, flat: 0.35, x:  1.0, y: -0.6, z: 0.185,                rz: 0.0, rx: 0.0,      ry: 0.0,
        mobile: { x: 0.8, y: -0.1, z: 0.25, size: 4.7 },
        meta: { name: 'Statue of Resting Goat', artist: 'Caelius Slaterius', period: '3rd century BC', material: 'Marble', location: 'Fondazione Torlonia, Italy' } },
      { src: '/assets/reliefs/oceanus.glb',        size: 6.0, flat: 0.22, x: -1.5, y: -VIEWPORT_WORLD_H * 1.0 - 3.5, z: 0.6, rz: 0.0, rx: Math.PI, ry: 0.0,
        mobile: { x: 0.5, y: -7.5, z: 0.3, size: 5.0 },
        meta: { name: 'Oceanus', artist: 'Caspar Gras', period: '1622/30', material: 'Bronze', location: 'Ferdinandeum Innsbruck, Austria' } },
      { src: '/assets/reliefs/nymph.glb',          size: 6.0, flat: 0.35, x: -3.0, y: -VIEWPORT_WORLD_H * 7.5 - 2,   z: 0.3, rz: 0.0, rx: 0.0,      ry: Math.PI / 2,
        mobile: { x: -1.0, y: -VIEWPORT_WORLD_H * 9.0 - 6.5, z: 0.3, size: 6.0 },
        meta: { name: 'Nymph Preparing for the Bath', artist: 'John Gibson', period: '19th century', material: 'Marble', location: 'The Usher Gallery, Lincoln, UK' } },
      { src: '/assets/reliefs/puck.glb',           size: 6.0, flat: 0.23, x:  2.5, y: -VIEWPORT_WORLD_H * 5.5 - 4,   z: 0.25, rz: 0.0, rx: -Math.PI / 2, ry: 0.0,
        mobile: { x: 0.2, y: -VIEWPORT_WORLD_H * 5.5 - 4, z: 0.05, size: 6.3 },
        meta: { name: 'Puck', artist: 'Harriet Hosmer', period: '1856', material: 'Marble', location: 'Walker Art Gallery, UK' } },
    ],
    contact: [
      { src: '/assets/reliefs/triton.glb',  size: 6.5, flat: 0.13, x:  2.0, y: -2.0, mobileY: -1.5,           z:  0.25, rz: 0.0, rx: Math.PI, ry: 0.0,
        meta: { name: 'Triton', artist: 'Caspar Gras', period: '1622/30', material: 'Bronze', location: 'Ferdinandeum Innsbruck, Austria' } },
    ],
    about: [
      { src: '/assets/reliefs/athena.glb',     size: 10.0, flat: 0.22, x:  1.5, y: -3.0, mobileY: -2.5, mobileScale: 1.3, z:  0.25, rz: Math.PI + 0.06, rx:  0.30, ry: Math.PI,
        meta: { name: 'Athena (Minerva of Arezzo)', artist: 'Unknown', period: '300–270 BCE', material: 'Bronze', location: 'Museo Archeologico Nazionale, Italy' } },
      { src: '/assets/reliefs/pan.glb',        size: 11.5, flat: 0.22, x: -1.5, mobileX: -1.0, y: -VIEWPORT_WORLD_H * 4.2 + 1.3, mobileY: -VIEWPORT_WORLD_H * 5.6 - 0.5, mobileDX: -1.2, emergeMargin: -1.5, z:  0.25, rz: 0.06, rx:  0.20, ry: Math.PI / 2 - 0.2,
        meta: { name: 'Pan et Oursons', artist: 'Emmanuel Fremiet', period: '1867', material: 'Marble', location: 'Musée d’Orsay, Paris, France' } },
      { src: '/assets/reliefs/bosio.glb',      size: 6.0,  flat: 0.22, x:  2.6, y: -VIEWPORT_WORLD_H * 3.0 + 2.0, mobileScale: 1.5, mobileDX: -0.3, z:  0.25, rz: Math.PI, rx:  0.0, ry: -Math.PI / 6, flatShade: true,
        meta: { name: 'La Nymphe Salmacis', artist: 'François Joseph Bosio', period: '1819–1837', material: 'Marble', location: 'Nouveau Musée National de Monaco, Monaco' } },
    ],
    work: [
      { src: '/assets/reliefs/cupid.glb',      size: 6.5, flat: 0.32, x: -1.5, y: -1.2, mobileDX: 0.7, mobileY: -0.5, mobileMirror: true, mobilePin: { startY: 5, endY: -400, offsetY: -0.5 }, z:  0.25, rz: Math.PI / 2, rx: -Math.PI / 2, ry: -Math.PI / 2, mirror: true,
        meta: { name: 'Cupid Disguised as a Shepherd', artist: 'John Gibson', period: 'Early 1840s', material: 'Marble', location: 'Walker Art Gallery, UK' } },
    ],
    ai: [
      { src: '/assets/reliefs/mercury.glb',    size: 5.0, flat: 0.25, x: 2.0, y: -0.5, mobileY: -0.3, mobileScale: 1.15, mobileZ: 0.2, z:  0.25, rz: 0.0, rx: 0.0, ry: Math.PI,
        meta: { name: 'Mercury', artist: 'Joseph Nollekens', period: '18th century', material: 'Marble', location: 'The Usher Gallery, Lincoln, UK' } },
      { src: '/assets/reliefs/vacossin.glb',   size: 6.0, flat: 0.25, x: -2.0, y: -VIEWPORT_WORLD_H * 2.0 + 2.5, mobileY: -5.3, mobileDX: -1.0, emergeMargin: 0.5, z:  0.25, rz: 0.0, rx: 0.0, ry: 0.0,
        meta: { name: 'Deux chiens de meute à l’attache', artist: 'Georges Lucien Vacossin', period: '1911', material: '', location: 'Dépôt des sculptures de la Ville de Paris, France' } },
      { src: '/assets/reliefs/bearded-man.glb', size: 5.0, flat: 0.25, x: 2.5, y: -VIEWPORT_WORLD_H * 4.0,        z:  0.25, rz: 0.0, rx: Math.PI, ry: Math.PI - Math.PI / 3,
        mobileY: -14,
        emergeMargin: -1.6,   // delay the rise until we're into the Approach section
        pin: { startY: -VIEWPORT_WORLD_H * 4.0, endY: -VIEWPORT_WORLD_H * 7.0, offsetY: 0 },
        mobilePin: { startY: -11, endY: -17, offsetY: 0 },
        meta: { name: 'Portrait of a Bearded Man', artist: 'Unknown', period: 'c. 150 B.C.', material: 'Marble', location: 'The J. Paul Getty Museum, USA' } },
      { src: '/assets/reliefs/fullbody.glb',   size: 9.0, flat: 0.25, x: 1.5, y: -VIEWPORT_WORLD_H * 10.0 - 6.5,  z:  0.25, rz: 0.0, rx: Math.PI, ry: 0.0,
        meta: { name: 'Theodoric the Great', artist: 'Peter Vischer the Elder (after Dürer)', period: '1512–13', material: 'Bronze', location: 'Court Church Innsbruck, Austria' } },
    ],
  };

  // Center, scale, and flatten one loaded GLB scene into a mesh that sits
  // half-embedded in the wall plane (center at z=0).
  function prepareFragment(gltf, cfg) {
    const group = gltf.scene || gltf.scenes[0];
    group.traverse((o) => {
      if (o.isMesh) {
        o.material = cfg.flatShade ? reliefMatFlat : reliefMat;
        // gltfpack's meshopt filter can strip vertex normals → pitch-black
        // lighting. Recompute them from face winding.
        if (o.geometry) {
          o.geometry.computeVertexNormals();
          o.geometry.normalizeNormals && o.geometry.normalizeNormals();
        }
      }
    });

    // Apply the orientation rotation to the inner group FIRST, so the
    // holder's subsequent Z-flatten operates on the correct (camera-facing)
    // axis of the rotated geometry.
    group.rotation.x = cfg.rx || 0;
    group.rotation.y = cfg.ry || 0;

    const holder = new THREE.Group();
    holder.add(group);

    // Compute bbox AFTER inner rotation so size.xyz reflect the oriented mesh.
    const box = new THREE.Box3().setFromObject(holder);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    group.position.sub(center);

    // Face-on silhouette scaling + flatten-z for the embedded relief look.
    // cfg.mirror flips horizontally without spinning the sculpture into the
    // wall — keeps the detailed side toward the camera.
    const faceExtent = Math.max(size.x, size.y);
    // A relief may carry an explicit `mobile: { x, y, z, size }` override used on
    // narrow/touch viewports (for hero pieces we want deliberately placed).
    const mob = (NARROW && cfg.mobile) ? cfg.mobile : null;
    const sizeUsed = (mob && mob.size != null) ? mob.size : cfg.size;
    const s = sizeUsed / (faceExtent || 1);
    holder.scale.set(cfg.mirror ? -s : s, s, s * cfg.flat);

    // Narrow/touch viewports: the camera sees a far thinner slice of the world,
    // so desktop-tuned x positions land off the edges / over the text. With an
    // explicit `mobile` override, use it; otherwise pull the relief toward
    // center, shrink it, and sit it near the wall as a faint backdrop.
    let effX = cfg.x;
    let effY = cfg.y;
    let effZ = cfg.z || 0;
    if (mob) {
      if (mob.x != null) effX = mob.x;
      if (mob.y != null) effY = mob.y;
      effZ = (mob.z != null) ? mob.z : (cfg.z || 0);
    } else if (NARROW) {
      const xScale = Math.min(1, visibleAtZ(0).w / 7.2);  // 7.2 ≈ desktop visible width
      // cfg.mobileX lets a relief use a different x base on narrow viewports, so
      // a desktop-only x change doesn't drag the mobile auto-centered position.
      effX = (cfg.mobileX != null ? cfg.mobileX : cfg.x) * xScale;
      effZ = 0.05;                       // closer to the wall → flatter, subtler
      holder.scale.multiplyScalar(0.7);  // smaller so it doesn't crowd the column
      // Optional mobile-only nudges that keep the auto-center/shrink (unlike a
      // full `mobile` override). Desktop is untouched.
      if (cfg.mobileY != null) effY = cfg.mobileY;
      if (cfg.mobileDX != null) effX += cfg.mobileDX;  // nudge left/right in world units
      if (cfg.mobileZ != null) effZ = cfg.mobileZ;     // pull forward out of the wall
      if (cfg.mobileScale != null) holder.scale.multiplyScalar(cfg.mobileScale);
      // Flip facing on narrow/touch only (desktop keeps cfg.mirror). cupid's
      // axis-swapping rotations mean scale.x reads as upside-down, so flip Y.
      if (cfg.mobileMirror) holder.scale.y *= -1;
    }

    holder.position.set(effX, effY, effZ);
    holder.rotation.y = cfg.spin || 0;  // world-Y turntable spin
    holder.rotation.z = cfg.rz || 0;

    // Pin: when the camera Y is inside [pin.endY, pin.startY] (the world-Y
    // span of a page section), the relief sticks to the camera so it appears
    // fixed on screen while the surrounding content scrolls past. Outside
    // that range it parks at the nearest edge — entering from below as the
    // camera scrolls down into the section, and getting left behind above
    // after the camera scrolls out the bottom. Note pin.startY > pin.endY
    // because scrolling down makes camera.y more negative.
    // Mobile sections sit at different world-Y than desktop. On narrow viewports
    // a relief pins only if it declares a `mobilePin`; otherwise it scrolls/
    // parallaxes like the others (desktop keeps cfg.pin).
    const pinCfg = NARROW ? cfg.mobilePin : cfg.pin;
    if (pinCfg) {
      holder.userData.pin = pinCfg;
    }
    // Mobile-only emerge-trigger override (see the animate loop). Negative delays
    // the rise until the relief is well into view. Desktop keeps the default.
    if (NARROW && cfg.emergeMargin != null) holder.userData.emergeMargin = cfg.emergeMargin;

    // Emerge animation — start the holder deeper than its target z (fully behind
    // the opaque wall plane). The animate loop only begins easing it forward once
    // the sculpture scrolls into viewport, so each one rises as the user reaches
    // it. Skipped on reduced-motion. Mobile uses a shallower start + shorter
    // duration so the relief surfaces past the wall quickly (the deep desktop
    // rise spends ~1.9s hidden behind the wall before it's visible); desktop
    // keeps the slow, weighty rise.
    const targetZ = effZ;
    if (prefersReducedMotion) {
      holder.position.z = targetZ;
    } else {
      const emergeStartZ = targetZ - (NARROW ? 0.7 : 1.6);
      holder.userData.emerge = {
        startTime: -1,
        duration: NARROW ? 1.3 : 2.8,   // mobile surfaces quicker; desktop weighty
        startZ: emergeStartZ,
        targetZ: targetZ,
        done: false,
        // Retreat phase — kicked off by window.AMFShaderBg.retreatAllReliefs()
        // when the user clicks a menu link. Same z-track, reversed.
        retreatStart: -1,
        retreatDuration: 0,
        retreatFromZ: 0,
      };
      holder.position.z = emergeStartZ;
      emerging.push(holder);
    }

    // Interactive reliefs carry a `meta` block (name/artist/period/material/
    // location). Hovering one grows the cursor; clicking opens an info card
    // (see relief-info.js). Tracked in its own list so picking works even under
    // reduced-motion (where holders aren't pushed to `emerging`).
    if (cfg.meta) {
      holder.userData.meta = cfg.meta;
      interactiveReliefs.push(holder);
    }

    scene.add(holder);
    wake();  // a relief just loaded — draw its emerge (mobile may be paused)
    return holder;
  }
  const emerging = [];
  // Holders with a `meta` block — the raycast-pickable, clickable sculptures.
  const interactiveReliefs = [];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Relief world-x positions are tuned for the wide desktop camera. On narrow
  // (mobile/tablet) or touch viewports the camera sees a much narrower slice of
  // world space, so reliefs drift to the edges and clutter the full-width text.
  // We still show them there, but prepareFragment pulls them toward center,
  // shrinks them, and sits them near the wall so they read as a faint backdrop.
  const NARROW =
    window.innerWidth <= 900 || window.matchMedia('(pointer: coarse)').matches;

  // Map URL path → relief set key. Pages not listed get wall + cursor only.
  function pageKeyFromPath(path) {
    if (/\/services\/ai\/?(index\.html)?$/.test(path)) return 'ai';
    if (path === '/' || /\/index\.html?$/.test(path) || path === '/index') return 'home';
    if (/\/contact\.html?$/.test(path)) return 'contact';
    if (/\/about\.html?$/.test(path)) return 'about';
    if (/\/work\.html?$/.test(path)) return 'work';
    return null;
  }

  // Tear down a relief's GPU resources before removing it from the scene.
  // reliefMat is shared across all reliefs so we never dispose it here.
  function disposeReliefHolder(holder) {
    scene.remove(holder);
    holder.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  function clearReliefs() {
    for (let i = 0; i < emerging.length; i++) disposeReliefHolder(emerging[i]);
    emerging.length = 0;
    // Reduced-motion holders never enter `emerging` but may be interactive, so
    // dispose any still attached (the first loop already nulled the parents of
    // the animated ones), then reset the list.
    for (let i = 0; i < interactiveReliefs.length; i++) {
      if (interactiveReliefs[i].parent) disposeReliefHolder(interactiveReliefs[i]);
    }
    interactiveReliefs.length = 0;
  }

  // Generation counter guards against late GLB callbacks landing after the
  // user has already navigated to another page — a stale callback would
  // otherwise add an extra relief to the new scene.
  let loadGeneration = 0;
  // Fires 'amf:relief-emerged' once per page load when the first in-view relief
  // has surfaced past the wall — main.js uses it to sequence the about hero text
  // after the sculpture. Reset on each page's relief load.
  let heroEmergeSignaled = false;
  function loadReliefsForKey(pageKey) {
    const gen = ++loadGeneration;
    heroEmergeSignaled = false;
    const pageFragments = fragmentsByPage[pageKey] || [];
    if (!pageFragments.length || !THREE.GLTFLoader) return;
    const loader = new THREE.GLTFLoader();
    pageFragments.forEach((cfg) => {
      loader.load(
        cfg.src,
        (gltf) => { if (gen === loadGeneration) prepareFragment(gltf, cfg); },
        undefined,
        (err) => console.warn('[shader-bg] fragment load failed', cfg.src, err)
      );
    });
  }

  // Initial relief load for this page.
  loadReliefsForKey(pageKeyFromPath(window.location.pathname));

  /* ---- Lighting ---- */
  // Lower ambient so the cursor's directional shading reads as real depth
  // contrast (not just a brightness bump over flat fill).
  const ambient = new THREE.AmbientLight(0xffffff, 0.62);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xf4efe6, 0xb5aea1, 0.28);
  scene.add(hemi);

  // Cursor light sits slightly in front of the wall, grazing the normal-
  // mapped surface to produce a bright hot-spot that illuminates the relief.
  // Normal-mode cursor uses a softer intensity so the lit hot-spot doesn't
  // overexpose reliefs sitting on top of the bright ambient floor. Inverted
  // mode bumps it back up because there's no ambient competing.
  const WALL_LIGHT_Z = 0.6;
  const cursorLight = new THREE.PointLight(0xffffff, 0.6, 2.0, 1.6);
  cursorLight.position.set(0, 0, WALL_LIGHT_Z);
  scene.add(cursorLight);

  // Mobile floating-light state: with no cursor on touch, the light is a screen-
  // space object that starts at the top (on the goat's head, so its emerge from
  // the wall is lit) and immediately scans down and around the viewport. It is
  // NOT affected by touch. Driven in NDC and raycast onto the wall, so it's
  // always in the viewport.
  const HOME_NY = 0.0;          // float anchor (NDC; +1 top) — centred to scan all
  const WANDER_AX = 0.85;       // horizontal wander amplitude (wide sweep)
  const WANDER_AY = 0.8;        // vertical wander amplitude (scans the whole view)
  let lightNX = 0;              // eased horizontal NDC
  let lightNY = 0.8;            // eased vertical NDC — starts at the top (goat head)
  let cardOpen = false;         // mobile info-card open → freeze the floating light + park render
  let wanderStart = performance.now() / 1000;  // wander clock origin (scans from load)

  // First-load HOME entrance (both breakpoints): hold the light DARK until the hero
  // cascade (goat + both text lines) has faded in, then reveal it. main.js fires the
  // cue event once its cascade completes. Skipped under reduced motion / off home.
  //   • Mobile: the floating light is parked off-screen, then DROPS in from the top
  //     and hands off to the scan.
  //   • Desktop: the cursor light simply IGNITES (intensity ramps up) wherever the
  //     cursor already is — no positional move.
  const HOME_ENTRANCE =
    !prefersReducedMotion && pageKeyFromPath(window.location.pathname) === 'home';
  let entrance = HOME_ENTRANCE ? 'hold' : 'off';  // 'hold' | 'drop' | 'off'
  let dropStart = -1;          // perf-time (s) the reveal began
  let dropEase = 0;            // 0..1 eased reveal progress (drives the drop + ignite)
  const DROP_DUR = 1.1;        // seconds for the reveal
  window.addEventListener('amf:hero-entrance-done', function () {
    if (entrance === 'hold') { entrance = 'drop'; dropStart = performance.now() / 1000; wake(); }
  });
  // First-load home: the goat is the FINALE — hold its emerge buried until the intro
  // timeline fires 'amf:emerge-go'. Cleared on SPA nav (swapPage) so reliefs emerge
  // normally thereafter. Off the home page / reduced motion: never held.
  let holdHomeEmerge = HOME_ENTRANCE;
  window.addEventListener('amf:emerge-go', function () { holdHomeEmerge = false; wake(); });

  // "Lights off" mode — when the page is inverted, kill ambient/hemi so the
  // cursor becomes the only light source (flashlight in a dark room). The
  // cursor light's range is bumped so it still illuminates the reliefs clearly.
  // Lighting is now TARGET-based: refreshLightTarget() picks a preset and the
  // animate loop eases the live lights toward it (instant snap on desktop so
  // the desktop inverted toggle is unchanged). Opening a sculpture's info card
  // does NOT touch the lighting — the statue stays lit exactly as it was the
  // instant before the tap; only the surrounding page blurs (see relief-info.js).
  const LIGHT_DEFAULTS = {
    ambient: ambient.intensity,
    hemi: hemi.intensity,
    cursorIntensity: cursorLight.intensity,
    cursorDist: cursorLight.distance,
  };
  const lightTarget = {
    ambient: LIGHT_DEFAULTS.ambient,
    hemi: LIGHT_DEFAULTS.hemi,
    cursorIntensity: LIGHT_DEFAULTS.cursorIntensity,
    cursorDist: LIGHT_DEFAULTS.cursorDist,
  };
  function refreshLightTarget() {
    const inv = document.documentElement.classList.contains('inverted');
    if (inv) {
      lightTarget.ambient = 0.02;
      lightTarget.hemi = 0.02;
      lightTarget.cursorIntensity = 1.1;
      lightTarget.cursorDist = 3.2;
    } else {
      lightTarget.ambient = LIGHT_DEFAULTS.ambient;
      lightTarget.hemi = LIGHT_DEFAULTS.hemi;
      lightTarget.cursorIntensity = LIGHT_DEFAULTS.cursorIntensity;
      lightTarget.cursorDist = LIGHT_DEFAULTS.cursorDist;
    }
    wake();  // draw the transition frames (mobile may be paused)
  }
  // Class observer handles BOTH the inverted toggle and the mobile card
  // open/close (relief-info.js toggles html.relief-zoom-open).
  function onHtmlClassChange() {
    cardOpen = NARROW && document.documentElement.classList.contains('relief-zoom-open');
    refreshLightTarget();  // card-open dissipates the light; close restores it
  }
  // Seed live lights to the initial target instantly (no load-time fade) so the
  // mobile light is on and scanning from the first frame.
  refreshLightTarget();
  ambient.intensity     = lightTarget.ambient;
  hemi.intensity        = lightTarget.hemi;
  cursorLight.intensity = lightTarget.cursorIntensity;
  cursorLight.distance  = lightTarget.cursorDist;
  new MutationObserver(onHtmlClassChange).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class']
  });

  /* ---- Cursor tracking ---- */
  const mouse = new THREE.Vector2(0, 0);
  const targetPos = new THREE.Vector3();
  // Start the light already settled at the wall depth (centered) so there's no
  // load-time sweep from z=0 (a light on the wall plane makes a hard hotspot
  // edge — the "cut in half" flash on first paint).
  const currentPos = new THREE.Vector3(0, 0, 0.6);
  const raycaster = new THREE.Raycaster();
  const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  document.addEventListener('mousemove', (e) => {
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });


  /* ---- Relief picking (hover cursor + click-to-open info card) ---- */
  // A dedicated raycaster so relief picking never perturbs the cursor-light ray.
  const pickRay = new THREE.Raycaster();
  let lastReliefHoverId = 0;  // edge-trigger guard for hover enter/leave events

  // Return the interactive holder under NDC point {x,y}, or null. Only reliefs
  // that have surfaced enough to read (emerge done, or risen past ~60%) are
  // pickable, so you can't click one still buried behind the wall.
  function pickRelief(ndcX, ndcY) {
    if (!interactiveReliefs.length) return null;
    pickRay.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hits = pickRay.intersectObjects(interactiveReliefs, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o && !o.userData.meta && o.parent) o = o.parent;  // climb to holder
      if (!o || !o.userData.meta) continue;
      const e = o.userData.emerge;
      if (e) {
        if (e.startTime < 0) continue;  // not started rising yet → still buried
        if (!e.done) {
          const t = (performance.now() / 1000 - e.startTime) / e.duration;
          if (t < 0.6) continue;        // barely poking out → not yet clickable
        }
      }
      return o;  // reduced-motion holders have no `emerge` → always pickable
    }
    return null;
  }

  // Project a holder's world position to viewport pixels through the live
  // camera. Valid at open time because opening the card locks scroll, so the
  // camera Y stops easing and the projected point stays put.
  const _projV = new THREE.Vector3();
  function reliefScreenPos(holder) {
    holder.getWorldPosition(_projV);
    _projV.project(camera);
    return {
      x: (_projV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_projV.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // Click/tap → open. #shaderBg is pointer-events:none, so canvas clicks fall
  // through to the document; we raycast here in the handler (not the loop) so a
  // tap still works on mobile where the render loop is parked. Guard against
  // clicks that land on real UI overlapping the sculpture.
  document.addEventListener('click', (e) => {
    if (document.documentElement.classList.contains('relief-zoom-open')) return;
    if (document.body.classList.contains('menu-open')) return;  // sculptures aren't clickable in the menu
    const t = e.target;
    if (t && t.closest && t.closest('a, button, input, textarea, .menu-overlay')) return;
    const ndcX =  (e.clientX / window.innerWidth)  * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    const holder = pickRelief(ndcX, ndcY);
    if (!holder) return;
    // Anchor the card to the click point (card opens to its left), not the
    // sculpture's center, so it lands where the user actually pointed.
    window.dispatchEvent(new CustomEvent('amf:relief-click', {
      detail: { meta: holder.userData.meta, screenPos: { x: e.clientX, y: e.clientY } }
    }));
  });

  /* ---- Resize ---- */
  // Always resize the renderer to the viewport so the canvas keeps covering it
  // (the canvas is a fixed full-screen backdrop). On mobile the camera is frozen
  // (see the animation loop), so re-fitting here doesn't introduce scroll jitter.
  function resize() {
    const w = window.innerWidth;
    if (_narrowDevice && w === lockedW) return;  // URL-bar height-only change → skip
    lockedW = w;
    const h = stableHeight();
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitWall();
    wake();  // re-fit needs a fresh draw (mobile may be paused)
  }
  window.addEventListener('resize', resize);
  fitWall();

  /* ---- Scroll → camera Y ---- */
  // As the user scrolls down the page, the camera slides down in world space.
  // Fragments stay at fixed world positions → they scroll past. The wall plane
  // follows the camera so it always fills the current viewport. (Mobile freezes
  // this — see the animation loop — so the backdrop stays perfectly still.)
  let scrollCamY = 0;
  function onScroll() {
    // Read the active scroller: window on desktop, #scroll-root on mobile (where
    // the document doesn't scroll so the fixed canvas stays truly pinned).
    const scrollPx = window.AMFScroll ? window.AMFScroll.y()
                   : (window.scrollY || document.documentElement.scrollTop || 0);
    const vh = window.AMFScroll ? window.AMFScroll.vh() : window.innerHeight;
    // One viewport of page scroll = one viewport of world Y.
    scrollCamY = -(scrollPx / vh) * VIEWPORT_WORLD_H;
    wake();  // a scroll opens a render window so the parallax redraws (mobile)
  }
  if (window.AMFScroll) window.AMFScroll.onScroll(onScroll, { passive: true });
  else window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Animation loop ---- */
  function animate() {
    requestAnimationFrame(animate);
    const tNow = performance.now() / 1000;

    // Home entrance reveal — advance the eased ramp on every device (the mobile drop
    // and the desktop ignite both read dropEase). When it finishes, hand off: mobile
    // resets the scan clock so it continues from the landing point; desktop just stays
    // on the cursor at full intensity.
    if (entrance === 'drop') {
      const dp = Math.min((tNow - dropStart) / DROP_DUR, 1);
      dropEase = dp < 0.5 ? 2 * dp * dp : 1 - Math.pow(-2 * dp + 2, 2) / 2;  // easeInOut
      if (dp >= 1) { entrance = 'off'; wanderStart = tNow; }
    }

    // Camera scroll follow — trailing lerp gives a soft parallax of the reliefs
    // against the wall. Now enabled on mobile too: with the content scrolling
    // inside #scroll-root, the document doesn't scroll, so the fixed canvas is
    // genuinely pinned (no iOS drift) and the camera can follow the wrapper's
    // scroll to slide the sculptures past at their world-Y positions.
    camera.position.y += (scrollCamY - camera.position.y) * 0.18;
    wall.position.y = camera.position.y;

    // Mobile floating light: a screen-space light driven in NDC (no cursor on touch).
    // DROPS in from the top onto the goat's head (0.8), then courses around the page
    // via a detuned serpentine wander. Touch does NOT affect it. Always in viewport
    // (NDC clamped). Desktop keeps the real mouse; reduced motion / card-open off.
    if (NARROW && !cardOpen && !prefersReducedMotion) {
      if (entrance === 'hold') {
        // Parked above the top edge while the goat + hero text fade in (lit by ambient).
        lightNX = 0; lightNY = 1.3;
      } else if (entrance === 'drop') {
        // Falls in from above the top down onto the goat's head (0.8); the scan also
        // begins at 0.8, so it continues seamlessly. dropEase advanced near the top.
        lightNX = 0;
        lightNY = 1.3 + (0.8 - 1.3) * dropEase;
      } else {
        const wt = tNow - wanderStart;
        const tx = WANDER_AX * (0.7 * Math.sin(wt * 0.8) + 0.3 * Math.sin(wt * 1.4));
        const ty = HOME_NY + WANDER_AY * (0.7 * Math.cos(wt * 0.4) + 0.3 * Math.cos(wt * 0.72));
        lightNX += (tx - lightNX) * 0.08;
        lightNY += (ty - lightNY) * 0.08;
        if (lightNY >  0.95) lightNY =  0.95;
        if (lightNY < -0.85) lightNY = -0.85;
        if (lightNX >  0.92) lightNX =  0.92;
        if (lightNX < -0.92) lightNX = -0.92;
      }
      mouse.x = lightNX;
      mouse.y = lightNY;
    }

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(wallPlane, targetPos);

    currentPos.x += (targetPos.x - currentPos.x) * 0.14;
    currentPos.y += (targetPos.y - currentPos.y) * 0.14;
    currentPos.z += (WALL_LIGHT_Z - currentPos.z) * 0.14;
    cursorLight.position.copy(currentPos);

    // Ease lights toward their preset target (mode / inverted / card-reveal).
    // Mobile eases (smooth card dissipation); desktop snaps so its inverted
    // toggle stays instant/unchanged.
    const cursorGoal = lightTarget.cursorIntensity;
    if (NARROW) {
      const LK = 0.15;
      ambient.intensity      += (lightTarget.ambient - ambient.intensity)    * LK;
      hemi.intensity         += (lightTarget.hemi    - hemi.intensity)       * LK;
      cursorLight.intensity  += (cursorGoal          - cursorLight.intensity) * LK;
      cursorLight.distance   += (lightTarget.cursorDist - cursorLight.distance) * LK;
    } else {
      ambient.intensity = lightTarget.ambient;
      hemi.intensity = lightTarget.hemi;
      cursorLight.intensity = cursorGoal;
      cursorLight.distance = lightTarget.cursorDist;
    }

    // Home entrance (both breakpoints): spotlight stays dark while the hero cascade
    // fades in (scene reads on ambient only), then ignites — in sync with the mobile
    // drop-in, or as a pure intensity ramp at the cursor on desktop.
    if (entrance === 'hold') cursorLight.intensity = 0;
    else if (entrance === 'drop') cursorLight.intensity = lightTarget.cursorIntensity * dropEase;

    // Relief hover (desktop only — mobile has no hover and parks this loop).
    // Raycast the pointer against interactive reliefs and announce enter/leave
    // so the custom cursor can grow/pulse exactly like over a button. Edge-
    // triggered on the holder id so we dispatch only on change, not every frame.
    if (!NARROW) {
      // While the menu overlay is open the sculptures aren't clickable, so don't
      // hover them either — hov stays null, which also clears the ring if the menu
      // opened mid-hover.
      const menuOpen = document.body.classList.contains('menu-open');
      const hov = menuOpen ? null : pickRelief(mouse.x, mouse.y);
      const hovId = hov ? hov.id : 0;
      if (hovId !== lastReliefHoverId) {
        lastReliefHoverId = hovId;
        window.dispatchEvent(new CustomEvent(hov ? 'amf:relief-hover' : 'amf:relief-out'));
      }
    }

    // Sticky pin pass — for any relief that declared a pin range, override
    // its world Y so it tracks the camera through that range and parks at
    // the edges otherwise. Runs before emerge so the emerge viewport check
    // uses the post-pin position.
    if (emerging.length) {
      const camY = camera.position.y;
      for (let i = 0; i < emerging.length; i++) {
        const pin = emerging[i].userData.pin;
        if (!pin) continue;
        const offsetY = pin.offsetY || 0;
        if (camY > pin.startY)      emerging[i].position.y = pin.startY + offsetY;
        else if (camY < pin.endY)   emerging[i].position.y = pin.endY + offsetY;
        else                        emerging[i].position.y = camY + offsetY;
      }
    }

    // Emerge: start each sculpture's rise when it first enters the viewport
    // (with a small lead margin so the animation has begun by the time it's
    // fully on screen). Each sculpture eases from deep-in-wall to its target
    // z over `duration` with easeOutCubic. Sculptures above/below the
    // viewport simply wait at their start z.
    if (emerging.length) {
      const visibleH = visibleAtZ(0).h;
      const cameraY = camera.position.y;
      for (let i = 0; i < emerging.length; i++) {
        const h = emerging[i];
        const e = h.userData.emerge;
        // Wireframe emergence — slow crossfade from wireframe overlay to solid
        // surface once the emerge has entered viewport. Runs past the z-rise.
        // Retreat takes priority over emerge — once a relief is sinking
        // back into the wall, we don't want the emerge math to fight it.
        if (e.retreatStart >= 0) {
          const rt = (tNow - e.retreatStart) / e.retreatDuration;
          if (rt >= 1) {
            h.position.z = e.startZ;
          } else {
            const rk = 1 - rt;
            const reased = 1 - rk * rk * rk; // same easeOutCubic as emerge
            h.position.z = e.retreatFromZ + (e.startZ - e.retreatFromZ) * reased;
          }
          continue;
        }
        if (e.done) continue;
        if (e.startTime < 0) {
          if (holdHomeEmerge) continue;  // first-load intro: goat waits for its cue
          // Lead margin: default 1.5 starts the rise a touch before the relief is
          // fully on screen. A per-relief override can tighten it (negative =
          // start later, only once it's well into view) — used for the bottom CTA
          // relief so it visibly rises as you arrive instead of pre-emerging.
          const margin = (h.userData.emergeMargin != null) ? h.userData.emergeMargin : 1.5;
          const viewTop = cameraY + visibleH / 2 + margin;
          const viewBot = cameraY - visibleH / 2 - margin;
          const sy = h.position.y;
          if (sy < viewBot || sy > viewTop) continue;
          e.startTime = tNow;
        }
        const t = (tNow - e.startTime) / e.duration;
        // Signal once the first relief is clearly rising past the wall (~visible)
        // so the hero text can begin sequencing in shortly after it — earlier
        // than the original 0.55 so the text doesn't lag the statue.
        if (!heroEmergeSignaled && t >= 0.35) {
          heroEmergeSignaled = true;
          window.dispatchEvent(new Event('amf:relief-emerged'));
        }
        if (t >= 1) {
          h.position.z = e.targetZ;
          e.done = true;
        } else {
          const k = 1 - t;
          const eased = 1 - k * k * k; // easeOutCubic
          h.position.z = e.startZ + (e.targetZ - e.startZ) * eased;
        }
      }
    }

    if (!NARROW) {
      // Desktop: render every frame (live parallax + cursor light).
      renderer.render(scene, camera);
    } else if (sceneIsAnimating(tNow) || tNow < forceRenderUntil) {
      // Mobile, still animating (emerge / retreat / light easing) → keep drawing.
      renderer.render(scene, camera);
      mobileSettledFrame = false;
    } else if (!mobileSettledFrame) {
      // Mobile just settled → draw one last frame, then leave the canvas static
      // so iOS composites it as a pinned fixed layer (no scroll drift).
      renderer.render(scene, camera);
      mobileSettledFrame = true;
    }
  }

  wake();
  animate();

  // Public hook for the SPA router.
  //   render             — synchronous draw (also used by the smoke snap).
  //   retreatAllReliefs  — reverse-emerge on every currently-visible relief.
  //   swapPage           — tears down the old page's reliefs and loads the
  //                        new page's set. Camera scroll resets to the top
  //                        of the incoming page so reliefs land in the
  //                        correct viewport band.
  window.AMFShaderBg = {
    render: function () { renderer.render(scene, camera); },
    retreatAllReliefs: function (durationMs) {
      const now = performance.now() / 1000;
      const dur = (durationMs || 800) / 1000;
      for (let i = 0; i < emerging.length; i++) {
        const e = emerging[i].userData.emerge;
        // Buried reliefs that haven't started emerging stay where they
        // are — no need to retreat something the user can't see.
        if (e.startTime < 0) continue;
        e.retreatStart = now;
        e.retreatDuration = dur;
        e.retreatFromZ = emerging[i].position.z;
      }
      wake();  // drive the retreat frames (mobile may be paused)
    },
    swapPage: function (pageKey) {
      clearReliefs();
      camera.position.y = 0;
      scrollCamY = 0;
      cardOpen = false;                            // card can't survive a nav
      holdHomeEmerge = false;                       // intro hold is first-load only
      lightNX = 0; lightNY = 0.8;                  // light re-enters from the top (goat head)
      wanderStart = performance.now() / 1000;      // restart the scan for the new page's hero
      refreshLightTarget();                        // drop any REVEAL preset
      loadReliefsForKey(pageKey || pageKeyFromPath(window.location.pathname));
      wake();  // draw the cleared scene + the new page's emerge
    },
    // Hooks for relief-info.js / console inspection. pickReliefAt takes viewport
    // pixels and returns the holder under that point (or null); reliefScreenPos
    // projects a holder back to viewport pixels for card placement.
    pickReliefAt: function (clientX, clientY) {
      return pickRelief((clientX / window.innerWidth) * 2 - 1,
                        -(clientY / window.innerHeight) * 2 + 1);
    },
    reliefScreenPos: reliefScreenPos
  };
})();

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
  // updateStyle=false: don't let three.js write inline px width/height on the
  // canvas — CSS (#shaderBg { inset:0 }) keeps it pinned to the full viewport
  // even as the mobile URL bar changes innerHeight, so it always covers.
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0xf1ede7, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 6);

  /* ---- Wall plane (plaster) ---- */
  const texLoader = new THREE.TextureLoader();
  const normal = texLoader.load('/assets/wall-normal.jpg');
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
      { src: '/assets/reliefs/goat.glb',           size: 7.0, flat: 0.35, x:  1.0, y: -1.0,                         rz: 0.0, rx: 0.0,      ry: 0.0 },
      { src: '/assets/reliefs/oceanus.glb',        size: 6.0, flat: 0.22, x: -1.5, y: -VIEWPORT_WORLD_H * 1.0 - 3.5, z: 0.6, rz: 0.0, rx: Math.PI, ry: 0.0 },
      { src: '/assets/reliefs/nymph.glb',          size: 6.0, flat: 0.35, x: -3.0, y: -VIEWPORT_WORLD_H * 7.5 - 2,   z: 0.3, rz: 0.0, rx: 0.0,      ry: Math.PI / 2 },
      { src: '/assets/reliefs/puck.glb',           size: 6.0, flat: 0.23, x:  2.5, y: -VIEWPORT_WORLD_H * 5.5 - 4,   z: 0.25, rz: 0.0, rx: -Math.PI / 2, ry: 0.0 },
    ],
    contact: [
      { src: '/assets/reliefs/triton.glb',  size: 6.5, flat: 0.13, x:  2.0, y: -2.0,                         z:  0.25, rz: 0.0, rx: Math.PI, ry: 0.0 },
    ],
    about: [
      { src: '/assets/reliefs/athena.glb',     size: 10.0, flat: 0.22, x:  1.5, y: -3.0,                         z:  0.25, rz: Math.PI + 0.06, rx:  0.30, ry: Math.PI },
      { src: '/assets/reliefs/pan.glb',        size: 11.5, flat: 0.22, x: -1.0, y: -VIEWPORT_WORLD_H * 3.5 - 2.0, z:  0.25, rz: 0.06, rx:  0.20, ry: Math.PI / 2 - 0.2 },
      { src: '/assets/reliefs/bosio.glb',      size: 6.0,  flat: 0.22, x:  2.6, y: -VIEWPORT_WORLD_H * 3.0 + 2.0, z:  0.25, rz: Math.PI, rx:  0.0, ry: -Math.PI / 6, flatShade: true },
    ],
    work: [
      { src: '/assets/reliefs/cupid.glb',      size: 6.5, flat: 0.32, x: -1.5, y: -1.2,                         z:  0.25, rz: Math.PI / 2, rx: -Math.PI / 2, ry: -Math.PI / 2, mirror: true },
    ],
    ai: [
      { src: '/assets/reliefs/mercury.glb',    size: 5.0, flat: 0.25, x: 2.0, y: -0.5,                          z:  0.25, rz: 0.0, rx: 0.0, ry: Math.PI },
      { src: '/assets/reliefs/vacossin.glb',   size: 6.0, flat: 0.25, x: -2.0, y: -VIEWPORT_WORLD_H * 2.0 + 2.5, z:  0.25, rz: 0.0, rx: 0.0, ry: 0.0 },
      { src: '/assets/reliefs/bearded-man.glb', size: 5.0, flat: 0.25, x: 2.5, y: -VIEWPORT_WORLD_H * 4.0,        z:  0.25, rz: 0.0, rx: Math.PI, ry: Math.PI - Math.PI / 3,
        pin: { startY: -VIEWPORT_WORLD_H * 4.0, endY: -VIEWPORT_WORLD_H * 7.0, offsetY: 0 } },
      { src: '/assets/reliefs/fullbody.glb',   size: 9.0, flat: 0.25, x: 1.5, y: -VIEWPORT_WORLD_H * 10.0 - 6.5,  z:  0.25, rz: 0.0, rx: Math.PI, ry: 0.0 },
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
    const s = cfg.size / (faceExtent || 1);
    holder.scale.set(cfg.mirror ? -s : s, s, s * cfg.flat);

    // Narrow/touch viewports: the camera sees a far thinner slice of the world,
    // so desktop-tuned x positions land off to the edges / over the text. Pull
    // each relief toward center in proportion to how much narrower the view is,
    // shrink it to fit the column, and sit it near the wall plane so it reads as
    // a faint embedded backdrop behind the copy rather than competing with it.
    let effX = cfg.x;
    let effZ = cfg.z || 0;
    if (NARROW) {
      const xScale = Math.min(1, visibleAtZ(0).w / 7.2);  // 7.2 ≈ desktop visible width
      effX = cfg.x * xScale;
      effZ = 0.05;                       // closer to the wall → flatter, subtler
      holder.scale.multiplyScalar(0.7);  // smaller so it doesn't crowd the column
    }

    holder.position.set(effX, cfg.y, effZ);
    holder.rotation.y = cfg.spin || 0;  // world-Y turntable spin
    holder.rotation.z = cfg.rz || 0;

    // Pin: when the camera Y is inside [pin.endY, pin.startY] (the world-Y
    // span of a page section), the relief sticks to the camera so it appears
    // fixed on screen while the surrounding content scrolls past. Outside
    // that range it parks at the nearest edge — entering from below as the
    // camera scrolls down into the section, and getting left behind above
    // after the camera scrolls out the bottom. Note pin.startY > pin.endY
    // because scrolling down makes camera.y more negative.
    if (cfg.pin) {
      holder.userData.pin = cfg.pin;
    }

    // Emerge animation — start the holder ~1.6 world units deeper than its
    // target z (fully behind the opaque wall plane). The animate loop only
    // begins easing it forward once the sculpture scrolls into viewport, so
    // each one rises as the user reaches it. Skipped on reduced-motion.
    const targetZ = effZ;
    if (prefersReducedMotion) {
      holder.position.z = targetZ;
    } else {
      const emergeStartZ = targetZ - 1.6;
      holder.userData.emerge = {
        startTime: -1,
        duration: 2.8,        // slow rise — sculpture feels weighty
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

    scene.add(holder);
    return holder;
  }
  const emerging = [];
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
  }

  // Generation counter guards against late GLB callbacks landing after the
  // user has already navigated to another page — a stale callback would
  // otherwise add an extra relief to the new scene.
  let loadGeneration = 0;
  function loadReliefsForKey(pageKey) {
    const gen = ++loadGeneration;
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

  // "Lights off" mode — when the page is inverted, kill ambient/hemi so the
  // cursor becomes the only light source (flashlight in a dark room). The
  // cursor light's range is bumped so it still illuminates the reliefs clearly.
  const LIGHT_DEFAULTS = {
    ambient: ambient.intensity,
    hemi: hemi.intensity,
    cursorIntensity: cursorLight.intensity,
    cursorDist: cursorLight.distance,
  };
  function applyInvertedLights() {
    const inv = document.documentElement.classList.contains('inverted');
    ambient.intensity      = inv ? 0.02 : LIGHT_DEFAULTS.ambient;
    hemi.intensity         = inv ? 0.02 : LIGHT_DEFAULTS.hemi;
    cursorLight.intensity  = inv ? 1.1  : LIGHT_DEFAULTS.cursorIntensity;
    cursorLight.distance   = inv ? 3.2  : LIGHT_DEFAULTS.cursorDist;
  }
  applyInvertedLights();
  new MutationObserver(applyInvertedLights).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class']
  });

  /* ---- Cursor tracking ---- */
  const mouse = new THREE.Vector2(0, 0);
  const targetPos = new THREE.Vector3();
  const currentPos = new THREE.Vector3(0, 0, 0);
  const raycaster = new THREE.Raycaster();
  const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  document.addEventListener('mousemove', (e) => {
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });

  /* ---- Resize ---- */
  // Mobile browsers change window.innerHeight as the URL bar slides in/out
  // during scroll, firing resize and shifting the scroll→world mapping — which
  // makes the wall + reliefs jitter. On narrow/touch viewports we lock to a
  // stable height and only re-fit when the WIDTH actually changes (orientation).
  // Desktop is unaffected: NARROW is false, so behavior is identical to before.
  let stableVW = window.innerWidth;
  let stableVH = window.innerHeight;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (NARROW && w === stableVW) return;   // ignore URL-bar height-only changes
    stableVW = w; stableVH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitWall();
  }
  window.addEventListener('resize', resize);
  fitWall();

  /* ---- Scroll → camera Y ---- */
  // As the user scrolls down the page, the camera slides down in world space.
  // Fragments stay at fixed world positions → they scroll past. The wall plane
  // follows the camera so it always fills the current viewport.
  let scrollCamY = 0;
  function onScroll() {
    // Use the locked height on mobile so the URL-bar show/hide doesn't yank the
    // mapping mid-scroll. Desktop keeps the live innerHeight (NARROW is false).
    const vh = NARROW ? stableVH : window.innerHeight;
    const scrollPx = window.scrollY || document.documentElement.scrollTop || 0;
    // One viewport of page scroll = one viewport of world Y.
    scrollCamY = -(scrollPx / vh) * VIEWPORT_WORLD_H;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Animation loop ---- */
  function animate() {
    requestAnimationFrame(animate);

    // Camera scroll follow. On desktop a trailing lerp gives a soft parallax.
    // On mobile that lerp wobbles against momentum scrolling, so lock the camera
    // 1:1 to the live scroll position each frame — the reliefs then move in
    // lockstep with the page instead of shaking.
    if (NARROW) {
      const sp = window.scrollY || document.documentElement.scrollTop || 0;
      camera.position.y = -(sp / stableVH) * VIEWPORT_WORLD_H;
    } else {
      camera.position.y += (scrollCamY - camera.position.y) * 0.18;
    }
    wall.position.y = camera.position.y;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(wallPlane, targetPos);

    currentPos.x += (targetPos.x - currentPos.x) * 0.14;
    currentPos.y += (targetPos.y - currentPos.y) * 0.14;
    currentPos.z += (WALL_LIGHT_Z - currentPos.z) * 0.14;
    cursorLight.position.copy(currentPos);

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
      const tNow = performance.now() / 1000;
      const visibleH = visibleAtZ(0).h;
      const cameraY = camera.position.y;
      const viewTop = cameraY + visibleH / 2 + 1.5;
      const viewBot = cameraY - visibleH / 2 - 1.5;
      for (let i = 0; i < emerging.length; i++) {
        const h = emerging[i];
        const e = h.userData.emerge;
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
          const sy = h.position.y;
          if (sy < viewBot || sy > viewTop) continue;
          e.startTime = tNow;
        }
        const t = (tNow - e.startTime) / e.duration;
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

    renderer.render(scene, camera);
  }

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
    },
    swapPage: function (pageKey) {
      clearReliefs();
      camera.position.y = 0;
      scrollCamY = 0;
      loadReliefsForKey(pageKey || pageKeyFromPath(window.location.pathname));
    }
  };
})();

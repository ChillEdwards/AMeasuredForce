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
    canvas, antialias: true, alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  /* ---- Load the ruins fragments ---- */
  // Each entry: file, target diameter in world units, flatten-z factor,
  // world x,y, rotation-z, extra-rotation-x (tilt into wall).
  // One large fragment per scroll "band" (≈ one viewport of scroll). The head
  // anchors the hero; as the user scrolls, it drifts up and off-screen and
  // the next fragment comes in from below.
  const VIEWPORT_WORLD_H = 4.6;   // rough world-space height of one viewport
  const fragmentsByPage = {
    home: [
      { src: '/assets/reliefs/goat.glb',    size: 7.0, flat: 0.22, x:  1.0, y: -1.0,                         rz: 0.0, rx: 0.0,      ry: 0.0 },
      { src: '/assets/reliefs/oceanus.glb', size: 6.0, flat: 0.22, x: -1.5, y: -VIEWPORT_WORLD_H * 1.0 - 3.5, z: 0.6, rz: 0.0, rx: Math.PI, ry: 0.0 },
    ],
    contact: [
      { src: '/assets/reliefs/triton.glb',  size: 6.5, flat: 0.13, x:  2.0, y: -2.0,                         z:  0.25, rz: 0.0, rx: Math.PI, ry: 0.0 },
    ],
    about: [
      { src: '/assets/reliefs/athena.glb',     size: 10.0, flat: 0.22, x:  1.5, y: -3.0,                         z:  0.25, rz: Math.PI + 0.06, rx:  0.30, ry: Math.PI },
      { src: '/assets/reliefs/pan.glb',        size: 11.5, flat: 0.22, x: -1.0, y: -VIEWPORT_WORLD_H * 3.5 + 2.0, z:  0.25, rz: 0.06, rx:  0.20, ry: Math.PI / 2 - 0.2 },
    ],
    work: [
      { src: '/assets/reliefs/cupid.glb',      size: 6.5, flat: 0.22, x: -1.5, y: -1.2,                         z:  0.25, rz: Math.PI / 2, rx: -Math.PI / 2, ry: -Math.PI / 2, mirror: true },
    ],
  };

  // Center, scale, and flatten one loaded GLB scene into a mesh that sits
  // half-embedded in the wall plane (center at z=0).
  function prepareFragment(gltf, cfg) {
    const group = gltf.scene || gltf.scenes[0];
    group.traverse((o) => {
      if (o.isMesh) {
        o.material = reliefMat;
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

    holder.position.set(cfg.x, cfg.y, cfg.z || 0);
    holder.rotation.z = cfg.rz || 0;

    scene.add(holder);
    return holder;
  }

  // Pick the relief set based on the current page. Pages not listed get
  // the wall + cursor light only.
  const path = window.location.pathname;
  let pageKey = null;
  if (path === '/' || /\/index\.html?$/.test(path) || path === '/index') pageKey = 'home';
  else if (/\/contact\.html?$/.test(path)) pageKey = 'contact';
  else if (/\/about\.html?$/.test(path)) pageKey = 'about';
  else if (/\/work\.html?$/.test(path)) pageKey = 'work';
  const pageFragments = fragmentsByPage[pageKey] || [];
  if (pageFragments.length && THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();
    pageFragments.forEach((cfg) => {
      loader.load(
        cfg.src,
        (gltf) => prepareFragment(gltf, cfg),
        undefined,
        (err) => console.warn('[shader-bg] fragment load failed', cfg.src, err)
      );
    });
  }

  /* ---- Lighting ---- */
  // Lower ambient so the cursor's directional shading reads as real depth
  // contrast (not just a brightness bump over flat fill).
  const ambient = new THREE.AmbientLight(0xffffff, 0.62);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xf4efe6, 0xb5aea1, 0.28);
  scene.add(hemi);

  // Cursor light sits slightly in front of the wall, grazing the normal-
  // mapped surface to produce a bright hot-spot that illuminates the relief.
  const WALL_LIGHT_Z = 0.6;
  const cursorLight = new THREE.PointLight(0xffffff, 1.1, 2.0, 1.6);
  cursorLight.position.set(0, 0, WALL_LIGHT_Z);
  scene.add(cursorLight);

  // "Lights off" mode — when the page is inverted, kill ambient/hemi so the
  // cursor becomes the only light source (flashlight in a dark room). The
  // cursor light's range is bumped so it still illuminates the reliefs clearly.
  const LIGHT_DEFAULTS = { ambient: ambient.intensity, hemi: hemi.intensity, cursorDist: cursorLight.distance };
  function applyInvertedLights() {
    const inv = document.documentElement.classList.contains('inverted');
    ambient.intensity = inv ? 0.02 : LIGHT_DEFAULTS.ambient;
    hemi.intensity    = inv ? 0.02 : LIGHT_DEFAULTS.hemi;
    cursorLight.distance = inv ? 3.2 : LIGHT_DEFAULTS.cursorDist;
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
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
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
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollPx = window.scrollY || document.documentElement.scrollTop || 0;
    // One viewport of page scroll = one viewport of world Y.
    scrollCamY = -(scrollPx / window.innerHeight) * VIEWPORT_WORLD_H;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Animation loop ---- */
  function animate() {
    requestAnimationFrame(animate);

    // Smooth camera scroll follow.
    camera.position.y += (scrollCamY - camera.position.y) * 0.18;
    wall.position.y = camera.position.y;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(wallPlane, targetPos);

    currentPos.x += (targetPos.x - currentPos.x) * 0.14;
    currentPos.y += (targetPos.y - currentPos.y) * 0.14;
    currentPos.z += (WALL_LIGHT_Z - currentPos.z) * 0.14;
    cursorLight.position.copy(currentPos);

    renderer.render(scene, camera);
  }

  animate();
})();

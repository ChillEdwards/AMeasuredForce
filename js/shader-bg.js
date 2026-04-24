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
  renderer.setClearColor(0xefebe5, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 6);

  /* ---- Wall plane (plaster) ---- */
  const texLoader = new THREE.TextureLoader();
  const normal = texLoader.load('assets/wall-normal.jpg');
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const wallMat = new THREE.MeshStandardMaterial({
    normalMap: normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0xefebe5,
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
  const fragments = [
    { src: 'assets/reliefs/goat.glb',      size: 3.3, flat: 1.0,  x:  1.0, y:  0, z: 2.2,               rz: 0.0,  rx: 0.0, ry: 0.0, spin: 0.006 },
    { src: 'assets/reliefs/venus.glb',     size: 5.5, flat: 0.18, x: -2.6, y: -VIEWPORT_WORLD_H * 1.0,  rz: 0.0,  rx: -Math.PI / 2, ry: 0.0 },
    { src: 'assets/reliefs/ox-relief.glb', size: 5.0, flat: 0.22, x:  0.0, y: -VIEWPORT_WORLD_H * 2.0,  rz: 0.0,  rx: 0.0 },
    { src: 'assets/reliefs/ram.glb',       size: 4.0, flat: 0.20, x:  2.6, y: -VIEWPORT_WORLD_H * 3.0,  rz:-0.2,  rx: 0.0 },
    { src: 'assets/reliefs/eagle.glb',     size: 3.2, flat: 0.22, x: -2.8, y: -VIEWPORT_WORLD_H * 4.0,  rz:-0.1,  rx: 0.0 },
    { src: 'assets/reliefs/helmet.glb',    size: 2.4, flat: 0.22, x: -1.8, y: -VIEWPORT_WORLD_H * 5.0,  rz: 0.2,  rx: 0.0 },
    { src: 'assets/reliefs/head.glb',      size: 3.0, flat: 0.10, x:  2.4, y: -VIEWPORT_WORLD_H * 6.0,  rz: 0.0,  rx: Math.PI / 2, ry: 0.35 },
  ];

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

    // Spinning fragments need uniform scale (longest of ALL 3 axes) so mid-
    // rotation views don't turn into a flattened disc. Static fragments use
    // face-on silhouette scaling + a flatten-z for the "embedded" look.
    const faceExtent = cfg.spin
      ? Math.max(size.x, size.y, size.z)
      : Math.max(size.x, size.y);
    const s = cfg.size / (faceExtent || 1);
    holder.scale.set(s, s, s * cfg.flat);

    holder.position.set(cfg.x, cfg.y, cfg.z || 0);
    holder.rotation.z = cfg.rz || 0;

    if (cfg.spin) spinning.push({ holder, rate: cfg.spin });

    scene.add(holder);
    return holder;
  }

  const spinning = [];

  const loader = new THREE.GLTFLoader();
  fragments.forEach((cfg) => {
    loader.load(
      cfg.src,
      (gltf) => prepareFragment(gltf, cfg),
      undefined,
      (err) => console.warn('[shader-bg] fragment load failed', cfg.src, err)
    );
  });

  /* ---- Lighting ---- */
  // Lower ambient so the cursor's directional shading reads as real depth
  // contrast (not just a brightness bump over flat fill).
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xf4efe6, 0xb5aea1, 0.25);
  scene.add(hemi);

  // Single cursor light that adapts its depth to whatever's under the cursor.
  // When the cursor is over an out-of-wall hero fragment (e.g. the goat) the
  // light slides forward to sit just in front of that fragment's face. When
  // the cursor is over flat wall/relief area the light drops back to graze
  // the wall plane. One light → no wall bleed-through behind the goat.
  const WALL_LIGHT_Z = 0.18;
  const cursorLight = new THREE.PointLight(0xffffff, 1.1, 2.0, 1.6);
  cursorLight.position.set(0, 0, WALL_LIGHT_Z);
  scene.add(cursorLight);

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

    // Spin any fragments flagged for it.
    for (const s of spinning) {
      s.holder.rotation.y += s.rate;
    }

    raycaster.setFromCamera(mouse, camera);

    // Pick target cursor-light position. If the ray passes through a hero
    // fragment's bounding box, target a point just in front of that fragment's
    // forward face. Otherwise, fall back to grazing the wall plane.
    let tX, tY, tZ;
    let hoveringFragment = false;
    for (let i = 0; i < spinning.length; i++) {
      const box = new THREE.Box3().setFromObject(spinning[i].holder);
      const tmp = new THREE.Vector3();
      if (raycaster.ray.intersectBox(box, tmp)) {
        tX = tmp.x;
        tY = tmp.y;
        tZ = box.max.z + 0.5;   // just in front of the forward face
        hoveringFragment = true;
        break;
      }
    }
    if (!hoveringFragment) {
      raycaster.ray.intersectPlane(wallPlane, targetPos);
      tX = targetPos.x;
      tY = targetPos.y;
      tZ = WALL_LIGHT_Z;
    }

    currentPos.x += (tX - currentPos.x) * 0.14;
    currentPos.y += (tY - currentPos.y) * 0.14;
    currentPos.z += (tZ - currentPos.z) * 0.14;
    cursorLight.position.copy(currentPos);

    renderer.render(scene, camera);
  }

  animate();
})();

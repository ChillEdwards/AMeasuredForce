/* ========================================
   A MEASURED FORCE — WebGL Fluid Background
   Immersive Garden-inspired noise shader
   ======================================== */

(function () {
  const canvas = document.getElementById('shaderBg');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ---- Mouse tracking ---- */
  const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };

  document.addEventListener('mousemove', (e) => {
    mouse.targetX = e.clientX / window.innerWidth;
    mouse.targetY = 1.0 - e.clientY / window.innerHeight;
  });

  /* ---- Shader ---- */
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;

    varying vec2 vUv;

    /* ---- Simplex 3D noise (Ashima Arts) ---- */
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec2 uv = vUv;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = uv;
      p.x *= aspect;

      float t = u_time * 0.08;

      /* Mouse influence — subtle UV warp toward cursor */
      vec2 mouseUV = u_mouse;
      mouseUV.x *= aspect;
      vec2 toMouse = mouseUV - p;
      float mouseDist = length(toMouse);
      float mouseInfluence = smoothstep(1.2, 0.0, mouseDist) * 0.15;
      p += toMouse * mouseInfluence;

      /* Layered noise for organic movement */
      float n1 = snoise(vec3(p * 1.2, t));
      float n2 = snoise(vec3(p * 2.4 + 3.0, t * 1.3 + 10.0));
      float n3 = snoise(vec3(p * 0.6 - 5.0, t * 0.6 - 20.0));

      float noise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

      /* Brand colors */
      vec3 black    = vec3(0.0, 0.0, 0.0);
      vec3 darkGray = vec3(0.04, 0.04, 0.05);
      vec3 orange   = vec3(0.91, 0.38, 0.10);  /* #E8611A */
      vec3 cyan     = vec3(0.0, 0.79, 0.86);   /* #00C9DB */

      /* Map noise to color regions */
      float zone1 = smoothstep(-0.4, 0.1, noise);   /* dark to orange glow */
      float zone2 = smoothstep(0.0, 0.5, noise);     /* orange to cyan accent */
      float zone3 = smoothstep(0.3, 0.7, noise);     /* cyan highlight */

      vec3 col = black;
      col = mix(col, darkGray, smoothstep(-1.0, -0.2, noise));
      col = mix(col, orange * 0.132, zone1 * 0.88);
      col = mix(col, cyan * 0.088, zone2 * 0.66);
      col = mix(col, orange * 0.275, smoothstep(0.35, 0.55, noise) * 0.55);

      /* Bright accents at noise peaks — very subtle */
      float peak = smoothstep(0.5, 0.7, noise);
      col += cyan * 0.066 * peak;
      col += orange * 0.044 * peak;

      /* Vignette — darken edges */
      float vig = 1.0 - smoothstep(0.3, 1.4, length(vUv - 0.5) * 1.8);
      col *= mix(0.55, 1.0, vig);

      /* Mouse glow — subtle warm highlight near cursor */
      float glow = smoothstep(0.6, 0.0, length(vUv - u_mouse)) * 0.066;
      col += orange * glow;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));

  /* ---- Resize ---- */
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  });

  /* ---- Render loop ---- */
  function animate() {
    requestAnimationFrame(animate);

    uniforms.u_time.value = performance.now() * 0.001;

    // Smooth mouse follow
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;
    uniforms.u_mouse.value.set(mouse.x, mouse.y);

    renderer.render(scene, camera);
  }

  animate();
})();

# A Measured Force — Development Notes

## Critical: WebGL Shader Background
The animated WebGL shader background (`js/shader-bg.js`) with cursor hover effect MUST be present on every page. Never remove it.

Every HTML page requires these three elements:
1. `<canvas id="shaderBg"></canvas>` — immediately after `<body>`
2. `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>` — before `</body>`
3. `<script src="js/shader-bg.js"></script>` — after Three.js, before main.js

For pages in subdirectories (e.g. `work/`), use relative paths: `../js/shader-bg.js`

The CSS must also include:
- `#shaderBg` fixed positioning styles
- `body { background: transparent; }` so the shader shows through
- `html { background: #000; }` as fallback

## Page Template
When creating any new page, copy the full boilerplate from an existing page (e.g. `about.html`) to ensure the shader background, favicon, header, footer, and scripts are included.

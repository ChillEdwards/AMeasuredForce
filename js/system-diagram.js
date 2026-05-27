/* System Diagram — vanilla JS implementation
   ----------------------------------------------------------------
   Builds the SVG figure imperatively and runs the animation loop.
   Exposes window.AMFSystemDiagram.init(svg) so the SPA router /
   main.js bootPage can call it whenever <main> contains a
   #system-svg, and returns a teardown handle for cleanup.
   ---------------------------------------------------------------- */

(function () {
  function init(svg) {
    if (!svg) return null;

    // ─ Internal SVG coordinate system ──────────────────────────────
    const W = 1200, H = 720;
    const CX = W / 2, CY = H / 2;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // ─ Six peripheral nodes, placed asymmetrically on an ellipse ──
    const nodes = [
      { id: 'strategy',   label: 'STRATEGY',   sub: 'what to automate first',         x: 0.10, y: 0.34 },
      { id: 'brand',      label: 'BRAND',      sub: 'voice the tool speaks in',       x: 0.26, y: 0.10 },
      { id: 'marketing',  label: 'MARKETING',  sub: 'reach, message, response',       x: 0.74, y: 0.10 },
      { id: 'data',       label: 'DATA',       sub: 'what the company already knows', x: 0.92, y: 0.40 },
      { id: 'decisions',  label: 'DECISIONS',  sub: 'the moves that matter',          x: 0.74, y: 0.86 },
      { id: 'operations', label: 'OPERATIONS', sub: 'how the work gets done',         x: 0.20, y: 0.84 }
    ].map(n => ({ ...n, px: n.x * W, py: n.y * H }));

    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}) => {
      const e = document.createElementNS(ns, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };

    // ─ Layers (drawing order: lines under signals under nodes) ────
    const linesG   = el('g', { class: 'lines' });
    const signalsG = el('g', { class: 'signals' });
    const nodesG   = el('g', { class: 'nodes' });
    const centerG  = el('g', { class: 'center' });
    svg.append(linesG, signalsG, nodesG, centerG);

    // ─ Center: ring + pulse ring + italic "ai" ────────────────────
    const centerRing = el('circle', {
      cx: CX, cy: CY, r: 92, fill: 'none', class: 'line-stroke',
      'stroke-width': 1, opacity: 0.18
    });
    const centerRingPulse = el('circle', {
      cx: CX, cy: CY, r: 92, fill: 'none', class: 'line-stroke',
      'stroke-width': 1, opacity: 0
    });
    const ai = el('text', {
      x: CX, y: CY + 18,
      'text-anchor': 'middle',
      'font-family': "'Playfair Display', serif",
      'font-style': 'italic',
      'font-weight': '400',
      'font-size': 92,
      opacity: 0.35
    });
    ai.textContent = 'ai';
    centerG.append(centerRing, centerRingPulse, ai);

    // ─ Peripheral nodes ───────────────────────────────────────────
    const nodeElems = nodes.map(n => {
      const g = el('g', { class: 'node', transform: `translate(${n.px} ${n.py})` });
      const dot = el('circle', { r: 4, class: 'signal-fill' });
      const label = el('text', {
        'font-family': "'Inter', sans-serif",
        'font-size': 12,
        'font-weight': 500,
        'letter-spacing': '0.16em',
        'text-anchor': (n.px < CX ? 'end' : 'start'),
        x: (n.px < CX ? -14 : 14),
        y: 4
      });
      label.textContent = n.label;
      const sub = el('text', {
        'font-family': "'Playfair Display', serif",
        'font-style': 'italic',
        'font-size': 14,
        class: 'sub-fill',
        'text-anchor': (n.px < CX ? 'end' : 'start'),
        x: (n.px < CX ? -14 : 14),
        y: 22,
        opacity: 0
      });
      sub.textContent = n.sub;
      g.append(dot, label, sub);
      nodesG.append(g);
      return { node: n, g, dot, label, sub };
    });

    // ─ Lines: from each node toward center, stopping 110px short ─
    const RADIUS = 110;
    const lineElems = nodes.map(n => {
      const dx = CX - n.px;
      const dy = CY - n.py;
      const len = Math.hypot(dx, dy);
      const tx = CX - dx / len * RADIUS;
      const ty = CY - dy / len * RADIUS;
      const line = el('line', {
        x1: n.px, y1: n.py, x2: tx, y2: ty,
        class: 'line-stroke',
        'stroke-width': 1,
        'stroke-dasharray': '4 6',
        opacity: 0.28
      });
      linesG.append(line);
      return { node: n, line, tx, ty };
    });

    // ─ Signal dots: one per line, hidden until "Built in" ─────────
    const signals = lineElems.map(L => {
      const s = el('circle', {
        r: 3, class: 'signal-fill', opacity: 0,
        cx: L.node.px, cy: L.node.py
      });
      signalsG.append(s);
      return { ...L, el: s, phase: Math.random() };
    });

    // ─ State machine ──────────────────────────────────────────────
    let mode = 'bolted';     // 'bolted' | 'wired'
    let pulseT = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setMode(next) {
      mode = next;
      const wired = mode === 'wired';

      lineElems.forEach(({ line }) => {
        if (wired) {
          line.setAttribute('stroke-dasharray', 'none');
          line.setAttribute('opacity', 0.9);
          line.setAttribute('stroke-width', 1.2);
        } else {
          line.setAttribute('stroke-dasharray', '4 6');
          line.setAttribute('opacity', 0.28);
          line.setAttribute('stroke-width', 1);
        }
      });

      ai.setAttribute('opacity', wired ? 1 : 0.35);
      centerRing.setAttribute('opacity', wired ? 0.6 : 0.18);
      nodeElems.forEach(({ sub }) => sub.setAttribute('opacity', wired ? 0.7 : 0));
      signals.forEach(s => s.el.setAttribute('opacity', wired ? 1 : 0));

      const label = document.getElementById('state-label-change');
      if (label) label.textContent = wired ? 'an asset.' : 'a demo.';

      document.querySelectorAll('.system-diagram .toggle button').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
      });
    }

    // ─ Animation loop (only does anything in "Built in") ──────────
    let rafId = null;
    let running = true;
    function tick() {
      if (!running) return;
      pulseT += 0.016;

      if (mode === 'wired' && !reduced) {
        signals.forEach((s, i) => {
          const dur = 2.4 + (i % 3) * 0.4;
          const p = ((pulseT / dur) + s.phase) % 1;
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          const x = s.node.px + (s.tx - s.node.px) * e;
          const y = s.node.py + (s.ty - s.node.py) * e;
          s.el.setAttribute('cx', x);
          s.el.setAttribute('cy', y);
          const op = Math.min(1, 0.4 + Math.sin(p * Math.PI) * 0.9);
          s.el.setAttribute('opacity', op);
        });

        const ringP = (pulseT * 0.6) % 1;
        centerRingPulse.setAttribute('r', 92 + ringP * 80);
        centerRingPulse.setAttribute('opacity', (1 - ringP) * 0.35);
      } else {
        centerRingPulse.setAttribute('opacity', 0);
      }

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // ─ Toggle wiring. Buttons live inside the .system-diagram container
    //   so we use the SVG's parent to scope the query and avoid leaking
    //   onto other pages.
    const diagramRoot = svg.closest('.system-diagram') || document;
    const toggleHandlers = [];
    diagramRoot.querySelectorAll('.toggle button').forEach(b => {
      const fn = () => setMode(b.dataset.mode);
      b.addEventListener('click', fn);
      toggleHandlers.push({ el: b, fn });
    });

    setMode('bolted');

    // ─ Auto-advance to "Built in" when scrolled into view ─────────
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.5) {
          if (mode === 'bolted') setMode('wired');
          obs.disconnect();
        }
      });
    }, { threshold: [0.5] });
    const diagramEl = diagramRoot.querySelector ? diagramRoot.querySelector('.diagram') : null;
    if (diagramEl) obs.observe(diagramEl);

    // ─ Hover-to-isolate (only meaningful in "Built in") ───────────
    const hoverHandlers = [];
    nodeElems.forEach((ne, i) => {
      const enter = () => {
        if (mode !== 'wired') return;
        nodeElems.forEach((other, j) => {
          if (j !== i) other.g.style.opacity = 0.32;
        });
        lineElems.forEach((L, j) => {
          L.line.setAttribute('opacity', j === i ? 1 : 0.12);
        });
        signals.forEach((s, j) => s.el.setAttribute('opacity', j === i ? 1 : 0.12));
      };
      const leave = () => {
        nodeElems.forEach(other => other.g.style.opacity = 1);
        lineElems.forEach(L => L.line.setAttribute('opacity', 0.9));
        signals.forEach(s => s.el.setAttribute('opacity', 1));
      };
      ne.g.addEventListener('mouseenter', enter);
      ne.g.addEventListener('mouseleave', leave);
      hoverHandlers.push({ el: ne.g, enter, leave });
    });

    return {
      teardown() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        obs.disconnect();
        toggleHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        hoverHandlers.forEach(({ el, enter, leave }) => {
          el.removeEventListener('mouseenter', enter);
          el.removeEventListener('mouseleave', leave);
        });
      }
    };
  }

  window.AMFSystemDiagram = { init };
})();

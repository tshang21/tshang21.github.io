// Objects drift and collide in a box. A line joins any two objects whose gap
// is below a fixed distance: the same local rule at every size.
(() => {
  const canvas = document.getElementById("scene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const countEl = document.getElementById("count");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  const START = 6;
  const MAX = 30;

  let W = 0, H = 0, link = 70;
  let objs = [];
  let colors = {};
  let visible = true;
  let rafId = 0;
  let lastT = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    colors.edge = s.getPropertyValue("--edge").trim();
    colors.obj = s.getPropertyValue("--obj").trim();
  }

  function make(x, y) {
    const r = rand(7, 14) * Math.min(1, Math.max(0.65, W / 640));
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 42);
    return {
      x: x ?? rand(r, W - r),
      y: y ?? rand(r, H - r),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      m: r * r,
    };
  }

  function updateCount() {
    if (countEl) countEl.textContent = objs.length + (objs.length === 1 ? " object" : " objects");
  }

  function add(x, y) {
    if (objs.length >= MAX) objs.shift();
    objs.push(make(x, y));
    updateCount();
    draw();
  }

  function reset() {
    objs = [];
    for (let i = 0; i < START; i++) objs.push(make());
    updateCount();
    draw();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    link = Math.max(50, W * 0.13);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const o of objs) {
      o.x = Math.min(Math.max(o.x, o.r), W - o.r);
      o.y = Math.min(Math.max(o.y, o.r), H - o.r);
    }
    draw();
  }

  function step(dt) {
    for (const o of objs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); }
      if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy); }
      if (o.y > H - o.r) { o.y = H - o.r; o.vy = -Math.abs(o.vy); }
    }
    // Elastic collisions between pairs.
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i], b = objs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = a.r + b.r;
        if (d >= minD || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const overlap = minD - d;
        const total = a.m + b.m;
        a.x -= nx * overlap * (b.m / total);
        a.y -= ny * overlap * (b.m / total);
        b.x += nx * overlap * (a.m / total);
        b.y += ny * overlap * (a.m / total);
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const impulse = (-2 * rel) / (1 / a.m + 1 / b.m);
          a.vx -= (impulse * nx) / a.m;
          a.vy -= (impulse * ny) / a.m;
          b.vx += (impulse * nx) / b.m;
          b.vy += (impulse * ny) / b.m;
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Interaction lines: stronger as objects get closer.
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i], b = objs[j];
        const gap = Math.hypot(b.x - a.x, b.y - a.y) - a.r - b.r;
        if (gap > link) continue;
        ctx.globalAlpha = 0.25 + 0.75 * (1 - Math.max(gap, 0) / link);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.obj;
    for (const o of objs) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(t) {
    const dt = Math.min((t - lastT) / 1000, 0.033);
    lastT = t;
    step(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId || reduceMotion.matches || !visible) return;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // Wiring
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    add(e.clientX - rect.left, e.clientY - rect.top);
  });
  document.getElementById("add")?.addEventListener("click", () => add());
  document.getElementById("reset")?.addEventListener("click", reset);

  new ResizeObserver(resize).observe(canvas);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);

  reduceMotion.addEventListener("change", () => (reduceMotion.matches ? stop() : start()));
  darkScheme.addEventListener("change", () => { readColors(); draw(); });

  readColors();
  resize();
  reset();
  start();
})();

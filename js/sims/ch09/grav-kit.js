/* PHY.grav: chapter 9's math and shared drawing. Load it first (after ch02/plot.js and ch03/ballistics.js).
   Numbers: g = 10 m/s², R = 6400 km, so GM = gR² = 4.096e14 m³/s². Physics is in meters and seconds.
   Sims scale for display and keep true values in getState().

   Integrator: velocity Verlet with a fixed step, which is symplectic, so orbits close instead of spiraling.
   body(x, y, vx, vy), verlet(b, h, gm), advance(b, T, hMax, gm), elements(b, gm), fly(b, {...}), orbitPath(el).
   Drawing works in screen pixels: drawEarth, drawBody, drawStars, cabin parts. Colors of the planets are
   facts about the planets, not theme colors. Everything else reads PHY.colors at draw time. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors, F = PHY.fmt;
  const G0 = 10;
  const R = 6.4e6;
  const GM = G0 * R * R;
  const TAU = Math.PI * 2;
  const KMS = 'ק"מ/ש';
  const KM = 'ק"מ';

  const vCirc = (r, gm) => Math.sqrt((gm === undefined ? GM : gm) / r);
  const period = (r, gm) => TAU * r / vCirc(r, gm);
  const gAt = (r, gm) => (gm === undefined ? GM : gm) / (r * r);
  const vEsc = (r, gm) => Math.sqrt(2 * (gm === undefined ? GM : gm) / r);
  /* The page teaches the true 11.31 km/s as 11.3 km/s. Inside that rounding a shot is on the threshold, so a sim's
     verdict agrees with the page: he does not return. E is per kilogram. Below this he is on a long ellipse. */
  const EDGE_E = 2e5;
  const onEdge = (E) => Math.abs(E) < EDGE_E;

  function accel(b, gm) {
    const r2 = b.x * b.x + b.y * b.y;
    const k = -gm / (r2 * Math.sqrt(r2));
    b.ax = k * b.x;
    b.ay = k * b.y;
  }
  function body(x, y, vx, vy, gm) {
    const b = { x: x, y: y, vx: vx, vy: vy, ax: 0, ay: 0 };
    accel(b, gm === undefined ? GM : gm);
    return b;
  }
  /* A circular orbit at radius r, at angle deg, moving counter-clockwise (dir = 1) or clockwise (-1). */
  function circular(r, deg, dir, gm) {
    const a = (deg * Math.PI) / 180;
    const v = vCirc(r, gm) * (dir || 1);
    return body(r * Math.cos(a), r * Math.sin(a), -v * Math.sin(a), v * Math.cos(a), gm);
  }
  function verlet(b, h, gm) {
    const m = gm === undefined ? GM : gm;
    b.vx += 0.5 * h * b.ax;
    b.vy += 0.5 * h * b.ay;
    b.x += h * b.vx;
    b.y += h * b.vy;
    accel(b, m);
    b.vx += 0.5 * h * b.ax;
    b.vy += 0.5 * h * b.ay;
  }
  /* Moves by exactly T seconds with steps no longer than hMax. */
  function advance(b, T, hMax, gm) {
    const n = Math.max(1, Math.ceil(T / (hMax || 5)));
    const h = T / n;
    for (let i = 0; i < n; i++) verlet(b, h, gm);
  }

  /* Orbit shape from a state. r is the distance from the center. Unbound orbits have a = ra = T = Infinity. */
  function elements(b, gm) {
    const m = gm === undefined ? GM : gm;
    const r = Math.hypot(b.x, b.y);
    const v2 = b.vx * b.vx + b.vy * b.vy;
    const E = v2 / 2 - m / r;
    const L = b.x * b.vy - b.y * b.vx;
    const rv = b.x * b.vx + b.y * b.vy;
    const ex = ((v2 - m / r) * b.x - rv * b.vx) / m;
    const ey = ((v2 - m / r) * b.y - rv * b.vy) / m;
    const e = Math.hypot(ex, ey);
    const p = (L * L) / m;
    const bound = E < 0;
    const a = bound ? -m / (2 * E) : Infinity;
    return {
      r, v: Math.sqrt(v2), E, L, e, p, a, bound,
      w: Math.atan2(ey, ex),
      rp: p / (1 + e),
      ra: bound ? p / (1 - e) : Infinity,
      T: bound ? TAU * Math.sqrt((a * a * a) / m) : Infinity,
    };
  }
  /* World points of an orbit, in meters. Unbound or huge parts are cut at rMax. */
  function orbitPath(el, n, rMax) {
    const pts = [];
    const N = n || 180;
    const lim = rMax || Infinity;
    let run = [];
    for (let i = 0; i <= N; i++) {
      const th = el.w + (i / N) * TAU;
      const d = 1 + el.e * Math.cos(th - el.w);
      const r = d > 1e-6 ? el.p / d : Infinity;
      if (r <= lim) run.push({ x: r * Math.cos(th), y: r * Math.sin(th) });
      else if (run.length) { pts.push(run); run = []; }
    }
    if (run.length) pts.push(run);
    /* A cut orbit: join the piece that crossed θ = 0 back into one line. */
    if (pts.length === 2) return [pts[1].concat(pts[0])];
    return pts;
  }
  /* Integrates a copy, to see where a launch ends up: {result: 'crash' | 'orbit' | 'away', t, pts}. */
  function fly(b0, o) {
    const b = { x: b0.x, y: b0.y, vx: b0.vx, vy: b0.vy, ax: b0.ax, ay: b0.ay };
    const el = elements(b, o.gm);
    const tMax = el.bound ? el.T : o.tMax || 1e5;
    const h = o.h || 6;
    const every = o.every || 8;
    const pts = [{ x: b.x, y: b.y }];
    let t = 0, i = 0;
    while (t < tMax) {
      verlet(b, h, o.gm);
      t += h;
      const r = Math.hypot(b.x, b.y);
      if (++i % every === 0) pts.push({ x: b.x, y: b.y });
      if (o.rMin && r < o.rMin) { pts.push({ x: b.x, y: b.y }); return { result: 'crash', t, pts }; }
      if (o.rMax && r > o.rMax) { pts.push({ x: b.x, y: b.y }); return { result: 'away', t, pts }; }
      if (i > (o.maxSteps || 6000)) break;
    }
    pts.push({ x: b.x, y: b.y });
    return { result: el.bound ? 'orbit' : 'away', t, pts };
  }
  /* The two burns between circular orbits, and the time between them. */
  function hohmann(r1, r2, gm) {
    const a = (r1 + r2) / 2;
    const m = gm === undefined ? GM : gm;
    const v1 = vCirc(r1, m), v2 = vCirc(r2, m);
    const vp = Math.sqrt(m * (2 / r1 - 1 / a));
    const va = Math.sqrt(m * (2 / r2 - 1 / a));
    return { dv1: vp - v1, dv2: v2 - va, a, t: Math.PI * Math.sqrt((a * a * a) / m) };
  }

  /* ---------- Formatting ---------- */
  function commas(x) {
    return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  const km = (m) => commas(m / 1000) + ' ' + KM;
  const kms = (v, digits) => F.unit(v / 1000, KMS, digits === undefined ? 1 : digits);
  /* Seconds as the friendliest unit: minutes, hours or days. */
  function dur(s, digits) {
    if (!isFinite(s)) return 'אין';
    if (s < 100 * 60) return F.unit(s / 60, "דק'", digits === undefined ? 0 : digits);
    if (s < 48 * 3600) return F.unit(s / 3600, 'שעות', digits === undefined ? 1 : digits);
    return F.unit(s / 86400, 'ימים', digits === undefined ? 1 : digits);
  }

  /* Keeps symbols such as 22°, ×2, 25% and 1.5R in reading order inside Hebrew text. */
  const ltr = (s) => '\u200e' + s + '\u200e';
  const deg = (x, digits) => ltr(F.deg(x, digits));

  /* A sim at rest does not need 60 repaints a second. drawNow() answers true every frame while busy() is true or
     just after the reader touched something, and only now and then otherwise. The picture stays on the canvas. */
  function idleGate(view, controlsEl, busy) {
    let hot = 20, n = 0;
    const wake = function () { hot = 20; };
    [controlsEl, view.canvas].forEach(function (el) {
      if (!el) return;
      ['input', 'change', 'click', 'pointerdown', 'pointermove'].forEach(function (t) { el.addEventListener(t, wake, { passive: true }); });
    });
    view.onResize(wake);
    document.addEventListener('phy:theme', wake);
    return function drawNow() {
      if (busy()) { hot = 20; return true; }
      if (hot > 0) { hot--; return true; }
      return n++ % 15 === 0;
    };
  }

  /* ---------- Drawing, in screen pixels ---------- */
  const OCEAN = 'rgb(66, 134, 214)';
  const LAND = 'rgb(92, 176, 96)';
  const OUTLINE = 'rgb(38, 56, 92)';
  const BLOBS = [
    [[-0.75, 0.45], [-0.3, 0.72], [0.05, 0.55], [-0.08, 0.2], [-0.42, 0.05], [-0.66, 0.15]],
    [[-0.22, -0.1], [0.12, -0.08], [0.22, -0.42], [0.02, -0.82], [-0.2, -0.58]],
    [[0.34, 0.62], [0.82, 0.42], [0.86, 0.02], [0.52, -0.1], [0.34, 0.14], [0.22, 0.38]],
    [[0.55, -0.44], [0.8, -0.38], [0.74, -0.68], [0.5, -0.66]],
  ];
  /* (px, py) center, pr radius. opt: {rot: degrees, flat: no shading} */
  function drawEarth(view, px, py, pr, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    ctx.save();
    if (pr > 10) {
      ctx.beginPath();
      ctx.arc(px, py, pr + Math.min(5, pr * 0.05), 0, TAU);
      ctx.fillStyle = 'rgba(120, 180, 240, 0.25)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = OCEAN;
    ctx.fill();
    if (pr > 6) {
      ctx.save();
      ctx.clip();
      ctx.translate(px, py);
      if (opt.rot) ctx.rotate((-opt.rot * Math.PI) / 180);
      ctx.fillStyle = LAND;
      BLOBS.forEach(function (b) {
        ctx.beginPath();
        const n = b.length;
        for (let i = 0; i < n; i++) {
          const a = b[i], c = b[(i + 1) % n];
          const mx = ((a[0] + c[0]) / 2) * pr, my = ((a[1] + c[1]) / 2) * pr;
          if (i === 0) ctx.moveTo(mx, my);
          const d = b[(i + 2) % n];
          ctx.quadraticCurveTo(c[0] * pr, c[1] * pr, ((c[0] + d[0]) / 2) * pr, ((c[1] + d[1]) / 2) * pr);
        }
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.lineWidth = pr > 10 ? 2 : 1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }

  const PLANETS = {
    moon: { fill: 'rgb(176, 178, 186)', spot: 'rgb(138, 140, 150)' },
    mars: { fill: 'rgb(206, 104, 66)', spot: 'rgb(160, 72, 44)' },
    jupiter: { fill: 'rgb(216, 176, 132)', band: 'rgb(170, 118, 80)' },
    custom: { fill: 'rgb(128, 148, 206)', spot: 'rgb(96, 114, 170)' },
  };
  function drawPlanet(view, kind, px, py, pr) {
    if (kind === 'earth') { drawEarth(view, px, py, pr); return; }
    const k = PLANETS[kind] || PLANETS.custom;
    const ctx = view.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = k.fill;
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (k.band) {
      ctx.fillStyle = k.band;
      [-0.5, -0.1, 0.34].forEach(function (y, i) { ctx.fillRect(px - pr, py + y * pr, pr * 2, pr * (i === 1 ? 0.2 : 0.13)); });
    } else {
      ctx.fillStyle = k.spot;
      [[-0.35, -0.3, 0.2], [0.3, 0.1, 0.26], [-0.15, 0.48, 0.15], [0.42, -0.5, 0.13]].forEach(function (s) {
        ctx.beginPath();
        ctx.arc(px + s[0] * pr, py + s[1] * pr, s[2] * pr, 0, TAU);
        ctx.fill();
      });
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.lineWidth = pr > 10 ? 2 : 1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }

  /* A few fixed faint stars behind everything. */
  function drawStars(view, count) {
    const ctx = view.ctx;
    const w = view.w, h = view.h;
    ctx.save();
    ctx.fillStyle = C.soft;
    for (let i = 0; i < (count || 46); i++) {
      const x = (((i * 7919) % 1009) / 1009) * w;
      const y = (((i * 104729) % 1013) / 1013) * h;
      ctx.globalAlpha = 0.2 + ((i * 31) % 5) * 0.07;
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + ((i * 13) % 3) * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* A small satellite with solar panels, centered at (px, py). */
  function drawSat(view, px, py, size, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    const s = size || 14;
    ctx.save();
    ctx.translate(px, py);
    if (opt.rot) ctx.rotate(opt.rot);
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.soft;
    ctx.fillRect(-s * 1.1, -s * 0.22, s * 0.68, s * 0.44);
    ctx.strokeRect(-s * 1.1, -s * 0.22, s * 0.68, s * 0.44);
    ctx.fillRect(s * 0.42, -s * 0.22, s * 0.68, s * 0.44);
    ctx.strokeRect(s * 0.42, -s * 0.22, s * 0.68, s * 0.44);
    ctx.fillStyle = opt.color || C.gold;
    ctx.fillRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
    ctx.strokeRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
    ctx.restore();
  }

  /* A bathroom scale in pixels: the platform's top center at (px, py), with its reading on the front. */
  function drawScale(view, px, py, w, text, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    const h = opt.h || 24;
    ctx.save();
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px - w / 2, py, w, h, 6);
    else ctx.rect(px - w / 2, py, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    view.screenText(px, py + h / 2 + 0.5, text, { size: opt.size || 12.5, weight: 700, color: opt.color || C.ink });
  }

  /* Draws an open polyline of world points given a world-to-pixel function. */
  function drawPath(view, pts, map, opt) {
    if (pts.length < 2) return;
    const ctx = view.ctx;
    ctx.save();
    ctx.strokeStyle = opt.color;
    ctx.lineWidth = opt.width || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    if (opt.dash) ctx.setLineDash(opt.dash);
    ctx.beginPath();
    pts.forEach(function (p, i) {
      const q = map(p);
      if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  /* An arrow in pixels: the same look as view.arrow, without world coordinates. */
  function pxArrow(view, x1, y1, x2, y2, opt) {
    const a = view.toWorld(x1, y1), b = view.toWorld(x2, y2);
    view.arrow(a.x, a.y, b.x, b.y, opt);
  }

  PHY.grav = {
    G0, R, GM, TAU, KMS, KM,
    vCirc, period, gAt, vEsc, onEdge, body, circular, verlet, advance, elements, orbitPath, fly, hohmann,
    commas, km, kms, dur, ltr, deg, idleGate,
    drawEarth, drawPlanet, drawStars, drawSat, drawScale, drawPath, pxArrow,
  };
})();

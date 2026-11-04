/* PHY.ch08: chapter 8 helpers. Numbers: period, pendPeriod, verlet, pendStep, cycleMeter.
   Drawing (world endpoints, pixel widths): spring, wall, floor, cart, fitTop.
   Everything reads PHY.colors at draw time. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors;
  const TAU = Math.PI * 2;

  const period = (m, k) => TAU * Math.sqrt(m / k);
  const pendPeriod = (L, g) => TAU * Math.sqrt(L / g);

  /* One velocity Verlet step for a(x). Returns the new {x, v}. */
  function verlet(x, v, acc, dt) {
    const a0 = acc(x);
    const nx = x + v * dt + 0.5 * a0 * dt * dt;
    return { x: nx, v: v + 0.5 * (a0 + acc(nx)) * dt };
  }

  /* One RK4 step of the real pendulum equation, th'' = -(g/L) sin(th) - damp * th'. */
  function pendStep(th, om, gOverL, dt, damp) {
    const c = damp || 0;
    const f = (t, o) => -gOverL * Math.sin(t) - c * o;
    const k1t = om, k1o = f(th, om);
    const k2t = om + (dt / 2) * k1o, k2o = f(th + (dt / 2) * k1t, om + (dt / 2) * k1o);
    const k3t = om + (dt / 2) * k2o, k3o = f(th + (dt / 2) * k2t, om + (dt / 2) * k2o);
    const k4t = om + dt * k3o, k4o = f(th + dt * k3t, om + dt * k3o);
    return {
      th: th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
      om: om + (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o),
    };
  }

  /* Counts full cycles from a start at rest at an extreme. side is +1 if that extreme is the positive
     one. A cycle ends when the velocity crosses zero back at that same extreme. */
  function cycleMeter(side) {
    let prev = null;
    const m = {
      n: 0, last: 0,
      feed(u, t, dt) {
        const a = prev === null ? null : side * prev, b = side * u;
        if (a !== null && a > 0 && b <= 0) {
          m.last = t - dt + (dt * a) / (a - b);
          m.n++;
        }
        prev = u;
        return m;
      },
      get T() { return m.n ? m.last / m.n : null; },
    };
    return m;
  }

  /* A coil between two world points. The number of coils stays fixed, so a stretched spring looks stretched. */
  function spring(view, x1, y1, x2, y2, o) {
    o = o || {};
    const ctx = view.ctx;
    const ax = view.sx(x1), ay = view.sy(y1), bx = view.sx(x2), by = view.sy(y2);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const coils = o.coils || 8, amp = o.amp || 8, lead = Math.min(9, len * 0.12);
    ctx.save();
    ctx.strokeStyle = o.color || C.axis;
    ctx.lineWidth = o.width || 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + ux * lead, ay + uy * lead);
    const body = len - 2 * lead, n = coils * 2;
    for (let i = 0; i < n; i++) {
      const s = lead + (body * (i + 0.5)) / n, side = i % 2 ? -1 : 1;
      ctx.lineTo(ax + ux * s + nx * amp * side, ay + uy * s + ny * amp * side);
    }
    ctx.lineTo(bx - ux * lead, by - uy * lead);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  /* A wall whose face is at world x, 60 px thick at most (less when the canvas edge is nearer). */
  function wall(view, x, y0, y1) {
    const left = Math.max(view.visible.xMin, x - 60 / view.scale);
    view.poly([{ x: left, y: y0 }, { x: x, y: y0 }, { x: x, y: y1 }, { x: left, y: y1 }], { fill: C.gridStrong, close: true });
    view.line(x, y0, x, y1, { color: C.axis, width: 2.5, cap: 'butt' });
  }

  function floor(view, y, x0, x1) {
    const r = view.visible;
    view.line(x0 === undefined ? r.xMin : x0, y, x1 === undefined ? r.xMax : x1, y, { color: C.axis, width: 2.5, cap: 'butt' });
  }

  /* A little cart on the floor at world (x, y), and the cat on it. Returns the height of its deck in meters. */
  function cart(view, x, y, o) {
    o = o || {};
    const ctx = view.ctx;
    const w = o.w || 46, h = o.h || 10, r = 4.5;
    const px = view.sx(x), py = view.sy(y);
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = C.ink;
    [-0.3, 0.3].forEach(function (k) {
      ctx.beginPath();
      ctx.arc(px + k * w, py - r, r, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = o.color || C.soft;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const top = py - 2 * r - h + 2;
    if (ctx.roundRect) ctx.roundRect(px - w / 2, top, w, h, 3);
    else ctx.rect(px - w / 2, top, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const deck = (2 * r + h - 2) / view.scale;
    if (o.cat !== false) PHY.mascot.draw(view, x, y + deck - 2 / view.scale, { pose: o.pose || 'standing', px: o.catPx || 52, alpha: o.alpha, flipX: o.flipX });
    return deck;
  }

  /* Sets the view's world so that a scene spanning xMin..xMax sits at the top of the canvas, taking at most
     `frac` of its height, with the rest left free for graphs. top is the world y of the upper edge. */
  function fitTop(view, o) {
    const pad = 6;
    const W = view.w - pad * 2, H = view.h - pad * 2;
    const s = Math.min(W / (o.xMax - o.xMin), (H * (o.frac || 0.45)) / (o.top - o.bottom));
    const cx = (o.xMin + o.xMax) / 2;
    view.setWorld({ xMin: cx - W / (2 * s), xMax: cx + W / (2 * s), yMax: o.top, yMin: o.top - H / s });
  }

  PHY.ch08 = { TAU, period, pendPeriod, verlet, pendStep, cycleMeter, spring, wall, floor, cart, fitTop };
})();

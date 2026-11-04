/* PHY.ballistics: the one place chapter 3 does projectile math, plus small shared drawing helpers.
   Load it before the other ch03 sims. Angles are degrees, y is up, g = 10 m/s² unless a sim passes its own.
   at(v0, deg, t, h0, g) -> {x, y, vx, vy}. flightTime / range / maxHeight land on y = floor (default 0).
   tweens(): dt-driven animation that pauses with the sim. drawCannon, drawApple, drawGround use PHY.colors live. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors;
  const RAD = Math.PI / 180;
  const G = 10;

  function comps(v0, deg) { return { vx: v0 * Math.cos(deg * RAD), vy: v0 * Math.sin(deg * RAD) }; }

  function at(v0, deg, t, h0, g) {
    const c = comps(v0, deg);
    const gg = g === undefined ? G : g;
    return { x: c.vx * t, y: (h0 || 0) + c.vy * t - 0.5 * gg * t * t, vx: c.vx, vy: c.vy - gg * t };
  }

  /* Positive root of y(t) = floor. */
  function flightTime(v0, deg, h0, floor) {
    const vy = comps(v0, deg).vy;
    const dy = (h0 || 0) - (floor || 0);
    return (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * dy))) / G;
  }
  function range(v0, deg, h0, floor) { return comps(v0, deg).vx * flightTime(v0, deg, h0, floor); }
  function apexTime(v0, deg) { return Math.max(0, comps(v0, deg).vy / G); }
  function maxHeight(v0, deg, h0) {
    const vy = Math.max(0, comps(v0, deg).vy);
    return (h0 || 0) + (vy * vy) / (2 * G);
  }
  function path(v0, deg, h0, floor, n) {
    const T = flightTime(v0, deg, h0, floor);
    const pts = [];
    const N = n || 60;
    for (let i = 0; i <= N; i++) {
      const p = at(v0, deg, (T * i) / N, h0);
      pts.push({ x: p.x, y: p.y });
    }
    return pts;
  }

  /* Scripted animation driven from a sim's step(dt), so it pauses offscreen with everything else.
     clear() resolves whatever is pending, so a PredictCard can never hang on a reset. */
  function tweens() {
    let list = [];
    return {
      add(T, fn) {
        return new Promise(function (resolve) { list.push({ t: 0, T: T, fn: fn, resolve: resolve }); });
      },
      step(dt) {
        list.slice().forEach(function (w) {
          w.t += dt;
          const k = Math.min(w.t / w.T, 1);
          if (w.fn) w.fn(k);
          if (k >= 1) {
            list.splice(list.indexOf(w), 1);
            w.resolve();
          }
        });
      },
      clear() {
        const old = list;
        list = [];
        old.forEach(function (w) { w.resolve(); });
      },
      get busy() { return list.length > 0; },
    };
  }

  /* A cannon whose pivot is at (x, y). Sizes in pixels, so it stays readable on a phone. */
  function drawCannon(view, x, y, deg, o) {
    o = o || {};
    const len = o.len || 34;
    const w = o.w || 13;
    const ctx = view.ctx;
    const px = view.sx(x), py = view.sy(y);
    ctx.save();
    ctx.translate(px, py);
    ctx.save();
    ctx.rotate((-deg * Math.PI) / 180);
    ctx.fillStyle = C.axis;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -w / 2 - 1);
    ctx.lineTo(len, -w / 2 + 1.5);
    ctx.lineTo(len, w / 2 - 1.5);
    ctx.lineTo(-6, w / 2 + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.axis;
    ctx.stroke();
    ctx.restore();
  }

  function drawApple(view, x, y, px, o) {
    o = o || {};
    const ctx = view.ctx;
    const r = (px || 14) / 2;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = o.color || C.apple;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (!o.plain) {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.28, -r * 1.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(r * 0.62, -r * 1.25, r * 0.42, r * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = C.leaf;
      ctx.fill();
    }
    ctx.restore();
  }

  /* The floor: a line across the canvas with a shaded strip under it and meter labels. */
  function drawGround(view, y, o) {
    o = o || {};
    const r = view.visible;
    view.poly([{ x: r.xMin, y: y }, { x: r.xMax, y: y }, { x: r.xMax, y: r.yMin }, { x: r.xMin, y: r.yMin }], { fill: C.shade, close: true });
    view.line(r.xMin, y, r.xMax, y, { color: C.axis, width: 2.5 });
    if (o.every) {
      const from = o.from === undefined ? o.every : o.from;
      for (let m = from; m <= r.xMax - 1; m += o.every) {
        view.line(m, y - 3 / view.scale, m, y + 3 / view.scale, { color: C.axis, width: 1.5 });
        view.text(m, y, PHY.fmt.unit(m, 'm', 0), { size: 11, color: C.soft, offset: [0, 13] });
      }
    }
  }

  PHY.ballistics = { G, comps, at, flightTime, range, apexTime, maxHeight, path, tweens, drawCannon, drawApple, drawGround };
})();

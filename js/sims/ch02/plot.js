/* PHY.ch02: chapter 2 drawing helpers. Graphs have different scales on each axis, which the uniform
   world coordinates of PHY.canvas cannot do, so these work in screen pixels.

   Plot(view, {tMin, tMax, yMin, yMax, title, tLabel}): a small graph.
     .box(x, y, w, h)  place it (outer box in pixels; margins for tick labels are inside)
     .frame()          grid, axes, ticks, title
     .curve(pts, opt)  pts: [{t, y}] ; .fill(pts, opt) area between the curve and y = 0
     .dot, .vline, .hline, .rect, .text, .X(t), .Y(y), .range({...})
   pix(view): line, arrow, poly, circle, cat in pixel coordinates.
   drawCar, drawApple, tweens: small shared drawing and animation helpers. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt;
  const C = PHY.colors;

  function niceStep(span, count) {
    const raw = Math.abs(span) / (count || 5) || 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* Rounds a data range outward to tidy numbers, with a minimum span. */
  function niceRange(lo, hi, minSpan) {
    if (hi - lo < (minSpan || 1)) {
      const mid = (hi + lo) / 2;
      lo = mid - (minSpan || 1) / 2;
      hi = mid + (minSpan || 1) / 2;
    }
    const step = niceStep(hi - lo, 5);
    return { min: Math.floor(lo / step + 1e-9) * step, max: Math.ceil(hi / step - 1e-9) * step };
  }

  function pix(view) {
    const w = (x, y) => view.toWorld(x, y);
    return {
      line(x1, y1, x2, y2, opt) { const a = w(x1, y1), b = w(x2, y2); view.line(a.x, a.y, b.x, b.y, opt); },
      arrow(x1, y1, x2, y2, opt) { const a = w(x1, y1), b = w(x2, y2); view.arrow(a.x, a.y, b.x, b.y, opt); },
      poly(pts, opt) { view.poly(pts.map((p) => w(p.x, p.y)), opt); },
      circle(x, y, r, opt) { const a = w(x, y); view.circle(a.x, a.y, r, Object.assign({}, opt, { px: true })); },
      cat(x, y, opt) { const a = w(x, y); PHY.mascot.draw(view, a.x, a.y, opt); },
    };
  }

  function Plot(view, o) {
    o = Object.assign({ tMin: 0, tMax: 10, yMin: 0, yMax: 10 }, o || {});
    const P = pix(view);
    let r = { x: 0, y: 0, w: 100, h: 100 };
    const plot = {
      o,
      get r() { return r; },
      range(v) { Object.assign(o, v); return plot; },
      box(x, y, w, h) {
        const left = o.compact ? 26 : 34, top = o.compact ? 12 : 22, bottom = o.compact ? 4 : 20;
        r = { x: x + left, y: y + top, w: Math.max(10, w - left - 10), h: Math.max(10, h - top - bottom) };
        return plot;
      },
      X: (t) => r.x + ((t - o.tMin) / (o.tMax - o.tMin || 1)) * r.w,
      Y: (y) => r.y + r.h - ((y - o.yMin) / (o.yMax - o.yMin || 1)) * r.h,
      clip(fn) {
        const ctx = view.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x - 1, r.y - 2, r.w + 2, r.h + 4);
        ctx.clip();
        fn();
        ctx.restore();
      },
      frame() {
        const yStep = o.yTick || niceStep(o.yMax - o.yMin, r.h < 90 ? 2 : 4);
        const tStep = o.tTick || niceStep(o.tMax - o.tMin, r.w < 180 ? 4 : 6);
        for (let j = Math.ceil(o.yMin / yStep - 1e-9); j * yStep <= o.yMax + 1e-9; j++) {
          const py = plot.Y(j * yStep);
          P.line(r.x, py, r.x + r.w, py, { color: C.grid, width: 1 });
          if (!o.noTicks) view.screenText(r.x - 5, py, F.num(j * yStep), { size: 10.5, color: C.soft, align: 'right' });
        }
        for (let i = Math.ceil(o.tMin / tStep - 1e-9); i * tStep <= o.tMax + 1e-9; i++) {
          const px = plot.X(i * tStep);
          P.line(px, r.y, px, r.y + r.h, { color: C.grid, width: 1 });
          if (!o.noTicks) view.screenText(px, r.y + r.h + 10, F.num(i * tStep), { size: 10.5, color: C.soft });
        }
        P.line(r.x, r.y, r.x, r.y + r.h, { color: C.axis, width: 1.5 });
        const zero = o.yMin <= 0 && o.yMax >= 0 ? plot.Y(0) : r.y + r.h;
        P.line(r.x, zero, r.x + r.w, zero, { color: C.axis, width: 1.5 });
        if (o.title) view.screenText(r.x + 2, r.y - 11, o.title, { size: o.compact ? 10.5 : 12, weight: 700, align: 'left', color: o.titleColor ? C[o.titleColor] : C.ink });
        const tl = o.tLabel === undefined ? "t (ש')" : o.tLabel;
        if (tl) view.screenText(r.x + r.w, r.y - 11, tl, { size: 11, color: C.soft, align: 'right' });
        return plot;
      },
      curve(pts, opt) {
        opt = opt || {};
        if (pts.length < 2) return plot;
        plot.clip(function () {
          P.poly(pts.map((p) => ({ x: plot.X(p.t), y: plot.Y(p.y) })), { color: opt.color || C.ink, width: opt.width || 2.6, dash: opt.dash, alpha: opt.alpha });
        });
        return plot;
      },
      fill(pts, opt) {
        opt = opt || {};
        if (pts.length < 2) return plot;
        const base = o.yMin <= 0 && o.yMax >= 0 ? 0 : o.yMin;
        const poly = [{ x: plot.X(pts[0].t), y: plot.Y(base) }]
          .concat(pts.map((p) => ({ x: plot.X(p.t), y: plot.Y(p.y) })))
          .concat([{ x: plot.X(pts[pts.length - 1].t), y: plot.Y(base) }]);
        plot.clip(function () { P.poly(poly, { fill: opt.color || C.displacement, alpha: opt.alpha === undefined ? 0.22 : opt.alpha, close: true }); });
        return plot;
      },
      rect(t0, t1, y0, y1, opt) {
        opt = opt || {};
        const pts = [{ x: plot.X(t0), y: plot.Y(y0) }, { x: plot.X(t1), y: plot.Y(y0) }, { x: plot.X(t1), y: plot.Y(y1) }, { x: plot.X(t0), y: plot.Y(y1) }];
        plot.clip(function () { P.poly(pts, { fill: opt.fill, color: opt.color, width: opt.width || 1, alpha: opt.alpha, close: true }); });
        return plot;
      },
      dot(t, y, opt) {
        opt = opt || {};
        P.circle(plot.X(t), plot.Y(y), opt.r || 5.5, { fill: opt.color || C.ink, color: C.surface, width: 2 });
        return plot;
      },
      vline(t, opt) {
        opt = opt || {};
        P.line(plot.X(t), r.y, plot.X(t), r.y + r.h, { color: opt.color || C.soft, width: opt.width || 1.5, dash: opt.dash || [5, 5] });
        return plot;
      },
      hline(y, opt) {
        opt = opt || {};
        P.line(r.x, plot.Y(y), r.x + r.w, plot.Y(y), { color: opt.color || C.soft, width: opt.width || 1.5, dash: opt.dash || [5, 5] });
        return plot;
      },
      text(t, y, str, opt) {
        view.screenText(plot.X(t), plot.Y(y), str, Object.assign({ size: 12, halo: true }, opt));
        return plot;
      },
    };
    return plot;
  }

  /* A little car. (px, py) is the middle of the wheels' contact line. */
  function drawCar(view, px, py, opt) {
    opt = opt || {};
    const w = opt.w || 46;
    const h = w * 0.42;
    const ctx = view.ctx;
    ctx.save();
    ctx.translate(px, py);
    if (opt.flip) ctx.scale(-1, 1);
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#3B2A20';
    ctx.fillStyle = PHY.colors.accent;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.24);
    ctx.lineTo(-w / 2, -h * 0.72);
    ctx.lineTo(-w * 0.26, -h * 0.76);
    ctx.lineTo(-w * 0.12, -h * 1.16);
    ctx.lineTo(w * 0.18, -h * 1.16);
    ctx.lineTo(w * 0.32, -h * 0.72);
    ctx.lineTo(w / 2, -h * 0.58);
    ctx.lineTo(w / 2, -h * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF3DF';
    ctx.beginPath();
    ctx.moveTo(-w * 0.07, -h * 0.76);
    ctx.lineTo(-w * 0.07, -h * 1.05);
    ctx.lineTo(w * 0.15, -h * 1.05);
    ctx.lineTo(w * 0.24, -h * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    [-0.27, 0.27].forEach(function (k) {
      ctx.fillStyle = '#3B2A20';
      ctx.beginPath();
      ctx.arc(k * w, -h * 0.22, h * 0.24, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /* An apple centered at (px, py). */
  function drawApple(view, px, py, r, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    ctx.save();
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.translate(px, py);
    ctx.fillStyle = PHY.colors.apple;
    ctx.strokeStyle = '#3B2A20';
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, r * 0.06, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(r * 0.12, -r * 1.3);
    ctx.stroke();
    ctx.fillStyle = PHY.colors.leaf;
    ctx.beginPath();
    ctx.ellipse(r * 0.48, -r * 1.05, r * 0.42, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Tweens driven by the sim's step(dt), so they pause together with the sim when it is offscreen. */
  function tweens() {
    let list = [];
    return {
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
      run(T, fn) { return new Promise(function (resolve) { list.push({ t: 0, T: T, fn: fn, resolve: resolve }); }); },
      /* Pending promises resolve, so an `await` on a cancelled tween never hangs its caller. */
      clear() { const old = list; list = []; old.forEach(function (w) { w.resolve(); }); },
      get busy() { return list.length > 0; },
    };
  }

  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* Level pips and the end-of-game star panel, used by every game in this chapter. */
  function gameHud(controlsEl, names) {
    const U = PHY.ui;
    const levels = U.h('div', { class: 'game-levels' });
    const pips = names.map(function (n) { const p = U.h('span', { class: 'game-pip', text: n }); levels.appendChild(p); return p; });
    const main = U.h('div', { class: 'game-hud' });
    const task = U.h('div', { class: 'game-task' });
    const feedback = U.h('div', { class: 'game-feedback', role: 'status' });
    const final = U.h('div', { class: 'game-final', hidden: true });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [levels, main, final]));
    return {
      levels, pips, main, task, feedback, final,
      paint(level, points, done) {
        pips.forEach(function (p, i) {
          p.className = 'game-pip' + (i === level && !done ? ' is-now' : '') + (points[i] !== undefined ? ' is-done' : '');
        });
      },
      say(text, kind) { feedback.textContent = text; feedback.className = 'game-feedback ' + (kind || ''); },
      setTask(html) { task.innerHTML = html; U.renderMath(task); },
      showFinal(stars, text, again) {
        main.hidden = true;
        final.hidden = false;
        final.innerHTML = '';
        U.StarScore(final, { value: stars, animate: true });
        final.appendChild(U.h('div', { class: 'game-task', text: text }));
        U.Button(final, 'עוד סיבוב', again, { primary: true });
        U.burst(final, 30);
      },
      showMain() { main.hidden = false; final.hidden = true; },
    };
  }

  PHY.ch02 = { Plot, pix, niceStep, niceRange, drawCar, drawApple, tweens, shuffle, pick, gameHud };
})();

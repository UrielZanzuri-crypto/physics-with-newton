/* PHY.sims.comFlight: bodies in free flight, made of real point masses held together by stiff rods.
   Nothing here tells the center of mass where to go: each point feels gravity, the rods only pull in equal and
   opposite pairs, and the center of mass is computed from the points afterward.
   shape 'hammer': a heavy head and a light end. 'ring': a hoop whose center of mass sits in the empty middle.
   'firework': one shell that bursts at the top into pieces with unequal masses and zero total momentum.
   opts: {shape, vx, vy, spin (deg/s), slow, locked}. sim.play() -> Promise. setParam: spin, locked.
   getState(): comX, comY and the parabola's value at the same time, for comparing. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07;
  const G = 10;
  const RAD = Math.PI / 180;

  const SETUP = {
    hammer: { world: { xMin: -1.6, xMax: 12.6, yMin: -0.4, yMax: 6.3 }, aspect: 2, vx: 6, vy: 8, spin: 600, y0: 1.4, x0: 0, T: 1.6, slow: 0.42 },
    ring: { world: { xMin: -1.6, xMax: 12.6, yMin: -0.4, yMax: 6.3 }, aspect: 2, vx: 6, vy: 8, spin: 300, y0: 1.4, x0: 0, T: 1.6, slow: 0.42 },
    firework: { world: { xMin: -4, xMax: 56, yMin: -16, yMax: 27 }, aspect: 1.4, vx: 10, vy: 20, spin: 0, y0: 0, x0: 0, T: 4, slow: 0.62, burstAt: 2 },
  };

  PHY.sims.comFlight = function (canvasEl, controlsEl, opts) {
    const setup = Object.assign({}, SETUP[(opts && opts.shape) || 'hammer']);
    opts = Object.assign({ shape: 'hammer', locked: true, rng: Math.random }, setup, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: opts.world, aspect: opts.aspect, minHeight: opts.shape === 'firework' ? 300 : 240, maxHeight: 440 });
    const S = {};

    /* ---------- the body as particles and rods ---------- */
    function build() {
      const a = -60 * RAD;
      const om = opts.spin * RAD;
      const pts = [], rods = [];
      if (opts.shape === 'hammer') {
        const L = 1.7;
        /* head of 3 kg, end of 1 kg: the center of mass is a quarter of the way from the head. */
        const mHead = 3, mEnd = 1;
        const dHead = (L * mEnd) / (mHead + mEnd), dEnd = (L * mHead) / (mHead + mEnd);
        const ux = Math.cos(a), uy = Math.sin(a);
        pts.push(particle(mHead, dHead * ux, dHead * uy, om));
        pts.push(particle(mEnd, -dEnd * ux, -dEnd * uy, om));
        rods.push([0, 1, L]);
      } else if (opts.shape === 'ring') {
        const n = 12, R = 1.05;
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2 + a;
          pts.push(particle(1, R * Math.cos(t), R * Math.sin(t), om));
        }
        for (let i = 0; i < n; i++) {
          const d = 2 * R * Math.sin(Math.PI / n);
          rods.push([i, (i + 1) % n, d]);
          if (i < n / 2) rods.push([i, i + n / 2, 2 * R]);
          rods.push([i, (i + 3) % n, 2 * R * Math.sin((3 * Math.PI) / n)]);
        }
      } else {
        pts.push(particle(12, 0, 0, 0));
      }
      return { pts, rods };
    }
    function particle(m, dx, dy, om) {
      return { m: m, x: opts.x0 + dx, y: opts.y0 + dy, vx: opts.vx - om * dy, vy: opts.vy + om * dx, trail: [] };
    }

    function clear() {
      const b = build();
      Object.assign(S, {
        pts: b.pts, rods: b.rods, t: 0, phase: 'ready', burst: false, comTrail: [], nextTrail: 0, flash: 0,
        maxDev: 0, caption: '', pose: 'thinking',
      });
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    function com() {
      let m = 0, x = 0, y = 0, vx = 0, vy = 0;
      S.pts.forEach(function (p) { m += p.m; x += p.m * p.x; y += p.m * p.y; vx += p.m * p.vx; vy += p.m * p.vy; });
      return { x: x / m, y: y / m, vx: vx / m, vy: vy / m, m: m };
    }
    function ideal(t) {
      return { x: opts.x0 + opts.vx * t, y: opts.y0 + opts.vy * t - 0.5 * G * t * t };
    }

    function physics(h) {
      S.pts.forEach(function (p) {
        p.px = p.x; p.py = p.y;
        /* Exact for constant gravity, so the time step leaves no trace in the parabola. */
        p.x += p.vx * h;
        p.y += p.vy * h - 0.5 * G * h * h;
      });
      /* Rods: each correction moves two points in opposite directions, weighted so the center of mass stays put. */
      for (let it = 0; it < (S.rods.length > 1 ? 6 : 1); it++) {
        S.rods.forEach(function (r) {
          const a = S.pts[r[0]], b = S.pts[r[1]];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-9;
          const e = (d - r[2]) / d;
          const w = a.m + b.m;
          a.x += dx * e * (b.m / w); a.y += dy * e * (b.m / w);
          b.x -= dx * e * (a.m / w); b.y -= dy * e * (a.m / w);
        });
      }
      S.pts.forEach(function (p) {
        p.vx = (p.x - p.px) / h;
        p.vy = (p.y - p.py) / h - 0.5 * G * h;
      });
      S.t += h;
    }

    function burst() {
      /* Unequal pieces with random velocities. Their average is removed, so the total momentum does not change. */
      const shell = S.pts[0];
      const ms = [1, 1, 1, 1, 2, 2, 2, 2];
      const pieces = ms.map(function (m, i) {
        const a = (i / ms.length) * Math.PI * 2 + (opts.rng() - 0.5) * 0.5;
        const sp = (3 + opts.rng() * 3) * (m === 1 ? 1.25 : 0.75);
        return { m: m, x: shell.x, y: shell.y, vx: shell.vx + sp * Math.cos(a), vy: shell.vy + sp * Math.sin(a), trail: [{ x: shell.x, y: shell.y }] };
      });
      let M = 0, px = 0, py = 0;
      pieces.forEach(function (p) { M += p.m; px += p.m * p.vx; py += p.m * p.vy; });
      const dx = px / M - shell.vx, dy = py / M - shell.vy;
      pieces.forEach(function (p) { p.vx -= dx; p.vy -= dy; });
      S.pts = pieces;
      S.burst = true;
      S.flash = 1;
      S.caption = 'בום! ומרכז המסה לא שמע על זה';
      S.pose = 'dizzy';
    }

    function launch() {
      clear();
      S.phase = 'fly';
      S.pose = 'flying';
      if (opts.shape === 'firework') S.caption = 'טס על פרבולה רגילה...';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function step(dt) {
      if (S.phase !== 'fly') return;
      const h = (dt * opts.slow) / 2;
      for (let i = 0; i < 2; i++) {
        const left = opts.T - S.t;
        if (left > 1e-9) physics(Math.min(h, left));
      }
      if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.2);
      const c = com();
      const q = ideal(S.t);
      S.maxDev = Math.max(S.maxDev, Math.hypot(c.x - q.x, c.y - q.y));
      if (opts.burstAt && !S.burst && S.t >= opts.burstAt) burst();
      if (S.t >= S.nextTrail) {
        S.comTrail.push({ x: c.x, y: c.y });
        S.pts.forEach(function (p) { p.trail.push({ x: p.x, y: p.y }); });
        S.nextTrail += 0.03;
      }
      if (S.t >= opts.T - 1e-9) {
        S.phase = 'done';
        S.pose = 'happy';
        S.caption = opts.shape === 'firework' ? 'הרסיסים בכל מקום. מרכז המסה על הפרבולה.' : opts.shape === 'ring' ? 'הנקודה הזהובה: באמצע, באוויר, על פרבולה.' : 'הנקודה הזהובה: פרבולה נקייה';
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    const spinSlider = opts.shape === 'firework' ? null : U.Slider(controlsEl, {
      label: 'כמה חזק מסובבים', min: 0, max: 900, step: 30, value: opts.spin, format: (v) => F.num(v) + '° בשנייה', color: 'var(--accent)',
      onInput(v) { opts.spin = v; clear(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const runBtn = U.Button(row, opts.shape === 'firework' ? 'לשגר!' : 'לזרוק שוב', function () {
      if (!S.locked && S.phase !== 'fly') launch().then(function () { if (opts.onFree) opts.onFree(); });
    }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      /* On the hammer the name is part of the answer, so the readouts call it by its color. */
      { key: 'x', label: (opts.shape === 'hammer' ? 'הנקודה הזהובה' : 'מרכז מסה') + ': x', color: 'var(--c-displacement)' },
      { key: 'y', label: (opts.shape === 'hammer' ? 'הנקודה הזהובה' : 'מרכז מסה') + ': y', color: 'var(--c-displacement)' },
      { key: 'd', label: 'סטייה מהפרבולה' },
    ]);
    function setLocked(v) {
      S.locked = v;
      if (spinSlider) spinSlider.setEnabled(!v);
      runBtn.disabled = v;
    }

    function drawHammer() {
      const head = S.pts[0], end = S.pts[1];
      view.line(end.x, end.y, head.x, head.y, { color: C.axis, width: view.w < 420 ? 5 : 7 });
      const ang = Math.atan2(head.y - end.y, head.x - end.x);
      const px = view.sx(head.x), py = view.sy(head.y);
      const ctx = view.ctx;
      const s = view.w < 420 ? 0.8 : 1.15;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-ang);
      ctx.fillStyle = C.soft;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-9 * s, -18 * s, 18 * s, 36 * s, 4);
      else ctx.rect(-9 * s, -18 * s, 18 * s, 36 * s);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    function drawRing() {
      const pts = S.pts.map(function (p) { return { x: p.x, y: p.y }; });
      view.poly(pts, { color: C.accent, width: view.w < 420 ? 6 : 8, close: true });
      view.circle(S.pts[0].x, S.pts[0].y, 5, { px: true, fill: C.ink });
    }
    function drawPieces() {
      const cs = [C.apple, C.gold, C.accent, C.leaf];
      S.pts.forEach(function (p, i) {
        if (p.trail.length > 1) view.poly(p.trail, { color: cs[i % cs.length], width: 1.5, alpha: 0.55 });
        view.circle(p.x, p.y, 3 + p.m * 1.6, { px: true, fill: cs[i % cs.length], color: C.ink, width: 1.4 });
      });
    }

    function render() {
      view.clear();
      view.grid(opts.shape === 'firework' ? 5 : 1);
      const r = view.visible;
      const c = com();
      if (opts.shape === 'firework') {
        /* A valley: there is no floor nearby, so nothing external touches the pieces during the run. */
        view.text(r.xMin + (r.xMax - r.xMin) / 2, r.yMin, 'אין רצפה קרובה: עמק עמוק', { size: 11, color: C.soft, offset: [0, -10] });
      } else {
        view.line(r.xMin, 0, r.xMax, 0, { color: C.axis, width: 2.4 });
      }
      /* The ideal parabola, drawn thin, so the gold dot can be judged against it. */
      const para = [];
      for (let t = 0; t <= opts.T + 1e-6; t += opts.T / 40) para.push(ideal(t));
      view.poly(para, { color: C.soft, width: 1.5, dash: [5, 6], alpha: S.phase === 'ready' ? 0 : 0.9 });

      if (opts.shape === 'hammer') {
        const tH = S.pts[0].trail, tE = S.pts[1].trail;
        if (tH.length > 1) view.poly(tH, { color: C.axis, width: 1.6, alpha: 0.55 });
        if (tE.length > 1) view.poly(tE, { color: C.axis, width: 1.6, alpha: 0.35, dash: [2, 5] });
      }
      if (opts.shape === 'ring' && S.pts[0].trail.length > 1) view.poly(S.pts[0].trail, { color: C.axis, width: 1.6, alpha: 0.5 });
      if (S.comTrail.length > 1) view.poly(S.comTrail, { color: C.gold, width: 3.2 });

      if (opts.shape === 'hammer') drawHammer();
      else if (opts.shape === 'ring') drawRing();
      else if (S.burst) drawPieces();
      else view.circle(c.x, c.y, 7, { px: true, fill: C.accent, color: C.ink, width: 2 });

      if (S.flash > 0) view.circle(c.x, c.y, (1 - S.flash) * 90, { px: true, color: C.gold, width: 4, alpha: S.flash });

      /* The center of mass, always in gold, with a label when there is room. */
      /* Where this point sits is what the hammer and ring cards ask, so it waits for the run while locked. */
      const showCom = S.phase !== 'ready' || (opts.shape !== 'firework' && !S.locked);
      if (showCom) {
        view.circle(c.x, c.y, 6.5, { px: true, fill: C.gold, color: C.ink, width: 2 });
        if (S.phase === 'done' || S.phase === 'ready') {
          const clear = opts.shape === 'ring' ? 1.05 * view.scale + 8 : opts.shape === 'hammer' ? 26 : 0;
          view.text(c.x, c.y, 'מרכז המסה', { size: 11.5, weight: 700, offset: clear ? [-(clear + 30), 0] : [0, -20], halo: true });
        }
      }

      const small = view.w < 420;
      const catAt = opts.shape === 'firework' ? { x: r.xMax - 4, y: r.yMin + 1 } : { x: r.xMax - 0.85, y: 0 };
      PHY.mascot.draw(view, catAt.x, catAt.y, { pose: S.pose === 'flying' ? 'thinking' : S.pose, px: small ? 46 : 60 });

      K.caption(view, S.caption, 16);

      const q = ideal(S.t);
      const masked = S.phase === 'ready' && S.locked;
      out.set('x', masked ? '?' : F.unit(c.x, 'm', 1));
      out.set('y', masked ? '?' : F.unit(c.y, 'm', 1));
      out.set('d', masked ? '?' : F.unit(Math.hypot(c.x - q.x, c.y - q.y), 'm', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });
    clear();
    setLocked(opts.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clear(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'spin') { opts.spin = v; if (spinSlider) spinSlider.set(v); clear(); loop.requestRender(); }
      },
      getState() {
        const c = com();
        const q = ideal(S.t);
        const inHole = opts.shape === 'ring' ? Math.min.apply(null, S.pts.map(function (p) { return Math.hypot(p.x - c.x, p.y - c.y); })) : null;
        let px = 0, py = 0;
        S.pts.forEach(function (p) { px += p.m * p.vx; py += p.m * p.vy; });
        return { phase: S.phase, t: S.t, comX: c.x, comY: c.y, idealX: q.x, idealY: q.y, maxDev: S.maxDev, burst: S.burst, nPieces: S.pts.length, gapFromMaterial: inHole, px: px, py: py, m: c.m };
      },
      play() { return launch(); },
    };
  };
})();

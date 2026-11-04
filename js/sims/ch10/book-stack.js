/* PHY.sims.bookStack: five books over a table edge. A book carries everything above it when it is dragged.
   Stable means: for every book, the center of gravity of that book and all those above it lies over
   whatever is under it (the book below, or the table). Otherwise the top part falls, and the stack is put back.
   Harmonic stacking takes the top book completely past the table: 1/2 + 1/4 + 1/6 + 1/8 + 1/10 book lengths.
   opts: {onGoal}. sim.drop(i, x) is the same path as a pointer drag. sim.solve() -> Promise. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;

  const L = 0.3, TH = 0.06, N = 5;
  const FILLS = ['accent', 'gold', 'leaf', 'soft', 'apple'];

  function firstUnstable(xs) {
    /* Walk from the top: the group k..top must balance on what is under book k. */
    for (let k = N - 1; k >= 0; k--) {
      let sum = 0;
      for (let j = k; j < N; j++) sum += xs[j];
      const cg = sum / (N - k);
      if (k === 0) {
        if (cg > 1e-9) return { k: 0, cg: cg };
      } else if (cg > xs[k - 1] + L / 2 + 1e-9 || cg < xs[k - 1] - L / 2 - 1e-9) {
        return { k: k, cg: cg };
      }
    }
    return null;
  }
  function harmonic() {
    /* Top book first. */
    const xs = new Array(N);
    let edge = 0;
    for (let k = 0; k < N; k++) {
      const i = k;               /* the book at height i has (N - i) books in its group */
      const n = N - i;
      const center = edge + L / (2 * n) - L / 2;
      xs[i] = center;
      edge = center + L / 2;
    }
    return xs;
  }

  PHY.sims.bookStack = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -0.42, xMax: 0.56, yMin: -0.17, yMax: 0.47 }, aspect: 1.8, minHeight: 250, maxHeight: 420,
    });
    const home = () => new Array(N).fill(0).map(function (_, i) { return -0.17 + i * 0.002; });
    const tw = B.tweens();
    const S = {
      xs: home(), safe: home(), falling: null, phase: 'free', caption: '', drag: null, pose: 'thinking',
      achieved: false, best: 0, solving: false,
    };

    const overhang = () => S.xs[N - 1] + L / 2;
    const backEdge = () => S.xs[N - 1] - L / 2;

    function step(dt) {
      tw.step(dt);
      if (S.falling) {
        const f = S.falling;
        f.t += dt;
        f.books.forEach(function (b) {
          b.vy -= 10 * dt * 0.7;
          b.y += b.vy * dt;
          b.x += b.vx * dt;
          b.rot += b.om * dt;
        });
        if (f.t > 1.25) {
          S.falling = null;
          S.xs = S.safe.slice();
          S.caption = '';
          S.pose = 'thinking';
          paint();
        }
      }
    }

    function topple(res) {
      const books = [];
      for (let i = res.k; i < N; i++) {
        books.push({ i: i, x: S.xs[i], y: (i + 0.5) * TH, vx: 0.18, vy: 0, rot: 0, om: -220 - 40 * (i - res.k) });
      }
      S.falling = { books: books, t: 0, from: res.k };
      S.caption = 'מרכז הכובד יצא מהתמיכה.';
      S.pose = 'dizzy';
      PHY.mascot.say('ספרים. למה תמיד ספרים? אף אחד מהם לא היה עליי.', 'dizzy');
    }

    function settle() {
      const res = firstUnstable(S.xs);
      if (res) { topple(res); return false; }
      S.safe = S.xs.slice();
      S.best = Math.max(S.best, overhang());
      if (backEdge() > 0 && !S.achieved) {
        S.achieved = true;
        S.pose = 'happy';
        U.burst(canvasEl, 24);
        PHY.mascot.say('הספר העליון כולו באוויר, מעל הרצפה. ולא קרה כלום. אני מתחיל לחשוד במישהו כאן.', 'happy');
        if (opts.onGoal) opts.onGoal();
      }
      paint();
      return true;
    }

    /* Moving book i carries the books above it. */
    function moveTo(i, x) {
      const dx = x - S.xs[i];
      for (let j = i; j < N; j++) S.xs[j] += dx;
      loop.requestRender();
    }

    function solve() {
      if (S.solving) return Promise.resolve();
      S.solving = true;
      S.falling = null;
      const from = S.xs.slice(), to = harmonic();
      return tw.add(2.4, function (k) {
        const e = k * k * (3 - 2 * k);
        S.xs = from.map(function (a, i) { return a + (to[i] - a) * e; });
      }).then(function () {
        S.xs = to.slice();
        S.solving = false;
        settle();
      });
    }

    function bookRect(x, y, rot, i) {
      const ctx = view.ctx;
      const w = L * view.scale, h = TH * view.scale;
      ctx.save();
      ctx.translate(view.sx(x), view.sy(y));
      ctx.rotate((-rot * Math.PI) / 180);
      ctx.fillStyle = C[FILLS[i]];
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      else ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.surface;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(-w / 2 + 5, -h / 2 + 3, w - 8, h - 6);
      ctx.restore();
    }

    function render() {
      const small = view.w < 520;
      const r = view.visible;
      view.clear();
      view.grid(0.1, {});
      /* the table */
      view.poly([{ x: r.xMin, y: 0 }, { x: 0, y: 0 }, { x: 0, y: -0.05 }, { x: r.xMin, y: -0.05 }], { fill: C.gridStrong, color: C.axis, width: 2.5, close: true });
      view.line(-0.32, -0.05, -0.32, r.yMin, { color: C.axis, width: small ? 6 : 8, cap: 'butt' });
      view.line(0, 0.42, 0, -0.17, { color: C.soft, width: 1.5, dash: [5, 5] });
      view.text(0, -0.1, 'קצה השולחן', { size: small ? 11 : 12.5, weight: 700, color: C.soft, halo: true, offset: [small ? 42 : 52, 0] });

      const fallingFrom = S.falling ? S.falling.from : N;
      for (let i = 0; i < fallingFrom; i++) bookRect(S.xs[i], (i + 0.5) * TH, 0, i);
      if (S.falling) S.falling.books.forEach(function (b) { bookRect(b.x, b.y, b.rot, b.i); });

      /* While dragging: where the dragged group's center of gravity lies. */
      if (S.drag !== null && !S.falling) {
        const k = S.drag;
        let sum = 0;
        for (let j = k; j < N; j++) sum += S.xs[j];
        const cg = sum / (N - k);
        const bad = firstUnstable(S.xs);
        view.line(cg, (N + 0.8) * TH, cg, (k) * TH, { color: bad ? C.bad : C.good, width: 2.4, dash: [6, 4] });
        view.circle(cg, (N + 0.8) * TH, small ? 5 : 6, { px: true, fill: C.surface, color: bad ? C.bad : C.good, width: 3 });
      }

      const best = overhang();
      if (best > 0.002) {
        const y = (N + 1.6) * TH;
        view.line(0, y, best, y, { color: C.accent, width: 2 });
        view.text(best / 2, y, F.unit(best * 100, 'ס"מ', 1), { size: small ? 12 : 14, weight: 800, color: C.accent, halo: true, offset: [0, -11] });
      }

      PHY.mascot.draw(view, r.xMax - 0.075, r.yMin + 0.015, { pose: S.pose, px: small ? 60 : 84 });
      if (S.caption) view.screenText(view.w / 2, view.h - 16, S.caption, { size: small ? 12 : 14, weight: 700, pill: true });
    }

    view.drag({
      hit(p) {
        if (S.falling || S.solving) return null;
        if (p.y < -0.03 || p.y > (N + 0.8) * TH) return null;
        const i = Math.min(N - 1, Math.max(0, Math.floor(p.y / TH)));
        if (Math.abs(p.x - S.xs[i]) > L / 2 + 18 / view.scale) return null;
        return { i: i, dx: S.xs[i] - p.x };
      },
      start(h) { S.drag = h.i; S.pose = 'thinking'; loop.requestRender(); },
      move(h, p) {
        const x = Math.max(-0.3, Math.min(0.5, p.x + h.dx));
        moveTo(h.i, x);
      },
      end() {
        S.drag = null;
        settle();
        loop.requestRender();
      },
    });

    const loop = PHY.SimLoop({ view, step, render });

    const out = U.Readouts(controlsEl, [
      { key: 'over', label: 'הספר העליון בולט מעבר לקצה', color: 'var(--accent)' },
      { key: 'len', label: 'אורך ספר אחד' },
      { key: 'top', label: 'הספר העליון', color: 'var(--accent)' },
    ]);
    const row = U.h('div', { class: 'sim-row' });
    controlsEl.appendChild(row);
    U.Button(row, 'הפתרון של ניוטון', solve, {});
    U.Button(row, 'מחדש', function () { reset(); }, { ghost: true });
    function paint() {
      out.set('over', F.unit(Math.max(0, overhang()) * 100, 'ס"מ', 1));
      out.set('len', F.unit(L * 100, 'ס"מ', 0));
      out.set('top', backEdge() > 0 ? 'כולו באוויר!' : 'עדיין מעל השולחן');
    }
    function reset() {
      tw.clear();
      S.solving = false;
      S.falling = null;
      S.xs = home();
      S.safe = home();
      S.caption = '';
      S.pose = 'thinking';
      S.achieved = false;
      paint();
      loop.requestRender();
    }
    paint();

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset,
      solve,
      /* Same path as a pointer drag ending at x. Returns whether the stack stood. */
      drop(i, x) { S.drag = null; moveTo(i, x); return settle(); },
      setParam() {},
      getState() {
        return {
          xs: S.xs.slice(), overhang: overhang(), backEdge: backEdge(), achieved: S.achieved,
          falling: !!S.falling, unstable: firstUnstable(S.xs), L: L, harmonic: harmonic(),
        };
      },
    };
  };
})();

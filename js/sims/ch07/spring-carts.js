/* PHY.sims.springCarts: a compressed spring between two carts at rest. The spring is integrated for real:
   F = k x on both carts, equal and opposite, until it reaches its natural length and they leave it.
   Default 1 kg and 3 kg with 6 J in the spring: 3 m/s and 1 m/s, and the total momentum stays 0 at every step.
   opts: {m1, m2, k, compress, locked}. sim.play() -> Promise. setParam: m1, m2, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU;
  const L0 = 1.3;
  const T_RUN = 1.6;

  PHY.sims.springCarts = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ m1: 1, m2: 3, k: 48, compress: 0.5, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -10, xMax: 10, yMin: -1, yMax: 1 }, aspect: 1.75, minHeight: 340, maxHeight: 440 });
    const S = {};

    function clear() {
      const gap = L0 - opts.compress;
      Object.assign(S, {
        phase: 'ready', t: 0, x1: -gap / 2, x2: gap / 2, v1: 0, v2: 0, onSpring: true, F: 0,
        curve1: [], curve2: [], curveT: [], nextPt: 0, pMaxErr: 0, caption: '', releaseT: null,
      });
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }

    const m1Slider = U.Slider(controlsEl, {
      label: 'מסת הקרון השמאלי', min: 1, max: 5, step: 0.5, value: opts.m1, unit: 'kg', digits: 1, color: 'var(--accent)',
      onInput(v) { opts.m1 = v; clear(); loop.requestRender(); },
    });
    const m2Slider = U.Slider(controlsEl, {
      label: 'מסת הקרון הימני', min: 1, max: 5, step: 0.5, value: opts.m2, unit: 'kg', digits: 1, color: 'var(--accent)',
      onInput(v) { opts.m2 = v; clear(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const runBtn = U.Button(row, 'לשחרר שוב', function () { if (!S.locked && S.phase !== 'run') launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v1', label: 'מהירות הקרון השמאלי', color: 'var(--c-velocity)' },
      { key: 'v2', label: 'מהירות הקרון הימני', color: 'var(--c-velocity)' },
      { key: 'pt', label: 'תנע כולל' },
    ]);
    function setLocked(v) {
      S.locked = v;
      m1Slider.setEnabled(!v);
      m2Slider.setEnabled(!v);
      runBtn.disabled = v;
    }

    function launch() {
      clear();
      S.phase = 'run';
      S.caption = 'החוט נקרע!';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function pMax() { return Math.sqrt((2 * (0.5 * opts.k * opts.compress * opts.compress) * opts.m1 * opts.m2) / (opts.m1 + opts.m2)); }

    function physics(h) {
      if (S.onSpring) {
        const stretch = L0 - (S.x2 - S.x1);
        if (stretch <= 0) {
          S.onSpring = false;
          S.F = 0;
          S.releaseT = S.t;
          S.caption = 'הקפיץ סיים: מכאן כל קרון במהירות קבועה';
        } else {
          S.F = opts.k * stretch;
          S.v1 -= (S.F / opts.m1) * h;
          S.v2 += (S.F / opts.m2) * h;
        }
      }
      S.x1 += S.v1 * h;
      S.x2 += S.v2 * h;
      S.t += h;
      S.pMaxErr = Math.max(S.pMaxErr, Math.abs(opts.m1 * S.v1 + opts.m2 * S.v2));
    }

    function step(dt) {
      if (S.phase !== 'run') return;
      /* The spring works in a fifth of a second: show it in slow motion. */
      const rate = S.onSpring ? 0.22 : 0.9;
      const h = (dt * rate) / 4;
      for (let i = 0; i < 4; i++) physics(h);
      if (S.t >= S.nextPt) {
        S.curve1.push({ t: S.t, y: opts.m1 * S.v1 });
        S.curve2.push({ t: S.t, y: opts.m2 * S.v2 });
        S.curveT.push({ t: S.t, y: opts.m1 * S.v1 + opts.m2 * S.v2 });
        S.nextPt += S.onSpring ? 0.012 : 0.05;
      }
      if (S.t >= T_RUN) {
        S.phase = 'done';
        S.caption = 'מסה קטנה, מהירות גדולה. אותו תנע בגודלו.';
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    function spring(x1, x2, y) {
      /* A zigzag between two pixel positions. */
      const n = 8, amp = 8;
      const pts = [{ x: x1, y: y }];
      for (let i = 1; i < n; i++) pts.push({ x: x1 + ((x2 - x1) * i) / n, y: y + (i % 2 ? -amp : amp) });
      pts.push({ x: x2, y: y });
      G2.pix(view).poly(pts, { color: C.soft, width: 2.2 });
    }

    function render() {
      view.clear();
      const W = view.w, H = view.h;
      const small = W < 420;
      const groundY = Math.round(H * 0.4);
      const P = G2.pix(view);
      /* Rail */
      P.line(4, groundY, W - 4, groundY, { color: C.axis, width: 2.4 });
      for (let x = -10; x <= 10; x++) {
        const px = view.sx(x);
        P.line(px, groundY, px, groundY + (x % 5 === 0 ? 7 : 4), { color: C.axis, width: 1.2 });
      }
      const cw = function (m) { return (1.2 + Math.cbrt(m)) * view.scale * (small ? 1.1 : 0.72); };
      const w1 = cw(opts.m1), w2 = cw(opts.m2);
      const h = small ? 32 : 40;
      const c1x = view.sx(S.x1) - w1 / 2 + 0, c2x = view.sx(S.x2) + w2 / 2 + 0;
      /* The spring sits between the facing sides of the carts. */
      const y = groundY - 12 - h * 0.45;
      if (S.onSpring) spring(c1x + w1 / 2, c2x - w2 / 2, y);
      K.cart(view, c1x, groundY, w1, h, { color: C.accent, label: F.unit(opts.m1, 'kg', opts.m1 % 1 ? 1 : 0), labelSize: small ? 11 : 12 });
      K.cart(view, c2x, groundY, w2, h, { color: C.gold, label: F.unit(opts.m2, 'kg', opts.m2 % 1 ? 1 : 0), labelSize: small ? 11 : 12 });
      const catPx = small ? 42 : 54;
      const catW = view.toWorld(c1x, groundY - 12 - h);
      PHY.mascot.draw(view, catW.x, catW.y, { pose: S.phase === 'ready' ? 'thinking' : S.onSpring ? 'dizzy' : 'flying', px: catPx, flipX: S.phase !== 'ready' });

      /* Forces while the spring pushes, then momentum */
      const ya = groundY + 26;
      const scaleF = (W * 0.16) / (opts.k * opts.compress);
      if (S.onSpring && S.F > 0) {
        /* Each force acts on its own cart, and pushes it outward. */
        const a = c1x - w1 / 2, b = c2x + w2 / 2;
        P.arrow(a, y, a - S.F * scaleF, y, { color: C.force, width: 4, label: 'F', labelSide: 1, labelGap: 13 });
        P.arrow(b, y, b + S.F * scaleF, y, { color: C.force, width: 4, label: 'F', labelSide: -1, labelGap: 13 });
      }
      const pm = pMax() || 1;
      const scaleP = (W * 0.2) / pm;
      const p1 = opts.m1 * S.v1, p2 = opts.m2 * S.v2;
      if (Math.abs(p1) > 0.02) P.arrow(c1x, ya, c1x + p1 * scaleP, ya, { color: C.velocity, width: 4, label: 'p', labelSide: 1, labelGap: 12 });
      if (Math.abs(p2) > 0.02) P.arrow(c2x, ya, c2x + p2 * scaleP, ya, { color: C.velocity, width: 4, label: 'p', labelSide: -1, labelGap: 12 });

      /* Live momentum graph */
      const R = G2.niceRange(-pm * 1.1, pm * 1.1, 2);
      const plot = G2.Plot(view, { tMin: 0, tMax: T_RUN, yMin: R.min, yMax: R.max, title: 'תנע (ק"ג·מ/ש)', tLabel: "t (ש')", tTick: 0.4, yTick: G2.niceStep(R.max - R.min, 4) });
      const top = groundY + 44;
      plot.box(4, top, W - 8, H - top - 4);
      plot.frame();
      plot.curve(S.curve1, { color: C.velocity, width: 2.6 });
      plot.curve(S.curve2, { color: C.velocity, width: 2.6, dash: [7, 5] });
      plot.curve(S.curveT, { color: C.ink, width: 2.2 });
      if (S.curveT.length && S.curveT[S.curveT.length - 1].t > 0.45) {
        const last = S.curveT[S.curveT.length - 1];
        const l1 = S.curve1[S.curve1.length - 1], l2 = S.curve2[S.curve2.length - 1];
        const lx = Math.min(last.t, T_RUN - 0.03);
        plot.text(lx, last.y, 'סך הכול', { size: 11, weight: 700, align: 'right', baseline: 'bottom' });
        plot.text(lx, l1.y, 'שמאלי', { size: 11, weight: 700, align: 'right', baseline: 'top', color: C.velocity });
        plot.text(lx, l2.y, 'ימני', { size: 11, weight: 700, align: 'right', baseline: 'bottom', color: C.velocity });
      }

      K.caption(view, S.caption, 18);
      out.set('v1', F.unit(S.v1, 'ms', 2));
      out.set('v2', F.unit(S.v2, 'ms', 2));
      out.set('pt', F.unit(p1 + p2, PU, 2));
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
        if (name === 'm1') { opts.m1 = v; m1Slider.set(v); }
        if (name === 'm2') { opts.m2 = v; m2Slider.set(v); }
        clear();
        loop.requestRender();
      },
      getState() {
        return { phase: S.phase, t: S.t, v1: S.v1, v2: S.v2, p1: opts.m1 * S.v1, p2: opts.m2 * S.v2, pMaxErr: S.pMaxErr, ke: 0.5 * opts.m1 * S.v1 * S.v1 + 0.5 * opts.m2 * S.v2 * S.v2, released: !S.onSpring };
      },
      play() { return launch(); },
    };
  };
})();

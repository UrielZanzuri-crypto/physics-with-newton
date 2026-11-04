/* PHY.sims.ghostRace: the trap of using x = ½at² on a spring. The real cat is pulled by F = -kx from x = A.
   A ghost cat gets the same starting acceleration, held constant, which is what the chapter 2 formula assumes.
   Both run to x = 0. Times and speeds at the finish are measured when each crosses home.
   opts: {m, k, A, rate}. sim.play() -> Promise. getState(): {tReal, tGhost, vReal, vGhost}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch08, H2 = PHY.ch02;

  PHY.sims.ghostRace = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ m: 1, k: 4, A: 1, rate: 0.3 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -0.45, xMax: 1.5, yMin: -2, yMax: 2 }, aspect: 1.35, minHeight: 380, maxHeight: 480 });
    function layout() { K.fitTop(view, { xMin: -0.45, xMax: 1.5, top: 1.72, bottom: -0.3, frac: 0.56 }); }
    layout();
    view.onResize(layout);

    const a0 = (opts.k / opts.m) * opts.A;
    const S = { phase: 'ready', t: 0, x: opts.A, v: 0, gx: opts.A, gv: 0, tReal: null, tGhost: null, vReal: null, vGhost: null, resolve: null, caption: '', hist: [], next: 0 };
    const acc = (x) => (-opts.k / opts.m) * x;

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function clear() { Object.assign(S, { t: 0, x: opts.A, v: 0, gx: opts.A, gv: 0, tReal: null, tGhost: null, vReal: null, vGhost: null, caption: '', hist: [], next: 0 }); }

    function step(dt) {
      if (S.phase !== 'run') return;
      const h = dt * opts.rate;
      S.t += h;
      if (S.tGhost === null) {
        const px = S.gx, pv = S.gv;
        S.gv -= a0 * h;
        S.gx += pv * h - 0.5 * a0 * h * h;
        if (S.gx <= 0) {
          const f = px / (px - S.gx);
          S.tGhost = S.t - h * (1 - f);
          S.vGhost = Math.abs(pv + (S.gv - pv) * f);
          S.gx = 0;
        }
      }
      if (S.tReal === null) {
        const px = S.x, pv = S.v;
        const n = K.verlet(S.x, S.v, acc, h);
        S.x = n.x; S.v = n.v;
        if (S.x <= 0) {
          const f = px / (px - S.x);
          S.tReal = S.t - h * (1 - f);
          S.vReal = Math.abs(pv + (S.v - pv) * f);
          S.x = 0;
        }
      }
      if (S.t >= S.next) { S.hist.push({ t: S.t, a: S.tReal === null ? Math.abs(acc(S.x)) : 0, g: a0 }); S.next = S.t + 1 / 150; }
      if (S.tReal !== null && S.tGhost !== null) {
        S.phase = 'done';
        S.caption = 'רוח הרפאים הקדימה: התאוצה שלה לא דועכת';
        settle();
      }
    }

    const plot = H2.Plot(view, { title: 'a (מ/ש²)', titleColor: 'acceleration', tLabel: "t (ש')" });

    function lane(y, x, name, accNow, ghost, tDone) {
      const s = view.scale;
      const deck = 16 / s;
      const px = view.w < 420 ? 40 : 46;
      K.floor(view, y);
      if (!ghost) {
        K.wall(view, -0.32, y, y + (px + 8) / s);
        K.spring(view, -0.32, y + deck * 0.72, x - 23 / s, y + deck * 0.72, { amp: 6, coils: 8 });
      }
      K.cart(view, x, y, { catPx: px, pose: tDone === null ? 'happy' : 'standing', alpha: ghost ? 0.5 : 1 });
      view.text(view.visible.xMax, y, name, { size: 12.5, weight: 700, align: 'right', offset: [-6, 12], halo: true });
      const len = (accNow / a0) * 0.62;
      const ay = y + (16 + px + 10) / s;
      if (len > 0.03 && tDone === null) {
        view.arrow(x, ay, x - len, ay, { color: C.acceleration, width: 3.2, head: 11 });
        view.text(x - len, ay, 'a', { size: 13, weight: 700, color: C.acceleration, offset: [-9, 0], halo: true, font: 'Rubik, sans-serif' });
      }
    }

    function render() {
      view.clear();
      view.line(0, -0.1, 0, 1.62, { color: C.soft, width: 3, dash: [7, 6] });
      view.text(0, -0.1, 'בית: x = 0', { size: 12, weight: 700, color: C.soft, offset: [0, 10], halo: true });
      lane(0.86, S.gx, 'רוח רפאים: תאוצה קבועה', a0, true, S.tGhost);
      lane(0, S.x, 'קפיץ אמיתי', Math.abs(acc(S.x)), false, S.tReal);
      if (S.caption) view.screenText(view.w / 2, 16, S.caption, { size: 12.5, weight: 700, pill: true });

      const top = view.sy(-0.3) + 10;
      const T = 1;
      const p = plot.range({ tMin: 0, tMax: T, yMin: 0, yMax: a0 * 1.2, tTick: 0.25, yTick: a0 >= 3 ? 2 : 1 });
      p.box(6, top, view.w - 12, view.h - top - 4).frame();
      if (S.t > 0) {
        p.curve(S.hist.map(function (h) { return { t: h.t, y: h.a }; }), { color: C.acceleration, width: 3 });
        const tg = S.tGhost === null ? S.t : S.tGhost;
        p.curve([{ t: 0, y: a0 }, { t: tg, y: a0 }], { color: C.soft, width: 2.6, dash: [6, 5] });
        /* Only once running: their heights alone would say that the spring's acceleration dies away. */
        p.text(0.86, a0 * 1.03, 'רוח רפאים', { size: 12, weight: 700, color: C.soft });
        p.text(0.86, a0 * 0.16, 'קפיץ', { size: 12, weight: 700, color: C.acceleration });
      }
      out.set('tr', S.tReal === null ? (S.t ? F.unit(S.t, 's', 2) : '0') : F.unit(S.tReal, 's', 3));
      out.set('tg', S.tGhost === null ? (S.t ? F.unit(S.t, 's', 2) : '0') : F.unit(S.tGhost, 's', 3));
      out.set('vr', S.vReal === null ? F.unit(Math.abs(S.v), 'ms', 2) : F.unit(S.vReal, 'ms', 2));
      out.set('vg', S.vGhost === null ? F.unit(Math.abs(S.gv), 'ms', 2) : F.unit(S.vGhost, 'ms', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const out = U.Readouts(controlsEl, [
      { key: 'tr', label: 'זמן, קפיץ' },
      { key: 'tg', label: 'זמן, רוח רפאים' },
      { key: 'vr', label: 'מהירות, קפיץ', color: 'var(--c-velocity)' },
      { key: 'vg', label: 'מהירות, רוח רפאים', color: 'var(--c-velocity)' },
    ]);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { settle(); S.phase = 'ready'; clear(); loop.requestRender(); },
      play() {
        settle();
        clear();
        S.phase = 'run';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      setParam() {},
      getState() { return { phase: S.phase, t: S.t, x: S.x, gx: S.gx, tReal: S.tReal, tGhost: S.tGhost, vReal: S.vReal, vGhost: S.vGhost }; },
    };
  };
})();

/* PHY.sims.areaStrips: area under the v-t graph is the displacement. Thin strips of "speed times a
   short time" stack up into a tower of distance, and as they get thinner the staircase becomes the
   trapezoid. Only after it is painted does it split into a rectangle (v0 t) and a triangle (½ a t²).
   sim.play() -> Promise, sim.rectangle() -> Promise (constant-speed preview).
   setParam: v0, a, T, locked. getState(): {v0, a, T, N, painted, sum, split, area, formula}.
   stripSum(N) sums N left-edge strips, numerically, independent of the formula. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;

  PHY.sims.areaStrips = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ v0: 5, a: 0, T: 4, locked: true, N: 16 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.6, minHeight: 340, maxHeight: 430 });
    const P = H2.pix(view);
    const plot = H2.Plot(view, { title: 'מהירות v (מ/ש)', titleColor: 'velocity' });
    const tw = H2.tweens();
    const S = {
      v0: opts.v0, a: opts.a, T: opts.T, N: opts.N, painted: 0, smooth: false, split: 0,
      locked: opts.locked, caption: '', running: false, fresh: true,
    };
    let runId = 0;

    const vOf = (t) => S.v0 + S.a * t;
    /* Exact only because it uses N left-edge strips; N -> large converges on the trapezoid. */
    function stripSum(N, upTo) {
      const dt = S.T / N;
      let sum = 0;
      const n = upTo === undefined ? N : upTo;
      for (let i = 0; i < n; i++) sum += vOf(i * dt) * dt;
      return sum;
    }
    const painted = () => (S.smooth ? stripSum(4000, Math.round(4000 * Math.min(1, S.painted / S.N))) : stripSum(S.N, Math.floor(S.painted)));
    const formula = () => S.v0 * S.T + 0.5 * S.a * S.T * S.T;

    const sliders = {};
    sliders.v0 = U.Slider(controlsEl, { label: 'מהירות התחלתית', min: 0, max: 10, step: 1, value: S.v0, unit: 'ms', digits: 0, color: 'var(--c-velocity)', onInput(v) { changed('v0', v); } });
    sliders.a = U.Slider(controlsEl, { label: 'תאוצה', min: -2, max: 3, step: 0.5, value: S.a, unit: 'ms2', digits: 1, color: 'var(--c-acceleration)', onInput(v) { changed('a', v); } });
    sliders.T = U.Slider(controlsEl, { label: 'זמן', min: 1, max: 6, step: 0.5, value: S.T, unit: 's', digits: 1, onInput(v) { changed('T', v); } });
    const stripSlider = U.Slider(controlsEl, {
      label: 'מספר רצועות', min: 2, max: 64, step: 2, value: S.N, format: (v) => F.num(v, 0),
      onInput(v) { S.N = v; S.smooth = false; S.painted = v; S.split = 0; S.fresh = false; update(); loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'sum', label: 'סכום הרצועות (ההעתק)', color: 'var(--c-displacement)' },
      { key: 'true', label: 'השטח המדויק', color: 'var(--c-displacement)' },
    ]);

    function changed(k, v) {
      S[k] = v;
      S.painted = S.N;
      S.smooth = true;
      S.split = 1;
      S.fresh = false;
      update();
      loop.requestRender();
    }
    function setLocked(v) {
      S.locked = v;
      Object.keys(sliders).forEach((k) => sliders[k].setEnabled(!v));
      stripSlider.setEnabled(!v);
    }
    function update() {
      out.set('sum', S.painted > 0 ? F.unit(painted(), 'm', 2) : '—');
      out.set('true', S.painted >= S.N && S.smooth ? F.unit(stripSum(20000), 'm', 2) : '?');
    }

    function step(dt) { tw.step(dt); }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      const towerW = W < 420 ? 64 : 90;
      const top = 30;

      /* ranges */
      const end = vOf(S.T);
      const rv = H2.niceRange(Math.min(0, S.v0, end), Math.max(S.v0, end, 1), 4);
      plot.range({ tMin: 0, tMax: S.T, tTick: H2.niceStep(S.T, W < 420 ? 4 : 6), yMin: rv.min, yMax: rv.max });
      plot.box(0, top, W - towerW, Hh - top);
      plot.frame();

      /* strips or the smooth area */
      if (S.smooth) {
        const k = Math.min(1, S.painted / S.N);
        const tEnd = S.T * k;
        if (S.split < 0.01) {
          plot.fill([{ t: 0, y: vOf(0) }, { t: tEnd, y: vOf(tEnd) }], { color: C.displacement, alpha: 0.32 });
        } else {
          /* Rectangle: v0 for all of T. Triangle: what the acceleration added. */
          plot.rect(0, S.T, 0, S.v0, { fill: C.displacement, alpha: 0.32 });
          plot.clip(function () {
            P.poly([
              { x: plot.X(0), y: plot.Y(S.v0) },
              { x: plot.X(S.T), y: plot.Y(S.v0) },
              { x: plot.X(S.T), y: plot.Y(end) },
            ], { fill: C.displacement, alpha: 0.16 + 0.14 * S.split, color: C.displacement, width: 1.5, close: true });
          });
          if (S.split > 0.5) {
            const al = Math.min(1, (S.split - 0.5) * 2);
            P.line(plot.X(0), plot.Y(S.v0), plot.X(S.T), plot.Y(S.v0), { color: C.displacement, width: 2, dash: [6, 4], alpha: al });
            if (Math.abs(S.v0) > 0.2) plot.text(S.T / 2, S.v0 / 2, 'מלבן: ' + F.unit(S.v0 * S.T, 'm', 2), { color: C.ink, weight: 700, alpha: al, size: W < 420 ? 11.5 : 13 });
            if (Math.abs(S.a) > 0.01) {
              const lab = 'משולש: ' + F.unit(0.5 * S.a * S.T * S.T, 'm', 2);
              plot.text(S.T * 0.68, S.v0 + (end - S.v0) * 0.36, lab, { color: C.ink, weight: 700, alpha: al, size: W < 420 ? 11.5 : 13 });
            }
          }
        }
      } else {
        const dt = S.T / S.N;
        const n = Math.floor(S.painted);
        for (let i = 0; i < n; i++) {
          plot.rect(i * dt, (i + 1) * dt, 0, vOf(i * dt), { fill: C.displacement, alpha: i % 2 ? 0.28 : 0.42 });
        }
      }
      plot.curve([{ t: 0, y: vOf(0) }, { t: S.T, y: end }], { color: C.velocity, width: 3.2 });

      /* Tower of distance: the same number, shown as a length. */
      const sum = painted();
      const fullMax = Math.max(0, formula(), S.a < 0 ? S.v0 * S.T : 0);
      const fullMin = Math.min(0, formula());
      const span = Math.max(1, fullMax - fullMin) * 1.1;
      const bx = W - towerW + 14, bw = towerW - 30;
      const yTop = plot.r.y, yBot = plot.r.y + plot.r.h;
      const Yt = (d) => yBot - ((d - fullMin) / span) * (yBot - yTop);
      P.poly([{ x: bx, y: Yt(0) }, { x: bx + bw, y: Yt(0) }, { x: bx + bw, y: Yt(sum) }, { x: bx, y: Yt(sum) }], { fill: C.displacement, close: true, alpha: 0.75 });
      P.line(bx - 4, Yt(0), bx + bw + 4, Yt(0), { color: C.axis, width: 2 });
      view.screenText(bx + bw / 2, top - 10, 'העתק', { size: 12, weight: 700, color: C.displacement });
      if (S.painted > 0) view.screenText(bx + bw / 2, Math.min(Yt(sum), Yt(0)) - 10, F.unit(sum, 'm', 1), { size: W < 420 ? 11 : 12.5, weight: 800, color: C.displacement, halo: true });

      if (S.caption) view.screenText(W / 2, 13, S.caption, { size: 12.5, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    function paint(N, seconds, smooth) {
      S.N = N;
      S.smooth = !!smooth;
      S.painted = 0;
      stripSlider.set(Math.min(64, N));
      update();
      return tw.run(seconds, function (k) { S.painted = N * k; update(); });
    }

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        runId++;
        tw.clear();
        S.painted = 0;
        S.split = 0;
        S.smooth = false;
        S.caption = '';
        update();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (sliders[name]) { sliders[name].set(v); S[name] = v; update(); loop.requestRender(); }
      },
      getState() {
        return { v0: S.v0, a: S.a, T: S.T, N: S.N, painted: S.painted, sum: painted(), split: S.split, area: stripSum(20000), formula: formula(), smooth: S.smooth };
      },
      stripSum,
      /* Paints a plain rectangle at constant speed: the warm-up. */
      async rectangle(v, T) {
        api.reset();
        const id = runId;
        api.setParam('v0', v === undefined ? 5 : v);
        api.setParam('a', 0);
        api.setParam('T', T === undefined ? 4 : T);
        S.caption = 'מהירות קבועה: הגובה כפול הרוחב';
        await paint(40, 1.6, true);
        if (id !== runId) return;
        update();
      },
      async play(v0, a, T) {
        api.reset();
        const id = runId;
        setLocked(true);
        api.setParam('v0', v0);
        api.setParam('a', a);
        api.setParam('T', T);
        S.caption = '4 רצועות: קצת פחות מהאמת';
        await paint(4, 1.6);
        if (id !== runId) return;
        await tw.run(0.7);
        if (id !== runId) return;
        S.caption = '16 רצועות: כמעט שם';
        await paint(16, 1.3);
        if (id !== runId) return;
        await tw.run(0.5);
        if (id !== runId) return;
        S.caption = 'רצועות דקות בלי סוף: טרפז';
        await paint(40, 1.1, true);
        if (id !== runId) return;
        await tw.run(0.5);
        if (id !== runId) return;
        S.caption = 'ועכשיו חותכים אותו לשניים';
        await tw.run(1.1, function (k) { S.split = k; });
        if (id !== runId) return;
        S.caption = '';
        update();
        setLocked(false);
        stripSlider.set(16);
      },
    };
    setLocked(S.locked);
    update();
    return api;
  };
})();

/* PHY.sims.tripAverage: the average-speed trap. A car drives two legs at 60 and 120 km/h while a
   speedometer-versus-time graph fills in. The width of each block is how long that speed lasted.
   mode 'distance': there and back over the same road, so the slow leg takes longer (average 80).
   mode 'time': the same time at each speed (average 90).
   sim.play() -> Promise. setParam('km', v). getState(): {t, dist, avg, done, km}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;

  PHY.sims.tripAverage = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'distance', km: 120, slider: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 2, minHeight: 310, maxHeight: 370 });
    const P = H2.pix(view);
    const plot = H2.Plot(view, { title: 'מד המהירות (קמ"ש)', titleColor: 'velocity', tLabel: 'זמן (שעות)', yMin: 0, yMax: 140, yTick: 20 });
    const S = { km: opts.km, t: 0, running: false, done: false, resolve: null };

    function legs() {
      if (opts.mode === 'time') return [{ v: 60, T: 2, dir: 1 }, { v: 120, T: 2, dir: 1 }];
      return [{ v: 60, T: S.km / 60, dir: 1 }, { v: 120, T: S.km / 120, dir: -1 }];
    }
    const total = () => legs().reduce((a, l) => a + l.T, 0);
    const roadLen = () => (opts.mode === 'time' ? 360 : S.km);

    /* Integrates the legs up to time t, so the average is measured rather than assumed. */
    function at(t) {
      let dist = 0, pos = 0, left = t, v = 0, dir = 1;
      legs().forEach(function (l) {
        const d = Math.min(left, l.T);
        if (d > 0) {
          dist += l.v * d;
          pos += l.v * d * l.dir;
          left -= d;
          v = l.v;
          dir = l.dir;
        }
      });
      return { dist, pos, v, dir };
    }

    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן כולל' },
      { key: 'd', label: 'מרחק כולל' },
      { key: 'avg', label: 'מרחק חלקי זמן', color: 'var(--c-velocity)' },
    ]);
    let slider = null;
    if (opts.mode === 'distance' && opts.slider) {
      slider = U.Slider(controlsEl, {
        label: 'המרחק לתל אביב', min: 30, max: 240, step: 30, value: S.km, format: (v) => F.unit(v, 'ק"מ', 0), color: 'var(--accent)',
        onInput(v) {
          S.km = v;
          S.t = total();
          S.done = true;
          S.running = false;
          update();
          loop.requestRender();
        },
      });
      slider.setEnabled(false);
    }

    function update() {
      const a = at(S.t);
      out.set('t', F.unit(S.t, 'שעות', 2));
      out.set('d', F.unit(a.dist, 'ק"מ', 0));
      out.set('avg', S.t > 0.001 ? F.unit(a.dist / S.t, 'קמ"ש', 1) : '—');
    }

    function step(dt) {
      if (!S.running) return;
      const T = total();
      S.t = Math.min(T, S.t + (dt * T) / 4.5);
      update();
      if (S.t >= T - 1e-9) {
        S.running = false;
        S.done = true;
        if (slider) slider.setEnabled(true);
        if (S.resolve) { S.resolve(); S.resolve = null; }
      }
    }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h, m = 34, roadY = 54;
      const len = roadLen();
      const rx = (km) => m + (km / len) * (W - 2 * m);
      P.line(m - 14, roadY, W - m + 14, roadY, { color: C.axis, width: 5 });
      P.line(m - 14, roadY, W - m + 14, roadY, { color: C.bg, width: 1.2, dash: [8, 8] });
      view.screenText(m, roadY + 15, opts.mode === 'time' ? 'התחלה' : 'בית', { size: 12, weight: 700, color: C.soft });
      view.screenText(W - m, roadY + 15, opts.mode === 'time' ? 'רחוק רחוק' : 'תל אביב', { size: 12, weight: 700, color: C.soft });
      const a = at(S.t);
      H2.drawCar(view, rx(a.pos), roadY - 2, { flip: a.dir < 0, w: 44 });
      P.cat(rx(a.pos) + (a.dir < 0 ? 4 : -4), roadY - 21, { pose: 'standing', px: 28, flipX: a.dir < 0 });
      if (S.t > 0 && !S.done) view.screenText(W / 2, 14, F.unit(a.v, 'קמ"ש', 0), { size: 13, weight: 700, color: C.velocity, pill: true });

      /* The speedometer graph: block width is time, block height is speed. */
      const T = total();
      plot.range({ tMin: 0, tMax: T * 1.02 || 1 });
      plot.o.tTick = H2.niceStep(T, 4);
      plot.box(0, roadY + 24, W, Hh - roadY - 24);
      plot.frame();
      let t0 = 0;
      legs().forEach(function (l, i) {
        const shown = Math.max(0, Math.min(S.t - t0, l.T));
        if (shown > 0) {
          plot.rect(t0, t0 + shown, 0, l.v, { fill: C.velocity, alpha: i === 0 ? 0.32 : 0.18 });
          plot.curve([{ t: t0, y: l.v }, { t: t0 + shown, y: l.v }], { color: C.velocity, width: 3 });
          if (shown > 0.6 * l.T) {
            const px = plot.X(t0 + shown) - plot.X(t0);
            if (px > 36) plot.text(t0 + shown / 2, l.v / 2, F.unit(l.v * shown, 'ק"מ', 0), { color: C.ink, weight: 700 });
          }
        }
        t0 += l.T;
      });
      if (S.done) {
        const avg = at(T).dist / T;
        plot.hline(avg, { color: C.accent, width: 2.5, dash: [7, 5] });
        plot.text(T * 0.5, avg + 9, 'ממוצע ' + F.unit(avg, 'קמ"ש', 0), { color: C.accent, weight: 800, size: 13 });
      }
    }

    const loop = PHY.SimLoop({ view, step, render });
    update();
    return {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.t = 0; S.running = false; S.done = false;
        update();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'km') { S.km = v; if (slider) slider.set(v); S.t = S.done ? total() : S.t; update(); loop.requestRender(); }
      },
      getState() { const a = at(S.t); return { t: S.t, dist: a.dist, avg: S.t > 0 ? a.dist / S.t : 0, done: S.done, km: S.km }; },
      play() {
        this.reset();
        S.running = true;
        return new Promise(function (res) { S.resolve = res; });
      },
    };
  };
})();

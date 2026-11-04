/* PHY.sims.freezeAtTop: an apple is thrown straight up, with its velocity arrow (blue) and its
   acceleration arrow (red). Freeze at the top: v = 0, and the red arrow has not moved.
   opts: {v0, freeze, showPath, locked}. sim.play({freeze}) -> Promise, sim.resume() -> Promise.
   setParam: v0, freeze, locked. getState(): {t, y, v, a, frozen, peakT, peakY, landT, distance, displacement}.
   Motion is the exact solution, so the top is reached exactly at v0 / g. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const G = 10;

  PHY.sims.freezeAtTop = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ v0: 20, freeze: true, showPath: false, locked: true, rate: 1 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.5, minHeight: 370, maxHeight: 450 });
    const P = H2.pix(view);
    const plot = H2.Plot(view, { title: 'מהירות v (מ/ש)', titleColor: 'velocity' });
    const S = { v0: opts.v0, freeze: opts.freeze, t: 0, running: false, frozen: false, landed: false, resolve: null, locked: opts.locked, hist: [], last: -1, played: false };

    const peakT = () => S.v0 / G;
    const peakY = () => (S.v0 * S.v0) / (2 * G);
    const landT = () => (2 * S.v0) / G;
    const yOf = (t) => S.v0 * t - 0.5 * G * t * t;
    const vOf = (t) => S.v0 - G * t;
    const distanceAt = (t) => (t <= peakT() ? yOf(t) : 2 * peakY() - yOf(t));

    const slider = U.Slider(controlsEl, {
      label: 'מהירות הזריקה', min: 5, max: 30, step: 1, value: S.v0, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v0 = v; api.reset(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const throwBtn = U.Button(row, 'זרוק', function () { api.play(); }, { primary: true });
    const resumeBtn = U.Button(row, 'הפשר', function () { api.resume(); });
    resumeBtn.hidden = true;
    const freezeT = U.Toggle(row, 'עצור בשיא', { value: S.freeze, onChange(v) { S.freeze = v; } });
    controlsEl.appendChild(row);
    const items = [
      { key: 't', label: 'זמן' },
      { key: 'y', label: 'גובה', color: 'var(--c-displacement)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
    ];
    if (opts.showPath) {
      items.push({ key: 'dist', label: 'מרחק שעבר' });
      items.push({ key: 'disp', label: 'העתק', color: 'var(--c-displacement)' });
    }
    const out = U.Readouts(controlsEl, items);

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      throwBtn.disabled = v;
      freezeT.input.disabled = v;
    }
    function update() {
      out.set('t', F.unit(S.t, 's', 2));
      out.set('y', F.unit(yOf(S.t), 'm', 2));
      out.set('v', F.unit(vOf(S.t), 'ms', 1));
      /* Before the first throw these are the answers to the guesses, so they stay hidden. */
      out.set('a', S.played ? F.unit(-G, 'ms2', 0) : '?');
      out.set('dist', F.unit(distanceAt(S.t), 'm', 1));
      out.set('disp', S.played ? F.unit(yOf(S.t), 'm', 1) : '?');
    }
    function finish() {
      S.running = false;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    function step(dt) {
      if (!S.running) return;
      let t = S.t + dt * opts.rate;
      if (S.freeze && !S.frozen && S.t < peakT() && t >= peakT()) {
        S.t = peakT();
        S.frozen = true;
        record(true);
        update();
        resumeBtn.hidden = false;
        finish();
        return;
      }
      if (t >= landT()) {
        S.t = landT();
        S.landed = true;
        record(true);
        update();
        finish();
        return;
      }
      S.t = t;
      record(false);
      update();
    }
    function record(force) {
      if (force || S.t - S.last >= 0.05) {
        S.hist.push({ t: S.t, y: vOf(S.t) });
        S.last = S.t;
      }
    }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      const narrow = W < 560;
      const sceneW = narrow ? W * 0.48 : W * 0.46;
      const top = 34, bottom = Hh - 26, left = 34;
      const maxY = Math.max(peakY() * 1.12, 2);
      const Y = (h) => bottom - (h / maxY) * (bottom - top);
      const tickStep = H2.niceStep(maxY, 5);
      P.line(left, top - 8, left, bottom, { color: C.axis, width: 2 });
      for (let i = 0; i * tickStep <= maxY + 1e-9; i++) {
        P.line(left - 4, Y(i * tickStep), sceneW, Y(i * tickStep), { color: C.grid, width: 1 });
        view.screenText(left - 7, Y(i * tickStep), F.num(i * tickStep, 0), { size: 10.5, color: C.soft, align: 'right' });
      }
      view.screenText(left - 28, top - 20, "גובה (מ')", { size: 11, color: C.soft, align: 'left' });
      P.line(0, bottom, sceneW, bottom, { color: C.axis, width: 2.5 });
      P.cat(sceneW - 22, bottom, { pose: S.frozen ? 'thinking' : 'standing', px: narrow ? 42 : 54 });

      const px = left + (sceneW - left) * 0.42;
      const py = Y(yOf(S.t));
      /* Ghosts every half a second: tight near the top, wide near the ground. */
      for (let k = 0.5; k < S.t - 1e-6; k += 0.5) {
        const up = k <= peakT();
        H2.drawApple(view, px + (up ? -15 : 15), Y(yOf(k)), 5.5, { alpha: 0.3 });
      }
      /* Arrows. Same scale all flight long, so the red arrow must not change. */
      const vS = narrow ? 2.6 : 3.2, v = vOf(S.t);
      if (Math.abs(v) > 0.05) {
        P.arrow(px - 8, py, px - 8, py - v * vS, { color: C.velocity, width: 5 });
        view.screenText(px - 21, py - v * vS * 0.55, 'v', { color: C.velocity, weight: 800, size: 15, halo: true });
      }
      if (S.played) {
        P.arrow(px + 8, py, px + 8, py + 38, { color: C.acceleration, width: 5 });
        view.screenText(px + 20, py + 26, 'a', { color: C.acceleration, weight: 800, size: 15, halo: true });
      }
      H2.drawApple(view, px, py, 11);

      /* v-t graph */
      const T = landT();
      plot.range({ tMin: 0, tMax: T, tTick: H2.niceStep(T, narrow ? 3 : 5), yMin: -S.v0 * 1.05, yMax: S.v0 * 1.05, yTick: H2.niceStep(S.v0, 2) });
      plot.box(sceneW + 4, 8, W - sceneW - 4, Hh - 14);
      plot.frame();
      if (S.played) plot.curve([{ t: 0, y: S.v0 }, { t: T, y: -S.v0 }], { color: C.velocity, width: 1.5, dash: [4, 5], alpha: 0.4 });
      plot.curve(S.hist.concat(S.hist.length ? [{ t: S.t, y: vOf(S.t) }] : []), { color: C.velocity, width: 3.2 });
      plot.dot(S.t, vOf(S.t), { color: C.velocity });
      if (S.frozen || S.t > peakT()) plot.vline(peakT(), { color: C.soft });

      if (S.frozen) {
        /* The upper right of the graph stays empty: the curve is below zero there. */
        const tx = plot.X(T * 0.72);
        view.screenText(tx, 46, 'v = 0', { size: narrow ? 18 : 25, weight: 800, color: C.velocity, halo: true });
        view.screenText(tx, narrow ? 68 : 78, 'a = ' + G + ' מ/ש²', { size: narrow ? 13.5 : 17, weight: 800, color: C.acceleration, halo: true });
        view.screenText(tx, narrow ? 86 : 100, 'למטה', { size: narrow ? 13.5 : 17, weight: 800, color: C.acceleration, halo: true });
      }
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.t = 0;
        S.running = false;
        S.frozen = false;
        S.landed = false;
        S.hist = [];
        S.last = -1;
        resumeBtn.hidden = true;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        update();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'v0') { S.v0 = v; slider.set(v); api.reset(); }
        if (name === 'freeze') { S.freeze = !!v; freezeT.set(v); }
        if (name === 'locked') setLocked(!!v);
      },
      getState() {
        return { t: S.t, y: yOf(S.t), v: vOf(S.t), a: -G, frozen: S.frozen, landed: S.landed, peakT: peakT(), peakY: peakY(), landT: landT(), distance: distanceAt(S.t), displacement: yOf(S.t), v0: S.v0 };
      },
      play(o) {
        o = o || {};
        S.played = true;
        api.reset();
        if (o.freeze !== undefined) { S.freeze = !!o.freeze; freezeT.set(o.freeze); }
        S.running = true;
        record(true);
        return new Promise(function (res) { S.resolve = res; });
      },
      resume() {
        if (!S.frozen) return Promise.resolve();
        S.frozen = false;
        resumeBtn.hidden = true;
        S.running = true;
        /* Stop re-triggering the freeze: we are already past the top. */
        S.t = peakT() + 1e-6;
        return new Promise(function (res) { S.resolve = res; });
      },
    };
    setLocked(S.locked);
    update();
    return api;
  };
})();

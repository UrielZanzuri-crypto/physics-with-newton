/* PHY.sims.elevator: the cat on a scale in an elevator. The reading is N = m(g + a). At a = -g it reads 0.
   The cabin stays put on the screen and the floors scroll, because the distances do not fit.
   sim.play() -> Promise runs the script: up, steady, slowing, then the cable goes.
   After that, free play: slider for a, cut() and halt(). setParam: a, locked. getState().log has each phase's reading. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10, V_MAX = 15;

  const SCRIPT = [
    { a: 0, T: 0.7, label: 'במנוחה' },
    { a: 2, T: 1.2, label: 'מאיצה למעלה' },
    { a: 0, T: 1, label: 'עולה במהירות קבועה' },
    { a: -2, T: 1.2, label: 'מאטה בדרך למעלה' },
    { a: 0, T: 0.6, label: 'עצרה' },
    { a: -G, T: 1.4, label: 'הכבל נקרע!', cut: true },
    { a: G, stop: true, label: 'בלם החירום', cut: true },
    { a: 0, T: 0.6, label: 'עצרה', cut: true },
  ];

  PHY.sims.elevator = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ m: 5, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 16, yMin: 0, yMax: 10 }, aspect: 1.45, minHeight: 330, maxHeight: 450 });
    const gate = K.gate();
    const S = { m: opts.m, y: 0, v: 0, a: 0, cut: false, t: 0, hist: [], script: null, si: 0, sT: 0, label: 'במנוחה', running: false, locked: opts.locked, log: [], capped: false };
    const P = PHY.ch02.pix(view);
    const plot = PHY.ch02.Plot(view, { tMin: 0, tMax: 8, yMin: 0, yMax: 120, yTick: 40, tTick: 2, title: 'קריאה (ניוטון)', tLabel: '' });

    const reading = () => Math.max(0, S.m * (G + S.a));

    const slider = U.Slider(controlsEl, {
      label: 'תאוצת המעלית', min: -10, max: 10, step: 1, value: 0, unit: 'ms2', digits: 0, color: 'var(--c-acceleration)',
      onInput(v) { S.script = null; S.cut = false; S.a = v; S.label = labelFor(v); S.running = true; },
    });
    const row = U.h('div', { class: 'sim-row' });
    const haltBtn = U.Button(row, 'לעצור', function () { if (!S.locked) api.halt(); });
    const cutBtn = U.Button(row, 'לנתק את הכבל', function () { if (!S.locked) api.cut(); });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'n', label: 'קריאה', color: 'var(--c-force)' },
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
    ]);

    function labelFor(a) { return a === 0 ? 'בלי תאוצה' : a > 0 ? 'תאוצה כלפי מעלה' : a === -G ? 'נפילה חופשית' : 'תאוצה כלפי מטה'; }
    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      haltBtn.disabled = v;
      cutBtn.disabled = v;
    }

    function clearRun() {
      gate.close();
      Object.assign(S, { y: 0, v: 0, a: 0, cut: false, t: 0, hist: [], script: null, si: 0, sT: 0, label: 'במנוחה', running: false, log: [], capped: false });
      slider.set(0);
    }
    function loadPhase() {
      const p = S.script[S.si];
      S.a = p.a; S.cut = !!p.cut; S.label = p.label; S.sT = 0;
      if (p.log !== false) S.log.push({ label: p.label, a: p.a, reading: reading(), T: 0 });
    }
    function runScript(list) {
      S.script = list; S.si = 0; S.running = true;
      loadPhase();
    }

    function step(dt) {
      if (!S.running) return;
      S.t += dt;
      if (S.script) {
        const p = S.script[S.si];
        S.sT += dt;
        if (S.log.length) { const l = S.log[S.log.length - 1]; l.T = S.sT; }
        const stopNow = p.stop && S.v * Math.sign(p.a) >= 0;
        if (stopNow) S.v = 0;
        if ((p.T !== undefined && S.sT >= p.T) || stopNow) {
          S.si++;
          if (S.si >= S.script.length) {
            S.script = null;
            S.a = 0;
            S.cut = false;
            S.label = 'במנוחה';
            if (Math.abs(S.v) < 1e-6) S.v = 0;
            gate.close();
          } else {
            loadPhase();
          }
        }
      } else if (Math.abs(S.v) >= V_MAX && S.v * S.a > 0) {
        S.a = 0;
        S.capped = true;
        S.label = 'מהירות מרבית';
        slider.set(0);
      }
      const nv = S.v + S.a * dt;
      S.y += ((S.v + nv) / 2) * dt;
      S.v = nv;
      const l = S.hist[S.hist.length - 1];
      if (!l || S.t - l.t > 0.03) S.hist.push({ t: S.t, y: reading() });
      if (S.hist.length > 700) S.hist.shift();
    }

    function layout() {
      const W = view.w, H = view.h;
      const ws = Math.min(W * 0.44, 190);
      const cw = ws * 0.62;
      const ch = Math.min(H - 62, cw * 1.42);
      return { W, H, xs: 6, ws, cw, ch, cx: 6 + (ws - cw) / 2, cy: (H - ch) / 2 + 4 };
    }

    function render() {
      view.clear();
      const L = layout();
      const small = view.w < 460;
      const N = reading();
      const floorPy = L.cy + L.ch;
      K.shaft(view, P, { x: L.xs, w: L.ws, floorPy, pos: S.y, pxPerM: L.ch / 5, floorH: 3, top: 2, bottom: L.H - 2 });
      const pose = N < 0.5 ? 'falling' : S.a >= 8 ? 'dizzy' : S.a > 0.5 ? 'thinking' : S.a < -0.5 ? 'happy' : 'standing';
      K.cabin(view, P, { x: L.cx, y: L.cy, w: L.cw, h: L.ch, reading: N, weight: S.m * G, pose, cut: S.cut, forces: true, kF: (L.ch * 0.34) / (S.m * G * 2), a: S.a, v: S.v, kA: small ? 4 : 6, kV: small ? 3 : 4, top: 2 });

      const gx = L.xs + L.ws + 8;
      const tMax = Math.max(8, S.t);
      plot.range({ tMin: tMax - 8, tMax });
      const yMax = Math.max(120, S.m * G * 2.4);
      plot.range({ yMax });
      plot.box(gx, 2, L.W - gx - 2, L.H - 42);
      plot.frame();
      plot.hline(S.m * G, { color: C.soft });
      plot.text(tMax - 0.1, S.m * G, 'mg', { size: 11.5, weight: 800, color: C.soft, align: 'right', baseline: 'bottom' });
      plot.curve(S.hist, { color: C.force, width: 3 });
      if (S.running || S.hist.length) plot.dot(S.t, N, { color: C.force });
      view.screenText(gx + (L.W - gx) / 2, L.H - 19, S.label, { size: small ? 12.5 : 14, weight: 700, pill: true, color: S.cut ? C.bad : C.ink });

      out.set('n', F.unit(N, 'N', 0));
      out.set('a', F.unit(S.a, 'ms2', 0));
      out.set('v', F.unit(S.v, 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'a') { S.script = null; S.cut = false; S.a = v; S.label = labelFor(v); S.running = true; slider.set(v); }
        loop.requestRender();
      },
      getState() {
        return { y: S.y, v: S.v, a: S.a, reading: reading(), cut: S.cut, t: S.t, label: S.label, m: S.m, log: S.log.map(function (l) { return Object.assign({}, l); }), script: !!S.script };
      },
      play() {
        clearRun();
        const p = gate.open();
        runScript(SCRIPT);
        return p;
      },
      /* The free-play versions of the script's last two parts. */
      cut() {
        slider.set(0);
        runScript([{ a: -G, T: 1.4, label: 'הכבל נקרע!', cut: true }, { a: G, stop: true, label: 'בלם החירום', cut: true }]);
      },
      halt() {
        slider.set(0);
        if (Math.abs(S.v) < 0.02) { S.a = 0; S.v = 0; S.script = null; S.label = 'עצרה'; return; }
        runScript([{ a: S.v > 0 ? -3 : 3, stop: true, label: 'מאטה עד עצירה' }]);
      },
      advance(seconds) {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 120) step(1 / 120);
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

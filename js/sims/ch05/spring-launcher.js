/* PHY.sims.springLauncher: a compressed spring fires the cat along a smooth floor and up a ramp.
   The push is integrated while he touches the spring, so the launch speed is measured, not assumed. Three
   energies share one bar: elastic, kinetic and height.
   opts: {k, m, x, locked}. sim.play(x) -> Promise, sim.playDouble(x) fires x, then 2x, and compares.
   setParam: x, m, k, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const WALL = -5, REST = -2.2, X_MIN = -3.6, RAMP0 = 2, TOPY = 8.6, CURVE = 0.2;

  PHY.sims.springLauncher = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ k: 500, m: 5, x: 0.5, locked: true, slow: 0.6 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -5.5, xMax: 9.8, yMin: -1.2, yMax: 12.4 }, aspect: 1.3, minHeight: 320, maxHeight: 450 });
    const pts = M.join(M.line(X_MIN, 0, RAMP0, 0, 120), M.fn(function (x) { const d = x - RAMP0; return CURVE * d * d; }, RAMP0, RAMP0 + Math.sqrt(TOPY / CURVE), 240));
    const track = M.Track(pts);
    const sRest = REST - X_MIN;
    const tw = PHY.ch02.tweens();
    const S = {
      k: opts.k, m: opts.m, x: opts.x, r: null, running: false, phase: 'ready', launchV: null, hMax: null, over: false,
      marks: [], caption: '', locked: opts.locked, resolve: null, pose: 'standing', maxE: 250,
    };

    const xSlider = U.Slider(controlsEl, {
      label: 'כיווץ הקפיץ', min: 0.1, max: 1.2, step: 0.05, value: S.x, unit: 'm', digits: 2, color: 'var(--c-displacement)',
      onInput(v) { S.x = v; S.marks = []; aim(); loop.requestRender(); },
    });
    const mSlider = U.Slider(controlsEl, {
      label: 'מסת החתול', min: 1, max: 10, step: 1, value: S.m, unit: 'kg', digits: 0, color: 'var(--accent)',
      onInput(v) { S.m = v; S.marks = []; aim(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'לשחרר', function () { fire(S.x); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'es', label: 'אנרגיה בקפיץ' },
      { key: 'v', label: 'מהירות היציאה', color: 'var(--c-velocity)' },
      { key: 'h', label: 'גובה מרבי', color: 'var(--c-displacement)' },
    ]);

    function setLocked(v) {
      S.locked = v;
      xSlider.setEnabled(!v);
      mSlider.setEnabled(!v);
      go.disabled = v;
    }
    function settle(val) { if (S.resolve) { const r = S.resolve; S.resolve = null; r(val); } }
    function aim() {
      settle();
      tw.clear();
      S.running = false;
      S.phase = 'ready';
      S.launchV = null;
      S.hMax = null;
      S.over = false;
      S.caption = '';
      S.pose = 'standing';
      S.r = M.Rider(track, { s: sRest - S.x, v: 0, ends: 'stop', spring: { s: sRest, kOverM: S.k / S.m } });
    }
    function fire(x) {
      S.x = x;
      xSlider.set(x);
      aim();
      S.running = true;
      S.phase = 'go';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function step(dt) {
      tw.step(dt);
      if (!S.running) return;
      const r = S.r;
      const before = r.v, sBefore = r.s;
      r.step(dt * opts.slow);
      if (S.launchV === null && sBefore < sRest && r.s >= sRest) S.launchV = Math.abs(r.v);
      const atPeak = before > 0 && r.v <= 0 && r.s > sRest;
      if (atPeak || r.stopped) {
        S.running = false;
        S.over = r.stopped && r.end === 'finish';
        /* Past the ramp's end he keeps the sideways part of his speed, so only the upward part still climbs. */
        const uy = track.at(track.length).uy;
        S.hMax = S.over ? TOPY + uy * uy * (r.e / 10 - TOPY) : r.e / 10;
        S.phase = 'peak';
        S.pose = S.over ? 'flying' : 'happy';
        S.marks.push({ x: S.x, h: S.hMax, v: S.launchV });
        settle({ h: S.hMax, v: S.launchV });
      }
    }
    function energies() {
      const r = S.r, m = S.m;
      const q = track.at(r.s);
      const d = Math.max(0, sRest - r.s);
      const es = 0.5 * S.k * d * d;
      const pe = m * 10 * q.y;
      const ke = Math.max(0, m * r.e - pe - es);
      return { es, pe, ke };
    }
    function render() {
      const small = view.w < 460;
      const r = view.visible;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, RAMP0, 0, {});
      view.poly(pts, { color: C.axis, width: 4 });
      view.poly(pts.concat([{ x: pts[pts.length - 1].x, y: 0 }, { x: RAMP0, y: 0 }]).slice(120), { fill: C.gridStrong, alpha: 0.35, close: true });
      view.line(WALL, 0, WALL, 2.2, { color: C.axis, width: 6, cap: 'butt' });
      const rider = S.r;
      const q = track.at(rider.s);
      const px = small ? 40 : 52;
      const hw = (px * 0.42) / view.scale;
      const plateX = Math.min(REST, q.x) - hw;
      M.drawSpring(view, WALL, 0.7, plateX, 0.7, { color: C.soft, width: 11, coils: 6, lineWidth: 3 });
      view.line(plateX, 0.1, plateX, 1.3, { color: C.axis, width: 4 });
      view.line(REST - hw, -0.45, REST - hw, 0, { color: C.displacement, width: 1.5, dash: [3, 3] });
      if (S.phase === 'ready' && S.x > 0.04) {
        view.arrow(REST - hw, -0.5, REST - hw - S.x, -0.5, { color: C.displacement, width: 2.5, head: 8 });
        view.text(REST - hw - S.x / 2, -0.5, F.unit(S.x, 'm', 2), { size: 12, weight: 700, color: C.displacement, halo: true, offset: [0, 12] });
      }
      /* peak marks */
      S.marks.forEach(function (mk, i) {
        const cl = Math.min(mk.h, TOPY);
        const xr = RAMP0 + Math.sqrt(cl / CURVE);
        view.line(xr - 3.2, cl, xr + 0.2, cl, { color: i === S.marks.length - 1 ? C.displacement : C.soft, width: 2.2 });
        view.text(xr - 3.3, cl, F.unit(mk.h, 'm', 2), { size: 12.5, weight: 800, color: C.displacement, halo: true, align: 'right' });
      });
      const pose = S.phase === 'peak' ? S.pose : S.phase === 'go' ? 'sliding' : 'standing';
      if (pose === 'flying') PHY.mascot.draw(view, q.x, q.y + 0.6, { pose, px });
      else M.rideCat(view, q, { px, pose });
      if (Math.abs(rider.v) > 0.3) {
        const k = 4 / view.scale;
        view.arrow(q.x, q.y + 0.25, q.x + q.ux * rider.v * k, q.y + 0.25 + q.uy * rider.v * k, { color: C.velocity, width: 3.5 });
      }
      const en = energies();
      const total = en.es + en.ke + en.pe;
      M.energyPanel(view, {
        x: 6, y: 5, w: view.w - 12, max: Math.max(S.maxE, total), digits: 1,
        items: [{ label: 'קפיץ', value: en.es, color: C.soft }, { label: 'קינטית', value: en.ke, color: C.accent }, { label: 'גובה', value: en.pe, color: C.gold }],
      });
      if (S.caption) view.screenText(view.w / 2, 78, S.caption, { size: small ? 13 : 14, weight: 700, pill: true });
      out.set('es', F.unit(0.5 * S.k * S.x * S.x, "ג'ול", 2));
      out.set('v', S.launchV === null ? '–' : F.unit(S.launchV, 'ms', 2));
      out.set('h', S.hMax === null ? '–' : F.unit(S.hMax, 'm', 2));
    }
    const loop = PHY.SimLoop({ view, step, render });
    aim();
    setLocked(S.locked);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { S.marks = []; aim(); loop.requestRender(); },
      play(x) { return fire(x === undefined ? S.x : x); },
      playDouble(x) {
        const a = x === undefined ? 0.5 : x;
        S.marks = [];
        return fire(a)
          .then(function () { return tw.run(0.6); })
          .then(function () { S.pose = 'standing'; return fire(2 * a); })
          .then(function () {
            const n = S.marks.length;
            if (n >= 2) S.caption = 'פי 2 כיווץ: פי ' + F.num(S.marks[n - 1].v / S.marks[n - 2].v, 2) + ' מהירות, פי ' + F.num(S.marks[n - 1].h / S.marks[n - 2].h, 2) + ' גובה';
            return tw.run(0.8);
          });
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'x') { S.x = v; xSlider.set(v); }
        if (name === 'm') { S.m = v; mSlider.set(v); }
        if (name === 'k') S.k = v;
        S.marks = [];
        aim();
        loop.requestRender();
      },
      getState() {
        const en = energies();
        return { x: S.x, k: S.k, m: S.m, spring: 0.5 * S.k * S.x * S.x, launchV: S.launchV, hMax: S.hMax, over: S.over, marks: S.marks.slice(), es: en.es, ke: en.ke, pe: en.pe, phase: S.phase };
      },
    };
  };
})();

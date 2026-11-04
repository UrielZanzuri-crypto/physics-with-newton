/* PHY.sims.bowl: the energy thief. Smooth curved sides, and a flat rough patch at the bottom. Every crossing
   of the patch costs the same joules, because the friction force and the path are the same each time, so the
   peaks come down by equal steps. The heat bar takes exactly what the other two bars lose.
   opts: {h0, mu, L, mass, locked, thermal, speed}. sim.play() -> Promise. setParam: mu, L, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const CURVE = 0.2, TOP = 6.5;

  PHY.sims.bowl = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ h0: 5, mu: 0.4, L: 3, mass: 2, locked: true, thermal: false, speed: 1.1 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -9.6, xMax: 9.6, yMin: -1.4, yMax: 10 }, aspect: 1.55, minHeight: 300, maxHeight: 440 });
    const S = { mu: opts.mu, L: opts.L, track: null, r: null, running: false, done: false, hold: 0, peaks: [], sparks: [], passes: 0, inPatch: false, resolve: null, locked: opts.locked, caption: '', lastV: 0 };

    const muSlider = U.Slider(controlsEl, {
      label: 'כמה מחוספס המשטח, μ', min: 0.1, max: 0.8, step: 0.05, value: S.mu, digits: 2, format: (v) => F.num(v, 2), color: 'var(--apple)',
      onInput(v) { S.mu = v; build(); loop.requestRender(); },
    });
    const lSlider = U.Slider(controlsEl, {
      label: 'אורך המשטח', min: 1, max: 6, step: 1, value: S.L, unit: 'm', digits: 0, color: 'var(--c-displacement)',
      onInput(v) { S.L = v; build(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'להחליק שוב', function () { launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'p', label: 'מעברים על המשטח' },
      { key: 'loss', label: 'הפסד בכל מעבר', color: 'var(--apple)' },
      { key: 'd', label: 'דרך על המשטח', color: 'var(--c-displacement)' },
    ]);

    function setLocked(v) {
      S.locked = v;
      muSlider.setEnabled(!v);
      lSlider.setEnabled(!v);
      go.disabled = v;
    }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function build() {
      settle();
      const half = S.L / 2, D = Math.sqrt(TOP / CURVE);
      const pts = M.join(
        M.fn(function (x) { const d = -x - half; return CURVE * d * d; }, -half - D, -half, 180),
        M.line(-half, 0, half, 0, Math.max(30, Math.round(S.L * 20))),
        M.fn(function (x) { const d = x - half; return CURVE * d * d; }, half, half + D, 180)
      );
      S.track = M.Track(pts);
      const startX = -half - Math.sqrt(opts.h0 / CURVE);
      S.r = M.Rider(S.track, {
        s: S.track.atX(startX), v: 0, ends: 'bounce', kCap: 0,
        mu: function (s) { return Math.abs(S.track.at(s).x) <= half ? S.mu : 0; },
      });
      S.running = false; S.done = false; S.hold = 0; S.peaks = []; S.sparks = []; S.passes = 0; S.inPatch = false; S.caption = ''; S.lastV = 0;
    }
    function launch() {
      build();
      S.running = true;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function step(dt) {
      S.sparks.forEach(function (p) { p.y += p.vy * dt; p.x += p.vx * dt; p.life -= dt; });
      S.sparks = S.sparks.filter(function (p) { return p.life > 0; });
      if (!S.running) return;
      const h = dt * opts.speed;
      const r = S.r, before = r.v;
      r.step(h);
      const q = S.track.at(r.s);
      const on = Math.abs(q.x) <= S.L / 2;
      if (on && !S.inPatch) S.passes++;
      S.inPatch = on;
      if (on && Math.abs(r.v) > 0.3 && Math.random() < 0.45) {
        S.sparks.push({ x: q.x, y: 0.05, vx: -r.v * 0.08 + (Math.random() - 0.5) * 0.8, vy: 0.8 + Math.random() * 1.2, life: 0.35 + Math.random() * 0.4 });
      }
      /* A peak on a smooth side: the speed changed sign, and the height is what the energy allows. */
      if (!r.stopped && before * r.v < 0 && !on) S.peaks.push({ x: q.x, y: r.e / 10 });
      if (r.stopped) {
        S.hold += dt;
        S.caption = opts.thermal
          ? M.unitJ(opts.mass * 10 * opts.h0) + ' עדיין כאן, כולם חום.'
          : 'עצר אחרי ' + F.unit(r.roughPath, 'm', 1) + ' על המשטח.';
        if (S.hold > 0.8) {
          S.running = false;
          S.done = true;
          settle();
        }
      }
    }
    function render() {
      const small = view.w < 460;
      const r = view.visible;
      const m = opts.mass, rider = S.r;
      const q = S.track.at(rider.s);
      const total = m * 10 * opts.h0;
      const heat = m * rider.heat, pe = m * 10 * q.y, ke = Math.max(0, m * rider.e - pe);
      view.clear();
      view.grid(1, {});
      view.line(r.xMin, 0, -S.L / 2, 0, { color: C.gridStrong, width: 1 });
      view.poly(S.track.points, { color: C.axis, width: 4.5 });
      M.roughPatch(view, -S.L / 2, S.L / 2, 0, { heat: heat / total });
      view.text(0, 0, 'μ = ' + F.num(S.mu, 2), { size: 12, weight: 700, color: C.ink, halo: true, offset: [0, 18] });
      /* the starting height, and every peak since */
      view.line(-S.L / 2 - Math.sqrt(opts.h0 / CURVE), opts.h0, S.L / 2 + Math.sqrt(opts.h0 / CURVE), opts.h0, { color: C.gold, width: 1.6, dash: [6, 5] });
      view.text(0, opts.h0, F.unit(opts.h0, 'm', 1), { size: 12, weight: 800, color: C.ink, halo: true, offset: [0, -11] });
      S.peaks.forEach(function (p) {
        const side = p.x < 0 ? -1 : 1;
        view.line(p.x - side * 0.4, p.y, p.x + side * 0.9, p.y, { color: C.displacement, width: 2.5 });
        view.text(p.x + side * 1, p.y, F.unit(p.y, 'm', 1), { size: 12, weight: 800, color: C.displacement, halo: true, align: side < 0 ? 'right' : 'left' });
      });
      S.sparks.forEach(function (p) { view.circle(p.x, p.y, 2.6, { px: true, fill: C.apple, alpha: Math.min(1, p.life * 2) }); });
      const pose = rider.stopped ? 'dizzy' : 'sliding';
      M.rideCat(view, q, { px: small ? 36 : 46, pose, flip: rider.v < 0 });
      if (Math.abs(rider.v) > 0.4) {
        const k = 4 / view.scale, sg = rider.v < 0 ? -1 : 1;
        view.arrow(q.x, q.y, q.x + q.ux * Math.abs(rider.v) * k * sg, q.y + q.uy * Math.abs(rider.v) * k * sg, { color: C.velocity, width: 3 });
      }
      M.energyPanel(view, {
        x: 6, y: 5, w: view.w - 12, max: total,
        items: [{ label: 'קינטית', value: ke, color: C.accent }, { label: 'גובה', value: pe, color: C.gold }, { label: 'חום', value: heat, color: C.apple }],
      });
      if (S.caption) view.screenText(view.w / 2, 78, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
      out.set('p', String(S.passes));
      /* Equal loss on every pass is what the card asks about, so its readout waits for the run. */
      out.set('loss', S.locked && !S.running && !S.done ? '?' : M.unitJ(S.mu * m * 10 * S.L));
      out.set('d', F.unit(rider.roughPath, 'm', 1));
    }
    const loop = PHY.SimLoop({ view, step, render });
    build();
    setLocked(S.locked);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { build(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'mu') { S.mu = v; muSlider.set(v); build(); }
        if (name === 'L') { S.L = v; lSlider.set(v); build(); }
        loop.requestRender();
      },
      getState() {
        const q = S.track.at(S.r.s), m = opts.mass;
        return {
          peaks: S.peaks.map(function (p) { return p.y; }), heat: m * S.r.heat, total: m * S.r.heat + m * S.r.e,
          roughPath: S.r.roughPath, stopped: S.r.stopped, done: S.done, x: q.x, passes: S.passes, h0: opts.h0, mass: m, mu: S.mu, L: S.L,
          ke: Math.max(0, m * S.r.e - m * 10 * q.y), pe: m * 10 * q.y,
        };
      },
    };
  };
})();

/* PHY.sims.shadowsXy: the projectile's shadows from chapter 1. A lamp above casts a shadow on the floor
   (x), a lamp at the side casts one on the wall (y). Stamps every 0.25 s show the floor shadow taking equal
   steps while the wall shadow bunches up at the top. With opts.twin, an apple thrown straight up with
   the same vy rides along the wall: it IS the wall shadow.
   Position shadows are purple (displacement), velocity arrows are blue. sim.play() -> Promise. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;

  PHY.sims.shadowsXy = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ speed: 20, angle: 45, twin: false, locked: true, slow: 0.65, every: 0.25 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -4.5, xMax: 46, yMin: -4, yMax: 22 },
      aspect: 1.9,
      minHeight: 220,
      maxHeight: 420,
    });
    const S = { v: opts.speed, a: opts.angle, t: 0, running: false, done: false, stamps: [], next: 0, caption: '', locked: opts.locked, resolve: null };
    const K = 0.28; /* arrow length in meters per m/s */

    const angSlider = U.Slider(controlsEl, {
      label: 'זווית הירי', min: 15, max: 75, step: 1, value: S.a, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; changed(); },
    });
    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות הירי', min: 10, max: 20, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; changed(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'ירה!', function () { fireFree(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'x', label: 'צל על הרצפה (x)', color: 'var(--c-displacement)' },
      { key: 'y', label: 'צל על הקיר (y)', color: 'var(--c-displacement)' },
      { key: 'vx', label: 'מהירות הצל על הרצפה', color: 'var(--c-velocity)' },
      { key: 'vy', label: 'מהירות הצל על הקיר', color: 'var(--c-velocity)' },
    ]);

    function T() { return B.flightTime(S.v, S.a); }
    function clearRun() { S.t = 0; S.running = false; S.done = false; S.stamps = []; S.next = 0; S.caption = ''; }
    function changed() { if (!S.running) clearRun(); loop.requestRender(); }
    function setLocked(v) {
      S.locked = v;
      angSlider.setEnabled(!v);
      speedSlider.setEnabled(!v);
      fireBtn.disabled = v;
    }

    function launch(caption) {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      clearRun();
      S.running = true;
      S.caption = caption || '';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function fireFree() {
      if (S.running || S.locked) return;
      fireBtn.disabled = true;
      launch().then(function () { fireBtn.disabled = S.locked; });
    }

    function step(dt) {
      if (!S.running) return;
      S.t += dt * opts.slow;
      const end = T();
      while (S.next <= S.t && S.next < end) {
        const p = B.at(S.v, S.a, S.next);
        S.stamps.push({ t: S.next, x: p.x, y: p.y });
        S.next += opts.every;
      }
      if (S.t >= end) {
        S.t = end;
        S.running = false;
        S.done = true;
        S.caption = opts.twin ? 'נחתו יחד, אחרי ' + F.unit(end, 's', 1) : 'רצפה: צעדים שווים. קיר: זריקה למעלה.';
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    function render() {
      const end = T();
      const p = B.at(S.v, S.a, S.t);
      view.clear();
      view.grid(5, {});
      view.axes({ xLabel: 'x', yLabel: 'y', tickEvery: 10, tickLabels: true });
      view.poly(B.path(S.v, S.a), { color: C.soft, width: 1.5, dash: [4, 6] });

      /* Stamps: on the path and on both axes */
      S.stamps.forEach(function (s) {
        view.circle(s.x, s.y, 3.5, { px: true, fill: C.soft, alpha: 0.6 });
        view.circle(s.x, 0, 4, { px: true, fill: C.displacement, alpha: 0.75 });
        view.circle(0, s.y, 4, { px: true, fill: C.displacement, alpha: 0.75 });
      });

      /* The lamp lines */
      if (p.y > 0.2) view.line(p.x, p.y, p.x, 0, { color: C.soft, width: 1.3, dash: [3, 5] });
      if (p.x > 0.2 && !opts.twin) view.line(p.x, p.y, 0, p.y, { color: C.soft, width: 1.3, dash: [3, 5] });

      /* The shadows carry the velocity components */
      view.circle(p.x, 0, 8, { px: true, fill: C.displacement, color: C.surface, width: 2 });
      view.circle(0, p.y, 8, { px: true, fill: C.displacement, color: C.surface, width: 2 });
      if (S.t > 0 && !S.done) {
        const below = -14 / view.scale;
        view.arrow(p.x, below, p.x + p.vx * K, below, { color: C.velocity, width: 3.5, label: F.unit(p.vx, 'ms', 1), labelSide: 1, labelGap: 13, labelSize: 12 });
        if (Math.abs(p.vy) > 0.4) view.arrow(-14 / view.scale, p.y, -14 / view.scale, p.y + p.vy * K, { color: C.velocity, width: 3.5 });
      }

      /* The twin apple, thrown straight up with the same vy */
      if (opts.twin) {
        B.drawApple(view, 0, p.y, 18);
        if (S.t > 0) view.line(0, p.y, p.x, p.y, { color: C.soft, width: 1.5, dash: [5, 4] });
      }

      /* The cat is the projectile */
      if (S.t > 0 && p.y > 0.05) view.arrow(p.x, p.y, p.x + p.vx * K, p.y + p.vy * K, { color: C.velocity, width: 4 });
      const px = view.w < 420 ? 36 : 50;
      if (S.done) PHY.mascot.draw(view, p.x, 0, { pose: 'standing', px: px });
      else PHY.mascot.draw(view, p.x, p.y, { pose: 'flying', px: px, rot: S.t > 0 ? (Math.atan2(p.vy, p.vx) * 180) / Math.PI : S.a });
      B.drawCannon(view, 0, 0, S.a, { len: 26, w: 11 });

      if (S.caption) view.screenText(view.w / 2 + 12, 20, S.caption, { size: 13.5, weight: 700, pill: true });

      /* Before the first run of a locked card, the flight time and the speeds would give the answer away.
         F.num(NaN) is the same empty mark that an untouched readout shows. */
      const hide = S.locked && !S.running && !S.done;
      out.set('t', hide ? F.unit(S.t, 's', 2) : F.unit(S.t, 's', 2) + ' מתוך ' + F.unit(end, 's', 2));
      out.set('x', F.unit(p.x, 'm', 1));
      out.set('y', F.unit(p.y, 'm', 1));
      out.set('vx', hide ? F.num(NaN) : F.unit(p.vx, 'ms', 1));
      out.set('vy', hide ? F.num(NaN) : F.unit(p.vy, 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; speedSlider.set(v); }
        if (name === 'angle') { S.a = v; angSlider.set(v); }
        if (name === 'locked') { setLocked(!!v); return; } /* keep the finished flight on screen */
        changed();
      },
      getState() {
        const p = B.at(S.v, S.a, S.t);
        return { t: S.t, T: T(), running: S.running, done: S.done, x: p.x, y: p.y, vx: p.vx, vy: p.vy, stamps: S.stamps.map(function (s) { return { t: s.t, x: s.x, y: s.y }; }) };
      },
      play(o) { return launch(o && o.caption); },
    };
    setLocked(S.locked);
    return api;
  };
})();

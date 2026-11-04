/* PHY.sims.twoBalls: one apple is dropped, the others are fired horizontally at the same instant from
   the same height. A strobe view stamps all of them every 0.4 s, with a dashed line through each
   instant: the heights match at every stamp. Velocity is blue.
   opts: {height, speed, compare (always fires a 10 m/s reference too), locked}
   sim.play({speeds, caption}) -> Promise. setParam: speed, locked, strobe. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;

  PHY.sims.twoBalls = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ height: 20, speed: 10, compare: false, locked: true, slow: 0.6, every: 0.4 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -6.5, xMax: 44, yMin: -3, yMax: 24.5 },
      aspect: 1.75,
      minHeight: 230,
      maxHeight: 440,
    });
    const S = {
      H: opts.height, v: opts.speed, shots: opts.compare ? [10, opts.speed] : [opts.speed],
      T: B.flightTime(0, 0, opts.height), t: 0, running: false, done: false,
      stamps: [], next: 0, strobe: true, caption: '', locked: opts.locked, resolve: null,
    };
    const K = 0.3; /* arrow length in meters per m/s */

    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות הירי האופקית', min: 5, max: 20, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; if (!S.running) { clearRun(); loop.requestRender(); } },
    });
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'ירה!', function () { fireFree(); }, { primary: true });
    const strobeToggle = U.Toggle(row, 'סימון כל ' + F.unit(opts.every, 's', 1), {
      value: true,
      onChange(v) { S.strobe = v; loop.requestRender(); },
    });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן מהירייה' },
      { key: 'hA', label: 'גובה התפוח שנשמט', color: 'var(--c-displacement)' },
      { key: 'hB', label: 'גובה התפוח שנורה', color: 'var(--c-displacement)' },
      { key: 'xB', label: 'מרחק אופקי', color: 'var(--c-displacement)' },
    ]);

    function setLocked(v) {
      S.locked = v;
      speedSlider.setEnabled(!v);
      fireBtn.disabled = v;
      strobeToggle.input.disabled = v;
    }

    function clearRun() {
      S.t = 0; S.running = false; S.done = false; S.stamps = []; S.next = 0; S.caption = '';
      S.shots = opts.compare ? [10, S.v] : [S.v];
    }

    function positions(t) {
      return {
        drop: B.at(0, 0, t, S.H),
        fired: S.shots.map(function (v) { return B.at(v, 0, t, S.H); }),
      };
    }

    function stamp(t) {
      const p = positions(t);
      S.stamps.push({ t: t, y: p.drop.y, xs: p.fired.map(function (q) { return q.x; }), ys: p.fired.map(function (q) { return q.y; }) });
    }

    function launch(speeds, caption) {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.shots = speeds;
      S.t = 0; S.stamps = []; S.next = 0; S.done = false; S.running = true; S.caption = caption || '';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function fireFree() {
      if (S.running || S.locked) return;
      fireBtn.disabled = true;
      launch(opts.compare ? [10, S.v] : [S.v]).then(function () { fireBtn.disabled = S.locked; });
    }

    function step(dt) {
      if (!S.running) return;
      S.t += dt * opts.slow;
      while (S.next <= S.t && S.next < S.T - 1e-6) {
        stamp(S.next);
        S.next += opts.every;
      }
      if (S.t >= S.T) {
        S.t = S.T;
        stamp(S.T);
        S.running = false;
        S.done = true;
        S.caption = 'כולם נחתו יחד, אחרי ' + F.unit(S.T, 's', 1);
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    function render() {
      const p = positions(S.t);
      const r = view.visible;
      view.clear();
      view.grid(5, {});
      B.drawGround(view, 0, { every: 10 });

      /* The tower, with the cat dropping apples from the top of it. */
      view.poly([{ x: -5.2, y: 0 }, { x: 0, y: 0 }, { x: 0, y: S.H }, { x: -5.2, y: S.H }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
      view.text(-2.6, S.H / 2, F.unit(S.H, 'm', 0), { size: 12.5, weight: 700, color: C.ink });
      B.drawCannon(view, 0, S.H, 0, { len: 22, w: 11 });
      PHY.mascot.draw(view, -2.7, S.H, { pose: S.running ? 'thinking' : S.done ? 'happy' : 'standing', px: view.w < 420 ? 38 : 52 });

      /* Strobe stamps with a dashed line through each instant: same line, same height. */
      if (S.strobe) {
        S.stamps.forEach(function (s) {
          const far = Math.max.apply(null, s.xs.concat([0.6]));
          if (s.t > 0) view.line(0, s.y, far, s.y, { color: C.soft, width: 1.4, dash: [4, 5], alpha: 0.75 });
          B.drawApple(view, 0, s.y, 11, { color: C.gold, plain: true, alpha: 0.7 });
          s.xs.forEach(function (x, i) { B.drawApple(view, x, s.ys[i], 11, { plain: true, alpha: 0.7 }); });
        });
      }

      /* Landing marks */
      p.fired.forEach(function (q, i) {
        if (S.done) view.text(q.x, 0, F.unit(q.x, 'm', 0), { size: 13, weight: 700, color: C.displacement, offset: [0, -30], halo: true });
        const lbl = S.running || S.done ? F.unit(S.shots[i], 'ms', 0) : '';
        if (lbl && q.y > 2) view.text(q.x, q.y, lbl, { size: 11.5, weight: 700, color: C.velocity, offset: [0, -20], halo: true });
      });

      /* The apples and their velocity arrows */
      B.drawApple(view, p.drop.x, p.drop.y, 17, { color: C.gold });
      p.fired.forEach(function (q) {
        if (S.t > 0 && !S.done) view.arrow(q.x, q.y, q.x + q.vx * K, q.y + q.vy * K, { color: C.velocity, width: 3 });
        B.drawApple(view, q.x, q.y, 17);
      });
      if (S.t > 0 && S.t < S.T) view.arrow(p.drop.x, p.drop.y, p.drop.x, p.drop.y + p.drop.vy * K, { color: C.velocity, width: 3 });

      if (S.caption) view.screenText(view.w / 2 + 16, 20, S.caption, { size: 14, weight: 700, pill: true });
      else if (!S.running && !S.done && r.xMax) view.screenText(view.w / 2 + 16, 20, 'הזהוב נשמט, האדום נורה', { size: 13, color: C.soft });

      const last = p.fired[p.fired.length - 1];
      out.set('t', F.unit(S.t, 's', 2));
      out.set('hA', F.unit(p.drop.y, 'm', 1));
      out.set('hB', F.unit(last.y, 'm', 1));
      out.set('xB', F.unit(last.x, 'm', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; speedSlider.set(v); clearRun(); }
        if (name === 'locked') setLocked(!!v);
        if (name === 'strobe') { S.strobe = !!v; strobeToggle.set(!!v); }
        loop.requestRender();
      },
      getState() {
        const p = positions(S.t);
        return {
          t: S.t, T: S.T, running: S.running, done: S.done, dropY: p.drop.y,
          firedY: p.fired.map(function (q) { return q.y; }), firedX: p.fired.map(function (q) { return q.x; }),
          stamps: S.stamps.map(function (s) { return { t: s.t, y: s.y, ys: s.ys.slice() }; }),
        };
      },
      play(o) {
        o = o || {};
        return launch(o.speeds || [S.v], o.caption);
      },
    };
    setLocked(S.locked);
    return api;
  };
})();

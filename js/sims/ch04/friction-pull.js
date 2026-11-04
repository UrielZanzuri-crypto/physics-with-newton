/* PHY.sims.frictionPull: a 10 kg crate, μs = 0.5, μk = 0.4. Pull slider. Static friction matches the pull up to
   μs·N = 50 N, the crate breaks free, friction drops to μk·N = 40 N. The graph draws friction against pull, live.
   sim.play({to, T}) ramps the pull and holds. setParam: pull, locked.
   sim.advance(s) runs the physics without waiting for frames. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10;

  PHY.sims.frictionPull = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ m: 10, mus: 0.5, muk: 0.4, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -6, xMax: 6, yMin: -8.8, yMax: 3.6 }, aspect: 1.1, minHeight: 370, maxHeight: 470 });
    const gate = K.gate();
    const S = { m: opts.m, mus: opts.mus, muk: opts.muk, P: 0, f: 0, x: 0, v: 0, a: 0, stuck: true, broke: false, breakAt: null, trace: [], phase: 'free', ramp: null, hold: 0, locked: opts.locked };
    const N = () => S.m * G;
    const plot = PHY.ch02.Plot(view, { tMin: 0, tMax: 80, yMin: 0, yMax: 60, tTick: 20, yTick: 20, title: 'חיכוך (ניוטון)', tLabel: 'משיכה (ניוטון)' });

    const slider = U.Slider(controlsEl, {
      label: 'כמה מושכים', min: 0, max: 80, step: 1, value: 0, unit: 'N', digits: 0, color: 'var(--c-force)',
      onInput(v) { S.P = v; loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const resetBtn = U.Button(row, 'מההתחלה', function () { if (!S.locked) { api.reset(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'p', label: 'משיכה', color: 'var(--c-force)' },
      { key: 'f', label: 'חיכוך', color: 'var(--c-force)' },
      { key: 'net', label: 'שקול', color: 'var(--c-force)' },
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
    ]);

    function setLocked(v) { S.locked = v; slider.setEnabled(!v); resetBtn.disabled = v; }

    function physics(dt) {
      const fsMax = S.mus * N(), fk = S.muk * N();
      if (S.stuck) {
        if (S.P > fsMax + 1e-9) {
          S.stuck = false;
          S.broke = true;
          S.breakAt = S.P;
        } else {
          S.f = S.P;
          S.a = 0;
          return;
        }
      }
      S.f = fk;
      S.a = (S.P - fk) / S.m;
      const nv = S.v + S.a * dt;
      if (nv <= 0) {
        S.v = 0; S.a = 0;
        S.stuck = true;
        S.f = Math.min(S.P, fsMax);
        return;
      }
      S.x += ((S.v + nv) / 2) * dt;
      S.v = nv;
    }

    function record() {
      const l = S.trace[S.trace.length - 1];
      if (!l || Math.abs(l.t - S.P) > 0.25 || Math.abs(l.y - S.f) > 0.25) S.trace.push({ t: S.P, y: S.f });
      if (S.trace.length > 800) S.trace.shift();
    }

    function step(dt) {
      if (S.ramp) {
        S.ramp.t += dt;
        const k = Math.min(S.ramp.t / S.ramp.T, 1);
        S.P = S.ramp.from + (S.ramp.to - S.ramp.from) * k;
        if (k >= 1) { S.hold += dt; if (S.hold >= (S.ramp.hold || 1)) { S.ramp = null; S.hold = 0; gate.close(); } }
      }
      physics(dt);
      record();
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      const r = view.visible;
      K.ground(view, 0, { depth: 0.55, ticks: 1, shift: S.x });
      const cx = -1.3;
      const w = small ? 66 : 84, h = w * 0.82;
      const hw = (w / 2) / view.scale;
      const midY = (h / 2) / view.scale;
      K.crate(view, cx, 0, w, h, { label: F.unit(S.m, 'kg', 0), size: small ? 12.5 : 14 });
      const catX = Math.min(4.6, r.xMax - 1);
      const catPx = small ? 64 : 84;
      const pose = !S.stuck ? 'happy' : S.P > 35 ? 'dizzy' : S.P > 0 ? 'thinking' : 'standing';
      PHY.mascot.draw(view, catX, 0, { pose, px: catPx });
      view.line(cx + hw, midY, catX - 0.6, midY, { color: C.axis, width: 2.5 });
      const k = 0.06;
      if (S.P > 0.5) {
        const ay = midY + 11 / view.scale;
        view.arrow(cx + hw, ay, cx + hw + S.P * k, ay, { color: C.force, width: 3.8 });
        view.text(cx + hw + (S.P * k) / 2, ay, 'משיכה ' + F.unit(S.P, 'N', 0), { size: 12, weight: 700, color: C.force, offset: [Math.max(0, 50 - (S.P * k * view.scale) / 2), -13], halo: true });
      }
      if (S.f > 0.5) {
        const fy = 6 / view.scale;
        view.arrow(cx - hw, fy, cx - hw - S.f * k, fy, { color: C.force, width: 3.8 });
        view.text(cx - hw - (S.f * k) / 2, fy, 'חיכוך ' + F.unit(S.f, 'N', 0), { size: 12, weight: 700, color: C.force, offset: [Math.min(0, -(50 - (S.f * k * view.scale) / 2)), -14], halo: true });
      }
      const topY = (h + 12) / view.scale;
      if (S.v > 0.02) {
        const len = Math.min(5, S.v * 0.5);
        view.arrow(cx, topY, cx + len, topY, { color: C.velocity, width: 3.2 });
        view.text(cx + len, topY, F.unit(S.v, 'ms', 1), { size: 11.5, weight: 700, color: C.velocity, align: 'left', offset: [5, 0], halo: true });
      }
      if (Math.abs(S.a) > 0.02) {
        const y2 = topY + 15 / view.scale;
        const len = Math.max(-5, Math.min(5, S.a * 0.8));
        view.arrow(cx, y2, cx + len, y2, { color: C.acceleration, width: 3.2 });
        view.text(cx + Math.max(0, len), y2, F.unit(S.a, 'ms2', 1), { size: 11.5, weight: 700, color: C.acceleration, align: 'left', offset: [5, 0], halo: true });
      }
      view.screenText(view.w - 10, 16, S.stuck ? 'דבוק: חיכוך סטטי' : 'מחליק: חיכוך קינטי', { size: small ? 11.5 : 13, weight: 700, align: 'right', pill: true, color: S.stuck ? C.ink : C.accent });

      /* the graph, in pixels below the floor */
      const gy = view.sy(-0.55) + 4;
      plot.box(4, gy, view.w - 8, view.h - gy - 4);
      plot.frame();
      const fsMax = S.mus * N(), fk = S.muk * N();
      plot.hline(fsMax, { color: C.soft });
      plot.hline(fk, { color: C.soft });
      plot.text(79, fsMax, 'μs·N', { size: 11.5, weight: 700, color: C.soft, align: 'right', baseline: 'bottom' });
      plot.text(79, fk, 'μk·N', { size: 11.5, weight: 700, color: C.soft, align: 'right', baseline: 'top' });
      plot.curve(S.trace, { color: C.force, width: 3 });
      plot.dot(S.P, S.f, { color: C.force });

      out.set('p', F.unit(S.P, 'N', 0));
      out.set('f', F.unit(S.f, 'N', 0));
      out.set('net', F.unit(S.P - S.f, 'N', 0));
      out.set('a', F.unit(S.a, 'ms2', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        gate.close();
        Object.assign(S, { P: 0, f: 0, x: 0, v: 0, a: 0, stuck: true, broke: false, breakAt: null, trace: [], ramp: null, hold: 0 });
        slider.set(0);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'pull') { S.P = v; slider.set(v); }
        loop.requestRender();
      },
      getState() {
        return { P: S.P, f: S.f, a: S.a, v: S.v, x: S.x, stuck: S.stuck, broke: S.broke, breakAt: S.breakAt, N: N(), fsMax: S.mus * N(), fk: S.muk * N() };
      },
      play(o) {
        o = o || {};
        api.reset();
        S.ramp = { from: 0, to: o.to === undefined ? 30 : o.to, T: o.T || 2.4, t: 0, hold: o.hold || 1 };
        slider.set(S.ramp.to);
        return gate.open();
      },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 120) step(1 / 120);
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

/* PHY.sims.crateLanes: crates in lanes, each pushed by its own forces.
   mode 'push':   law 2. Same force on m and 2m. Sliders for F and m after the card.
   mode 'steady': the trap. Three crates already moving, friction 20 N, pulled with 25, 20 and 15 N.
   mode 'fall':   mass and weight. 1 kg and 3 kg fall from 20 m with no air.
   sim.play() -> Promise. The numbers on screen are the integrated ones. setParam: F, m, m2, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10;

  const WORLDS = {
    push: { xMin: -1.5, xMax: 27, yMin: -1.4, yMax: 13.6 },
    steady: { xMin: -1.5, xMax: 27, yMin: -1.4, yMax: 19.4 },
    fall: { xMin: -5.5, xMax: 17.5, yMin: -3.4, yMax: 23.8 },
  };

  PHY.sims.crateLanes = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ mode: 'push', locked: true }, opts || {});
    const mode = opts.mode;
    const view = PHY.canvas.create(canvasEl, {
      world: WORLDS[mode],
      aspect: mode === 'fall' ? 1 : mode === 'steady' ? 1.4 : 1.75,
      minHeight: mode === 'fall' ? 400 : mode === 'steady' ? 275 : 215,
      maxHeight: mode === 'fall' ? 500 : 420,
    });
    const gate = K.gate();
    const S = { F: opts.F || 10, m: opts.m || 2, m2: opts.m2 || 3, drop: 20, t: 0, phase: 'ready', lanes: [], slow: mode === 'fall' ? 0.5 : 1, hold: 0, locked: opts.locked };
    const hud = {};
    /* A locked sim that has not run yet belongs to a card: the result waits for the run. */
    const secret = () => S.locked && S.phase === 'ready';

    if (mode === 'push') {
      hud.F = U.Slider(controlsEl, { label: 'הכוח על כל ארגז', min: 2, max: 30, step: 1, value: S.F, unit: 'N', digits: 0, color: 'var(--c-force)', onInput(v) { S.F = v; clearRun(); loop.requestRender(); } });
      hud.m = U.Slider(controlsEl, { label: 'מסת הארגז הקל', min: 1, max: 6, step: 1, value: S.m, unit: 'kg', digits: 0, onInput(v) { S.m = v; clearRun(); loop.requestRender(); } });
      const row = U.h('div', { class: 'sim-row' });
      hud.go = U.Button(row, 'שוב, עם המספרים האלה', function () { if (!S.locked) api.play(); }, { primary: true });
      controlsEl.appendChild(row);
      hud.out = U.Readouts(controlsEl, [
        { key: 'a0', label: 'תאוצת הקל', color: 'var(--c-acceleration)' },
        { key: 'a1', label: 'תאוצת הכבד', color: 'var(--c-acceleration)' },
        { key: 'v0', label: 'מהירות הקל', color: 'var(--c-velocity)' },
        { key: 'v1', label: 'מהירות הכבד', color: 'var(--c-velocity)' },
      ]);
    } else if (mode === 'steady') {
      hud.out = U.Readouts(controlsEl, [
        { key: 'v0', label: 'משיכה 25 ניוטון', color: 'var(--c-velocity)' },
        { key: 'v1', label: 'משיכה 20 ניוטון', color: 'var(--c-velocity)' },
        { key: 'v2', label: 'משיכה 15 ניוטון', color: 'var(--c-velocity)' },
      ]);
    } else {
      hud.m2 = U.Slider(controlsEl, { label: 'מסת הארגז הגדול', min: 1, max: 10, step: 1, value: S.m2, unit: 'kg', digits: 0, onInput(v) { S.m2 = v; clearRun(); loop.requestRender(); } });
      const row = U.h('div', { class: 'sim-row' });
      hud.go = U.Button(row, 'להפיל שוב', function () { if (!S.locked) api.play(); }, { primary: true });
      controlsEl.appendChild(row);
      hud.out = U.Readouts(controlsEl, [
        { key: 'f', label: 'כוח על הגדול', color: 'var(--c-force)' },
        { key: 'a', label: 'תאוצת הגדול', color: 'var(--c-acceleration)' },
        { key: 't', label: 'זמן', },
      ]);
    }

    function clearRun() {
      gate.close();
      S.t = 0; S.phase = 'ready'; S.hold = 0;
      if (mode === 'push') {
        S.lanes = [{ m: S.m, P: S.F, f: 0 }, { m: S.m * 2, P: S.F, f: 0 }];
      } else if (mode === 'steady') {
        S.lanes = [{ m: 10, P: 25, f: 20, v: 2 }, { m: 10, P: 20, f: 20, v: 2 }, { m: 10, P: 15, f: 20, v: 2 }];
      } else {
        S.lanes = [{ m: 1 }, { m: S.m2 }];
      }
      S.lanes.forEach(function (l) { l.x = 0; l.v = l.v || 0; l.a = 0; l.net = 0; l.stopT = null; l.landT = null; l.stamps = []; l.nextStamp = 0; });
      if (hud.out) paint();
    }

    function setLocked(v) {
      S.locked = v;
      ['F', 'm', 'm2'].forEach(function (k) { if (hud[k]) hud[k].setEnabled(!v); });
      if (hud.go) hud.go.disabled = v;
      if (hud.out) paint();
      loop.requestRender();
    }

    function step(dt0) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      const dt = dt0 * S.slow;
      if (S.phase === 'hold') { S.hold += dt0; if (S.hold >= 0.6) { S.phase = 'done'; gate.close(); } return; }
      S.t += dt;
      let finished = false;
      S.lanes.forEach(function (l) {
        if (mode === 'fall') {
          if (l.landT !== null) return;
          l.net = l.m * G;
          l.a = l.net / l.m;
          if (S.t >= l.nextStamp) { l.stamps.push(l.x); l.nextStamp += 0.25; }
          const nv = l.v + l.a * dt;
          l.x += ((l.v + nv) / 2) * dt;
          l.v = nv;
          if (l.x >= S.drop) {
            const over = l.x - S.drop;
            const back = over / l.v;
            l.landT = S.t - back;
            l.v -= l.a * back;
            l.x = S.drop;
          }
        } else {
          /* friction opposes motion. Once stopped, it just matches the pull. */
          if (l.v <= 0 && l.P <= l.f) {
            l.v = 0; l.net = 0; l.a = 0;
            if (l.stopT === null) l.stopT = S.t;
            return;
          }
          l.net = l.P - l.f;
          l.a = l.net / l.m;
          const nv = l.v + l.a * dt;
          l.x += ((l.v + nv) / 2) * dt;
          l.v = Math.max(0, nv);
          if (S.t >= l.nextStamp) { l.stamps.push(l.x); l.nextStamp += 0.5; }
        }
      });
      if (mode === 'push') finished = S.t >= 3 || S.lanes[0].x >= 16;
      if (mode === 'steady') finished = S.t >= 4.5;
      if (mode === 'fall') finished = S.lanes.every(function (l) { return l.landT !== null; });
      if (finished) { S.phase = 'hold'; S.hold = 0; }
    }

    function paint() {
      const L = S.lanes;
      if (mode === 'push') {
        hud.out.set('a0', secret() ? '?' : F.unit(S.F / L[0].m, 'ms2', 1));
        hud.out.set('a1', secret() ? '?' : F.unit(S.F / L[1].m, 'ms2', 1));
        hud.out.set('v0', F.unit(L[0].v, 'ms', 1));
        hud.out.set('v1', F.unit(L[1].v, 'ms', 1));
      } else if (mode === 'steady') {
        L.forEach(function (l, i) {
          const word = S.phase === 'ready' ? '' : l.net > 0.01 ? ', מאיץ' : l.net < -0.01 ? ', מאט' : l.stopT !== null ? ', עצר' : ', קבועה';
          hud.out.set('v' + i, F.unit(l.v, 'ms', 1) + word);
        });
      } else {
        hud.out.set('f', F.unit(S.m2 * G, 'N', 0));
        hud.out.set('a', secret() ? '?' : F.unit(G, 'ms2', 0));
        hud.out.set('t', F.unit(S.t, 's', 2));
      }
    }

    /* A label to the right of a point, unless that would run off the canvas: then it sits above the point. */
    function sideLabel(x, y, text, color, size) {
      const room = view.w - view.sx(x);
      if (room > 62) view.text(x, y, text, { size, weight: 700, color, align: 'left', offset: [5, 0], halo: true });
      else view.text(x, y, text, { size, weight: 700, color, align: 'right', offset: [0, -11], halo: true });
    }

    function drawHorizontal() {
      const n = S.lanes.length;
      const r = view.visible;
      const small = view.w < 460;
      const gap = mode === 'push' ? 7.4 : 7;
      const scaleF = mode === 'push' ? 0.2 : 0.14;
      const x0 = mode === 'push' ? 1.4 : 3.5;
      S.lanes.forEach(function (l, i) {
        const y0 = (n - 1 - i) * gap;
        view.line(r.xMin, y0, r.xMax, y0, { color: C.axis, width: 2.2, cap: 'butt' });
        for (let tx = 0; tx <= 25; tx += 5) {
          view.line(tx + x0 % 5, y0, tx + x0 % 5, y0 - 5 / view.scale, { color: C.axis, width: 1.3, cap: 'butt' });
          if (i === n - 1 && tx + x0 % 5 < r.xMax - 1) view.text(tx + x0 % 5, y0, F.unit(tx, 'm', 0), { size: 10.5, color: C.soft, offset: [0, 15] });
        }
        l.stamps.forEach(function (sx) { view.circle(x0 % 5 + sx, y0 + 2.5 / view.scale, 2.4, { px: true, fill: C.displacement, alpha: 0.5 }); });
        const base = small ? 34 : 44;
        const w = mode === 'push' ? base * Math.cbrt(l.m / 2) : base * 1.15;
        const h = w * 0.86;
        const hw = (w / 2) / view.scale;
        const x = l.x + x0 % 5;
        K.crate(view, x, y0, w, h, { label: F.unit(l.m, 'kg', 0), size: small ? 10 : 12 });
        const midY = y0 + (h / 2) / view.scale;
        /* the pull */
        const pullLen = l.P * scaleF;
        view.arrow(x + hw, midY, x + hw + pullLen, midY, { color: C.force, width: 3.6 });
        sideLabel(x + hw + pullLen, midY, F.unit(l.P, 'N', 0), C.force, 12);
        /* friction, at the floor */
        const moving = l.f && (l.v > 0 || l.P > l.f);
        const fNow = l.f ? (moving ? l.f : l.P) : 0;
        if (fNow > 0) {
          view.arrow(x - hw, y0 + 5 / view.scale, x - hw - fNow * scaleF, y0 + 5 / view.scale, { color: C.force, width: 3.6 });
          view.text(x - hw, y0, F.unit(fNow, 'N', 0), { size: 11, color: C.force, weight: 700, align: 'right', offset: [-3, -16], halo: true });
        }
        const topY = y0 + (h + 12) / view.scale;
        if ((Math.abs(l.a) > 0.01 || mode === 'push') && !secret()) {
          const av = mode === 'push' ? S.F / l.m : l.a;
          const alen = mode === 'push' ? Math.min(6, Math.abs(av) * 0.55) : av * 4;
          view.arrow(x, topY, x + alen, topY, { color: C.acceleration, width: 3.2 });
          sideLabel(x + Math.max(0, alen), topY, F.unit(av, 'ms2', 1), C.acceleration, 11.5);
        }
        if (l.v > 0.02) {
          const hasA = Math.abs(l.a) > 0.01 || mode === 'push';
          const vY = hasA ? topY + 15 / view.scale : topY;
          const vlen = Math.min(8, l.v * (mode === 'push' ? 0.28 : 0.7));
          view.arrow(x, vY, x + vlen, vY, { color: C.velocity, width: 3.2 });
          sideLabel(x + vlen, vY, F.unit(l.v, 'ms', 1), C.velocity, 11.5);
        }
      });
    }

    function drawFall() {
      K.ground(view, 0, {});
      const small = view.w < 460;
      const xs = [1.5, 10];
      const mid = 5.6;
      const scaleF = 0.17;
      /* the height, between the two lanes */
      view.line(mid, 0, mid, S.drop, { color: C.displacement, width: 2 });
      view.text(mid, S.drop * 0.72, F.unit(S.drop, 'm', 0), { size: 12, weight: 700, color: C.displacement, halo: true });
      S.lanes.forEach(function (l, i) {
        const cx = xs[i];
        const w = (small ? 32 : 42) * Math.cbrt(l.m);
        const h = w * 0.9;
        const y = S.drop - l.x;
        const out = i === 0 ? -1 : 1;
        l.stamps.forEach(function (sx) { view.line(cx - 16 / view.scale, S.drop - sx, cx + 16 / view.scale, S.drop - sx, { color: C.displacement, width: 2, alpha: 0.4 }); });
        K.crate(view, cx, y, w, h, { label: F.unit(l.m, 'kg', 0), size: small ? 11 : 13 });
        const cy = y + (h / 2) / view.scale;
        if (l.landT === null) {
          const hw = (w / 2 + 12) / view.scale;
          const flen = l.m * G * scaleF;
          /* the force on the outside, the acceleration on the inside: the two red arrows stand side by side */
          view.arrow(cx + out * hw, cy, cx + out * hw, cy - flen, { color: C.force, width: 3.8 });
          view.text(cx + out * hw, cy - flen / 2, F.unit(l.m * G, 'N', 0), { size: 12, weight: 800, color: C.force, align: out < 0 ? 'right' : 'left', offset: [out * 7, 0], halo: true });
          if (!secret()) {
            view.arrow(cx - out * hw, cy, cx - out * hw, cy - G * 0.3, { color: C.acceleration, width: 3.4 });
            view.text(cx - out * hw, cy - G * 0.3, F.unit(G, 'ms2', 0), { size: 11.5, weight: 800, color: C.acceleration, offset: [0, 11], halo: true });
          }
        } else {
          /* the sum, once it landed */
          view.text(cx, 0, F.unit(l.m * G, 'N', 0) + ' ÷ ' + F.unit(l.m, 'kg', 0), { size: small ? 11.5 : 13, weight: 700, offset: [0, 15], halo: true });
          view.text(cx, 0, '= ' + F.unit(G, 'ms2', 0), { size: small ? 11.5 : 13, weight: 800, color: C.acceleration, offset: [0, 33], halo: true });
        }
      });
      const landed = S.lanes.every(function (l) { return l.landT !== null; });
      if (landed) PHY.mascot.draw(view, mid, 0, { pose: 'happy', px: small ? 60 : 80 });
      else PHY.mascot.draw(view, mid, S.drop, { pose: 'thinking', px: small ? 50 : 66 });
    }

    function render() {
      view.clear();
      if (mode === 'fall') drawFall();
      else drawHorizontal();
      paint();
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'F') { S.F = v; if (hud.F) hud.F.set(v); }
        if (name === 'm') { S.m = v; if (hud.m) hud.m.set(v); }
        if (name === 'm2') { S.m2 = v; if (hud.m2) hud.m2.set(v); }
        clearRun();
        loop.requestRender();
      },
      getState() {
        return { mode, phase: S.phase, t: S.t, lanes: S.lanes.map(function (l) { return { m: l.m, P: l.P, f: l.f, x: l.x, v: l.v, a: l.a, net: l.net, stopT: l.stopT, landT: l.landT }; }) };
      },
      play() {
        clearRun();
        S.phase = 'run';
        return gate.open();
      },
    };
    clearRun();
    setLocked(opts.locked);
    return api;
  };
})();

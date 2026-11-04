/* PHY.sims.pulley: an ideal rope and a massless pulley.
   mode 'atwood': two masses, a = (m1 - m2) g / (m1 + m2), T = m2 (g + a), a spring scale reads T on the rope.
   mode 'table': a block on a table, μ optional, a mass hanging over the edge.
   Each body gets its own net force from T, its weight and friction, and the acceleration comes from there.
   sim.play() -> Promise. setParam: mode, m1, m2, M, m, mu, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10;

  PHY.sims.pulley = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ mode: 'atwood', m1: 3, m2: 1, M: 4, m: 1, mu: 0, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -6, xMax: 6, yMin: -1, yMax: 8.6 }, aspect: 1.25, minHeight: 320, maxHeight: 470 });
    const gate = K.gate();
    const S = { mode: opts.mode, m1: opts.m1, m2: opts.m2, M: opts.M, m: opts.m, mu: opts.mu, q: 0, v: 0, a: 0, T: 0, t: 0, phase: 'ready', hold: 0, locked: opts.locked, stuck: false };
    const hud = {};
    /* Before the release nothing is moving yet, so the tension and the acceleration wait for the run. */
    const secret = () => S.phase === 'ready';
    const tabs = U.h('div', { class: 'sim-row' });
    hud.tabA = U.Button(tabs, 'שתי משקולות', function () { if (!S.locked) setMode('atwood'); });
    hud.tabT = U.Button(tabs, 'שולחן ומשקולת', function () { if (!S.locked) setMode('table'); });
    controlsEl.appendChild(tabs);
    const change = function (k) { return function (v) { S[k] = v; clearRun(); loop.requestRender(); }; };
    hud.m1 = U.Slider(controlsEl, { label: 'משקולת שמאלית', min: 1, max: 6, step: 1, value: S.m1, unit: 'kg', digits: 0, onInput: change('m1') });
    hud.m2 = U.Slider(controlsEl, { label: 'משקולת ימנית', min: 1, max: 6, step: 1, value: S.m2, unit: 'kg', digits: 0, onInput: change('m2') });
    hud.M = U.Slider(controlsEl, { label: 'הגוש על השולחן', min: 1, max: 8, step: 1, value: S.M, unit: 'kg', digits: 0, onInput: change('M') });
    hud.m = U.Slider(controlsEl, { label: 'המשקולת התלויה', min: 1, max: 6, step: 1, value: S.m, unit: 'kg', digits: 0, onInput: change('m') });
    hud.mu = U.Slider(controlsEl, { label: 'חיכוך בשולחן μ', min: 0, max: 0.6, step: 0.1, value: S.mu, format: (v) => F.num(v, 1), onInput: change('mu') });
    const row = U.h('div', { class: 'sim-row' });
    hud.go = U.Button(row, 'לשחרר', function () { if (!S.locked) api.play(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
      { key: 'T', label: 'מתיחות', color: 'var(--c-force)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
    ]);

    /* The two bodies: "down" is the one that falls, "up" the one it drags. Solve from their net forces. */
    function solve() {
      if (S.mode === 'atwood') {
        const hi = Math.max(S.m1, S.m2), lo = Math.min(S.m1, S.m2);
        const a = ((hi - lo) * G) / (hi + lo);
        return { a, T: lo * (G + a) };
      }
      const drive = S.m * G, fric = S.mu * S.M * G;
      if (drive <= fric) return { a: 0, T: drive, stuck: true };
      const a = (drive - fric) / (S.M + S.m);
      return { a, T: S.m * (G - a) };
    }
    const travel = () => (S.mode === 'atwood' ? 3.6 : 2.7);

    function paintMode() {
      const at = S.mode === 'atwood';
      hud.tabA.classList.toggle('btn-primary', at);
      hud.tabT.classList.toggle('btn-primary', !at);
      hud.m1.el.hidden = !at; hud.m2.el.hidden = !at;
      hud.M.el.hidden = at; hud.m.el.hidden = at; hud.mu.el.hidden = at;
    }
    function setMode(m) { S.mode = m; clearRun(); paintMode(); loop.requestRender(); }
    function setLocked(v) {
      S.locked = v;
      ['m1', 'm2', 'M', 'm', 'mu'].forEach(function (k) { hud[k].setEnabled(!v); });
      hud.go.disabled = v;
      hud.tabA.disabled = v; hud.tabT.disabled = v;
    }
    function clearRun() {
      gate.close();
      const r = solve();
      Object.assign(S, { q: 0, v: 0, t: 0, phase: 'ready', hold: 0, a: r.a, T: r.T, stuck: !!r.stuck, tEnd: null, vEnd: null, held: true });
    }

    function step(dt0) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      if (S.phase === 'hold') { S.hold += dt0; if (S.hold >= 0.7) { S.phase = 'done'; gate.close(); } return; }
      const sol = solve();
      if (sol.a <= 0) { S.t += dt0; S.a = 0; S.T = sol.T; if (S.t >= 1.4) { S.phase = 'hold'; S.hold = 0; S.tEnd = S.t; S.vEnd = 0; } return; }
      const realT = Math.sqrt((2 * travel()) / sol.a);
      const slow = Math.min(1, realT / 3.4);
      const dt = dt0 * slow;
      S.t += dt;
      S.a = sol.a; S.T = sol.T;
      const nv = S.v + S.a * dt;
      S.q += ((S.v + nv) / 2) * dt;
      S.v = nv;
      if (S.q >= travel()) {
        const back = (S.q - travel()) / S.v;
        S.t -= back; S.v -= S.a * back; S.q = travel();
        S.tEnd = S.t; S.vEnd = S.v;
        S.phase = 'hold'; S.hold = 0;
      }
    }

    function drawPulley(x, y, r) {
      view.circle(x, y, r, { fill: C.surface, color: C.axis, width: 3 });
      view.circle(x, y, 3.5, { px: true, fill: C.axis });
    }
    const boxPx = (m, small) => (small ? 24 : 32) * Math.cbrt(m) + 6;

    function renderAtwood(small) {
      K.ground(view, 0, {});
      const px = { x: 0, y: 7.5 };
      const R = 1.15;
      view.line(0, 8.6, px.x, px.y, { color: C.axis, width: 3 });
      const heavyLeft = S.m1 >= S.m2;
      const equal = S.m1 === S.m2;
      const low = 0.7, high = low + 3.6;
      const yL = equal ? 2.7 : heavyLeft ? high - S.q : low + S.q;
      const yR = equal ? 2.7 : heavyLeft ? low + S.q : high - S.q;
      const sL = boxPx(S.m1, small), sR = boxPx(S.m2, small);
      const xL = px.x - R, xR = px.x + R;
      const topL = yL + sL / view.scale, topR = yR + sR / view.scale;
      view.line(xL, px.y, xL, topL, { color: C.axis, width: 2.5 });
      view.line(xR, px.y, xR, topR, { color: C.axis, width: 2.5 });
      drawPulley(px.x, px.y, R);
      K.crate(view, xL, yL, sL, sL, { label: F.unit(S.m1, 'kg', 0), size: small ? 9.5 : 11.5 });
      K.crate(view, xR, yR, sR, sR, { label: F.unit(S.m2, 'kg', 0), size: small ? 9.5 : 11.5 });
      /* the spring scale sits on the rope of the right side, and reads T */
      K.springScale(view, view.sx(xR), view.sy(6.55), secret() ? '?' : F.unit(S.T, 'N', 0));
      const k = Math.min(0.05, 2.2 / (Math.max(S.m1, S.m2) * G));
      const fs = small ? 11.5 : 13;
      const draw = function (x, y, s, m, side, dir) {
        const midY = y + (s / 2) / view.scale;
        const hw = (s / 2) / view.scale;
        const ax = x + side * (hw + 0.32);
        if (!secret()) {
          view.arrow(ax, midY, ax, midY + S.T * k, { color: C.force, width: 3.6 });
          view.text(ax, midY + S.T * k, 'T', { size: fs, weight: 800, color: C.force, offset: [0, -10], halo: true });
        }
        view.arrow(ax, midY, ax, midY - m * G * k, { color: C.force, width: 3.6 });
        view.text(ax, midY - m * G * k, F.unit(m * G, 'N', 0), { size: fs, weight: 800, color: C.force, offset: [0, 10], halo: true });
        if (S.a > 0.01 && !secret()) {
          const bx = ax + side * 0.62;
          const len = Math.max(0.5, S.a * 0.24);
          view.arrow(bx, midY, bx, midY + dir * len, { color: C.acceleration, width: 3.4 });
          view.text(bx, midY + (dir * len) / 2, F.unit(S.a, 'ms2', 1), { size: small ? 11 : 12.5, weight: 800, color: C.acceleration, align: side < 0 ? 'right' : 'left', offset: [side * 6, 0], halo: true });
        }
      };
      draw(xL, yL, sL, S.m1, -1, heavyLeft ? -1 : 1);
      draw(xR, yR, sR, S.m2, 1, heavyLeft ? 1 : -1);
      PHY.mascot.draw(view, -5.1, 0, { pose: S.phase === 'ready' ? 'thinking' : S.phase === 'hold' || S.phase === 'done' ? 'happy' : 'standing', px: small ? 52 : 70 });
    }

    function renderTable(small) {
      K.ground(view, 0, {});
      const top = 4.6;
      const edge = 3.3;
      view.poly([{ x: -5.9, y: top }, { x: edge, y: top }, { x: edge, y: top - 0.35 }, { x: -5.9, y: top - 0.35 }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
      [-5.3, edge - 0.5].forEach(function (x) { view.line(x, top - 0.35, x, 0, { color: C.axis, width: 5, cap: 'butt' }); });
      const R = 0.5;
      const pc = { x: edge + 0.5, y: top };
      const sM = boxPx(S.M, small), sm = boxPx(S.m, small);
      const xM = -4.1 + S.q;
      const hw = (sM / 2) / view.scale;
      const ropeY = pc.y + R;
      view.line(xM + hw, ropeY, pc.x, ropeY, { color: C.axis, width: 2.5 });
      const hx = pc.x + R;
      const yTopM = 3.7 - S.q;
      view.line(hx, pc.y, hx, yTopM, { color: C.axis, width: 2.5 });
      drawPulley(pc.x, pc.y, R);
      K.crate(view, xM, top, sM, sM, { label: F.unit(S.M, 'kg', 0), size: small ? 9.5 : 11.5 });
      K.crate(view, hx, yTopM - sm / view.scale, sm, sm, { label: F.unit(S.m, 'kg', 0), size: small ? 9.5 : 11.5 });
      const k = 0.058;
      /* forces on the block */
      const cy = top + (sM / 2) / view.scale;
      if (!secret()) {
        view.arrow(xM + hw + 0.06, cy + 12 / view.scale, xM + hw + 0.06 + S.T * k, cy + 12 / view.scale, { color: C.force, width: 3.6 });
        view.text(xM + hw + 0.06 + S.T * k, cy + 12 / view.scale, 'T', { size: small ? 11.5 : 13, weight: 800, color: C.force, align: 'left', offset: [5, -2], halo: true });
      }
      if (S.mu > 0 && !secret()) {
        const fr = S.stuck ? S.T : S.mu * S.M * G;
        view.arrow(xM - hw, top + 5 / view.scale, xM - hw - fr * k, top + 5 / view.scale, { color: C.force, width: 3.4 });
        if (xM - hw - fr * k > -5.5) view.text(xM - hw - fr * k, top + 5 / view.scale, 'f', { size: 12, weight: 800, color: C.force, align: 'right', offset: [-5, 0], halo: true });
      }
      /* forces on the hanging mass, to its left, where the room is */
      const hy = yTopM - (sm / 2) / view.scale;
      const ax = hx + (sm / 2) / view.scale + 0.3;
      if (!secret()) {
        view.arrow(ax, hy, ax, hy + S.T * k, { color: C.force, width: 3.6 });
        view.text(ax, hy + S.T * k, 'T', { size: small ? 11.5 : 13, weight: 800, color: C.force, align: 'left', offset: [5, 0], halo: true });
      }
      view.arrow(ax, hy, ax, hy - S.m * G * k, { color: C.force, width: 3.6 });
      view.text(ax, hy - S.m * G * k, 'mg', { size: small ? 11.5 : 13, weight: 800, color: C.force, align: 'left', offset: [5, 0], halo: true });
      if (S.a > 0.01 && !secret()) {
        const topB = top + (sM + 12) / view.scale;
        view.arrow(xM, topB, xM + S.a * 0.42, topB, { color: C.acceleration, width: 3.4 });
        view.text(xM + S.a * 0.42, topB, F.unit(S.a, 'ms2', 1), { size: small ? 11 : 12.5, weight: 800, color: C.acceleration, align: 'left', offset: [5, 0], halo: true });
      }
      const midRope = (xM + hw + pc.x) / 2;
      if (pc.x - xM - hw > 2.4) K.springScale(view, view.sx(midRope), view.sy(ropeY), secret() ? '?' : F.unit(S.T, 'N', 0));
      PHY.mascot.draw(view, -3, 0, { pose: S.phase === 'ready' ? 'thinking' : 'standing', px: small ? 52 : 70 });
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      if (S.mode === 'atwood') renderAtwood(small);
      else renderTable(small);
      out.set('a', secret() ? '?' : F.unit(S.a, 'ms2', 2));
      out.set('T', secret() ? '?' : F.unit(S.T, 'N', 1));
      out.set('v', F.unit(S.v, 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'mode') { setMode(v); return; }
        if (hud[name]) { S[name] = v; hud[name].set(v); }
        clearRun();
        loop.requestRender();
      },
      getState() {
        return { mode: S.mode, phase: S.phase, q: S.q, v: S.v, a: S.a, T: S.T, t: S.t, tEnd: S.tEnd, vEnd: S.vEnd, stuck: S.stuck, m1: S.m1, m2: S.m2, M: S.M, m: S.m, mu: S.mu };
      },
      play() {
        clearRun();
        S.phase = 'run';
        return gate.open();
      },
    };
    clearRun();
    paintMode();
    setLocked(opts.locked);
    return api;
  };
})();

/* PHY.sims.deltaV: speed is constant, yet the velocity arrow keeps changing.
   mode 'direction': velocity at two moments, redrawn tail to tail. Their difference, Δv, points to the center,
   and as the interval shrinks Δv/Δt settles on v²/R. The triangle of positions and the triangle of velocities are similar.
   mode 'scale': a dot on a circle with a live acceleration arrow, and bars for v×2 and R×2.
   sim.play() -> Promise. setParam: v, R, dt, locked. getState(): v, R, dt, dphi, dv, ratio, a (v²/R), aMeasured
   (from the velocity of the moving dot, frame to frame), dvDeg (direction of Δv), toCenterDeg, speed. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const RAD = Math.PI / 180;

  /* ---------- Direction ---------- */
  function directionSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.65, minHeight: 410, maxHeight: 420 });
    const tw = PHY.ch02.tweens();
    const S = {
      v: opts.v, R: opts.R, dphi: 80, phi: 200 * RAD, phase: 'idle', show: 0, marks: false, caption: '', locked: opts.locked, resolve: null,
      tail: { x: 4, y: 0 }, wide: true, aMeasured: 0, prevV: null,
    };
    const sDt = U.Slider(controlsEl, {
      label: 'המרווח בין שני הרגעים, Δt', min: 0.04, max: 0.8, step: 0.01, value: 0.7, unit: 's', digits: 2,
      onInput(v) { S.dphi = Math.min(150, ((S.v / S.R) * v) / RAD); loop.requestRender(); },
    });
    const sV = U.Slider(controlsEl, {
      label: 'מהירות, v', min: 2, max: 6, step: 0.5, value: S.v, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; S.dphi = Math.min(150, ((S.v / S.R) * sDt.value) / RAD); loop.requestRender(); },
    });
    const sR = U.Slider(controlsEl, {
      label: 'רדיוס, R', min: 1, max: 2.5, step: 0.5, value: S.R, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.R = v; S.dphi = Math.min(150, ((S.v / S.R) * sDt.value) / RAD); loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'dt', label: 'Δt' },
      { key: 'dv', label: 'גודל Δv', color: 'var(--c-acceleration)' },
      { key: 'r', label: 'Δv חלקי Δt', color: 'var(--c-acceleration)' },
      { key: 'a', label: 'v² חלקי R', color: 'var(--c-acceleration)' },
    ]);

    const K_V = 0.5; /* world units per m/s on the circle */
    const kDiagram = () => (S.wide ? 0.8 : 0.6); /* and in the tail-to-tail picture */
    function layout() {
      S.wide = view.w >= 520;
      if (S.wide) {
        const Sc = Math.min(view.h / 6.6, (view.w * 0.54) / 6.6);
        K.place(view, view.w * 0.27, view.h * 0.54, Sc);
        S.tail = view.toWorld(view.w * 0.95, view.h * 0.56);
      } else {
        const Sc = Math.min((view.h * 0.6) / 6.3, view.w / 6.5);
        K.place(view, view.w * 0.5, view.h * 0.32, Sc);
        S.tail = view.toWorld(view.w * 0.82, view.h * 0.81);
      }
    }
    function setLocked(v) {
      S.locked = v;
      [sDt, sV, sR].forEach(function (s) { s.setEnabled(!v); });
    }
    function geom() {
      const mid = 90, h = S.dphi / 2;
      const a1 = (mid - h) * RAD, a2 = (mid + h) * RAD;
      const A = { x: S.R * Math.cos(a1), y: S.R * Math.sin(a1) };
      const B = { x: S.R * Math.cos(a2), y: S.R * Math.sin(a2) };
      const v1 = { x: -S.v * Math.sin(a1), y: S.v * Math.cos(a1) };
      const v2 = { x: -S.v * Math.sin(a2), y: S.v * Math.cos(a2) };
      const dv = { x: v2.x - v1.x, y: v2.y - v1.y };
      const dt = (S.dphi * RAD * S.R) / S.v;
      return { A, B, v1, v2, dv, dt, a1, a2, dvLen: Math.hypot(dv.x, dv.y), ratio: Math.hypot(dv.x, dv.y) / dt };
    }

    function step(dt) {
      tw.step(dt);
      const w = S.v / S.R;
      const prev = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
      S.phi += w * dt;
      const cur = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
      S.aMeasured = Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt;
    }

    function render() {
      const small = view.w < 420;
      const g = geom();
      view.clear();
      view.circle(0, 0, S.R, { color: C.gridStrong, width: 2.5 });
      view.circle(0, 0, 3.5, { px: true, fill: C.ink });
      const labelSize = small ? 12.5 : 14;

      /* the moving dot, always there */
      const px = S.R * Math.cos(S.phi), py = S.R * Math.sin(S.phi);
      if (S.marks) {
        /* the triangle of positions, then the chord in the displacement color */
        view.poly([{ x: 0, y: 0 }, g.A, g.B], { fill: C.displacement, alpha: 0.1, close: true });
        view.line(0, 0, g.A.x, g.A.y, { color: C.soft, width: 1.5, dash: [4, 4] });
        view.line(0, 0, g.B.x, g.B.y, { color: C.soft, width: 1.5, dash: [4, 4] });
        view.line(g.A.x, g.A.y, g.B.x, g.B.y, { color: C.displacement, width: 3 });
        view.circle(g.A.x, g.A.y, 5, { px: true, fill: C.ink });
        view.circle(g.B.x, g.B.y, 5, { px: true, fill: C.ink });
        view.arrow(g.A.x, g.A.y, g.A.x + g.v1.x * K_V, g.A.y + g.v1.y * K_V, { color: C.velocity, width: 3.2 });
        view.arrow(g.B.x, g.B.y, g.B.x + g.v2.x * K_V, g.B.y + g.v2.y * K_V, { color: C.velocity, width: 3.2 });
        view.text(g.A.x + g.v1.x * K_V, g.A.y + g.v1.y * K_V, 'v₁', { size: labelSize, weight: 700, color: C.velocity, halo: true, offset: [-2, -13] });
        view.text(g.B.x + g.v2.x * K_V, g.B.y + g.v2.y * K_V, 'v₂', { size: labelSize, weight: 700, color: C.velocity, halo: true, offset: [-2, 14] });
        /* Δv/Δt carried back to the middle of the arc: it points at the center */
        if (S.show > 0.5) {
          const len = (g.ratio * 0.16 * S.R) / 2;
          view.arrow(0, S.R, 0, S.R - Math.min(len, S.R * 0.92), { color: C.acceleration, width: 4, label: 'Δv/Δt', labelSide: -1, labelGap: 28, labelSize: labelSize });
        }
        /* the same two arrows, tail to tail */
        const q = K.ease(S.show);
        const t1 = { x: K.lerp(g.A.x, S.tail.x, q), y: K.lerp(g.A.y, S.tail.y, q) };
        const t2 = { x: K.lerp(g.B.x, S.tail.x, q), y: K.lerp(g.B.y, S.tail.y, q) };
        if (S.show > 0) {
          const kd = K.lerp(K_V, kDiagram(), q);
          const tip1 = { x: t1.x + g.v1.x * kd, y: t1.y + g.v1.y * kd };
          const tip2 = { x: t2.x + g.v2.x * kd, y: t2.y + g.v2.y * kd };
          if (S.show >= 1) view.poly([S.tail, tip1, tip2], { fill: C.acceleration, alpha: 0.1, close: true });
          view.arrow(t1.x, t1.y, tip1.x, tip1.y, { color: C.velocity, width: 3.2, alpha: 0.9 });
          view.arrow(t2.x, t2.y, tip2.x, tip2.y, { color: C.velocity, width: 3.2, alpha: 0.9 });
          if (S.show >= 1) {
            view.arrow(tip1.x, tip1.y, tip2.x, tip2.y, { color: C.acceleration, width: 3.6, head: 11, label: 'Δv', labelSide: 1, labelGap: 18, labelSize: labelSize });
            view.text(S.tail.x, S.tail.y, 'אותם שני חצים, מאותה נקודה', { size: small ? 11 : 12.5, weight: 600, color: C.soft, offset: [small ? -66 : -86, small ? -76 : -116] });
          }
        }
      } else {
        const u = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
        view.arrow(px, py, px + u.x * K_V, py + u.y * K_V, { color: C.velocity, width: 3.5 });
        K.tipLabel(view, px, py, px + u.x * K_V, py + u.y * K_V, F.unit(S.v, 'ms', 0), { color: C.velocity, size: labelSize, gap: 20 });
      }
      K.apple(view, S.marks ? S.R * Math.cos(S.phi) : px, S.marks ? S.R * Math.sin(S.phi) : py, small ? 15 : 18, { alpha: S.marks ? 0.5 : 1 });
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });

      const known = S.marks;
      out.set('dt', known ? F.unit(g.dt, 's', 2) : '?');
      out.set('dv', known ? F.unit(g.dvLen, 'ms', 2) : '?');
      out.set('r', known ? F.unit(g.ratio, 'ms2', 2) : '?');
      out.set('a', known && S.phase !== 'run' ? F.unit((S.v * S.v) / S.R, 'ms2', 2) : '?');
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();

    async function script() {
      S.marks = false;
      S.show = 0;
      S.dphi = 80;
      S.caption = 'גודל המהירות קבוע: ' + F.unit(S.v, 'ms', 0) + '. אז מה משתנה?';
      await tw.run((2 * Math.PI * S.R) / S.v, null);
      if (S.phase !== 'run') return;
      S.marks = true;
      S.caption = 'שני רגעים: אותו אורך, כיוון אחר';
      await tw.run(1.2, function (k) { S.show = k; });
      if (S.phase !== 'run') return;
      S.show = 1;
      S.caption = 'מקטינים את המרווח בין הרגעים';
      await tw.run(4, function (k) {
        S.dphi = K.lerp(80, 4.6, K.ease(k));
        sDt.set(Math.max(0.04, Math.round(((S.dphi * RAD * S.R) / S.v) * 100) / 100));
      });
      if (S.phase !== 'run') return;
      S.phase = 'done';
      S.caption = 'Δv מכוון למרכז';
      sDt.set(Math.max(0.04, Math.round(((S.dphi * RAD * S.R) / S.v) * 100) / 100));
      K.settle(S);
    }

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { tw.clear(); S.phase = 'idle'; S.marks = false; S.show = 0; S.caption = ''; K.settle(S); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); if (!v) { S.marks = true; S.show = 1; } loop.requestRender(); return; }
        if (name === 'v') { S.v = v; sV.set(v); }
        if (name === 'R') { S.R = v; sR.set(v); }
        if (name === 'dt') { sDt.set(v); S.dphi = Math.min(150, ((S.v / S.R) * v) / RAD); S.marks = true; S.show = 1; }
        loop.requestRender();
      },
      getState() {
        const g = geom();
        const toCenter = PHY.vec.angle({ x: -Math.cos(90 * RAD), y: -Math.sin(90 * RAD) });
        return {
          phase: S.phase, v: S.v, R: S.R, dt: g.dt, dphi: S.dphi, dv: g.dvLen, ratio: g.ratio, a: (S.v * S.v) / S.R, aMeasured: S.aMeasured,
          dvDeg: PHY.vec.angle(g.dv), toCenterDeg: toCenter, speed: PHY.vec.len(g.v1), speed2: PHY.vec.len(g.v2),
          sim1: PHY.vec.dist(g.A, g.B) / S.R, sim2: g.dvLen / S.v,
        };
      },
      play() {
        tw.clear();
        K.settle(S);
        S.phase = 'run';
        const p = new Promise(function (resolve) { S.resolve = resolve; });
        script();
        return p;
      },
      setMarks() { S.marks = true; S.show = 1; loop.requestRender(); },
    };
    setLocked(S.locked);
    return api;
  }

  /* ---------- Scale ---------- */
  function scaleSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.6, minHeight: 400, maxHeight: 410 });
    const tw = PHY.ch02.tweens();
    const BASE = { v: 4, R: 2 };
    const S = {
      v: BASE.v, R: BASE.R, phi: 150 * RAD, phase: 'idle', stage: 0, bars: [null, null, null], now: false, caption: '', locked: opts.locked, resolve: null,
      wide: true, aMeasured: 0, kBar: 0,
    };
    const sV = U.Slider(controlsEl, {
      label: 'מהירות, v', min: 2, max: 8, step: 0.5, value: S.v, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; S.now = true; loop.requestRender(); },
    });
    const sR = U.Slider(controlsEl, {
      label: 'רדיוס, R', min: 1, max: 4, step: 0.5, value: S.R, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.R = v; S.now = true; loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'v', color: 'var(--c-velocity)' },
      { key: 'R', label: 'R', color: 'var(--c-displacement)' },
      { key: 'a', label: 'התאוצה, נמדדת מהתנועה', color: 'var(--c-acceleration)' },
    ]);
    function layout() {
      S.wide = view.w >= 520;
      if (S.wide) {
        const Sc = Math.min(view.h / 10.4, (view.w * 0.58) / 10.4);
        K.place(view, view.w * 0.31, view.h * 0.53, Sc);
      } else {
        const Sc = Math.min((view.h * 0.64 - 34) / 9.4, view.w / 10.4);
        K.place(view, view.w * 0.5, 36 + Sc * 4.7, Sc);
      }
    }
    function setLocked(v) { S.locked = v; sV.setEnabled(!v); sR.setEnabled(!v); }
    function step(dt) {
      tw.step(dt);
      const w = S.v / S.R;
      const prev = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
      S.phi += w * dt;
      const cur = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
      S.aMeasured = Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt;
    }
    function drawBars() {
      const small = view.w < 420;
      const x0 = S.wide ? view.w * 0.62 : view.w * 0.06;
      const x1 = S.wide ? view.w * 0.97 : view.w * 0.94;
      const yTop = S.wide ? view.h * 0.16 : view.h * 0.74;
      const yBot = S.wide ? view.h * 0.84 : view.h * 0.94;
      const names = ['רגיל', 'v×2', 'R×2'];
      const list = S.bars.map(function (b, i) { return { name: names[i], val: b }; });
      if (S.now) list.push({ name: 'עכשיו', val: (S.v * S.v) / S.R, now: true });
      const cols = list.length;
      const gap = (x1 - x0) / cols;
      const maxA = 36;
      list.forEach(function (b, i) {
        const cx = x0 + gap * (i + 0.5);
        const bw = Math.min(gap * 0.62, 56);
        view.screenText(cx, yBot + 11, b.name, { size: small ? 11.5 : 13, weight: 700, color: C.ink });
        const ctx = view.ctx;
        ctx.save();
        ctx.fillStyle = C.grid;
        ctx.fillRect(cx - bw / 2, yTop, bw, yBot - yTop);
        if (b.val !== null) {
          const H = (Math.min(b.val, maxA) / maxA) * (yBot - yTop);
          ctx.globalAlpha = b.now ? 0.7 : 1;
          ctx.fillStyle = C.acceleration;
          ctx.fillRect(cx - bw / 2, yBot - H, bw, H);
          ctx.globalAlpha = 1;
          view.screenText(cx, yBot - H - 10, F.num(b.val, 1), { size: small ? 11.5 : 13, weight: 700, color: C.acceleration, halo: true });
        }
        ctx.restore();
      });
      view.screenText((x0 + x1) / 2, yTop - (S.wide ? 26 : 20), "תאוצה (מ/ש²)", { size: small ? 11.5 : 13, weight: 700, color: C.soft });
    }
    function render() {
      const small = view.w < 420;
      view.clear();
      view.circle(0, 0, S.R, { color: C.gridStrong, width: 2.5 });
      view.circle(0, 0, 3.5, { px: true, fill: C.ink });
      const x = S.R * Math.cos(S.phi), y = S.R * Math.sin(S.phi);
      const a = (S.v * S.v) / S.R;
      const kV = 0.28, kA = 0.075;
      const vx = x - Math.sin(S.phi) * S.v * kV, vy = y + Math.cos(S.phi) * S.v * kV;
      view.arrow(x, y, vx, vy, { color: C.velocity, width: 3.5 });
      K.tipLabel(view, x, y, vx, vy, 'v', { color: C.velocity });
      const len = a * kA;
      const ux = -Math.cos(S.phi), uy = -Math.sin(S.phi);
      view.arrow(x, y, x + ux * len, y + uy * len, { color: C.acceleration, width: 4 });
      K.tipLabel(view, x, y, x + ux * len, y + uy * len, 'a', { color: C.acceleration, gap: 12 });
      K.apple(view, x, y, small ? 15 : 18);
      drawBars();
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('R', F.unit(S.R, 'm', 1));
      out.set('a', F.unit(a, 'ms2', 1));
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();

    async function script() {
      S.v = BASE.v; S.R = BASE.R; S.bars = [null, null, null]; S.now = false;
      sV.set(S.v); sR.set(S.R);
      S.caption = 'מהירות ' + F.unit(4, 'ms', 0) + ', רדיוס ' + F.unit(2, 'm', 0);
      await tw.run(1.4, function (k) { S.bars[0] = 8 * K.ease(k); });
      if (S.phase !== 'run') return;
      S.bars[0] = 8;
      await tw.run(0.4, null);
      if (S.phase !== 'run') return;
      S.caption = 'פי 2 מהירות';
      await tw.run(2.6, function (k) { S.v = K.lerp(4, 8, K.ease(Math.min(k * 2, 1))); S.bars[1] = (S.v * S.v) / S.R; sV.set(Math.round(S.v * 2) / 2); });
      if (S.phase !== 'run') return;
      S.v = 8;
      S.bars[1] = 32;
      S.caption = 'פי 4 תאוצה!';
      await tw.run(1.3, null);
      if (S.phase !== 'run') return;
      S.caption = 'מהירות רגילה, פי 2 רדיוס';
      await tw.run(2.2, function (k) { const q = K.ease(Math.min(k * 2, 1)); S.v = K.lerp(8, 4, q); S.R = K.lerp(2, 4, q); S.bars[2] = (S.v * S.v) / S.R; sV.set(Math.round(S.v * 2) / 2); sR.set(Math.round(S.R * 2) / 2); });
      if (S.phase !== 'run') return;
      S.v = 4; S.R = 4; S.bars[2] = 4;
      S.caption = 'חצי תאוצה';
      await tw.run(0.8, null);
      if (S.phase !== 'run') return;
      S.phase = 'done';
      K.settle(S);
    }

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { tw.clear(); S.phase = 'idle'; K.settle(S); S.caption = ''; loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'v') { S.v = v; sV.set(v); S.now = true; }
        if (name === 'R') { S.R = v; sR.set(v); S.now = true; }
        loop.requestRender();
      },
      getState() { return { phase: S.phase, v: S.v, R: S.R, a: (S.v * S.v) / S.R, aMeasured: S.aMeasured, bars: S.bars.slice() }; },
      play() {
        tw.clear();
        K.settle(S);
        S.phase = 'run';
        const p = new Promise(function (resolve) { S.resolve = resolve; });
        script();
        return p;
      },
    };
    setLocked(S.locked);
    return api;
  }

  PHY.sims.deltaV = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'direction', v: 4, R: 2, locked: true }, opts || {});
    return opts.mode === 'scale' ? scaleSim(canvasEl, controlsEl, opts) : directionSim(canvasEl, controlsEl, opts);
  };
})();

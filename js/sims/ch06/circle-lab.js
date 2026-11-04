/* PHY.sims.circleLab: the playground, with two tabs.
   table: an apple on a string on a frictionless table, sliders for v, R, m, with F = mv²/R and a string that snaps at 40 N.
   cone: a conical pendulum, L, θ, m. The angle fixes everything: R = L sinθ, v = √(gR tanθ), T_period = 2πR/v, tension mg/cosθ.
   setParam: mode, v, R, m, L, deg. getState(): mode and the live numbers, including measured speed from the moving bob. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;
  const RAD = Math.PI / 180;
  const LIMIT = 40;

  PHY.sims.circleLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'table' }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.6, minHeight: 300, maxHeight: 440 });
    const S = {
      mode: opts.mode, v: 4, R: 2, m: 1, phi: 0.4, broken: false, pos: null, vel: null, L: 1, deg: 37, cm: 2, psi: 0, measured: 0,
    };
    const row = U.h('div', { class: 'sim-row' });
    const tTable = U.Button(row, 'מעגל על שולחן', function () { setMode('table'); }, { ghost: true });
    const tCone = U.Button(row, 'מטוטלת חרוטית', function () { setMode('cone'); }, { ghost: true });
    controlsEl.appendChild(row);

    const boxT = U.h('div', { class: 'game-hud' });
    const boxC = U.h('div', { class: 'game-hud' });
    controlsEl.appendChild(boxT);
    controlsEl.appendChild(boxC);
    const sV = U.Slider(boxT, { label: 'מהירות, v', min: 1, max: 10, step: 0.5, value: S.v, unit: 'ms', digits: 1, color: 'var(--c-velocity)', onInput(v) { S.v = v; renew(); } });
    const sR = U.Slider(boxT, { label: 'רדיוס, R', min: 0.5, max: 3, step: 0.1, value: S.R, unit: 'm', digits: 1, color: 'var(--c-displacement)', onInput(v) { S.R = v; renew(); } });
    const sM = U.Slider(boxT, { label: 'מסה, m', min: 0.2, max: 3, step: 0.1, value: S.m, unit: 'kg', digits: 1, onInput(v) { S.m = v; renew(); } });
    const rowT = U.h('div', { class: 'sim-row' });
    U.Button(rowT, 'חוט חדש', function () { renew(); }, { ghost: true });
    boxT.appendChild(rowT);
    const outT = U.Readouts(boxT, [
      { key: 'T', label: 'זמן לסיבוב, T' },
      { key: 'a', label: 'תאוצה, v²/R', color: 'var(--c-acceleration)' },
      { key: 'F', label: 'מתיחות החוט, mv²/R', color: 'var(--c-force)' },
    ]);
    const sL = U.Slider(boxC, { label: 'אורך החוט, L', min: 0.5, max: 2, step: 0.1, value: S.L, unit: 'm', digits: 1, color: 'var(--c-displacement)', onInput(v) { S.L = v; layout(); touch(); } });
    const sD = U.Slider(boxC, { label: 'הזווית מהאנך, θ', min: 10, max: 65, step: 1, value: S.deg, format: (v) => K.deg(v), color: 'var(--accent)', onInput(v) { S.deg = v; touch(); } });
    const sCM = U.Slider(boxC, { label: 'מסה, m', min: 0.5, max: 3, step: 0.5, value: S.cm, unit: 'kg', digits: 1, onInput(v) { S.cm = v; touch(); } });
    const outC = U.Readouts(boxC, [
      { key: 'R', label: 'רדיוס, R', color: 'var(--c-displacement)' },
      { key: 'v', label: 'מהירות, v', color: 'var(--c-velocity)' },
      { key: 'T', label: 'זמן לסיבוב' },
      { key: 'S', label: 'מתיחות', color: 'var(--c-force)' },
      { key: 'F', label: 'הכוח למרכז', color: 'var(--c-force)' },
    ]);

    function touch() { loop.requestRender(); }
    function cone() {
      const th = K.friendly(S.deg);
      const R = S.L * Math.sin(th);
      const v = Math.sqrt(G * R * Math.tan(th));
      return { th, R, v, period: (2 * Math.PI * R) / v, tension: (S.cm * G) / Math.cos(th), net: S.cm * G * Math.tan(th) };
    }
    function force() { return (S.m * S.v * S.v) / S.R; }
    function renew() {
      if (S.broken) { S.broken = false; S.pos = null; S.vel = null; }
      touch();
    }
    function setMode(m) {
      S.mode = m;
      boxT.hidden = m !== 'table';
      boxC.hidden = m !== 'cone';
      tTable.classList.toggle('btn-primary', m === 'table');
      tTable.classList.toggle('btn-ghost', m !== 'table');
      tCone.classList.toggle('btn-primary', m === 'cone');
      tCone.classList.toggle('btn-ghost', m !== 'cone');
      layout();
      touch();
    }
    function layout() {
      if (S.mode === 'table') {
        const Sc = Math.min(view.w, view.h) / 9.2;
        K.place(view, view.w / 2, view.h / 2 + 8, Sc);
      } else {
        /* The picture grows with L, but gently, so a short string is still easy to read. */
        const base = Math.min((view.h - 60) / 2.15, view.w / 3.3);
        K.place(view, view.w / 2, 24, base / (0.6 + 0.4 * S.L));
      }
    }
    function step(dt) {
      if (S.mode === 'table') {
        if (!S.broken) {
          S.phi += (S.v / S.R) * dt;
          if (force() > LIMIT) {
            S.broken = true;
            S.pos = { x: S.R * Math.cos(S.phi), y: S.R * Math.sin(S.phi) };
            S.vel = { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) };
          }
        } else if (S.pos) {
          S.pos.x += S.vel.x * dt;
          S.pos.y += S.vel.y * dt;
        }
      } else {
        const c = cone();
        const prev = { x: c.R * Math.cos(S.psi), y: c.R * Math.sin(S.psi) };
        S.psi += (c.v / c.R) * dt;
        const cur = { x: c.R * Math.cos(S.psi), y: c.R * Math.sin(S.psi) };
        S.measured = Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt;
      }
    }
    function renderTable() {
      const small = view.w < 420;
      view.grid(1);
      view.circle(0, 0, S.R, { color: C.gridStrong, width: 2, dash: [5, 6] });
      if (!S.broken) {
        const x = S.R * Math.cos(S.phi), y = S.R * Math.sin(S.phi);
        view.line(0, 0, x, y, { color: C.ink, width: 2 });
        view.circle(0, 0, 5, { px: true, fill: C.ink });
        K.apple(view, x, y, K.clamp(12 + 5 * S.m, 12, 26));
        const ux = -Math.cos(S.phi), uy = -Math.sin(S.phi);
        const fx = x + ux * (force() / LIMIT) * 3, fy = y + uy * (force() / LIMIT) * 3;
        const vx = x - Math.sin(S.phi) * S.v * 0.26, vy = y + Math.cos(S.phi) * S.v * 0.26;
        view.arrow(x, y, fx, fy, { color: C.force, width: 4 });
        K.tipLabel(view, x, y, fx, fy, 'F', { color: C.force });
        view.arrow(x, y, vx, vy, { color: C.velocity, width: 3.5 });
        K.tipLabel(view, x, y, vx, vy, 'v', { color: C.velocity });
        /* how close the string is to giving up */
        const f = force() / LIMIT;
        const w = small ? 120 : 160;
        K.bar(view, view.w / 2 - w / 2, 16, w, 10, f, { color: f > 0.8 ? C.bad : C.force });
        view.screenText(view.w / 2, 37, 'החוט נקרע ב-' + F.unit(LIMIT, 'N', 0), { size: small ? 11 : 12, color: C.soft, weight: 600 });
      } else {
        view.circle(0, 0, 5, { px: true, fill: C.ink });
        if (S.pos) {
          K.apple(view, S.pos.x, S.pos.y, K.clamp(12 + 5 * S.m, 12, 26));
          view.arrow(S.pos.x, S.pos.y, S.pos.x + S.vel.x * 0.26, S.pos.y + S.vel.y * 0.26, { color: C.velocity, width: 3.5 });
        }
        view.screenText(view.w / 2, 20, 'החוט נקרע! ' + F.unit(force(), 'N', 0) + ' זה יותר מדי.', { size: small ? 12 : 14, weight: 700, pill: true, color: C.bad });
      }
      outT.set('T', F.unit((2 * Math.PI * S.R) / S.v, 's', 2));
      outT.set('a', F.unit((S.v * S.v) / S.R, 'ms2', 1));
      outT.set('F', F.unit(force(), 'N', 1));
    }
    function renderCone() {
      const small = view.w < 420;
      const c = cone();
      const hgt = S.L * Math.cos(c.th);
      const tilt = 0.28;
      const bx = c.R * Math.cos(S.psi), bz = c.R * Math.sin(S.psi);
      const b = { x: bx, y: -hgt - bz * tilt };
      /* ceiling, axis, the circle */
      const r = view.visible;
      view.line(r.xMin, 0, r.xMax, 0, { color: C.axis, width: 3 });
      view.line(0, 0, 0, -hgt - c.R * tilt - 0.15, { color: C.soft, width: 1.5, dash: [5, 5] });
      const ring = [];
      for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2; ring.push({ x: c.R * Math.cos(a), y: -hgt - c.R * Math.sin(a) * tilt }); }
      view.poly(ring, { color: C.gridStrong, width: 2.2 });
      view.line(0, -hgt, c.R, -hgt, { color: C.displacement, width: 2.5 });
      view.text(c.R / 2, -hgt, 'R', { size: 13, weight: 700, color: C.displacement, offset: [0, 11], halo: true });
      view.line(0, 0, b.x, b.y, { color: C.ink, width: 2.2 });
      view.circle(0, 0, 5, { px: true, fill: C.ink });
      if (S.deg > 4) {
        view.arc(0, 0, 40, -90, -90 + S.deg, { color: C.accent, width: 2.5 });
        view.text(0, 0, F.deg(S.deg), { size: 12.5, weight: 700, color: C.accent, halo: true, offset: [-22, 52] });
      }
      PHY.mascot.draw(view, b.x, b.y, { pose: 'flying', px: small ? 38 : 54, anchor: [0.5, 0.5], flipX: Math.sin(S.psi) > 0 });
      /* forces at the bob: tension, weight, and their sum, which points at the axis */
      const k = (small ? 1.9 : 3) / view.scale;
      const ux = -b.x / S.L, uy = -b.y / S.L;
      const Tx = ux * c.tension * k, Ty = uy * c.tension * k;
      const Wy = -S.cm * G * k;
      view.arrow(b.x, b.y, b.x + Tx, b.y + Ty, { color: C.force, width: 4 });
      K.tipLabel(view, b.x, b.y, b.x + Tx, b.y + Ty, 'T', { color: C.force });
      view.arrow(b.x, b.y, b.x, b.y + Wy, { color: C.force, width: 4 });
      K.tipLabel(view, b.x, b.y, b.x, b.y + Wy, 'mg', { color: C.force, gap: 12 });
      const hx = -Math.cos(S.psi) * c.net * k, hy = Math.sin(S.psi) * c.net * k * tilt;
      view.arrow(b.x, b.y, b.x + hx, b.y + hy, { color: C.force, width: 3, dash: [6, 5], alpha: 0.8 });
      outC.set('R', F.unit(c.R, 'm', 2));
      outC.set('v', F.unit(c.v, 'ms', 2));
      outC.set('T', F.unit(c.period, 's', 2));
      outC.set('S', F.unit(c.tension, 'N', 1));
      outC.set('F', F.unit(c.net, 'N', 1));
    }
    function render() {
      view.clear();
      if (S.mode === 'table') renderTable();
      else renderCone();
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    setMode(S.mode);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { S.v = 4; S.R = 2; S.m = 1; sV.set(4); sR.set(2); sM.set(1); renew(); },
      setParam(name, v) {
        if (name === 'mode') { setMode(v); return; }
        if (name === 'v') { S.v = v; sV.set(v); }
        if (name === 'R') { S.R = v; sR.set(v); }
        if (name === 'm') { S.m = v; sM.set(v); }
        if (name === 'L') { S.L = v; sL.set(v); layout(); }
        if (name === 'deg') { S.deg = v; sD.set(v); }
        if (name === 'cm') { S.cm = v; sCM.set(v); }
        renew();
      },
      getState() {
        if (S.mode === 'table') return { mode: 'table', v: S.v, R: S.R, m: S.m, F: force(), a: (S.v * S.v) / S.R, T: (2 * Math.PI * S.R) / S.v, broken: S.broken, vel: S.vel };
        const c = cone();
        return { mode: 'cone', L: S.L, deg: S.deg, m: S.cm, R: c.R, v: c.v, period: c.period, tension: c.tension, net: c.net, measured: S.measured };
      },
    };
  };
})();

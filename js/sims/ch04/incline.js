/* PHY.sims.incline: a crate on a slope. mg sinθ and mg cosθ are the shadows of mg, from chapter 1.
   Friction here has one μ for sticking and for sliding. The crate starts by itself when tanθ passes μ.
   opts.two / setParam('two', true): the race, 10 kg against 2 kg on parallel tracks. play({two}) -> Promise.
   setParam: angle, mu, m, two, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10, RAD = Math.PI / 180;
  const LEN = 10.8, S0 = 1, RUN = 8, OFFSET = 1.75;

  PHY.sims.incline = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ angle: 37, mu: 0.25, m: 5, two: false, locked: false, masses: [10, 2] }, opts || {});
    /* mg is drawn up to 3 m long, and a crate low on the slope sends it below the floor, so the view reaches down that far. */
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.2, xMax: 12.4, yMin: -2.9, yMax: 9.8 }, aspect: 1.28, minHeight: 320, maxHeight: 510 });
    const gate = K.gate();
    const S = { angle: opts.angle, mu: opts.mu, m: opts.m, two: opts.two, phase: 'rest', s: 0, v: 0, a: 0, t: 0, slipAt: null, hold: 0, race: null, slow: 1, stamps: [], nextStamp: 0, locked: opts.locked, armed: true };

    const hud = {};
    hud.angle = U.Slider(controlsEl, { label: 'זווית המדרון', min: 0, max: 60, step: 1, value: S.angle, format: (v) => F.deg(v), color: 'var(--accent)', onInput(v) { leaveRace(); S.angle = v; touched(); } });
    hud.mu = U.Slider(controlsEl, { label: 'מקדם החיכוך μ', min: 0, max: 1, step: 0.05, value: S.mu, format: (v) => F.num(v, 2), onInput(v) { leaveRace(); S.mu = v; touched(); } });
    hud.m = U.Slider(controlsEl, { label: 'מסת הארגז', min: 1, max: 20, step: 1, value: S.m, unit: 'kg', digits: 0, onInput(v) { leaveRace(); S.m = v; touched(); } });
    const row = U.h('div', { class: 'sim-row' });
    hud.top = U.Button(row, 'להחזיר למעלה', function () { leaveRace(); toTop(); }, {});
    controlsEl.appendChild(row);
    hud.one = U.Readouts(controlsEl, [
      { key: 'sin', label: 'mg sinθ', color: 'var(--c-force)' },
      { key: 'cos', label: 'mg cosθ', color: 'var(--c-force)' },
      { key: 'f', label: 'חיכוך', color: 'var(--c-force)' },
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'slip', label: 'החליק בזווית' },
    ]);
    hud.twoOut = U.Readouts(controlsEl, [
      { key: 's0', label: 'במורד, 10 ק"ג', color: 'var(--c-force)' },
      { key: 's1', label: 'במורד, 2 ק"ג', color: 'var(--c-force)' },
      { key: 'f0', label: 'חיכוך, 10 ק"ג', color: 'var(--c-force)' },
      { key: 'f1', label: 'חיכוך, 2 ק"ג', color: 'var(--c-force)' },
      { key: 'a0', label: 'תאוצה, 10 ק"ג', color: 'var(--c-acceleration)' },
      { key: 'a1', label: 'תאוצה, 2 ק"ג', color: 'var(--c-acceleration)' },
    ]);

    /* This course's friendly angles are exact, so the readouts match the worked numbers. */
    const sinT = () => (S.angle === 37 ? 0.6 : S.angle === 53 ? 0.8 : Math.sin(S.angle * RAD));
    const cosT = () => (S.angle === 37 ? 0.8 : S.angle === 53 ? 0.6 : Math.cos(S.angle * RAD));
    function netAlong(m) { return m * G * sinT() - S.mu * m * G * cosT(); }

    function toTop() {
      gate.close();
      S.phase = 'rest'; S.s = 0; S.v = 0; S.a = 0; S.t = 0; S.hold = 0; S.stamps = []; S.nextStamp = 0;
      loop.requestRender();
    }
    function leaveRace() {
      if (S.two) { S.two = false; S.race = null; toTop(); paintPanels(); }
    }
    function touched() {
      if (S.phase === 'bottom') toTop();
      /* Below the slip angle a new slip is still to come, so the old reading goes. */
      if (sinT() / cosT() <= S.mu + 1e-9) S.slipAt = null;
      loop.requestRender();
    }
    function paintPanels() {
      hud.one.el.hidden = S.two;
      hud.twoOut.el.hidden = !S.two;
    }
    function setLocked(v) {
      S.locked = v;
      hud.angle.setEnabled(!v); hud.mu.setEnabled(!v); hud.m.setEnabled(!v);
      hud.top.disabled = v;
    }

    function step(dt0) {
      if (S.phase === 'hold') { S.hold += dt0; if (S.hold >= 0.6) { S.phase = 'done'; gate.close(); } return; }
      if (S.phase === 'done') return;
      if (S.two) {
        if (S.phase !== 'race') return;
        const dt = dt0 * 0.5;
        S.t += dt;
        S.race.forEach(function (c) {
          c.a = netAlong(c.m) / c.m;
          const nv = c.v + c.a * dt;
          c.s += ((c.v + nv) / 2) * dt;
          c.v = nv;
        });
        if (S.t >= S.nextStamp) { S.stamps.push(S.race[0].s); S.nextStamp += 0.25; }
        if (S.race[0].s >= RUN) { S.phase = 'hold'; S.hold = 0; S.tEnd = S.t; S.race.forEach(function (c) { c.endV = c.v; }); }
        return;
      }
      if (S.locked && !S.running) return;
      const dt = dt0;
      if (S.phase === 'rest') {
        if (sinT() / cosT() > S.mu + 1e-9) { S.phase = 'slide'; S.slipAt = S.angle; S.t = 0; S.stamps = []; S.nextStamp = 0; }
        else { S.a = 0; return; }
      }
      if (S.phase === 'slide') {
        S.a = netAlong(S.m) / S.m;
        S.t += dt;
        const nv = S.v + S.a * dt;
        if (nv <= 0) { S.v = 0; S.a = 0; S.phase = 'rest'; return; }
        S.s += ((S.v + nv) / 2) * dt;
        S.v = nv;
        if (S.t >= S.nextStamp) { S.stamps.push(S.s); S.nextStamp += 0.25; }
        if (S.s >= RUN) {
          /* back up to the line, so the printed numbers do not depend on the step size */
          const over = S.s - RUN;
          const back = over / S.v;
          S.t -= back;
          S.v -= S.a * back;
          S.s = RUN;
          S.phase = 'bottom';
          S.tEnd = S.t;
          gate.close();
        }
      }
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      const th = S.angle;
      const c = cosT(), s = sinT();
      const B = { x: 10.4, y: 0 };
      const T = { x: B.x - LEN * c, y: LEN * s };
      const u = { x: c, y: -s };           /* down the slope */
      const n = { x: s, y: c };            /* out of the slope */
      K.ground(view, 0, {});
      view.poly([T, B, { x: T.x, y: 0 }], { fill: C.gridStrong, color: C.axis, width: 2.5, close: true, alpha: 0.8 });
      /* A crate that reached the bottom covers this corner, and the slider shows the angle anyway. */
      if (th >= 3 && (S.two || S.phase !== 'bottom')) {
        view.arc(B.x, B.y, 38, 180 - th, 180, { color: C.accent, width: 2.5 });
        const mid = (180 - th / 2) * RAD;
        view.text(B.x, B.y, F.deg(th), { size: 12.5, weight: 800, color: C.accent, offset: [Math.cos(mid) * 58, -Math.sin(mid) * 58], halo: true });
      }
      const at = (d, off) => ({ x: T.x + u.x * (S0 + d) + n.x * (off || 0), y: T.y + u.y * (S0 + d) + n.y * (off || 0) });

      if (S.two && S.race) {
        /* the second track, a plank above the first */
        const a = { x: T.x + n.x * OFFSET, y: T.y + n.y * OFFSET }, b = { x: B.x + n.x * OFFSET - u.x * 0.4, y: B.y + n.y * OFFSET - u.y * 0.4 };
        view.line(a.x, a.y, b.x, b.y, { color: C.axis, width: 4, cap: 'butt' });
        view.line(at(0.2, 0).x, at(0.2, 0).y, at(0.2, OFFSET).x, at(0.2, OFFSET).y, { color: C.axis, width: 2 });
        view.line(at(7.8, 0).x, at(7.8, 0).y, at(7.8, OFFSET).x, at(7.8, OFFSET).y, { color: C.axis, width: 2 });
        const fin = [at(RUN + 0.1, 0), at(RUN + 0.1, OFFSET)];
        fin.forEach(function (p) { view.line(p.x, p.y, p.x + n.x * 0.75, p.y + n.y * 0.75, { color: C.good, width: 3 }); });
        S.stamps.forEach(function (d) {
          [0, OFFSET].forEach(function (off) { const p = at(d, off); view.circle(p.x, p.y, 2.6, { px: true, fill: C.displacement, alpha: 0.55 }); });
        });
        S.race.forEach(function (cr, i) {
          const off = i === 0 ? OFFSET : 0;
          const p = at(cr.s, off);
          const w = (small ? 30 : 38) * Math.cbrt(cr.m / 2), h = w * 0.82;
          K.crate(view, p.x, p.y, w, h, { rot: -th, label: F.unit(cr.m, 'kg', 0), size: small ? 9.5 : 11 });
          const cen = { x: p.x + (n.x * h * 1.02) / view.scale, y: p.y + (n.y * h * 1.02) / view.scale };
          if (S.phase === 'race') {
            const av = netAlong(cr.m) / cr.m;
            view.arrow(cen.x, cen.y, cen.x + u.x * av * 0.45, cen.y + u.y * av * 0.45, { color: C.acceleration, width: 3.2 });
          }
        });
        const R = S.race;
        hud.twoOut.set('s0', F.unit(R[0].m * G * s, 'N', 0));
        hud.twoOut.set('s1', F.unit(R[1].m * G * s, 'N', 0));
        hud.twoOut.set('f0', F.unit(S.mu * R[0].m * G * c, 'N', 0));
        hud.twoOut.set('f1', F.unit(S.mu * R[1].m * G * c, 'N', 0));
        /* The card asks who arrives first, so the accelerations wait for the run. */
        const secret = S.locked && S.phase === 'rest';
        hud.twoOut.set('a0', secret ? '?' : F.unit(netAlong(R[0].m) / R[0].m, 'ms2', 1));
        hud.twoOut.set('a1', secret ? '?' : F.unit(netAlong(R[1].m) / R[1].m, 'ms2', 1));
        const ended = S.phase === 'hold' || S.phase === 'done';
        PHY.mascot.draw(view, 0.3, 0, { pose: ended ? 'dizzy' : 'thinking', px: small ? 52 : 70 });
        if (ended) view.screenText(view.w / 2, 18, 'תיקו. והחתול התערב על הכבד.', { size: small ? 12.5 : 14, weight: 700, pill: true });
        return;
      }

      S.stamps.forEach(function (d) { const p = at(d, 0); view.circle(p.x, p.y, 2.6, { px: true, fill: C.displacement, alpha: 0.55 }); });
      const p = at(S.s, 0);
      const w = (small ? 44 : 56) * Math.cbrt(S.m / 5), h = w * 0.82;
      K.crate(view, p.x, p.y, w, h, { rot: -th, label: F.unit(S.m, 'kg', 0), size: small ? 10.5 : 12.5 });
      const cen = { x: p.x + (n.x * (h / 2)) / view.scale, y: p.y + (n.y * (h / 2)) / view.scale };
      const mg = S.m * G;
      const k = Math.min(0.055, 3 / mg);
      /* labels stay on the canvas, whatever the angle, and they are drawn last, so no arrow covers them */
      const labels = [];
      const lab = (x, y, str, dx, dy) => {
        const half = str.length > 3 ? 30 : 10;
        const px = Math.max(half, Math.min(view.w - half, view.sx(x) + dx));
        const py = Math.max(10, Math.min(view.h - 10, view.sy(y) + dy));
        labels.push(function () { view.screenText(px, py, str, { size: small ? 11.5 : 13, weight: 800, color: C.force, halo: true }); });
      };
      /* mg and its two shadows */
      const tipG = { x: cen.x, y: cen.y - mg * k };
      const tipS = { x: cen.x + u.x * mg * s * k, y: cen.y + u.y * mg * s * k };
      const tipC = { x: cen.x - n.x * mg * c * k, y: cen.y - n.y * mg * c * k };
      view.line(tipG.x, tipG.y, tipS.x, tipS.y, { color: C.soft, width: 1.5, dash: [4, 4] });
      view.line(tipG.x, tipG.y, tipC.x, tipC.y, { color: C.soft, width: 1.5, dash: [4, 4] });
      if (s > 0.02) view.arrow(cen.x, cen.y, tipS.x, tipS.y, { color: C.force, width: 2.8, dash: [7, 4], alpha: 0.85 });
      view.arrow(cen.x, cen.y, tipC.x, tipC.y, { color: C.force, width: 2.8, dash: [7, 4], alpha: 0.85 });
      view.arrow(cen.x, cen.y, tipG.x, tipG.y, { color: C.force, width: 4 });
      /* On a shallow slope mg and mg cosθ nearly coincide, so their labels go to opposite sides. */
      if (th < 15) lab(tipG.x, tipG.y, 'mg', 42, 2);
      else lab(tipG.x, tipG.y, 'mg', -2, 12);
      if (s > 0.12) lab(tipS.x, tipS.y, 'mg sinθ', 28, -8);
      lab(tipC.x, tipC.y, 'mg cosθ', -30, 8);
      /* the normal force and friction */
      const Nf = mg * c;
      const moving = S.phase === 'slide' || S.phase === 'bottom';
      const fNow = moving ? S.mu * Nf : Math.min(mg * s, S.mu * Nf);
      view.arrow(cen.x, cen.y, cen.x + n.x * Nf * k, cen.y + n.y * Nf * k, { color: C.force, width: 3.6 });
      lab(cen.x + n.x * Nf * k, cen.y + n.y * Nf * k, 'N', 6, -10);
      if (fNow > 0.3) {
        const fb = { x: p.x - u.x * ((w / 2) / view.scale), y: p.y - u.y * ((w / 2) / view.scale) };
        view.arrow(fb.x, fb.y, fb.x - u.x * fNow * k, fb.y - u.y * fNow * k, { color: C.force, width: 3.6 });
        lab(fb.x - u.x * fNow * k, fb.y - u.y * fNow * k, 'f', -3, -11);
      }
      if (S.v > 0.05) {
        /* at least 60 pixels out: around a light crate the labels sit close, and the arrow passes above them */
        const above = Math.max(h + 14, 60);
        const q = { x: p.x + (n.x * above) / view.scale, y: p.y + (n.y * above) / view.scale };
        const len = Math.min(3, S.v * 0.33);
        /* centered over the crate: at top speed its head stays clear of the label of mg sinθ, and on the canvas */
        const tipX = q.x + (u.x * len) / 2;
        const back = Math.max(0, view.sx(tipX) - (view.w - 10)) / view.scale;
        view.arrow(q.x - (u.x * len) / 2 - back, q.y - (u.y * len) / 2, tipX - back, q.y + (u.y * len) / 2, { color: C.velocity, width: 3.2 });
      }
      /* The cat watches from whichever side the slope leaves free. */
      PHY.mascot.draw(view, th >= 37 ? 0.3 : 11.45, 0, { pose: S.phase === 'rest' ? 'thinking' : S.phase === 'bottom' ? 'dizzy' : 'happy', px: small ? 46 : 62 });
      labels.forEach(function (draw) { draw(); });

      if (S.phase === 'bottom') view.screenText(view.w / 2, 18, 'סוף המסלול, המספרים של הרגע האחרון', { size: small ? 12 : 14, weight: 700, pill: true });

      hud.one.set('sin', F.unit(mg * s, 'N', 1));
      hud.one.set('cos', F.unit(mg * c, 'N', 1));
      hud.one.set('f', F.unit(fNow, 'N', 1));
      hud.one.set('a', F.unit(S.phase === 'slide' || S.phase === 'bottom' ? S.a : 0, 'ms2', 2));
      hud.one.set('v', F.unit(S.v, 'ms', 1));
      hud.one.set('slip', S.slipAt === null ? 'עוד לא' : F.deg(S.slipAt));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { S.slipAt = null; toTop(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'two') {
          S.two = !!v;
          S.race = S.two ? opts.masses.map(function (m) { return { m, s: 0, v: 0, a: 0 }; }) : null;
          toTop();
          paintPanels();
          return;
        }
        if (name === 'angle') { S.angle = v; hud.angle.set(v); }
        if (name === 'mu') { S.mu = v; hud.mu.set(v); }
        if (name === 'm') { S.m = v; hud.m.set(v); }
        touched();
      },
      getState() {
        return {
          phase: S.phase, t: S.t, tEnd: S.tEnd, s: S.s, v: S.v, a: S.a, angle: S.angle, mu: S.mu, m: S.m, slipAt: S.slipAt,
          race: S.race ? S.race.map(function (c) { return { m: c.m, s: c.s, v: c.v, a: c.a, endV: c.endV }; }) : null,
          mgSin: S.m * G * sinT(), mgCos: S.m * G * cosT(),
        };
      },
      play(o) {
        o = o || {};
        const two = o.two === undefined ? S.two : o.two;
        S.two = !!two;
        S.race = S.two ? opts.masses.map(function (m) { return { m, s: 0, v: 0, a: 0 }; }) : null;
        gate.close();
        S.s = 0; S.v = 0; S.a = 0; S.t = 0; S.hold = 0; S.stamps = []; S.nextStamp = 0; S.running = true;
        paintPanels();
        if (S.two) S.phase = 'race';
        else {
          S.phase = 'rest';
          if (sinT() / cosT() <= S.mu + 1e-9) return Promise.resolve();
        }
        return gate.open();
      },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 120) step(1 / 120);
      },
    };
    setLocked(opts.locked);
    if (S.two) S.race = opts.masses.map(function (m) { return { m, s: 0, v: 0, a: 0 }; });
    paintPanels();
    return api;
  };
})();

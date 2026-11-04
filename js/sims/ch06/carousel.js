/* PHY.sims.carousel: two cats ride one disk, at R and at 2R. Same period, same angle per second, and the outer
   cat covers twice the arc. opts.mode = 'radian' turns it into the gentle radian demo: lay the radius along the rim.
   Pair mode: sim.play() -> Promise, traces one second of each cat's arc. setParam: T, R, locked.
   getState(): T, f, omega, R1, R2, v1, v2, arc1, arc2 (arcs measured in the first traced second).
   Radian mode: sim.wrap() -> Promise, setParam: deg. getState(): deg, rad, arcInRadii. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const RAD = Math.PI / 180;

  function pairSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.45, minHeight: 300, maxHeight: 450 });
    const S = {
      T: opts.T, R: opts.R, phi: 40 * RAD, phase: 'idle', traced: 0, arc1: 0, arc2: 0, runT: 0, phi0: 0, arcEnd: 0,
      caption: '', showV: false, locked: opts.locked, resolve: null, runFor: 0,
    };
    const sT = U.Slider(controlsEl, {
      label: 'זמן של סיבוב אחד, T', min: 2, max: 10, step: 0.5, value: S.T, unit: 's', digits: 1,
      onInput(v) { S.T = v; clearTrace(); loop.requestRender(); },
    });
    const sR = U.Slider(controlsEl, {
      label: 'רדיוס החתול הפנימי, R', min: 1, max: 2.5, step: 0.5, value: S.R, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.R = v; clearTrace(); layout(); loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'T', label: 'T: זמן לסיבוב' },
      { key: 'f', label: 'f: סיבובים בשנייה' },
      { key: 'w', label: 'ω: זווית בשנייה' },
      { key: 'v1', label: 'v פנימי', color: 'var(--c-velocity)' },
      { key: 'v2', label: 'v חיצוני', color: 'var(--c-velocity)' },
    ]);
    function omega() { return (2 * Math.PI) / S.T; }
    function layout() {
      const Rd = 2 * S.R + S.R * 0.42;
      const Sc = (Math.min(view.w, view.h - 40) * 0.49) / Rd;
      K.place(view, view.w / 2, 36 + (view.h - 36) / 2, Sc);
    }
    function clearTrace() { S.traced = 0; S.arc1 = 0; S.arc2 = 0; S.showV = S.phase === 'free'; }
    function setLocked(v) { S.locked = v; sT.setEnabled(!v); sR.setEnabled(!v); if (!v) { S.phase = 'free'; S.showV = true; } }

    function step(dt) {
      const w = omega();
      S.phi += w * dt;
      if (S.phase !== 'run' && S.phase !== 'free') return;
      if (S.phase === 'run') {
        if (S.traced < 1) {
          const d = Math.min(dt, 1 - S.traced);
          S.traced += d;
          S.arc1 += w * S.R * d;
          S.arc2 += w * 2 * S.R * d;
          S.arcEnd = S.phi0 + w * S.traced;
        }
        S.runT += dt;
        if (S.runT >= S.runFor) {
          S.phase = 'done';
          S.caption = 'אותה זווית, פי 2 דרך.';
          K.settle(S);
        }
      }
    }

    function render() {
      const small = view.w < 420;
      const w = omega();
      const R1 = S.R, R2 = 2 * S.R, Rd = R2 + S.R * 0.42;
      const v1 = w * R1, v2 = w * R2;
      const cat = small ? 38 : 48;
      view.clear();
      /* the disk */
      view.circle(0, 0, Rd, { fill: C.shade, color: C.axis, width: 2.5, alpha: 0.55 });
      view.circle(0, 0, R1, { color: C.gridStrong, width: 1.5, dash: [4, 5] });
      view.circle(0, 0, R2, { color: C.gridStrong, width: 1.5, dash: [4, 5] });
      for (let k = 0; k < 8; k++) {
        const a = S.phi + (k * Math.PI) / 4;
        view.line(0, 0, Rd * Math.cos(a), Rd * Math.sin(a), { color: k === 0 ? C.axis : C.gridStrong, width: k === 0 ? 2.5 : 1 });
      }
      /* one second of arc */
      if (S.traced > 0) {
        const pts = function (r) {
          const list = [];
          for (let i = 0; i <= 30; i++) { const a = S.phi0 + ((S.arcEnd - S.phi0) * i) / 30; list.push({ x: r * Math.cos(a), y: r * Math.sin(a) }); }
          return list;
        };
        view.poly(pts(R1), { color: C.displacement, width: 5 });
        view.poly(pts(R2), { color: C.displacement, width: 5 });
        if (S.traced >= 1) {
          const am = (S.phi0 + S.arcEnd) / 2;
          view.text((R1 - 0.3 * S.R) * Math.cos(am), (R1 - 0.3 * S.R) * Math.sin(am), F.unit(S.arc1, 'm', 2), { size: small ? 11.5 : 13, weight: 700, color: C.displacement, halo: true });
          view.text((R2 - 0.3 * S.R) * Math.cos(am), (R2 - 0.3 * S.R) * Math.sin(am), F.unit(S.arc2, 'm', 2), { size: small ? 11.5 : 13, weight: 700, color: C.displacement, halo: true });
        }
      }
      /* the cats */
      [[R1, v1], [R2, v2]].forEach(function (c) {
        const x = c[0] * Math.cos(S.phi), y = c[0] * Math.sin(S.phi);
        if (S.showV) {
          const k = 0.42 * S.R / 2;
          view.arrow(x, y, x - Math.sin(S.phi) * c[1] * k, y + Math.cos(S.phi) * c[1] * k, { color: C.velocity, width: 3.5 });
        }
        PHY.mascot.draw(view, x, y, { pose: 'standing', px: cat, anchor: [0.5, 0.6] });
      });
      view.circle(0, 0, 4, { px: true, fill: C.ink });
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });

      const shown = S.phase !== 'idle';
      out.set('T', F.unit(S.T, 's', 1));
      out.set('f', shown ? F.num(1 / S.T, 2) + ' לשנייה' : '?');
      out.set('w', shown ? F.num(w, 2) + ' רד/ש' : '?');
      out.set('v1', shown ? F.unit(v1, 'ms', 2) : '?');
      out.set('v2', shown ? F.unit(v2, 'ms', 2) : '?');
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { K.settle(S); S.phase = S.locked ? 'idle' : 'free'; S.caption = ''; clearTrace(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'T') { S.T = v; sT.set(v); clearTrace(); }
        if (name === 'R') { S.R = v; sR.set(v); clearTrace(); layout(); }
        loop.requestRender();
      },
      getState() {
        const w = omega();
        return { phase: S.phase, T: S.T, f: 1 / S.T, omega: w, R1: S.R, R2: 2 * S.R, v1: w * S.R, v2: w * 2 * S.R, arc1: S.arc1, arc2: S.arc2 };
      },
      play(o) {
        o = o || {};
        K.settle(S);
        S.phase = 'run';
        S.runT = 0;
        S.runFor = o.seconds || 6;
        S.traced = 0;
        S.arc1 = 0;
        S.arc2 = 0;
        S.phi0 = S.phi;
        S.arcEnd = S.phi;
        S.showV = true;
        S.caption = 'עוקבים אחרי שנייה אחת של נסיעה';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
    setLocked(S.locked);
    return api;
  }

  function radianSim(canvasEl, controlsEl) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.5, minHeight: 280, maxHeight: 400 });
    const tw = PHY.ch02.tweens();
    const S = { deg: 57.3 };
    const R = 2;
    const slider = U.Slider(controlsEl, {
      label: 'הזווית', min: 0, max: 360, step: 1, value: 57, format: (v) => K.deg(v), color: 'var(--c-displacement)',
      onInput(v) { S.deg = v; tw.clear(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    U.Button(row, 'ללפף רדיוסים סביב העיגול', function () { api.wrap(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'deg', label: 'במעלות' },
      { key: 'rad', label: 'ברדיאנים' },
      { key: 'n', label: 'כמה רדיוסים על הקשת', color: 'var(--c-displacement)' },
    ]);
    function layout() {
      const Sc = (Math.min(view.w, view.h) * 0.4) / R;
      K.place(view, view.w / 2, view.h / 2, Sc);
    }
    function step(dt) { tw.step(dt); }
    function render() {
      const small = view.w < 420;
      const th = S.deg * RAD;
      view.clear();
      view.circle(0, 0, R, { color: C.gridStrong, width: 2.5 });
      /* the wedge */
      const wedge = [{ x: 0, y: 0 }];
      for (let i = 0; i <= 60; i++) { const a = (th * i) / 60; wedge.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
      view.poly(wedge, { fill: C.displacement, alpha: 0.12, close: true });
      /* whole radii along the rim, in alternating strength */
      const whole = Math.floor(th);
      for (let n = 0; n <= whole; n++) {
        const a0 = n, a1 = Math.min(n + 1, th);
        if (a1 <= a0) break;
        const pts = [];
        for (let i = 0; i <= 24; i++) { const a = a0 + ((a1 - a0) * i) / 24; pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
        view.poly(pts, { color: C.displacement, width: 7, alpha: n % 2 ? 0.55 : 1 });
      }
      for (let n = 1; n <= 6; n++) {
        if (n > th) break;
        view.line(0.93 * R * Math.cos(n), 0.93 * R * Math.sin(n), 1.07 * R * Math.cos(n), 1.07 * R * Math.sin(n), { color: C.ink, width: 2 });
        view.text(1.2 * R * Math.cos(n), 1.2 * R * Math.sin(n), String(n), { size: small ? 12.5 : 14, weight: 800, color: C.displacement, halo: true });
      }
      /* the radius itself: the piece of string we measure with */
      view.line(0, 0, R, 0, { color: C.displacement, width: 4 });
      view.text(R / 2, 0, 'R', { size: 14, weight: 800, color: C.displacement, offset: [0, 13], halo: true });
      view.line(0, 0, R * Math.cos(th), R * Math.sin(th), { color: C.soft, width: 2 });
      PHY.mascot.draw(view, 0, 0, { pose: 'thinking', px: small ? 42 : 54, anchor: [0.5, 0.62] });
      out.set('deg', K.deg(S.deg));
      out.set('rad', F.num(th, 2) + " רד'");
      out.set('n', F.num(th, 2));
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { tw.clear(); S.deg = 57.3; slider.set(57); loop.requestRender(); },
      setParam(name, v) { if (name === 'deg') { S.deg = v; slider.set(v); loop.requestRender(); } },
      getState() { return { deg: S.deg, rad: S.deg * RAD, arcInRadii: S.deg * RAD }; },
      wrap() {
        tw.clear();
        S.deg = 0;
        return tw.run(6, function (k) { S.deg = 360 * k; slider.set(Math.round(S.deg)); });
      },
    };
    return api;
  }

  PHY.sims.carousel = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'pair', T: 4, R: 2, locked: true }, opts || {});
    return opts.mode === 'radian' ? radianSim(canvasEl, controlsEl) : pairSim(canvasEl, controlsEl, opts);
  };
})();

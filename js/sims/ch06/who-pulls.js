/* PHY.sims.whoPulls: "centripetal" is a job title. Scenes: string (tension), road (friction), moon (gravity),
   wall (normal force in a spinning drum), each with tabs and true numbers, and table: two cats on a turntable.
   Table scene physics: while the cat grips, friction supplies ω²R. It lets go when ω²R > μg. A sliding cat feels a much
   weaker kinetic friction (a quarter of μg) against the slip until it leaves the disk, and floor friction stops it.
   opts: {scene, tabs, mu, locked}. sim.play() -> Promise (table: spin up until both cats are off).
   setParam: scene, omega, mu, locked. sim.cats() -> table state: [{R, stuck, wSlip, vSlip, aSlip, x, y}]. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;

  const SCENES = {
    string: { tab: 'חוט', who: 'מתיחות החוט', letter: 'T', v: 3, R: 1, m: 0.2, a: 9, Fs: '1.8 ניוטון', mass: '0.2 ק"ג', vs: '3 מ/ש', Rs: "1 מ'", as: '9 מ/ש²', rate: 1.3 },
    road: { tab: 'כביש', who: 'החיכוך עם הכביש', letter: 'f', v: 15, R: 50, m: 1000, a: 4.5, Fs: '4500 ניוטון', mass: '1000 ק"ג', vs: '15 מ/ש', Rs: "50 מ'", as: '4.5 מ/ש²', rate: 0.75 },
    moon: { tab: 'ירח', who: 'הכבידה של כדור הארץ', letter: 'F', v: 1030, R: 384000000, m: 7.3e22, a: 0.0028, Fs: '2\u200E×\u200E10²⁰ ניוטון', mass: '7.3\u200E×\u200E10²² ק"ג', vs: '1030 מ/ש', Rs: '384,000 ק"מ', as: '0.0028 מ/ש²', rate: 0.5 },
    wall: { tab: 'תוף', who: 'הדחיפה של הקיר', letter: 'N', v: 6, R: 2, m: 5, a: 18, Fs: '90 ניוטון', mass: '5 ק"ג', vs: '6 מ/ש', Rs: "2 מ'", as: '18 מ/ש²', rate: 1.6 },
  };
  const ORDER = ['string', 'road', 'moon', 'wall'];

  function gallery(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.6, minHeight: 280, maxHeight: 400 });
    const S = { scene: opts.scene, phi: 0.6 };
    const row = U.h('div', { class: 'sim-row' });
    const tabs = ORDER.map(function (k) {
      const b = U.Button(row, SCENES[k].tab, function () { setScene(k); }, { ghost: true });
      b.dataset.scene = k;
      return b;
    });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'R', label: 'רדיוס', color: 'var(--c-displacement)' },
      { key: 'a', label: 'v² חלקי R', color: 'var(--c-acceleration)' },
      { key: 'm', label: 'מסה' },
      { key: 'F', label: 'הכוח למרכז', color: 'var(--c-force)' },
    ]);
    function setScene(k) {
      S.scene = k;
      tabs.forEach(function (b) { b.classList.toggle('btn-primary', b.dataset.scene === k); b.classList.toggle('btn-ghost', b.dataset.scene !== k); });
      const d = SCENES[k];
      out.set('v', d.vs);
      out.set('R', d.Rs);
      out.set('a', d.as);
      out.set('m', d.mass);
      out.set('F', d.Fs);
      loop.requestRender();
    }
    function layout() {
      const Sc = Math.min(view.w, view.h - 56) / 8.6;
      K.place(view, view.w / 2, 56 + (view.h - 56) / 2, Sc);
    }
    function step(dt) { S.phi += SCENES[S.scene].rate * dt; }
    function render() {
      const small = view.w < 420;
      const d = SCENES[S.scene];
      const Rd = 3;
      view.clear();
      const x = Rd * Math.cos(S.phi), y = Rd * Math.sin(S.phi);
      const ux = -Math.sin(S.phi), uy = Math.cos(S.phi);
      const body = small ? 30 : 38;

      if (S.scene === 'string') {
        view.circle(0, 0, Rd, { color: C.gridStrong, width: 1.8, dash: [5, 6] });
        view.line(0, 0, x, y, { color: C.ink, width: 2 });
        PHY.mascot.draw(view, 0, 0, { pose: 'standing', px: small ? 50 : 62, anchor: [0.5, 0.62] });
        K.apple(view, x, y, small ? 17 : 20);
      } else if (S.scene === 'road') {
        const pts = [];
        for (let i = 0; i <= 80; i++) { const a = (i / 80) * Math.PI * 2; pts.push({ x: Rd * Math.cos(a), y: Rd * Math.sin(a) }); }
        K.road(view, pts, { width: small ? 28 : 34 });
        K.topCar(view, x, y, (S.phi * 180) / Math.PI + 90, { len: small ? 34 : 42, wid: small ? 16 : 20 });
        view.circle(0, 0, 3.5, { px: true, fill: C.ink });
      } else if (S.scene === 'moon') {
        view.circle(0, 0, Rd, { color: C.gridStrong, width: 1.8, dash: [3, 7] });
        view.circle(0, 0, small ? 26 : 34, { px: true, fill: C.leaf, color: C.ink, width: 2 });
        view.circle(-0.25, 0.2, small ? 9 : 12, { px: true, fill: C.gold, alpha: 0.55 });
        view.circle(x, y, small ? 11 : 14, { px: true, fill: C.soft, color: C.ink, width: 2 });
        view.circle(x + 0.1, y + 0.08, 3, { px: true, fill: C.axis, alpha: 0.6 });
      } else {
        view.circle(0, 0, Rd + 0.32, { color: C.axis, width: small ? 7 : 9 });
        for (let k = 0; k < 12; k++) {
          const a = S.phi + (k * Math.PI) / 6;
          view.line((Rd + 0.32) * Math.cos(a), (Rd + 0.32) * Math.sin(a), (Rd + 0.72) * Math.cos(a), (Rd + 0.72) * Math.sin(a), { color: C.axis, width: 2.5 });
        }
        view.circle(0, 0, 3.5, { px: true, fill: C.ink });
        const rr = Rd + 0.32 - (body * 0.5) / view.scale;
        PHY.mascot.draw(view, rr * Math.cos(S.phi), rr * Math.sin(S.phi), { pose: 'dizzy', px: body + 10, anchor: [0.5, 0.55], rot: (S.phi * 180) / Math.PI + 90 });
      }
      /* the two arrows every scene has */
      const onWall = S.scene === 'wall';
      const sx = onWall ? (Rd - 0.35) * Math.cos(S.phi) : x, sy = onWall ? (Rd - 0.35) * Math.sin(S.phi) : y;
      const fx = sx + (-sx / Rd) * 1.75, fy = sy + (-sy / Rd) * 1.75;
      view.arrow(sx, sy, fx, fy, { color: C.force, width: 4 });
      K.tipLabel(view, sx, sy, fx, fy, d.letter, { color: C.force });
      view.arrow(x, y, x + ux * 1.6, y + uy * 1.6, { color: C.velocity, width: 3.5 });
      K.tipLabel(view, x, y, x + ux * 1.6, y + uy * 1.6, 'v', { color: C.velocity });

      /* the name tag: the job, and who does it this time */
      const sz = small ? 11.5 : 13;
      view.screenText(view.w / 2, 16, 'תפקיד: כוח צנטריפטלי', { size: sz, weight: 700, pill: true, pillBorder: C.force, color: C.force });
      view.screenText(view.w / 2, 42, 'בתפקיד עכשיו: ' + d.who, { size: sz, weight: 700, pill: true });
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();
    setScene(S.scene);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { setScene(opts.scene); },
      setParam(name, v) { if (name === 'scene') setScene(v); },
      getState() {
        const d = SCENES[S.scene];
        return { scene: S.scene, a: (d.v * d.v) / d.R, F: (d.m * d.v * d.v) / d.R, label: d.Fs, labelA: d.a };
      },
    };
  }

  /* ---------- Turntable ---------- */
  function table(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.55, minHeight: 370, maxHeight: 420 });
    const Rdisk = 3;
    const S = { w: 0.7, phi: 0, ramp: 0, mu: opts.mu, phase: 'idle', caption: '', locked: opts.locked, resolve: null, wide: true, cats: [], runT: 0, afterBoth: 0 };
    const sW = U.Slider(controlsEl, {
      label: 'מהירות סיבוב הצלחת, ω', min: 0, max: 3, step: 0.05, value: S.w, format: (v) => F.num(v, 2) + ' רד/ש',
      onInput(v) { S.w = v; S.ramp = 0; },
    });
    const sMu = U.Slider(controlsEl, {
      label: 'מקדם חיכוך, μ', min: 0.1, max: 0.8, step: 0.05, value: S.mu, format: (v) => F.num(v, 2),
      onInput(v) { S.mu = v; loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const backBtn = U.Button(row, 'להחזיר את החתולים', function () { if (!S.locked) { S.w = Math.min(S.w, 0.7); sW.set(S.w); resetCats(); } }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'in', label: "v פנימי (1 מ')", color: 'var(--c-velocity)' },
      { key: 'out', label: "v חיצוני (2 מ')", color: 'var(--c-velocity)' },
      { key: 'lim', label: 'μg: התאוצה המרבית', color: 'var(--c-acceleration)' },
    ]);
    function resetCats() {
      S.cats = [1, 2].map(function (R, i) {
        return { R: R, base: i ? Math.PI : 0, stuck: true, x: 0, y: 0, vx: 0, vy: 0, wSlip: null, vSlip: null, aSlip: null, resting: false, trail: [], next: 0 };
      });
      placeCats();
    }
    function placeCats() {
      S.cats.forEach(function (c) {
        if (!c.stuck) return;
        const a = S.phi + c.base;
        c.x = c.R * Math.cos(a);
        c.y = c.R * Math.sin(a);
        c.vx = -S.w * c.R * Math.sin(a);
        c.vy = S.w * c.R * Math.cos(a);
      });
    }
    function layout() {
      S.wide = view.w >= 520;
      if (S.wide) {
        const Sc = Math.min(view.h / 10, (view.w * 0.62) / 10);
        K.place(view, view.w * 0.33, view.h * 0.52, Sc);
      } else {
        const Sc = Math.min((view.h * 0.72) / 10, view.w / 10);
        K.place(view, view.w * 0.5, view.h * 0.385, Sc);
      }
    }
    function setLocked(v) { S.locked = v; sW.setEnabled(!v); sMu.setEnabled(!v); backBtn.disabled = v; }

    function step(dt) {
      if (S.ramp > 0) { S.w = Math.min(3, S.w + S.ramp * dt); sW.set(Math.round(S.w * 20) / 20); }
      S.phi += S.w * dt;
      const ms = S.mu, mk = S.mu * 0.25, mf = 0.35;
      S.cats.forEach(function (c) {
        if (c.stuck) {
          if (S.w * S.w * c.R > ms * G) {
            c.stuck = false;
            c.wSlip = S.w;
            c.vSlip = S.w * c.R;
            c.aSlip = S.w * S.w * c.R;
            if (S.phase === 'run') {
              const name = c.R === 2 ? 'החיצוני' : 'הפנימי';
              S.caption = name + ' עף! ' + F.unit(c.aSlip, 'ms2', 1) + ' זה יותר ממה שהחיכוך נותן.';
            }
          }
        }
        if (!c.stuck && !c.resting) {
          const r = Math.hypot(c.x, c.y);
          let ax = 0, ay = 0;
          if (r < Rdisk) {
            const rx = c.vx + S.w * c.y, ry = c.vy - S.w * c.x;
            const rel = Math.hypot(rx, ry);
            if (rel > 1e-6) { ax = (-mk * G * rx) / rel; ay = (-mk * G * ry) / rel; } else { ax = (-mk * G * c.x) / r; ay = (-mk * G * c.y) / r; }
          } else {
            const sp = Math.hypot(c.vx, c.vy);
            if (sp < 0.05) { c.vx = 0; c.vy = 0; c.resting = true; } else { ax = (-mf * G * c.vx) / sp; ay = (-mf * G * c.vy) / sp; }
          }
          c.vx += ax * dt; c.vy += ay * dt;
          c.x += c.vx * dt; c.y += c.vy * dt;
          c.next += dt;
          if (c.next > 0.05) { c.next = 0; c.trail.push({ x: c.x, y: c.y }); }
        }
      });
      placeCats();
      if (S.phase === 'run') {
        S.runT += dt;
        const off = S.cats.every(function (c) { return !c.stuck; });
        if (off) S.afterBoth += dt;
        if (off && S.afterBoth >= 1.1) {
          S.phase = 'done';
          S.ramp = 0;
          S.caption = 'קודם החיצוני, אחריו הפנימי.';
          K.settle(S);
        }
      }
    }

    function render() {
      const small = view.w < 420;
      view.clear();
      view.circle(0, 0, Rdisk, { fill: C.shade, color: C.axis, width: 2.5, alpha: 0.6 });
      for (let k = 0; k < 8; k++) {
        const a = S.phi + (k * Math.PI) / 4;
        view.line(0, 0, Rdisk * Math.cos(a), Rdisk * Math.sin(a), { color: C.gridStrong, width: 1.2 });
      }
      view.circle(0, 0, 1, { color: C.gridStrong, width: 1.3, dash: [4, 5] });
      view.circle(0, 0, 2, { color: C.gridStrong, width: 1.3, dash: [4, 5] });
      view.circle(0, 0, 3.5, { px: true, fill: C.ink });
      const lim = S.mu * G;
      /* Before the guess the arrows and gauges would answer the card: the outer cat's demand is plainly bigger. */
      const masked = S.locked && S.phase === 'idle';
      S.cats.forEach(function (c) {
        if (c.trail.length > 1) view.poly(c.trail, { color: C.displacement, width: 2, dash: [4, 4], alpha: 0.8 });
      });
      S.cats.forEach(function (c) {
        const px = small ? 36 : 44;
        PHY.mascot.draw(view, c.x, c.y, { pose: c.stuck ? 'standing' : c.resting ? 'dizzy' : 'falling', px: px, anchor: [0.5, 0.6] });
        if (!masked && c.stuck) {
          const need = S.w * S.w * c.R;
          const L = (need / 8) * 1.5;
          if (L > 0.02) view.arrow(c.x, c.y, c.x - (c.x / c.R) * L, c.y - (c.y / c.R) * L, { color: C.force, width: 3.5 });
          view.arrow(c.x, c.y, c.x + c.vx * 0.4, c.y + c.vy * 0.4, { color: C.velocity, width: 3 });
        } else if (!masked && !c.resting) {
          view.arrow(c.x, c.y, c.x + c.vx * 0.4, c.y + c.vy * 0.4, { color: C.velocity, width: 3 });
        }
      });
      /* Grip gauges: what the circle asks for, against what friction can give. */
      const bx = S.wide ? view.w * 0.68 : view.w * 0.08;
      const bw = S.wide ? view.w * 0.28 : view.w * 0.84;
      const by = S.wide ? view.h * 0.3 : view.h * 0.8;
      const gapY = S.wide ? 74 : 38;
      const maxA = Math.max(8, lim * 1.5);
      S.cats.slice().reverse().forEach(function (c, i) {
        const y = by + i * gapY;
        const need = masked ? 0 : c.stuck ? S.w * S.w * c.R : c.aSlip || 0;
        const name = c.R === 2 ? "חיצוני, 2 מ'" : "פנימי, 1 מ'";
        view.screenText(bx + bw, y - 10, name, { size: small ? 11 : 12.5, weight: 700, align: 'right' });
        view.screenText(bx, y - 10, masked ? '?' : c.stuck ? F.unit(need, 'ms2', 1) : 'עף!', { size: small ? 11 : 12.5, weight: 700, align: 'left', color: c.stuck ? C.acceleration : C.bad });
        K.bar(view, bx, y, bw, small ? 9 : 12, need / maxA, { color: c.stuck ? C.acceleration : C.bad, limit: masked ? undefined : lim / maxA });
      });
      if (S.wide) view.screenText(bx + bw, by - 38, 'כמה תאוצה הסיבוב דורש', { size: 12.5, weight: 600, color: C.soft, align: 'right' });
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      out.set('in', masked ? '?' : F.unit(S.cats[0].stuck ? S.w * 1 : S.cats[0].vSlip, 'ms', 2));
      out.set('out', masked ? '?' : F.unit(S.cats[1].stuck ? S.w * 2 : S.cats[1].vSlip, 'ms', 2));
      out.set('lim', masked ? '?' : F.unit(lim, 'ms2', 1));
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();
    resetCats();
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { K.settle(S); S.phase = 'idle'; S.ramp = 0; S.caption = ''; resetCats(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'mu') { S.mu = v; sMu.set(v); }
        if (name === 'omega') { S.w = v; S.ramp = 0; sW.set(v); }
        loop.requestRender();
      },
      getState() { return { phase: S.phase, omega: S.w, mu: S.mu, cats: api.cats() }; },
      cats() {
        return S.cats.map(function (c) { return { R: c.R, stuck: c.stuck, wSlip: c.wSlip, vSlip: c.vSlip, aSlip: c.aSlip, x: c.x, y: c.y, resting: c.resting }; });
      },
      play(o) {
        o = o || {};
        K.settle(S);
        S.mu = o.mu === undefined ? S.mu : o.mu;
        sMu.set(S.mu);
        S.w = 0.8;
        sW.set(S.w);
        S.ramp = 0.3;
        S.phase = 'run';
        S.afterBoth = 0;
        S.runT = 0;
        S.caption = 'מאיצים את הצלחת לאט לאט';
        resetCats();
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
    setLocked(S.locked);
    return api;
  }

  PHY.sims.whoPulls = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ scene: 'string', mu: 0.4, locked: true }, opts || {});
    return opts.scene === 'table' ? table(canvasEl, controlsEl, opts) : gallery(canvasEl, controlsEl, opts);
  };
})();

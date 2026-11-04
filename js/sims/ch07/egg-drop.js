/* PHY.sims.eggDrop: two eggs fall from the same height, one onto concrete and one onto a pillow.
   A live force-time graph draws both stops in slow motion. The force is a half sine that stops the egg exactly
   in its contact time, and the area under it is summed numerically in step(), so it is measured, not assumed.
   opts: {mass, height, dtHard, dtSoft, breakAt, locked}. sim.play() -> Promise. setParam: dtSoft, locked.
   During the stop the weight of the egg, 0.5 N, is left out: it is tiny next to the contact force. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU;
  const SLOW = 0.036; /* slow motion during the contact */

  PHY.sims.eggDrop = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mass: 0.05, height: 5, dtHard: 0.01, dtSoft: 0.1, breakAt: 30, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 1 }, aspect: 1.75, minHeight: 370, maxHeight: 460 });
    const P = G2.pix(view);
    const v0 = Math.sqrt(2 * 10 * opts.height);
    const S = {};

    function lane(dt) {
      return { dt: dt, v: v0, area: 0, peak: 0, curve: [{ t: 0, y: 0 }], done: false, broken: false, depth: 0 };
    }
    function clear() {
      Object.assign(S, {
        phase: 'ready', fall: 0, tc: 0, hard: lane(opts.dtHard), soft: lane(opts.dtSoft), caption: '', hold: 0, pose: 'thinking',
      });
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }

    const slider = U.Slider(controlsEl, {
      label: 'זמן העצירה על הכרית', min: 0.01, max: 0.2, step: 0.005, value: opts.dtSoft, format: (v) => F.unit(v, 's', 3), color: 'var(--accent)',
      onInput(v) { opts.dtSoft = v; clear(); paintIdle(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const runBtn = U.Button(row, 'להפיל שוב', function () { if (!S.locked && S.phase !== 'fall' && S.phase !== 'contact') launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'ph', label: 'שיא על בטון', color: 'var(--c-force)' },
      { key: 'ps', label: 'שיא על כרית', color: 'var(--c-force)' },
      { key: 'ah', label: 'שטח על בטון' },
      { key: 'as', label: 'שטח על כרית' },
    ]);
    function paintIdle() { loop.requestRender(); }
    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      /* The stop time is part of the answer, so it stays out of sight until the card opens. */
      slider.el.hidden = v;
      runBtn.disabled = v;
    }

    function force(L, t) {
      if (t < 0 || t > L.dt) return 0;
      return ((Math.PI / 2) * (opts.mass * v0)) / L.dt * Math.sin((Math.PI * t) / L.dt);
    }

    function launch() {
      clear();
      S.phase = 'fall';
      S.caption = 'נופלות ' + F.unit(opts.height, 'm', 0) + ', ומגיעות ב-' + F.unit(v0, 'ms', 0);
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function advanceLane(L, sdt) {
      if (L.done) return;
      const tc = S.tc;
      const f = force(L, tc);
      L.area += f * sdt;
      L.peak = Math.max(L.peak, f);
      L.v = Math.max(0, L.v - (f * sdt) / opts.mass);
      L.depth += L.v * sdt;
      L.curve.push({ t: tc, y: f });
      if (tc >= L.dt) {
        L.done = true;
        L.curve.push({ t: L.dt, y: 0 });
        L.v = 0;
      }
      if (f > opts.breakAt && !L.broken) L.broken = true;
    }

    function tMaxGraph() { return Math.max(0.12, opts.dtSoft * 1.12); }

    function step(dt) {
      if (S.phase === 'fall') {
        S.fall += dt / 0.9;
        if (S.fall >= 1) { S.fall = 1; S.phase = 'contact'; S.caption = 'הילוך איטי: מה הכוח בכל רגע?'; S.tc = 0; }
        return;
      }
      if (S.phase === 'contact') {
        const sdt = dt * SLOW * (tMaxGraph() / 0.12);
        S.tc += sdt;
        advanceLane(S.hard, sdt);
        advanceLane(S.soft, sdt);
        if (S.hard.broken) S.pose = 'dizzy';
        if (S.hard.done && S.soft.done && S.tc >= Math.max(opts.dtSoft, opts.dtHard) * 1.04) {
          S.phase = 'hold';
          S.hold = 0;
          S.caption = S.soft.broken ? 'גם הכרית קשה מדי: אותו שטח, כוח גבוה' : 'אותו שטח. שיא שונה לגמרי.';
          S.pose = S.soft.broken ? 'dizzy' : 'happy';
        }
        return;
      }
      if (S.phase === 'hold') {
        S.hold += dt;
        if (S.hold >= 0.7) {
          S.phase = 'done';
          if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        }
      }
    }

    function drawEgg(x, y, L, sq) {
      const ctx = view.ctx;
      const small = view.w < 420;
      const rx = small ? 11 : 13, ry = rx * 1.28;
      if (L.broken) {
        /* Shell in pieces and a yolk, on the floor. */
        const spread = rx * 2.1;
        ctx.save();
        ctx.fillStyle = C.surface;
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y - 3.5, spread, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.beginPath();
        ctx.ellipse(x, y - 4.2, rx * 0.7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        [-1, 1].forEach(function (s) {
          ctx.fillStyle = C.surface;
          ctx.beginPath();
          ctx.moveTo(x + s * spread * 0.8, y - 2);
          ctx.lineTo(x + s * (spread + 7), y - 4);
          ctx.lineTo(x + s * (spread * 0.8 + 3), y - 11);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - ry * (sq || 1), rx * (2 - (sq || 1)), ry * (sq || 1), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function render() {
      view.clear();
      const W = view.w, H = view.h;
      const small = W < 420;
      const sceneH = Math.round(H * 0.4);
      const groundY = sceneH - 8;
      const xa = W * 0.24, xb = W * 0.76;
      /* Concrete */
      K.bar(view, xa - W * 0.17, groundY, W * 0.34, 8, C.axis);
      view.screenText(xa, 14, 'בטון', { size: 13, weight: 700 });
      /* Pillow: it dents as the egg sinks in, up to about 22 px. */
      const dent = S.phase === 'ready' || S.phase === 'fall' ? 0 : Math.min(1, S.soft.depth / (v0 * opts.dtSoft * 0.5 + 1e-6));
      const pillowH = small ? 26 : 30;
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.accent;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      const px0 = xb - W * 0.17, px1 = xb + W * 0.17, top = groundY - pillowH;
      ctx.moveTo(px0, groundY + 8);
      ctx.quadraticCurveTo(px0 - 8, top + 6, px0 + 18, top);
      ctx.quadraticCurveTo(xb, top + dent * pillowH * 1.5, px1 - 18, top);
      ctx.quadraticCurveTo(px1 + 8, top + 6, px1, groundY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      view.screenText(xb, 14, 'כרית', { size: 13, weight: 700 });

      /* Eggs */
      const fall = S.fall * S.fall; /* free fall: distance grows like t squared */
      const yTop = 30 + 14;
      const yHardEnd = groundY;
      const ySoftEnd = groundY - pillowH + dent * pillowH * 0.75;
      const yh = S.phase === 'ready' || S.phase === 'fall' ? yTop + (yHardEnd - yTop) * fall : yHardEnd;
      const ys = S.phase === 'ready' || S.phase === 'fall' ? yTop + (groundY - pillowH - yTop) * fall : ySoftEnd;
      const squash = S.phase === 'contact' && !S.hard.done ? 0.82 : 1;
      drawEgg(xa, yh, S.hard, squash);
      drawEgg(xb, ys, S.soft, 1);

      /* The cat, between the lanes, has opinions. */
      const cat = view.toWorld(W / 2, groundY + 8);
      PHY.mascot.draw(view, cat.x, cat.y, { pose: S.pose, px: small ? 62 : 84 });

      /* Graph */
      const plot = G2.Plot(view, {
        tMin: 0, tMax: tMaxGraph(), yMin: 0, yMax: 90, yTick: 30,
        tTick: tMaxGraph() > 0.16 ? 0.05 : 0.02,
        title: 'כוח על הביצה (ניוטון)', tLabel: "t (ש')",
      });
      plot.box(4, sceneH + 2, W - 8, H - sceneH - 6);
      plot.frame();
      plot.hline(opts.breakAt, { color: C.bad, width: 1.5, dash: [6, 5] });
      plot.text(tMaxGraph(), opts.breakAt, 'כאן הקליפה נשברת', { size: 11, weight: 700, color: C.bad, align: 'right', offset: 0 });
      [S.hard, S.soft].forEach(function (L) {
        if (L.curve.length > 1) {
          plot.fill(L.curve, { color: C.force, alpha: 0.24 });
          plot.curve(L.curve, { color: C.force, width: 2.6 });
        }
      });
      if (S.phase === 'hold' || S.phase === 'done') {
        const areaText = function (a) { return 'שטח ' + F.unit(a, PU, 1); };
        const r = plot.r;
        const peakPx = plot.Y(Math.min(90, S.hard.peak));
        view.screenText(plot.X(opts.dtHard) + 8, Math.max(peakPx + 12, r.y + 12), 'בטון: ' + areaText(S.hard.area), { size: 11.5, weight: 700, align: 'left', halo: true });
        view.screenText(plot.X(opts.dtSoft * 0.5), plot.Y(S.soft.peak) - 13 > plot.Y(opts.breakAt) + 8 ? plot.Y(S.soft.peak) - 13 : plot.Y(S.soft.peak) + 14, 'כרית: ' + areaText(S.soft.area), { size: 11.5, weight: 700, halo: true });
      }

      K.caption(view, S.caption, 36);

      const fmtPeak = function (L) { return L.peak ? F.unit(L.peak, 'N', 1) : '...'; };
      out.set('ph', fmtPeak(S.hard));
      out.set('ps', fmtPeak(S.soft));
      out.set('ah', S.hard.area ? F.unit(S.hard.area, PU, 2) : '...');
      out.set('as', S.soft.area ? F.unit(S.soft.area, PU, 2) : '...');
    }

    const loop = PHY.SimLoop({ view, step, render });
    clear();
    setLocked(opts.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clear(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'dtSoft') { opts.dtSoft = v; slider.set(v); clear(); loop.requestRender(); }
      },
      getState() {
        return {
          phase: S.phase, v0: v0, p0: opts.mass * v0,
          hard: { area: S.hard.area, peak: S.hard.peak, v: S.hard.v, broken: S.hard.broken },
          soft: { area: S.soft.area, peak: S.soft.peak, v: S.soft.v, broken: S.soft.broken },
        };
      },
      play() { return launch(); },
    };
  };
})();

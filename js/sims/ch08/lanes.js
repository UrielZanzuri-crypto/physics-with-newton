/* PHY.sims.oscLanes: several real oscillators on one stage, released together, each with its own cycle
   counter. A lane is a cat on a floor spring ('vspring', gravity included), a cat on a cart on a wall
   spring ('hspring'), or a cat on a string ('pendulum', the real equation with sin, by RK4).
   T shown is measured from the turning points of the running oscillator, never computed from a formula.

   lane: {type, x0, y0, label or labelFn(lane), m, k, g, A (meters), L0 (natural length), config: 'single'|'parallel'|'series',
          L, theta0 (degrees), ghost (draw the small-angle prediction), px, showRest (only once released, since
          the rest line would answer a predict card), pose}
   opts: {world, aspect, minHeight, maxHeight, lanes, duration, rate, controls: [{lane, key, label, min, max,
          step, unit, digits, color, format}], locked, endCaption (a string, or lanes => string for what the run
          really showed), runLabel, runButton}
   sim.play({duration}) -> Promise. setParam: locked. sim.setLane(i, patch). getState().lanes[i].T */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch08;
  const RAD = Math.PI / 180;

  function kEff(l) { return l.config === 'parallel' ? 2 * l.k : l.config === 'series' ? l.k / 2 : l.k; }
  function restOf(l) { return l.type === 'vspring' ? (-l.m * l.g) / kEff(l) : 0; }
  function sideOf(l) { return l.type === 'vspring' ? -1 : 1; }

  function resetLane(l) {
    if (l.type === 'pendulum') l.q = l.theta0 * RAD;
    else l.q = restOf(l) + sideOf(l) * l.A;
    l.u = 0;
    l.meter = K.cycleMeter(sideOf(l));
    l.flash = 0;
    l.tGhost = 0;
  }

  PHY.sims.oscLanes = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ aspect: 1.5, minHeight: 260, maxHeight: 460, duration: 6, rate: 1, controls: [], locked: true, runLabel: 'הפעלה' }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: opts.world, aspect: opts.aspect, minHeight: opts.minHeight, maxHeight: opts.maxHeight });
    const S = { phase: 'ready', t: 0, duration: opts.duration, locked: opts.locked, caption: '', resolve: null };
    const lanes = opts.lanes.map(function (l) {
      const c = Object.assign({ g: 10, m: 1, k: 10, A: 0.5, L0: 2.2, L: 1, theta0: 15, config: 'single', px: 46 }, l);
      resetLane(c);
      return c;
    });

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function resetAll() {
      settle();
      S.phase = 'ready';
      S.t = 0;
      S.caption = '';
      lanes.forEach(resetLane);
      loop.requestRender();
    }

    function advanceLane(l, h, t) {
      if (l.type === 'pendulum') {
        const n = K.pendStep(l.q, l.u, l.g / l.L, h);
        l.q = n.th; l.u = n.om;
      } else {
        const k = kEff(l), m = l.m, g = l.type === 'vspring' ? l.g : 0;
        const n = K.verlet(l.q, l.u, function (x) { return (-k / m) * x - g; }, h);
        l.q = n.x; l.u = n.v;
      }
      const before = l.meter.n;
      l.meter.feed(l.u, t, h);
      if (l.meter.n > before) l.flash = 0.45;
    }

    function step(dt) {
      lanes.forEach(function (l) { if (l.flash > 0) l.flash -= dt; });
      if (S.phase !== 'run') return;
      const h = dt * opts.rate;
      S.t += h;
      lanes.forEach(function (l) { advanceLane(l, h, S.t); });
      if (S.t >= S.duration) {
        S.phase = 'done';
        S.caption = typeof opts.endCaption === 'function' ? opts.endCaption(lanes) : (opts.endCaption || '');
        if (!S.locked) setRunEnabled(true);
        settle();
      }
    }

    /* ---------- drawing ---------- */
    function pillT(l, x, y, off) {
      const T = l.meter.T;
      view.text(x, y, T === null ? 'מחזור: ?' : 'מחזור: ' + F.unit(T, 's', 2), { size: 12.5, weight: 700, pill: true, offset: off });
    }
    function labelOf(l) { return l.labelFn ? l.labelFn(l) : l.label; }
    function poseOf(l) {
      if (l.pose) return l.pose;
      return S.phase === 'run' ? 'happy' : S.phase === 'done' ? 'standing' : 'thinking';
    }
    function ring(l, x, y) {
      if (l.flash > 0) view.circle(x, y, l.px * 0.55 + (0.45 - l.flash) * 24, { px: true, color: C.gold, width: 3, alpha: Math.min(1, l.flash / 0.3) });
    }

    function drawV(l) {
      const y = l.y0 + l.L0 + l.q;
      const showRest = l.showRest && S.phase !== 'ready';
      K.floor(view, l.y0, l.x0 - 0.62, l.x0 + 0.62);
      if (showRest) {
        const ry = l.y0 + l.L0 + restOf(l);
        view.line(l.x0 - 0.62, ry, l.x0 + 0.62, ry, { color: C.displacement, width: 1.8, dash: [5, 5] });
      }
      K.spring(view, l.x0, l.y0, l.x0, y, { amp: 11, coils: 8 });
      view.line(l.x0 - 0.3, y, l.x0 + 0.3, y, { color: C.ink, width: 5 });
      ring(l, l.x0, y + (l.px * 0.45) / view.scale);
      PHY.mascot.draw(view, l.x0, y + 2 / view.scale, { pose: poseOf(l), px: l.px });
      if (showRest) {
        const inner = l.x0 < 0 ? 1 : -1;
        view.text(l.x0 + inner * 0.42, l.y0 + l.L0 + restOf(l), F.unit(l.L0 + restOf(l), 'm', 2), { size: 12, weight: 700, color: C.displacement, align: inner > 0 ? 'left' : 'right', offset: [0, -10], halo: true });
      }
      view.text(l.x0, l.y0, labelOf(l), { size: 13, weight: 700, offset: [0, 15], halo: true });
      pillT(l, l.x0, l.y0, [0, 37]);
    }

    function drawH(l) {
      const cx = l.x0 + l.L0 + l.q;
      const deckPx = 16;
      const yAxle = l.y0 + (deckPx * 0.72) / view.scale;
      K.wall(view, l.x0, l.y0, l.y0 + (l.px + 8) / view.scale);
      K.floor(view, l.y0, l.x0);
      view.line(l.x0 + l.L0, l.y0, l.x0 + l.L0, l.y0 + (l.px + deckPx) / view.scale, { color: C.gridStrong, width: 1.5, dash: [4, 5] });
      const end = cx - 23 / view.scale;
      if (l.config === 'parallel') {
        const d = 9 / view.scale, yMid = yAxle + d;
        K.spring(view, l.x0, yMid + d, end, yMid + d, { amp: 4.5, coils: 7, width: 1.8 });
        K.spring(view, l.x0, yMid - d, end, yMid - d, { amp: 4.5, coils: 7, width: 1.8 });
        view.line(end, yMid - d, end, yMid + d, { color: C.axis, width: 2.5 });
      } else if (l.config === 'series') {
        const mid = (l.x0 + end) / 2;
        K.spring(view, l.x0, yAxle, mid, yAxle, { amp: 6, coils: 5 });
        K.spring(view, mid, yAxle, end, yAxle, { amp: 6, coils: 5 });
        view.circle(mid, yAxle, 3.5, { px: true, fill: C.ink });
      } else {
        K.spring(view, l.x0, yAxle, end, yAxle, { amp: 7, coils: 9 });
      }
      ring(l, cx, l.y0 + (deckPx + l.px * 0.42) / view.scale);
      K.cart(view, cx, l.y0, { pose: poseOf(l), catPx: l.px });
      const r = view.visible;
      view.text(r.xMax, l.y0, labelOf(l), { size: 12.5, weight: 700, align: 'right', offset: [-6, 15], halo: true });
      pillT(l, view.toWorld(view.w * 0.3, 0).x, l.y0, [0, 15]);
    }

    function drawP(l) {
      const x = l.x0 + l.L * Math.sin(l.q), y = l.y0 - l.L * Math.cos(l.q);
      const rPx = l.L * view.scale;
      view.arc(l.x0, l.y0, rPx, -90 - l.theta0, -90 + l.theta0, { color: C.gridStrong, width: 2, dash: [4, 5] });
      if (l.ghost) {
        const w0 = Math.sqrt(l.g / l.L);
        const th = l.theta0 * RAD * Math.cos(w0 * S.t);
        view.line(l.x0, l.y0, l.x0 + l.L * Math.sin(th), l.y0 - l.L * Math.cos(th), { color: C.soft, width: 1.5, dash: [4, 4], alpha: 0.7 });
        PHY.mascot.draw(view, l.x0 + l.L * Math.sin(th), l.y0 - l.L * Math.cos(th), { pose: 'onBranch', px: l.px, rot: th / RAD, alpha: 0.32 });
      }
      view.line(l.x0 - 0.28, l.y0, l.x0 + 0.28, l.y0, { color: C.axis, width: 5, cap: 'butt' });
      view.line(l.x0, l.y0, x, y, { color: C.ink, width: 2 });
      view.circle(l.x0, l.y0, 3.5, { px: true, fill: C.ink });
      ring(l, x, y - (l.px * 0.35) / view.scale);
      PHY.mascot.draw(view, x, y, { pose: 'onBranch', px: l.px, rot: l.q / RAD });
      view.text(l.x0, l.y0, labelOf(l), { size: 13, weight: 700, offset: [0, -13], halo: true });
      pillT(l, l.x0, l.y0, [0, -36]);
    }

    function render() {
      view.clear();
      lanes.forEach(function (l) {
        if (l.type === 'vspring') drawV(l);
        else if (l.type === 'hspring') drawH(l);
        else drawP(l);
      });
      if (S.caption) view.screenText(view.w / 2, 16, S.caption, { size: 13.5, weight: 700, pill: true });
      else view.screenText(view.w / 2, 16, 'שעון: ' + F.unit(S.t, 's', 1), { size: 13, weight: 700, color: C.soft, halo: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- controls ---------- */
    const sliders = opts.controls.map(function (c) {
      return U.Slider(controlsEl, {
        label: c.label, min: c.min, max: c.max, step: c.step, value: lanes[c.lane][c.key], unit: c.unit, digits: c.digits, color: c.color, format: c.format,
        onInput(v) { lanes[c.lane][c.key] = v; resetAll(); },
      });
    });
    let runBtn = null;
    if (opts.controls.length || opts.runButton) {
      const row = U.h('div', { class: 'sim-row' });
      runBtn = U.Button(row, opts.runLabel, function () { if (!S.locked) launch(); }, { primary: true });
      controlsEl.appendChild(row);
    }
    function setRunEnabled(on) { if (runBtn) runBtn.disabled = !on; }
    function setLocked(v) {
      S.locked = v;
      sliders.forEach(function (s) { s.setEnabled(!v); });
      setRunEnabled(!v);
    }

    function launch(o) {
      resetAll();
      S.duration = (o && o.duration) || opts.duration;
      S.phase = 'run';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: resetAll,
      play: launch,
      setParam(name, v) { if (name === 'locked') setLocked(!!v); },
      setLane(i, patch) {
        Object.assign(lanes[i], patch);
        opts.controls.forEach(function (c, j) { if (c.lane === i && patch[c.key] !== undefined) sliders[j].set(patch[c.key]); });
        resetAll();
      },
      getState() {
        return {
          t: S.t, phase: S.phase, caption: S.caption,
          lanes: lanes.map(function (l) {
            return { type: l.type, T: l.meter.T, cycles: l.meter.n, q: l.q, u: l.u, rest: restOf(l), kEff: kEff(l), m: l.m, g: l.g, L: l.L };
          }),
        };
      },
    };
  };
})();

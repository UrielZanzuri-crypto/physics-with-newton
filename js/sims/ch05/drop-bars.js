/* PHY.sims.dropBars: the cat falls, and height turns into speed. The bars keep one total, a marker stops
   him for a moment at half height, and a graph of speed against distance fallen draws itself as he goes.
   The speed comes from integrating the fall, and the bars are computed from the speed and the height.
   opts: {height, mass, locked}. sim.play() -> Promise. setParam: height, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05, P2 = PHY.ch02;

  PHY.sims.dropBars = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ height: 20, mass: 4, locked: true, slow: 0.75 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -2, xMax: 33, yMin: -2, yMax: 32 }, aspect: 1.2, minHeight: 345, maxHeight: 480 });
    const S = { H: opts.height, y: opts.height, v: 0, t: 0, running: false, done: false, hold: 0, halfHold: 0, half: null, trail: [], locked: opts.locked, resolve: null, caption: '', stamps: [] };

    const slider = U.Slider(controlsEl, {
      label: 'גובה ההתחלה', min: 5, max: 25, step: 1, value: S.H, unit: 'm', digits: 0, color: 'var(--c-displacement)',
      onInput(v) { S.H = v; clearRun(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'לשמוט', function () { launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'y', label: 'גובה', color: 'var(--c-displacement)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'half', label: 'מהירות בחצי הגובה', color: 'var(--c-velocity)' },
    ]);

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      go.disabled = v;
    }
    function clearRun() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.y = S.H; S.v = 0; S.t = 0; S.running = false; S.done = false; S.hold = 0; S.halfHold = 0; S.half = null; S.trail = []; S.caption = '';
    }
    function launch() {
      clearRun();
      S.running = true;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function finish() {
      S.running = false;
      S.done = true;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    function step(dt) {
      if (!S.running) return;
      if (S.halfHold > 0) { S.halfHold -= dt; return; }
      if (S.y <= 0) {
        S.hold += dt;
        if (S.hold > 0.7) finish();
        return;
      }
      const h = dt * opts.slow;
      const v1 = S.v + 10 * h;
      let y1 = S.y - 0.5 * (S.v + v1) * h;
      const half = S.H / 2;
      if (S.half === null && y1 <= half) {
        const v = Math.sqrt(S.v * S.v + 2 * 10 * (S.y - half));
        S.half = { y: half, v: v, t: S.t + (v - S.v) / 10 };
        S.y = half;
        S.v = v;
        S.t = S.half.t;
        S.trail.push({ t: S.H - S.y, y: S.v });
        S.halfHold = 0.9;
        S.caption = 'חצי גובה: ' + F.unit(v, 'ms', 1);
        return;
      }
      if (y1 <= 0) {
        S.v = Math.sqrt(S.v * S.v + 2 * 10 * S.y);
        y1 = 0;
        S.caption = 'כל הגובה הפך למהירות: ' + F.unit(S.v, 'ms', 1);
      } else {
        S.v = v1;
      }
      S.y = y1;
      S.t += h;
      S.trail.push({ t: S.H - S.y, y: S.v });
    }

    function render() {
      const small = view.w < 460;
      view.clear();
      const r = view.visible;
      /* The tower side: world coordinates. The graph side: pixels, on the right. */
      const m = opts.mass;
      const ke = 0.5 * m * S.v * S.v, pe = m * 10 * S.y;
      const tx = 4.6;
      view.line(r.xMin, 0, 9.8, 0, { color: C.axis, width: 2.5, cap: 'butt' });
      view.poly([{ x: -1.2, y: 0 }, { x: 0.6, y: 0 }, { x: 0.6, y: S.H }, { x: -1.2, y: S.H }], { fill: C.gridStrong, color: C.axis, width: 2, alpha: 0.75, close: true });
      view.line(0.6, S.H, 3, S.H, { color: C.axis, width: 3 });
      for (let i = 5; i <= S.H; i += 5) view.text(0.6, i, F.num(i), { size: 10.5, color: C.ink, align: 'right', offset: [-5, 0], weight: 600 });
      view.text(-0.2, 0, "מ'", { size: 10.5, color: C.soft, offset: [0, 11] });
      const half = S.H / 2;
      view.line(0.6, half, 8.4, half, { color: C.displacement, width: 1.6, dash: [5, 5] });
      view.text(8.5, half, 'חצי', { size: 11, weight: 700, color: C.displacement, align: 'left', halo: true, offset: [2, 0] });
      const pose = S.y <= 0 ? (S.running || S.done ? 'dizzy' : 'standing') : S.running || S.t > 0 ? 'falling' : 'standing';
      const px = small ? 40 : 56;
      if (pose === 'falling') PHY.mascot.draw(view, tx, S.y + (px * 0.32) / view.scale, { pose, px });
      else PHY.mascot.draw(view, tx, S.y, { pose, px });
      if (S.v > 0.3 && S.y > 0) {
        const k = (small ? 2.4 : 3.2) / view.scale;
        view.arrow(tx + 2.1, S.y + 2, tx + 2.1, S.y + 2 - S.v * k, { color: C.velocity, width: 3.5, label: F.unit(S.v, 'ms', 1), labelSide: -1, labelGap: small ? 27 : 30, labelSize: 12 });
      }
      /* graph */
      const gx = view.sx(10.6);
      const gw = view.w - gx - 2;
      const graphTop = 94;
      const gh = Math.min(view.h - graphTop - 8, view.sy(-1) - graphTop);
      const vmax = Math.sqrt(2 * 10 * S.H);
      const plot = P2.Plot(view, { tMin: 0, tMax: S.H, yMin: 0, yMax: Math.ceil(vmax / 5) * 5, yTick: small ? 10 : 5, tTick: 5, title: 'מהירות (מ/ש)', tLabel: "נפילה (מ')" });
      plot.box(gx, graphTop, gw, gh).frame();
      /* the straight line people expect, for comparison */
      plot.curve([{ t: 0, y: 0 }, { t: S.H, y: vmax }], { color: C.soft, width: 1.5, dash: [5, 5] });
      if (S.trail.length) plot.curve(S.trail, { color: C.velocity, width: 3 });
      plot.vline(half, { color: C.displacement, width: 1.4 });
      if (S.half) plot.dot(half, S.half.v, { color: C.velocity });
      /* energy */
      M.energyPanel(view, {
        x: 6, y: 5, w: view.w - 12, max: m * 10 * S.H,
        items: [{ label: 'קינטית', value: ke, color: C.accent }, { label: 'גובה', value: pe, color: C.gold }],
      });
      if (S.caption) view.screenText(view.w / 2, 78, S.caption, { size: small ? 12.5 : 13.5, weight: 700, pill: true });
      out.set('y', F.unit(S.y, 'm', 1));
      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('half', S.half ? F.unit(S.half.v, 'ms', 1) : '–');
    }

    const loop = PHY.SimLoop({ view, step, render });
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'height') { S.H = v; slider.set(v); clearRun(); loop.requestRender(); }
      },
      getState() {
        const m = opts.mass;
        return { y: S.y, v: S.v, t: S.t, H: S.H, mass: m, done: S.done, halfV: S.half ? S.half.v : null, halfT: S.half ? S.half.t : null, ke: 0.5 * m * S.v * S.v, pe: m * 10 * S.y, total: 0.5 * m * S.v * S.v + m * 10 * S.y };
      },
    };
  };
})();

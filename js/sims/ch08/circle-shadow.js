/* PHY.sims.circleShadow: the cat rides a turntable. A lamp straight above throws his shadow on the strip below,
   and beside it a cart on a real spring (integrated from F = -kx, with k/m = omega^2) runs in the same lane.
   The gap between the shadow, which comes from circle geometry, and the cart, which comes from the force, is
   measured every step. Arrows show v and a on the circle and their shadows on the cart.
   opts: {T, A, turns, locked}. sim.play() -> Promise. setParam: T, locked, arrows. getState().maxGap */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch08;

  PHY.sims.circleShadow = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ T: 4, A: 1.5, turns: 2, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -3.1, xMax: 3.1, yMin: -0.5, yMax: 6.15 }, aspect: 1, minHeight: 380, maxHeight: 560 });
    const CY = 3.85, TRACK = 1.2, FLOOR = 0;
    const S = { T: opts.T, A: opts.A, t: 0, x: opts.A, v: 0, phase: 'ready', maxGap: 0, turns: 0, caption: '', resolve: null, locked: opts.locked, arrows: true, limit: opts.turns };

    const w = () => (2 * Math.PI) / S.T;
    const theta = () => w() * S.t;
    const shadowX = () => S.A * Math.cos(theta());

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function clear() { S.t = 0; S.x = S.A; S.v = 0; S.maxGap = 0; S.turns = 0; S.caption = ''; }

    function step(dt) {
      if (S.phase !== 'run') return;
      const om = w();
      const n = K.verlet(S.x, S.v, function (x) { return -om * om * x; }, dt);
      S.x = n.x; S.v = n.v;
      S.t += dt;
      S.maxGap = Math.max(S.maxGap, Math.abs(S.x - shadowX()));
      S.turns = S.t / S.T;
      if (S.turns >= S.limit) {
        S.phase = 'done';
        S.caption = 'שתי הקפות, שתי תנודות, ואף פעם לא נפרדו';
        if (!S.locked) runBtn.disabled = false;
        settle();
      }
    }

    function render() {
      const r = view.visible;
      const s = view.scale;
      const small = view.w < 420;
      view.clear();
      const th = theta();
      const cx = S.A * Math.cos(th), cy = CY + S.A * Math.sin(th);
      const sx = shadowX();

      /* The lamp and its light, straight down. */
      const lampY = CY + S.A + 0.42;
      view.poly([{ x: cx - 0.2, y: lampY }, { x: cx + 0.2, y: lampY }, { x: cx + 0.2, y: TRACK }, { x: cx - 0.2, y: TRACK }], { fill: C.glow, close: true });
      for (let i = -3; i <= 3; i++) view.circle(i * 0.5, lampY + 0.05, 3, { px: true, fill: C.gold });
      view.line(r.xMin, lampY + 0.05, r.xMax, lampY + 0.05, { color: C.gold, width: 2 });
      view.text(r.xMax, lampY + 0.05, 'מנורה', { size: 12, weight: 700, align: 'right', offset: [-6, 12], halo: true });

      /* The turntable, seen from above, with spokes that show the rotation. */
      view.circle(0, CY, S.A + 0.3, { fill: C.grid, color: C.axis, width: 2 });
      for (let i = 0; i < 6; i++) {
        const a = th + (i * Math.PI) / 3;
        view.line(0, CY, (S.A + 0.3) * Math.cos(a), CY + (S.A + 0.3) * Math.sin(a), { color: C.gridStrong, width: 1.5 });
      }
      view.circle(0, CY, S.A, { color: C.soft, width: 1.5, dash: [4, 5] });
      view.circle(0, CY, 4, { px: true, fill: C.ink });
      view.line(0, CY, cx, cy, { color: C.ink, width: 1.6, dash: [3, 4] });

      /* The wall strip with the shadow. */
      view.poly([{ x: r.xMin, y: TRACK - 0.16 }, { x: r.xMax, y: TRACK - 0.16 }, { x: r.xMax, y: TRACK + 0.16 }, { x: r.xMin, y: TRACK + 0.16 }], { fill: C.grid, close: true });
      view.text(r.xMin, TRACK, 'קיר', { size: 12, weight: 700, align: 'left', offset: [6, 0], color: C.soft });
      view.circle(sx, TRACK, 0.15, { fill: C.ink, alpha: 0.55 });
      [-S.A, S.A].forEach(function (q) { view.line(q, FLOOR, q, TRACK + 0.2, { color: C.gridStrong, width: 1.4, dash: [4, 5] }); });

      /* The spring and cart. */
      const wallX = -2.85;
      K.wall(view, wallX, FLOOR, 0.82);
      K.floor(view, FLOOR);
      const deck = 16 / s;
      K.spring(view, wallX, deck * 0.72, S.x - 23 / s, deck * 0.72, { amp: 6.5, coils: 9 });
      view.line(0, -0.05, 0, 0.18, { color: C.soft, width: 2 });
      view.text(0, FLOOR, 'בית', { size: 12, weight: 700, color: C.soft, offset: [0, 13], halo: true });
      K.cart(view, S.x, FLOOR, { catPx: small ? 38 : 44, pose: S.phase === 'run' ? 'happy' : 'standing' });

      /* The line that ties the three together. */
      view.line(cx, cy, cx, TRACK, { color: C.soft, width: 2, dash: [6, 5] });
      view.line(sx, TRACK, S.x, 0.75, { color: C.soft, width: 2, dash: [6, 5] });

      /* The cat on the rim, and his arrows and their shadows. */
      PHY.mascot.draw(view, cx, cy, { pose: 'standing', px: small ? 38 : 46, anchor: [0.5, 0.5] });
      if (S.arrows) {
        const om = w();
        const vs = 0.42, as = 0.26;
        const vx = -S.A * om * Math.sin(th), vy = S.A * om * Math.cos(th);
        const ax = -S.A * om * om * Math.cos(th), ay = -S.A * om * om * Math.sin(th);
        view.arrow(cx, cy, cx + vx * vs, cy + vy * vs, { color: C.velocity, width: 3.2, label: 'v', labelGap: 12 });
        view.arrow(cx, cy, cx + ax * as, cy + ay * as, { color: C.acceleration, width: 3.2, label: 'a', labelGap: 12 });
        view.arrow(sx, TRACK + 0.62, sx + vx * vs, TRACK + 0.62, { color: C.velocity, width: 2.8, head: 10 });
        view.arrow(sx, TRACK + 0.32, sx + ax * as, TRACK + 0.32, { color: C.acceleration, width: 2.8, head: 10 });
      }

      if (S.caption) view.screenText(view.w / 2, 16, S.caption, { size: small ? 12 : 13.5, weight: 700, pill: true });
      out.set('t', F.unit(S.t, 's', 2));
      out.set('s', F.unit(sx, 'm', 2));
      out.set('x', F.unit(S.x, 'm', 2));
      out.set('g', F.unit(Math.abs(S.x - sx), 'm', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const slider = U.Slider(controlsEl, {
      label: 'זמן הקפה T', min: 2, max: 8, step: 0.5, value: S.T, unit: 's', digits: 1,
      onInput(v) { settle(); S.T = v; S.phase = 'ready'; clear(); if (!S.locked) runBtn.disabled = false; loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const runBtn = U.Button(row, 'סיבוב נוסף', function () { if (!S.locked) launch(); }, { primary: true });
    const arrowToggle = U.Toggle(row, 'חיצים', { value: true, onChange(v) { S.arrows = v; loop.requestRender(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 's', label: 'מיקום הצל', color: 'var(--c-displacement)' },
      { key: 'x', label: 'מיקום הקרונית', color: 'var(--c-displacement)' },
      { key: 'g', label: 'הפער ביניהם' },
    ]);

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      runBtn.disabled = v;
    }
    function launch() {
      settle();
      clear();
      S.phase = 'run';
      if (!S.locked) runBtn.disabled = true;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { settle(); S.phase = 'ready'; clear(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'arrows') { S.arrows = !!v; arrowToggle.set(!!v); loop.requestRender(); return; }
        if (name === 'T') { S.T = v; slider.set(v); clear(); S.phase = 'ready'; loop.requestRender(); }
      },
      getState() {
        const om = w(), th = theta();
        return {
          t: S.t, phase: S.phase, maxGap: S.maxGap, x: S.x, v: S.v, shadow: shadowX(), omega: om, T: S.T, A: S.A,
          shadowV: -S.A * om * Math.sin(th), shadowA: -S.A * om * om * Math.cos(th),
        };
      },
    };
  };
})();

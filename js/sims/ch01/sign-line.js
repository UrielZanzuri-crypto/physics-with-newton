/* PHY.sims.signLine: two cats on a number line. Trap: "negative velocity means slowing down".
   v = +3 m/s versus v = −6 m/s: the minus only says which way. sim.play() -> Promise. Velocity is blue. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt;
  const C = PHY.colors;

  PHY.sims.signLine = function (canvasEl, controlsEl) {
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -15.5, xMax: 15.5, yMin: -4, yMax: 4 },
      aspect: 2.4,
      minHeight: 210,
      maxHeight: 340,
    });
    const CATS = [
      { v: 3, x: 0 },   // ניוטון א
      { v: -6, x: 0 },  // ניוטון ב
    ];
    let running = false, t = 0, resolve = null, clock = 0;
    const out = PHY.ui.Readouts(controlsEl, [
      { key: 'a', label: 'ניוטון א: מיקום', color: 'var(--c-displacement)' },
      { key: 'b', label: 'ניוטון ב: מיקום', color: 'var(--c-displacement)' },
      { key: 't', label: 'זמן' },
    ]);
    const T_END = 2;

    function update() {
      out.set('a', F.unit(CATS[0].x, 'm', 1));
      out.set('b', F.unit(CATS[1].x, 'm', 1));
      out.set('t', F.unit(t, 's', 1));
    }
    function step(dt) {
      clock += dt;
      if (!running) return;
      const d = Math.min(dt, T_END - t);
      t += d;
      CATS.forEach(function (c) { c.x += c.v * d; });
      update();
      if (t >= T_END - 1e-6) {
        running = false;
        if (resolve) { resolve(); resolve = null; }
      }
    }
    function render() {
      view.clear();
      const r = view.visible;
      const narrow = view.w < 420;
      const catPx = narrow ? 34 : 42;
      CATS.forEach(function (c, i) {
        /* Rows are placed in pixels, so they stay apart however small the scale gets. */
        const y = view.toWorld(0, view.h * (i === 0 ? 0.42 : 0.87)).y;
        view.line(r.xMin, y, r.xMax, y, { color: C.gridStrong, width: 2 });
        for (let t = -15; t <= 15; t += 3) {
          view.line(t, y - 4 / view.scale, t, y + 4 / view.scale, { color: C.axis, width: 1.5 });
          view.text(t, y, F.num(t), { size: narrow ? 10 : 11, color: C.soft, offset: [0, 13] });
        }
        const tip = c.x + c.v * 0.45;
        PHY.mascot.draw(view, c.x, y, { pose: running ? 'sliding' : 'standing', px: catPx, flipX: c.v < 0 });
        const ay = y + (catPx + 8) / view.scale;
        view.arrow(c.x, ay, tip, ay, { color: C.velocity, width: 4 });
        /* The label is clamped so it never leaves the canvas, even at the far ends of the line. */
        const half = 42 / view.scale;
        const lx = Math.max(r.xMin + half, Math.min(r.xMax - half, (c.x + tip) / 2));
        view.text(lx, ay, 'v = ' + F.unit(c.v, 'ms', 0), { color: C.velocity, weight: 700, size: 12.5, offset: [0, -13], halo: true });
      });
    }
    const loop = PHY.SimLoop({ view, step, render });
    update();
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        running = false;
        t = 0;
        CATS.forEach(function (c) { c.x = 0; });
        update();
        loop.requestRender();
      },
      setParam() {},
      getState() { return { a: CATS[0].x, b: CATS[1].x, t }; },
      play() {
        this.reset();
        running = true;
        return new Promise(function (res) { resolve = res; });
      },
    };
  };
})();

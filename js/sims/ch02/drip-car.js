/* PHY.sims.dripCar: two cars drip a drop of oil once a second. One keeps a steady 5 m/s, the other
   changes its speed by a fixed amount each second. The gaps between the drops show acceleration on
   the road itself. A v-t graph underneath shows the same thing as a slope.
   scenarios: 'gas' (v0 = 0, a = +2), 'brake' (v0 = 10, a = −2). sim.play() -> Promise.
   setParam('scenario', name). getState(): {t, x, v, a, drops: [{t, x}]}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const T_END = 5;
  const SCEN = {
    gas: { v0: 0, a: 2 },
    brake: { v0: 10, a: -2 },
  };
  const STEADY = 5;

  PHY.sims.dripCar = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ scenario: 'gas', showButtons: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.7, minHeight: 360, maxHeight: 420 });
    const P = H2.pix(view);
    const plot = H2.Plot(view, { title: 'מהירות v (מ/ש)', titleColor: 'velocity', tMax: T_END, tTick: 1, yMin: 0, yMax: 10, yTick: 2 });
    const S = { sc: opts.scenario, t: 0, running: false, resolve: null };

    const sc = () => SCEN[S.sc];
    const xOf = (t) => sc().v0 * t + 0.5 * sc().a * t * t;
    const vOf = (t) => sc().v0 + sc().a * t;

    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'v', label: 'מהירות המכונית השנייה', color: 'var(--c-velocity)' },
      { key: 'a', label: 'כמה מהירות נוספת כל שנייה', color: 'var(--c-acceleration)' },
    ]);
    let row = null;
    if (opts.showButtons) {
      row = U.h('div', { class: 'sim-row' });
      U.Button(row, 'מאיצה', function () { choose('gas'); });
      U.Button(row, 'בולמת', function () { choose('brake'); });
      controlsEl.appendChild(row);
      row.hidden = true;
    }
    function choose(name) { S.sc = name; api.play(); }

    function update() {
      out.set('t', F.unit(S.t, 's', 1));
      out.set('v', F.unit(vOf(S.t), 'ms', 1));
      out.set('a', (sc().a > 0 ? '+' : '') + F.unit(sc().a, 'מ/ש בכל שנייה', 0));
    }
    function step(dt) {
      if (!S.running) return;
      S.t = Math.min(T_END, S.t + dt);
      update();
      if (S.t >= T_END - 1e-9) {
        S.running = false;
        if (row) row.hidden = false;
        if (S.resolve) { S.resolve(); S.resolve = null; }
      }
    }

    function lane(y, label, xAt, showGaps, flipColor) {
      const W = view.w, m = 26;
      const X = (x) => m + (x / 27) * (W - 2 * m);
      P.line(m - 12, y, W - m + 12, y, { color: C.gridStrong, width: 4 });
      view.screenText(W - 6, y - 30, label, { size: 12, weight: 700, color: C.soft, align: 'right' });
      /* drops at every whole second, including t = 0 */
      const n = Math.floor(S.t + 1e-9);
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const px = X(xAt(i));
        P.circle(px, y + 8, 4.5, { fill: C.ink });
        if (prev !== null && showGaps && S.t >= i && px - prev > 15) {
          view.screenText((px + prev) / 2, y + 20, F.num(xAt(i) - xAt(i - 1), 0), { size: 11.5, weight: 700, color: C.displacement });
        }
        prev = px;
      }
      H2.drawCar(view, X(xAt(S.t)), y - 2, { w: 40, alpha: flipColor ? 0.65 : 1 });
    }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      lane(48, 'מהירות קבועה: ' + F.unit(STEADY, 'ms', 0), (t) => STEADY * t, true, true);
      lane(110, S.sc === 'gas' ? 'לוחצת על הגז' : 'לוחצת על הבלם', xOf, true, false);
      view.screenText(W / 2, 145, "המספרים הם המרווחים בין הטיפות, במטרים", { size: 11, color: C.soft });

      plot.box(0, 152, W, Hh - 152);
      plot.frame();
      plot.curve([{ t: 0, y: STEADY }, { t: S.t, y: STEADY }], { color: C.soft, width: 2, dash: [5, 4] });
      plot.curve([{ t: 0, y: vOf(0) }, { t: S.t, y: vOf(S.t) }], { color: C.velocity, width: 3 });
      /* Stairs: each second the speed gains the same amount. */
      if (S.t >= 1) {
        for (let i = 1; i <= Math.floor(S.t + 1e-9); i++) {
          plot.curve([{ t: i - 1, y: vOf(i - 1) }, { t: i, y: vOf(i - 1) }], { color: C.acceleration, width: 1.5, dash: [3, 3] });
          plot.curve([{ t: i, y: vOf(i - 1) }, { t: i, y: vOf(i) }], { color: C.acceleration, width: 2.5 });
        }
      }
      plot.dot(S.t, vOf(S.t), { color: C.velocity });
    }

    const loop = PHY.SimLoop({ view, step, render });
    update();
    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() { S.t = 0; S.running = false; update(); loop.requestRender(); },
      setParam(name, v) { if (name === 'scenario') { S.sc = v; api.reset(); } },
      getState() {
        const drops = [];
        for (let i = 0; i <= Math.floor(S.t + 1e-9); i++) drops.push({ t: i, x: xOf(i) });
        return { t: S.t, x: xOf(S.t), v: vOf(S.t), a: sc().a, scenario: S.sc, drops };
      },
      play() {
        api.reset();
        S.running = true;
        return new Promise(function (res) { S.resolve = res; });
      },
    };
    return api;
  };
})();

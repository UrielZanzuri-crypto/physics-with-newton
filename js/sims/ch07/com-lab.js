/* PHY.sims.comLab: three masses on a light rod. Drag them along the rod and change their sizes.
   A wedge under the rod sits at the center of mass, computed from x_cm = sum(m x) / sum(m): that is the balance point.
   opts: {masses: [..], xs: [..]}. setParam: m0, m1, m2, x0, x1, x2. getState(): xCm, sumM, sumMx. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, V = PHY.vec;
  const RY = 2.1;

  PHY.sims.comLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ masses: [2, 3, 5], xs: [1, 4, 8] }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -0.8, xMax: 10.8, yMin: -0.4, yMax: 4.4 }, aspect: 2.1, minHeight: 210, maxHeight: 340 });
    const S = { m: opts.masses.slice(), x: opts.xs.slice(), caption: '' };

    function comX() {
      let a = 0, b = 0;
      S.m.forEach(function (m, i) { a += m * S.x[i]; b += m; });
      return { xCm: a / b, sumMx: a, sumM: b };
    }
    const LABELS = ['מסה שמאלית', 'מסה אמצעית', 'מסה ימנית'];
    const sliders = S.m.map(function (m, i) {
      return U.Slider(controlsEl, {
        label: LABELS[i], min: 1, max: 10, step: 1, value: m, unit: 'kg', digits: 0, color: 'var(--accent)',
        onInput(v) { S.m[i] = v; paint(); },
      });
    });
    const line = U.h('div', { class: 'small', dir: 'ltr', style: 'text-align:center;font-weight:600' });
    controlsEl.appendChild(line);
    const out = U.Readouts(controlsEl, [
      { key: 'x', label: 'מרכז המסה', color: 'var(--c-displacement)' },
      { key: 'm', label: 'מסה כוללת' },
    ]);
    function paint() {
      const c = comX();
      line.textContent = '(' + S.m.map(function (m, i) { return m + '·' + F.num(S.x[i], 1); }).join(' + ') + ') / ' + c.sumM + ' = ' + F.num(c.xCm, 2);
      out.set('x', F.unit(c.xCm, 'm', 2));
      out.set('m', F.unit(c.sumM, 'kg', 0));
      loop.requestRender();
    }

    function ballR(m) { return (view.w < 420 ? 9 : 12) * Math.cbrt(m); }

    function render() {
      view.clear();
      view.grid(1);
      const c = comX();
      /* Ruler */
      for (let i = 0; i <= 10; i += 1) {
        view.line(i, RY - 0.1, i, RY + 0.1, { color: C.axis, width: 1.4 });
        view.text(i, 0.05, F.num(i), { size: 11, color: C.soft });
      }
      view.text(10.45, 0.05, "מ'", { size: 11, color: C.soft });
      /* Rod */
      view.line(0, RY, 10, RY, { color: C.axis, width: 5 });
      /* Masses hang on the rod */
      S.m.forEach(function (m, i) {
        const R = ballR(m);
        view.circle(S.x[i], RY, R, { px: true, fill: C.accent, color: C.ink, width: 2 });
        view.text(S.x[i], RY, F.unit(m, 'kg', 0), { size: 11.5, weight: 700, offset: [0, -R - 11], halo: true });
      });
      /* Wedge at the center of mass */
      const px = view.sx(c.xCm), py = view.sy(RY) + 5;
      const P = PHY.ch02.pix(view);
      P.poly([{ x: px, y: py }, { x: px - 18, y: py + 34 }, { x: px + 18, y: py + 34 }], { fill: C.gold, color: C.ink, width: 2, close: true });
      const leftSide = c.xCm > 7;
      view.text(c.xCm, RY, F.unit(c.xCm, 'm', 2), { size: 12, weight: 700, color: C.displacement, offset: [leftSide ? -44 : 44, 26], halo: true });
      K.caption(view, 'לגרור כל מסה לאורך המוט', 16);
    }
    const loop = PHY.SimLoop({ view, render });

    view.drag({
      hit(p) {
        let best = null, bestD = 30;
        S.x.forEach(function (x, i) {
          const d = view.pxDist(p, V.v(x, RY));
          if (d < bestD) { bestD = d; best = { i: i }; }
        });
        return best;
      },
      move(h, p) {
        S.x[h.i] = Math.max(0, Math.min(10, Math.round(p.x * 2) / 2));
        paint();
      },
    });

    paint();
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { S.m = opts.masses.slice(); S.x = opts.xs.slice(); sliders.forEach(function (s, i) { s.set(S.m[i]); }); paint(); },
      setParam(name, v) {
        const k = name.charAt(0), i = +name.slice(1);
        if (k === 'm') { S.m[i] = v; sliders[i].set(v); }
        if (k === 'x') S.x[i] = v;
        paint();
      },
      getState() { return comX(); },
    };
  };
})();

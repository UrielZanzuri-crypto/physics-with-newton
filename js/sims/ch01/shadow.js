/* PHY.sims.shadow: הצל. A vector lit by a lamp from above (shadow on x) and a lamp from the side
   (shadow on y). The shadows ARE the components, so cos/sin show up as "shadow ratios".
   Drag the tip or use the sliders. opts: {length, angle, locked, angleMax, onChange(state)}
   sim.animateTo({angle, length}, seconds) -> Promise. setParam: length, angle, halfMark, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const V = PHY.vec, F = PHY.fmt, U = PHY.ui;
  const C = PHY.colors;

  PHY.sims.shadow = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ length: 5, angle: 0, angleMax: 90, locked: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -1.6, xMax: 10, yMin: -1.5, yMax: 9.2 },
      aspect: 1.25,
      minHeight: 290,
      maxHeight: 470,
    });
    const S = { L: opts.length, a: opts.angle, half: false, locked: opts.locked, tw: null, t: 0 };

    const lenSlider = U.Slider(controlsEl, {
      label: 'אורך החץ', min: 1, max: 8, step: 0.1, value: S.L, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.L = v; changed(); },
    });
    const angSlider = U.Slider(controlsEl, {
      label: 'הזווית מהרצפה', min: 0, max: opts.angleMax, step: 1, value: S.a, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; changed(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'sx', label: 'הצל על הרצפה (x)', color: 'var(--c-displacement)' },
      { key: 'sy', label: 'הצל על הקיר (y)', color: 'var(--c-displacement)' },
      { key: 'rx', label: 'יחס צל x: צל חלקי חץ' },
      { key: 'ry', label: 'יחס צל y: צל חלקי חץ' },
    ]);

    function comps() { return V.polar(S.L, S.a); }
    function changed() {
      const c = comps();
      out.set('sx', F.unit(c.x, 'm', 2));
      out.set('sy', F.unit(c.y, 'm', 2));
      out.set('rx', F.num(c.x / S.L, 2));
      out.set('ry', F.num(c.y / S.L, 2));
      loop.requestRender();
      if (opts.onChange) opts.onChange(api.getState());
    }

    function setLocked(v) {
      S.locked = v;
      lenSlider.setEnabled(!v);
      angSlider.setEnabled(!v);
    }

    function step(dt) {
      S.t += dt;
      if (S.tw) {
        const tw = S.tw;
        tw.t += dt;
        const k = Math.min(tw.t / tw.T, 1);
        const e = k * k * (3 - 2 * k);
        S.a = tw.a0 + (tw.a1 - tw.a0) * e;
        S.L = tw.L0 + (tw.L1 - tw.L0) * e;
        lenSlider.set(S.L);
        angSlider.set(Math.round(S.a));
        changed();
        if (k >= 1) {
          S.tw = null;
          tw.resolve();
        }
      }
    }

    function render() {
      const c = comps();
      const r = view.visible;
      view.clear();
      view.grid(1, { majorEvery: 5 });

      const ax = c.x, ay = c.y;
      /* Light above the arrow (lamp on top) and to its right (lamp on the side). */
      view.poly([{ x: 0, y: ay }, { x: ax, y: ay }, { x: ax, y: r.yMax }, { x: 0, y: r.yMax }], { fill: C.glow, close: true });
      view.poly([{ x: ax, y: 0 }, { x: r.xMax, y: 0 }, { x: r.xMax, y: ay }, { x: ax, y: ay }], { fill: C.glow, close: true });
      /* The dark triangles the arrow casts. */
      view.poly([{ x: 0, y: 0 }, { x: ax, y: ay }, { x: ax, y: 0 }], { fill: C.shade, close: true });
      view.poly([{ x: 0, y: 0 }, { x: ax, y: ay }, { x: 0, y: ay }], { fill: C.shade, close: true });

      view.axes({ xLabel: 'x', yLabel: 'y', tickEvery: 1 });

      if (ax > 0.02) view.line(ax, 0, ax, ay, { color: C.soft, width: 1.5, dash: [5, 5] });
      if (ay > 0.02) view.line(0, ay, ax, ay, { color: C.soft, width: 1.5, dash: [5, 5] });

      /* The shadows on the axes: the components. */
      view.line(0, 0, ax, 0, { color: C.displacement, width: 8, alpha: 0.55, cap: 'butt' });
      view.line(0, 0, 0, ay, { color: C.displacement, width: 8, alpha: 0.55, cap: 'butt' });
      if (ax > 0.7) view.text(ax / 2, 0, F.unit(ax, 'm', 2), { color: C.displacement, weight: 700, size: 13.5, offset: [0, 17], halo: true });
      if (ay > 0.5) view.text(0, ay / 2, F.unit(ay, 'm', 2), { color: C.displacement, weight: 700, size: 13.5, offset: [-4, 0], align: 'right', halo: true });

      if (S.half) {
        const hx = S.L / 2;
        view.line(hx, -0.35, hx, 0.45, { color: C.apple, width: 3 });
        view.text(hx, 0, 'כאן החצי', { color: C.apple, weight: 700, size: 12.5, offset: [0, 34], halo: true });
      }

      /* Lamps */
      drawLamp(ax / 2, r.yMax - 0.35, 'down');
      drawLamp(r.xMax - 0.35, Math.max(ay / 2, 0.4), 'left');

      /* The arrow */
      const rad = Math.min(46, S.L * view.scale * 0.45);
      if (S.a > 1) {
        view.arc(0, 0, rad, 0, S.a, { color: C.accent, width: 2.5 });
        const mid = V.polar((rad + 15) / view.scale, S.a / 2);
        view.text(mid.x, mid.y, F.deg(S.a), { color: C.accent, weight: 700, size: 12.5, halo: true });
      }
      view.arrow(0, 0, ax, ay, { color: C.displacement, width: 5.5 });
      view.circle(ax, ay, 9 + (S.locked ? 0 : Math.sin(S.t * 4)), { px: true, fill: C.surface, color: C.displacement, width: 3 });
      PHY.mascot.draw(view, 8.6, 0.02, { pose: 'thinking', px: view.w < 420 ? 42 : 56 });
    }

    function drawLamp(x, y, dir) {
      const ctx = view.ctx;
      const px = view.sx(x), py = view.sy(y);
      ctx.save();
      ctx.translate(px, py);
      if (dir === 'left') ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#FFC83D';
      ctx.strokeStyle = '#3B2A20';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(11, 3); ctx.lineTo(-11, 3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    const loop = PHY.SimLoop({ view, step, render });

    view.drag({
      hit(p) {
        if (S.locked || S.tw) return null;
        return view.pxDist(p, comps()) < 32 ? 'tip' : null;
      },
      move(_, p) {
        const a = Math.max(0, Math.min(opts.angleMax, Math.round(V.angle(p) > 270 ? 0 : V.angle(p))));
        const L = Math.max(1, Math.min(8, Math.round(V.len(p) * 10) / 10));
        S.a = a;
        S.L = L;
        lenSlider.set(L);
        angSlider.set(a);
        changed();
      },
    });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        S.tw = null;
        S.L = opts.length;
        S.a = opts.angle;
        S.half = false;
        lenSlider.set(S.L);
        angSlider.set(S.a);
        changed();
      },
      setParam(name, v) {
        if (name === 'length') { S.L = v; lenSlider.set(v); }
        if (name === 'angle') { S.a = v; angSlider.set(v); }
        if (name === 'halfMark') S.half = !!v;
        if (name === 'locked') setLocked(!!v);
        changed();
      },
      getState() {
        const c = comps();
        return { length: S.L, angle: S.a, ax: c.x, ay: c.y, ratioX: c.x / S.L, ratioY: c.y / S.L };
      },
      animateTo(target, T) {
        return new Promise(function (resolve) {
          S.tw = { t: 0, T: T || 1.5, a0: S.a, a1: target.angle === undefined ? S.a : target.angle, L0: S.L, L1: target.length === undefined ? S.L : target.length, resolve };
        });
      },
    };
    setLocked(S.locked);
    changed();
    return api;
  };
})();

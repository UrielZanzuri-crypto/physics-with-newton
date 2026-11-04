/* PHY.sims.cableBeam: horizontal beam on a wall hinge, held by a cable from its end, a load hanging from it.
   T, H and V come from the balance conditions (PHY.statics.cableForces). The cable breaks past a limit,
   and then the beam turns about the hinge with the real equation until it hits the floor.
   The graph of T against the cable angle is drawn from the same function that labels the arrow.
   opts: {deg, m, M, L, x, limit, locked}. sim.lower(toDeg, T) -> Promise: slides the wall anchor down.
   setParam: deg, M, x, locked. getState(): T, H, V, snapped. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  PHY.sims.cableBeam = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({ deg: 55, m: 10, M: 20, L: 2, x: 2, limit: 1000, y0: 2.4, hang: 0.8, crate: 0.55, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -0.65, xMax: 5.25, yMin: -0.25, yMax: 5.5 }, aspect: 1.2, minHeight: 330, maxHeight: 480,
    });
    const tw = B.tweens();
    const S = { runFrom: null, deg: o.deg, M: o.M, x: o.x, snapped: false, beta: 0, om: 0, phase: 'stand', caption: '', pose: 'standing', resolve: null, locked: o.locked, catDown: false };
    const forces = (deg) => St.cableForces({ deg: deg === undefined ? S.deg : deg, m: o.m, M: S.M, L: o.L, x: S.x });

    function finish() { const r = S.resolve; S.resolve = null; if (r) r(); }
    /* The angles the graph may show. While locked it only traces the run, so the curve cannot answer the card. */
    function curveSpan() {
      if (!S.locked) return { from: 6, to: 90 };
      return S.runFrom === null ? null : { from: S.deg, to: S.runFrom };
    }
    function snap() {
      S.snapped = true;
      S.phase = 'fall';
      S.pose = 'falling';
      S.caption = 'הכבל נקרע!';
    }
    function step(dt) {
      tw.step(dt);
      if (S.phase === 'stand' && !S.snapped && forces().T > o.limit) snap();
      if (S.phase === 'fall') {
        const I = (o.m * o.L * o.L) / 3 + S.M * S.x * S.x;
        const tau = -((o.m * G * o.L) / 2 + S.M * G * S.x) * Math.cos(S.beta * RAD);
        S.om += (tau / I) * dt;
        S.beta += (S.om * dt) / RAD;
        /* The beam stops when the crate reaches the floor. */
        const stop = -Math.asin(Math.min(1, (o.y0 - o.hang - o.crate) / S.x)) / RAD;
        if (S.beta <= stop) {
          S.beta = stop;
          S.om = 0;
          S.phase = 'down';
          S.pose = 'standing';
          S.catDown = true;
          S.caption = 'על הרגליים. תמיד על הרגליים.';
          finish();
        }
      }
    }
    function restore() {
      finish();
      tw.clear();
      S.snapped = false; S.beta = 0; S.om = 0; S.phase = 'stand'; S.caption = ''; S.pose = 'standing'; S.catDown = false; S.runFrom = null;
    }
    /* Slides the anchor down at a steady rate. If the cable breaks on the way, waits for the landing. */
    function lower(to, T) {
      restore();
      const from = S.deg;
      S.runFrom = from;
      return tw.add(T, function (k) {
        if (S.snapped) return;
        S.deg = from + (to - from) * k;
        sAngle.set(Math.round(S.deg));
      }).then(function () {
        if (S.phase === 'stand') return null;
        return new Promise(function (res) {
          if (S.phase === 'down') { res(); return; }
          S.resolve = res;
        });
      });
    }

    function drawHinge(y0, small) {
      view.circle(0, y0, small ? 6 : 8, { px: true, fill: C.surface, color: C.ink, width: 2.5 });
    }

    function render() {
      const small = view.w < 520, r = view.visible;
      const W = view.w, y0 = o.y0;
      view.clear();
      view.grid(1, {});
      B.drawGround(view, 0, {});
      St.hatch(view, 0, 0, 0, r.yMax, -1, 0, {});
      const a = S.beta * RAD;
      const P = (s) => ({ x: s * Math.cos(a), y: y0 + s * Math.sin(a) });
      const end = P(o.L), load = P(S.x);
      const anchorY = y0 + o.L * Math.tan(S.deg * RAD);
      const f = forces();
      const k = (small ? 0.15 : 0.22) / view.scale;  /* meters per newton on screen */
      const size = small ? 11 : 13;

      /* graph of T against the cable angle */
      const gw = small ? Math.min(176, W * 0.52) : 280, gh = small ? 126 : 176;
      const gx = W - gw - 6, gy = 6;
      const plot = PHY.ch02.Plot(view, { tMin: 0, tMax: 90, yMin: 0, yMax: 1500, title: 'T (ניוטון)', tLabel: 'זווית', tTick: 30, yTick: 500, compact: small });
      plot.box(gx, gy, gw, gh);
      const G0 = view.toWorld(gx, gy), G1 = view.toWorld(gx + gw, gy + gh);
      view.poly([{ x: G0.x, y: G0.y }, { x: G1.x, y: G0.y }, { x: G1.x, y: G1.y }, { x: G0.x, y: G1.y }], { fill: C.bg, alpha: 0.86, close: true });
      plot.frame();
      const span = curveSpan();
      if (span) {
        const pts = [{ t: span.from, y: forces(span.from).T }];
        for (let d = Math.ceil(span.from) + 1; d < span.to; d += 1) pts.push({ t: d, y: forces(d).T });
        pts.push({ t: span.to, y: forces(span.to).T });
        plot.curve(pts, { color: C.force, width: 2.6 });
      }
      plot.hline(o.limit, { color: C.bad });
      plot.text(62, o.limit + (small ? 120 : 90), 'הגבול של הכבל', { size: small ? 9.5 : 11, color: C.bad, weight: 700 });
      if (!S.snapped) plot.dot(S.deg, Math.min(f.T, 1500), { color: C.force });


      /* cable */
      if (!S.snapped) {
        view.line(0, anchorY, end.x, end.y, { color: f.T > o.limit * 0.8 ? C.bad : C.ink, width: 2.6 });
      } else {
        view.line(0, anchorY, 0.4, anchorY - 0.5, { color: C.bad, width: 2.4 });
        view.line(end.x, end.y, end.x - 0.3, end.y + 0.3, { color: C.bad, width: 2.4 });
      }
      view.circle(0, anchorY, 4.5, { px: true, fill: C.ink });

      /* the angle */
      if (!S.snapped) {
        view.line(end.x, end.y, end.x - 0.9, end.y, { color: C.soft, width: 1.5, dash: [4, 4] });
        const rA = small ? 34 : 46;
        view.arc(end.x, end.y, rA, 180 - S.deg, 180, { color: C.accent, width: 2.4 });
        const mid = (180 - S.deg / 2) * RAD;
        view.text(end.x, end.y, F.deg(S.deg, 0), { size: size + 1, weight: 800, color: C.accent, halo: true, offset: [(rA + 19) * Math.cos(mid), -(rA + 19) * Math.sin(mid) - (S.deg < 25 ? 7 : 0)] });
      }

      /* beam */
      St.plank(view, 0, y0, end.x, end.y, small ? 8 : 10, { fill: C.accent });
      drawHinge(y0, small);

      /* the load: a crate on a rope, Newton in it */
      const crateH = o.crate * view.scale;
      const crateTop = load.y - o.hang;
      view.line(load.x, load.y, load.x, crateTop, { color: C.ink, width: 2 });
      const cy = crateTop - o.crate;
      const catH = small ? 42 : 62;
      if (!S.catDown) PHY.mascot.draw(view, load.x, cy + (crateH * 0.55) / view.scale, { pose: S.pose, px: catH, rot: 0, anchor: S.pose === 'falling' ? [0.5, 0.8] : undefined });
      St.block(view, load.x, cy, 0.72 * view.scale, crateH, 0, { fill: C.gold, slats: true, label: F.unit(S.M, 'kg', 0), labelSize: small ? 10.5 : 12.5 });
      if (S.catDown) PHY.mascot.draw(view, Math.min(load.x + 0.75, r.xMax - 0.3), 0, { pose: 'standing', px: catH });

      if (!S.snapped) {
        const lab = (v) => F.unit(v, 'N', 0);
        /* tension at the end, along the cable */
        const c = Math.cos(S.deg * RAD), sn = Math.sin(S.deg * RAD);
        const Tlen = Math.min(f.T * k, 2.4);
        view.arrow(end.x, end.y, end.x - Tlen * c, end.y + Tlen * sn, { color: C.force, width: 4, head: 14 });
        const tx = Math.max(end.x - Tlen * c, (small ? 54 : 70) / view.scale);
        view.text(tx, end.y + Tlen * sn, 'T = ' + lab(f.T), { size: size + 1, weight: 800, color: C.force, halo: true, offset: [0, -12] });
        /* hinge forces */
        view.arrow(0, y0, f.H * k, y0, { color: C.force, width: 3, head: 11, alpha: 0.9 });
        /* Stops short of the beam's weight arrow at the middle. */
        view.text(Math.min(f.H * k, 0.45), y0, 'H = ' + lab(f.H), { size: size, weight: 700, color: C.force, halo: true, offset: [small ? -12 : -20, small ? 15 : 18] });
        if (Math.abs(f.V) > 1) {
          view.arrow(0, y0, 0, y0 + f.V * k, { color: C.force, width: 3, head: 11, alpha: 0.9 });
          view.text(0, y0 + f.V * k, 'V = ' + lab(f.V), { size: size, weight: 700, color: C.force, halo: true, offset: [small ? 30 : 38, -6] });
        }
        /* the beam's own weight, at its middle */
        const mid = P(o.L / 2), bLen = o.m * G * k;
        view.circle(mid.x, mid.y, 3, { px: true, fill: C.ink });
        view.arrow(mid.x, mid.y, mid.x, mid.y - bLen, { color: C.force, width: 3, head: 11 });
        view.text(mid.x, mid.y - bLen, lab(o.m * G), { size: size, weight: 700, color: C.force, halo: true, offset: [0, 10] });
        /* the load's weight */
        const wLen = Math.min(S.M * G * k, 1.05);
        view.arrow(load.x + (small ? 28 : 40) / view.scale, crateTop, load.x + (small ? 28 : 40) / view.scale, crateTop - wLen, { color: C.force, width: 3, head: 11 });
        view.text(load.x + (small ? 28 : 40) / view.scale, crateTop - wLen, lab(S.M * G), { size: size, weight: 700, color: C.force, halo: true, offset: [small ? 22 : 30, 2] });
      }

      if (S.caption) view.screenText(W / 2, view.h - 16, S.caption, { size: small ? 12 : 14, weight: 700, pill: true });

      out.set('T', F.unit(f.T, 'N', 0));
      out.set('H', F.unit(f.H, 'N', 0));
      out.set('V', F.unit(f.V, 'N', 0));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const sAngle = U.Slider(controlsEl, {
      label: 'זווית הכבל מעל הקורה', min: 8, max: 55, step: 1, value: S.deg, format: (v) => St.deg(v), color: 'var(--accent)',
      onInput(v) { restore(); S.deg = v; },
    });
    const sMass = U.Slider(controlsEl, {
      label: 'המטען', min: 0, max: 40, step: 1, value: S.M, unit: 'kg', digits: 0, color: 'var(--accent)',
      onInput(v) { restore(); S.M = v; },
    });
    const sPos = U.Slider(controlsEl, {
      label: 'מרחק המטען מהציר', min: 0.5, max: 2, step: 0.1, value: S.x, unit: 'm', digits: 1, color: 'var(--accent)',
      onInput(v) { restore(); S.x = v; },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'T', label: 'המתיחות בכבל', color: 'var(--c-force)' },
      { key: 'H', label: 'הציר, אופקי', color: 'var(--c-force)' },
      { key: 'V', label: 'הציר, אנכי', color: 'var(--c-force)' },
    ]);
    function setLocked(v) {
      S.locked = !!v;
      [sAngle, sMass, sPos].forEach(function (s) { s.setEnabled(!S.locked); });
    }
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        restore();
        S.deg = o.deg; S.M = o.M; S.x = o.x;
        sAngle.set(o.deg); sMass.set(o.M); sPos.set(o.x);
        loop.requestRender();
      },
      lower,
      setParam(name, v) {
        if (name === 'locked') { setLocked(v); return; }
        if (name === 'deg') { restore(); S.deg = v; sAngle.set(v); }
        if (name === 'M') { restore(); S.M = v; sMass.set(v); }
        if (name === 'x') { restore(); S.x = v; sPos.set(v); }
        if (name === 'caption') S.caption = v;
        loop.requestRender();
      },
      getState() {
        const f = forces();
        return { deg: S.deg, T: f.T, H: f.H, V: f.V, snapped: S.snapped, phase: S.phase, beta: S.beta, limit: o.limit, curve: curveSpan() };
      },
    };
  };
})();

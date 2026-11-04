/* PHY.sims.boatWalk: the cat walks along a boat floating on calm water. No outside horizontal force acts on them,
   so the center of mass stays where it was: while the cat walks forward at speed u relative to the boat,
   the boat moves back at m u / (m + M). Integrated in step(), and dragging the cat does the same in one go.
   opts: {catMass, boatMass, walk (m along the deck)}. sim.play() -> Promise. setParam: boatMass, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, V = PHY.vec;
  const WALK_SPEED = 1.5;

  PHY.sims.boatWalk = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ catMass: 5, boatMass: 20, walk: 5, x0: 2.6 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -2.5, xMax: 9.5, yMin: -1.2, yMax: 4 }, aspect: 2.1, minHeight: 230, maxHeight: 380 });
    const BOAT_HALF = 3.4;
    const S = { s: 0, boatX: 0, phase: 'ready', caption: '', dir: 1, resolve: null, t: 0, locked: !!opts.locked };

    function catX() { return S.boatX + -opts.walk / 2 + S.s; }
    /* The boat starts at x = 0 with the cat at its left end. */
    function comOf() { return (opts.catMass * catX() + opts.boatMass * S.boatX) / (opts.catMass + opts.boatMass); }

    function clear() {
      S.s = 0;
      S.boatX = opts.x0;
      S.phase = 'ready';
      S.caption = '';
      S.dir = 1;
      S.com0 = comOf();
      S.boat0 = S.boatX;
      S.cat0 = catX();
      S.t = 0;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }

    const slider = U.Slider(controlsEl, {
      label: 'מסת הסירה', min: 5, max: 40, step: 5, value: opts.boatMass, unit: 'kg', digits: 0, color: 'var(--accent)',
      onInput(v) { opts.boatMass = v; clear(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const btn = U.Button(row, 'ניוטון, ללכת!', function () { if (!S.locked && S.phase !== 'walk') { const back = S.s >= opts.walk - 1e-6; launchWalk(back ? -1 : 1); } }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'rel', label: 'הליכה על הסירה', color: 'var(--c-displacement)' },
      { key: 'cat', label: 'החתול ביחס למים', color: 'var(--c-displacement)' },
      { key: 'boat', label: 'הסירה ביחס למים', color: 'var(--c-displacement)' },
      { key: 'com', label: 'תזוזת מרכז המסה' },
    ]);

    function launchWalk(dir) {
      S.dir = dir;
      S.phase = 'walk';
      S.caption = '';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function moveBy(ds) {
      /* The cat moves ds relative to the boat. The boat recoils so the total momentum stays 0. */
      S.s += ds;
      S.boatX += (-opts.catMass * ds) / (opts.catMass + opts.boatMass);
    }

    function step(dt) {
      if (S.phase !== 'walk') return;
      S.t += dt;
      const ds = S.dir * WALK_SPEED * dt;
      const next = S.s + ds;
      if (next >= opts.walk || next <= 0) {
        moveBy((next >= opts.walk ? opts.walk : 0) - S.s);
        S.phase = 'done';
        S.caption = 'החתול הלך, הסירה נסוגה, מרכז המסה לא זז';
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      } else moveBy(ds);
    }

    function render() {
      view.clear();
      const small = view.w < 420;
      const r = view.visible;
      const waterY = 0;
      /* Water */
      const pts = [];
      for (let x = r.xMin; x <= r.xMax + 0.3; x += 0.3) pts.push({ x: x, y: waterY + 0.05 * Math.sin(x * 2.4 + S.t * 2) });
      view.poly(pts.concat([{ x: r.xMax, y: r.yMin }, { x: r.xMin, y: r.yMin }]), { fill: C.axis, alpha: 0.14, close: true });
      view.poly(pts, { color: C.axis, width: 2, alpha: 0.45 });
      /* A fixed buoy, so it is clear what "the water" is. */
      const buoyX = r.xMax - 0.7;
      view.line(buoyX, waterY, buoyX, waterY + 0.7, { color: C.axis, width: 3 });
      view.circle(buoyX, waterY + 0.75, 6, { px: true, fill: C.apple, color: C.ink, width: 1.6 });

      /* Boat */
      const bx = S.boatX;
      const deck = 0.55;
      view.poly([
        { x: bx - BOAT_HALF, y: deck }, { x: bx + BOAT_HALF + 0.3, y: deck + 0.08 }, { x: bx + BOAT_HALF - 0.5, y: -0.35 }, { x: bx - BOAT_HALF + 0.4, y: -0.35 },
      ], { fill: C.surface, color: C.ink, width: 2.4, close: true });
      view.text(bx + 1.9, 0.1, F.unit(opts.boatMass, 'kg', 0), { size: 12, weight: 700 });

      /* Start marks: where everything was. */
      view.line(S.boat0, waterY - 0.55, S.boat0, waterY - 0.95, { color: C.displacement, width: 2 });
      if (Math.abs(S.boatX - S.boat0) > 0.03) {
        view.arrow(S.boat0, waterY - 0.75, S.boatX, waterY - 0.75, { color: C.displacement, width: 3, head: 9 });
        view.text((S.boat0 + S.boatX) / 2, waterY - 0.75, F.unit(Math.abs(S.boatX - S.boat0), 'm', 1), { size: 12, weight: 700, color: C.displacement, offset: [0, 13], halo: true });
      }
      view.line(S.boatX, waterY - 0.55, S.boatX, waterY - 0.95, { color: C.displacement, width: 2 });

      /* The cat */
      const cx = catX();
      PHY.mascot.draw(view, cx, deck + 0.04, { pose: S.phase === 'walk' ? 'happy' : 'standing', px: small ? 56 : 76, flipX: S.dir < 0 });
      view.text(cx, deck, F.unit(opts.catMass, 'kg', 0), { size: 11, weight: 700, offset: [0, small ? -66 : -88], halo: true });
      /* And how far he got, measured from the water. */
      if (Math.abs(cx - S.cat0) > 0.03) {
        const ya = deck + ((small ? 56 : 76) + 34) / view.scale;
        view.arrow(S.cat0, ya, cx, ya, { color: C.displacement, width: 3, head: 9 });
        view.text((S.cat0 + cx) / 2, ya, F.unit(Math.abs(cx - S.cat0), 'm', 1), { size: 12, weight: 700, color: C.displacement, offset: [0, -11], halo: true });
      }

      /* Center of mass line */
      const com = comOf();
      view.line(S.com0, r.yMax, S.com0, r.yMin + 26 / view.scale, { color: C.gold, width: 2.4, dash: [6, 6] });
      view.circle(com, deck * 0.5, 6.5, { px: true, fill: C.gold, color: C.ink, width: 2 });
      view.text(S.com0, r.yMin, 'מרכז המסה', { size: 11.5, weight: 700, offset: [0, -14], halo: true });
      K.caption(view, S.caption || (S.phase === 'ready' ? 'אפשר לגרור את ניוטון לאורך הסירה' : ''), 16);

      out.set('rel', F.unit(S.s, 'm', 2));
      out.set('cat', F.unit(cx - S.cat0, 'm', 2));
      out.set('boat', F.unit(S.boatX - S.boat0, 'm', 2));
      out.set('com', F.unit(com - S.com0, 'm', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });

    view.drag({
      hit(p) {
        if (S.locked || S.phase === 'walk') return null;
        const px = view.w < 420 ? 56 : 76;
        const catMid = V.v(catX(), 0.59 + (px * 0.45) / view.scale);
        return view.pxDist(p, catMid) < Math.max(30, px * 0.6) ? { grab: p.x - catX() } : null;
      },
      move(h, p) {
        /* The pointer is in water coordinates. Solve for s so that the cat stays under it. */
        const target = p.x - h.grab;
        const k = opts.catMass / (opts.catMass + opts.boatMass);
        const ds = (target - catX()) / (1 - k);
        const next = Math.max(0, Math.min(opts.walk, S.s + ds));
        moveBy(next - S.s);
        S.dir = ds >= 0 ? 1 : -1;
        S.caption = 'החתול הולך, הסירה נסוגה';
      },
    });

    clear();
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clear(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { S.locked = !!v; slider.setEnabled(!v); btn.disabled = !!v; return; }
        if (name === 'boatMass') { opts.boatMass = v; slider.set(v); clear(); loop.requestRender(); }
        if (name === 'catMass') { opts.catMass = v; clear(); loop.requestRender(); }
        if (name === 'walk') { opts.walk = v; clear(); loop.requestRender(); }
      },
      getState() {
        return { phase: S.phase, s: S.s, boatMoved: S.boatX - S.boat0, catMoved: catX() - S.cat0, comMoved: comOf() - S.com0 };
      },
      play() { clear(); return launchWalk(1); },
    };
  };
})();

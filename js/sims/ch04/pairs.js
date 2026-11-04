/* PHY.sims.pairs: law 3, two ways.
   mode 'push': two cats, 5 kg and 20 kg, push apart on ice. Equal forces for 0.5 s, accelerations 4 to 1.
     The contact runs in slow motion so the arrows can be read. setParam: big, F, locked.
   mode 'sled': the cat pulls a sled. The rope pulls both with 40 N, and they still go: each body has its own net force.
   sim.play() -> Promise. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;

  function push(canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    const CONTACT = 0.5, SLOW = 0.28, DRIFT = 2.2;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -14.5, xMax: 8.5, yMin: -1.6, yMax: 9.4 }, aspect: 1.9, minHeight: 240, maxHeight: 420 });
    const gate = K.gate();
    const S = { F: opts.F || 40, small: 5, big: opts.big || 20, t: 0, phase: 'ready', a: { x: 0, v: 0, acc: 0 }, b: { x: 0, v: 0, acc: 0 }, force: 0, hold: 0, locked: true };
    const hud = {};
    hud.big = U.Slider(controlsEl, { label: 'מסת החתול הגדול', min: 5, max: 40, step: 5, value: S.big, unit: 'kg', digits: 0, onInput(v) { S.big = v; clearRun(); loop.requestRender(); } });
    const row = U.h('div', { class: 'sim-row' });
    hud.go = U.Button(row, 'עוד דחיפה', function () { if (!S.locked) api.play(); }, { primary: true });
    controlsEl.appendChild(row);
    hud.out = U.Readouts(controlsEl, [
      { key: 'fa', label: 'הכוח על הקטן', color: 'var(--c-force)' },
      { key: 'fb', label: 'הכוח על הגדול', color: 'var(--c-force)' },
      { key: 'aa', label: 'תאוצת הקטן', color: 'var(--c-acceleration)' },
      { key: 'ab', label: 'תאוצת הגדול', color: 'var(--c-acceleration)' },
      { key: 'va', label: 'מהירות הקטן', color: 'var(--c-velocity)' },
      { key: 'vb', label: 'מהירות הגדול', color: 'var(--c-velocity)' },
    ]);

    function clearRun() {
      gate.close();
      S.t = 0; S.phase = 'ready'; S.force = 0; S.hold = 0;
      S.a = { x: 0, v: 0, acc: 0 };
      S.b = { x: 0, v: 0, acc: 0 };
    }
    function setLocked(v) { S.locked = v; hud.big.setEnabled(!v); hud.go.disabled = v; }

    function step(dt0) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      if (S.phase === 'hold') { S.hold += dt0; if (S.hold >= 0.5) { S.phase = 'done'; gate.close(); } return; }
      const dt = dt0 * (S.phase === 'contact' ? SLOW : 1);
      S.t += dt;
      if (S.phase === 'contact') {
        S.force = S.F;
        S.a.acc = -S.force / S.small;   /* the small cat goes left */
        S.b.acc = S.force / S.big;
        if (S.t >= CONTACT) { S.phase = 'drift'; S.force = 0; S.a.acc = 0; S.b.acc = 0; S.driftFrom = S.t; }
      }
      [S.a, S.b].forEach(function (c) {
        const nv = c.v + c.acc * dt;
        c.x += ((c.v + nv) / 2) * dt;
        c.v = nv;
      });
      if (S.phase === 'drift' && S.t - S.driftFrom >= DRIFT) { S.phase = 'hold'; S.hold = 0; }
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      const yFloor = 0;
      const r = view.visible;
      view.poly([{ x: r.xMin, y: yFloor }, { x: r.xMax, y: yFloor }, { x: r.xMax, y: r.yMin }, { x: r.xMin, y: r.yMin }], { fill: 'hsla(195, 85%, 62%, 0.28)', close: true });
      view.line(r.xMin, yFloor, r.xMax, yFloor, { color: C.axis, width: 2, cap: 'butt' });
      const smallPx = small ? 54 : 74;
      const bigPx = (small ? 54 : 74) * Math.cbrt(S.big / 5);
      const gap = (smallPx * 0.34) / view.scale;
      const gapB = (bigPx * 0.34) / view.scale;
      const xa = S.a.x - gap, xb = S.b.x + gapB;
      PHY.mascot.draw(view, xa, yFloor, { pose: S.phase === 'ready' ? 'standing' : S.phase === 'contact' ? 'dizzy' : 'flying', px: smallPx, flipX: true, anchor: S.phase === 'ready' || S.phase === 'contact' ? [0.5, 0.96] : [0.5, 0.82] });
      PHY.mascot.draw(view, xb, yFloor, { pose: S.phase === 'contact' ? 'thinking' : 'standing', px: bigPx });
      view.text(xa, yFloor, F.unit(S.small, 'kg', 0), { size: 12, weight: 800, offset: [0, 14], halo: true });
      view.text(xb, yFloor, F.unit(S.big, 'kg', 0), { size: 12, weight: 800, offset: [0, 14], halo: true });
      /* Everything is drawn above the big cat's head, in rows, so the arrows stay off the cats.
         Each arrow starts from the side of its own cat. */
      const rowF = yFloor + (bigPx * 1.04 + 8) / view.scale;
      const rowB = rowF + 31 / view.scale;
      const lbl = (x, y, text, color) => view.text(x, y, text, { size: 11.5, weight: 800, color, offset: [0, -11], halo: true });
      if (S.force > 0) {
        const len = S.F * 0.085;
        view.arrow(xa, rowF, xa - len, rowF, { color: C.force, width: 4 });
        lbl(xa - len / 2, rowF, F.unit(S.F, 'N', 0), C.force);
        view.arrow(xb, rowF, xb + len, rowF, { color: C.force, width: 4 });
        lbl(xb + len / 2, rowF, F.unit(S.F, 'N', 0), C.force);
        const la = Math.min(6, Math.abs(S.a.acc) * 0.5), lb = Math.min(6, Math.abs(S.b.acc) * 0.5);
        view.arrow(xa, rowB, xa - la, rowB, { color: C.acceleration, width: 3.4 });
        lbl(xa - la / 2, rowB, F.unit(Math.abs(S.a.acc), 'ms2', 1), C.acceleration);
        view.arrow(xb, rowB, xb + lb, rowB, { color: C.acceleration, width: 3.4 });
        lbl(xb + lb / 2, rowB, F.unit(Math.abs(S.b.acc), 'ms2', 1), C.acceleration);
      }
      if (S.phase === 'drift' || S.phase === 'hold' || S.phase === 'done') {
        const la = Math.abs(S.a.v) * 0.5, lb = Math.abs(S.b.v) * 0.5;
        view.arrow(xa, rowF, xa - la, rowF, { color: C.velocity, width: 3.4 });
        lbl(xa - la / 2, rowF, F.unit(Math.abs(S.a.v), 'ms', 1), C.velocity);
        if (lb > 0.05) view.arrow(xb, rowF, xb + lb, rowF, { color: C.velocity, width: 3.4 });
        lbl(xb + lb / 2, rowF, F.unit(Math.abs(S.b.v), 'ms', 1), C.velocity);
      }
      const on = S.force > 0;
      hud.out.set('fa', F.unit(on ? S.F : 0, 'N', 0));
      hud.out.set('fb', F.unit(on ? S.F : 0, 'N', 0));
      hud.out.set('aa', F.unit(on ? S.F / S.small : 0, 'ms2', 1));
      hud.out.set('ab', F.unit(on ? S.F / S.big : 0, 'ms2', 1));
      hud.out.set('va', F.unit(Math.abs(S.a.v), 'ms', 1));
      hud.out.set('vb', F.unit(Math.abs(S.b.v), 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'big') { S.big = v; hud.big.set(v); }
        clearRun();
        loop.requestRender();
      },
      getState() {
        return { phase: S.phase, t: S.t, force: S.force, F: S.F, small: S.small, big: S.big, aSmall: S.a.v, aBig: S.b.v, xSmall: S.a.x, xBig: S.b.x, accSmall: S.a.acc, accBig: S.b.acc, vSmall: S.a.v, vBig: S.b.v };
      },
      play() {
        clearRun();
        S.phase = 'contact';
        return gate.open();
      },
    };
    setLocked(true);
    return api;
  }

  function sled(canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    const T = 40, SLED = 20, CAT = 5, FRICTION = 20, GROUND = 45, RUN = 4;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.2, xMax: 13, yMin: -5.6, yMax: 4.2 }, aspect: 1.35, minHeight: 290, maxHeight: 440 });
    const gate = K.gate();
    const S = { t: 0, phase: 'ready', x: 0, v: 0, a: 0, hold: 0 };
    const out = U.Readouts(controlsEl, [
      { key: 'netS', label: 'שקול על המזחלת', color: 'var(--c-force)' },
      { key: 'netC', label: 'שקול על ניוטון', color: 'var(--c-force)' },
      { key: 'a', label: 'תאוצה של שניהם', color: 'var(--c-acceleration)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
    ]);

    function clearRun() {
      gate.close();
      Object.assign(S, { t: 0, phase: 'ready', x: 0, v: 0, a: 0, hold: 0 });
    }
    function step(dt) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      if (S.phase === 'hold') { S.hold += dt; if (S.hold >= 0.6) { S.phase = 'done'; gate.close(); } return; }
      S.t += dt;
      /* each body answers to its own net force; both must come out the same, the rope is tight */
      const aSled = (T - FRICTION) / SLED;
      const aCat = (GROUND - T) / CAT;
      S.a = aSled;
      S.aCat = aCat;
      const nv = S.v + aSled * dt;
      S.x += ((S.v + nv) / 2) * dt;
      S.v = nv;
      if (S.t >= RUN) { S.phase = 'hold'; S.hold = 0; }
    }

    /* one body with its own forces, in a box of its own */
    function panel(px, py, w, h, title, draw) {
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, w, h, 12);
      else ctx.rect(px, py, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      view.screenText(px + w / 2, py + 14, title, { size: view.w < 460 ? 11.5 : 13, weight: 700 });
      draw(px + w / 2, py + h * 0.5, w);
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      const P = PHY.ch02.pix(view);
      const y0 = 0.6;
      /* snow, with marks that scroll, so the pair stays in view */
      const shift = Math.max(0, S.x - 1.5);
      K.ground(view, y0, { depth: 1, ticks: 1, shift });
      const sx = 1.2 + S.x - shift;
      const catX = sx + 6.4;
      const w = small ? 60 : 92, h = small ? 30 : 44;
      K.crate(view, sx + 1.2, y0, w, h, { label: F.unit(SLED, 'kg', 0), size: small ? 11 : 13 });
      const ropeY = y0 + (h * 0.55) / view.scale;
      view.line(sx + 1.2 + (w / 2) / view.scale, ropeY, catX - 0.7, ropeY, { color: C.axis, width: 2.5 });
      const catPx = small ? 56 : 80;
      PHY.mascot.draw(view, catX, y0, { pose: S.phase === 'ready' ? 'standing' : 'thinking', px: catPx });
      if (S.v > 0.03) {
        const ty = y0 + (catPx * 1.02) / view.scale;
        view.arrow(catX, ty, catX + S.v * 0.5, ty, { color: C.velocity, width: 3.4 });
        view.text(catX + S.v * 0.5, ty, F.unit(S.v, 'ms', 1), { size: 11.5, weight: 800, color: C.velocity, align: 'left', offset: [5, 0], halo: true });
        view.arrow(sx + 1.2, y0 + (h + 12) / view.scale, sx + 1.2 + S.a * 2, y0 + (h + 12) / view.scale, { color: C.acceleration, width: 3.4 });
        view.text(sx + 1.2 + S.a * 2, y0 + (h + 12) / view.scale, F.unit(S.a, 'ms2', 0), { size: 11.5, weight: 800, color: C.acceleration, align: 'left', offset: [5, 0], halo: true });
      }

      /* the two free-body panels. Before the run they would answer the card, so they wait. */
      const top = view.sy(y0 - 1) + 8;
      const pw = (view.w - 18) / 2;
      const ph = view.h - top - 8;
      out.el.hidden = S.phase === 'ready';
      if (S.phase === 'ready') {
        panel(6, top, view.w - 12, ph, 'הכוחות יופיעו בריצה', function (cx, cy) {
          view.screenText(cx, cy + 6, '?', { size: 44, weight: 800, color: C.soft });
        });
        return;
      }
      const kF = (pw * 0.34) / GROUND;
      const label = (x, y, str, o) => view.screenText(x, y, str, Object.assign({ size: small ? 11 : 12.5, weight: 700, color: C.force, halo: true }, o));
      panel(6, top, pw, ph, 'הכוחות על המזחלת', function (cx, cy) {
        K.crate(view, view.toWorld(cx, cy).x, view.toWorld(cx, cy + 15).y, small ? 40 : 56, small ? 24 : 32, {});
        P.arrow(cx + 20, cy - 2, cx + 20 + T * kF, cy - 2, { color: C.force, width: 3.6 });
        label(cx + 20 + (T * kF) / 2, cy - 15, F.unit(T, 'N', 0));
        label(cx + 20 + (T * kF) / 2, cy - 29, 'חבל');
        P.arrow(cx - 20, cy + 8, cx - 20 - FRICTION * kF, cy + 8, { color: C.force, width: 3.6 });
        /* left of the crate: the arrow is shorter than its label */
        const fx = cx - (small ? 44 : 56);
        label(fx, cy - 5, F.unit(FRICTION, 'N', 0));
        label(fx, cy - 19, 'חיכוך');
        const nety = cy + (small ? 30 : 36);
        P.arrow(cx - ((T - FRICTION) * kF) / 2, nety, cx + ((T - FRICTION) * kF) / 2, nety, { color: C.force, width: 4, head: 11 });
        label(cx, nety + 13, 'שקול ' + F.unit(T - FRICTION, 'N', 0), { color: C.ink });
      });
      panel(12 + pw, top, pw, ph, 'הכוחות על ניוטון', function (cx, cy) {
        const q = view.toWorld(cx, cy + 16);
        PHY.mascot.draw(view, q.x, q.y, { pose: 'standing', px: small ? 42 : 56 });
        P.arrow(cx - 18, cy - 8, cx - 18 - T * kF, cy - 8, { color: C.force, width: 3.6 });
        label(cx - 18 - (T * kF) / 2, cy - 21, F.unit(T, 'N', 0));
        label(cx - 18 - (T * kF) / 2, cy - 35, 'חבל');
        P.arrow(cx + 18, cy + 8, cx + 18 + GROUND * kF, cy + 8, { color: C.force, width: 3.6 });
        label(cx + 18 + (GROUND * kF) / 2, cy - 5, F.unit(GROUND, 'N', 0));
        label(cx + 18 + (GROUND * kF) / 2, cy - 19, 'קרקע');
        const nety = cy + (small ? 30 : 36);
        /* true scale would be a dot, so the net arrow keeps a readable minimum */
        const nl = Math.max(18, (GROUND - T) * kF);
        P.arrow(cx - nl / 2, nety, cx + nl / 2, nety, { color: C.force, width: 4, head: 11 });
        label(cx, nety + 13, 'שקול ' + F.unit(GROUND - T, 'N', 0), { color: C.ink });
      });
      out.set('netS', F.unit(T - FRICTION, 'N', 0));
      out.set('netC', F.unit(GROUND - T, 'N', 0));
      out.set('a', F.unit((T - FRICTION) / SLED, 'ms2', 0));
      out.set('v', F.unit(S.v, 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      setParam() {},
      getState() {
        return { phase: S.phase, t: S.t, x: S.x, v: S.v, aSled: (T - FRICTION) / SLED, aCat: (GROUND - T) / CAT, T, friction: FRICTION, ground: GROUND, mSled: SLED, mCat: CAT };
      },
      play() {
        clearRun();
        S.phase = 'run';
        return gate.open();
      },
    };
  }

  PHY.sims.pairs = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    return (opts.mode === 'sled' ? sled : push)(canvasEl, controlsEl, opts);
  };
})();

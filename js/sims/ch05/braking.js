/* PHY.sims.braking: where speed goes.
   mode 'brake': two identical cars brake with the same force, one from 20 m/s, one from a chosen speed.
     Each stopping distance is measured from the moving car and stamped on a live graph of distance against
     speed, and the parabola appears once two dots are on it.
   mode 'boost': one force pushes a scooter from 0 to 10 m/s, then from 10 to 20 m/s. The second stretch of
     road is three times longer, and so is the energy.
   opts: {mode, v2, locked}. sim.play() -> Promise. setParam: v2, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05, P2 = PHY.ch02;

  /* "200 אלף ג'ול" reads better than a row of zeros. */
  function bigJ(v) {
    return v >= 10000 ? F.num(v / 1000, 0) + ' אלף ג\'ול' : M.unitJ(v);
  }

  PHY.sims.braking = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'brake', v2: 40, locked: true }, opts || {});
    const brake = opts.mode === 'brake';
    const view = PHY.canvas.create(canvasEl, {
      world: brake ? { xMin: -4, xMax: 99, yMin: -30, yMax: 30 } : { xMin: -3, xMax: 50, yMin: -5, yMax: 19 },
      aspect: brake ? 1.35 : 1.9, minHeight: brake ? 385 : 200, maxHeight: brake ? 500 : 340,
    });
    const MASS = brake ? 1000 : 100;
    const FORCE = brake ? 10000 : 500;
    const A = FORCE / MASS;
    const S = { v2: opts.v2, t: 0, running: false, done: false, hold: 0, caption: '', locked: opts.locked, resolve: null, cars: [], stamps: [], w1: 0, w2: 0, x: 0, v: 0, mark: null };

    let slider = null, go = null, out = null;
    if (brake) {
      slider = U.Slider(controlsEl, {
        label: 'המהירות של המכונית השנייה', min: 10, max: 40, step: 1, value: S.v2, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
        onInput(v) { S.v2 = v; clearRun(); loop.requestRender(); },
      });
    }
    const row = U.h('div', { class: 'sim-row' });
    go = U.Button(row, brake ? 'לבלום!' : 'קדימה', function () { launch(); }, { primary: true });
    controlsEl.appendChild(row);
    out = U.Readouts(controlsEl, brake
      ? [{ key: 'd1', label: 'בלימה מ-20 מ/ש', color: 'var(--c-displacement)' }, { key: 'd2', label: 'בלימה מהמהירות השנייה', color: 'var(--c-displacement)' }, { key: 'r', label: 'היחס בין המרחקים' }]
      : [{ key: 'w1', label: 'מ-0 ל-10 מ/ש' }, { key: 'w2', label: 'מ-10 ל-20 מ/ש' }, { key: 'r', label: 'היחס' }]);

    function setLocked(v) {
      S.locked = v;
      if (slider) slider.setEnabled(!v);
      go.disabled = v;
    }
    function clearRun() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.t = 0; S.running = false; S.done = false; S.hold = 0; S.caption = ''; S.w1 = 0; S.w2 = 0; S.x = 0; S.v = 0; S.mark = null;
      S.cars = [{ v0: 20, x: 0, v: 20, stopped: false, W: 0 }, { v0: S.v2, x: 0, v: S.v2, stopped: false, W: 0 }];
      S.stamps = [];
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
      S.t += dt;
      if (brake) {
        let all = true;
        S.cars.forEach(function (c, i) {
          if (c.stopped) return;
          const v1 = Math.max(0, c.v - A * dt);
          const dx = (0.5 * (c.v * c.v - v1 * v1)) / A; /* exact for constant deceleration */
          c.x += dx;
          c.W += FORCE * dx;
          c.v = v1;
          if (v1 <= 0) {
            c.stopped = true;
            S.stamps.push({ v: c.v0, d: c.x, i });
          } else all = false;
        });
        if (all) {
          S.hold += dt;
          const d = S.cars[1].x / S.cars[0].x;
          S.caption = 'פי ' + F.num(S.cars[1].v0 / 20, 2) + ' מהירות, פי ' + F.num(d, 2) + ' מרחק';
          if (S.hold > 0.8) finish();
        }
      } else {
        if (S.v < 20) {
          const v1 = Math.min(20, S.v + A * dt);
          const dx = (v1 * v1 - S.v * S.v) / (2 * A);
          /* All the force's work on this step goes on the stretch it was done on. */
          if (S.v < 10) S.w1 += FORCE * ((Math.min(v1, 10) ** 2 - S.v * S.v) / (2 * A));
          if (v1 > 10) S.w2 += FORCE * ((v1 * v1 - Math.max(S.v, 10) ** 2) / (2 * A));
          if (S.v < 10 && v1 >= 10) S.mark = S.x + (100 - S.v * S.v) / (2 * A);
          S.x += dx;
          S.v = v1;
        } else {
          S.hold += dt;
          S.caption = 'אותה תוספת מהירות, פי 3 אנרגיה';
          if (S.hold > 0.8) finish();
        }
      }
    }

    function renderBrake() {
      const small = view.w < 460;
      const W = view.w, H = view.h;
      const laneY = [H * 0.14, H * 0.31];
      const X = (x) => view.sx(x);
      /* road */
      for (let m = 0; m <= 90; m += 10) {
        view.screenText(X(m), laneY[1] + 34, F.num(m), { size: 10.5, color: C.soft });
        view.line(view.toWorld(X(m), laneY[0] + 4).x, view.toWorld(0, laneY[0] + 4).y, view.toWorld(X(m), laneY[1] + 4).x, view.toWorld(0, laneY[1] + 4).y, { color: C.grid, width: 1 });
      }
      view.screenText(X(90) + 15, laneY[1] + 34, "מ'", { size: 10.5, color: C.soft });
      S.cars.forEach(function (c, i) {
        const y = laneY[i];
        const a = view.toWorld(0, y + 4), b = view.toWorld(W, y + 4);
        view.line(a.x, a.y, b.x, b.y, { color: C.axis, width: 2 });
        if (c.x > 0.1) {
          const p = view.toWorld(X(0), y + 2), q = view.toWorld(X(c.x), y + 2);
          view.line(p.x, p.y, q.x, q.y, { color: C.ink, width: 3, alpha: 0.55, cap: 'butt' });
        }
        P2.drawCar(view, X(c.x), y + 4, { w: small ? 32 : 44 });
        const ww = view.toWorld(X(c.x) + (small ? 16 : 22), y - 9);
        const len = (c.v * (small ? 1.15 : 1.5)) / view.scale;
        if (c.v > 0.5) view.arrow(ww.x, ww.y, ww.x + len, ww.y, { color: C.velocity, width: 2.5 });
        if (!c.stopped && S.running) {
          const t = view.toWorld(X(c.x) - (small ? 16 : 22), y - 9);
          view.arrow(t.x, t.y, t.x - 16 / view.scale, t.y, { color: C.force, width: 2.5 });
        }
        view.screenText(W - 8, y + 16, F.unit(c.v0, 'ms', 0) + ' בהתחלה', { size: 11, weight: 700, color: C.velocity, align: 'right', halo: true });
        if (c.stopped) view.screenText(Math.min(W - 26, X(c.x)), y - 26, F.unit(c.x, 'm', 0), { size: 13.5, weight: 800, color: C.displacement, halo: true });
      });
      /* Energy still in each car: a bar under the road. */
      const by = H * 0.31 + 44;
      const bw = W - 24;
      /* Before a card's run these two bars would show the ratio the card asks about. */
      const hide = S.locked && !S.running && !S.done;
      S.cars.forEach(function (c, i) {
        const ke = hide ? 0 : 0.5 * MASS * c.v * c.v;
        M.miniBar(view, 12, by + i * 28, bw, {
          label: 'קינטית, ' + F.unit(c.v0, 'ms', 0),
          right: hide ? '?' : bigJ(ke),
          size: small ? 10.5 : 11.5, max: 0.5 * MASS * 1600,
          segs: [{ value: ke, color: C.accent }],
        });
      });
      /* The graph: stopping distance against speed. */
      const top = by + 58;
      const plot = P2.Plot(view, { tMin: 0, tMax: 40, yMin: 0, yMax: 100, tTick: 10, yTick: 20, title: "מרחק בלימה (מ')", tLabel: 'מהירות (מ/ש)' });
      plot.box(8, top, W - 16, H - top - 2).frame();
      if (S.stamps.length >= 2 || S.done) {
        const pts = [];
        for (let v = 0; v <= 40; v += 1) pts.push({ t: v, y: (v * v) / (2 * A) });
        plot.curve(pts, { color: C.displacement, width: 2.2, alpha: 0.75 });
      }
      S.stamps.forEach(function (s) { plot.dot(s.v, s.d, { color: C.displacement }); });
      if (S.caption) view.screenText(W * 0.42, top + 38, S.caption, { size: small ? 13 : 14, weight: 700, pill: true });
    }

    function renderBoost() {
      const small = view.w < 460;
      const r = view.visible;
      M.ground(view, r.xMin, r.xMax, 0, {});
      for (let m = 0; m <= 40; m += 10) view.text(m, 0, F.num(m), { size: 10.5, color: C.soft, offset: [0, 13] });
      view.text(44.5, 0, "מ'", { size: 10.5, color: C.soft, offset: [0, 13] });
      /* the two stretches of road */
      const to10 = (100) / (2 * A);
      const ctx = view.ctx, y0 = view.sy(0) - 4;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = C.gold;
      ctx.fillRect(view.sx(0), y0, (Math.min(S.x, to10)) * view.scale, 4);
      ctx.fillStyle = C.accent;
      if (S.x > to10) ctx.fillRect(view.sx(to10), y0, (S.x - to10) * view.scale, 4);
      ctx.restore();
      if (S.mark !== null) {
        view.line(S.mark, 0, S.mark, 7.6, { color: C.soft, width: 1.5, dash: [4, 4] });
        view.text(S.mark, 7.6, F.unit(10, 'ms', 0), { size: 11.5, weight: 700, color: C.velocity, halo: true, offset: [0, -9] });
        view.text(S.mark / 2, 0, F.unit(S.mark, 'm', 0), { size: 12.5, weight: 800, color: C.displacement, halo: true, offset: [0, -14] });
      }
      if (S.v >= 20) view.text((to10 + S.x) / 2, 0, F.unit(S.x - to10, 'm', 0), { size: 12.5, weight: 800, color: C.displacement, halo: true, offset: [0, -14] });
      /* scooter and cat */
      const px = view.sx(S.x), py = view.sy(0);
      P2.drawCar(view, px, py, { w: small ? 36 : 48 });
      PHY.mascot.draw(view, S.x - 0.2, (small ? 19 : 25) / view.scale, { pose: S.v > 14 ? 'dizzy' : 'standing', px: small ? 30 : 38 });
      const cy = (small ? 16 : 20) / view.scale;
      const fx = S.x + (small ? 18 : 24) / view.scale;
      if (S.running && S.v < 20) view.arrow(fx, cy, fx + 24 / view.scale, cy, { color: C.force, width: 3, label: 'F', labelSide: -1, labelGap: 11 });
      if (S.v > 0.3) view.arrow(fx, cy + 14 / view.scale, fx + (S.v * 2.2) / view.scale, cy + 14 / view.scale, { color: C.velocity, width: 2.8 });
      /* energy as bricks: every brick is 5000 J */
      const bw = view.w - 24;
      M.miniBar(view, 12, 8, bw, {
        label: 'אנרגיה קינטית',
        right: F.num(0.5 * MASS * S.v * S.v, 0) + " ג'ול",
        max: 20000, h: 16,
        segs: [{ value: S.w1, color: C.gold }, { value: S.w2, color: C.accent }],
      });
      /* Four bricks would answer the card before its run. */
      const ready = S.locked && !S.running && !S.done;
      for (let i = 1; !ready && i < 4; i++) {
        const p = view.toWorld(12 + (bw * i) / 4, 22), q = view.toWorld(12 + (bw * i) / 4, 38);
        view.line(p.x, p.y, q.x, q.y, { color: C.surface, width: 2, cap: 'butt' });
      }
      if (S.caption) view.screenText(view.w / 2, 58, S.caption, { size: small ? 13 : 14, weight: 700, pill: true });
    }

    function render() {
      view.clear();
      if (brake) {
        renderBrake();
        const a = S.cars[0], b = S.cars[1];
        out.set('d1', a.stopped ? F.unit(a.x, 'm', 0) : '–');
        out.set('d2', b.stopped ? F.unit(b.x, 'm', 0) : '–');
        out.set('r', a.stopped && b.stopped ? 'פי ' + F.num(b.x / a.x, 2) : '–');
      } else {
        renderBoost();
        out.set('w1', S.w1 > 0 ? F.num(S.w1, 0) + " ג'ול" : '–');
        out.set('w2', S.w2 > 0 ? F.num(S.w2, 0) + " ג'ול" : '–');
        out.set('r', S.done ? 'פי ' + F.num(S.w2 / S.w1, 2) : '–');
      }
    }

    const loop = PHY.SimLoop({ view, step, render });
    clearRun();
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'v2') { S.v2 = v; if (slider) slider.set(v); clearRun(); loop.requestRender(); }
      },
      getState() {
        return {
          done: S.done, mass: MASS, force: FORCE,
          d1: S.cars[0].x, d2: S.cars[1].x, W1: S.cars[0].W, W2: S.cars[1].W,
          ke1: 0.5 * MASS * 400, ke2: 0.5 * MASS * S.v2 * S.v2,
          boost1: S.w1, boost2: S.w2, x: S.x, v: S.v, mark: S.mark,
        };
      },
    };
  };
})();

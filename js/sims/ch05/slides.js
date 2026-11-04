/* PHY.sims.slides: frictionless slides from one height. Each cat is a Rider on a real rail.
   mode 'race': steep, curvy and gentle slides. Same speed at the bottom, different times.
   mode 'mass': a light and a heavy cat on the same shape. Same speed, different energy.
   mode 'normal': one curved slide. The rail's push (green) stays square to the velocity (blue), so the
     work it does, summed from the real path, stays 0. Gravity does all the work.
   opts: {mode, height, locked, slow}. sim.play() -> Promise. setParam: height, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;

  PHY.sims.slides = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'race', height: 5, locked: true, slow: 0.7 }, opts || {});
    const mode = opts.mode;
    const WORLD = {
      race: { xMin: -1.4, xMax: 16.6, yMin: -2.2, yMax: 7.6 },
      mass: { xMin: -1.4, xMax: 14.4, yMin: -2, yMax: 9.6 },
      normal: { xMin: -1.4, xMax: 13.6, yMin: -1.2, yMax: 8.2 },
    }[mode];
    const view = PHY.canvas.create(canvasEl, { world: WORLD, aspect: 1.65, minHeight: mode === 'race' ? 225 : 270, maxHeight: 440 });
    const S = { h: opts.height, t: 0, running: false, done: false, hold: 0, locked: opts.locked, resolve: null, list: [], caption: '', Wn: 0, Wg: 0, last: null, firstName: null };

    /* ---------- Rails ---------- */
    function rails() {
      const h = S.h;
      if (mode === 'race') {
        return [
          { key: 'steep', name: 'תלולה', pts: M.line(0, h, 5, 0, 60), m: 5, px: 34 },
          { key: 'curvy', name: 'מתפתלת', pts: M.fn(function (x) { const u = x / 10; return h * (1 - u) - 0.16 * h * Math.sin(2 * Math.PI * u); }, 0, 10, 300), m: 5, px: 34 },
          { key: 'gentle', name: 'מתונה', pts: M.line(0, h, 15, 0, 100), m: 5, px: 34 },
        ];
      }
      if (mode === 'mass') {
        const curve = function (off) { return M.fn(function (x) { const u = (x - off) / 9; return h * Math.pow(1 - u, 1.8); }, off, off + 9, 200); };
        return [
          { key: 'light', name: 'ניוטון', pts: curve(0), m: 5, px: 34 },
          { key: 'heavy', name: 'ניוטון אחרי החג', pts: curve(3.6), m: 20, px: 52 },
        ];
      }
      const a = h / 64;
      return [{ key: 'one', name: 'ניוטון', m: 5, px: 42, pts: M.join(M.fn(function (x) { return a * (x - 8) * (x - 8); }, 0, 8, 240), M.line(8, 0, 12, 0, 40)) }];
    }
    function build() {
      S.list = rails().map(function (d) {
        const track = M.Track(d.pts);
        return Object.assign(d, { track, r: M.Rider(track, { s: 0, v: 0 }), done: false, tEnd: null, vEnd: null, order: null });
      });
    }
    function clearRun() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.t = 0; S.running = false; S.done = false; S.hold = 0; S.caption = ''; S.Wn = 0; S.Wg = 0; S.last = null; S.firstName = null;
      build();
    }

    /* ---------- Controls ---------- */
    const hSlider = U.Slider(controlsEl, {
      label: 'גובה המגלשות', min: 2, max: 6, step: 0.5, value: S.h, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.h = v; clearRun(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const goBtn = U.Button(row, 'לשלוח את החתולים', function () { launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, mode === 'race'
      ? [{ key: 'steep', label: 'תלולה', color: 'var(--c-velocity)' }, { key: 'curvy', label: 'מתפתלת', color: 'var(--c-velocity)' }, { key: 'gentle', label: 'מתונה', color: 'var(--c-velocity)' }]
      : mode === 'mass'
        ? [{ key: 'light', label: 'ניוטון, 5 ק"ג' }, { key: 'heavy', label: 'אחרי החג, 20 ק"ג' }]
        : [{ key: 'v', label: 'מהירות', color: 'var(--c-velocity)' }, { key: 'wn', label: 'עבודת הכוח הנורמלי' }, { key: 'wg', label: 'עבודת הכבידה' }]);

    function setLocked(v) {
      S.locked = v;
      hSlider.setEnabled(!v);
      goBtn.disabled = v;
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

    /* ---------- Physics ---------- */
    function normalForce(d, q, v) {
      /* Newton's second law across the rail, per kilogram: N - g cos(alpha) = v^2 kappa */
      return d.m * (10 * q.ux + v * v * q.k);
    }
    function step(dt) {
      if (!S.running) return;
      const h = dt * opts.slow;
      S.t += h;
      S.list.forEach(function (d) {
        const before = d.track.at(d.r.s);
        d.r.step(h);
        const after = d.track.at(d.r.s);
        if (mode === 'normal') {
          /* The work of each force, summed from the real displacement of this step. */
          const dx = after.x - before.x, dy = after.y - before.y;
          const N = normalForce(d, after, d.r.v);
          const mx = before.ux + after.ux, my = before.uy + after.uy, ml = Math.hypot(mx, my) || 1;
          S.Wn += N * ((-my / ml) * dx + (mx / ml) * dy); /* N points along the rail's normal at mid-step */
          S.Wg += -d.m * 10 * dy;
          S.last = { N };
        }
        if (d.r.stopped && d.tEnd === null) {
          d.tEnd = d.r.tEnd === null ? d.r.t : d.r.tEnd;
          d.vEnd = Math.abs(d.r.v);
          d.order = S.list.filter(function (o) { return o.tEnd !== null; }).length;
          if (d.order === 1) S.firstName = d.name;
        }
      });
      if (S.list.every(function (d) { return d.tEnd !== null; })) {
        S.hold += dt;
        if (mode === 'race') S.caption = 'אותה מהירות. זמנים שונים.';
        if (mode === 'mass') S.caption = 'אותה מהירות, פי 4 אנרגיה.';
        if (mode === 'normal') S.caption = 'הכוח הנורמלי: 0 ג\'ול, לכל האורך.';
        if (S.hold > 0.7) finish();
      }
    }

    /* ---------- Drawing ---------- */
    function drawTower(xStart) {
      const h = S.h;
      view.poly([{ x: xStart - 1, y: 0 }, { x: xStart, y: 0 }, { x: xStart, y: h }, { x: xStart - 1, y: h }], { fill: C.gridStrong, alpha: 0.6, close: true });
      view.line(xStart - 1, h, xStart + 0.2, h, { color: C.axis, width: 3 });
      view.arrow(xStart - 0.5, 0, xStart - 0.5, h, { color: C.displacement, width: 2.2, head: 9 });
      view.text(xStart - 0.5, h / 2, F.unit(h, 'm', 1), { size: 12, weight: 700, color: C.displacement, halo: true, offset: [-2, 0] });
    }
    function velArrow(q, v) {
      const k = 4.4 / view.scale;
      const dir = v < 0 ? -1 : 1;
      const tail = { x: q.x, y: q.y };
      if (Math.abs(v) > 0.3) view.arrow(tail.x, tail.y, tail.x + q.ux * Math.abs(v) * k * dir, tail.y + q.uy * Math.abs(v) * k * dir, { color: C.velocity, width: 3 });
    }

    /* The card asks for this very number, and at the start the counter reads 0 J, so it waits for the run. */
    function workOfN() {
      if (S.locked && !S.running && !S.done) return '?';
      return M.unitJ(Math.abs(S.Wn) < 0.5 ? 0 : S.Wn);
    }

    function renderRace() {
      const small = view.w < 460;
      drawTower(0);
      S.list.forEach(function (d) {
        view.poly(d.pts, { color: C.axis, width: 4 });
      });
      const nameAt = { steep: [1.5, 1.2, 0, 0], curvy: [7.7, 1, 0, 0], gentle: [11.2, 1.3, 0, -18] };
      S.list.forEach(function (d) {
        const n = nameAt[d.key];
        view.text(n[0], n[1] * (S.h / 5), d.name, { size: 12.5, weight: 700, color: C.soft, halo: true, offset: [n[2], n[3]] });
      });
      S.list.forEach(function (d) {
        const q = d.track.at(d.r.s);
        const atEnd = d.tEnd !== null;
        if (!atEnd) velArrow(q, d.r.v);
        M.rideCat(view, q, { px: small ? 32 : 40, pose: atEnd ? (d.order === 1 ? 'happy' : 'standing') : 'sliding' });
        if (atEnd) {
          view.text(q.x, 0, F.unit(d.vEnd, 'ms', 1), { size: 12.5, weight: 800, color: C.velocity, halo: true, offset: [0, 17] });
          view.text(q.x, 0, F.unit(d.tEnd, 's', 2), { size: 12, weight: 700, color: C.ink, halo: true, offset: [0, 33] });
        }
      });
      view.screenText(view.w - 12, 20, F.unit(Math.min(S.t, 99), 's', 2), { size: 15, weight: 800, align: 'right', color: C.ink, halo: true });
    }

    function renderMass() {
      const small = view.w < 460;
      const heavy = S.list[1], light = S.list[0];
      drawTower(0);
      view.line(0, S.h, 3.6, S.h, { color: C.axis, width: 3 });
      view.poly(light.pts, { color: C.axis, width: 4 });
      view.poly(heavy.pts, { color: C.axis, width: 4 });
      [light, heavy].forEach(function (d) {
        const q = d.track.at(d.r.s);
        if (d.tEnd === null) velArrow(q, d.r.v);
        M.rideCat(view, q, { px: (small ? 0.8 : 1) * d.px, pose: d.tEnd !== null ? 'standing' : 'sliding' });
        if (d.tEnd !== null) view.text(q.x, 0, F.unit(d.vEnd, 'ms', 1), { size: 12.5, weight: 800, color: C.velocity, halo: true, offset: [0, 15] });
      });
      /* Energy of each cat. The bar's scale is the heavy cat's total. */
      const max = heavy.m * 10 * S.h;
      const w = view.w - 28;
      [light, heavy].forEach(function (d, i) {
        const q = d.track.at(d.r.s);
        const pe = d.m * 10 * q.y, ke = 0.5 * d.m * d.r.v * d.r.v;
        const y = 8 + i * 30;
        M.miniBar(view, 14, y, w, {
          label: (i ? 'אחרי החג' : 'ניוטון') + ': ' + M.unitJ(ke + pe),
          right: 'גובה ' + M.unitJ(pe) + ' | קינטית ' + M.unitJ(ke),
          size: small ? 10.5 : 11.5,
          max: max,
          segs: [{ value: ke, color: C.accent }, { value: pe, color: C.gold }],
        });
      });
    }

    function renderNormal() {
      const d = S.list[0];
      drawTower(0);
      view.poly(d.pts, { color: C.axis, width: 4 });
      const q = d.track.at(d.r.s);
      const v = d.tEnd !== null ? d.vEnd : d.r.v;
      const N = normalForce(d, q, Math.abs(v));
      const k = 0.8 / view.scale; /* pixels per newton */
      const nx = -q.uy, ny = q.ux;
      const a = 3.7 / view.scale;
      const small = view.w < 460;
      M.rideCat(view, q, { px: small ? 36 : 44, pose: d.tEnd !== null ? 'happy' : 'sliding' });
      view.arrow(q.x, q.y, q.x + nx * N * k, q.y + ny * N * k, { color: C.force, width: 3.5, label: 'N', labelSide: -1, labelGap: 12 });
      view.arrow(q.x, q.y, q.x, q.y - 50 * k, { color: C.force, width: 2.5, alpha: 0.7, label: 'mg', labelGap: 13, labelSide: 1 });
      if (Math.abs(v) > 0.3) {
        view.arrow(q.x, q.y, q.x + q.ux * Math.abs(v) * a, q.y + q.uy * Math.abs(v) * a, { color: C.velocity, width: 3.5, label: 'v', labelSide: 1, labelGap: 12 });
        /* the square corner between N and v */
        const c = 11 / view.scale;
        view.poly([{ x: q.x + q.ux * c, y: q.y + q.uy * c }, { x: q.x + q.ux * c + nx * c, y: q.y + q.uy * c + ny * c }, { x: q.x + nx * c, y: q.y + ny * c }], { color: C.ink, width: 1.6 });
      }
      const pad = small ? 10 : 12;
      view.screenText(view.w - pad, 18, 'עבודת הכוח הנורמלי: ' + workOfN(), { size: 13, weight: 800, align: 'right', color: C.ink, halo: true });
      view.screenText(view.w - pad, 37, 'עבודת הכבידה: ' + M.unitJ(S.Wg), { size: 13, weight: 800, align: 'right', color: C.ink, halo: true });
    }

    function render() {
      view.clear();
      view.grid(1, {});
      M.ground(view, view.visible.xMin, view.visible.xMax, 0, {});
      if (mode === 'race') renderRace();
      else if (mode === 'mass') renderMass();
      else renderNormal();
      if (S.caption) view.screenText(view.w / 2, mode === 'mass' ? 78 : mode === 'normal' ? 60 : 22, S.caption, { size: 14, weight: 700, pill: true });
      S.list.forEach(function (d) {
        if (mode === 'race') out.set(d.key, F.unit(Math.abs(d.tEnd === null ? d.r.v : d.vEnd), 'ms', 1));
        if (mode === 'mass') out.set(d.key, F.unit(Math.abs(d.tEnd === null ? d.r.v : d.vEnd), 'ms', 1));
      });
      if (mode === 'normal') {
        const d = S.list[0];
        out.set('v', F.unit(Math.abs(d.r.v), 'ms', 1));
        out.set('wn', workOfN());
        out.set('wg', M.unitJ(S.Wg));
      }
    }

    const loop = PHY.SimLoop({ view, step, render });
    build();
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'height') { S.h = v; hSlider.set(v); clearRun(); loop.requestRender(); }
        if (name === 'locked') setLocked(!!v);
      },
      getState() {
        return {
          running: S.running, done: S.done, t: S.t, h: S.h, Wn: S.Wn, Wg: S.Wg, firstName: S.firstName,
          list: S.list.map(function (d) { return { key: d.key, m: d.m, tEnd: d.tEnd, vEnd: d.vEnd, s: d.r.s, length: d.track.length, order: d.order, ke: d.vEnd === null ? null : 0.5 * d.m * d.vEnd * d.vEnd }; }),
        };
      },
    };
  };
})();

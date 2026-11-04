/* PHY.sims.springLab: one cat on a cart on one horizontal spring, integrated from F = -kx, with a panel below.
   panel 'fx'      force against position, a straight line through the origin
   panel 'graphs'  x, v and a against time with a moving cursor; the cursor can be dragged
   panel 'energy'  the parabola of the spring energy, and bars for kinetic, elastic and total
   panel 'live'    scrolling x and v, plus readouts for T, omega, v_max, a_max, E (the playground)

   opts: {panel, m, k, A, sliders: ['m', 'k', 'A'], locked, hideUntilRun, autorun, chapter, section, aspect, minHeight, maxHeight}
   hideUntilRun: for a predict card. Until the first run or unlock, the F and a arrows and readouts and the curves
   of the panel wait, because they would answer the card before the guess.
   sim.play(script) -> Promise. A script is a list of segments, each one of:
     {hold: s}                  stay still for s seconds
     {run: 'turn'}              run to the next turning point
     {run: {x, dir}}            run until x is crossed with velocity sign dir
     {run: {time}}              run for that many simulated seconds
   with optional {caption, rate, set: {x, v}}. setParam: m, k, A, locked. sim.release(x). getState(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch08, H2 = PHY.ch02;
  const JOULE = "ג'ול";
  const NATURAL = 2.2;
  const FRAC = { fx: 0.5, graphs: 0.42, energy: 0.46, live: 0.46 };
  const TOP = 2.35;

  PHY.sims.springLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ panel: 'live', m: 1, k: 4, A: 1, sliders: [], locked: false, autorun: false, aspect: 1.25, minHeight: 420, maxHeight: 520, Amax: 1.2 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -2.5, xMax: 2, yMin: -3, yMax: 2 }, aspect: opts.aspect, minHeight: opts.minHeight, maxHeight: opts.maxHeight });
    function layout() { K.fitTop(view, { xMin: -2.5, xMax: 2, top: TOP, bottom: -0.45, frac: FRAC[opts.panel] }); }
    layout();
    view.onResize(layout);

    const S = {
      m: opts.m, k: opts.k, A: opts.A, x: opts.A, v: 0, t: 0, phase: 'idle', locked: opts.locked,
      caption: '', script: null, seg: 0, left: 0, rate: 1, resolve: null, hist: [], nextSample: 0, meter: K.cycleMeter(1), marks: [],
      showArrows: true, veiled: !!opts.hideUntilRun,
    };

    const omega = () => Math.sqrt(S.k / S.m);
    const period = () => K.period(S.m, S.k);
    const accel = (x) => (-S.k / S.m) * x;
    const span = () => 2 * period();

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function clearTrace() { S.hist = []; S.nextSample = 0; S.t = 0; S.marks = []; S.meter = K.cycleMeter(1); }
    function hold(x) { S.x = x; S.v = 0; S.phase = 'idle'; clearTrace(); }

    function integrate(h) {
      const n = K.verlet(S.x, S.v, accel, h);
      S.x = n.x; S.v = n.v;
      S.t += h;
      const before = S.meter.n;
      S.meter.feed(S.v, S.t, h);
      if (S.meter.n > before) S.marks.push(S.meter.last);
      if (S.t >= S.nextSample) {
        S.hist.push({ t: S.t, x: S.x, v: S.v, a: accel(S.x) });
        S.nextSample = S.t + 1 / 45;
        if (S.hist.length > 900) S.hist.shift();
      }
    }

    function nextSeg() {
      S.seg++;
      const s = S.script && S.script[S.seg];
      if (!s) {
        S.script = null;
        S.phase = 'idle';
        settle();
        return;
      }
      if (s.caption !== undefined) S.caption = s.caption;
      if (s.set) { S.x = s.set.x; S.v = s.set.v; }
      S.rate = s.rate || 1;
      S.left = s.hold || (s.run && s.run.time) || 0;
    }

    function step(dt) {
      if (S.phase === 'run') { integrate(dt * S.rate); wrapGraphs(); return; }
      if (S.phase !== 'script') return;
      const s = S.script[S.seg];
      if (s.hold) {
        S.left -= dt;
        if (S.left <= 0) nextSeg();
        return;
      }
      const h = dt * S.rate, x0 = S.x, v0 = S.v;
      integrate(h);
      if (s.run === 'turn') {
        if (v0 !== 0 && v0 * S.v <= 0) {
          const f = v0 / (v0 - S.v);
          S.x = x0 + (S.x - x0) * f; S.v = 0;
          S.t -= h * (1 - f);
          nextSeg();
        }
      } else if (s.run.time) {
        S.left -= h;
        if (S.left <= 0) nextSeg();
      } else if ((x0 - s.run.x) * (S.x - s.run.x) <= 0 && S.v * s.run.dir > 0) {
        const f = (s.run.x - x0) / (S.x - x0);
        S.x = s.run.x; S.v = v0 + (S.v - v0) * f;
        S.t -= h * (1 - f);
        nextSeg();
      }
    }

    function wrapGraphs() {
      if (opts.panel === 'graphs' && S.t >= span()) {
        S.hist = [];
        S.t -= span();
        S.nextSample = 0;
      }
    }

    /* ---------- the scene ---------- */
    const catPx = () => (view.w < 420 ? 50 : 56);

    function drawScene() {
      const s = view.scale;
      const deck = 16 / s;
      const px = catPx();
      K.wall(view, -NATURAL, 0, (px + 18) / s);
      K.floor(view, 0);
      view.line(0, -0.05, 0, (px + 22) / s, { color: C.gridStrong, width: 1.6, dash: [5, 5] });
      view.text(0, 0, 'בית', { size: 12, weight: 700, color: C.soft, offset: [0, 13], halo: true });
      view.text(0, 0, 'x = 0', { size: 11, color: C.soft, offset: [0, 27], halo: true });
      if (S.A > 0.15 && S.phase !== 'drag') {
        [-S.A, S.A].forEach(function (q) {
          view.line(q, -0.04, q, 0.08, { color: C.displacement, width: 2 });
          view.text(q, 0, q < 0 ? '−A' : 'A', { size: 12, weight: 700, color: C.displacement, offset: [0, 13], halo: true, font: 'Rubik, sans-serif' });
        });
      }
      K.spring(view, -NATURAL, deck * 0.72, S.x - 23 / s, deck * 0.72, { amp: 8, coils: 10 });
      const vmax = S.A * omega();
      const pose = S.phase === 'drag' ? 'thinking' : Math.abs(S.v) > 0.7 * vmax ? 'happy' : 'standing';
      K.cart(view, S.x, 0, { pose: pose, catPx: px });
      if (S.showArrows) drawArrows(px);
      if (S.caption) view.screenText(view.w / 2, 17, S.caption, { size: 13.5, weight: 700, pill: true });
    }

    function drawArrows(px) {
      const s = view.scale;
      const base = (16 + px + 12) / s, gap = 19 / s;
      const fMax = S.k * Math.max(S.A, Math.abs(S.x), 0.2);
      const rows = [
        { name: 'F', val: -S.k * S.x, max: fMax, color: C.force, y: base },
        { name: 'a', val: accel(S.x), max: fMax / S.m, color: C.acceleration, y: base + gap },
        { name: 'v', val: S.v, max: Math.max(S.A, Math.abs(S.x), 0.2) * omega(), color: C.velocity, y: base + 2 * gap },
      ];
      rows.forEach(function (w) {
        if (S.veiled && w.name !== 'v') return;
        const len = (w.val / w.max) * 1.05;
        if (Math.abs(len) < 0.04) {
          view.text(S.x, w.y, w.name + ' = 0', { size: 13, weight: 700, color: w.color, halo: true, font: 'Rubik, sans-serif' });
          return;
        }
        view.arrow(S.x, w.y, S.x + len, w.y, { color: w.color, width: 3.2, head: 12 });
        view.text(S.x + len, w.y, w.name, { size: 13.5, weight: 700, color: w.color, offset: [len > 0 ? 10 : -10, 0], halo: true, font: 'Rubik, sans-serif' });
      });
    }

    /* ---------- the panels ---------- */
    function askMark(x, y) { view.screenText(x, y, '?', { size: 30, weight: 700, color: C.soft, halo: true }); }

    function panelBox() {
      const top = view.sy(-0.45) + 4;
      return { x: 6, y: top, w: view.w - 12, h: view.h - top - 14 };
    }

    const plots = {
      fx: H2.Plot(view, { title: 'F (ניוטון)', tLabel: "x (מ')", titleColor: 'force' }),
      x: H2.Plot(view, { compact: true, tLabel: "t (ש')" }),
      v: H2.Plot(view, { compact: true, tLabel: '' }),
      a: H2.Plot(view, { compact: true, tLabel: '' }),
      u: H2.Plot(view, { title: "אנרגיה (ג'ול)", tLabel: "x (מ')" }),
    };

    function drawFx() {
      const b = panelBox();
      const lim = Math.max(opts.Amax, S.A) * 1.08;
      const fm = S.k * lim;
      const p = plots.fx.range({ tMin: -lim, tMax: lim, yMin: -fm, yMax: fm, tTick: 0.5, yTick: H2.niceStep(2 * fm, 4) });
      p.box(b.x, b.y, b.w, b.h).frame();
      p.vline(0, { color: C.gridStrong });
      if (S.veiled) { askMark(b.x + b.w / 2, b.y + b.h / 2); return; }
      p.curve([{ t: -lim, y: fm }, { t: lim, y: -fm }], { color: C.force, width: 3 });
      const P = H2.pix(view);
      const f = -S.k * S.x;
      if (Math.abs(f) > fm * 0.03) P.arrow(p.X(S.x), p.Y(0), p.X(S.x), p.Y(f), { color: C.force, width: 3, head: 10 });
      p.dot(S.x, f, { color: C.force });
    }

    /* A compact plot's own title would sit on the tick labels of the plot above it, so it goes inside. */
    function innerTitle(p, text, color) {
      view.screenText(p.r.x + p.r.w - 3, p.r.y + 9, text, { size: 12, weight: 700, align: 'right', color: color, halo: true });
    }

    function drawGraphs() {
      const b = panelBox();
      const w = omega(), T2 = span(), n = 90;
      const each = b.h / 3;
      const rows = [
        { key: 'x', title: "x (מ')", A: S.A, color: C.displacement, f: (t) => S.A * Math.cos(w * t), now: S.x },
        { key: 'v', title: 'v (מ/ש)', A: S.A * w, color: C.velocity, f: (t) => -S.A * w * Math.sin(w * t), now: S.v },
        { key: 'a', title: 'a (מ/ש²)', A: S.A * w * w, color: C.acceleration, f: (t) => -S.A * w * w * Math.cos(w * t), now: accel(S.x) },
      ];
      const tc = S.t;
      rows.forEach(function (R, i) {
        const p = plots[R.key].range({ tMin: 0, tMax: T2, yMin: -R.A * 1.2, yMax: R.A * 1.2, yTick: R.A, tTick: 1 });
        p.box(b.x, b.y + i * each, b.w, each - 2).frame();
        innerTitle(p, R.title, R.color);
        if (S.veiled) { askMark(p.r.x + p.r.w / 2, p.r.y + p.r.h / 2); return; }
        const pts = [];
        for (let j = 0; j <= n; j++) { const t = (j / n) * T2; pts.push({ t: t, y: R.f(t) }); }
        p.curve(pts, { color: R.color, width: 1.8, alpha: 0.3 });
        const live = S.hist.map(function (h) { return { t: h.t, y: h[R.key] }; }).filter(function (q) { return q.t <= tc; });
        live.push({ t: tc, y: R.now });
        p.curve(live, { color: R.color, width: 2.8 });
        p.vline(tc, { color: C.ink, width: 1.4, dash: [3, 4] });
        p.dot(tc, R.now, { color: R.color, r: 5 });
      });
    }

    function drawEnergy() {
      const b = panelBox();
      const barsW = Math.min(150, b.w * 0.42);
      const lim = Math.max(opts.Amax, S.A) * 1.08;
      const E = 0.5 * S.k * S.A * S.A;
      const U0 = 0.5 * S.k * S.x * S.x, K0 = 0.5 * S.m * S.v * S.v;
      const top = Math.max(E * 1.25, 0.5 * S.k * lim * lim * 0.72);
      const p = plots.u.range({ tMin: -lim, tMax: lim, yMin: 0, yMax: top, tTick: 0.5, yTick: H2.niceStep(top, 3) });
      p.box(b.x, b.y, b.w - barsW - 6, b.h).frame();
      const P = H2.pix(view);
      if (S.veiled) {
        askMark(p.r.x + p.r.w / 2, p.r.y + p.r.h / 2);
      } else {
        const pts = [];
        for (let i = 0; i <= 80; i++) { const q = -lim + (i / 80) * 2 * lim; pts.push({ t: q, y: 0.5 * S.k * q * q }); }
        p.curve(pts, { color: C.soft, width: 2.6 });
        p.hline(E, { color: C.ink, width: 1.6, dash: [6, 5] });
        p.text(-lim * 0.72, E, 'E', { size: 13, weight: 700, offset: [0, -10] });
        P.line(p.X(S.x), p.Y(0), p.X(S.x), p.Y(U0), { color: C.soft, width: 6, cap: 'butt' });
        P.line(p.X(S.x), p.Y(U0), p.X(S.x), p.Y(U0 + K0), { color: C.accent, width: 6, cap: 'butt' });
        p.dot(S.x, U0, { color: C.ink, r: 5 });
      }

      /* Bars: kinetic, elastic, and their sum. Their shared scale is the total energy. */
      const bx = b.x + b.w - barsW, by = b.y + 28, bh = b.h - 28 - 24;
      const w = (barsW - 14) / 3;
      const bars = [
        { label: 'תנועה', val: K0, color: C.accent },
        { label: 'קפיץ', val: U0, color: C.soft },
        { label: 'סכום', val: K0 + U0, color: C.ink },
      ];
      bars.forEach(function (q, i) {
        const x = bx + i * (w + 7);
        const h = (Math.max(0, q.val) / Math.max(E, 1e-6)) * (bh - 4);
        P.poly([{ x: x, y: by + bh }, { x: x + w, y: by + bh }, { x: x + w, y: by + bh - h }, { x: x, y: by + bh - h }], { fill: q.color, close: true });
        P.line(x - 2, by + bh, x + w + 2, by + bh, { color: C.axis, width: 1.5 });
        view.screenText(x + w / 2, by + bh + 12, q.label, { size: 11.5, weight: 700 });
        view.screenText(x + w / 2, by + bh - h - 9, F.num(q.val, 2), { size: 12, weight: 700, color: q.color === C.soft ? C.ink : q.color, halo: true });
      });
    }

    function drawLive() {
      const b = panelBox();
      const win = 8;
      const tMax = Math.max(win, S.t), tMin = tMax - win;
      const w = omega();
      const vm = Math.max(S.A, 0.2) * w * 1.25;
      const each = b.h / 2;
      const rows = [
        { key: 'x', title: "x (מ')", lo: -opts.Amax * 1.1, hi: opts.Amax * 1.1, tick: 1, color: C.displacement },
        { key: 'v', title: 'v (מ/ש)', lo: -vm, hi: vm, tick: H2.niceStep(2 * vm, 3), color: C.velocity },
      ];
      rows.forEach(function (R, i) {
        const p = plots[R.key].range({ tMin: tMin, tMax: tMax, yMin: R.lo, yMax: R.hi, yTick: R.tick, tTick: 2 });
        p.box(b.x, b.y + i * each, b.w, each - 2).frame();
        innerTitle(p, R.title, R.color);
        if (i === 0) S.marks.forEach(function (t) { if (t >= tMin) p.vline(t, { color: C.gold, width: 1.6, dash: [4, 4] }); });
        p.curve(S.hist.filter(function (h) { return h.t >= tMin; }).map(function (h) { return { t: h.t, y: h[R.key] }; }), { color: R.color, width: 2.6 });
        if (S.t > 0) p.dot(Math.min(S.t, tMax), R.key === 'x' ? S.x : S.v, { color: R.color, r: 4.5 });
      });
    }

    const out = {};
    function paintReadouts() {
      if (!out.r) return;
      const f = -S.k * S.x, a = accel(S.x);
      if (opts.panel === 'live') {
        out.r.set('T', F.unit(period(), 's', 2));
        out.r.set('w', F.num(omega(), 2) + ' רד/ש');
        out.r.set('vm', F.unit(S.A * omega(), 'ms', 2));
        out.r.set('am', F.unit(S.A * omega() * omega(), 'ms2', 1));
        out.r.set('E', F.unit(0.5 * S.k * S.A * S.A, JOULE, 2));
      } else if (opts.panel === 'energy') {
        out.r.set('x', F.unit(S.x, 'm', 2));
        out.r.set('K', F.unit(0.5 * S.m * S.v * S.v, JOULE, 2));
        out.r.set('U', F.unit(0.5 * S.k * S.x * S.x, JOULE, 2));
        out.r.set('v', F.unit(S.v, 'ms', 2));
      } else {
        out.r.set('x', F.unit(S.x, 'm', 2));
        out.r.set('v', F.unit(S.v, 'ms', 2));
        out.r.set('a', S.veiled ? '?' : F.unit(a, 'ms2', 2));
        out.r.set('F', S.veiled ? '?' : F.unit(f, 'N', 2));
      }
    }

    function render() {
      view.clear();
      drawScene();
      if (opts.panel === 'fx') drawFx();
      else if (opts.panel === 'graphs') drawGraphs();
      else if (opts.panel === 'energy') drawEnergy();
      else drawLive();
      paintReadouts();
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- controls ---------- */
    const DEF = {
      m: { label: 'מסה', min: 0.5, max: 5, step: 0.5, unit: 'kg', digits: 1 },
      k: { label: 'קבוע הקפיץ k', min: 2, max: 40, step: 1, unit: 'ניוטון/מ\'', digits: 0, color: 'var(--c-force)' },
      A: { label: 'משרעת A', min: 0.2, max: 1.2, step: 0.1, unit: 'm', digits: 1, color: 'var(--c-displacement)' },
    };
    const sliders = {};
    opts.sliders.forEach(function (key) {
      const d = DEF[key];
      sliders[key] = U.Slider(controlsEl, {
        label: d.label, min: d.min, max: d.max, step: d.step, value: S[key], unit: d.unit, digits: d.digits, color: d.color,
        onInput(v) { S[key] = v; restart(); touched(); },
      });
    });
    const row = U.h('div', { class: 'sim-row' });
    const againBtn = U.Button(row, opts.panel === 'graphs' ? 'עצירה' : 'לשחרר שוב', function () {
      if (S.locked) return;
      if (opts.panel === 'graphs') {
        if (S.phase === 'run') { S.phase = 'idle'; againBtn.textContent = 'הפעלה'; }
        else { S.phase = 'run'; S.rate = 0.5; againBtn.textContent = 'עצירה'; }
        loop.requestRender();
        return;
      }
      restart();
    }, { primary: true });
    controlsEl.appendChild(row);
    const READ = {
      fx: [{ key: 'x', label: 'x', color: 'var(--c-displacement)' }, { key: 'F', label: 'F', color: 'var(--c-force)' }, { key: 'a', label: 'a', color: 'var(--c-acceleration)' }, { key: 'v', label: 'v', color: 'var(--c-velocity)' }],
      graphs: [{ key: 'x', label: 'x', color: 'var(--c-displacement)' }, { key: 'v', label: 'v', color: 'var(--c-velocity)' }, { key: 'a', label: 'a', color: 'var(--c-acceleration)' }, { key: 'F', label: 'F', color: 'var(--c-force)' }],
      energy: [{ key: 'x', label: 'x', color: 'var(--c-displacement)' }, { key: 'v', label: 'v', color: 'var(--c-velocity)' }, { key: 'K', label: 'אנרגיית תנועה' }, { key: 'U', label: 'אנרגיית קפיץ' }],
      live: [{ key: 'T', label: 'זמן מחזור T' }, { key: 'w', label: 'ω' }, { key: 'vm', label: 'מהירות מרבית', color: 'var(--c-velocity)' }, { key: 'am', label: 'תאוצה מרבית', color: 'var(--c-acceleration)' }, { key: 'E', label: 'אנרגיה כוללת' }],
    };
    out.r = U.Readouts(controlsEl, READ[opts.panel]);

    function touched() {
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
    }
    function setLocked(v) {
      S.locked = v;
      if (!v) S.veiled = false;
      Object.keys(sliders).forEach(function (k) { sliders[k].setEnabled(!v); });
      againBtn.disabled = v;
    }
    function restart() {
      settle();
      S.veiled = false;
      S.script = null;
      S.caption = '';
      clearTrace();
      S.x = S.A;
      S.v = 0;
      S.rate = opts.panel === 'graphs' ? 0.5 : 1;
      S.phase = 'run';
      loop.requestRender();
    }

    /* Dragging the cat holds it there (the arrows update), letting go releases it from rest. */
    let cursorDrag = false;
    view.drag({
      hit(p) {
        if (S.locked) return null;
        if (opts.panel === 'graphs') {
          if (S.phase === 'script' || p.y > -0.45) return null;
          return Math.abs(view.sx(p.x) - plots.x.X(S.t)) <= 30 ? 'cursor' : null;
        }
        const c = { x: S.x, y: (16 + catPx() * 0.5) / view.scale };
        return view.pxDist(p, c) <= 40 ? 'cat' : null;
      },
      start(hd) {
        if (hd === 'cursor') { cursorDrag = true; S.phase = 'idle'; againBtn.textContent = 'הפעלה'; return; }
        settle();
        S.script = null;
        S.caption = '';
        S.phase = 'drag';
        S.v = 0;
      },
      move(hd, p) {
        if (hd === 'cursor') {
          const q = plots.x, r = q.r;
          const px = Math.max(r.x, Math.min(r.x + r.w, view.sx(p.x)));
          const t = q.o.tMin + ((px - r.x) / r.w) * (q.o.tMax - q.o.tMin);
          const w = omega();
          S.t = t;
          S.x = S.A * Math.cos(w * t);
          S.v = -S.A * w * Math.sin(w * t);
          S.hist = [];
          for (let i = 0; i <= 90; i++) {
            const q2 = (i / 90) * t;
            S.hist.push({ t: q2, x: S.A * Math.cos(w * q2), v: -S.A * w * Math.sin(w * q2), a: -S.A * w * w * Math.cos(w * q2) });
          }
          S.nextSample = t;
        } else {
          S.x = Math.max(-opts.Amax, Math.min(opts.Amax, p.x));
          S.A = Math.max(Math.abs(S.x), 0.1);
          if (Math.abs(S.x) < 0.1) S.x = S.x < 0 ? -0.1 : 0.1;
          if (sliders.A) sliders.A.set(Math.round(S.A * 10) / 10);
        }
        loop.requestRender();
      },
      end(hd) {
        if (hd === 'cursor') { cursorDrag = false; return; }
        touched();
        clearTrace();
        S.v = 0;
        S.rate = 1;
        S.meter = K.cycleMeter(S.x >= 0 ? 1 : -1);
        S.phase = 'run';
      },
    });

    setLocked(S.locked);
    if (opts.autorun) { S.phase = 'run'; S.rate = opts.panel === 'graphs' ? 0.5 : 1; }

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        settle();
        S.script = null;
        S.caption = '';
        hold(S.A);
        loop.requestRender();
      },
      /* Clean start at x = A at rest, then the script. */
      play(script) {
        settle();
        S.veiled = false;
        clearTrace();
        S.x = S.A; S.v = 0;
        S.caption = '';
        S.script = script;
        S.seg = -1;
        S.phase = 'script';
        againBtn.textContent = opts.panel === 'graphs' ? 'הפעלה' : againBtn.textContent;
        return new Promise(function (resolve) {
          S.resolve = resolve;
          nextSeg();
        });
      },
      /* Free oscillation from rest at x. */
      release(x) {
        settle();
        S.veiled = false;
        S.script = null;
        clearTrace();
        S.x = x; S.v = 0;
        S.meter = K.cycleMeter(x >= 0 ? 1 : -1);
        S.rate = 1;
        S.phase = 'run';
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'showArrows') { S.showArrows = !!v; loop.requestRender(); return; }
        S[name] = v;
        if (sliders[name]) sliders[name].set(v);
        hold(S.A);
        loop.requestRender();
      },
      advance(seconds) {
        for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120);
      },
      getState() {
        const U0 = 0.5 * S.k * S.x * S.x, K0 = 0.5 * S.m * S.v * S.v;
        return {
          x: S.x, v: S.v, a: accel(S.x), F: -S.k * S.x, t: S.t, phase: S.phase, A: S.A, m: S.m, k: S.k, omega: omega(),
          T: S.meter.T, cycles: S.meter.n, U: U0, K: K0, E: U0 + K0, caption: S.caption, drag: cursorDrag, veiled: S.veiled,
        };
      },
    };
  };
})();

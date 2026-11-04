/* PHY.sims.carGraph: the car that draws its own graphs. A road on top, live graphs underneath.
   mode 'drag'       drag the car; x-t and optionally v-t draw themselves. opts: {showV, xMax, locked}
   mode 'script'     canned motions: sim.play(segs, {x0, rate}) -> Promise. opts.arrows draws v and a.
   mode 'free'       playground: sliders for x0, v0, a. opts: {chapter, section}
   mode 'detective'  game "בלש הגרפים": read a graph, pick the story. opts: {chapter, section, onDone}

   segs: [{T, v}] for constant velocity, or [{T, v0, a}] for constant acceleration; each segment may
   leave v0 out to continue from where the previous one ended.
   setParam: showV, showA, locked. getState(): {t, x, v, a, ...}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;

  /* Exact piecewise motion: returns {T, at(t) -> {x, v, a}, samples(n)}. */
  function motion(segs, x0) {
    const parts = [];
    let t = 0, x = x0 || 0, v = 0;
    segs.forEach(function (s) {
      const a = s.a || 0;
      const v0 = s.v !== undefined ? s.v : s.v0 !== undefined ? s.v0 : v;
      parts.push({ t0: t, T: s.T, x0: x, v0, a });
      x += v0 * s.T + 0.5 * a * s.T * s.T;
      v = v0 + a * s.T;
      t += s.T;
    });
    const T = t;
    function at(q) {
      q = Math.max(0, Math.min(T, q));
      let p = parts[0];
      for (let i = 0; i < parts.length; i++) if (q >= parts[i].t0 - 1e-12) p = parts[i];
      const d = q - p.t0;
      return { x: p.x0 + p.v0 * d + 0.5 * p.a * d * d, v: p.v0 + p.a * d, a: p.a };
    }
    /* Samples with both sides of each jump, so a velocity step is drawn as a real step. */
    function samples(n) {
      const out = [];
      parts.forEach(function (p) {
        const m = Math.max(2, Math.ceil((n * p.T) / T));
        for (let i = 0; i <= m; i++) {
          const d = (i / m) * p.T;
          out.push({ t: p.t0 + d, x: p.x0 + p.v0 * d + 0.5 * p.a * d * d, v: p.v0 + p.a * d, a: p.a });
        }
      });
      return out;
    }
    return { T, at, samples, parts };
  }

  /* The detective's case files. Same motions feed all three levels. */
  const STORIES = {
    rest: { text: 'המכונית חונה. היא עומדת כל הזמן, רחוק מהראשית.', segs: [{ T: 8, v: 0 }], x0: 30 },
    fwd: { text: 'נוסעת קדימה במהירות קבועה, כל הזמן.', segs: [{ T: 8, v: 5 }], x0: 0 },
    back: { text: 'נוסעת אחורה במהירות קבועה, כל הזמן.', segs: [{ T: 8, v: -5 }], x0: 40 },
    stopGo: { text: 'עומדת ברמזור, ואז יוצאת קדימה במהירות קבועה.', segs: [{ T: 4, v: 0 }, { T: 4, v: 6 }], x0: 4 },
    goStop: { text: 'נוסעת קדימה במהירות קבועה, ואז נעצרת ועומדת.', segs: [{ T: 4, v: 6 }, { T: 4, v: 0 }], x0: 4 },
    outBack: { text: 'נוסעת קדימה, ואז חוזרת באותו קצב לנקודת ההתחלה.', segs: [{ T: 4, v: 6 }, { T: 4, v: -6 }], x0: 2 },
    slowFast: { text: 'נוסעת קדימה לאט, ואז ממשיכה קדימה מהר יותר.', segs: [{ T: 4, v: 2 }, { T: 4, v: 8 }], x0: 0 },
    fastSlow: { text: 'נוסעת קדימה מהר, ואז ממשיכה קדימה לאט יותר.', segs: [{ T: 4, v: 8 }, { T: 4, v: 2 }], x0: 0 },
    gas: { text: 'יוצאת מעמידה ומאיצה קדימה. המהירות גדלה בקצב קבוע.', segs: [{ T: 8, v0: 0, a: 1 }], x0: 0 },
    brake: { text: 'נוסעת קדימה ובולמת בקצב קבוע, עד שהיא נעצרת.', segs: [{ T: 8, v0: 8, a: -1 }], x0: 0 },
    turn: { text: 'נוסעת קדימה, בולמת, עוצרת לרגע, וממשיכה לאחור באותה תאוצה.', segs: [{ T: 8, v0: 6, a: -1.5 }], x0: 2 },
    gasBack: { text: 'יוצאת מעמידה ומאיצה לאחור. המהירות נעשית שלילית יותר ויותר.', segs: [{ T: 8, v0: 0, a: -1 }], x0: 34 },
  };
  const LEVELS = [
    { name: 'שלב 1: גרף x–t', pool: ['rest', 'fwd', 'back', 'stopGo', 'goStop', 'outBack', 'slowFast', 'fastSlow'], rounds: 3 },
    { name: 'שלב 2: גרף v–t', pool: ['rest', 'fwd', 'back', 'gas', 'brake', 'turn', 'gasBack', 'outBack'], rounds: 3 },
    { name: 'שלב 3: שני הגרפים', pool: ['rest', 'fwd', 'outBack', 'gas', 'brake', 'turn', 'stopGo', 'goStop'], rounds: 3 },
  ];

  PHY.sims.carGraph = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'drag', xMin: 0, xMax: 50, T: 12, showV: false, showA: false, arrows: false, locked: false }, opts || {});
    const mode = opts.mode;
    const view = PHY.canvas.create(canvasEl, {
      aspect: 1.7,
      minHeight: mode === 'free' ? 500 : mode === 'detective' ? 430 : opts.twoPlots ? 400 : 310,
      maxHeight: mode === 'free' ? 500 : 460,
    });
    const P = H2.pix(view);
    const xt = H2.Plot(view, { title: "מיקום x (מ')", titleColor: 'displacement' });
    const vt = H2.Plot(view, { title: 'מהירות v (מ/ש)', titleColor: 'velocity' });
    const at = H2.Plot(view, { title: 'תאוצה a (מ/ש²)', titleColor: 'acceleration', yMin: -5, yMax: 5, yTick: 5 });

    const S = {
      t: 0, x: opts.x0 === undefined ? (opts.xMin + opts.xMax) / 2 : opts.x0, v: 0, a: 0,
      xMin: opts.xMin, xMax: opts.xMax, T: opts.T,
      showV: opts.showV, showA: opts.showA, locked: opts.locked,
      hist: [], lastSample: -1, dragging: false, recording: false, ended: false, target: 0, prevX: 0,
      m: null, rate: 1, resolve: null, caption: '', marks: [], hold: 0, scriptDone: false, vRange: opts.vRange || null,
    };
    S.target = S.prevX = S.x;

    /* ---------- recording ---------- */
    function record(force) {
      if (force || S.t - S.lastSample >= 1 / 40) {
        S.hist.push({ t: S.t, x: S.x, v: S.v, a: S.a });
        S.lastSample = S.t;
      }
    }
    function clearTrace() {
      S.hist = [];
      S.t = 0;
      S.v = 0;
      S.a = 0;
      S.lastSample = -1;
      S.recording = false;
      S.ended = false;
      S.caption = '';
      loop.requestRender();
    }

    function step(dt) {
      if (S.m) {
        if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) S.caption = ''; return; }
        if (S.marks.length && S.t + dt * S.rate >= S.marks[0].t) {
          const mark = S.marks.shift();
          S.t = mark.t;
          const q0 = S.m.at(S.t);
          S.x = q0.x; S.v = q0.v; S.a = q0.a;
          record(true);
          updateOut();
          S.caption = mark.text;
          S.hold = mark.hold || 1.4;
          return;
        }
        S.t = Math.min(S.m.T, S.t + dt * S.rate);
        const q = S.m.at(S.t);
        S.x = q.x; S.v = q.v; S.a = q.a;
        S.target = S.prevX = S.x;
        record();
        updateOut();
        if (S.t >= S.m.T - 1e-9) {
          record(true);
          updateOut();
          S.m = null;
          if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        }
        return;
      }
      if (mode === 'drag' && S.recording) {
        S.t += dt;
        S.x = S.target;
        const raw = (S.x - S.prevX) / dt;
        S.prevX = S.x;
        S.v += (raw - S.v) * (1 - Math.exp(-dt / 0.14));
        record();
        updateOut();
        if (S.t >= S.T) {
          S.recording = false;
          S.ended = true;
          S.caption = 'נגמר הזמן. לחץ "נקה" כדי לצייר שוב.';
          if (opts.onFinish) opts.onFinish();
        }
      }
    }

    /* ---------- drawing ---------- */
    function roadParams() {
      const narrow = view.w < 520, m = narrow ? 26 : 34;
      return { m, W: view.w, X: (x) => m + ((x - S.xMin) / (S.xMax - S.xMin)) * (view.w - 2 * m), Y: opts.arrows ? 90 : 56 };
    }
    function drawRoad(R) {
      const W = R.W, y = R.Y;
      P.line(6, y, W - 6, y, { color: C.axis, width: 3 });
      const step = H2.niceStep(S.xMax - S.xMin, W < 420 ? 5 : 10);
      for (let i = Math.ceil(S.xMin / step - 1e-9); i * step <= S.xMax + 1e-9; i++) {
        const px = R.X(i * step);
        P.line(px, y - 4, px, y + 4, { color: C.axis, width: 1.5 });
        view.screenText(px, y + 13, F.num(i * step), { size: 10.5, color: Math.abs(i) < 1e-9 ? C.ink : C.soft, weight: Math.abs(i) < 1e-9 ? 800 : 500 });
      }
      view.screenText(W - 8, y - 11, "x (מ')", { size: 11, color: C.soft, align: 'right' });
    }
    function drawCarOn(R) {
      const px = R.X(S.x);
      const back = S.v < -0.2;
      const handle = mode === 'drag' && !S.locked && !S.m;
      if (handle) P.circle(px, R.Y - 12, 27, { fill: C.glow });
      H2.drawCar(view, px, R.Y - 1, { w: 44, flip: back });
      P.cat(px + (back ? 4 : -4), R.Y - 20, { pose: S.dragging ? 'sliding' : 'standing', px: 28, flipX: back });
      if (opts.arrows) {
        const ay = R.Y - 74, s = 8, sa = 14;
        if (Math.abs(S.v) > 0.05) {
          const end = Math.max(8, Math.min(R.W - 8, px + S.v * s));
          P.arrow(px, ay, end, ay, { color: C.velocity, width: 4 });
          view.screenText(px + (S.v > 0 ? -12 : 12), ay, 'v', { color: C.velocity, weight: 800, size: 14, halo: true });
        } else {
          view.screenText(px, ay, 'v = 0', { color: C.velocity, weight: 800, size: 13, halo: true });
        }
        const by = R.Y - 58;
        if (Math.abs(S.a) > 0.01) {
          P.arrow(px, by, px + S.a * sa, by, { color: C.acceleration, width: 4 });
          view.screenText(px + (S.a > 0 ? -12 : 12), by, 'a', { color: C.acceleration, weight: 800, size: 14, halo: true });
        }
      }
    }
    const pts = (key) => S.hist.map((h) => ({ t: h.t, y: h[key] }));

    function placePlots(top, list) {
      const W = view.w, Hh = view.h - top;
      if (W >= 560 && list.length === 2) {
        list[0].box(0, top, W / 2, Hh);
        list[1].box(W / 2, top, W / 2, Hh);
      } else {
        const hh = Hh / list.length;
        list.forEach(function (pl, i) { pl.box(0, top + i * hh, W, hh); });
      }
    }

    function renderStandard() {
      view.clear();
      const R = roadParams();
      drawRoad(R);
      drawCarOn(R);
      const list = [xt];
      if (S.showV) list.push(vt);
      if (S.showA) list.push(at);
      const tMax = opts.fixedT || S.T;
      [xt, vt, at].forEach((pl) => pl.range({ tMin: 0, tMax, tTick: H2.niceStep(tMax, view.w < 420 ? 4 : 6) }));
      xt.range({ yMin: S.xMin, yMax: S.xMax });
      const vr = S.vRange || [-40, 40];
      vt.range({ yMin: vr[0], yMax: vr[1] });
      placePlots(R.Y + 24, list);
      xt.frame();
      xt.curve(pts('x'), { color: C.displacement, width: 3 });
      if (S.hist.length) xt.dot(S.t, S.x, { color: C.displacement });
      if (S.showV) {
        vt.frame();
        vt.curve(pts('v'), { color: C.velocity, width: 3 });
        if (S.hist.length) vt.dot(S.t, S.v, { color: C.velocity });
      }
      if (S.showA) {
        at.frame();
        at.curve(pts('a'), { color: C.acceleration, width: 3 });
        if (S.hist.length) at.dot(S.t, S.a, { color: C.acceleration });
      }
      if (S.caption) view.screenText(view.w / 2, 14, S.caption, { size: 13, weight: 700, pill: true });
      else if (mode === 'drag' && !S.hist.length && !S.locked) view.screenText(view.w / 2, 14, 'גרור את המכונית', { size: 13, weight: 700, pill: true });
    }

    /* ---------- drag mode ---------- */
    let out = null;
    function updateOut() {
      if (!out) return;
      out.set('t', F.unit(S.t, 's', 1));
      out.set('x', F.unit(S.x, 'm', 1));
      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('a', F.unit(S.a, 'ms2', 1));
      if (mode === 'free' && S.hist.length > 1) {
        /* The trapezoid sum over the recorded v(t): the painted area, measured, not the formula. */
        const area = S.hist.reduce(function (sum, h, i) {
          if (!i) return 0;
          const p = S.hist[i - 1];
          return sum + 0.5 * (h.v + p.v) * (h.t - p.t);
        }, 0);
        S.area = area;
        out.set('area', F.unit(area, 'm', 1));
      }
    }

    function buildDrag() {
      out = U.Readouts(controlsEl, [
        { key: 't', label: 'זמן t' },
        { key: 'x', label: 'מיקום x', color: 'var(--c-displacement)' },
        { key: 'v', label: 'מהירות v', color: 'var(--c-velocity)' },
      ].concat(opts.arrows ? [{ key: 'a', label: 'תאוצה a', color: 'var(--c-acceleration)' }] : []));
      if (!opts.noClear) {
        const row = U.h('div', { class: 'sim-row' });
        U.Button(row, 'נקה', function () { S.scriptDone = false; clearTrace(); S.T = opts.T; S.vRange = opts.vRange || null; updateOut(); }, { ghost: true });
        controlsEl.appendChild(row);
      }
      view.drag({
        hit(p) {
          if (S.locked || S.m) return null;
          const R = roadParams();
          const px = view.sx(p.x), py = view.sy(p.y);
          return Math.hypot(px - R.X(S.x), py - (R.Y - 12)) < 34 ? 'car' : null;
        },
        start() {
          S.dragging = true;
          if (S.scriptDone) {
            /* The first drag after a canned run starts a clean graph with the full time window. */
            S.scriptDone = false;
            clearTrace();
            S.T = opts.T;
            S.vRange = opts.vRange || null;
          }
          if (!S.recording && !S.ended) {
            S.recording = true;
            S.prevX = S.target = S.x;
            if (opts.onDragStart) opts.onDragStart();
          }
          loop.start();
        },
        move(_, p) {
          const R = roadParams();
          const m = R.m;
          const x = S.xMin + ((view.sx(p.x) - m) / (R.W - 2 * m)) * (S.xMax - S.xMin);
          S.target = Math.max(S.xMin, Math.min(S.xMax, x));
          if (!S.recording) { S.x = S.target; loop.requestRender(); }
        },
        end() { S.dragging = false; },
      });
      updateOut();
    }

    /* ---------- free mode ---------- */
    const FREE = { x0: 0, v0: 2, a: 1, T: 8 };
    let freeMotion = null, marked = false;
    function refreshFree() {
      freeMotion = motion([{ T: FREE.T, v0: FREE.v0, a: FREE.a }], FREE.x0);
      const samples = freeMotion.samples(80);
      const xs = samples.map((s) => s.x), vs = samples.map((s) => s.v);
      const rx = H2.niceRange(Math.min.apply(null, xs.concat(0)), Math.max.apply(null, xs.concat(0)), 20);
      S.xMin = rx.min;
      S.xMax = rx.max;
      const rv = H2.niceRange(Math.min.apply(null, vs.concat(0)), Math.max.apply(null, vs.concat(0)), 10);
      vt.range({ yMin: rv.min, yMax: rv.max });
      if (!S.m) {
        S.t = 0;
        S.hist = [];
        S.lastSample = -1;
        const q = freeMotion.at(0);
        S.x = q.x; S.v = q.v; S.a = q.a;
      }
      updateOut();
      out.set('area', '—');
      loop.requestRender();
    }
    function markFree() {
      if (!marked && opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      marked = true;
    }
    function buildFree() {
      const onInput = function (key) { return function (v) { FREE[key] = v; S.m = null; S.resolve = null; refreshFree(); markFree(); }; };
      U.Slider(controlsEl, { label: 'מיקום התחלתי ‎x₀', min: -20, max: 20, step: 1, value: FREE.x0, unit: 'm', digits: 0, color: 'var(--c-displacement)', onInput: onInput('x0') });
      U.Slider(controlsEl, { label: 'מהירות התחלתית ‎v₀', min: -10, max: 10, step: 0.5, value: FREE.v0, unit: 'ms', digits: 1, color: 'var(--c-velocity)', onInput: onInput('v0') });
      U.Slider(controlsEl, { label: 'תאוצה a', min: -4, max: 4, step: 0.5, value: FREE.a, unit: 'ms2', digits: 1, color: 'var(--c-acceleration)', onInput: onInput('a') });
      const row = U.h('div', { class: 'sim-row' });
      U.Button(row, 'סע!', function () { api.run(); markFree(); }, { primary: true });
      controlsEl.appendChild(row);
      out = U.Readouts(controlsEl, [
        { key: 't', label: 'זמן t' },
        { key: 'x', label: 'מיקום x', color: 'var(--c-displacement)' },
        { key: 'v', label: 'מהירות v', color: 'var(--c-velocity)' },
        { key: 'a', label: 'תאוצה a', color: 'var(--c-acceleration)' },
        { key: 'area', label: 'שטח מתחת לגרף v–t', color: 'var(--c-displacement)' },
      ]);
      refreshFree();
    }
    function renderFree() {
      view.clear();
      const R = roadParams();
      drawRoad(R);
      drawCarOn(R);
      const T = FREE.T;
      [xt, vt, at].forEach((pl) => pl.range({ tMin: 0, tMax: T, tTick: 1 }));
      xt.range({ yMin: S.xMin, yMax: S.xMax });
      placePlots(R.Y + 22, [xt, vt, at]);
      const ghost = freeMotion.samples(80);
      xt.frame();
      xt.curve(ghost.map((s) => ({ t: s.t, y: s.x })), { color: C.displacement, width: 1.5, dash: [4, 5], alpha: 0.55 });
      vt.frame();
      vt.curve(ghost.map((s) => ({ t: s.t, y: s.v })), { color: C.velocity, width: 1.5, dash: [4, 5], alpha: 0.55 });
      at.frame();
      at.curve([{ t: 0, y: FREE.a }, { t: T, y: FREE.a }], { color: C.acceleration, width: 1.5, dash: [4, 5], alpha: 0.55 });
      if (S.hist.length) {
        vt.fill(pts('v'), { color: C.displacement, alpha: 0.2 });
        xt.curve(pts('x'), { color: C.displacement, width: 3 });
        vt.curve(pts('v'), { color: C.velocity, width: 3 });
        at.curve(pts('a'), { color: C.acceleration, width: 3 });
        xt.dot(S.t, S.x, { color: C.displacement });
        vt.dot(S.t, S.v, { color: C.velocity });
        at.dot(S.t, S.a, { color: C.acceleration });
      }
    }

    /* ---------- detective game ---------- */
    const G = { level: 0, round: 0, points: [], score: 0, wrong: 0, story: null, options: [], answer: -1, phase: 'pick', used: [], m: null };
    let hud = null, optBox = null, nextRow = null;
    const LETTERS = ['א', 'ב', 'ג'];

    function buildDetective() {
      hud = H2.gameHud(controlsEl, LEVELS.map((l) => l.name));
      optBox = U.h('div', { class: 'predict-options', role: 'radiogroup' });
      nextRow = U.h('div', { class: 'sim-row' });
      hud.main.appendChild(hud.task);
      hud.main.appendChild(optBox);
      hud.main.appendChild(hud.feedback);
      hud.main.appendChild(nextRow);
      restartGame();
    }
    function restartGame() {
      G.points = [];
      hud.showMain();
      startLevel(0);
    }
    function startLevel(i) {
      G.level = i;
      G.round = 0;
      G.score = 0;
      G.used = [];
      hud.paint(G.level, G.points, false);
      nextRound();
    }
    function fitStory(st) {
      const m = motion(st.segs, st.x0);
      const s = m.samples(100);
      return {
        m, s,
        xr: H2.niceRange(Math.min.apply(null, s.map((p) => p.x).concat(0)), Math.max.apply(null, s.map((p) => p.x).concat(0)), 10),
        vr: H2.niceRange(Math.min.apply(null, s.map((p) => p.v).concat(0)), Math.max.apply(null, s.map((p) => p.v).concat(0)), 8),
      };
    }
    function nextRound() {
      const lv = LEVELS[G.level];
      const free = lv.pool.filter((k) => G.used.indexOf(k) < 0);
      const key = H2.pick(free);
      G.used.push(key);
      G.story = key;
      G.wrong = 0;
      G.phase = 'pick';
      G.fit = fitStory(STORIES[key]);
      S.m = null;
      S.t = 0;
      S.hist = [];
      S.lastSample = -1;
      S.xMin = G.fit.xr.min;
      S.xMax = G.fit.xr.max;
      const q = G.fit.m.at(0);
      S.x = q.x; S.v = q.v; S.a = q.a;
      hud.say('');
      nextRow.innerHTML = '';
      let optionKeys;
      if (G.level < 2) {
        optionKeys = [key].concat(H2.shuffle(lv.pool.filter((k) => k !== key)).slice(0, 2));
        G.options = H2.shuffle(optionKeys).map((k) => ({ key: k, right: k === key }));
        hud.setTask(G.level === 0
          ? 'הנה גרף x–t של נסיעה אחת (סיבוב ' + (G.round + 1) + ' מתוך ' + lv.rounds + '). איזה סיפור מתאים לו?'
          : 'עכשיו גרף v–t (סיבוב ' + (G.round + 1) + ' מתוך ' + lv.rounds + '). זהירות: זה גרף של מהירות, לא של מיקום. איזה סיפור מתאים?');
        optBox.innerHTML = '';
        G.buttons = G.options.map(function (o, i) { return addOption(STORIES[o.key].text, i); });
      } else {
        /* Option א of the wrong answers is the classic error: a v-t graph copied from the x-t shape. */
        const other = H2.shuffle(lv.pool.filter((k) => k !== key))[0];
        const candidates = [{ kind: 'true', key }, { kind: 'copy', key }, { kind: 'true', key: other }];
        G.options = H2.shuffle(candidates).map((c) => ({ kind: c.kind, key: c.key, right: c.kind === 'true' && c.key === key, curve: curveFor(c) }));
        hud.setTask('הגרף למעלה הוא x–t (סיבוב ' + (G.round + 1) + ' מתוך ' + lv.rounds + '). איזה מבין הגרפים הקטנים הוא ה-v–t של אותה נסיעה?');
        optBox.innerHTML = '';
        G.buttons = G.options.map(function (o, i) { return addOption('גרף ' + LETTERS[i], i); });
      }
      G.answer = G.options.findIndex((o) => o.right);
      hud.paint(G.level, G.points, false);
      loop.requestRender();
    }
    function curveFor(c) {
      const fit = fitStory(STORIES[c.key]);
      if (c.kind === 'copy') {
        const top = Math.max.apply(null, fit.s.map((p) => Math.abs(p.x))) || 1;
        return { pts: fit.s.map((p) => ({ t: p.t, y: (p.x / top) * 6 })) };
      }
      return { pts: fit.s.map((p) => ({ t: p.t, y: p.v })) };
    }
    function addOption(text, i) {
      const mark = U.h('span', { class: 'opt-mark', 'aria-hidden': 'true' });
      const b = U.h('button', { type: 'button', class: 'opt', role: 'radio', 'aria-checked': 'false' }, [mark, U.h('span', { html: text })]);
      b.addEventListener('click', function () { choose(i); });
      optBox.appendChild(b);
      return b;
    }
    function choose(i) {
      if (G.phase !== 'pick') return;
      const b = G.buttons[i];
      if (!G.options[i].right) {
        G.wrong++;
        b.classList.add('is-wrong');
        b.disabled = true;
        b.querySelector('.opt-mark').textContent = '✗';
        const tip = G.level === 0
          ? 'עוד לא. בגרף x–t הגובה הוא איפה המכונית, והשיפוע הוא כמה מהר.'
          : G.level === 1
            ? 'עוד לא. בגרף v–t הגובה הוא כמה מהר, לא איפה. קו אופקי פירושו מהירות קבועה.'
            : (G.options[i].kind === 'copy' ? 'זו הטעות הכי נפוצה: העתקת את צורת ה-x–t. המהירות היא השיפוע של x–t, לא הגובה שלו.' : 'עוד לא. קרא את השיפוע של x–t בכל רגע, והוא הגובה של v–t.');
        hud.say(tip, 'bad');
        PHY.mascot.say('גם אני קראתי את הגרף הזה הפוך. פעם.', 'thinking');
        return;
      }
      b.classList.add('is-correct');
      b.querySelector('.opt-mark').textContent = '✓';
      if (G.wrong === 0) G.score++;
      G.phase = 'run';
      G.buttons.forEach((x) => { x.disabled = true; });
      hud.say(G.wrong === 0 ? 'בדיוק. צפה במכונית נוסעת לפי הגרף.' : 'נכון. צפה במכונית נוסעת לפי הגרף.', 'good');
      S.t = 0;
      S.hist = [];
      S.lastSample = -1;
      S.m = G.fit.m;
      S.marks = [];
      S.hold = 0;
      S.rate = 2.2;
      S.resolve = afterRun;
    }
    function afterRun() {
      G.phase = 'next';
      nextRow.innerHTML = '';
      const lv = LEVELS[G.level];
      const more = G.round < lv.rounds - 1;
      const label = more ? 'סיבוב הבא' : G.level < LEVELS.length - 1 ? 'לשלב הבא' : 'לסיכום';
      G.nextBtn = U.Button(nextRow, label, function () {
        if (more) { G.round++; nextRound(); return; }
        G.points[G.level] = G.score;
        if (G.level < LEVELS.length - 1) startLevel(G.level + 1);
        else finishGame();
      }, { primary: true });
    }
    function finishGame() {
      const total = G.points.reduce((a, b) => a + b, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      hud.paint(-1, G.points, true);
      hud.showFinal(stars, 'פיצחת ' + total + ' מתוך 9 תיקים בניסיון ראשון. ' + (stars === 3 ? 'ניוטון מוסר לך את זכוכית המגדלת שלו.' : stars === 2 ? 'בלש טוב. בסיבוב הבא התיקים אחרים.' : 'התיקים נסגרו. בסיבוב הבא תקרא אותם מהר יותר.'), restartGame);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      G.phase = 'done';
      G.stars = stars;
      if (opts.onDone) opts.onDone(stars, total);
    }
    function renderDetective() {
      view.clear();
      const R = roadParams();
      drawRoad(R);
      drawCarOn(R);
      const f = G.fit;
      const top = R.Y + 22, W = view.w, H = view.h;
      if (!f) return;
      const T = f.m.T;
      const running = S.hist.length > 0;
      if (G.level === 0 || G.level === 2) {
        xt.range({ tMin: 0, tMax: T, tTick: 2, yMin: f.xr.min, yMax: f.xr.max });
        xt.box(0, top, W, G.level === 2 ? (H - top) * 0.52 : H - top);
        xt.frame();
        xt.curve(f.s.map((p) => ({ t: p.t, y: p.x })), { color: C.displacement, width: 3 });
        if (running) xt.dot(S.t, S.x, { color: C.displacement });
      } else {
        vt.range({ tMin: 0, tMax: T, tTick: 2, yMin: f.vr.min, yMax: f.vr.max });
        vt.box(0, top, W, H - top);
        vt.frame();
        vt.curve(f.s.map((p) => ({ t: p.t, y: p.v })), { color: C.velocity, width: 3 });
        if (running) vt.dot(S.t, S.v, { color: C.velocity });
      }
      if (G.level === 2) {
        const y0 = top + (H - top) * 0.52, w3 = W / 3;
        G.options.forEach(function (o, i) {
          /* RTL reading order: א on the right. */
          const col = 2 - i;
          const pl = H2.Plot(view, { title: 'גרף ' + LETTERS[i], titleColor: 'velocity', tLabel: '', compact: true, noTicks: true, tMin: 0, tMax: T, tTick: 2, yMin: -9, yMax: 9, yTick: 3 });
          pl.box(col * w3 - 12, y0, w3 + 6, H - y0 - 2);
          pl.frame();
          pl.curve(o.curve.pts, { color: C.velocity, width: 2.6 });
          if (running && o.right) pl.dot(S.t, S.v, { color: C.velocity, r: 4.5 });
        });
      }
    }

    /* ---------- wiring ---------- */
    const render = mode === 'free' ? renderFree : mode === 'detective' ? renderDetective : renderStandard;
    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        S.m = null;
        S.resolve = null;
        clearTrace();
        if (mode === 'free') refreshFree();
        else updateOut();
      },
      setParam(name, v) {
        if (name === 'showV') S.showV = !!v;
        if (name === 'showA') S.showA = !!v;
        if (name === 'locked') S.locked = !!v;
        if (name === 'x') { S.x = S.target = S.prevX = v; }
        if (name === 'caption') S.caption = v || '';
        if (name in FREE && mode === 'free') { FREE[name] = v; refreshFree(); return; }
        loop.requestRender();
      },
      getState() {
        const st = { t: S.t, x: S.x, v: S.v, a: S.a, samples: S.hist.length, locked: S.locked, area: S.area };
        if (mode === 'detective') Object.assign(st, { level: G.level, round: G.round, phase: G.phase, answer: G.answer, points: G.points.slice(), stars: G.stars });
        return st;
      },
      /* Plays canned motion with the exact solution. Resolves at the end. */
      play(segs, o) {
        o = o || {};
        if (S.resolve) { S.resolve(); S.resolve = null; }
        clearTrace();
        S.m = motion(segs, o.x0 === undefined ? S.x : o.x0);
        S.T = o.fixedT || S.m.T;
        S.rate = o.rate || 1;
        S.marks = (o.marks || []).slice();
        S.hold = 0;
        S.scriptDone = true;
        if (o.vRange) S.vRange = o.vRange;
        const start = S.m.at(0);
        S.x = S.target = S.prevX = start.x;
        S.v = start.v;
        S.a = start.a;
        record(true);
        return new Promise(function (res) { S.resolve = res; });
      },
      /* Free mode: run from t = 0 with the current sliders. */
      run() {
        S.t = 0;
        S.hist = [];
        S.lastSample = -1;
        S.m = freeMotion;
        S.rate = 1;
        const start = freeMotion.at(0);
        S.x = start.x; S.v = start.v; S.a = start.a;
        record(true);
        return new Promise(function (res) { S.resolve = res; });
      },
      /* Detective: same path as a click. */
      choose,
      next() { if (G.nextBtn) G.nextBtn.click(); },
    };

    if (mode === 'drag' || mode === 'script') buildDrag();
    if (mode === 'free') buildFree();
    if (mode === 'detective') buildDetective();
    return api;
  };
})();

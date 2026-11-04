/* PHY.sims.kepler: Kepler's laws, measured from a running orbit.
   mode 'areas': an ellipse from the real integrator. Every tenth of a period a colored wedge from Earth is closed,
   and its area is measured from the points of the path. Equal time, equal area, and the speed arrow shows why.
   mode 'third': a circular orbit with r on a slider, over an Earth turning once in 24 h. Geostationary means the
   satellite stays over the same point. Three presets. T²/r³ is printed and does not move.
   sim.play() -> Promise (areas). setParam: e, locked; r (third). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const A = 3 * R;
  const WEDGES = 10;
  /* Within this share of 24 h the drift is too small to see in one displayed day. */
  const GEO_TOL = 0.002;

  PHY.sims.kepler = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'areas', locked: true, e: 0.6 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.3, minHeight: 300, maxHeight: 450 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      mode: opts.mode, locked: opts.locked, e: opts.e, run: 0, b: null, t: 0, T: 0, running: false, wedges: [], cur: [], caption: '', accel: 1, resolve: null,
      rVal: 6800e3, sat: null, satAngle: 90, earthAngle: 90, sim: 0, marks: [], vMax: 0, vMin: Infinity, played: false,
    };

    let eSlider = null, rSlider = null, btn = null, out;
    const logMin = Math.log10(1.05), logMax = Math.log10(65);
    if (S.mode === 'areas') {
      eSlider = U.Slider(controlsEl, {
        label: 'כמה המסלול מעוך', min: 0, max: 0.65, step: 0.05, value: S.e, format: (v) => F.num(v, 2), color: 'var(--accent)',
        onInput(v) { S.e = v; prepare(); },
      });
      const row = U.h('div', { class: 'sim-row' });
      btn = U.Button(row, 'עוד הקפה', function () { if (!S.locked) api.play(); }, { primary: true });
      controlsEl.appendChild(row);
      out = U.Readouts(controlsEl, [
        { key: 'vp', label: 'הכי קרוב: מהירות', color: 'var(--c-velocity)' },
        { key: 'va', label: 'הכי רחוק: מהירות', color: 'var(--c-velocity)' },
        { key: 'T', label: 'זמן הקפה' },
        { key: 'area', label: 'שטח כל פרוסה' },
      ]);
    } else {
      rSlider = U.Slider(controlsEl, {
        label: 'מרחק מהמרכז', min: 0, max: 10000, step: 1, value: rToSlider(S.rVal), format: (v) => kmRound(sliderToR(v)), color: 'var(--c-displacement)',
        onInput(v) { S.rVal = sliderToR(v); changedR(); },
      });
      const row = U.h('div', { class: 'sim-row' });
      U.Button(row, 'תחנת חלל', function () { api.setParam('r', 6800e3); }, { ghost: true });
      U.Button(row, 'גיאוסטציונרי', function () { api.setParam('r', api.geoRadius()); }, { ghost: true });
      U.Button(row, 'הירח', function () { api.setParam('r', 60 * R); }, { ghost: true });
      controlsEl.appendChild(row);
      out = U.Readouts(controlsEl, [
        { key: 'r', label: 'מרחק מהמרכז', color: 'var(--c-displacement)' },
        { key: 'T', label: 'זמן הקפה' },
        { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
        { key: 'k', label: 'T² / r³' },
      ]);
    }
    function sliderToR(v) { return R * Math.pow(10, logMin + (v / 10000) * (logMax - logMin)); }
    function rToSlider(r) { return Math.round(((Math.log10(r / R) - logMin) / (logMax - logMin)) * 10000); }
    /* To the nearest 10 km, so the slider and the readout never disagree by a rounding step. */
    function kmRound(r) { return G.commas(Math.round(r / 1e4) * 10) + ' ' + G.KM; }
    function changedR() {
      S.satAngle = S.earthAngle;
      S.sim = 0;
      loop.requestRender();
    }

    /* Before the guess, the speeds at the two ends of the ellipse and the speed arrow stay hidden. */
    const secret = () => S.mode === 'areas' && S.locked && !S.played;

    function setLocked(v) {
      S.locked = v;
      if (eSlider) eSlider.setEnabled(!v);
      if (btn) btn.disabled = v;
      loop.requestRender();
    }

    /* Start at the far point of the chosen ellipse, moving so the fast side is at Earth's right. */
    function prepare() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      const ra = A * (1 + S.e);
      const v = Math.sqrt(G.GM * (2 / ra - 1 / A));
      S.b = G.body(-ra, 0, 0, -v);
      S.T = G.TAU * Math.sqrt((A * A * A) / G.GM);
      S.t = 0;
      S.running = false;
      S.wedges = [];
      S.cur = [{ x: S.b.x, y: S.b.y }];
      S.curArea = 0;
      S.vMax = 0;
      S.vMin = Infinity;
      S.caption = '';
      if (loop) loop.requestRender();
    }

    function stepAreas(dt) {
      const total = dt * S.accel;
      const n = Math.max(1, Math.ceil(total / 4));
      const h = total / n;
      for (let i = 0; i < n && S.running; i++) {
        const edge = (S.wedges.length + 1) * (S.T / WEDGES);
        const use = Math.min(h, edge - S.t);
        const px = S.b.x, py = S.b.y;
        G.verlet(S.b, use);
        S.t += use;
        /* The area is added up from every integration step. Only enough points are kept to draw it. */
        S.curArea += Math.abs(px * S.b.y - S.b.x * py) / 2;
        const last = S.cur[S.cur.length - 1];
        if (Math.hypot(S.b.x - last.x, S.b.y - last.y) > 0.06 * R) S.cur.push({ x: S.b.x, y: S.b.y });
        const v = Math.hypot(S.b.vx, S.b.vy);
        S.vMax = Math.max(S.vMax, v);
        S.vMin = Math.min(S.vMin, v);
        if (S.t >= edge - 1e-6) {
          S.cur.push({ x: S.b.x, y: S.b.y });
          S.wedges.push({ pts: S.cur, area: S.curArea, t: S.t });
          S.cur = [{ x: S.b.x, y: S.b.y }];
          S.curArea = 0;
          if (S.wedges.length >= WEDGES) {
            S.running = false;
            if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
          }
        }
      }
    }

    function step(dt) {
      tw.step(dt);
      if (S.mode === 'areas') { if (S.running) stepAreas(dt); return; }
      /* third: 24 h on the clock takes 6 s, and both Earth and the satellite use the same clock */
      const simDt = (dt * 86400) / 6;
      S.sim += simDt;
      S.earthAngle -= (simDt / 86400) * 360;
      S.satAngle -= (simDt / G.period(S.rVal)) * 360;
    }

    function renderAreas() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const ra = A * (1 + S.e), rp = A * (1 - S.e);
      const span = ra + rp;
      const halfH = A * Math.sqrt(1 - S.e * S.e);
      const k = Math.min((w - 34) / span, (h - 46) / (2 * halfH));
      const cx = (w - span * k) / 2 + ra * k;
      const cy = h / 2 + 8;
      const map = (p) => ({ x: cx + p.x * k, y: cy - p.y * k });
      view.clear();
      G.drawStars(view);
      /* Whole ellipse, faint */
      const el = G.elements(S.b);
      const path = G.orbitPath(el, 160);
      if (path[0]) G.drawPath(view, path[0], map, { color: C.gridStrong, width: 1.6, dash: [3, 5] });
      /* Wedges */
      const ctx = view.ctx;
      const paintWedge = function (pts, color) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        pts.forEach(function (p) { const q = map(p); ctx.lineTo(q.x, q.y); });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.34;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
      };
      S.wedges.forEach(function (W, i) { paintWedge(W.pts, i % 2 ? C.gold : C.accent); });
      if (S.running && S.cur.length > 1) paintWedge(S.cur, S.wedges.length % 2 ? C.gold : C.accent);
      G.drawEarth(view, cx, cy, Math.max(7, R * k));
      /* The cat on his satellite */
      const q = map(S.b);
      const sp = Math.hypot(S.b.vx, S.b.vy) || 1;
      const rot = (Math.atan2(S.b.vy, S.b.vx) * 180) / Math.PI;
      PHY.mascot.draw(view, view.toWorld(q.x, q.y).x, view.toWorld(q.x, q.y).y, { pose: 'flying', px: small ? 26 : 34, rot });
      const vLen = (sp / 9300) * (small ? 58 : 76);
      if (!secret()) P.arrow(q.x, q.y, q.x + (S.b.vx / sp) * vLen, q.y - (S.b.vy / sp) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 12, labelGap: 10 });
      if (S.caption) view.screenText(w / 2, 15, S.caption, { size: small ? 12 : 13.5, weight: 700, pill: true });

      const vp = Math.sqrt(G.GM * (2 / rp - 1 / A)), va = Math.sqrt(G.GM * (2 / ra - 1 / A));
      out.set('vp', secret() ? '?' : G.kms(vp));
      out.set('va', secret() ? '?' : G.kms(va));
      out.set('T', G.dur(S.T));
      const last = S.wedges[S.wedges.length - 1];
      out.set('area', last ? G.ltr(F.num(last.area / (R * R), 2) + ' R²') : '...');
    }

    function renderThird() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const r = S.rVal;
      const T = G.period(r);
      const cx = w / 2, cy = h / 2 + 6;
      const k = (Math.min(w, h - 24) / 2 - 12) / (r * 1.08);
      view.clear();
      G.drawStars(view);
      P.circle(cx, cy, r * k, { color: C.gridStrong, width: 1.2, dash: [3, 5] });
      const ePx = Math.max(6, R * k);
      G.drawEarth(view, cx, cy, ePx, { rot: S.earthAngle });
      const ea = (S.earthAngle * Math.PI) / 180;
      P.line(cx, cy, cx + Math.cos(ea) * (ePx + 7), cy - Math.sin(ea) * (ePx + 7), { color: C.ink, width: 3 });
      P.circle(cx + Math.cos(ea) * (ePx + 7), cy - Math.sin(ea) * (ePx + 7), 3.5, { fill: C.ink });
      const sa = (S.satAngle * Math.PI) / 180;
      const sx = cx + Math.cos(sa) * r * k, sy = cy - Math.sin(sa) * r * k;
      G.drawSat(view, sx, sy, small ? 10 : 13, { color: C.gold });
      const geo = Math.abs(T / 86400 - 1) < GEO_TOL;
      if (geo) {
        P.line(cx, cy, sx, sy, { color: C.soft, width: 1.6, dash: [5, 5] });
        view.screenText(w / 2, 16, 'תמיד מעל אותה נקודה!', { size: small ? 12.5 : 14, weight: 800, color: C.good, pill: true });
      } else {
        view.screenText(w / 2, 16, 'הקו על כדור הארץ מסתובב פעם ב-24 שעות', { size: small ? 11.5 : 12.5, color: C.soft });
      }
      out.set('r', kmRound(r));
      out.set('T', G.dur(T));
      out.set('v', G.kms(G.vCirc(r), 2));
      out.set('k', G.ltr(F.num((T * T) / (r * r * r) * 1e14, 2) + '×10⁻¹⁴'));
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.mode === 'third' || S.running; });
    function render() {
      if (!drawNow()) return;
      if (S.mode === 'areas') renderAreas();
      else renderThird();
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.played = false;
        if (S.mode === 'areas') prepare();
        setLocked(opts.locked);
      },
      setParam(name, v) {
        if (name === 'e') { S.e = v; if (eSlider) eSlider.set(v); prepare(); }
        if (name === 'r') { S.rVal = v; if (rSlider) rSlider.set(rToSlider(v)); changedR(); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        if (S.mode === 'third') {
          const T = G.period(S.rVal);
          return { mode: S.mode, r: S.rVal, T, v: G.vCirc(S.rVal), ratio: (T * T) / Math.pow(S.rVal, 3), satAngle: S.satAngle, earthAngle: S.earthAngle, geo: Math.abs(T / 86400 - 1) < GEO_TOL };
        }
        const ra = A * (1 + S.e), rp = A * (1 - S.e);
        return {
          mode: S.mode, e: S.e, t: S.t, T: S.T, running: S.running, wedges: S.wedges.map((W) => W.area), wedgeCount: S.wedges.length, vMax: S.vMax, vMin: S.vMin,
          vp: Math.sqrt(G.GM * (2 / rp - 1 / A)), va: Math.sqrt(G.GM * (2 / ra - 1 / A)), rp, ra, x: S.b.x, y: S.b.y, locked: S.locked, secret: secret(),
        };
      },
      /* r for a 24 h period: T = 2π√(r³/GM). */
      geoRadius() { return Math.cbrt((G.GM * 86400 * 86400) / (G.TAU * G.TAU)); },
      async play() {
        const id = ++S.run;
        const wasLocked = S.locked;
        S.played = true;
        setLocked(true);
        prepare();
        S.accel = S.T / 8.5;
        S.running = true;
        await new Promise(function (resolve) { S.resolve = resolve; });
        if (id !== S.run) return;
        S.caption = 'לכל הפרוסות אותו שטח';
        if (!wasLocked) setLocked(false);
      },
    };
    if (S.mode === 'areas') prepare();
    setLocked(opts.locked);
    return api;
  };
})();

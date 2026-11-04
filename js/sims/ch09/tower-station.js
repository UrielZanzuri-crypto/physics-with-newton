/* PHY.sims.towerStation: a cat on a scale, high up. One sim, two questions.
   mode 'float': the same 400 km three ways. On a tower the scale reads m·g(400 km). Without the tower the cabin
   falls with the cat and the scale reads 0. With 7.8 km/s sideways it falls the same way and misses Earth.
   The reading is always m(g - a) from the real numbers.
   mode 'height': the cat rises to h = R while two rulers, h and r, show why the scale reads a quarter.
   sim.play() -> Promise. setParam: height (m, height mode), locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const H_STATION = 4e5;
  const MASS = 5;

  PHY.sims.towerStation = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'float', locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.65, minHeight: 300, maxHeight: 430 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      mode: opts.mode, locked: opts.locked, run: 0, caption: '', phase: 'tower', b: null, trail: [],
      aCabin: 0, h: 0, spin: 0, wobble: 0, seen: {}, accel: 1, played: false,
    };

    let hSlider = null;
    if (S.mode === 'height') {
      hSlider = U.Slider(controlsEl, {
        label: 'גובה מעל הקרקע', min: 0, max: 3 * R / 1000, step: 100, value: 0, format: (v) => G.commas(v) + ' ' + G.KM, color: 'var(--c-displacement)',
        onInput(v) { S.h = v * 1000; S.caption = ''; loop.requestRender(); },
      });
    }
    const out = U.Readouts(controlsEl, S.mode === 'float' ? [
      { key: 'h', label: 'גובה' },
      { key: 'g', label: 'g במקום הזה', color: 'var(--c-acceleration)' },
      { key: 'a', label: 'תאוצת התא', color: 'var(--c-acceleration)' },
      { key: 'w', label: 'המאזניים', color: 'var(--c-force)' },
    ] : [
      { key: 'h', label: 'h, מהקרקע' },
      { key: 'r', label: 'r, מהמרכז', color: 'var(--c-displacement)' },
      { key: 'g', label: 'g במקום הזה', color: 'var(--c-acceleration)' },
      { key: 'w', label: 'המאזניים', color: 'var(--c-force)' },
    ]);

    /* Before the guess, the stage only shows what the question gives. */
    const secret = () => S.locked && !S.played;

    function setLocked(v) {
      S.locked = v;
      if (hSlider) hSlider.setEnabled(!v);
    }
    const rNow = () => (S.mode === 'height' ? R + S.h : S.b ? Math.hypot(S.b.x, S.b.y) : R + H_STATION);
    const gNow = () => G.gAt(rNow());
    const reading = () => MASS * Math.max(0, gNow() - S.aCabin);

    function resetFloat() {
      S.phase = 'tower';
      S.b = G.body(0, R + H_STATION, 0, 0);
      S.trail = [];
      S.aCabin = 0;
      S.spin = 0;
      S.wobble = 0;
    }

    function step(dt) {
      tw.step(dt);
      if (S.mode !== 'float') return;
      if (S.phase === 'fall' || S.phase === 'orbit') {
        const total = dt * S.accel;
        G.advance(S.b, total, 8);
        S.aCabin = Math.hypot(S.b.ax, S.b.ay);
        const last = S.trail[S.trail.length - 1];
        if (!last || Math.hypot(S.b.x - last.x, S.b.y - last.y) > R * 0.03) S.trail.push({ x: S.b.x, y: S.b.y });
        S.spin += dt * 25;
        S.wobble += dt;
      }
    }

    /* Cabin interior in pixels. */
    function drawCabin(L, floating, labelText) {
      const ctx = view.ctx;
      const small = L.small;
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(L.cabX, L.cabY, L.cabW, L.cabH, 14);
      else ctx.rect(L.cabX, L.cabY, L.cabW, L.cabH);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const cx = L.cabX + L.cabW / 2;
      const floor = L.cabY + L.cabH - 30;
      G.drawScale(view, cx, floor, Math.min(L.cabW - 28, 118), secret() ? '?' : F.unit(reading(), 'N', 1), { size: small ? 13 : 15, color: C.force, h: 24 });
      const px = small ? 58 : 80;
      const lift = floating ? (small ? 66 : 92) + 7 * Math.sin(S.wobble * 2.2) : 0;
      P.cat(cx, floor - lift, { pose: floating ? 'flying' : 'standing', px, rot: floating ? S.spin : 0, anchor: floating ? [0.5, 0.6] : undefined });
      if (labelText) view.screenText(cx, L.cabY + 15, labelText, { size: small ? 11.5 : 13, weight: 700, color: C.soft });
      /* The force the floor gives */
      const w = reading();
      if (w > 0.5 && !secret()) {
        const len = Math.min(58, w * 1.1);
        P.arrow(cx + (small ? 36 : 50), floor - 2, cx + (small ? 36 : 50), floor - 2 - len, { color: C.force, width: 3.5, label: 'N', labelSize: 12, labelGap: 11 });
      }
    }

    function layout() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const split = small ? w * 0.5 : w * 0.56;
      return {
        w, h, small, split,
        ex: split / 2, ey: (h - 36) / 2 + 13, er: Math.min(split / 2 - 18, (h - 36) / 2 - 30),
        cabX: split + 6, cabY: 8, cabW: w - split - 14, cabH: h - 48,
      };
    }

    function renderFloat() {
      const L = layout();
      view.clear();
      G.drawStars(view, 26);
      const k = L.er / R;
      const map = (p) => ({ x: L.ex + p.x * k, y: L.ey - p.y * k });
      G.drawEarth(view, L.ex, L.ey, L.er);
      const r0 = R + H_STATION;
      P.circle(L.ex, L.ey, r0 * k, { color: C.gridStrong, width: 1.2, dash: [3, 5] });
      /* Tower */
      if (S.phase === 'tower' && !secret()) {
        P.line(L.ex, L.ey - L.er, L.ex, L.ey - r0 * k, { color: C.axis, width: 5, cap: 'butt' });
      }
      G.drawPath(view, S.trail, map, { color: C.accent, width: 2.4 });
      const q = map(S.b);
      G.drawSat(view, q.x, q.y, L.small ? 11 : 14, { color: C.gold });
      /* a in red, always at the station */
      const rr = Math.hypot(S.b.x, S.b.y);
      const aLen = (L.small ? 30 : 40) * (gNow() / 10);
      if (S.aCabin > 0.1) P.arrow(q.x, q.y, q.x - (S.b.x / rr) * aLen, q.y + (S.b.y / rr) * aLen, { color: C.acceleration, width: 3, label: 'a', labelSize: 12, labelGap: 10 });
      if (S.phase === 'orbit') {
        const sp = Math.hypot(S.b.vx, S.b.vy) || 1;
        const vLen = L.small ? 32 : 42;
        P.arrow(q.x, q.y, q.x + (S.b.vx / sp) * vLen, q.y - (S.b.vy / sp) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 12, labelGap: 10 });
      }
      view.screenText(L.ex, 18, secret() ? 'תחנה בגובה 400 ק"מ' : S.phase === 'tower' ? 'מגדל בגובה 400 ק"מ' : S.phase === 'fall' ? 'בלי המגדל' : 'עם מהירות הצידה', { size: L.small ? 12 : 13.5, weight: 700, color: C.soft });
      drawCabin(L, S.phase !== 'tower' || secret(), 'בתוך התא');
      if (S.caption) view.screenText(L.w / 2, L.h - 18, S.caption, { size: L.small ? 11.5 : 13, weight: 700, pill: true });

      out.set('h', G.km(rr - R));
      out.set('g', secret() ? '?' : F.unit(gNow(), 'מ/ש²', 1));
      out.set('a', secret() ? '?' : F.unit(S.aCabin, 'מ/ש²', 1));
      out.set('w', secret() ? '?' : F.unit(reading(), 'N', 1));
    }

    function renderHeight() {
      const w = view.w, h = view.h;
      const small = w < 480;
      view.clear();
      G.drawStars(view, 24);
      const split = w * 0.56;
      const er = Math.min(split * 0.34, (h - 38) / 5);
      const ey = h - er - 6;
      const ex = split * 0.42;
      const k = er / R;
      G.drawEarth(view, ex, ey, er);
      const y = ey - (R + S.h) * k;
      const topLimit = 24;
      const yShown = Math.max(topLimit, y);
      /* r ruler, from the center */
      const rx = ex - 4;
      P.circle(ex, ey, 3, { fill: C.ink });
      if (!secret()) {
        P.line(rx, ey, rx, yShown, { color: C.displacement, width: 3 });
        view.screenText(rx - 7, (ey + yShown) / 2, 'r', { size: 15, weight: 800, color: C.displacement, halo: true, align: 'right' });
      }
      /* h ruler, from the surface, next to it */
      const hx = ex + 6;
      const surf = ey - er;
      if (S.h > 0) {
        P.line(hx, surf, hx, yShown, { color: C.soft, width: 2.5, dash: [5, 4] });
        view.screenText(hx + 7, (surf + yShown) / 2, 'h', { size: 14, weight: 700, color: C.soft, halo: true, align: 'left' });
      }
      P.cat(ex, yShown, { pose: S.h > 0 ? 'thinking' : 'standing', px: small ? 34 : 46 });
      const g = G.gAt(R + S.h);
      P.arrow(ex + 30, yShown - 16, ex + 30, yShown - 16 + (g / 10) * (small ? 40 : 54), { color: C.acceleration, width: 3, label: 'g', labelSize: 12, labelGap: 9 });

      /* Graph: the reading against r */
      if (secret()) {
        view.screenText(split + (w - split) / 2, (h - 50) / 2 + 8, '?', { size: 44, weight: 800, color: C.soft });
      } else {
        const plot = PHY.ch02.Plot(view, { tMin: 1, tMax: 4, yMin: 0, yMax: 50, title: 'משקל (ניוטון)', tLabel: 'r / R', compact: small, yTick: 25, tTick: 1 });
        plot.box(split + 2, 8, w - split - 6, h - 50);
        plot.frame();
        const rk = (R + S.h) / R;
        /* During the run the curve grows with the cat. In free play it is all there. */
        const tEnd = S.locked ? rk : 4;
        const pts = [];
        for (let i = 0; i <= 60; i++) { const t = 1 + (i / 60) * (tEnd - 1); pts.push({ t, y: 50 / (t * t) }); }
        plot.curve(pts, { color: C.force });
        plot.dot(rk, 50 / (rk * rk), { color: C.force });
      }

      G.drawScale(view, split + (w - split) / 2, h - 34, Math.min(w - split - 16, 130), F.unit(reading(), 'N', 1), { size: small ? 13 : 15, color: C.force, h: 24 });
      if (S.caption) view.screenText(split / 2, 15, S.caption, { size: small ? 10.5 : 13, weight: 700, pill: true });

      out.set('h', G.km(S.h));
      out.set('r', secret() ? '?' : G.km(R + S.h));
      out.set('g', F.unit(g, 'מ/ש²', 2));
      out.set('w', F.unit(reading(), 'N', 1));
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return tw.busy; });
    function render() {
      if (!drawNow()) return;
      if (S.mode === 'float') renderFloat();
      else renderHeight();
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.caption = '';
        S.h = 0;
        S.seen = {};
        S.played = false;
        if (hSlider) hSlider.set(0);
        if (S.mode === 'float') resetFloat();
        setLocked(opts.locked);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'height') { S.h = v; if (hSlider) hSlider.set(v / 1000); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        return { mode: S.mode, phase: S.phase, r: rNow(), g: gNow(), aCabin: S.aCabin, reading: reading(), h: S.h, seen: Object.assign({}, S.seen), speed: S.b ? Math.hypot(S.b.vx, S.b.vy) : 0, locked: S.locked, secret: secret() };
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        setLocked(true);
        S.played = true;
        S.caption = '';
        if (S.mode === 'float') {
          resetFloat();
          S.caption = 'אותו גובה, אותה כבידה: 8.9 מ/ש²';
          await tw.add(2.4, null);
          if (id !== S.run) return;
          S.seen.tower = reading();
          S.seen.g = gNow();
          S.caption = 'המגדל נעלם: התא והחתול נופלים יחד';
          S.phase = 'fall';
          S.accel = 110;
          await tw.add(1.7, null);
          if (id !== S.run) return;
          S.seen.fall = reading();
          S.seen.aFall = S.aCabin;
          S.seen.gFall = gNow();
          S.caption = 'ועכשיו עם מהירות הצידה';
          S.phase = 'orbit';
          S.b = G.circular(R + H_STATION, 90, -1);
          S.trail = [];
          S.aCabin = Math.hypot(S.b.ax, S.b.ay);
          const T = G.period(R + H_STATION);
          S.accel = T / 4.6;
          await tw.add(4.6, null);
          if (id !== S.run) return;
          S.seen.orbit = reading();
          S.seen.aOrbit = S.aCabin;
          S.seen.T = T;
          S.seen.v = Math.hypot(S.b.vx, S.b.vy);
          S.caption = 'נופל כל הזמן, מחטיא כל הזמן';
        } else {
          S.h = 0;
          hSlider.set(0);
          S.caption = 'עולים עד 6400 ק"מ מעל הקרקע';
          await tw.add(1, null);
          if (id !== S.run) return;
          await tw.add(4.2, function (k) { S.h = k * R; hSlider.set(Math.round(S.h / 1000)); });
          if (id !== S.run) return;
          S.h = R;
          S.caption = 'הגובה R, והמרחק מהמרכז 2R';
        }
      },
    };
    if (S.mode === 'float') resetFloat();
    setLocked(opts.locked);
    return api;
  };
})();

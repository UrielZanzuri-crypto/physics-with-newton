/* PHY.sims.fallingCurve: why 8 km/s. Up close: a straight line, the ground curving away under it, and the cat
   falling 5 m in the first second. Along 8 km the ground drops 5 m, so at 8 km/s the gap never changes.
   The picture stretches height by hundreds of times, and says so. The numbers are the true geometry.
   sim.play() -> Promise: measures the drop at 8 km, then flies at 8 km/s. sim.fly(kms) -> Promise.
   setParam: speed (km/s), locked. getState: true numbers in meters and seconds. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const XMAX = 10000;
  const XEND = 9200;
  const START = 5;

  /* How far the ground is below the straight tangent line, at distance x along it. */
  const groundDrop = (x) => Math.sqrt(R * R + x * x) - R;

  PHY.sims.fallingCurve = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ locked: true, speed: 8 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.7, minHeight: 270, maxHeight: 400 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      v: opts.speed, t: 0, flying: false, trail: [], ruler: 0, showFall: false, crashed: false, caption: '', locked: opts.locked, run: 0,
      resolve: null, measured8: null, lastDrop: 0, played: false,
    };

    const slider = U.Slider(controlsEl, {
      label: 'מהירות הטיסה', min: 2, max: 12, step: 0.5, value: S.v, format: (v) => F.unit(v, G.KMS, 1), color: 'var(--c-velocity)',
      onInput(v) { S.v = v; resetFlight(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const btn = U.Button(row, 'לטוס!', function () { if (!S.locked) api.fly(S.v); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'x', label: 'מרחק לאורך הקו', color: 'var(--c-displacement)' },
      { key: 'fall', label: 'כמה ניוטון נפל' },
      { key: 'ground', label: 'כמה האדמה ירדה' },
      { key: 'gap', label: 'גובה מעל הקרקע' },
    ]);

    /* Before the guess, nothing here may answer how far the ground drops. */
    const secret = () => S.locked && !S.played;

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      btn.disabled = v;
    }
    function resetFlight() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.t = 0; S.flying = false; S.trail = []; S.crashed = false; S.caption = ''; S.stamp = null;
    }
    const fallAt = (t) => 5 * t * t;
    const xAt = (t) => S.v * 1000 * t;
    const gapAt = (t) => START - fallAt(t) + groundDrop(xAt(t));

    function step(dt) {
      tw.step(dt);
      if (!S.flying) return;
      S.t += dt * 0.3;
      if (S.trail.length === 0 || S.t - S.trail[S.trail.length - 1].t > 0.05) S.trail.push({ t: S.t, x: xAt(S.t), y: START - fallAt(S.t) });
      if (gapAt(S.t) <= 0) {
        S.crashed = true;
        finish('נפל: ' + F.unit(xAt(S.t) / 1000, G.KM, 1) + ' בלבד, והקרקע כבר כאן');
        return;
      }
      if (S.t >= 1 && !S.stamp) S.stamp = { x: xAt(1), y: START - fallAt(1) };
      if (xAt(S.t) >= XEND || gapAt(S.t) > START + 2.6) {
        const g = gapAt(S.t);
        finish(g > START + 0.1 ? 'הגובה גדל: הוא מתרחק מהאדמה' : g < START - 0.1 ? 'הגובה ירד: עוד מעט הוא נוחת' : 'הגובה לא השתנה: ' + F.unit(g, 'm', 1));
      }
    }
    function finish(caption) {
      S.flying = false;
      S.caption = caption;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }

    /* Maps the true numbers to the stretched picture. */
    function layout() {
      const w = view.w, h = view.h;
      const left = 14, right = 14, top = 44, bottom = 12;
      const yTop = 7, yBot = -8.5;
      return {
        X: (x) => left + (x / XMAX) * (w - left - right),
        Y: (y) => top + ((yTop - y) / (yTop - yBot)) * (h - top - bottom),
        w, h, top, bottom, left, right,
      };
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.flying || tw.busy; });
    function render() {
      if (!drawNow()) return;
      const L = layout();
      const small = view.w < 420;
      view.clear();

      /* Ground: filled under the curve. */
      const pts = [];
      for (let i = 0; i <= 50; i++) { const x = (i / 50) * XMAX; pts.push({ x: L.X(x), y: L.Y(-groundDrop(x)) }); }
      P.poly(pts.concat([{ x: L.X(XMAX), y: view.h }, { x: L.X(0), y: view.h }]), { fill: 'rgb(116, 170, 110)', close: true });
      P.poly(pts, { color: 'rgb(52, 96, 56)', width: 2.5 });
      view.screenText(L.X(600), view.h - 14, 'האדמה', { size: 12, weight: 700, color: 'rgb(24, 56, 28)', align: 'left' });

      /* The straight tangent to the ground at the start. */
      P.line(L.X(0), L.Y(0), L.X(XMAX), L.Y(0), { color: C.soft, width: 1.5, dash: [6, 6] });
      view.screenText(L.X(XMAX) - 2, L.Y(0) + 10, 'קו ישר', { size: 11.5, color: C.soft, align: 'right' });

      /* 8 km marks */
      const x8 = L.X(8000);
      P.line(x8, L.Y(0) - 5, x8, L.Y(0) + 5, { color: C.axis, width: 2 });
      view.screenText(x8 + 6, L.Y(0) - 10, F.unit(8, G.KM, 0), { size: 12, weight: 700, align: 'left', halo: true });

      /* The ruler: grows down from the line to the ground at 8 km. */
      if (S.ruler > 0) {
        const d = groundDrop(8000) * S.ruler;
        P.line(x8, L.Y(0), x8, L.Y(-d), { color: C.displacement, width: 3.5 });
        view.screenText(x8 - 8, L.Y(-d / 2), F.unit(d, 'm', d < 4.9 ? 1 : 0), { size: 13, weight: 800, color: C.displacement, align: 'right', halo: true });
      }

      /* The flight */
      if (S.showFall) {
        const yy = S.trail.map((p) => ({ x: L.X(p.x), y: L.Y(p.y) }));
        const tNow = S.t;
        if (S.flying || S.t > 0) yy.push({ x: L.X(xAt(tNow)), y: L.Y(START - fallAt(tNow)) });
        P.poly(yy, { color: C.accent, width: 2.4 });
        P.line(L.X(0), L.Y(START), L.X(XMAX), L.Y(START), { color: C.soft, width: 1, dash: [2, 5], alpha: 0.6 });
        const cx = L.X(Math.min(xAt(tNow), XMAX)), cy = L.Y(START - fallAt(tNow));
        const px = small ? 28 : 36;
        if (S.flying || !S.crashed) P.cat(cx, cy, { pose: 'flying', px, rot: -8 });
        else P.cat(cx, cy, { pose: 'dizzy', px, anchor: [0.5, 0.8] });
        /* The fall arrow, always from the height he left at. */
        if (fallAt(tNow) > 0.25 && !S.stamp) {
          P.arrow(cx, L.Y(START), cx, cy, { color: C.displacement, width: 2.5, head: 9, alpha: 0.8 });
          view.screenText(cx - 7, (L.Y(START) + cy) / 2, F.unit(fallAt(tNow), 'm', 1), { size: 12, weight: 700, color: C.displacement, align: 'right', halo: true });
        }
        /* Where he was after exactly one second: 5 m below the line he left on. */
        if (S.stamp) {
          const sx = L.X(S.stamp.x);
          P.arrow(sx, L.Y(START), sx, L.Y(S.stamp.y), { color: C.displacement, width: 3, head: 10 });
          P.circle(sx, L.Y(S.stamp.y), 4.5, { fill: C.accent, color: C.ink, width: 1.5 });
          view.screenText(sx - 7, (L.Y(START) + L.Y(S.stamp.y)) / 2, 'בשנייה: ' + F.unit(5, 'm', 0), { size: 12.5, weight: 800, color: C.displacement, align: 'right', halo: true });
        }
        /* Gap to the ground */
        const gx = Math.min(cx, L.X(XMAX));
        P.line(gx, cy + 7, gx, L.Y(-groundDrop(Math.min(xAt(tNow), XMAX))), { color: C.good, width: 1.6, dash: [3, 4] });
      }

      if (!S.showFall) {
        if (!secret()) P.line(L.X(0), L.Y(START), L.X(XMAX), L.Y(START), { color: C.soft, width: 1, dash: [2, 5], alpha: 0.6 });
        P.cat(L.X(0) + (small ? 15 : 20), L.Y(START), { pose: 'thinking', px: small ? 28 : 36, anchor: [0.5, 0.9] });
      }
      view.screenText(view.w / 2, 13, secret() ? 'גובה מתוח מאות פעמים' : 'גובה מתוח מאות פעמים: באמת זה כמעט קו ישר', { size: 11, color: C.soft });
      if (S.caption) view.screenText(view.w / 2, 33, S.caption, { size: small ? 12.5 : 13.5, weight: 700, pill: true });

      out.set('x', F.unit(xAt(S.t) / 1000, G.KM, 1));
      out.set('fall', F.unit(fallAt(S.t), 'm', 1));
      out.set('ground', secret() ? '?' : F.unit(groundDrop(xAt(S.t)), 'm', 1));
      out.set('gap', secret() ? '?' : F.unit(S.t > 0 ? gapAt(S.t) : START, 'm', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        resetFlight();
        S.ruler = 0;
        S.showFall = false;
        S.played = false;
        setLocked(opts.locked);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; slider.set(v); resetFlight(); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        const t = S.t;
        return {
          v: S.v, t, x: xAt(t), fall: fallAt(t), ground: groundDrop(xAt(t)), gap: t > 0 ? gapAt(t) : START, crashed: S.crashed, flying: S.flying,
          drop8km: groundDrop(8000), fall1s: fallAt(1), ruler: S.ruler, vOrbit: G.vCirc(R), locked: S.locked, stamp: S.stamp, caption: S.caption, secret: secret(),
        };
      },
      fly(kms) {
        S.played = true;
        resetFlight();
        S.v = kms;
        slider.set(kms);
        S.showFall = true;
        S.flying = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        S.played = true;
        resetFlight();
        S.showFall = false;
        S.ruler = 0;
        setLocked(true);
        S.caption = 'מודדים: כמה האדמה ירדה אחרי 8 ק"מ?';
        await tw.add(2.2, function (k) { S.ruler = k; });
        if (id !== S.run) return;
        S.caption = 'רק 5 מ\'. ועכשיו ניוטון, ב-8 ק"מ/ש';
        await tw.add(1.6, null);
        if (id !== S.run) return;
        await api.fly(8);
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

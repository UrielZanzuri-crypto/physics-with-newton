/* PHY.sims.loopTheLoop: a free-riding cat, no rails to hold him. The floor of the loop can only push, so the
   moment the normal force would have to pull, he leaves the rail and falls as a projectile. Speed comes
   from energy, and the separation is found from N = m(v^2/R + g cos phi), not assumed.
   opts: {R, height, locked}. sim.play() -> Promise. setParam: height, locked.
   Chapter 6 gives the exact condition, so this chapter only shows it, and never states it. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const CURVE = 0.12, CX = 3.4, XEND = 9.2, MASS = 5;

  PHY.sims.loopTheLoop = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ R: 2, height: 4, locked: true, slow: 0.8 }, opts || {});
    const R = opts.R;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -8.6, xMax: 9.6, yMin: -1.2, yMax: 11.2 }, aspect: 1.4, minHeight: 310, maxHeight: 460 });
    const tw = PHY.ch02.tweens();
    const S = { h: opts.height, track: null, r: null, s0: 0, s1: 0, running: false, done: false, phase: 'ready', free: null, sep: null, vTop: null, result: null, caption: '', locked: opts.locked, resolve: null, pose: 'sliding', rot: 0, spin: 0 };

    const slider = U.Slider(controlsEl, {
      label: 'גובה ההתחלה', min: 3, max: 7, step: 0.1, value: S.h, digits: 1, unit: 'm', color: 'var(--c-displacement)',
      onInput(v) { S.h = v; build(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'לשלוח את החתול', function () { launch(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'h', label: 'גובה הפסגה', color: 'var(--c-displacement)' },
      { key: 'sep', label: 'גובה הניתוק', color: 'var(--c-displacement)' },
      { key: 'vt', label: 'מהירות בפסגה', color: 'var(--c-velocity)' },
    ]);

    /* A label saying "where he detaches" would answer the card, so until its run this box stays neutral. */
    const sepLabel = out.el.querySelectorAll('.r-label')[1];

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      go.disabled = v;
    }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function circle() {
      const pts = [];
      const n = 300;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: CX + R * Math.sin(a), y: R - R * Math.cos(a) });
      }
      return pts;
    }
    function build() {
      settle();
      tw.clear();
      const start = -Math.sqrt(S.h / CURVE);
      const a = M.fn(function (x) { return CURVE * x * x; }, start, 0, 220);
      const b = M.line(0, 0, CX, 0, 60);
      const c = circle();
      const d = M.line(CX, 0, XEND, 0, 80);
      S.track = M.Track(M.join(a, b, c, d));
      const lenA = M.Track(a).length;
      S.s0 = lenA + CX;
      S.s1 = S.s0 + 2 * Math.PI * R;
      S.r = M.Rider(S.track, { s: 0, v: 0, ends: 'stop' });
      S.running = false; S.done = false; S.phase = 'ready'; S.free = null; S.sep = null; S.vTop = null; S.result = null; S.caption = ''; S.pose = 'sliding'; S.spin = 0;
    }
    function launch() {
      build();
      S.running = true;
      S.phase = 'ride';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function done(result) {
      S.result = result;
      S.running = false;
      tw.run(0.9).then(function () {
        S.done = true;
        settle();
      });
    }
    /* What the loop's floor has to push with, per kilogram. Negative means it would have to pull. */
    function normalPerKg(s, v) {
      if (s < S.s0 || s > S.s1) return null;
      const phi = (s - S.s0) / R;
      return (v * v) / R + 10 * Math.cos(phi);
    }
    function step(dt) {
      tw.step(dt);
      if (!S.running) return;
      const h = dt * opts.slow;
      if (S.phase === 'ride') {
        const r = S.r, s0 = r.s, n0 = normalPerKg(r.s, r.v);
        r.step(h);
        if (s0 < S.s0 + Math.PI * R && r.s >= S.s0 + Math.PI * R) S.vTop = Math.abs(r.v);
        const n = normalPerKg(r.s, r.v);
        const q1 = S.track.at(r.s);
        if (n !== null && n < -0.02 && q1.y > R) {
          /* Back up to where the push really reached zero, so the numbers do not depend on the step size. */
          const f = n0 !== null ? n0 / (n0 - n) : 1;
          const sStar = s0 + (r.s - s0) * f;
          const q = S.track.at(sStar);
          const vStar = Math.sqrt(Math.max(0, 2 * (r.e - 10 * q.y)));
          S.sep = { x: q.x, y: q.y, v: vStar };
          S.free = { x: q.x, y: q.y, vx: q.ux * vStar, vy: q.uy * vStar, t: 0, rot: (Math.atan2(q.uy, q.ux) * 180) / Math.PI };
          S.phase = 'free';
          S.pose = 'falling';
          S.caption = 'הרצפה הפסיקה לדחוף!';
        }
        if (r.stopped) {
          S.caption = 'עבר!';
          S.pose = 'happy';
          done('cleared');
        }
      } else if (S.phase === 'free') {
        const f = S.free;
        f.t += h;
        f.vy -= 10 * h;
        f.x += f.vx * h;
        f.y += f.vy * h;
        f.rot += 200 * h;
        const dist = Math.hypot(f.x - CX, f.y - R);
        if ((f.t > 0.08 && dist >= R) || f.y <= 0) {
          const y0 = f.y, x0 = f.x;
          S.phase = 'land';
          S.pose = 'dizzy';
          S.caption = 'נפל. הלולאה זכתה.';
          S.running = false;
          tw.run(0.5, function (k) {
            f.x = x0 + (CX - x0) * k;
            f.y = y0 * (1 - k) * (1 - k);
          }).then(function () { done('fell'); });
        }
      }
    }
    function render() {
      const small = view.w < 460;
      const r = view.visible;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, r.xMax, 0, {});
      view.poly(S.track.points, { color: C.axis, width: 4.5 });
      /* the energy line: as high as he could ever get */
      view.line(r.xMin, S.h, r.xMax, S.h, { color: C.gold, width: 2, dash: [8, 5] });
      view.text(r.xMax, S.h, 'גובה ההתחלה ' + F.unit(S.h, 'm', 1), { size: 12, weight: 700, align: 'right', color: C.ink, halo: true, offset: [-8, -11] });
      view.line(CX - 1.1, 2 * R, CX + 1.1, 2 * R, { color: C.displacement, width: 2 });
      view.text(CX - 1.2, 2 * R, F.unit(2 * R, 'm', 0), { size: 12, weight: 800, color: C.displacement, halo: true, align: 'right', offset: [0, S.h === 2 * R ? 11 : 0] });
      if (S.sep) {
        view.circle(S.sep.x, S.sep.y, 7, { px: true, color: C.bad, width: 3 });
        view.text(S.sep.x, S.sep.y, F.unit(S.sep.y, 'm', 2), { size: 12, weight: 800, color: C.bad, halo: true, offset: [S.sep.x > CX ? 34 : -34, 0] });
      }
      const px = small ? 36 : 46;
      if (S.free) {
        PHY.mascot.draw(view, S.free.x, S.free.y, { pose: S.phase === 'land' || S.result ? 'dizzy' : 'falling', px, rot: S.phase === 'free' ? S.free.rot : 0, anchor: S.phase === 'free' ? undefined : [0.5, 0.96] });
      } else {
        const q = S.track.at(S.r.s);
        M.rideCat(view, q, { px, pose: S.result === 'cleared' ? 'happy' : 'sliding' });
        const v = S.r.v;
        if (Math.abs(v) > 0.3) {
          const k = 4.5 / view.scale;
          view.arrow(q.x, q.y, q.x + q.ux * v * k, q.y + q.uy * v * k, { color: C.velocity, width: 3.2 });
        }
        const n = normalPerKg(S.r.s, Math.abs(v));
        if (n !== null && n > 0.2) {
          const kn = 2.2 / view.scale;
          view.arrow(q.x, q.y, q.x - q.uy * n * kn, q.y + q.ux * n * kn, { color: C.force, width: 3.2, label: 'N', labelSide: -1, labelGap: 11 });
        }
      }
      const q0 = S.free ? { y: S.free.y } : S.track.at(S.r.s);
      const v0 = S.free ? Math.hypot(S.free.vx, S.free.vy) : Math.abs(S.r.v);
      const ke = 0.5 * MASS * v0 * v0, pe = MASS * 10 * Math.max(0, q0.y);
      const total = MASS * 10 * S.h;
      const landed = S.phase === 'land' || (S.result === 'fell');
      M.energyPanel(view, {
        x: 6, y: 5, w: view.w - 12, max: total,
        items: landed
          ? [{ label: 'קינטית', value: 0, color: C.accent }, { label: 'גובה', value: 0, color: C.gold }, { label: 'חום ומכה', value: total, color: C.apple }]
          : [{ label: 'קינטית', value: ke, color: C.accent }, { label: 'גובה', value: pe, color: C.gold }],
      });
      if (S.caption) view.screenText(view.w / 2, 78, S.caption, { size: small ? 13 : 14, weight: 700, pill: true });
      out.set('h', F.unit(2 * R, 'm', 0));
      const ready = S.locked && S.phase === 'ready';
      sepLabel.textContent = ready ? 'התוצאה' : 'גובה הניתוק';
      out.set('sep', ready ? '?' : S.sep ? F.unit(S.sep.y, 'm', 2) : S.result === 'cleared' ? 'לא התנתק' : '–');
      out.set('vt', S.vTop !== null && !S.sep ? F.unit(S.vTop, 'ms', 2) : S.sep ? 'לא הגיע' : '–');
    }
    const loop = PHY.SimLoop({ view, step, render });
    build();
    setLocked(S.locked);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { build(); loop.requestRender(); },
      play: launch,
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'height') { S.h = v; slider.set(v); build(); }
        loop.requestRender();
      },
      getState() {
        return { h: S.h, R: R, result: S.result, sepY: S.sep ? S.sep.y : null, sepV: S.sep ? S.sep.v : null, vTop: S.vTop, done: S.done, phase: S.phase };
      },
    };
  };
})();

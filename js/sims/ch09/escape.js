/* PHY.sims.escape: how fast to leave forever. An orbit view next to the energy well.
   The well is U(r) = -GM/r per kilogram, in gold. The flat line is the total energy, which never moves.
   The gap between them at the cat's r is his kinetic energy, in the kinetic color. If the line crosses the
   curve he must turn back there. At total energy 0 it never crosses.
   sim.play() -> Promise: 8, 10, then 11.3 km/s. sim.fire(kms) -> Promise. setParam: speed, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const RMAX = 12;
  const MJ = "מגה-ג'ול";
  /* On the threshold (G.onEdge) the total reads as 0: exactly 0 on the card's own run, about 0 at 11.3 on the slider. */
  const zero = (E) => (Math.abs(E) < 5e4 ? '0' : 'כ-0');

  PHY.sims.escape = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ locked: true, speed: 8 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.6, minHeight: 430, maxHeight: 450 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      v: opts.speed, b: null, el: null, t: 0, flying: false, trail: [], shots: [], caption: '', locked: opts.locked, accel: 1, run: 0, resolve: null,
      result: null, maxR: 0, vAtEnd: 0,
    };

    const slider = U.Slider(controlsEl, {
      label: 'מהירות יציאה', min: 4, max: 14, step: 0.1, value: S.v, format: (v) => F.unit(v, G.KMS, 1), color: 'var(--c-velocity)',
      onInput(v) { S.v = v; S.caption = ''; prepare(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const btn = U.Button(row, 'לצאת לדרך', function () { if (!S.locked) api.fire(S.v); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות עכשיו', color: 'var(--c-velocity)' },
      { key: 'k', label: 'אנרגיית תנועה, לק"ג', color: 'var(--accent)' },
      { key: 'u', label: 'אנרגיית גובה, לק"ג' },
      { key: 'e', label: 'סך הכול, לק"ג' },
    ]);

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      btn.disabled = v;
      loop.requestRender();
    }
    function prepare() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(null); }
      S.flying = false;
      S.t = 0;
      S.trail = [];
      S.b = G.body(0, R, S.v * 1000, 0);
      S.el = G.elements(S.b);
      S.maxR = R;
      S.result = null;
      loop.requestRender();
    }

    function step(dt) {
      tw.step(dt);
      if (!S.flying) return;
      const total = dt * S.accel;
      const n = Math.max(1, Math.ceil(total / 6));
      const h = total / n;
      for (let i = 0; i < n && S.flying; i++) {
        const use = S.el.bound && S.t + h > S.el.T ? S.el.T - S.t : h;
        if (use > 0) G.verlet(S.b, use);
        S.t += use;
        const r = Math.hypot(S.b.x, S.b.y);
        S.maxR = Math.max(S.maxR, r);
        if (S.el.bound && S.t >= S.el.T - 1e-6) { land('orbit'); return; }
        if (r < R * 0.995) { land('crash'); return; }
        if (r > RMAX * R) { land(S.el.bound && !G.onEdge(S.el.E) ? 'far' : 'away'); return; }
      }
      const last = S.trail[S.trail.length - 1];
      if (!last || Math.hypot(S.b.x - last.x, S.b.y - last.y) > R * 0.03) S.trail.push({ x: S.b.x, y: S.b.y });
    }
    function land(kind) {
      S.flying = false;
      S.result = kind;
      S.trail.push({ x: S.b.x, y: S.b.y });
      S.vAtEnd = Math.hypot(S.b.vx, S.b.vy);
      S.shots.push({ pts: S.trail, kind, v: S.v, maxR: S.maxR, E: S.el.E, vEnd: S.vAtEnd, T: S.el.T, ra: S.el.ra, closeError: Math.hypot(S.b.x, S.b.y - R) });
      if (S.shots.length > 6) S.shots.shift();
      const v = F.unit(S.v, G.KMS, 1);
      S.caption = kind === 'away' ? v + (G.onEdge(S.el.E) ? ': סך האנרגיה ' + zero(S.el.E) + ', לא חוזר' : ': כבר לא חוזר') : kind === 'far' ? v + ': סך האנרגיה שלילי, הוא עוד יחזור' : kind === 'crash' ? v + ': נחת' : v + ': חזר לנקודת ההתחלה';
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(S.shots[S.shots.length - 1]); }
    }

    function layout() {
      const w = view.w, h = view.h;
      const stack = w < 560;
      if (stack) {
        const orbH = Math.round(h * 0.48);
        return { w, h, stack, ox: 0, oy: 0, oW: w, oH: orbH, gx: 0, gy: orbH, gW: w, gH: h - orbH };
      }
      const oW = Math.round(w * 0.47);
      return { w, h, stack, ox: 0, oy: 0, oW, oH: h, gx: oW, gy: 0, gW: w - oW, gH: h };
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.flying || tw.busy; });
    function render() {
      if (!drawNow()) return;
      const L = layout();
      const small = L.w < 480;
      const ctx = view.ctx;
      view.clear();
      G.drawStars(view, 30);

      /* Orbit panel */
      /* The far point of the 10 km/s ellipse, 3.57 R below the start, must fit under Earth. */
      const k = Math.min((L.oW / 2 - 6) / (1.95 * R), (L.oH - 38) / (4.57 * R));
      const cx = L.ox + L.oW / 2, cy = L.oy + 30 + R * k;
      const map = (p) => ({ x: cx + p.x * k, y: cy - p.y * k });
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.ox, L.oy, L.oW, L.oH);
      ctx.clip();
      G.drawEarth(view, cx, cy, R * k);
      S.shots.forEach(function (s) {
        G.drawPath(view, s.pts, map, { color: s.kind === 'orbit' ? C.good : s.kind === 'crash' ? C.soft : C.accent, width: 2, alpha: 0.75 });
      });
      if (S.flying) G.drawPath(view, S.trail.concat([{ x: S.b.x, y: S.b.y }]), map, { color: C.accent, width: 2.6 });
      const q = map(S.b);
      if (q.x > -10 && q.x < L.oW + 10 && q.y > -10 && q.y < L.oH + 10) {
        const a = view.toWorld(q.x, q.y);
        const sp = Math.hypot(S.b.vx, S.b.vy) || 1;
        PHY.mascot.draw(view, a.x, a.y, { pose: 'flying', px: small ? 26 : 32, rot: (Math.atan2(S.b.vy, S.b.vx) * 180) / Math.PI });
        const vLen = (sp / 11300) * (small ? 44 : 56);
        P.arrow(q.x, q.y, q.x + (S.b.vx / sp) * vLen, q.y - (S.b.vy / sp) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 12, labelGap: 10 });
      } else if (S.result === 'away' || S.result === 'far' || S.flying) {
        view.screenText(L.ox + L.oW / 2, L.oy + (L.stack ? L.oH - 12 : L.oH - 16), 'ניוטון יצא מהתמונה', { size: 11.5, weight: 700, color: C.soft, halo: true });
      }
      ctx.restore();
      if (S.caption) view.screenText(L.ox + L.oW / 2, L.oy + 15, S.caption, { size: small ? 11.5 : 12.5, weight: 700, pill: true });
      if (!L.stack) P.line(L.oW, 0, L.oW, L.h, { color: C.gridStrong, width: 1.5 });
      else P.line(0, L.oH, L.w, L.oH, { color: C.gridStrong, width: 1.5 });

      /* The well */
      const plot = PHY.ch02.Plot(view, { tMin: 1, tMax: RMAX, yMin: -70, yMax: 50, title: 'מגה-ג\'ול לכל ק"ג', tLabel: 'r / R', compact: true, yTick: 20, tTick: 1 });
      plot.box(L.gx + 2, L.gy + 6, L.gW - 6, L.gH - 12);
      plot.frame();
      const E = S.el.E / 1e6;
      const curve = [];
      for (let i = 0; i <= 120; i++) { const t = 1 + (i / 120) * (RMAX - 1); curve.push({ t, y: -64 / t }); }
      plot.curve(curve, { color: C.gold, width: 3 });
      plot.hline(E, { color: C.ink, width: 2, dash: [] });
      const lab = G.onEdge(S.el.E) ? 'סך הכול: ' + zero(S.el.E) + ' ' + MJ + ', בשפת הבור' : 'סך הכול: ' + F.unit(E, MJ, 0) + (E > 0 ? ', מעל הבור' : '');
      view.screenText(plot.X(RMAX) - 2, plot.Y(E) - 10, lab, { size: 11, weight: 700, align: 'right', halo: true });
      const rNow = Math.hypot(S.b.x, S.b.y) / R;
      if (rNow <= RMAX) {
        const uNow = -64 / rNow;
        const X = plot.X(rNow);
        P.line(X, plot.Y(uNow), X, plot.Y(E), { color: C.accent, width: 5, cap: 'butt' });
        plot.dot(rNow, uNow, { color: C.gold, r: 5 });
        P.cat(X, plot.Y(uNow) - 2, { pose: 'thinking', px: small ? 22 : 26 });
      }
      view.screenText(plot.X(1.7), plot.Y(-62), 'בור הכבידה', { size: 11, weight: 700, align: 'left', halo: true });

      const v = Math.hypot(S.b.vx, S.b.vy);
      const ke = (v * v) / 2 / 1e6, u = (-G.GM / Math.hypot(S.b.x, S.b.y)) / 1e6;
      out.set('v', G.kms(v));
      out.set('k', F.unit(ke, MJ, 1));
      out.set('u', F.unit(u, MJ, 1));
      out.set('e', G.onEdge(S.el.E) ? zero(S.el.E) + ' ' + MJ : F.unit(ke + u, MJ, 1));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.shots = [];
        S.caption = '';
        prepare();
        setLocked(opts.locked);
      },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; slider.set(v); prepare(); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        const v = Math.hypot(S.b.vx, S.b.vy), r = Math.hypot(S.b.x, S.b.y);
        return {
          v0: S.v, v, r, t: S.t, flying: S.flying, result: S.result, E: S.el.E, Enow: (v * v) / 2 - G.GM / r, shots: S.shots.slice(),
          vEsc: G.vEsc(R), vOrbit: G.vCirc(R), maxR: S.maxR, locked: S.locked, caption: S.caption,
        };
      },
      fire(kms) {
        S.v = kms;
        slider.set(kms);
        prepare();
        S.caption = '';
        /* A journey takes a few seconds on screen, whatever its real length. */
        const el = S.el;
        /* A shot that leaves the frame is timed to the edge of the frame, or a long ellipse would be over in a frame. */
        const leaves = !el.bound || el.ra > RMAX * R;
        const tLen = leaves ? G.fly(S.b, { rMax: RMAX * R, h: 20, every: 1000 }).t : el.T;
        S.accel = tLen / (leaves ? 4 : Math.min(4, Math.max(2.6, 2.6 + (el.T / G.period(R) - 1) * 0.5)));
        S.flying = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        S.shots = [];
        setLocked(true);
        for (const v of [8, 10, Math.SQRT2 * 8]) {
          await api.fire(v);
          if (id !== S.run) return;
          await tw.add(0.3, null);
          if (id !== S.run) return;
        }
        S.caption = F.unit(Math.SQRT2 * 8, G.KMS, 1) + ': סך האנרגיה 0, לא חוזר';
      },
    };
    S.b = G.body(0, R, S.v * 1000, 0);
    S.el = G.elements(S.b);
    setLocked(opts.locked);
    return api;
  };
})();

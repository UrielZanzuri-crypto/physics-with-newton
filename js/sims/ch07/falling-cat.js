/* PHY.sims.fallingCat: why the cat lands on his feet. He falls on his back with no spin and nothing to push on.
   The model is two halves that turn about the long axis of the body. Each half turns easily with its paws tucked
   and with difficulty with them stretched. Phase 1: front tucked, rear stretched: the front turns a lot, the rear a
   little the other way. Phase 2: the reverse. The angular momentum stays 0 at every step (the same idea as the
   astronaut), and yet at the end both halves have turned half a circle.
   With tuck: false both halves turn equally, the second phase undoes the first, and he lands on his back.
   opts: {height, ratio, tuck, slow}. sim.play() -> Promise. setParam: tuck, time. getState(): rotF, rotB, Lmax. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07;
  const RAD = Math.PI / 180;
  const FUR = 'hsl(31, 89%, 62%)', FUR_DARK = 'hsl(29, 70%, 50%)', CREAM = 'hsl(35, 100%, 89%)', LINE = 'hsl(24, 30%, 18%)', RED = 'hsl(4, 69%, 52%)';
  const T1 = 0.05, T2A = 0.22, T2B = 0.26, T3 = 0.43;
  const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

  PHY.sims.fallingCat = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ height: 1.25, ratio: 1 / 6, tuck: true, slow: 0.075 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1, xMax: 1, yMin: -0.3, yMax: 1.86 }, aspect: 1.45, minHeight: 330, maxHeight: 460 });
    const TF = Math.sqrt((2 * opts.height) / 10);
    const S = { t: 0, phase: 'ready', caption: '', Lmax: 0, resolve: null, last: null };

    /* The whole motion as a function of the real time since letting go. */
    function at(t) {
      const s1 = smooth((t - T1) / (T2A - T1));
      const s2 = smooth((t - T2B) / (T3 - T2B));
      const r = opts.tuck ? opts.ratio : 1;
      const a = opts.tuck ? 180 / (1 - r) : 120;
      const rotF = a * s1 - r * a * s2;
      const rotB = -r * a * s1 + a * s2;
      /* Paw tuck amount: 1 is folded, 0 is stretched. */
      const swap = smooth((t - T2A) / (T2B - T2A));
      const open = smooth((t - T3) / 0.04);
      const tuckF = opts.tuck ? smooth(t / T1) * (1 - swap) : 0;
      const tuckB = opts.tuck ? swap * (1 - open) : 0;
      /* How hard each half is to turn: tucked 1, stretched 1 / ratio. */
      const midT = t < T2A + (T2B - T2A) / 2;
      const iSmall = 1, iBig = 1 / opts.ratio;
      const iF = opts.tuck ? (midT ? iSmall : iBig) : iBig;
      const iB = opts.tuck ? (midT ? iBig : iSmall) : iBig;
      return { rotF, rotB, tuckF, tuckB, iF, iB, phase: t < T1 ? 0 : t < T2A ? 1 : t < T2B ? 2 : t < T3 ? 3 : 4 };
    }
    function y(t) { return 0.26 + opts.height - 5 * t * t; }

    function capFor(p) {
      if (!opts.tuck) return p === 0 ? 'נופל על הגב, בלי שום סיבוב' : p <= 2 ? 'שני החצאים מסתובבים אותו דבר, הפוך' : 'והשלב השני מבטל את הראשון...';
      return ['נופל על הגב, בלי שום סיבוב', 'ידיים מקופלות: הקדמי מסתובב הרבה, האחורי מעט', 'מחליפים: מותחים ידיים, מקפלים רגליים', 'עכשיו האחורי מסתובב הרבה, הקדמי מעט', 'שני החצאים למטה. מותחים רגליים לנחיתה'][p];
    }

    const timeSlider = U.Slider(controlsEl, {
      label: 'להזיז את הזמן ביד', min: 0, max: TF, step: 0.005, value: 0, format: (v) => F.unit(v, 's', 2), color: 'var(--accent)',
      onInput(v) { settle(); S.t = v; S.phase = v >= TF - 1e-6 ? 'landed' : 'scrub'; S.Lmax = 0; S.last = null; S.caption = S.phase === 'landed' ? landCaption() : capFor(at(v).phase); },
    });
    const row = U.h('div', { class: 'sim-row' });
    U.Button(row, 'להפיל את ניוטון', function () { launch().then(function () { if (opts.onFree) opts.onFree(); }); }, { primary: true });
    const toggle = U.Toggle(row, 'בלי לקפל כפות', { value: !opts.tuck, onChange(v) { opts.tuck = !v; settle(); S.t = 0; S.phase = 'ready'; S.caption = ''; timeSlider.set(0); S.Lmax = 0; S.last = null; } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'f', label: 'החצי הקדמי הסתובב' },
      { key: 'b', label: 'החצי האחורי הסתובב' },
      { key: 't', label: 'זמן נפילה אמיתי' },
    ]);

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function landCaption() { return opts.tuck ? 'על הרגליים. אין כאן שום קסם.' : 'על הגב. בלי לקפל, אין סיבוב.'; }

    function launch() {
      settle();
      S.t = 0;
      S.phase = 'fall';
      S.Lmax = 0;
      S.last = at(0);
      S.caption = capFor(0);
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    function step(dt) {
      if (S.phase !== 'fall') return;
      const h = dt * opts.slow;
      S.t = Math.min(TF, S.t + h);
      const now = at(S.t);
      /* Angular momentum of the two halves over this slice, measured from the motion itself. */
      const wF = (now.rotF - S.last.rotF) / h, wB = (now.rotB - S.last.rotB) / h;
      S.Lmax = Math.max(S.Lmax, Math.abs(now.iF * wF + now.iB * wB));
      S.last = now;
      S.caption = capFor(now.phase);
      timeSlider.set(S.t);
      if (S.t >= TF) {
        S.phase = 'landed';
        S.caption = landCaption();
        settle();
      }
    }

    /* ---------- the cat as two halves ---------- */
    function ctxEllipse(ctx, x, y, rx, ry, fill, stroke, lw) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    }
    function leg(ctx, bx, by, tx, ty, w) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = w + 3.2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = FUR;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctxEllipse(ctx, tx, ty, w * 0.56, w * 0.56, CREAM);
    }
    /* phi: roll of this half, 0 with the belly down. side: +1 front, -1 rear. */
    function half(ctx, cx, cy, len, thick, phi, side, tuck) {
      const c = Math.cos(phi * RAD), s = Math.sin(phi * RAD);
      const centerX = cx + (side * len) / 4;
      const legLen = thick * (1.55 - 1.0 * tuck);
      const legW = thick * 0.34;
      const legs = [-22, 22].map(function (d, i) {
        const a = (phi + d) * RAD;
        const lc = Math.cos(a), ls = Math.sin(a);
        const baseX = centerX + side * len * (i ? 0.1 : 0.03);
        return { depth: ls, bx: baseX, by: cy + lc * thick * 0.68, tx: baseX + side * len * 0.03 * (1 - tuck) - tuck * side * len * 0.06, ty: cy + lc * (thick * 0.68 + legLen) };
      });
      legs.filter(function (l) { return l.depth < 0; }).forEach(function (l) { leg(ctx, l.bx, l.by, l.tx, l.ty, legW); });
      /* Body */
      ctxEllipse(ctx, centerX, cy, len / 4 + thick * 0.28, thick, FUR, LINE, 2.4);
      /* Belly when it faces us, stripes when the back does */
      if (s > -0.4) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (s + 0.4) * 2.2);
        ctxEllipse(ctx, centerX, cy + c * thick * 0.6, (len / 4) * 0.86, thick * (0.28 + 0.34 * Math.max(0, s)), CREAM);
        ctx.restore();
      }
      if (s < 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (0.4 - s) * 2.2);
        ctx.strokeStyle = FUR_DARK;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        [-0.5, 0, 0.5].forEach(function (k) {
          const x = centerX + k * (len / 4);
          ctx.beginPath();
          ctx.moveTo(x, cy - c * thick * 0.78);
          ctx.lineTo(x, cy - c * thick * 0.28);
          ctx.stroke();
        });
        ctx.restore();
      }
      legs.filter(function (l) { return l.depth >= 0; }).forEach(function (l) { leg(ctx, l.bx, l.by, l.tx, l.ty, legW); });
    }
    function head(ctx, x, cy, R, phi) {
      const c = Math.cos(phi * RAD), s = Math.sin(phi * RAD);
      /* Ears, opposite the belly */
      [-0.55, 0.55].forEach(function (k) {
        const ex = x + k * R;
        const baseY = cy - c * R * 0.72;
        const tipY = cy - c * R * 1.52;
        ctx.beginPath();
        ctx.moveTo(ex - R * 0.32, baseY);
        ctx.lineTo(ex, tipY);
        ctx.lineTo(ex + R * 0.32, baseY);
        ctx.closePath();
        ctx.fillStyle = FUR;
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctxEllipse(ctx, x, cy, R, R * 0.94, FUR, LINE, 2.4);
      /* Face: the eyes slide around the head as it rolls. */
      const eyeY = -c * R * 0.14;
      [-1, 1].forEach(function (e) {
        const ey = cy + eyeY + e * s * R * 0.34;
        const ex = x + R * 0.36 + (e > 0 ? 0 : -R * 0.02);
        ctxEllipse(ctx, ex, ey, R * 0.19, R * 0.19, 'white', LINE, 1.4);
        ctxEllipse(ctx, ex + R * 0.05, ey, R * 0.09, R * 0.09, LINE);
      });
      ctxEllipse(ctx, x + R * 0.82, cy + c * R * 0.2, R * 0.1, R * 0.08, 'hsl(0, 78%, 74%)', LINE, 1);
    }
    function tail(ctx, x, cy, len, phi) {
      const c = Math.cos(phi * RAD);
      ctx.lineCap = 'round';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 9;
      const path = function () {
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.quadraticCurveTo(x - len * 0.55, cy - c * len * 0.05, x - len * 0.72, cy - c * len * 0.62);
      };
      path(); ctx.stroke();
      ctx.strokeStyle = FUR;
      ctx.lineWidth = 5.6;
      path(); ctx.stroke();
    }
    function drawCat(cx, cy, st) {
      const ctx = view.ctx;
      const small = view.w < 420;
      const len = small ? 96 : 128;
      const thick = len * 0.17;
      const phiF = 180 - st.rotF, phiB = 180 - st.rotB;
      ctx.save();
      tail(ctx, cx - len / 2 - thick * 0.1, cy, len * 0.42, phiB);
      half(ctx, cx, cy, len, thick, phiB, -1, st.tuckB);
      half(ctx, cx, cy, len, thick, phiF, 1, st.tuckF);
      /* Collar and head */
      const neck = cx + len / 2 + thick * 0.15;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(neck, cy - thick * 0.72);
      ctx.lineTo(neck, cy + thick * 0.72);
      ctx.stroke();
      head(ctx, neck + thick * 0.72, cy, thick * 1.12, phiF);
      ctx.restore();
    }

    /* An end-on view of one half, looking along the body. */
    function dial(x, cy, r, rot, tuck, name, spinning, dir) {
      const phi = (180 - rot) * RAD;
      const P = PHY.ch02.pix(view);
      P.circle(x, cy, r, { fill: C.surface, color: C.gridStrong, width: 2 });
      const leg = r * (0.5 + 0.48 * (1 - tuck));
      [-20, 20].forEach(function (d) {
        const a = phi + d * RAD;
        P.line(x + Math.sin(a) * r * 0.42, cy + Math.cos(a) * r * 0.42, x + Math.sin(a) * leg, cy + Math.cos(a) * leg, { color: C.accent, width: 4 });
      });
      P.circle(x, cy, r * 0.42, { fill: FUR, color: LINE, width: 2 });
      view.screenText(x, cy + r + 11, name, { size: 11.5, weight: 700 });
      view.screenText(x, cy + r + 25, F.deg(Math.abs(rot)), { size: 12, weight: 700, color: C.accent });
      if (spinning) {
        /* Torque from the waist, as a curved arrow in the force color. */
        const ctx = view.ctx;
        const R0 = r + 5;
        const a0 = dir > 0 ? -2.2 : -0.9;
        const a1 = dir > 0 ? -0.9 : -2.2;
        ctx.save();
        ctx.strokeStyle = C.force;
        ctx.fillStyle = C.force;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, cy, R0, a0, a1, dir < 0);
        ctx.stroke();
        const hx = x + Math.cos(a1) * R0, hy = cy + Math.sin(a1) * R0;
        const t = a1 + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(t) * 7, hy + Math.sin(t) * 7);
        ctx.lineTo(hx + Math.cos(t + 2.4) * 7, hy + Math.sin(t + 2.4) * 7);
        ctx.lineTo(hx + Math.cos(t - 2.4) * 7, hy + Math.sin(t - 2.4) * 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function render() {
      view.clear();
      const W = view.w;
      const small = W < 420;
      const r = view.visible;
      /* Floor */
      view.line(r.xMin, 0, r.xMax, 0, { color: C.axis, width: 3 });
      const st = at(S.t);
      const landed = S.phase === 'landed';
      const cx = view.sx(0), cy = view.sy(y(S.t));
      if (landed && opts.tuck) {
        PHY.mascot.draw(view, 0, 0, { pose: 'happy', px: small ? 92 : 120 });
      } else if (landed) {
        drawCat(cx, view.sy(0.17), st);
      } else {
        drawCat(cx, cy, st);
      }
      /* Dials */
      const dr = small ? 21 : 28;
      const dy = dr + 14;
      const rotating = S.phase === 'fall' || S.phase === 'scrub';
      const dF = rotating && (st.phase === 1 || st.phase === 3);
      dial(W - dr - 16, dy, dr, st.rotF, st.tuckF, 'קדמי', dF, st.phase === 1 ? 1 : -1);
      dial(dr + 16, dy, dr, st.rotB, st.tuckB, 'אחורי', dF, st.phase === 1 ? -1 : 1);

      K.caption(view, S.caption, view.h - 18);
      out.set('f', F.deg(st.rotF));
      out.set('b', F.deg(st.rotB));
      out.set('t', F.unit(S.t, 's', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { settle(); S.t = 0; S.phase = 'ready'; S.caption = ''; S.Lmax = 0; timeSlider.set(0); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'tuck') { opts.tuck = !!v; toggle.set(!v); settle(); S.t = 0; S.phase = 'ready'; S.caption = ''; S.Lmax = 0; timeSlider.set(0); }
        if (name === 'time') { S.t = v; S.phase = 'scrub'; timeSlider.set(v); }
        loop.requestRender();
      },
      getState() {
        const st = at(S.t);
        return { phase: S.phase, t: S.t, fallTime: TF, rotF: st.rotF, rotB: st.rotB, Lmax: S.Lmax, tuck: opts.tuck, height: y(S.t) - 0.26 };
      },
      play() { return launch(); },
    };
  };
})();

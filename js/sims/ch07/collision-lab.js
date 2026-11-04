/* PHY.sims.collisionLab: two bodies on a line. Contact is a short constant force, equal and opposite on both,
   that brings them from the speeds before to the speeds after, so the momentum total is conserved at every step
   and the kinetic energy dips while they press. In slow motion, so the contact can be seen.
   Elastic: the dip comes back. Plastic: the rest stays as heat.
   opts: {m1, m2, u1, u2, type: 'elastic'|'plastic', locked, controls, skin: 'cart'|'truck', panel: 'energy'|'force', tau, world, blind}
   blind: momentum and energy stay "?" until the first run, for a card that asks about them before the collision.
   sim.play({m1, m2, u1, u2, type, caption, endCaption}) -> Promise. setParam: m1, m2, u1, u2, type, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU, JU = K.JU;

  /* The speeds after a collision. */
  function outcome(m1, m2, u1, u2, type) {
    if (type === 'plastic') {
      const v = (m1 * u1 + m2 * u2) / (m1 + m2);
      return { v1: v, v2: v };
    }
    return {
      v1: ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2),
      v2: ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2),
    };
  }

  PHY.sims.collisionLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ m1: 2, m2: 1, u1: 6, u2: 0, type: 'plastic', locked: true, controls: false, skin: 'cart', panel: 'energy', tau: 0.12, slowContact: 0.09, world: 26, aspect: 1.75 }, opts || {});
    const WX = opts.world;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: WX, yMin: -1, yMax: 1 }, aspect: opts.aspect, minHeight: 318, maxHeight: 440 });
    const P = G2.pix(view);
    const S = { m1: opts.m1, m2: opts.m2, u1: opts.u1, u2: opts.u2, type: opts.type, locked: opts.locked, blind: !!opts.blind };
    const ctl = {};

    function half(m) {
      if (opts.skin === 'truck') return m > 500 ? 5 : 2.6;
      return (WX / 26) * (1.0 + 0.32 * Math.cbrt(m));
    }
    const BUMP = () => (WX / 26) * 0.42;

    function place() {
      S.h1 = half(S.m1);
      S.h2 = half(S.m2);
      const gapTouch = S.h1 + S.h2 + 2 * BUMP();
      const xc = (WX * (S.u2 < -0.01 && S.u1 > 0.01 ? 0.5 : 0.42));
      let tA = 1.25;
      if (S.u1 > 0.01) tA = Math.min(tA, (xc - gapTouch / 2 - S.h1 - 0.2) / S.u1);
      if (S.u2 < -0.01) tA = Math.min(tA, (WX - xc - gapTouch / 2 - S.h2 - 0.2) / -S.u2);
      tA = Math.max(0.3, tA);
      S.x1 = xc - gapTouch / 2 - S.u1 * tA;
      S.x2 = xc + gapTouch / 2 - S.u2 * tA;
      S.touch = gapTouch;
    }

    function clearRun() {
      place();
      Object.assign(S, {
        phase: 'ready', v1: S.u1, v2: S.u2, tAfter: 0, tc: 0, a1: 0, a2: 0, force: 0, peakForce: 0, dv1: 0, dv2: 0,
        ke0: 0.5 * S.m1 * S.u1 * S.u1 + 0.5 * S.m2 * S.u2 * S.u2, p0: S.m1 * S.u1 + S.m2 * S.u2, pMin: Infinity, pMax: -Infinity,
        caption: '', endCaption: '', tRun: 0, pose: 'standing', collided: false, contactT: 0,
      });
      const o = outcome(S.m1, S.m2, S.u1, S.u2, S.type);
      S.f1 = o.v1;
      S.f2 = o.v2;
    }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }

    /* ---------- controls ---------- */
    if (opts.controls) {
      ctl.m1 = U.Slider(controlsEl, { label: 'מסה 1', min: 0.5, max: 20, step: 0.5, value: S.m1, unit: 'kg', digits: 1, color: 'var(--accent)', onInput(v) { S.m1 = v; changed(); } });
      ctl.u1 = U.Slider(controlsEl, { label: 'מהירות 1', min: 0, max: 10, step: 0.5, value: S.u1, unit: 'ms', digits: 1, color: 'var(--c-velocity)', onInput(v) { S.u1 = v; changed(); } });
      ctl.m2 = U.Slider(controlsEl, { label: 'מסה 2', min: 0.5, max: 20, step: 0.5, value: S.m2, unit: 'kg', digits: 1, color: 'var(--accent)', onInput(v) { S.m2 = v; changed(); } });
      ctl.u2 = U.Slider(controlsEl, { label: 'מהירות 2 (מינוס: שמאלה)', min: -8, max: 8, step: 0.5, value: S.u2, unit: 'ms', digits: 1, color: 'var(--c-velocity)', onInput(v) { S.u2 = v; changed(); } });
      const row = U.h('div', { class: 'sim-row' });
      ctl.run = U.Button(row, 'להתנגש!', function () { free(); }, { primary: true });
      ctl.type = U.Toggle(row, 'נדבקים (פלסטית)', { value: S.type === 'plastic', onChange(v) { S.type = v ? 'plastic' : 'elastic'; changed(); } });
      controlsEl.appendChild(row);
      const presets = U.h('div', { class: 'sim-row' });
      [
        ['נדבקים', { m1: 2, m2: 1, u1: 6, u2: 0, type: 'plastic' }],
        ['מסות שוות', { m1: 2, m2: 2, u1: 5, u2: 0, type: 'elastic' }],
        ['כבד פוגע בקל', { m1: 19, m2: 1, u1: 4, u2: 0, type: 'elastic' }],
        ['קל פוגע בכבד', { m1: 1, m2: 19, u1: 4, u2: 0, type: 'elastic' }],
        ['חזית מול חזית', { m1: 2, m2: 2, u1: 3, u2: -3, type: 'plastic' }],
      ].forEach(function (p) {
        U.Button(presets, p[0], function () { apply(p[1]); if (!S.locked) free(); });
      });
      controlsEl.appendChild(presets);
    }
    const out = U.Readouts(controlsEl, opts.panel === 'force' ? [
      { key: 'd1', label: 'שינוי מהירות המשאית', color: 'var(--c-velocity)' },
      { key: 'd2', label: 'שינוי מהירות האופניים', color: 'var(--c-velocity)' },
      { key: 'F', label: 'הכוח בזמן המגע', color: 'var(--c-force)' },
    ] : [
      { key: 'v1', label: 'מהירות 1', color: 'var(--c-velocity)' },
      { key: 'v2', label: 'מהירות 2', color: 'var(--c-velocity)' },
      { key: 'pt', label: 'תנע כולל' },
      { key: 'ke', label: 'אנרגיה קינטית' },
      { key: 'hot', label: 'הפך לחום' },
    ]);

    function syncControls() {
      if (!opts.controls) return;
      ctl.m1.set(S.m1); ctl.m2.set(S.m2); ctl.u1.set(S.u1); ctl.u2.set(S.u2);
      ctl.type.set(S.type === 'plastic');
    }
    function setLocked(v) {
      S.locked = v;
      if (!opts.controls) return;
      ['m1', 'm2', 'u1', 'u2'].forEach(function (k) { ctl[k].setEnabled(!v); });
      ctl.run.disabled = v;
      ctl.type.input.disabled = v;
    }
    function apply(o) {
      ['m1', 'm2', 'u1', 'u2', 'type'].forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
      syncControls();
      settle();
      clearRun();
      loop.requestRender();
    }
    function changed() { settle(); clearRun(); loop.requestRender(); }

    function launch(o) {
      o = o || {};
      S.blind = false;
      apply(o);
      S.phase = 'approach';
      S.caption = o.caption || '';
      S.endCaption = o.endCaption || '';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function free() {
      if (S.locked || S.phase === 'approach' || S.phase === 'contact' || S.phase === 'after') return;
      launch({}).then(function () { if (opts.onFree) opts.onFree(); });
    }

    /* ---------- physics ---------- */
    function step(dt) {
      if (S.phase !== 'approach' && S.phase !== 'contact' && S.phase !== 'after') return;
      if (S.phase === 'contact') {
        const h = dt * opts.slowContact;
        const left = S.tau - S.tc;
        if (left <= h + 1e-9) {
          /* The last slice lands exactly on the speeds after. */
          S.v1 += S.a1 * left;
          S.v2 += S.a2 * left;
          S.x1 += S.v1 * left;
          S.x2 += S.v2 * left;
          S.v1 = S.f1;
          S.v2 = S.f2;
          S.tc = S.tau;
          S.force = 0;
          S.phase = 'after';
          S.tAfter = 0;
          S.pose = poseAfter();
        } else {
          S.tc += h;
          S.v1 += S.a1 * h;
          S.v2 += S.a2 * h;
          S.x1 += S.v1 * h;
          S.x2 += S.v2 * h;
        }
        track();
        return;
      }
      S.x1 += S.v1 * dt;
      S.x2 += S.v2 * dt;
      S.tRun += dt;
      track();
      if (S.phase === 'approach') {
        if (S.x2 - S.x1 <= S.touch && S.u1 > S.u2 + 1e-9) {
          S.phase = 'contact';
          S.collided = true;
          S.tc = 0;
          S.tau = Math.round(opts.tau * 120) / 120;
          S.a1 = (S.f1 - S.u1) / S.tau;
          S.a2 = (S.f2 - S.u2) / S.tau;
          S.force = Math.abs(S.m1 * S.a1);
          S.peakForce = S.force;
          S.dv1 = S.f1 - S.u1;
          S.dv2 = S.f2 - S.u2;
        } else if (S.tRun > 1.8 && S.u1 <= S.u2 + 1e-9) {
          S.phase = 'done';
          S.caption = 'הם לא נפגשים: הראשון לא משיג את השני';
          settle();
        }
        return;
      }
      S.tAfter += dt;
      const off = S.x1 + S.h1 > WX || S.x1 - S.h1 < 0 || S.x2 + S.h2 > WX || S.x2 - S.h2 < 0;
      if (off || S.tAfter >= 1.5) {
        S.phase = 'done';
        S.pose = poseAfter();
        if (S.endCaption) S.caption = S.endCaption;
        settle();
      }
    }
    function track() {
      const p = S.m1 * S.v1 + S.m2 * S.v2;
      S.pMin = Math.min(S.pMin, p);
      S.pMax = Math.max(S.pMax, p);
    }
    function poseAfter() {
      if (S.f1 < -0.05) return 'flying';
      return Math.abs(S.f1) < Math.abs(S.u1) * 0.9 ? 'dizzy' : 'happy';
    }

    /* ---------- drawing ---------- */
    function drawTruck(cx, gy, w, h) {
      const ctx = view.ctx;
      const front = cx + w / 2;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.surface;
      const bedW = w * 0.68;
      ctx.beginPath();
      ctx.rect(cx - w / 2, gy - 10 - h, bedW, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + bedW + 2, gy - 10);
      ctx.lineTo(cx - w / 2 + bedW + 2, gy - 10 - h * 0.86);
      ctx.lineTo(front - 8, gy - 10 - h * 0.86);
      ctx.lineTo(front, gy - 10 - h * 0.4);
      ctx.lineTo(front, gy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      [-0.3, 0.33].forEach(function (k) {
        ctx.beginPath();
        ctx.arc(cx + k * w, gy - 7, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      view.screenText(cx - w / 2 + bedW / 2, gy - 10 - h / 2, F.unit(S.m1, 'kg', 0), { size: bedW < 60 ? 9.5 : 11, weight: 700 });
    }
    function drawBike(cx, gy, w) {
      const r = Math.min(9, w * 0.24);
      const ax = cx - w * 0.3, bx = cx + w * 0.3, y = gy - r;
      P.circle(ax, y, r, { color: C.ink, width: 2.2 });
      P.circle(bx, y, r, { color: C.ink, width: 2.2 });
      P.line(ax, y, cx, y - r * 1.2, { color: C.accent, width: 2.6 });
      P.line(cx, y - r * 1.2, bx, y, { color: C.accent, width: 2.6 });
      P.line(ax, y, cx, y, { color: C.accent, width: 2.6 });
    }

    function drawTrack(gy) {
      const W = view.w;
      P.line(4, gy, W - 4, gy, { color: C.axis, width: 2.4 });
      const every = WX > 30 ? 5 : 2;
      for (let x = 0; x <= WX; x += every) {
        const px = view.sx(x);
        P.line(px, gy, px, gy + 4, { color: C.axis, width: 1.2 });
      }
    }

    function drawBody() {
      const W = view.w;
      const small = W < 420;
      const gy = trackY();
      drawTrack(gy);
      /* The bumpers are the part that squashes. They close the distance the bodies still travel in the contact. */
      const gapNow = S.x2 - S.x1;
      const b = BUMP();
      const squeeze = Math.max(0, S.touch - gapNow);
      const bumpLen = Math.max(0.04, b - squeeze / 2) * view.scale;
      const w1 = S.h1 * 2 * view.scale, w2 = S.h2 * 2 * view.scale;
      const x1 = view.sx(S.x1), x2 = view.sx(S.x2);
      const bodyH = small ? 30 : 38;
      let top1;
      if (opts.skin === 'truck') {
        drawTruck(x1, gy, w1, small ? 28 : 36);
        drawBike(x2, gy, w2);
        top1 = gy - (small ? 24 : 30);
        const pos = view.toWorld(x2, top1 + 8);
        PHY.mascot.draw(view, pos.x, pos.y, { pose: S.collided ? 'flying' : 'happy', px: small ? 44 : 58, flipX: true });
      } else {
        const a = K.cart(view, x1, gy, w1, bodyH, { color: C.accent, label: F.unit(S.m1, 'kg', S.m1 % 1 ? 1 : 0), bumpR: bumpLen, labelSize: w1 < 44 ? 10.5 : 12 });
        K.cart(view, x2, gy, w2, bodyH, { color: C.gold, label: F.unit(S.m2, 'kg', S.m2 % 1 ? 1 : 0), bumpL: bumpLen, labelSize: w2 < 44 ? 10.5 : 12 });
        const pos = view.toWorld(x1, a.top);
        PHY.mascot.draw(view, pos.x, pos.y, { pose: S.pose, px: small ? 40 : 52 });
      }
      /* Momentum and force arrows */
      const pm = Math.max(Math.abs(S.m1 * S.u1), Math.abs(S.m2 * S.u2), Math.abs(S.m1 * S.f1), Math.abs(S.m2 * S.f2), 1e-6);
      const ky = (W * 0.17) / pm;
      /* Two rows, so the arrows of two carts that touch never sit on each other. The label sits behind the tail. */
      const p1 = S.m1 * S.v1, p2 = S.m2 * S.v2;
      const pArrow = function (x, p, y) {
        if (S.blind || Math.abs(p) <= pm * 0.01) return;
        P.arrow(x, y, x + p * ky, y, { color: C.velocity, width: 3.6, head: 11 });
        view.screenText(x - Math.sign(p) * 9, y, 'p', { size: 13, weight: 700, color: C.velocity, halo: true });
      };
      pArrow(x1, p1, gy + 13);
      pArrow(x2, p2, gy + 29);
      if (S.phase === 'contact') {
        /* The pair of contact forces: each one acts on its own body, and they are the same length. */
        const yf = opts.skin === 'truck' ? gy - 24 : gy - 12 - bodyH * 0.45;
        const kf = W * 0.13;
        const a = x1 - w1 / 2, b = x2 + w2 / 2;
        P.arrow(a, yf, a - kf, yf, { color: C.force, width: 4.5, label: 'F', labelSide: 1, labelGap: 12 });
        P.arrow(b, yf, b + kf, yf, { color: C.force, width: 4.5, label: 'F', labelSide: -1, labelGap: 12 });
      }
    }

    function trackY() {
      const H = view.h;
      return Math.round(Math.max(116, Math.min(170, H * 0.37)));
    }

    function panelEnergy(top) {
      const W = view.w;
      const pad = 10, nameW = 54, valW = 42;
      const bx = pad + valW, bw = W - pad * 2 - valW - nameW;
      const rh = Math.max(13, Math.min(18, (view.h - top - 44) / 5));
      const gap = 4;
      let y = top;
      view.screenText(W - pad, y + 7, 'תנע (' + PU + ')', { size: 11.5, weight: 700, align: 'right', color: C.velocity });
      y += 16;
      const p1 = S.m1 * S.v1, p2 = S.m2 * S.v2;
      const pmax = Math.max(Math.abs(S.m1 * S.u1), Math.abs(S.m2 * S.u2), Math.abs(S.m1 * S.f1), Math.abs(S.m2 * S.f2), Math.abs(S.p0), 1e-6);
      [['גוף 1', p1], ['גוף 2', p2], ['סך הכול', p1 + p2]].forEach(function (r, i) {
        K.signedBar(view, bx, y + 1, bw, rh - 2, S.blind ? 0 : r[1], pmax, i === 2 ? C.ink : C.velocity);
        K.row(view, y, rh, r[0], S.blind ? '?' : F.num(r[1], 1), { pad: pad });
        y += rh + gap - 1;
      });
      y += 3;
      view.screenText(W - pad, y + 7, 'אנרגיה (' + JU + ')', { size: 11.5, weight: 700, align: 'right', color: C.accent });
      y += 16;
      const ke1 = 0.5 * S.m1 * S.v1 * S.v1, ke2 = 0.5 * S.m2 * S.v2 * S.v2;
      const kNow = ke1 + ke2;
      const scale = S.ke0 > 0 && !S.blind ? bw / S.ke0 : 0;
      /* Before */
      const b1 = 0.5 * S.m1 * S.u1 * S.u1, b2 = 0.5 * S.m2 * S.u2 * S.u2;
      K.bar(view, bx, y + 1, b1 * scale, rh - 2, C.accent);
      K.bar(view, bx + b1 * scale, y + 1, b2 * scale, rh - 2, C.accent, 0.55);
      K.row(view, y, rh, 'לפני', S.blind ? '?' : F.num(S.ke0, 1), { pad: pad });
      y += rh + gap - 1;
      /* Now: whatever left the kinetic bars is shown next to them. */
      K.bar(view, bx, y + 1, ke1 * scale, rh - 2, C.accent);
      K.bar(view, bx + ke1 * scale, y + 1, ke2 * scale, rh - 2, C.accent, 0.55);
      const rest = Math.max(0, S.ke0 - kNow);
      if (rest > S.ke0 * 0.004) {
        const restColor = S.type === 'elastic' ? C.soft : C.apple;
        K.bar(view, bx + kNow * scale, y + 1, rest * scale, rh - 2, restColor);
        const label = (S.type === 'elastic' ? 'קפיץ ' : 'חום ') + F.num(rest, 1);
        if (rest * scale > 44) view.screenText(bx + (kNow + rest / 2) * scale, y + rh / 2, label, { size: 11, weight: 700, color: C.surface });
      }
      K.row(view, y, rh, 'עכשיו', S.blind ? '?' : F.num(kNow, 1), { pad: pad });
    }

    function panelForce(top) {
      const W = view.w;
      const pad = 10, nameW = 66, valW = 46;
      const bx = pad + valW, bw = W - pad * 2 - valW - nameW;
      const rh = Math.max(13, Math.min(18, (view.h - top - 44) / 4));
      const gap = 4;
      let y = top;
      view.screenText(W - pad, y + 7, 'כוח בזמן המגע (ניוטון)', { size: 11.5, weight: 700, align: 'right', color: C.force });
      y += 16;
      const f = S.peakForce;
      const seen = S.collided;
      [['על המשאית', f], ['על האופניים', f]].forEach(function (r) {
        K.bar(view, bx, y + 1, bw, rh - 2, C.grid);
        if (seen) K.bar(view, bx, y + 1, bw * 0.92, rh - 2, C.force, S.phase === 'contact' ? 1 : 0.65);
        K.row(view, y, rh, r[0], seen ? F.num(r[1], 0) : '0', { pad: pad });
        y += rh + gap - 1;
      });
      y += 3;
      view.screenText(W - pad, y + 7, 'שינוי המהירות (מ/ש)', { size: 11.5, weight: 700, align: 'right', color: C.velocity });
      y += 16;
      const d1 = S.v1 - S.u1, d2 = S.v2 - S.u2;
      const dm = Math.max(Math.abs(S.dv1), Math.abs(S.dv2), 1e-6);
      [['משאית', d1], ['אופניים', d2]].forEach(function (r) {
        K.signedBar(view, bx, y + 1, bw, rh - 2, r[1], dm, C.velocity);
        K.row(view, y, rh, r[0], F.num(r[1], 1), { pad: pad });
        y += rh + gap - 1;
      });
    }

    function render() {
      view.clear();
      drawBody();
      const top = trackY() + 38;
      if (opts.panel === 'force') panelForce(top);
      else panelEnergy(top);
      K.caption(view, S.caption, 16);

      const p = S.m1 * S.v1 + S.m2 * S.v2;
      const ke = 0.5 * S.m1 * S.v1 * S.v1 + 0.5 * S.m2 * S.v2 * S.v2;
      if (opts.panel === 'force') {
        out.set('d1', F.unit(S.v1 - S.u1, 'ms', 1));
        out.set('d2', F.unit(S.v2 - S.u2, 'ms', 1));
        out.set('F', S.collided ? F.unit(S.peakForce, 'N', 0) : '...');
      } else {
        out.set('v1', F.unit(S.v1, 'ms', 2));
        out.set('v2', F.unit(S.v2, 'ms', 2));
        out.set('pt', S.blind ? '?' : F.unit(p, PU, 1));
        out.set('ke', S.blind ? '?' : F.unit(ke, JU, 1));
        out.set('hot', S.type === 'plastic' && S.collided ? F.unit(Math.max(0, S.ke0 - ke), JU, 1) : F.unit(0, JU, 0));
      }
    }

    const loop = PHY.SimLoop({ view, step, render });
    clearRun();
    setLocked(opts.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { settle(); clearRun(); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        const o = {};
        o[name] = v;
        apply(o);
      },
      getState() {
        const ke = 0.5 * S.m1 * S.v1 * S.v1 + 0.5 * S.m2 * S.v2 * S.v2;
        return {
          phase: S.phase, m1: S.m1, m2: S.m2, u1: S.u1, u2: S.u2, v1: S.v1, v2: S.v2, type: S.type,
          p: S.m1 * S.v1 + S.m2 * S.v2, p0: S.p0, pMin: S.pMin, pMax: S.pMax, ke: ke, ke0: S.ke0, lost: S.ke0 - ke,
          force: S.peakForce, dv1: S.v1 - S.u1, dv2: S.v2 - S.u2, collided: S.collided, tau: S.tau,
          impulse1: S.m1 * (S.v1 - S.u1), impulse2: S.m2 * (S.v2 - S.u2),
        };
      },
      play(o) { return launch(o); },
    };
  };
  PHY.sims.collisionLab.outcome = outcome;
})();

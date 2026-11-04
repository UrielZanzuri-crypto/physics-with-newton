/* PHY.sims.boxTip: a box on a ramp whose friction is high enough that it never slides. Width w, height h.
   While the line straight down from the center of gravity lands on the base, the box stays. Past that,
   gravity turns it about the downhill corner: I phi'' = -m g r cos(beta), integrated for real.
   The tipping angle is measured from the run, and the test compares it with tan(angle) = w / h.
   opts: {w, h, locked}. sim.play() raises the ramp until the box has tipped. setParam: angle, h, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  PHY.sims.boxTip = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({ w: 0.9, h: 1.2, s: 2.7, rampL: 5, rate: 9, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -1.1, xMax: 5.3, yMin: -0.35, yMax: 4.1 }, aspect: 1.45, minHeight: 270, maxHeight: 460,
    });
    const S = {
      a: 0, w: o.w, h: o.h, phi: 0, om: 0, phase: 'ready', tipAngle: null, resolve: null,
      caption: '', locked: o.locked, pose: 'standing',
    };
    const tipLimit = () => Math.atan(S.w / S.h) / RAD;
    /* A locked box is waiting for a guess about this very angle. */
    const limitShown = () => !S.locked || S.tipAngle !== null;

    function U_(a) { return { x: Math.cos(a * RAD), y: Math.sin(a * RAD) }; }
    /* The corner the box turns about: downhill end of its base. */
    function corner() { const u = U_(S.a); return { x: o.s * u.x, y: o.s * u.y }; }
    /* Box frame (along the base, up from the base) to world, including the tip angle. */
    function W(x, y) {
      const p = corner(), a = S.a + S.phi;
      const u = U_(a), n = { x: -u.y, y: u.x };
      return { x: p.x + x * u.x + y * n.x, y: p.y + x * u.y + y * n.y };
    }
    function cog() { return W(S.w / 2, S.h / 2); }
    function offBase() {
      const c = cog(), p = corner();
      return c.x - p.x;  /* negative: the center of gravity is past the downhill corner */
    }

    function finish() {
      const r = S.resolve;
      S.resolve = null;
      if (r) r();
    }
    function step(dt) {
      if (S.phase === 'raise') {
        S.a += o.rate * dt;
        sAngle.set(Math.round(S.a));
        if (offBase() < 0) {
          S.tipAngle = S.a;
          S.phase = 'tip';
          S.pose = 'falling';
          S.caption = 'הקו יצא מהבסיס!';
        }
      }
      if (S.phase === 'tip' || S.phase === 'freeTip') {
        const c = cog(), p = corner();
        const rx = c.x - p.x;
        const I = (S.w * S.w + S.h * S.h) / 3;      /* per unit mass, box about a corner */
        S.om += ((-G * rx) / I) * dt;
        S.phi += (S.om * dt) / RAD;
        if (S.phi >= 90) {
          S.phi = 90;
          S.om = 0;
          S.phase = 'down';
          S.pose = 'dizzy';
          S.caption = 'נפל על הצד. החתול עדיין טוען שזה היה מכוון.';
          finish();
        }
        if (S.phi < 0) { S.phi = 0; S.om = 0; S.phase = 'ready'; }
      }
    }

    function clearRun() {
      finish();
      S.phi = 0; S.om = 0; S.tipAngle = null; S.caption = ''; S.pose = 'standing';
      S.phase = 'ready';
    }
    function play() {
      clearRun();
      S.a = 0;
      S.phase = 'raise';
      sAngle.set(0);
      return new Promise(function (res) { S.resolve = res; });
    }

    function render() {
      const small = view.w < 520;
      view.clear();
      view.grid(1, {});
      B.drawGround(view, 0, {});
      const u = U_(S.a), end = { x: o.rampL * u.x, y: o.rampL * u.y };

      /* the ramp */
      view.poly([{ x: 0, y: 0 }, end, { x: end.x, y: 0 }], { fill: C.shade, close: true });
      view.line(0, 0, end.x, end.y, { color: C.axis, width: 6 });
      view.line(end.x, 0, end.x, end.y, { color: C.soft, width: 2.5 });
      view.circle(0, 0, 6, { px: true, fill: C.surface, color: C.ink, width: 2 });
      if (S.a > 2) {
        view.arc(0, 0, small ? 30 : 42, 0, S.a, { color: C.accent, width: 2.5 });
        view.text(0, 0, F.deg(S.a, 0), { size: small ? 12 : 14, weight: 800, color: C.accent, halo: true, offset: [(small ? 46 : 60) * Math.cos((S.a / 2) * RAD), -(small ? 46 : 60) * Math.sin((S.a / 2) * RAD)] });
      }

      /* the cat, inside the box */
      const a = S.a + S.phi;
      const catFoot = W(S.w / 2, S.h * 0.46);
      PHY.mascot.draw(view, catFoot.x, catFoot.y, { pose: S.pose, h: S.h * 0.95, rot: a, anchor: S.pose === 'falling' ? [0.5, 0.96] : undefined });

      /* the box */
      const pts = [W(0, 0), W(S.w, 0), W(S.w, S.h), W(0, S.h)];
      view.poly(pts, { fill: C.gold, color: C.ink, width: 2.4, close: true });
      const s0 = W(0, S.h * 0.5), s1 = W(S.w, S.h * 0.5);
      view.line(s0.x, s0.y, s1.x, s1.y, { color: C.ink, width: 1.2, alpha: 0.35 });

      /* the base and the line down from the center of gravity */
      const base0 = corner(), base1 = { x: (o.s + S.w) * u.x, y: (o.s + S.w) * u.y };
      const c = cog();
      const onBase = S.phi === 0 && offBase() >= 0;
      if (S.phi === 0) view.line(base0.x, base0.y, base1.x, base1.y, { color: onBase ? C.good : C.bad, width: 5 });
      /* where the vertical through the center of gravity meets the ramp */
      const tHit = c.y / Math.max(u.y, 1e-6);
      const hit = S.a > 0.5 ? { x: c.x, y: c.x * Math.tan(S.a * RAD) } : { x: c.x, y: 0 };
      if (tHit >= 0 && S.phase !== 'down') view.line(c.x, c.y, hit.x, hit.y, { color: onBase ? C.good : C.bad, width: 2.2, dash: [6, 5] });
      view.circle(c.x, c.y, small ? 5 : 6.5, { px: true, fill: C.surface, color: C.accent, width: 3 });
      const armLen = (small ? 38 : 54) / view.scale;
      view.arrow(c.x, c.y, c.x, c.y - armLen, { color: C.force, width: 3.2, head: 11 });

      /* the turning corner */
      if (S.phase === 'tip' || S.phase === 'freeTip') {
        const cc = corner();
        St.curved(view, cc.x, cc.y, small ? 26 : 34, 70 + S.a, 150 + S.a, { width: 3 });
      }

      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 12 : 14, weight: 700, pill: true });
      out.set('a', St.deg(S.a, 1));
      out.set('lim', limitShown() ? St.deg(tipLimit(), 1) : '?');
      out.set('state', S.phase === 'down' ? 'נפל' : (S.phase === 'tip' || S.phase === 'freeTip') ? 'מתהפך' : 'עומד');
    }

    const loop = PHY.SimLoop({ view, step, render });

    const sAngle = U.Slider(controlsEl, {
      label: 'שיפוע המישור', min: 0, max: 60, step: 1, value: 0, format: (v) => St.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; freeCheck(); },
    });
    const sHeight = U.Slider(controlsEl, {
      label: 'גובה הארגז', min: 0.6, max: 2, step: 0.1, value: o.h, unit: 'm', digits: 1, color: 'var(--accent)',
      onInput(v) { S.h = v; freeCheck(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'a', label: 'השיפוע עכשיו', color: 'var(--accent)' },
      { key: 'lim', label: 'זווית ההתהפכות', color: 'var(--accent)' },
      { key: 'state', label: 'הארגז' },
    ]);
    function freeCheck() {
      /* Any change stands the box up again, and if it is past the limit, it tips from there. */
      finish();
      S.phi = 0; S.om = 0; S.caption = ''; S.pose = 'standing';
      S.phase = offBase() < 0 ? 'freeTip' : 'ready';
      if (S.phase === 'freeTip') S.pose = 'falling';
      loop.requestRender();
    }
    function setLocked(v) {
      S.locked = !!v;
      sAngle.setEnabled(!S.locked);
      sHeight.setEnabled(!S.locked);
    }
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clearRun(); S.a = 0; S.h = o.h; sAngle.set(0); sHeight.set(o.h); loop.requestRender(); },
      play,
      setParam(name, v) {
        if (name === 'locked') { setLocked(v); return; }
        if (name === 'angle') { S.a = v; sAngle.set(v); freeCheck(); }
        if (name === 'h') { S.h = v; sHeight.set(v); freeCheck(); }
      },
      getState() { return { angle: S.a, phi: S.phi, phase: S.phase, tipAngle: S.tipAngle, limit: tipLimit(), limitShown: limitShown(), w: S.w, h: S.h }; },
    };
  };
})();

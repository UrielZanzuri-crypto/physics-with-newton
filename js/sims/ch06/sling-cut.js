/* PHY.sims.slingCut: the hook. Seen from above, Newton whirls an apple on a string, and the string is cut.
   The apple then has no force on it, so it keeps the velocity it had: a straight line along the tangent, at
   constant speed. The guessed path can be drawn next to what really happened.
   opts: {R, v, cutDeg, turns, locked}. sim.play({guess}) -> Promise, whirls and cuts at cutDeg (position angle).
   sim.cutNow() cuts right away. setParam: v, locked. getState(): phase, phi, cut {x, y, deg}, pos, vel, speed,
   flightDeg, tangentDeg, lineErr (largest distance from the tangent line during the flight). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const RAD = Math.PI / 180;

  PHY.sims.slingCut = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ R: 2, v: 4, cutDeg: -60, turns: 1, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -6.2, xMax: 6.2, yMin: -3.5, yMax: 3.5 }, aspect: 1.72, minHeight: 240, maxHeight: 440 });
    const S = {
      R: opts.R, v: opts.v, phi: 120 * RAD, phase: 'whirl', plan: null, pos: null, vel: null, cut: null,
      strobes: [], nextStrobe: 0, flightT: 0, lineErr: 0, guess: -1, caption: '', locked: opts.locked, resolve: null,
    };

    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות התפוח', min: 2, max: 7, step: 0.5, value: S.v, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; api.reset(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const cutBtn = U.Button(row, 'לגזור את החוט', function () { if (!S.locked) cutNow(); }, { primary: true });
    const newBtn = U.Button(row, 'חוט חדש', function () { if (!S.locked) api.reset(); }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'ang', label: 'בין כיוון המעוף לחוט' },
    ]);

    function setLocked(v) {
      S.locked = v;
      speedSlider.setEnabled(!v);
      cutBtn.disabled = v;
      newBtn.disabled = v;
    }

    function applePos() { return { x: S.R * Math.cos(S.phi), y: S.R * Math.sin(S.phi) }; }
    function appleVel() { return { x: -S.v * Math.sin(S.phi), y: S.v * Math.cos(S.phi) }; }

    function cutNow() {
      if (S.phase !== 'whirl') return;
      const p = applePos(), u = appleVel();
      S.pos = p;
      S.vel = u;
      S.cut = { x: p.x, y: p.y, deg: S.phi / RAD };
      S.phase = 'fly';
      S.plan = null;
      S.flightT = 0;
      S.nextStrobe = 0;
      S.lineErr = 0;
      S.strobes = [{ x: p.x, y: p.y }];
      S.caption = 'החוט נגזר!';
    }

    function step(dt) {
      if (S.phase === 'whirl') {
        const d = (S.v / S.R) * dt;
        S.phi += d;
        if (S.plan) {
          S.plan.left -= d;
          if (S.plan.left <= 0) {
            S.phi += S.plan.left;
            cutNow();
          }
        }
      } else if (S.phase === 'fly') {
        S.pos = { x: S.pos.x + S.vel.x * dt, y: S.pos.y + S.vel.y * dt };
        S.flightT += dt;
        const speed = Math.hypot(S.vel.x, S.vel.y);
        const off = Math.abs((S.pos.x - S.cut.x) * S.vel.y - (S.pos.y - S.cut.y) * S.vel.x) / speed;
        S.lineErr = Math.max(S.lineErr, off);
        S.nextStrobe += dt;
        if (S.nextStrobe >= 0.25) {
          S.nextStrobe -= 0.25;
          S.strobes.push({ x: S.pos.x, y: S.pos.y });
        }
        const r = view.visible;
        if (S.pos.x < r.xMin - 0.5 || S.pos.x > r.xMax + 0.5 || S.pos.y < r.yMin - 0.5 || S.pos.y > r.yMax + 0.5) {
          S.phase = 'gone';
          S.caption = 'קו ישר, בדיוק לאן שהיה בדרך.';
          K.settle(S);
        }
      }
    }

    function drawGuess() {
      if (S.guess < 0 || S.guess === 2 || !S.cut) return;
      const a0 = S.cut.deg * RAD;
      const r = view.visible;
      let pts = [];
      if (S.guess === 0) {
        for (let k = 0; k <= 60; k++) {
          const th = (k / 60) * 1.15 * Math.PI;
          const rr = S.R + 0.75 * th;
          pts.push({ x: rr * Math.cos(a0 + th), y: rr * Math.sin(a0 + th) });
        }
        pts = pts.filter(function (p) { return p.y > r.yMin && p.y < r.yMax && p.x > r.xMin && p.x < r.xMax; });
      } else if (S.guess === 1) {
        const far = 9;
        pts = [{ x: S.cut.x, y: S.cut.y }, { x: far * Math.cos(a0), y: far * Math.sin(a0) }];
      } else {
        pts = [{ x: S.cut.x, y: S.cut.y }, { x: 0, y: 0 }];
      }
      if (pts.length < 2) return;
      view.poly(pts, { color: C.soft, width: 2.4, dash: [7, 6] });
      const end = S.guess === 3 ? { x: S.cut.x * 0.45, y: S.cut.y * 0.45 } : S.guess === 1 ? { x: S.cut.x * 1.5, y: S.cut.y * 1.5 } : pts[Math.floor(pts.length * 0.55)];
      view.text(end.x, end.y, 'הניחוש שלך', { size: 12.5, weight: 700, color: C.soft, halo: true, offset: S.guess === 3 ? [-40, 0] : [-42, 4] });
    }

    function render() {
      const small = view.w < 420;
      const cat = small ? 54 : 70;
      const applePx = small ? 17 : 20;
      view.clear();
      view.grid(1);
      view.circle(0, 0, S.R, { color: C.gridStrong, width: 2, dash: [5, 6] });

      if (S.phase === 'whirl') {
        const p = applePos(), u = appleVel();
        const kv = 0.4;
        view.line(0, 0, p.x, p.y, { color: C.ink, width: 2 });
        PHY.mascot.draw(view, 0, 0, { pose: 'standing', px: cat, anchor: [0.5, 0.62] });
        K.apple(view, p.x, p.y, applePx);
        view.arrow(p.x, p.y, p.x * 0.45, p.y * 0.45, { color: C.force, width: 3.5 });
        /* The velocity arrow is the card's answer, so it waits until the guess is in. */
        if (!S.locked || S.plan) {
          view.arrow(p.x, p.y, p.x + u.x * kv, p.y + u.y * kv, { color: C.velocity, width: 3.5 });
          K.tipLabel(view, p.x, p.y, p.x + u.x * kv, p.y + u.y * kv, 'v', { color: C.velocity });
        }
      } else {
        const a0 = S.cut.deg * RAD;
        const speed = Math.hypot(S.vel.x, S.vel.y);
        const tx = S.vel.x / speed, ty = S.vel.y / speed;
        const ex = -Math.cos(a0), ey = -Math.sin(a0);
        drawGuess();
        view.line(0, 0, S.cut.x, S.cut.y, { color: C.soft, width: 1.6, dash: [4, 5] });
        view.line(S.cut.x, S.cut.y, S.pos.x, S.pos.y, { color: C.displacement, width: 2.6 });
        /* the frayed string stays with the cat */
        view.line(0, 0, S.cut.x * 0.42, S.cut.y * 0.42, { color: C.ink, width: 2 });
        S.strobes.forEach(function (q) { K.apple(view, q.x, q.y, applePx, { alpha: 0.28, plain: true }); });
        /* a right-angle mark where the string was */
        const m = 13 / view.scale;
        view.poly([
          { x: S.cut.x + ex * m, y: S.cut.y + ey * m },
          { x: S.cut.x + ex * m + tx * m, y: S.cut.y + ey * m + ty * m },
          { x: S.cut.x + tx * m, y: S.cut.y + ty * m },
        ], { color: C.accent, width: 2 });
        PHY.mascot.draw(view, 0, 0, { pose: S.phase === 'gone' ? 'thinking' : 'dizzy', px: cat, anchor: [0.5, 0.62] });
        K.apple(view, S.pos.x, S.pos.y, applePx);
        if (S.phase === 'fly') {
          view.arrow(S.pos.x, S.pos.y, S.pos.x + S.vel.x * 0.4, S.pos.y + S.vel.y * 0.4, { color: C.velocity, width: 3.5 });
          K.tipLabel(view, S.pos.x, S.pos.y, S.pos.x + S.vel.x * 0.4, S.pos.y + S.vel.y * 0.4, 'v', { color: C.velocity });
        }
      }
      if (S.caption) view.screenText(view.w / 2, 20, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });

      out.set('v', F.unit(S.phase === 'whirl' ? S.v : Math.hypot(S.vel.x, S.vel.y), 'ms', 1));
      out.set('ang', S.phase === 'whirl' ? 'עוד לא נגזר' : K.deg(90));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        K.settle(S);
        S.phase = 'whirl';
        S.plan = null;
        S.pos = null;
        S.vel = null;
        S.cut = null;
        S.strobes = [];
        S.lineErr = 0;
        S.guess = -1;
        S.caption = '';
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'v') { S.v = v; speedSlider.set(v); api.reset(); }
      },
      getState() {
        const moving = S.phase !== 'whirl';
        return {
          phase: S.phase, phi: S.phi / RAD, cut: S.cut, pos: S.pos, vel: S.vel, v: S.v, lineErr: S.lineErr, flightT: S.flightT,
          speed: moving ? Math.hypot(S.vel.x, S.vel.y) : S.v,
          flightDeg: moving ? PHY.vec.angle(S.vel) : null,
          tangentDeg: moving ? PHY.vec.angle(PHY.vec.polar(1, S.cut.deg + 90)) : null,
        };
      },
      play(o) {
        o = o || {};
        api.reset();
        S.guess = o.guess === undefined ? -1 : o.guess;
        const now = ((S.phi / RAD) % 360 + 360) % 360;
        const target = ((opts.cutDeg % 360) + 360) % 360;
        const ahead = ((target - now) + 360) % 360;
        S.plan = { left: (ahead + 360 * opts.turns) * RAD };
        S.caption = 'ניוטון מסובב. עוד רגע גוזרים.';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      cutNow,
    };
    view.onTap(function () { if (!S.locked) cutNow(); });
    setLocked(S.locked);
    return api;
  };
})();

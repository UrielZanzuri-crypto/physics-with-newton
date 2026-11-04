/* PHY.sims.rocket: a small rocket with a load of apples, floating at rest. Throwing an apple backward at speed u
   pushes the rocket forward by m u / M, where M is what remains. The rocket has nothing to push against but its
   own apples, and the total momentum stays 0. The camera follows the rocket, and the stars slide past.
   opts: {rocketMass, apples, appleMass, u}. sim.fire() -> Promise; sim.play() throws everything;
   setParam: locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU;

  PHY.sims.rocket = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ rocketMass: 20, apples: 10, appleMass: 1, u: 20, every: 0.42, onFire: null }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -14, xMax: 8, yMin: -5, yMax: 5 }, aspect: 2.1, minHeight: 240, maxHeight: 380 });
    const S = {};

    function clear() {
      Object.assign(S, { left: opts.apples, v: 0, x: 0, flown: [], t: 0, auto: false, nextShot: 0, caption: '', kick: 0, pShot: 0, resolve: null });
    }
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'לזרוק תפוח אחורה', function () { throwOne(); }, { primary: true });
    const autoBtn = U.Button(row, 'הכול ברצף', function () { if (S.left) { S.auto = true; S.nextShot = S.t; } });
    const resetBtn = U.Button(row, 'להעמיס מחדש', function () { clear(); paint(); }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות הטיל', color: 'var(--c-velocity)' },
      { key: 'n', label: 'תפוחים שנשארו' },
      { key: 'pr', label: 'תנע הטיל', color: 'var(--c-velocity)' },
      { key: 'pa', label: 'תנע התפוחים', color: 'var(--c-velocity)' },
      { key: 'pt', label: 'תנע כולל' },
    ]);
    function paint() {
      fireBtn.disabled = !S.left || S.auto;
      autoBtn.disabled = !S.left || S.auto;
      void resetBtn;
    }

    function mass() { return opts.rocketMass + S.left * opts.appleMass; }
    function throwOne() {
      if (!S.left) return false;
      /* u is measured from the rocket as it was just before this throw. */
      const vApple = S.v - opts.u;
      S.left--;
      S.v += (opts.appleMass * opts.u) / mass();
      S.flown.push({ x: S.x - 2.6, v: vApple, rot: 0 });
      S.kick = 1;
      S.caption = S.left ? '' : 'נגמרו התפוחים. הטיל ממשיך לשוט.';
      if (opts.onFire) opts.onFire();
      if (!S.left) {
        S.auto = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
      paint();
      return true;
    }
    function step(dt) {
      S.t += dt;
      S.x += S.v * dt;
      S.flown.forEach(function (a) { a.x += a.v * dt; });
      if (S.kick > 0) S.kick = Math.max(0, S.kick - dt * 4);
      if (S.auto && S.t >= S.nextShot) {
        throwOne();
        S.nextShot = S.t + opts.every;
      }
    }

    function render() {
      view.clear();
      K.stars(view, S.x * 24);
      const small = view.w < 420;
      /* Camera on the rocket: its nose stays put, the apples leave to the left. */
      const camX = S.x;
      const ctx = view.ctx;
      S.flown.forEach(function (a) {
        const px = view.sx(a.x - camX);
        if (px > -20) G2.drawApple(view, px, view.sy(0) + (((a.x * 7) % 9) - 4) * 2, small ? 7 : 9);
      });
      /* Rocket body */
      const nx = view.sx(0), ny = view.sy(0), k = small ? 0.8 : 1.05;
      ctx.save();
      ctx.translate(nx - S.kick * 3, ny);
      ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.accent;
      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(-54, s * 14);
        ctx.lineTo(-74, s * 32);
        ctx.lineTo(-34, s * 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      ctx.fillStyle = C.surface;
      ctx.beginPath();
      ctx.moveTo(-66, -17);
      ctx.lineTo(10, -19);
      ctx.quadraticCurveTo(44, -12, 54, 0);
      ctx.quadraticCurveTo(44, 12, 10, 19);
      ctx.lineTo(-66, 17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      /* The cargo, shown in the hull: one apple for each one left. */
      const per = 5;
      for (let i = 0; i < S.left; i++) {
        const col = i % per, line = Math.floor(i / per);
        G2.drawApple(view, nx + (-50 + col * 11) * k, ny + (-6 + line * 11) * k, 4.2 * k, { plain: true });
      }
      const pos = view.toWorld(nx + 24 * k, ny - 15 * k);
      PHY.mascot.draw(view, pos.x, pos.y, { pose: S.kick > 0.2 ? 'dizzy' : S.v > 0 ? 'happy' : 'standing', px: small ? 42 : 54 });

      /* Momentum arrows */
      const pr = mass() * S.v;
      let pa = 0;
      S.flown.forEach(function (a) { pa += opts.appleMass * a.v; });
      const u = (view.w * 0.3) / Math.max(1, opts.rocketMass * 8);
      const yb = ny + 56 * k;
      if (Math.abs(pr) > 0.5) G2.pix(view).arrow(nx, yb, nx + pr * u, yb, { color: C.velocity, width: 4, label: 'p', labelSide: 1, labelGap: 12 });
      if (Math.abs(pa) > 0.5) G2.pix(view).arrow(nx, yb, nx + pa * u, yb, { color: C.velocity, width: 4, label: 'p', labelSide: 1, labelGap: 12 });

      K.caption(view, S.caption, 16);

      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('n', String(S.left));
      out.set('pr', F.unit(pr, PU, 0));
      out.set('pa', F.unit(pa, PU, 0));
      out.set('pt', F.unit(pr + pa, PU, 0));
    }

    const loop = PHY.SimLoop({ view, step, render });
    clear();
    paint();

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { clear(); paint(); loop.requestRender(); },
      setParam() {},
      getState() {
        let pa = 0, comApples = 0, ma = 0;
        S.flown.forEach(function (a) { pa += opts.appleMass * a.v; comApples += opts.appleMass * a.x; ma += opts.appleMass; });
        const M = mass();
        return { left: S.left, v: S.v, pRocket: M * S.v, pApples: pa, pTotal: M * S.v + pa, comX: (M * S.x + comApples) / (M + ma) };
      },
      fire: throwOne,
      play() {
        S.auto = true;
        S.nextShot = S.t;
        paint();
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
  };
})();

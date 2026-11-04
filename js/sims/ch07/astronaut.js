/* PHY.sims.astronaut: the hook. Newton floats 10 m from the ship with a wrench.
   mode 'swim': he paddles and goes nowhere. 'wait': nothing. 'toward': the wrench reaches the ship and he drifts away.
   'away': he reaches the ship. Velocities come from momentum: 0 = m_w v_w + M V.
   opts: {catMass, wrenchMass, throwSpeed, start, locked}. sim.play(mode) -> Promise; after a mode other than 'away'
   it runs 'away' as well, so every reader ends up watching the way home. setParam: wrenchMass, throwSpeed, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU;

  PHY.sims.astronaut = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ catMass: 10, wrenchMass: 2, throwSpeed: 10, start: 10, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -4, xMax: 21, yMin: -6, yMax: 7 }, aspect: 16 / 9, minHeight: 240, maxHeight: 420 });
    const tw = G2.tweens();
    const S = {};
    let token = 0;

    function clear() {
      Object.assign(S, {
        x: opts.start, v: 0, wx: opts.start + 0.9, wv: 0, wFree: false, wStuck: false, wRot: 0,
        t: 0, clock: 0, mode: 'ready', pose: 'flying', rot: 0, flip: true, trail: [], nextTrail: 0,
        caption: '', arrived: false, arrivalT: null, wig: 0, flying: false,
      });
    }

    const massSlider = U.Slider(controlsEl, {
      label: 'מסת המפתח', min: 1, max: 4, step: 0.5, value: opts.wrenchMass, unit: 'kg', digits: 1, color: 'var(--accent)',
      onInput(v) { opts.wrenchMass = v; freshIfIdle(); },
    });
    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות הזריקה', min: 4, max: 20, step: 1, value: opts.throwSpeed, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { opts.throwSpeed = v; freshIfIdle(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const awayBtn = U.Button(row, 'לזרוק הרחק מהחללית', function () { free('away'); }, { primary: true });
    const towardBtn = U.Button(row, 'לזרוק אל החללית', function () { free('toward'); });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'pc', label: 'תנע ניוטון', color: 'var(--c-velocity)' },
      { key: 'pw', label: 'תנע המפתח', color: 'var(--c-velocity)' },
      { key: 'pt', label: 'תנע כולל' },
      { key: 'v', label: 'מהירות ניוטון', color: 'var(--c-velocity)' },
    ]);

    function setLocked(v) {
      S.locked = v;
      massSlider.setEnabled(!v);
      speedSlider.setEnabled(!v);
      awayBtn.disabled = v;
      towardBtn.disabled = v;
      /* Locked means the card is still open: neither answer gets the highlight. */
      awayBtn.classList.toggle('btn-primary', !v);
    }
    function freshIfIdle() { if (S.mode === 'ready' || S.mode === 'end') { token++; tw.clear(); const l = S.locked; clear(); S.locked = l; loop.requestRender(); } }

    /* One scene. Resolves when its picture is finished. */
    function scene(mode) {
      const my = ++token;
      const l = S.locked;
      tw.clear();
      clear();
      S.locked = l;
      S.mode = mode;
      if (mode === 'swim') {
        S.caption = 'תנועות חזה נמרצות...';
        return tw.run(3, function (k) {
          S.wig = k * 3;
          S.rot = Math.sin(k * 3 * 9) * 16;
          S.pose = 'falling';
          if (k >= 1) S.caption = 'אין כאן מה לדחוף: 0 מ\' התקדמות';
        }).then(function () { if (my === token) S.mode = 'end'; });
      }
      if (mode === 'wait') {
        S.caption = 'מחכים. אף אחד לא בא.';
        S.pose = 'thinking';
        return tw.run(2.4).then(function () { if (my === token) S.mode = 'end'; });
      }
      /* A short wind-up, and then the throw. */
      S.caption = mode === 'away' ? 'זורקים הרחק מהחללית...' : 'זורקים אל החללית...';
      S.pose = 'thinking';
      return tw.run(0.45).then(function () {
        if (my !== token) return null;
        const dir = mode === 'away' ? 1 : -1;
        S.wv = dir * opts.throwSpeed;
        S.v = -(opts.wrenchMass * S.wv) / opts.catMass;
        S.wFree = true;
        S.flying = true;
        S.pose = 'flying';
        S.caption = mode === 'away' ? 'המפתח ימינה, ניוטון שמאלה' : 'המפתח שמאלה... וניוטון ימינה?!';
        return new Promise(function (resolve) { S.onEnd = resolve; });
      });
    }

    function endFlight(captionText, pose) {
      S.flying = false;
      S.caption = captionText;
      if (pose) S.pose = pose;
      S.mode = 'end';
      if (S.onEnd) { const r = S.onEnd; S.onEnd = null; r(); }
    }

    function step(dt) {
      tw.step(dt);
      if (S.wFree) {
        S.wRot += dt * 500 * Math.sign(S.wv || 1);
        if (!S.wStuck) S.wx += S.wv * dt;
        if (!S.wStuck && S.wx <= 0.2 && S.wv < 0) { S.wStuck = true; S.wx = 0.2; S.caption = 'המפתח הגיע! ניוטון, לעומת זאת...'; }
      }
      if (!S.flying) return;
      S.t += dt;
      S.clock += dt;
      S.x += S.v * dt;
      if (S.t >= S.nextTrail) { S.trail.push(S.x); S.nextTrail += 0.5; }
      if (S.v < 0 && S.x <= 0) {
        S.x = 0;
        S.arrived = true;
        S.arrivalT = S.t;
        endFlight('הגיע, אחרי ' + F.unit(S.t, 's', 1) + '. המפתח? כבר לא נראה אותו.', 'happy');
      } else if (S.v > 0 && S.t >= 3.2) {
        endFlight('גם רחוק יותר, וגם בלי מפתח', 'dizzy');
      } else if (S.t >= 8) {
        endFlight('איטי מדי: צריך לזרוק חזק יותר', 'thinking');
      }
    }

    function render() {
      view.clear();
      K.stars(view);
      const small = view.w < 420;
      const dockY = 0;
      const k = small ? 0.62 : 0.85;
      K.ship(view, view.sx(0), view.sy(dockY), k);
      view.screenText(8, view.sy(dockY) - 62 * k - 8, 'החללית', { size: small ? 12 : 14, weight: 700, align: 'left', halo: true });

      const pxCat = small ? 50 : 66;
      /* The 10 m ruler, before anyone moves. */
      if (S.mode === 'ready') {
        const yr = dockY - 4.1;
        view.arrow(0.2, yr, opts.start, yr, { color: C.displacement, width: 2.5, head: 9 });
        view.arrow(opts.start, yr, 0.2, yr, { color: C.displacement, width: 2.5, head: 9 });
        view.text(opts.start / 2, yr, F.unit(opts.start, 'm', 0), { size: 13, weight: 700, color: C.displacement, offset: [0, -11], halo: true });
      }

      S.trail.forEach(function (x) { view.circle(x, dockY, 2.6, { px: true, fill: C.ink, alpha: 0.45 }); });

      /* The wrench */
      const wPx = view.sx(S.wx), wPy = view.sy(dockY + (S.wFree ? 0 : 0.4));
      if (wPx < view.w + 30) K.wrench(view, wPx, wPy, S.wRot, small ? 26 : 34);

      K.spaceCat(view, S.x, dockY, { pose: S.pose, px: pxCat, rot: S.rot, flipX: S.flip });

      /* Momentum arrows, in the velocity color, with the label p. */
      const unit = 4.5 / 20; /* meters of arrow per kg·m/s */
      const pc = opts.catMass * S.v;
      const pw = S.wFree ? opts.wrenchMass * S.wv : 0;
      if (Math.abs(pc) > 0.01 && S.flying) {
        const ya = dockY + pxCat * 0.58 / view.scale + 9 / view.scale;
        view.arrow(S.x, ya, S.x + pc * unit, ya, { color: C.velocity, width: 4, label: 'p', labelSide: pc < 0 ? 1 : -1, labelGap: 12 });
      }
      if (Math.abs(pw) > 0.01 && S.flying && !S.wStuck && wPx < view.w - 10) {
        const yb = dockY - 26 / view.scale;
        view.arrow(S.wx, yb, S.wx + pw * unit, yb, { color: C.velocity, width: 4, label: 'p', labelSide: pw > 0 ? 1 : -1, labelGap: 12 });
      }

      K.caption(view, S.caption, 18);

      out.set('pc', F.unit(pc, PU, 0));
      out.set('pw', F.unit(pw, PU, 0));
      out.set('pt', F.unit(pc + pw, PU, 0));
      out.set('v', F.unit(S.v, 'ms', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });

    function free(mode) {
      if (S.locked || S.flying || tw.busy) return;
      scene(mode);
    }

    clear();
    setLocked(opts.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        token++;
        tw.clear();
        if (S.onEnd) { const r = S.onEnd; S.onEnd = null; r(); }
        const l = S.locked;
        clear();
        S.locked = l;
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'wrenchMass') { opts.wrenchMass = v; massSlider.set(v); }
        if (name === 'throwSpeed') { opts.throwSpeed = v; speedSlider.set(v); }
        freshIfIdle();
      },
      getState() {
        return {
          mode: S.mode, x: S.x, v: S.v, wv: S.wv, wx: S.wx, wStuck: S.wStuck, arrived: S.arrived, arrivalT: S.arrivalT,
          pCat: opts.catMass * S.v, pWrench: S.wFree ? opts.wrenchMass * S.wv : 0, start: opts.start, moved: S.x - opts.start,
        };
      },
      /* Plays one scene and, when it was not the right one, the right one after it. */
      play(mode) {
        const my = token + 1;
        return scene(mode).then(function () {
          if (mode === 'away' || my !== token) return null;
          return tw.run(0.9).then(function () {
            if (my !== token) return null;
            return scene('away');
          });
        });
      },
      scene,
    };
  };
})();

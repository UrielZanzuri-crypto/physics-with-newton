/* PHY.sims.monkeyHunter: the hook. The cannon aims straight at Newton on his branch. At the shot he lets go.
   Gravity on: the apple falls below the aim line by exactly as much as the cat falls below the branch,
   so they meet, as long as the apple arrives before the floor does. Gravity off: straight line, branch height.
   A hit is decided by comparing the two real heights when the apple reaches the cat, never from the formula.
   opts: {speed, height, distance, locked}. sim.play({gravity}) -> Promise. setParam: speed, height, gravity, locked.
   sim.advance(seconds) runs the physics without waiting for frames (used by the numeric checks). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;
  const HIT_R = 0.3;

  PHY.sims.monkeyHunter = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ speed: 20, height: 15, distance: 20, locked: true, slow: 0.55 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -3, xMax: 24.5, yMin: -2, yMax: 21 },
      aspect: 1.3,
      minHeight: 280,
      maxHeight: 480,
    });
    const S = {
      v: opts.speed, H: opts.height, D: opts.distance, g: 10, gravityOn: true,
      t: 0, phase: 'ready', result: null, tHit: null, meetY: null, minDist: Infinity,
      appleLanded: null, catLandedT: null, trail: [], nextTrail: 0, caption: '', locked: opts.locked, resolve: null,
    };

    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות הירייה', min: 10, max: 40, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; paramChanged(); },
    });
    const heightSlider = U.Slider(controlsEl, {
      label: 'גובה הענף (משנה את זווית הכיוון)', min: 6, max: 18, step: 1, value: S.H, unit: 'm', digits: 0, color: 'var(--c-displacement)',
      onInput(v) { S.H = v; paramChanged(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'ירה!', function () { if (!S.locked && S.phase !== 'flying' && S.phase !== 'after') launch(); }, { primary: true });
    const gravToggle = U.Toggle(row, 'כבידה כבויה', {
      value: false,
      onChange(off) { S.gravityOn = !off; S.g = off ? 0 : 10; paramChanged(); },
    });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'angle', label: 'זווית הכיוון' },
      { key: 'tm', label: 'זמן מהירייה' },
      { key: 'y', label: 'גובה המפגש, אם יהיה', color: 'var(--c-displacement)' },
      { key: 'res', label: 'תוצאה' },
    ]);

    function theta() { return (Math.atan2(S.H, S.D) * 180) / Math.PI; }
    function applePos(t) { return B.at(S.v, theta(), t, 0, S.g); }
    function catPos(t) { return { x: S.D, y: S.H - 0.5 * S.g * t * t }; }

    function clearRun() {
      S.t = 0; S.phase = 'ready'; S.result = null; S.tHit = null; S.meetY = null; S.minDist = Infinity;
      S.appleLanded = null; S.catLandedT = null; S.trail = []; S.nextTrail = 0; S.caption = '';
    }
    function paramChanged() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      clearRun();
      loop.requestRender();
    }
    function setLocked(v) {
      S.locked = v;
      speedSlider.setEnabled(!v);
      heightSlider.setEnabled(!v);
      fireBtn.disabled = v;
      gravToggle.input.disabled = v;
    }

    function launch() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      clearRun();
      S.phase = 'flying';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function finish() {
      S.phase = 'done';
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }

    function step(dt) {
      if (S.phase !== 'flying' && S.phase !== 'after') return;
      S.t += dt * opts.slow;
      if (S.phase === 'flying') {
        const a = applePos(S.t), c = catPos(S.t);
        if (S.t >= S.nextTrail && a.y > 0) { S.trail.push({ x: a.x, y: a.y }); S.nextTrail += 0.12; }
        if (!S.appleLanded && S.gravityOn && a.y <= 0 && S.t > 0) S.appleLanded = { x: a.x, y: 0, t: S.t };
        if (S.catLandedT === null && c.y <= 0) S.catLandedT = S.t;
        /* The moment the apple crosses the cat's vertical line, compare their real heights.
           Back up to the exact crossing so the printed numbers do not depend on the step size. */
        if (!S.appleLanded && S.catLandedT === null && a.x >= S.D) {
          const tc = S.t - (a.x - S.D) / a.vx;
          const dy = Math.abs(applePos(tc).y - catPos(tc).y);
          S.minDist = Math.min(S.minDist, dy);
          if (dy < HIT_R) {
            S.tHit = tc;
            S.meetY = catPos(tc).y;
            S.result = 'hit';
            S.phase = S.gravityOn ? 'after' : 'done';
            S.caption = S.gravityOn ? 'פגיעה! תפוח ישר לידיים.' : 'בלי כבידה: קו ישר, ישר אליו.';
            U.burst(canvasEl, 18);
            if (!S.gravityOn) finish();
            return;
          }
        }
        /* The apple reached the floor before reaching the cat: they would meet below ground. */
        if (S.appleLanded && S.catLandedT !== null) {
          S.result = 'floor';
          S.caption = 'איטי מדי: הרצפה הגיעה לפני הפגישה.';
          finish();
        }
      } else if (catPos(S.t).y <= 0) {
        S.catLandedT = S.t;
        finish();
      }
    }

    function render() {
      const r = view.visible;
      const ang = theta();
      const small = view.w < 420;
      const P = small ? 50 : 64;
      view.clear();
      view.grid(5, {});
      B.drawGround(view, 0, { every: 5 });

      /* Tree and branch: the branch sits so that the cat's middle is exactly on the aim point. */
      const branchY = S.H + (0.45 * P) / view.scale;
      const tx = S.D + 3.1;
      view.line(tx, 0, tx, Math.min(branchY + 3, r.yMax), { color: '#8B5E3C', width: small ? 9 : 12, cap: 'butt' });
      view.line(tx, branchY, S.D - (P * 0.42) / view.scale, branchY, { color: '#8B5E3C', width: small ? 6 : 8 });
      view.circle(tx, Math.min(branchY + 3, r.yMax - 1), small ? 22 : 30, { px: true, fill: C.leaf, color: C.ink, width: 2 });

      /* The aim line */
      view.line(0, 0, S.D, S.H, { color: C.soft, width: 1.5, dash: [6, 6] });
      view.arc(0, 0, 34, 0, ang, { color: C.accent, width: 2.5 });
      view.text(0, 0, F.deg(ang), { size: 12, weight: 700, color: C.accent, offset: [49 * Math.cos((ang * Math.PI) / 360), -49 * Math.sin((ang * Math.PI) / 360)], halo: true });

      const tShown = S.tHit !== null ? Math.min(S.t, S.tHit) : S.t;
      const a = applePos(tShown), c = catPos(S.catLandedT !== null ? S.catLandedT : S.t);
      const apple = S.appleLanded ? { x: S.appleLanded.x, y: 0 } : a;
      const cat = { x: S.D, y: Math.max(0, c.y) };

      /* What gravity costs each of them: the same drop, printed twice. */
      if (S.gravityOn && S.t > 0.08) {
        const tg = S.tHit !== null ? S.tHit : S.appleLanded ? S.appleLanded.t : S.t;
        const drop = 0.5 * 10 * tg * tg;
        const ghost = B.at(S.v, ang, tg, 0, 0);
        B.drawApple(view, ghost.x, ghost.y, 13, { alpha: 0.45, plain: true });
        if (drop > 0.2) {
          view.arrow(ghost.x, ghost.y, ghost.x, ghost.y - drop, { color: C.displacement, width: 2.5, label: F.unit(drop, 'm', 1), labelSize: 12.5, labelSide: 1, labelGap: 26 });
          view.arrow(S.D + 0.75, S.H, S.D + 0.75, S.H - drop, { color: C.displacement, width: 2.5, label: F.unit(drop, 'm', 1), labelSize: 12.5, labelSide: -1, labelGap: 28 });
        }
      }

      S.trail.forEach(function (q) { view.circle(q.x, q.y, 2.4, { px: true, fill: C.apple, alpha: 0.5 }); });
      B.drawCannon(view, 0, 0, ang, { len: 30, w: 12 });

      if (S.phase === 'ready') {
        PHY.mascot.draw(view, cat.x, cat.y, { pose: 'onBranch', px: P, anchor: [0.5, 0.6] });
        B.drawApple(view, 0, 0, 15);
      } else if (S.result === 'hit') {
        if (S.phase === 'done' && S.gravityOn) PHY.mascot.draw(view, cat.x, 0, { pose: 'happy', px: P });
        else PHY.mascot.draw(view, cat.x, cat.y, { pose: 'happy', px: P, anchor: [0.5, 0.6] });
        B.drawApple(view, cat.x + 0.6, (S.phase === 'done' && S.gravityOn ? (P * 0.35) / view.scale : cat.y), 14);
      } else {
        if (S.result === 'floor') PHY.mascot.draw(view, cat.x, 0, { pose: 'dizzy', px: P });
        else if (cat.y <= 0) PHY.mascot.draw(view, cat.x, 0, { pose: 'standing', px: P });
        else PHY.mascot.draw(view, cat.x, cat.y, { pose: 'falling', px: P, anchor: [0.5, 0.55] });
        B.drawApple(view, apple.x, apple.y, 15);
      }

      if (S.caption) view.screenText(view.w / 2, 22, S.caption, { size: 14, weight: 700, pill: true });

      out.set('angle', F.deg(ang, 1));
      out.set('tm', S.tHit !== null ? F.unit(S.tHit, 's', 2) : S.result === 'floor' ? 'לא נפגשו' : F.unit(S.t, 's', 2));
      out.set('y', S.meetY !== null ? F.unit(S.meetY, 'm', 1) : '—');
      out.set('res', S.result === 'hit' ? 'פגיעה' : S.result === 'floor' ? 'נפלו לרצפה' : S.phase === 'ready' ? 'מוכן' : 'באוויר');
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        clearRun();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; speedSlider.set(v); }
        if (name === 'height') { S.H = v; heightSlider.set(v); }
        if (name === 'gravity') { S.gravityOn = !!v; S.g = v ? 10 : 0; gravToggle.set(!v); }
        if (name === 'locked') { setLocked(!!v); return; }
        paramChanged();
      },
      getState() {
        return { t: S.t, phase: S.phase, result: S.result, tHit: S.tHit, meetY: S.meetY, minDist: S.minDist, angle: theta(), speed: S.v, height: S.H, gravity: S.gravityOn };
      },
      play(o) {
        if (o && o.gravity !== undefined) {
          S.gravityOn = !!o.gravity; S.g = o.gravity ? 10 : 0; gravToggle.set(!o.gravity);
        }
        return launch();
      },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) {
        const dt = 1 / 120;
        const end = S.t + seconds * opts.slow;
        while (S.t < end && (S.phase === 'flying' || S.phase === 'after')) step(dt);
      },
    };
    setLocked(S.locked);
    return api;
  };
})();

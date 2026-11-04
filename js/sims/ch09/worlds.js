/* PHY.sims.worlds: how much a cat weighs elsewhere.
   mode 'lanes': Moon, Mars, Earth, Jupiter side by side, an apple dropped from 5 m in each, and a scale under a cat
   of the same mass. sim.drop() -> Promise. setParam: mass.
   mode 'custom': a planet with sliders for mass and radius, in units of Earth's. g = 10 M / R².
   sim.play() -> Promise: mass ×2 and then radius ×2, the scale following. setParam: M, Rk, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const WORLDS = [
    { key: 'moon', name: 'ירח', g: 1.6, pose: 'happy' },
    { key: 'mars', name: 'מאדים', g: 3.7, pose: 'standing' },
    { key: 'earth', name: 'כדור הארץ', g: 10, pose: 'thinking' },
    { key: 'jupiter', name: 'צדק', g: 25, pose: 'dizzy' },
  ];
  const DROP = 5;

  PHY.sims.worlds = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'lanes', mass: 5, locked: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.65, minHeight: 300, maxHeight: 430 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      mode: opts.mode, mass: opts.mass, t: 0, running: false, landed: {}, resolve: null, run: 0, locked: opts.locked,
      M: 1, Rk: 1, caption: '', shownG: 10,
    };

    let massSlider, mSlider, rSlider, dropBtn, out;
    if (S.mode === 'lanes') {
      massSlider = U.Slider(controlsEl, {
        label: 'המסה של ניוטון', min: 1, max: 10, step: 0.5, value: S.mass, unit: 'kg', digits: 1, color: 'var(--accent)',
        onInput(v) { S.mass = v; loop.requestRender(); },
      });
      const row = U.h('div', { class: 'sim-row' });
      dropBtn = U.Button(row, 'להפיל תפוחים', function () { api.drop(); }, { primary: true });
      controlsEl.appendChild(row);
    } else {
      mSlider = U.Slider(controlsEl, {
        label: 'מסת הכוכב, ביחס לכדור הארץ', min: 0.1, max: 10, step: 0.1, value: S.M, format: (v) => G.ltr('×' + F.num(v, 1)), color: 'var(--accent)',
        onInput(v) { S.M = v; S.caption = ''; loop.requestRender(); },
      });
      rSlider = U.Slider(controlsEl, {
        label: 'רדיוס הכוכב, ביחס לכדור הארץ', min: 0.3, max: 3, step: 0.1, value: S.Rk, format: (v) => G.ltr('×' + F.num(v, 1)), color: 'var(--c-displacement)',
        onInput(v) { S.Rk = v; S.caption = ''; loop.requestRender(); },
      });
      out = U.Readouts(controlsEl, [
        { key: 'g', label: 'g על הכוכב', color: 'var(--c-acceleration)' },
        { key: 'w', label: 'המשקל של ניוטון', color: 'var(--c-force)' },
        { key: 'm', label: 'המסה של ניוטון' },
      ]);
    }

    function setLocked(v) {
      S.locked = v;
      if (mSlider) { mSlider.setEnabled(!v); rSlider.setEnabled(!v); }
    }
    const gCustom = () => (G.G0 * S.M) / (S.Rk * S.Rk);

    function step(dt) {
      tw.step(dt);
      if (!S.running) return;
      S.t += dt * 0.8;
      let all = true;
      WORLDS.forEach(function (w) {
        const tLand = Math.sqrt((2 * DROP) / w.g);
        if (S.t >= tLand) { if (!S.landed[w.key]) S.landed[w.key] = tLand; }
        else all = false;
      });
      if (all) {
        S.running = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    function renderLanes() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const laneW = w / 4;
      const top = 66, ground = h - 42;
      view.clear();
      WORLDS.forEach(function (W, i) {
        const x0 = w - (i + 1) * laneW; /* first world on the right, as Hebrew reads */
        const cx = x0 + laneW / 2;
        if (i) P.line(x0 + laneW, 0, x0 + laneW, h, { color: C.grid, width: 1 });
        G.drawPlanet(view, W.key, cx, 14, small ? 8 : 10);
        view.screenText(cx, 33, W.name, { size: small ? 11 : 13, weight: 700 });
        view.screenText(cx, 50, F.unit(W.g, 'מ/ש²', 1), { size: small ? 10.5 : 12, weight: 700, color: C.acceleration });

        /* The apple falls from 5 m to the top of the cat's scale. */
        const t = Math.min(S.t, Math.sqrt((2 * DROP) / W.g));
        const fall = 0.5 * W.g * t * t;
        const y = top + 8 + (fall / DROP) * (ground - top - 18);
        PHY.ch02.drawApple(view, cx + (small ? 22 : 34), y, small ? 6 : 8);
        const dashX = cx + (small ? 22 : 34);
        P.line(dashX, top, dashX, ground - 2, { color: C.grid, width: 1, dash: [3, 4] });
        if (S.landed[W.key]) view.screenText(cx - (small ? 8 : 12), top + 8, F.unit(S.landed[W.key], 's', 2), { size: small ? 11 : 12.5, weight: 700, color: C.ink, halo: true });

        P.cat(cx - (small ? 8 : 14), ground - 2, { pose: W.pose, px: small ? 36 : 56 });
        G.drawScale(view, cx, ground - 2, laneW - (small ? 6 : 18), F.unit(S.mass * W.g, 'N', 1), { size: small ? 10.5 : 12.5, color: C.force, h: small ? 22 : 24 });
        view.screenText(cx, h - 7, F.unit(S.mass, 'kg', 1), { size: 11, color: C.soft });
      });
    }

    function renderCustom() {
      const w = view.w, h = view.h;
      const small = w < 480;
      view.clear();
      G.drawStars(view, 24);
      const g = gCustom();
      S.shownG = g;
      const px = small ? w * 0.36 : w * 0.34;
      const py = h / 2 + 8;
      /* Drawn to scale: the biggest planet on the slider just fits. */
      const pr = (Math.min(px - 14, h / 2 - 24) / 3) * S.Rk;
      const kind = S.M === 1 && S.Rk === 1 ? 'earth' : 'custom';
      G.drawPlanet(view, kind, px, py, pr);
      /* The radius, and as many "mass dots" as the mass is. */
      P.line(px, py, px + pr, py, { color: C.displacement, width: 2.5 });
      view.screenText(px + pr / 2, py - 11, 'R ×' + F.num(S.Rk, 1), { size: small ? 11 : 12.5, weight: 700, color: C.displacement, halo: true });
      view.screenText(px, py + pr + 14, 'M ×' + F.num(S.M, 1), { size: small ? 11.5 : 13, weight: 700, halo: true });

      /* The cat on the scale on a right-hand panel */
      const sx = small ? w * 0.8 : w * 0.76;
      const ground = h - 56;
      const scaleW = small ? 100 : 130;
      P.line(sx - scaleW / 2 - 12, ground + 24, sx + scaleW / 2 + 12, ground + 24, { color: C.axis, width: 2.5 });
      G.drawScale(view, sx, ground, scaleW, F.unit(opts.mass * g, 'N', 1), { size: small ? 13 : 15, color: C.force, h: 24 });
      P.cat(sx, ground, { pose: g > 15 ? 'dizzy' : g < 7 ? 'happy' : 'standing', px: small ? 66 : 88 });
      const len = Math.min(70, g * 2.8);
      P.arrow(sx + (small ? 44 : 58), ground - 56, sx + (small ? 44 : 58), ground - 56 + len, { color: C.force, width: 3.5, label: 'mg', labelSize: 12, labelGap: 12 });
      view.screenText(sx, 14, 'כבידה על הקרקע', { size: 11, color: C.soft });
      view.screenText(sx, 32, F.unit(g, 'מ/ש²', 2), { size: small ? 14 : 16, weight: 800, color: C.acceleration });
      if (S.caption) view.screenText(px, 20, S.caption, { size: small ? 11 : 13, weight: 700, pill: true });

      out.set('g', F.unit(g, 'מ/ש²', 2));
      out.set('w', F.unit(opts.mass * g, 'N', 1));
      out.set('m', F.unit(opts.mass, 'kg', 0));
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.running || tw.busy; });
    function render() {
      if (!drawNow()) return;
      if (S.mode === 'lanes') renderLanes();
      else renderCustom();
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.t = 0;
        S.running = false;
        S.landed = {};
        S.M = 1; S.Rk = 1; S.caption = '';
        if (mSlider) { mSlider.set(1); rSlider.set(1); }
        setLocked(opts.locked);
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'mass') { S.mass = v; if (massSlider) massSlider.set(v); }
        if (name === 'M') { S.M = v; if (mSlider) mSlider.set(v); }
        if (name === 'Rk') { S.Rk = v; if (rSlider) rSlider.set(v); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        const weights = {};
        WORLDS.forEach(function (W) { weights[W.key] = S.mass * W.g; });
        return { mode: S.mode, t: S.t, landed: Object.assign({}, S.landed), running: S.running, weights, mass: S.mass, M: S.M, Rk: S.Rk, g: gCustom(), weight: opts.mass * gCustom(), locked: S.locked };
      },
      drop() {
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        S.t = 0;
        S.landed = {};
        S.running = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        setLocked(true);
        S.M = 1; S.Rk = 1;
        mSlider.set(1); rSlider.set(1);
        S.caption = 'כדור הארץ';
        await tw.add(1.2, null);
        if (id !== S.run) return;
        S.caption = 'קודם המסה, פי 2';
        await tw.add(2, function (k) { S.M = 1 + k; mSlider.set(S.M); });
        if (id !== S.run) return;
        await tw.add(1, null);
        if (id !== S.run) return;
        S.caption = 'ועכשיו הרדיוס, פי 2';
        await tw.add(2.4, function (k) { S.Rk = 1 + k; rSlider.set(S.Rk); });
        if (id !== S.run) return;
        S.caption = 'מסה פי 2, רדיוס פי 2';
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

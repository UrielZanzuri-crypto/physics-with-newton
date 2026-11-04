/* PHY.sims.cannonPlayground: angle and speed sliders (or drag the barrel), live trajectory, range,
   max height and flight time. Fired shots stay as traces, and two discovery quests watch them:
   the best angle at a given speed, and two different angles with the same range.
   opts: {angle, speed, chapter, section, onFire(state), onDiscover(name)}
   sim.fire() -> Promise. setParam: angle, speed, clear. getState() has the live numbers. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;

  PHY.sims.cannonPlayground = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ angle: 30, speed: 20 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -3, xMax: 66, yMin: -4, yMax: 34 },
      aspect: 1.85,
      minHeight: 230,
      maxHeight: 480,
    });
    const S = { a: opts.angle, v: opts.speed, t: 0, flying: null, traces: [], caption: '', found: { best: false, pair: false }, resolve: null };

    const angSlider = U.Slider(controlsEl, {
      label: 'זווית', min: 0, max: 90, step: 1, value: S.a, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; changed(); },
    });
    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות', min: 5, max: 25, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; changed(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    U.Button(row, 'שגר את ניוטון!', function () { api.fire(); }, { primary: true });
    U.Button(row, 'נקה מסלולים', function () { S.traces = []; S.caption = ''; loop.requestRender(); }, {});
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'R', label: 'טווח', color: 'var(--c-displacement)' },
      { key: 'H', label: 'גובה מרבי', color: 'var(--c-displacement)' },
      { key: 'T', label: 'זמן טיסה' },
      { key: 'vx', label: 'מהירות אופקית', color: 'var(--c-velocity)' },
      { key: 'vy', label: 'מהירות אנכית בהתחלה', color: 'var(--c-velocity)' },
    ]);
    const quests = U.h('div', { class: 'quest-list' });
    const q1 = questLine('באותה מהירות, איזו זווית שולחת את ניוטון הכי רחוק? שגר כמה ותראה.');
    const q2 = questLine('מצא שתי זוויות שונות שנוחתות בדיוק באותו מקום.');
    quests.appendChild(q1.el);
    quests.appendChild(q2.el);
    controlsEl.appendChild(quests);

    function questLine(text) {
      const mark = U.h('span', { class: 'quest-mark', 'aria-hidden': 'true' });
      const el = U.h('div', { class: 'quest' }, [mark, U.h('span', { text: text })]);
      return { el, done() { el.classList.add('is-done'); mark.textContent = '✓'; } };
    }

    function numbers() {
      const c = B.comps(S.v, S.a);
      return { R: B.range(S.v, S.a), H: B.maxHeight(S.v, S.a), T: B.flightTime(S.v, S.a), vx: c.vx, vy: c.vy };
    }
    function changed() {
      paintNumbers();
      loop.requestRender();
    }
    function paintNumbers() {
      const n = numbers();
      out.set('R', F.unit(n.R, 'm', 1));
      out.set('H', F.unit(n.H, 'm', 1));
      out.set('T', F.unit(n.T, 's', 2));
      out.set('vx', F.unit(n.vx, 'ms', 1));
      out.set('vy', F.unit(n.vy, 'ms', 1));
    }

    function checkQuests(shot) {
      const same = S.traces.filter(function (t) { return t.v === shot.v; });
      const angles = same.map(function (t) { return t.a; });
      if (!S.found.best && angles.indexOf(45) >= 0 && angles.some(function (a) { return a < 45; }) && angles.some(function (a) { return a > 45; })) {
        S.found.best = true;
        q1.done();
        U.burst(canvasEl, 22);
        PHY.mascot.say('45° ניצח את שתי הזוויות שמסביבו. שמרתי לך את הנחיתה הרחוקה ביותר. גם את הכאב.', 'dizzy');
        if (opts.onDiscover) opts.onDiscover('best');
      }
      if (!S.found.pair) {
        const pair = same.find(function (t) { return t.a !== shot.a && t.a > 0 && t.a < 90 && Math.abs(t.R - shot.R) < 0.02; });
        if (pair) {
          S.found.pair = true;
          q2.done();
          U.burst(canvasEl, 22);
          S.caption = F.deg(Math.min(pair.a, shot.a)) + ' ו-' + F.deg(Math.max(pair.a, shot.a)) + ': אותו טווח. הסכום? ' + F.deg(pair.a + shot.a);
          PHY.mascot.say('שני מסלולים שונים לגמרי, אותה נחיתה. שים לב כמה הזוויות נותנות יחד.', 'thinking');
          if (opts.onDiscover) opts.onDiscover('pair');
        }
      }
    }

    function step(dt) {
      const f = S.flying;
      if (!f) return;
      f.t += dt;
      if (f.t >= f.T) {
        const shot = { a: f.a, v: f.v, R: B.range(f.v, f.a), H: B.maxHeight(f.v, f.a), T: f.T };
        S.flying = null;
        S.lastLanded = shot;
        S.traces = S.traces.filter(function (t) { return !(t.a === shot.a && t.v === shot.v); });
        S.traces.push(shot);
        if (S.traces.length > 9) S.traces.shift();
        S.caption = '';
        checkQuests(shot);
        const r = S.resolve;
        S.resolve = null;
        if (r) r(shot);
      }
    }

    function render() {
      const n = numbers();
      view.clear();
      view.grid(5, {});
      B.drawGround(view, 0, { every: 10 });

      /* Traces of earlier shots, each labeled with its angle. The longest one at each speed gets a star. */
      const best = S.traces.reduce(function (m, t) { return !m || t.R > m.R ? t : m; }, null);
      S.traces.forEach(function (t) {
        view.poly(B.path(t.v, t.a), { color: C.accent, width: 1.8, alpha: 0.55 });
        if (t.H > 0.5) view.text(B.at(t.v, t.a, t.T / 2).x, t.H, F.deg(t.a), { size: 11, weight: 700, color: C.accent, offset: [0, -10], halo: true });
      });
      if (best && best.R > 0.5) B.drawApple(view, best.R, 0, 12, { color: C.gold, plain: true });

      /* The live preview */
      view.poly(B.path(S.v, S.a), { color: C.soft, width: 2, dash: [5, 6] });
      const topT = B.apexTime(S.v, S.a);
      const top = B.at(S.v, S.a, topT);
      if (n.H > 1) {
        view.line(top.x, 0, top.x, top.y, { color: C.displacement, width: 1.5, dash: [3, 5], alpha: 0.7 });
        view.circle(top.x, top.y, 4.5, { px: true, fill: C.displacement });
        view.text(top.x, top.y, F.unit(n.H, 'm', 1), { size: 12, weight: 700, color: C.displacement, offset: [0, -14], halo: true });
      }
      if (n.R > 1) {
        view.line(0, -7 / view.scale, n.R, -7 / view.scale, { color: C.displacement, width: 3 });
        view.text(n.R / 2, 0, F.unit(n.R, 'm', 1), { size: 12, weight: 700, color: C.displacement, offset: [0, -12], halo: true });
      }

      const px = view.w < 420 ? 34 : 48;
      const f = S.flying;
      if (f) {
        const p = B.at(f.v, f.a, f.t);
        view.arrow(p.x, p.y, p.x + p.vx * 0.3, p.y + p.vy * 0.3, { color: C.velocity, width: 3.5 });
        PHY.mascot.draw(view, p.x, p.y, { pose: 'flying', px: px, rot: (Math.atan2(p.vy, p.vx) * 180) / Math.PI });
        view.screenText(view.w / 2, 20, 't = ' + F.unit(f.t, 's', 1), { size: 13, weight: 700, pill: true });
      } else if (S.lastLanded && S.lastLanded.a === S.a && S.lastLanded.v === S.v) {
        PHY.mascot.draw(view, S.lastLanded.R, 0, { pose: 'standing', px: px });
      }
      if (!f) {
        const c = B.comps(S.v, S.a);
        view.arrow(0, 0, c.vx * 0.42, c.vy * 0.42, { color: C.velocity, width: 3.5, alpha: 0.85 });
      }
      B.drawCannon(view, 0, 0, S.a, { len: 28, w: 12 });
      if (S.caption) view.screenText(view.w / 2, 20, S.caption, { size: 13.5, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* Drag the blue arrow to aim, as an alternative to the sliders. */
    view.drag({
      hit(p) {
        if (S.flying) return null;
        const c = B.comps(S.v, S.a);
        return view.pxDist(p, { x: c.vx * 0.42, y: c.vy * 0.42 }) < 30 ? 'aim' : null;
      },
      move(_, p) {
        const a = Math.max(0, Math.min(90, Math.round((Math.atan2(Math.max(0, p.y), Math.max(0, p.x)) * 180) / Math.PI)));
        const v = Math.max(5, Math.min(25, Math.round(Math.hypot(p.x, p.y) / 0.42)));
        S.a = a; S.v = v;
        angSlider.set(a);
        speedSlider.set(v);
        changed();
      },
    });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        S.flying = null;
        S.traces = [];
        S.caption = '';
        S.lastLanded = null;
        S.a = opts.angle; S.v = opts.speed;
        angSlider.set(S.a);
        speedSlider.set(S.v);
        changed();
      },
      setParam(name, v) {
        if (name === 'angle') { S.a = v; angSlider.set(v); }
        if (name === 'speed') { S.v = v; speedSlider.set(v); }
        if (name === 'clear') S.traces = [];
        changed();
      },
      getState() {
        return Object.assign(numbers(), { angle: S.a, speed: S.v, flying: !!S.flying, traces: S.traces.map(function (t) { return Object.assign({}, t); }), found: Object.assign({}, S.found) });
      },
      fire() {
        if (S.flying) return Promise.resolve(null);
        S.caption = '';
        S.flying = { a: S.a, v: S.v, t: 0, T: Math.max(B.flightTime(S.v, S.a), 0.01) };
        if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
        if (opts.onFire) opts.onFire(api.getState());
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
    changed();
    return api;
  };
})();

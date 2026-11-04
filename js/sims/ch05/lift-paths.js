/* PHY.sims.liftPaths: drag a 10 kg crate from the floor to the shelf along any of three paths.
   The force needed is mg times the slope of the path right there, summed along the real path. Whatever
   the path, the work at the top is mgh, and going down a wave gives some back. The zero level is a slider:
   the potential energy changes with it, the difference between floor and shelf does not.
   opts: {onUse()}. sim.play() -> Promise (moves the crate along the current path). setParam: path, zero, s. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const MASS = 10, HEIGHT = 5, END = 10;

  const PATHS = {
    up: { name: 'ישר למעלה', pts: () => M.join(M.line(0, 0, 0, HEIGHT, 50), M.line(0, HEIGHT, END, HEIGHT, 50)) },
    ramp: { name: 'רמפה ארוכה', pts: () => M.line(0, 0, END, HEIGHT, 120) },
    wave: {
      name: 'גלים',
      pts: () => M.fn(function (x) {
        const u = x / END;
        return HEIGHT * u + 1.5 * Math.sin(3 * Math.PI * u) * (u < 1 ? 1 : 0);
      }, 0, END, 260),
    },
  };

  /* The hand balances gravity's share of the path, so its force always points uphill along the path. */
  function handDir(q) {
    const k = Math.sign(q.uy) || 1;
    return { x: q.ux * k, y: q.uy * k };
  }

  PHY.sims.liftPaths = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -2.3, xMax: 12.3, yMin: -2.8, yMax: 9.6 }, aspect: 1.35, minHeight: 300, maxHeight: 440 });
    const S = { path: 'ramp', zero: 0, s: 0, W: 0, y: 0, force: 0, track: null, auto: false, resolve: null, used: false, results: {}, caption: '' };

    const row = U.h('div', { class: 'sim-row' });
    const pathBtns = {};
    Object.keys(PATHS).forEach(function (k) {
      pathBtns[k] = U.Button(row, PATHS[k].name, function () { choose(k); }, {});
    });
    controlsEl.appendChild(row);
    const row2 = U.h('div', { class: 'sim-row' });
    U.Button(row2, 'להרים אוטומטית', function () { auto(); }, { primary: true });
    controlsEl.appendChild(row2);
    U.Slider(controlsEl, {
      label: 'רמת האפס שבחרנו', min: -2, max: 5, step: 1, value: 0, unit: 'm', digits: 0, color: 'var(--gold)',
      onInput(v) { S.zero = v; loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'len', label: 'אורך המסלול' },
      { key: 'f', label: 'הכוח הדרוש כאן', color: 'var(--c-force)' },
      { key: 'w', label: 'העבודה עד עכשיו' },
      { key: 'pe', label: 'אנרגיית גובה עכשיו' },
    ]);

    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function paintButtons() {
      Object.keys(pathBtns).forEach(function (k) {
        const on = k === S.path;
        pathBtns[k].className = 'btn ' + (on ? 'lift-on' : '');
        pathBtns[k].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function choose(k) {
      settle();
      S.path = k;
      S.track = M.Track(PATHS[k].pts());
      S.s = 0; S.W = 0; S.y = 0; S.force = 0; S.auto = false; S.caption = '';
      paintButtons();
      loop.requestRender();
    }
    /* All movement along the path comes through here, so the work really is the sum along the way. */
    function moveTo(s1) {
      const n = Math.max(1, Math.ceil(Math.abs(s1 - S.s) / 0.02));
      const s0 = S.s;
      for (let i = 1; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n;
        const a = S.track.at(s - (s1 - s0) / n), b = S.track.at(s);
        const ds = Math.hypot(b.x - a.x, b.y - a.y) || 0;
        if (ds > 0) {
          /* A slow, frictionless lift: along the path the hand only has to balance gravity's share. */
          const along = (MASS * 10 * (b.y - a.y)) / ds;
          S.force = Math.abs(along);
          S.W += along * ds;
        }
      }
      S.s = s1;
      S.y = S.track.at(s1).y;
      if (S.s >= S.track.length - 0.02) arrive();
    }
    function arrive() {
      if (S.results[S.path] === undefined) {
        S.results[S.path] = S.W;
        const n = Object.keys(S.results).length;
        if (!S.used) {
          S.used = true;
          if (opts.onUse) opts.onUse();
        }
        if (opts.onPath) opts.onPath(S.path, S.W, n);
        if (n === 3) PHY.mascot.say('500, 500, 500. הארגז לא מתרשם מהטיול.', 'thinking');
      }
      S.caption = PATHS[S.path].name + ': ' + M.unitJ(S.W);
    }
    function auto() {
      settle();
      S.s = 0; S.W = 0; S.y = 0; S.force = 0; S.caption = '';
      S.auto = true;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function step(dt) {
      if (!S.auto) return;
      const speed = S.track.length / 3.5;
      moveTo(Math.min(S.track.length, S.s + speed * dt));
      if (S.s >= S.track.length - 1e-9) {
        S.auto = false;
        settle();
      }
    }
    view.drag({
      hit(p) {
        const q = S.track.at(S.s);
        const mid = { x: q.x, y: q.y + 15 / view.scale };
        return view.pxDist(p, mid) < 30 && !S.auto ? 'crate' : null;
      },
      move(h, p) {
        /* Follow the pointer, but only along the nearby stretch, so the crate cannot teleport. */
        const target = S.track.nearest(p);
        const max = 1.6;
        const s1 = Math.max(S.s - max, Math.min(S.s + max, target));
        moveTo(Math.max(0, Math.min(S.track.length, s1)));
        loop.requestRender();
      },
    });

    function render() {
      const r = view.visible;
      const small = view.w < 460;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, r.xMax, 0, {});
      /* the shelf */
      view.poly([{ x: END - 0.2, y: HEIGHT }, { x: r.xMax, y: HEIGHT }, { x: r.xMax, y: HEIGHT - 0.5 }, { x: END - 0.2, y: HEIGHT - 0.5 }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
      view.arrow(11.4, 0, 11.4, HEIGHT, { color: C.displacement, width: 2.5 });
      view.text(11.4, HEIGHT / 2, 'h', { size: 14, weight: 700, color: C.displacement, halo: true, offset: [-11, 0] });
      view.text(11.4, 0, F.unit(HEIGHT, 'm', 0), { size: 12, weight: 700, color: C.displacement, halo: true, offset: [0, 13] });
      /* all paths, the chosen one strong */
      Object.keys(PATHS).forEach(function (k) {
        if (k !== S.path) view.poly(PATHS[k].pts(), { color: C.gridStrong, width: 2, dash: [5, 5] });
      });
      view.poly(S.track.points, { color: C.axis, width: 3.5 });
      /* the zero level */
      const zy = S.zero;
      view.line(r.xMin, zy, r.xMax, zy, { color: C.gold, width: 2.4, dash: [8, 5] });
      view.text(r.xMin, zy, 'כאן אפס', { size: 12, weight: 800, color: C.ink, halo: true, align: 'left', offset: [8, zy === 0 ? 13 : -11] });
      /* crate and hand force */
      const q = S.track.at(S.s);
      const size = small ? 26 : 32;
      const c = { x: q.x, y: q.y + (size / 2) / view.scale };
      M.drawCrate(view, q.x, q.y, size, { label: '10' });
      /* The tail sits at the crate's edge: from its center the crate hid most of a short arrow and its direction. */
      if (S.force > 0.5) {
        const k = 0.5 / view.scale, d = handDir(q), off = (size * 0.55) / view.scale;
        const tx = c.x + d.x * off, ty = c.y + d.y * off;
        view.arrow(tx, ty, tx + d.x * S.force * k, ty + d.y * S.force * k, { color: C.force, width: 3.5, label: 'F', labelSide: -1, labelGap: 11 });
      }
      view.circle(c.x, c.y, 24, { px: true, color: C.accent, width: 2, dash: [4, 4], alpha: S.s > 0.02 ? 0.25 : 0.8 });
      PHY.mascot.draw(view, -1.2, 0, { pose: S.s >= S.track.length - 0.05 ? 'happy' : 'thinking', px: small ? 40 : 52 });
      /* the two numbers that matter */
      const peNow = MASS * 10 * (S.y - S.zero);
      const peFloor = MASS * 10 * (0 - S.zero), peShelf = MASS * 10 * (HEIGHT - S.zero);
      M.miniBar(view, 12, 8, view.w - 24, {
        label: 'העבודה של היד',
        right: M.unitJ(Math.abs(S.W) < 0.5 ? 0 : S.W),
        max: 1.25 * MASS * 10 * HEIGHT, h: 12,
        segs: [{ value: S.W, color: C.gold }],
      });
      const line = 'רצפה ' + F.num(peFloor, 0) + ' | מדף ' + F.num(peShelf, 0) + ' | הפרש ' + F.num(peShelf - peFloor, 0) + " ג'ול";
      view.screenText(view.w / 2, 46, line, { size: small ? 12 : 13, weight: 700, color: C.ink, halo: true });
      if (S.caption) view.screenText(view.w / 2, 70, S.caption, { size: 13, weight: 700, pill: true });
      out.set('len', F.unit(S.track.length, 'm', 1));
      out.set('f', F.unit(S.force, 'N', 0));
      out.set('w', M.unitJ(Math.abs(S.W) < 0.5 ? 0 : S.W));
      out.set('pe', M.unitJ(peNow));
    }

    const loop = PHY.SimLoop({ view, step, render });
    S.track = M.Track(PATHS[S.path].pts());
    paintButtons();

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { choose(S.path); },
      play: auto,
      setParam(name, v) {
        if (name === 'path') choose(v);
        if (name === 'zero') { S.zero = v; loop.requestRender(); }
        if (name === 's') { moveTo(Math.max(0, Math.min(S.track.length, v))); loop.requestRender(); }
      },
      getState() {
        const peFloor = MASS * 10 * (0 - S.zero), peShelf = MASS * 10 * (HEIGHT - S.zero);
        return { path: S.path, W: S.W, s: S.s, y: S.y, length: S.track.length, force: S.force, hand: handDir(S.track.at(S.s)), zero: S.zero, results: Object.assign({}, S.results), peFloor, peShelf, pe: MASS * 10 * (S.y - S.zero) };
      },
    };
  };
})();

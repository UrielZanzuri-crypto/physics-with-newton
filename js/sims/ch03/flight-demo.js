/* PHY.sims.flightDemo: scripted flights for the traps section. No controls except readouts.
   opts: {angle (of the cannon before the first shot, default 45)}.
   sim.play([{v, a, every, arrows, freezeTop, caption, endCaption}, ...]) -> Promise.
   every: strobe interval in seconds, stamped with velocity parts when arrows: 'parts'.
   freezeTop: seconds to hold at the highest point with the velocity (blue) and acceleration (red) arrows.
   Every shot leaves a trace with its landing distance. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;
  const K = 0.34; /* arrow length in meters per m/s */

  PHY.sims.flightDemo = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ slow: 0.75 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -3, xMax: 44, yMin: -3.5, yMax: 20 },
      aspect: 1.95,
      minHeight: 220,
      maxHeight: 400,
    });
    const S = { shot: null, t: 0, stamps: [], traces: [], caption: '', frozen: 0, frozenDone: false, next: 0, resolve: null, topInfo: null };
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'vx', label: 'מהירות אופקית', color: 'var(--c-velocity)' },
      { key: 'vy', label: 'מהירות אנכית', color: 'var(--c-velocity)' },
      { key: 'v', label: 'גודל המהירות', color: 'var(--c-velocity)' },
    ]);

    function step(dt) {
      const sh = S.shot;
      if (!sh) return;
      if (S.frozen > 0) {
        S.frozen -= dt;
        return;
      }
      S.t += dt * opts.slow;
      if (sh.every) {
        while (S.next <= S.t && S.next < sh.T) {
          const p = B.at(sh.v, sh.a, S.next);
          S.stamps.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
          S.next += sh.every;
        }
      }
      if (sh.freezeTop && !S.frozenDone && S.t >= sh.topT) {
        S.t = sh.topT;
        S.frozen = sh.freezeTop;
        S.frozenDone = true;
        S.caption = sh.topCaption || '';
        return;
      }
      if (S.t >= sh.T) {
        S.t = sh.T;
        S.traces.push({ v: sh.v, a: sh.a, R: B.range(sh.v, sh.a) });
        S.caption = sh.endCaption || '';
        S.shot = null;
        S.lastCat = B.range(sh.v, sh.a);
        const r = S.resolve;
        S.resolve = null;
        if (r) r();
      }
    }

    function render() {
      view.clear();
      view.grid(5, {});
      B.drawGround(view, 0, { every: 10 });
      const px = view.w < 420 ? 34 : 48;
      S.traces.forEach(function (t) {
        view.poly(B.path(t.v, t.a), { color: C.accent, width: 2, alpha: 0.6 });
        view.text(t.R, 0, F.deg(t.a) + ': ' + F.unit(t.R, 'm', 1), { size: 12, weight: 700, color: C.displacement, offset: [0, -px - 11], halo: true });
      });
      const sh = S.shot;
      if (sh) view.poly(B.path(sh.v, sh.a), { color: C.soft, width: 1.5, dash: [4, 6] });

      S.stamps.forEach(function (s, i) {
        view.circle(s.x, s.y, 3.5, { px: true, fill: C.soft });
        view.arrow(s.x, s.y, s.x + s.vx * K, s.y, { color: C.velocity, width: 3, alpha: 0.9 });
        if (Math.abs(s.vy) > 0.3) view.arrow(s.x, s.y, s.x, s.y + s.vy * K, { color: C.velocity, width: 2, alpha: 0.5 });
        if (i === 1) view.text(s.x + s.vx * K * 0.5, s.y, F.unit(s.vx, 'ms', 0), { size: 11.5, weight: 700, color: C.velocity, offset: [0, 12], halo: true });
      });

      let shownV = null;
      if (sh) {
        const p = B.at(sh.v, sh.a, S.t);
        shownV = p;
        const moving = S.frozen <= 0;
        if (moving && !sh.every) view.arrow(p.x, p.y, p.x + p.vx * K, p.y + p.vy * K, { color: C.velocity, width: 3.5 });
        PHY.mascot.draw(view, p.x, p.y, { pose: 'flying', px: px, rot: (Math.atan2(p.vy, p.vx) * 180) / Math.PI });
        if (!moving) {
          view.arrow(p.x, p.y, p.x + p.vx * K, p.y, { color: C.velocity, width: 4.5 });
          view.text(p.x + p.vx * K, p.y, F.unit(Math.hypot(p.vx, p.vy), 'ms', 1), { size: 13, weight: 700, color: C.velocity, offset: [8, 0], align: 'left', halo: true });
          view.arrow(p.x, p.y, p.x, p.y - 10 * K, { color: C.acceleration, width: 4.5, label: '10 מ/ש²', labelSide: -1, labelGap: 32, labelSize: 13 });
        }
      } else if (S.lastCat !== undefined && S.lastCat !== null) {
        PHY.mascot.draw(view, S.lastCat, 0, { pose: 'standing', px: px });
      }
      const ang = sh ? sh.a : S.traces.length ? S.traces[S.traces.length - 1].a : opts.angle || 45;
      B.drawCannon(view, 0, 0, ang, { len: 26, w: 11 });
      if (S.caption) view.screenText(view.w / 2, 20, S.caption, { size: 13.5, weight: 700, pill: true });

      if (shownV) {
        out.set('t', F.unit(S.t, 's', 2));
        out.set('vx', F.unit(shownV.vx, 'ms', 1));
        out.set('vy', F.unit(shownV.vy, 'ms', 1));
        out.set('v', F.unit(Math.hypot(shownV.vx, shownV.vy), 'ms', 1));
      }
    }

    const loop = PHY.SimLoop({ view, step, render });

    function runShot(o) {
      const T = B.flightTime(o.v, o.a);
      S.shot = Object.assign({ T: T, topT: B.apexTime(o.v, o.a) }, o);
      S.t = 0; S.next = 0; S.frozen = 0; S.frozenDone = false; S.stamps = [];
      S.caption = o.caption || '';
      S.lastCat = null;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        S.shot = null; S.t = 0; S.stamps = []; S.traces = []; S.caption = ''; S.frozen = 0; S.lastCat = null;
        loop.requestRender();
      },
      setParam() {},
      getState() {
        const sh = S.shot;
        const p = sh ? B.at(sh.v, sh.a, S.t) : null;
        return { t: S.t, flying: !!sh, frozen: S.frozen > 0, p: p, traces: S.traces.slice(), stamps: S.stamps.slice() };
      },
      async play(list) {
        api.reset();
        for (let i = 0; i < list.length; i++) await runShot(list[i]);
      },
    };
    return api;
  };
})();

/* PHY.sims.coaster: the coaster builder. Drag the points, the rail is a smooth curve y(x) through them, so it
   can never cross itself. The cart is a Rider: its speed comes from the energy left, so it follows the rail
   however wild the shape, and it cannot gain energy. Walls at both ends send it back.
   The dashed line is the energy expressed as a height: the cart can never climb above it.
   opts: {chapter, section, onUse}. API: ride(), halt(), setPoints([{x, y}]), advance(seconds), setParam: friction. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const MASS = 5, MU = 0.06, X_END = 20, Y_MIN = 0.4, Y_MAX = 8.4, GAP = 1.4;
  const START = [{ x: 0, y: 7 }, { x: 3.4, y: 1.4 }, { x: 7, y: 4.8 }, { x: 10.2, y: 1 }, { x: 13.4, y: 3.2 }, { x: 16.6, y: 0.8 }, { x: 20, y: 2.6 }];

  PHY.sims.coaster = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.3, xMax: 21.3, yMin: -1, yMax: 13 }, aspect: 1.5, minHeight: 310, maxHeight: 480 });
    const S = { pts: START.map(function (p) { return { x: p.x, y: p.y }; }), friction: false, track: null, r: null, running: false, t: 0, caption: '', captionT: 0, maxV: 0, used: false, lastBounce: 0, lastRev: 0, fast: false, tired: false };

    const row = U.h('div', { class: 'sim-row' });
    const rideBtn = U.Button(row, 'נסיעה!', function () { if (S.running) halt(); else ride(); }, { primary: true });
    U.Button(row, 'מסלול אחר', function () { randomize(); });
    U.Button(row, 'איפוס', function () { setPoints(START); });
    const fr = U.Toggle(row, 'חיכוך', { value: false, onChange(v) { S.friction = v; build(); say(v ? 'עכשיו גם יהיה לי חם.' : 'בלי חיכוך. כלומר, בלי סוף.'); loop.requestRender(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'y', label: 'גובה', color: 'var(--c-displacement)' },
      { key: 'max', label: 'שיא מהירות', color: 'var(--c-velocity)' },
    ]);

    function say(t) { S.caption = t; S.captionT = 2.6; }
    function build() {
      S.track = M.Track(M.curveThrough(S.pts, 0.03));
      S.r = M.Rider(S.track, { s: 0, v: 0, ends: 'bounce', mu: function () { return S.friction ? MU : 0; } });
      S.running = false; S.t = 0; S.maxV = 0; S.lastBounce = 0; S.lastRev = 0; S.fast = false; S.tired = false;
      rideBtn.textContent = 'נסיעה!';
    }
    function ride() {
      build();
      S.running = true;
      rideBtn.textContent = 'עצירה';
      say('יאללה. מי חתם על הטופס הזה?');
      if (!S.used) {
        S.used = true;
        if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
        if (opts.onUse) opts.onUse();
      }
    }
    function halt() {
      S.running = false;
      rideBtn.textContent = 'נסיעה!';
    }
    function setPoints(list) {
      S.pts = list.map(function (p) { return { x: p.x, y: p.y }; });
      build();
      S.caption = '';
      loop.requestRender();
    }
    function randomize() {
      const n = S.pts.length;
      const list = [];
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? 0 : i === n - 1 ? X_END : (X_END * i) / (n - 1) + (Math.random() - 0.5) * 1.4;
        const y = i === 0 ? 6 + Math.random() * 2 : Y_MIN + Math.random() * (i % 2 ? 2.4 : 5);
        list.push({ x, y });
      }
      setPoints(list);
    }
    view.drag({
      hit(p) {
        let best = null, bd = 30;
        S.pts.forEach(function (q, i) {
          const d = view.pxDist(p, q);
          if (d < bd) { bd = d; best = { i }; }
        });
        return best;
      },
      start() { halt(); build(); S.caption = ''; },
      move(h, p) {
        const i = h.i, n = S.pts.length;
        S.pts[i].y = Math.max(Y_MIN, Math.min(Y_MAX, p.y));
        if (i > 0 && i < n - 1) S.pts[i].x = Math.max(S.pts[i - 1].x + GAP, Math.min(S.pts[i + 1].x - GAP, p.x));
        build();
        loop.requestRender();
      },
    });

    function step(dt) {
      if (S.captionT > 0) { S.captionT -= dt; if (S.captionT <= 0) S.caption = ''; }
      if (!S.running) return;
      const r = S.r;
      const rev = r.reversals, bounce = r.bounces;
      S.t += dt;
      r.step(dt);
      S.maxV = Math.max(S.maxV, Math.abs(r.v));
      if (Math.abs(r.v) > 11 && !S.fast) { S.fast = true; say('לאט!! השפם שלי נשאר מאחור!'); }
      if (Math.abs(r.v) < 6) S.fast = false;
      if (r.reversals > rev && S.t - S.lastRev > 1.5) { S.lastRev = S.t; say('נגמרה האנרגיה. חוזרים אחורה. נהדר.'); }
      if (r.bounces > bounce && S.t - S.lastBounce > 1.5) { S.lastBounce = S.t; say('מי שם פה קיר?!'); }
      if (S.t > 30 && !S.tired && !S.friction) { S.tired = true; say('בלי חיכוך זה לא ייגמר אף פעם. הצילו.'); }
      if (r.stopped) {
        halt();
        say(S.friction ? 'נעצרתי. כל התנועה הפכה לחום, ואני מגיש תלונה.' : 'אני לא זז. צריך גובה, לא מוטיבציה.');
      }
    }
    function render() {
      const small = view.w < 460;
      const vis = view.visible;
      const r = S.r;
      const q = S.track.at(r.s);
      const pe = MASS * 10 * q.y, mech = MASS * r.e;
      const ke = Math.max(0, mech - pe), heat = MASS * r.heat;
      view.clear();
      view.grid(1, {});
      M.ground(view, vis.xMin, vis.xMax, 0, {});
      /* supports */
      for (let x = 1; x < X_END; x += 2) {
        const s = S.track.atX(x);
        view.line(x, 0, x, S.track.at(s).y, { color: C.gridStrong, width: 2, cap: 'butt' });
      }
      /* the energy as a height */
      view.line(vis.xMin, r.e / 10, vis.xMax, r.e / 10, { color: C.gold, width: 2.2, dash: [8, 5] });
      view.text(vis.xMax, r.e / 10, 'התקרה של האנרגיה', { size: 11.5, weight: 700, align: 'right', color: C.ink, halo: true, offset: [-8, -11] });
      view.poly(S.track.points, { color: C.axis, width: 5 });
      /* the end walls */
      [S.pts[0], S.pts[S.pts.length - 1]].forEach(function (p, i) {
        view.line(p.x + (i ? 0.1 : -0.1), p.y - 0.4, p.x + (i ? 0.1 : -0.1), p.y + 1.1, { color: C.axis, width: 5, cap: 'butt' });
      });
      S.pts.forEach(function (p) {
        view.circle(p.x, p.y, 9, { px: true, fill: C.surface, color: C.accent, width: 3 });
      });
      const cart = M.drawCart(view, q, { w: small ? 26 : 34, h: small ? 8 : 10 });
      const stoppedHere = r.stopped;
      PHY.mascot.draw(view, cart.x, cart.y, { pose: stoppedHere ? 'dizzy' : 'sliding', px: small ? 30 : 40, rot: (Math.atan2(q.uy, q.ux) * 180) / Math.PI, flipX: r.v < 0 });
      if (Math.abs(r.v) > 0.4) {
        const k = 3.4 / view.scale;
        view.arrow(cart.x, cart.y, cart.x + q.ux * r.v * k, cart.y + q.uy * r.v * k, { color: C.velocity, width: 3 });
      }
      M.energyPanel(view, {
        x: 6, y: 5, w: view.w - 12, max: MASS * 10 * S.pts[0].y,
        items: [{ label: 'קינטית', value: ke, color: C.accent }, { label: 'גובה', value: pe, color: C.gold }, { label: 'חום', value: heat, color: C.apple }],
      });
      if (S.caption) view.screenText(view.w / 2, 78, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
      out.set('v', F.unit(Math.abs(r.v), 'ms', 1));
      out.set('y', F.unit(q.y, 'm', 1));
      out.set('max', F.unit(S.maxV, 'ms', 1));
    }
    const loop = PHY.SimLoop({ view, step, render });
    build();
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { setPoints(START); },
      ride, halt, setPoints, randomize,
      /* Advance the ride now, without waiting for frames. */
      advance(seconds) { for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120); },
      setParam(name, v) {
        if (name === 'friction') { S.friction = !!v; fr.set(!!v); build(); loop.requestRender(); }
      },
      getState() {
        const q = S.track.at(S.r.s);
        return {
          s: S.r.s, v: S.r.v, x: q.x, y: q.y, length: S.track.length, e: MASS * S.r.e, heat: MASS * S.r.heat, mass: MASS, running: S.running, stopped: S.r.stopped,
          bounces: S.r.bounces, maxV: S.maxV, friction: S.friction, pts: S.pts.map(function (p) { return { x: p.x, y: p.y }; }), startE: MASS * 10 * S.pts[0].y,
          ke: 0.5 * MASS * S.r.v * S.r.v, pe: MASS * 10 * q.y,
        };
      },
    };
  };
})();

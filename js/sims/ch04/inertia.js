/* PHY.sims.inertia: law 1, two ways. opts.mode = 'puck' (default) or 'bus'.
   puck: one push on carpet, wood, ice and no friction at all. Stopping distance v²/(2μg) grows as μ shrinks.
   bus:  the bus brakes, the apple on the smooth bench keeps its speed. Seen from the road or from inside.
   sim.play() -> Promise. getState() has true values. Both run on step(dt), so they pause offscreen. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10;

  /* ---------- the puck ---------- */
  function puck(canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    const LANES = [
      { key: 'carpet', name: 'שטיח', mu: 0.5 },
      { key: 'wood', name: 'עץ', mu: 0.2 },
      { key: 'ice', name: 'קרח', mu: 0.1 },
      { key: 'none', name: 'בלי חיכוך', mu: 0 },
    ];
    const LH = 3.6, START = 6, PUSH_T = 0.6, END_HOLD = 1.3, M = 5;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.5, xMax: 22, yMin: -0.9, yMax: LH * 4 + 0.2 }, aspect: 1.75, minHeight: 245, maxHeight: 420 });
    const gate = K.gate();
    const S = { v0: opts.v0 || 4, t: 0, phase: 'ready', hold: 0, lanes: [] };
    const out = U.Readouts(controlsEl, LANES.map(function (l) { return { key: l.key, label: l.name, color: 'var(--c-displacement)' }; }));

    function clearRun() {
      S.t = 0; S.phase = 'ready'; S.hold = 0;
      S.lanes = LANES.map(function (l) {
        return { key: l.key, mu: l.mu, x: 0, v: 0, stopT: null, stopX: null, stamps: [], nextStamp: 0 };
      });
    }
    clearRun();

    function step(dt) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      S.t += dt;
      if (S.phase === 'push') {
        const k = Math.min(S.t / PUSH_T, 1);
        S.lanes.forEach(function (l) { l.v = S.v0 * k; });
        if (k >= 1) { S.phase = 'glide'; S.t = 0; S.lanes.forEach(function (l) { l.v = S.v0; }); }
        return;
      }
      if (S.phase === 'glide') {
        S.lanes.forEach(function (l) {
          if (l.stopT !== null) return;
          if (S.t >= l.nextStamp) { l.stamps.push(l.x); l.nextStamp += 0.5; }
          const a = l.mu * G;
          const nv = l.v - a * dt;
          if (nv <= 0 && a > 0) {
            /* Back up to the exact stop, so the numbers do not depend on the step size. */
            const tStop = l.v / a;
            l.x += l.v * tStop - 0.5 * a * tStop * tStop;
            l.v = 0;
            l.stopT = S.t - dt + tStop;
            l.stopX = l.x;
          } else {
            l.x += l.v * dt - 0.5 * a * dt * dt;
            l.v = nv;
          }
        });
        if (S.lanes[2].stopT !== null) { S.phase = 'hold'; S.hold = 0; }
        return;
      }
      /* hold: the last lane keeps sailing while everyone looks at it. */
      const l = S.lanes[3];
      l.x += l.v * dt;
      S.hold += dt;
      if (S.hold >= END_HOLD) { S.phase = 'done'; gate.close(); }
    }

    function drawLane(i) {
      const L = LANES[i];
      const r = view.visible;
      const y0 = LH * (3 - i);
      const rect = [{ x: r.xMin, y: y0 }, { x: r.xMax, y: y0 }, { x: r.xMax, y: y0 + LH }, { x: r.xMin, y: y0 + LH }];
      if (L.key === 'carpet') view.poly(rect, { fill: 'hsla(4, 65%, 55%, 0.2)', close: true });
      if (L.key === 'wood') view.poly(rect, { fill: 'hsla(38, 70%, 50%, 0.22)', close: true });
      if (L.key === 'ice') view.poly(rect, { fill: 'hsla(195, 85%, 62%, 0.24)', close: true });
      view.line(r.xMin, y0, r.xMax, y0, { color: C.axis, width: 1.6, cap: 'butt' });
      view.text(r.xMin + 6 / view.scale, y0 + LH - 11 / view.scale, L.name, { size: 12.5, weight: 700, align: 'left' });
      view.text(r.xMin + 6 / view.scale, y0 + LH - 26 / view.scale, 'μ = ' + F.num(L.mu, 2), { size: 11, color: C.soft, align: 'left' });
    }

    function render() {
      view.clear();
      const small = view.w < 460;
      const catPx = Math.min(LH * view.scale * 0.8, 62);
      const r = view.visible;
      LANES.forEach(function (_, i) { drawLane(i); });
      /* the ruler measures from where the hand let go */
      for (let d = 0; d <= 15; d += 5) {
        const x = START + d;
        view.line(x, 0, x, -7 / view.scale, { color: C.axis, width: 1.6, cap: 'butt' });
        view.text(x, 0, F.unit(d, 'm', 0), { size: 11, color: C.soft, offset: [0, 15] });
      }
      S.lanes.forEach(function (l, i) {
        const y0 = LH * (3 - i);
        l.stamps.forEach(function (sx) { view.circle(START + sx, y0 + 3 / view.scale, 2.4, { px: true, fill: C.displacement, alpha: 0.55 }); });
        const pushX = S.phase === 'push' ? 0.5 * l.v * (S.t) - 0.5 * S.v0 * PUSH_T : 0;
        const x = S.phase === 'ready' ? START - 0.5 * S.v0 * PUSH_T : S.phase === 'push' ? START + pushX : START + l.x;
        const onScreen = x < r.xMax + 1;
        if (onScreen) {
          const puckW = Math.max(30, catPx * 0.72);
          const ctx = view.ctx;
          ctx.save();
          ctx.fillStyle = C.axis;
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(view.sx(x), view.sy(y0) - 4.5, puckW / 2, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          const stopped = l.stopT !== null;
          const pose = stopped ? (i === 0 ? 'dizzy' : 'thinking') : i === 3 && S.phase !== 'ready' ? 'happy' : 'standing';
          PHY.mascot.draw(view, x, y0 + 7 / view.scale, { pose, px: catPx });
          const midY = y0 + (catPx * 0.5) / view.scale;
          if (S.phase === 'push') {
            const tail = x - (puckW / 2 + 30) / view.scale;
            view.arrow(tail, y0 + 12 / view.scale, x - puckW / 2 / view.scale, y0 + 12 / view.scale, { color: C.force, width: 3.5 });
          }
          if (!stopped && l.v > 0.02 && S.phase !== 'push') {
            view.arrow(x + (catPx * 0.32) / view.scale, midY, x + (catPx * 0.32) / view.scale + l.v * 0.62, midY, { color: C.velocity, width: 3.2 });
            if (l.mu > 0) {
              const flen = Math.max(0.5, l.mu * M * G * 0.11);
              view.arrow(x - puckW / 2 / view.scale, y0 + 5 / view.scale, x - puckW / 2 / view.scale - flen, y0 + 5 / view.scale, { color: C.force, width: 3.2 });
            }
          }
          if (stopped) view.text(x + (catPx * 0.4) / view.scale, midY, F.unit(l.stopX, 'm', 1), { size: 12.5, weight: 800, color: C.displacement, align: 'left', halo: true, offset: [4, 0] });
        } else {
          view.screenText(view.sx(r.xMax) - 8, view.sy(y0 + LH * 0.5), (small ? '' : 'עוד נוסע: ') + F.unit(l.x, 'm', 0), { size: 12.5, weight: 800, color: C.displacement, align: 'right', pill: true });
        }
        out.set(l.key, l.stopT !== null ? F.unit(l.stopX, 'm', 1) : S.phase === 'ready' ? F.unit(0, 'm', 0) : (l.mu === 0 && S.phase !== 'push' ? F.unit(l.x, 'm', 0) + ' ועוד' : F.unit(Math.max(0, l.x), 'm', 1)));
      });
    }

    const loop = PHY.SimLoop({ view, step, render });
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { gate.close(); clearRun(); loop.requestRender(); },
      setParam(name, v) { if (name === 'v0') { S.v0 = v; gate.close(); clearRun(); loop.requestRender(); } },
      getState() {
        return { phase: S.phase, t: S.t, v0: S.v0, lanes: S.lanes.map(function (l) { return { key: l.key, mu: l.mu, x: l.x, v: l.v, stopT: l.stopT, stopX: l.stopX }; }) };
      },
      play() {
        clearRun();
        S.phase = 'push';
        return gate.open();
      },
    };
  }

  /* ---------- the bus ---------- */
  function bus(canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    const V0 = 6, BRAKE = 4, CRUISE = 0.5, SLOW = 0.6;
    const BUS_L = 8, APPLE_REL = 1.2, HIT_REL = 6.1, X0 = 0, HOLD = 1;
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.2, xMax: 17, yMin: -1.4, yMax: 6.4 }, aspect: 2.1, minHeight: 210, maxHeight: 380 });
    const gate = K.gate();
    const S = { frame: 'road', t: 0, phase: 'ready', busX: X0, busV: V0, appleX: X0 + APPLE_REL, appleV: V0, busA: 0, hitT: null, hold: 0, stamps: [], nextStamp: 0, brakeT: 0 };

    const row = U.h('div', { class: 'sim-row' });
    const brakeBtn = U.Button(row, 'לבלום!', function () { api.play(); }, { primary: true });
    const frameToggle = U.Toggle(row, 'מבט מתוך האוטובוס', { value: false, onChange(on) { S.frame = on ? 'bus' : 'road'; loop.requestRender(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'bv', label: 'מהירות האוטובוס', color: 'var(--c-velocity)' },
      { key: 'av', label: 'מהירות התפוח', color: 'var(--c-velocity)' },
      { key: 'ba', label: 'תאוצת האוטובוס', color: 'var(--c-acceleration)' },
      { key: 'aa', label: 'תאוצת התפוח', color: 'var(--c-acceleration)' },
    ]);

    function clearRun() {
      Object.assign(S, { t: 0, phase: 'ready', busX: X0, busV: V0, appleX: X0 + APPLE_REL, appleV: V0, busA: 0, hitT: null, hold: 0, stamps: [], nextStamp: 0, brakeT: 0 });
    }

    function step(dt0) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      const dt = dt0 * SLOW;
      S.t += dt;
      if (S.t >= S.nextStamp) {
        S.stamps.push({ apple: S.appleX, rel: S.appleX - S.busX, nose: S.busX + BUS_L });
        S.nextStamp += 0.25;
      }
      if (S.phase === 'cruise' && S.t >= CRUISE) { S.phase = 'brake'; S.brakeT = S.t; }
      if (S.phase === 'brake' || S.phase === 'hold') {
        S.busA = S.busV > 0 ? -BRAKE : 0;
        const nv = Math.max(0, S.busV + S.busA * dt);
        S.busX += ((S.busV + nv) / 2) * dt;
        S.busV = nv;
      } else {
        S.busX += S.busV * dt;
      }
      if (S.hitT === null) {
        S.appleX += S.appleV * dt;
        /* The bench is smooth: no force on the apple until it reaches the driver. */
        if (S.appleX - S.busX >= HIT_REL) {
          S.hitT = S.t;
          S.appleVBefore = S.appleV;
          S.phase = 'hold';
          S.hold = 0;
        }
      } else {
        S.appleV = S.busV;
        S.appleX = S.busX + HIT_REL;
        S.hold += dt;
        if (S.hold >= HOLD && S.busV <= 0) { S.phase = 'done'; gate.close(); }
      }
    }

    function render() {
      view.clear();
      const inside = S.frame === 'bus';
      const shift = inside ? S.busX - X0 : 0;
      const r = view.visible;
      /* road and its marks: inside the bus they slide backwards */
      K.ground(view, 0, { ticks: 2, shift: shift });
      /* stamps of where the apple was, every quarter second */
      S.stamps.forEach(function (st) {
        const x = inside ? X0 + st.rel : st.apple;
        view.circle(x, 4.75, 3.2, { px: true, fill: C.displacement, alpha: 0.8 });
        if (!inside) view.circle(st.nose, 4.25, 3.2, { px: true, fill: C.soft, alpha: 0.8 });
      });
      if (S.stamps.length) {
        view.text(r.xMin + 4 / view.scale, 4.75, 'תפוח', { size: 11, align: 'left', color: C.displacement, weight: 700, halo: true });
        if (!inside) view.text(r.xMin + 4 / view.scale, 4.25, 'אוטובוס', { size: 11, align: 'left', color: C.soft, weight: 700, halo: true });
      }
      /* the bus */
      const bx = S.busX - shift;
      const ctx = view.ctx;
      const top = 3.7, floor = 0.75;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const px0 = view.sx(bx), py0 = view.sy(top), pw = BUS_L * view.scale, ph = (top - floor) * view.scale;
      if (ctx.roundRect) ctx.roundRect(px0, py0, pw, ph, 10);
      else ctx.rect(px0, py0, pw, ph);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      view.poly([{ x: bx, y: floor + 0.45 }, { x: bx + BUS_L, y: floor + 0.45 }, { x: bx + BUS_L, y: floor }, { x: bx, y: floor }], { fill: C.accent, close: true, alpha: 0.85 });
      view.circle(bx + 1.6, 0.42, 0.42, { fill: C.axis, color: C.ink, width: 2 });
      view.circle(bx + BUS_L - 1.6, 0.42, 0.42, { fill: C.axis, color: C.ink, width: 2 });
      /* the smooth bench */
      view.line(bx + 0.3, 1.75, bx + HIT_REL + 0.2, 1.75, { color: C.axis, width: 4, cap: 'butt' });
      view.line(bx + 0.5, 1.75, bx + 0.5, floor + 0.45, { color: C.axis, width: 2.5, cap: 'butt' });
      const catPx = Math.min(1.95 * view.scale, 66);
      const pose = S.hitT === null ? (S.phase === 'ready' ? 'standing' : S.phase === 'brake' ? 'thinking' : 'standing') : 'happy';
      PHY.mascot.draw(view, bx + 7.05, floor + 0.45, { pose, px: catPx });
      /* the apple */
      const ax = (S.hitT === null ? S.appleX : S.busX + HIT_REL) - shift;
      PHY.ch02.drawApple(view, view.sx(ax), view.sy(1.75) - 8, 7);
      /* arrows */
      const nose = bx + BUS_L;
      if (!inside && S.busV > 0.05) view.arrow(nose, 2.6, nose + S.busV * 0.42, 2.6, { color: C.velocity, width: 3.4 });
      const appleVShown = S.hitT !== null ? 0 : inside ? S.appleV - S.busV : S.appleV;
      if (S.phase !== 'ready' && appleVShown > 0.05) view.arrow(ax, 2.55, ax + appleVShown * 0.42, 2.55, { color: C.velocity, width: 3.4 });
      if (S.phase === 'brake' && S.busV > 0 && !inside) {
        view.arrow(bx + BUS_L / 2, 3.2, bx + BUS_L / 2 - BRAKE * 0.5, 3.2, { color: C.acceleration, width: 3.4 });
        view.arrow(bx + BUS_L - 1.6, 0.04, bx + BUS_L - 1.6 - 2.1, 0.04, { color: C.force, width: 3.4 });
      }
      const reading = inside
        ? (S.hitT !== null ? 'מבפנים זה נראה כאילו משהו דחף אותו. אף אחד לא נגע בו.' : '')
        : (S.hitT !== null ? 'התפוח לא האיץ. האוטובוס הוא שהאט.' : '');
      if (reading) view.screenText(view.w / 2, 18, reading, { size: view.w < 460 ? 12 : 14, weight: 700, pill: true });

      const braking = S.phase === 'brake' && S.busV > 0;
      out.set('bv', F.unit(inside ? 0 : S.busV, 'ms', 1));
      out.set('av', S.hitT !== null ? F.unit(inside ? 0 : S.busV, 'ms', 1) : F.unit(inside ? S.appleV - S.busV : S.appleV, 'ms', 1));
      out.set('ba', F.unit(inside ? 0 : (braking ? -BRAKE : 0), 'ms2', 0));
      out.set('aa', F.unit(inside && braking && S.hitT === null ? BRAKE : 0, 'ms2', 0));
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { gate.close(); clearRun(); loop.requestRender(); },
      setParam(name, v) { if (name === 'frame') { S.frame = v; frameToggle.set(v === 'bus'); loop.requestRender(); } },
      getState() {
        return { phase: S.phase, t: S.t, frame: S.frame, busV: S.busV, busX: S.busX, appleV: S.hitT === null ? S.appleV : S.appleVBefore, appleX: S.appleX, hitT: S.hitT, stamps: S.stamps.slice() };
      },
      play() {
        clearRun();
        S.phase = 'cruise';
        return gate.open();
      },
    };
    return api;
  }

  PHY.sims.inertia = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    return (opts.mode === 'bus' ? bus : puck)(canvasEl, controlsEl, opts);
  };
})();

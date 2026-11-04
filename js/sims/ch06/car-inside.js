/* Two traps about a car in a curve.
   mode 'door': Newton on a slippery seat in a car turning left. From the road he simply goes straight and the car turns
   under him, until the right door reaches him and pushes him toward the center. From inside it looks like a shove outward.
   sim.play({frame: 'car' | 'road'}) -> Promise. getState(): contactDeg, contactT, door (N), catPath deviation from straight.
   mode 'meter': a hanging apple is an accelerometer. Straight road, then a curve at the same speed: the speedometer stays
   at v and the apple tilts by atan(a/g). sim.play() -> Promise. getState(): speedMin, speedMax, aMax, aStraight, tiltDeg, tiltOnArc. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;
  const RAD = Math.PI / 180;

  function doorSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.35, minHeight: 290, maxHeight: 440 });
    const Rc = 16, V = 10, CAR_L = 9, CAR_W = 4.4, SIDE = 1.5, M = 5, START = -9;
    const S = { frame: 'road', phase: 'ready', s: START, cat: null, contact: false, contactDeg: null, contactT: null, t: 0, trail: [], caption: '', rate: 0.68, resolve: null, local: null, door: 0, maxOff: 0, wide: true };
    const row = U.h('div', { class: 'sim-row' });
    const bCar = U.Button(row, 'מבפנים, מהמושב', function () { if (!S.locked) api.play({ frame: 'car' }); }, { ghost: true });
    const bRoad = U.Button(row, 'מלמעלה, מהכביש', function () { if (!S.locked) api.play({ frame: 'road' }); }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'view', label: 'מסתכלים' },
      { key: 'door', label: 'הכוח מהדלת', color: 'var(--c-force)' },
    ]);
    function setLocked(v) { S.locked = v; bCar.disabled = v; bRoad.disabled = v; }
    function at(s) {
      if (s < 0) return { x: s, y: 0, h: 0 };
      const a = s / Rc;
      return { x: Rc * Math.sin(a), y: Rc - Rc * Math.cos(a), h: a };
    }
    function layout() {
      if (S.frame === 'road') {
        view.setWorld({ xMin: -21, xMax: 22, yMin: -7, yMax: 23 });
      } else {
        const Sc = Math.min(view.w / 15, view.h / 14);
        K.place(view, view.w / 2, view.h * 0.56, Sc);
      }
    }
    function clearRun() {
      S.s = START;
      const p = at(S.s);
      S.cat = { x: p.x, y: p.y };
      S.contact = false;
      S.contactDeg = null;
      S.contactT = null;
      S.t = 0;
      S.trail = [{ x: p.x, y: p.y }];
      S.local = null;
      S.door = 0;
      S.maxOff = 0;
    }
    function step(dt0) {
      if (S.phase !== 'run') return;
      const dt = dt0 * S.rate;
      S.t += dt;
      S.s += V * dt;
      const p = at(S.s);
      const tx = Math.cos(p.h), ty = Math.sin(p.h), nx = -ty, ny = tx;
      if (!S.contact) {
        /* no force on him at all: a straight line at constant speed */
        S.cat.x += V * dt;
        const dx = S.cat.x - p.x, dy = S.cat.y - p.y;
        const lat = dx * nx + dy * ny;
        const fwd = dx * tx + dy * ty;
        S.maxOff = Math.max(S.maxOff, Math.abs(S.cat.y));
        if (lat <= -SIDE) {
          S.contact = true;
          S.contactDeg = p.h / RAD;
          S.contactT = S.t;
          S.local = { fwd: fwd, lat: -SIDE };
          /* He rides at the door's radius with the car's angular speed, so F = m ω² r there. */
          S.door = M * (V / Rc) * (V / Rc) * (Rc + SIDE);
          S.caption = S.frame === 'road' ? 'הדלת הגיעה אליו, ומשם היא דוחפת פנימה.' : 'בום! נדמה לי שמשהו זרק אותי!';
        }
      } else {
        S.cat.x = p.x + tx * S.local.fwd + nx * S.local.lat;
        S.cat.y = p.y + ty * S.local.fwd + ny * S.local.lat;
      }
      S.trail.push({ x: S.cat.x, y: S.cat.y });
      if (S.s >= Rc * 78 * RAD) {
        S.phase = 'done';
        S.caption = S.frame === 'road' ? 'אף אחד לא דחף אותו החוצה. הדלת דחפה אותו פנימה.' : 'מבפנים זה מרגיש כמו דחיפה החוצה.';
        K.settle(S);
      }
    }
    /* Everything is computed on the road. Inside view: subtract the car's position and heading. */
    function project(pt, p) {
      if (S.frame === 'road') return pt;
      const dx = pt.x - p.x, dy = pt.y - p.y;
      const tx = Math.cos(p.h), ty = Math.sin(p.h);
      /* heading up on the screen */
      return { x: dx * ty - dy * tx, y: dx * tx + dy * ty };
    }
    function render() {
      const small = view.w < 420;
      const p = at(S.s);
      view.clear();
      const road = [];
      for (let s = -40; s <= Rc * 2.6; s += 0.8) road.push(project(at(s), p));
      if (S.frame === 'road') view.grid(5);
      view.poly(road, { color: C.shade, width: 6.2 * view.scale });
      view.poly(road, { color: C.bg, width: 1.6, dash: [9, 10] });
      if (S.frame === 'road') {
        view.circle(0, Rc, 4, { px: true, fill: C.ink });
        view.text(0, Rc, 'מרכז הסיבוב', { size: small ? 11 : 12.5, color: C.soft, weight: 600, offset: [0, -13], halo: true });
        view.line(0, Rc, 0, 0, { color: C.soft, width: 1.5, dash: [4, 5] });
        view.text(0, Rc * 0.55, 'R = ' + F.unit(Rc, 'm', 0), { size: small ? 11 : 12.5, color: C.soft, weight: 700, halo: true });
      }
      /* his straight path, the one he would have kept */
      if (S.frame === 'road' && S.trail.length > 1) {
        view.line(START, 0, 21, 0, { color: C.displacement, width: 1.6, dash: [5, 6], alpha: 0.6 });
      }
      if (S.trail.length > 1) view.poly(S.trail.map(function (q) { return project(q, p); }), { color: C.displacement, width: 2.6 });

      /* the car */
      const ctx = view.ctx;
      const c0 = project({ x: p.x, y: p.y }, p);
      const carDeg = S.frame === 'road' ? p.h / RAD : 90;
      const Lp = CAR_L * view.scale, Wp = CAR_W * view.scale;
      ctx.save();
      ctx.translate(view.sx(c0.x), view.sy(c0.y));
      ctx.rotate(-carDeg * RAD);
      ctx.lineJoin = 'round';
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-Lp / 2, -Wp / 2, Lp, Wp, Wp * 0.2); else ctx.rect(-Lp / 2, -Wp / 2, Lp, Wp);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Lp * 0.28, -Wp * 0.44);
      ctx.lineTo(Lp * 0.28, Wp * 0.44);
      ctx.moveTo(-Lp * 0.3, -Wp * 0.44);
      ctx.lineTo(-Lp * 0.3, Wp * 0.44);
      ctx.stroke();
      /* the right door: in rotated canvas coords, +y is the car's right */
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-Lp * 0.26, Wp / 2 - 1);
      ctx.lineTo(Lp * 0.24, Wp / 2 - 1);
      ctx.stroke();
      ctx.restore();

      const cp = project(S.cat || { x: p.x, y: p.y }, p);
      const px = small ? 34 : 42;
      PHY.mascot.draw(view, cp.x, cp.y, { pose: S.contact ? 'dizzy' : 'standing', px: px, anchor: [0.5, 0.55] });

      if (S.phase !== 'ready') {
        const inward = S.frame === 'road' ? { x: -Math.sin(p.h), y: Math.cos(p.h) } : { x: -1, y: 0 };
        const u = 3.4 * (S.frame === 'road' ? 1 : 0.6);
        if (S.contact) {
          const off = (px * 0.42) / view.scale;
          const ax = cp.x + inward.x * off, ay = cp.y + inward.y * off;
          view.arrow(ax, ay, ax + inward.x * u, ay + inward.y * u, { color: C.force, width: 4.5 });
          view.text(ax + inward.x * u * 0.5, ay + inward.y * u * 0.5, 'הדלת דוחפת', { size: small ? 11.5 : 13, weight: 700, color: C.force, halo: true, offset: [0, -16] });
        } else if (S.frame === 'car' && S.s > 0) {
          const dx = 3;
          view.arrow(cp.x + 0.2, cp.y, cp.x + dx, cp.y, { color: C.soft, width: 3, dash: [6, 5], label: '?!', labelSide: -1, labelGap: 14 });
        }
      }
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      view.screenText(10, view.h - 14, 'ניוטון ' + F.unit(M, 'kg', 0) + ', ' + F.unit(V, 'ms', 0) + ', רדיוס הסיבוב ' + F.unit(Rc, 'm', 0), { size: small ? 11 : 12.5, weight: 600, color: C.soft, align: 'left', halo: true });
      out.set('view', S.frame === 'road' ? 'מהכביש' : 'מהמושב');
      out.set('door', S.locked && S.phase === 'ready' ? '?' : S.contact ? F.unit(S.door, 'N', 0) : '0 ניוטון');
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    clearRun();
    layout();
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { K.settle(S); S.phase = 'ready'; S.caption = ''; clearRun(); loop.requestRender(); },
      setParam(name, v) { if (name === 'locked') setLocked(!!v); },
      getState() { return { phase: S.phase, frame: S.frame, contact: S.contact, contactDeg: S.contactDeg, contactT: S.contactT, door: S.door, sideways: S.maxOff }; },
      play(o) {
        o = o || {};
        K.settle(S);
        S.frame = o.frame || 'road';
        layout();
        clearRun();
        S.phase = 'run';
        S.caption = S.frame === 'road' ? 'אותה נסיעה, מלמעלה' : 'מתוך המכונית, בלי לראות החוצה';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      advance(seconds) { for (let t = 0; t < seconds && S.phase === 'run'; t += 1 / 120) step(1 / 120); },
    };
    setLocked(!!opts.locked);
    return api;
  }

  function meterSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.6, minHeight: 400, maxHeight: 410 });
    const V = 20, Rm = 100, A0 = -60, ARC = 70 * RAD;
    const S = { phase: 'ready', s: A0, tilt: 0, om: 0, a: 0, speed: V, prev: null, speedMin: V, speedMax: V, aMax: 0, aStraight: 0, tiltOnArc: 0, resolve: null, caption: '', wide: true, rate: 1.35, panel: null };
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מד המהירות', color: 'var(--c-velocity)' },
      { key: 'a', label: 'התאוצה', color: 'var(--c-acceleration)' },
      { key: 't', label: 'הטיית התפוח' },
    ]);
    function at(s) {
      if (s < 0) return { x: s, y: 0, h: 0, on: false };
      if (s < Rm * ARC) { const a = s / Rm; return { x: Rm * Math.sin(a), y: Rm - Rm * Math.cos(a), h: a, on: true }; }
      const d = s - Rm * ARC;
      return { x: Rm * Math.sin(ARC) + d * Math.cos(ARC), y: Rm - Rm * Math.cos(ARC) + d * Math.sin(ARC), h: ARC, on: false };
    }
    function layout() {
      S.wide = view.w >= 520;
      if (S.wide) {
        const Sc = Math.min((view.w * 0.58) / 200, view.h / 140);
        K.place(view, view.w * 0.58 * 0.36, view.h * 0.84, Sc);
        S.panel = { x: view.w * 0.6, y: 44, w: view.w * 0.38, h: view.h - 54 };
      } else {
        const Sc = Math.min(view.w / 200, (view.h * 0.55) / 135);
        K.place(view, view.w * 0.34, view.h * 0.52, Sc);
        S.panel = { x: 6, y: view.h * 0.58, w: view.w - 12, h: view.h * 0.42 - 6 };
      }
    }
    function step(dt0) {
      if (S.phase !== 'run') return;
      const dt = dt0 * S.rate;
      const p0 = at(S.s);
      S.s += V * dt;
      const p1 = at(S.s);
      const v0 = { x: V * Math.cos(p0.h), y: V * Math.sin(p0.h) };
      const v1 = { x: V * Math.cos(p1.h), y: V * Math.sin(p1.h) };
      S.a = Math.hypot(v1.x - v0.x, v1.y - v0.y) / dt;
      if (p0.on && p1.on) S.aMax = Math.max(S.aMax, S.a);
      if (!p0.on && !p1.on) S.aStraight = Math.max(S.aStraight, S.a);
      /* travelled distance per step gives the speed, the same way a speedometer would */
      const sp = Math.hypot(p1.x - p0.x, p1.y - p0.y) / dt;
      if (p0.on === p1.on) {
        S.speed = sp;
        S.speedMin = Math.min(S.speedMin, sp);
        S.speedMax = Math.max(S.speedMax, sp);
      }
      /* the apple really hangs on a string in the accelerating car */
      const L = 0.25, D = 5;
      const a = p1.on ? (V * V) / Rm : 0;
      const alpha = (-G * Math.sin(S.tilt) + a * Math.cos(S.tilt)) / L - D * S.om;
      S.om += alpha * dt;
      S.tilt += S.om * dt;
      if (p1.on && S.s > Rm * ARC * 0.8) S.tiltOnArc = S.tilt / RAD;
      if (S.s >= Rm * ARC + 22) {
        S.phase = 'done';
        S.caption = 'המד לא זז. התפוח בכל זאת נטה.';
        K.settle(S);
      }
    }
    function drawPanel() {
      const P = S.panel;
      const small = view.w < 420;
      const ctx = view.ctx;
      const on = at(S.s).on;
      /* rear window of the car, with the apple hanging from the mirror */
      const cx = P.x + P.w * (S.wide ? 0.5 : 0.28);
      const top = P.y + (S.wide ? 24 : 10);
      const rw = S.wide ? P.w * 0.72 : P.w * 0.44;
      const rh = S.wide ? 150 : P.h - 20;
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - rw / 2, top, rw, rh, 12); else ctx.rect(cx - rw / 2, top, rw, rh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(cx - 20, top, 40, 6);
      ctx.restore();
      const LL = rh * 0.62;
      const ax = cx + Math.sin(S.tilt) * LL, ay = top + 6 + Math.cos(S.tilt) * LL;
      const a0 = view.toWorld(cx, top + 6), a1 = view.toWorld(ax, ay);
      view.line(a0.x, a0.y, a1.x, a1.y, { color: C.ink, width: 2 });
      if (Math.abs(S.tilt) > 0.01) {
        const end = view.toWorld(cx, top + 6 + LL);
        view.line(a0.x, a0.y, end.x, end.y, { color: C.soft, width: 1.3, dash: [4, 4] });
      }
      K.apple(view, a1.x, a1.y, small ? 17 : 20);
      view.screenText(cx, top + rh + (S.wide ? 14 : 0) - (S.wide ? 0 : -1), S.wide ? 'התפוח על המראה' : '', { size: 12, color: C.soft, weight: 600 });
      /* the speedometer */
      const gx = S.wide ? P.x + P.w / 2 : P.x + P.w * 0.76;
      const gy = S.wide ? top + rh + 76 : P.y + P.h * 0.62;
      const gr = S.wide ? 40 : 36;
      ctx.save();
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i <= 4; i++) {
        const th = Math.PI + (i / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(th) * gr, gy + Math.sin(th) * gr);
        ctx.lineTo(gx + Math.cos(th) * (gr - 6), gy + Math.sin(th) * (gr - 6));
        ctx.stroke();
      }
      const th = Math.PI + (S.speed / 40) * Math.PI;
      ctx.strokeStyle = C.velocity;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(th) * (gr - 8), gy + Math.sin(th) * (gr - 8));
      ctx.stroke();
      ctx.restore();
      view.screenText(gx, gy + 13, F.unit(S.speed, 'ms', 0), { size: small ? 12 : 13.5, weight: 700, color: C.velocity });
      view.screenText(gx, gy + 29, 'תאוצה: ' + (S.phase === 'ready' ? '?' : F.unit(on ? (V * V) / Rm : 0, 'ms2', 0)), { size: small ? 11.5 : 12.5, weight: 700, color: C.acceleration });
    }
    function render() {
      const small = view.w < 420;
      const p = at(S.s);
      view.clear();
      const pts = [];
      for (let s = A0; s <= Rm * ARC + 30; s += 3) { const q = at(s); pts.push({ x: q.x, y: q.y }); }
      K.road(view, pts, { width: small ? 22 : 28 });
      if (p.on) {
        const nx = -Math.sin(p.h), ny = Math.cos(p.h);
        view.arrow(p.x, p.y, p.x + nx * 30, p.y + ny * 30, { color: C.acceleration, width: 4, label: 'a', labelSide: 1 });
      }
      view.arrow(p.x, p.y, p.x + Math.cos(p.h) * 30, p.y + Math.sin(p.h) * 30, { color: C.velocity, width: 3.5, label: 'v', labelSide: -1 });
      K.topCar(view, p.x, p.y, p.h / RAD, { len: small ? 26 : 32, wid: small ? 13 : 16 });
      view.text(0, 96, 'סיבוב ברדיוס ' + F.unit(100, 'm', 0), { size: small ? 11 : 12.5, weight: 600, color: C.displacement, halo: true, offset: [small ? 10 : 0, 0] });
      drawPanel();
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      out.set('v', F.unit(S.speed, 'ms', 0));
      out.set('a', S.phase === 'ready' ? '?' : F.unit(p.on ? (V * V) / Rm : 0, 'ms2', 0));
      out.set('t', S.phase === 'ready' ? '?' : K.deg(Math.abs(S.tilt) / RAD, 0));
    }
    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { K.settle(S); S.phase = 'ready'; S.s = A0; S.tilt = 0; S.om = 0; S.caption = ''; loop.requestRender(); },
      setParam() {},
      getState() { return { phase: S.phase, s: S.s, speedMin: S.speedMin, speedMax: S.speedMax, aMax: S.aMax, aStraight: S.aStraight, tiltDeg: S.tilt / RAD, tiltOnArc: S.tiltOnArc }; },
      play() {
        K.settle(S);
        S.phase = 'run';
        S.s = A0;
        S.tilt = 0;
        S.om = 0;
        S.speedMin = V;
        S.speedMax = V;
        S.aMax = 0;
        S.aStraight = 0;
        S.caption = 'נסיעה ישרה, ואז סיבוב. מד המהירות לא משתנה.';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
    return api;
  }

  PHY.sims.carInside = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'door', locked: true }, opts || {});
    return opts.mode === 'meter' ? meterSim(canvasEl, controlsEl, opts) : doorSim(canvasEl, controlsEl, opts);
  };
})();

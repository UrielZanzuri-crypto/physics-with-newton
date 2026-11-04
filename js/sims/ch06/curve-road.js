/* PHY.sims.curveRoad: a car (or a car and a truck) drives into a left-hand curve, seen from above.
   Friction must supply a = v²/R. If that is more than μg the tires let go, and the car keeps going straight along
   the tangent, braking at 0.75 μg. The two vehicles use two lanes in the picture, and the same R in the physics.
   opts: {v, R, wet, m, pair, mode, locked}. sim.play({v, wet}) -> Promise. setParam: v, R, wet, m, pair, locked.
   getState(): v, R, mu, vMax, need (m/s²), limit (m/s²), result ('held' | 'skid' | null), cars [{name, m, mode, need, limit, skidAtX}].
   mode 'bank': the road seen from behind, banked by θ. setParam: deg, v. getState(): deg, v, vIdeal, f, N (m = 1000 kg). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;
  const RAD = Math.PI / 180;
  const ARC_END = 80 * RAD;

  function skidSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { aspect: 1.3, minHeight: 300, maxHeight: 460 });
    const S = {
      v: opts.v, R: opts.R, wet: opts.wet, m: opts.m, pair: opts.pair, cars: [], phase: 'ready', result: null, caption: '', locked: opts.locked,
      resolve: null, rate: 1.3, rain: 0,
    };
    const sV = U.Slider(controlsEl, {
      label: 'מהירות, v', min: 5, max: 35, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; ready(); },
    });
    const sR = U.Slider(controlsEl, {
      label: 'רדיוס הסיבוב, R', min: 20, max: 100, step: 5, value: S.R, unit: 'm', digits: 0, color: 'var(--c-displacement)',
      onInput(v) { S.R = v; layout(); ready(); },
    });
    const sM = U.Slider(controlsEl, {
      label: 'מסת המכונית', min: 500, max: 8000, step: 500, value: S.m, unit: 'kg', digits: 0,
      onInput(v) { S.m = v; S.pair = false; ready(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const goBtn = U.Button(row, 'לנסוע!', function () { if (!S.locked) api.play(); }, { primary: true });
    const wetT = U.Toggle(row, 'כביש רטוב', { value: !!S.wet, onChange(on) { S.wet = on; ready(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'vm', label: 'המהירות המרבית', color: 'var(--c-velocity)' },
      { key: 'a', label: 'התאוצה שצריך, v²/R', color: 'var(--c-acceleration)' },
      { key: 'lim', label: 'מה שהחיכוך נותן, μg', color: 'var(--c-acceleration)' },
    ]);

    const mu = () => (S.wet ? 0.4 : 0.8);
    const vMax = () => Math.sqrt(mu() * G * S.R);
    /* Until the first run these numbers would answer the card, so the stage keeps them to itself. */
    const notYet = () => S.locked && !S.revealed && S.phase === 'ready';
    function makeCars() {
      if (S.pair) {
        return [
          { name: 'מכונית', m: 1000, lane: 1, s: -0.52 * S.R, len: 30, wid: 15, color: C.accent },
          { name: 'משאית', m: 4000, lane: -1, s: -0.52 * S.R, len: 46, wid: 17, cargo: true },
        ];
      }
      return [{ name: 'מכונית', m: S.m, lane: 0, s: -0.52 * S.R, len: 36, wid: 18 }];
    }
    function ready() {
      K.settle(S);
      S.phase = 'ready';
      S.result = null;
      S.caption = '';
      S.cars = makeCars().map(init);
      loop.requestRender();
    }
    function init(c) { return Object.assign(c, { mode: 'road', x: c.s, y: 0, deg: 0, speed: S.v, grip: 0, skidAtX: null }); }
    function at(s) {
      if (s < 0) return { x: s, y: 0, deg: 0 };
      const a = s / S.R;
      return { x: S.R * Math.sin(a), y: S.R - S.R * Math.cos(a), deg: a / RAD };
    }
    function layout() {
      const R = S.R;
      view.setWorld({ xMin: -0.72 * R, xMax: 1.5 * R, yMin: -0.3 * R, yMax: 1.72 * R });
    }
    function setLocked(v) {
      S.locked = v;
      if (!v) S.revealed = true;
      sV.setEnabled(!v);
      sR.setEnabled(!v);
      sM.setEnabled(!v);
      goBtn.disabled = v;
      wetT.input.disabled = v;
    }

    function step(dt0) {
      S.rain += dt0;
      if (S.phase !== 'run') return;
      const dt = dt0 * S.rate;
      const a = (S.v * S.v) / S.R;
      const lim = mu() * G;
      let busy = false;
      S.cars.forEach(function (c) {
        if (c.mode === 'road') {
          busy = true;
          c.s += S.v * dt;
          const p = at(c.s);
          c.x = p.x; c.y = p.y; c.deg = p.deg;
          c.grip = c.s >= 0 ? a : 0;
          if (c.s >= 0 && a > lim) {
            c.mode = 'skid';
            c.skidAtX = c.x;
            c.y = 0;
            c.deg = 0;
            c.speed = S.v;
            S.result = 'skid';
          } else if (c.s >= ARC_END * S.R) {
            c.mode = 'end';
            if (!S.result) S.result = 'held';
          }
        } else if (c.mode === 'skid') {
          busy = true;
          c.speed = Math.max(0, c.speed - 0.75 * lim * dt);
          c.x += c.speed * dt;
          if (c.speed <= 0) c.mode = 'stop';
        }
      });
      if (!busy) {
        S.phase = 'done';
        S.caption = S.result === 'skid'
          ? 'ב-' + F.unit(S.v, 'ms', 0) + ' הצמיגים מוותרים, והרכב יוצא מהסיבוב.'
          : 'ב-' + F.unit(S.v, 'ms', 0) + ' הסיבוב עובר בשלום.';
        K.settle(S);
      }
    }

    function render() {
      const small = view.w < 420;
      const R = S.R;
      const lanePx = S.pair ? (small ? 9 : 11) : 0;
      const pts = [];
      for (let s = -1.2 * R; s < ARC_END * R + 0.5 * R; s += R * 0.03) {
        const p = s > ARC_END * R ? null : at(s);
        if (p) pts.push({ x: p.x, y: p.y });
      }
      view.clear();
      view.grid(10);
      if (S.wet) view.poly([{ x: -9 * R, y: -9 * R }, { x: 9 * R, y: -9 * R }, { x: 9 * R, y: 9 * R }, { x: -9 * R, y: 9 * R }], { fill: C.shade, alpha: 0.35, close: true });
      K.road(view, pts, { width: small ? 32 : 40 });
      /* center of the curve, and the radius */
      view.circle(0, R, 4, { px: true, fill: C.ink });
      view.line(0, 0, 0, R, { color: C.displacement, width: 2, dash: [5, 5] });
      view.text(0, R * 0.42, F.unit(R, 'm', 0), { size: small ? 11.5 : 13, weight: 700, color: C.displacement, halo: true, offset: [small ? -26 : -32, 0] });
      view.text(0, R * 0.42, 'R', { size: small ? 12 : 14, weight: 800, color: C.displacement, halo: true, offset: [10, 0] });

      S.cars.forEach(function (c) {
        const h = c.deg * RAD;
        const nx = -Math.sin(h), ny = Math.cos(h);
        const off = (c.lane * lanePx) / view.scale;
        const x = c.x + nx * off, y = c.y + ny * off;
        if (c.grip > 0 && c.mode === 'road') {
          const need = c.m * c.grip;
          const ref = S.pair ? 32000 : c.m * 10;
          const px = Math.max(10, (need / ref) * (small ? 58 : 76));
          const dx = 0 - x, dy = R - y, d = Math.hypot(dx, dy);
          view.arrow(x, y, x + (dx / d) * (px / view.scale), y + (dy / d) * (px / view.scale), { color: C.force, width: 3.5 });
        }
        if (c.mode === 'skid' || c.mode === 'stop') {
          const sx = c.skidAtX;
          view.line(sx, y + 4 / view.scale, x, y + 4 / view.scale, { color: C.ink, width: 2, alpha: 0.6 });
          view.line(sx, y - 4 / view.scale, x, y - 4 / view.scale, { color: C.ink, width: 2, alpha: 0.6 });
        }
        K.topCar(view, x, y, c.deg, { len: c.len * (small ? 0.9 : 1.05), wid: c.wid * (small ? 0.9 : 1.05), cargo: c.cargo, color: c.cargo ? C.gold : C.accent });
        if (c.mode !== 'stop') {
          const u = (c.mode === 'skid' ? c.speed : S.v) * (small ? 1.5 : 1.8);
          view.arrow(x + (Math.cos(h) * c.len * 0.55) / view.scale, y + (Math.sin(h) * c.len * 0.55) / view.scale, x + (Math.cos(h) * (c.len * 0.55 + u)) / view.scale, y + (Math.sin(h) * (c.len * 0.55 + u)) / view.scale, { color: C.velocity, width: 2.8 });
        }
      });

      /* the grip gauges live inside the curve, where the road is not */
      const x0 = 10, bw = small ? Math.min(view.w * 0.56, 180) : 230;
      let y0 = 42;
      S.cars.forEach(function (c) {
        const need = c.m * ((S.v * S.v) / S.R);
        const lim = c.m * mu() * G;
        const on = c.grip > 0 || c.mode === 'skid' || c.mode === 'stop' || c.mode === 'end';
        const hide = notYet();
        const txt = c.name + ' ' + F.num(c.m, 0) + ' ק"ג' + (hide ? '' : ': ' + (on ? 'צריך ' + F.num(need, 0) + ', יש ' + F.num(lim, 0) + ' ניוטון' : 'יש עד ' + F.num(lim, 0) + ' ניוטון'));
        view.screenText(x0, y0, txt, { size: small ? 10.5 : 12, weight: 600, align: 'left', halo: true });
        K.bar(view, x0, y0 + 8, bw, small ? 7 : 9, on ? need / (lim * 1.5) : 0, { color: need > lim ? C.bad : C.force, limit: hide ? undefined : 1 / 1.5 });
        y0 += small ? 30 : 34;
      });

      if (S.wet && !U.reduced()) {
        for (let i = 0; i < 26; i++) {
          const a = (i * 137.5) % 360;
          const xx = (a / 360) * view.w;
          const yy = ((i * 47 + S.rain * 260) % (view.h + 20)) - 10;
          const p1 = view.toWorld(xx, yy), p2 = view.toWorld(xx - 3, yy + 10);
          view.line(p1.x, p1.y, p2.x, p2.y, { color: C.soft, width: 1.3, alpha: 0.4 });
        }
      }
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      out.set('vm', S.locked && !S.revealed ? '?' : F.unit(vMax(), 'ms', 1));
      out.set('a', notYet() ? '?' : F.unit((S.v * S.v) / S.R, 'ms2', 1));
      out.set('lim', notYet() ? '?' : F.unit(mu() * G, 'ms2', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });
    layout();
    ready();

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: ready,
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'v') { S.v = v; sV.set(v); }
        if (name === 'R') { S.R = v; sR.set(v); layout(); }
        if (name === 'm') { S.m = v; sM.set(v); }
        if (name === 'wet') { S.wet = !!v; wetT.set(!!v); }
        if (name === 'pair') { S.pair = !!v; setLocked(S.locked); }
        ready();
      },
      getState() {
        const a = (S.v * S.v) / S.R;
        return {
          phase: S.phase, v: S.v, R: S.R, wet: S.wet, mu: mu(), vMax: vMax(), need: a, limit: mu() * G, result: S.result,
          cars: S.cars.map(function (c) { return { name: c.name, m: c.m, mode: c.mode, need: c.m * a, limit: c.m * mu() * G, skidAtX: c.skidAtX, x: c.x, y: c.y }; }),
        };
      },
      play(o) {
        o = o || {};
        if (o.v !== undefined) { S.v = o.v; sV.set(o.v); }
        if (o.wet !== undefined) { S.wet = !!o.wet; wetT.set(!!o.wet); }
        ready();
        S.phase = 'run';
        S.caption = (o.label || '') + F.unit(S.v, 'ms', 0) + (S.wet ? ', כביש רטוב' : ', כביש יבש');
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) { for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120); },
    };
    setLocked(S.locked);
    return api;
  }

  function bankSim(canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -4.2, xMax: 4.2, yMin: -1.6, yMax: 3.4 }, aspect: 1.65, minHeight: 250, maxHeight: 380 });
    const S = { deg: 20, v: 13.5, R: opts.R, m: 1000 };
    const sD = U.Slider(controlsEl, {
      label: 'זווית ההטיה, θ', min: 0, max: 45, step: 1, value: S.deg, format: (v) => K.deg(v), color: 'var(--accent)',
      onInput(v) { S.deg = v; loop.requestRender(); },
    });
    const sV = U.Slider(controlsEl, {
      label: 'מהירות, v', min: 0, max: 30, step: 0.5, value: S.v, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; loop.requestRender(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'ideal', label: 'המהירות בלי צורך בחיכוך', color: 'var(--c-velocity)' },
      { key: 'f', label: 'החיכוך שעדיין צריך, ל-1000 ק"ג', color: 'var(--c-force)' },
    ]);
    function nums() {
      const th = K.friendly(S.deg);
      const a = (S.v * S.v) / S.R;
      const N = S.m * (G * Math.cos(th) + a * Math.sin(th));
      const f = S.m * (a * Math.cos(th) - G * Math.sin(th));
      return { th, a, N, f, vIdeal: Math.sqrt(G * S.R * Math.tan(th)) };
    }
    function render() {
      const small = view.w < 420;
      const n = nums();
      const th = n.th;
      const c = Math.cos(th), s = Math.sin(th);
      const k = 1.5 / (S.m * G);
      view.clear();
      view.grid(1);
      /* the road surface, rising to the outside of the curve (right) */
      const L = 5;
      const a = { x: -L * c, y: -L * s }, b = { x: L * c, y: L * s };
      view.poly([a, b, { x: b.x, y: -3 }, { x: a.x, y: -3 }], { fill: C.shade, close: true });
      view.line(a.x, a.y, b.x, b.y, { color: C.axis, width: 4 });
      view.line(-1.9, 0, 1.9, 0, { color: C.soft, width: 1.5, dash: [5, 5] });
      if (S.deg > 2) {
        view.arc(0, 0, 66, 0, S.deg, { color: C.accent, width: 2.5 });
        view.text(0, 0, F.deg(S.deg), { size: 12.5, weight: 700, color: C.accent, halo: true, offset: [84 * Math.cos((S.deg / 2) * RAD), -84 * Math.sin((S.deg / 2) * RAD) - 1] });
      }
      /* the car from behind, tilted with the road */
      const ctx = view.ctx;
      const w = small ? 64 : 84, h = small ? 30 : 38;
      ctx.save();
      ctx.translate(view.sx(0), view.sy(0));
      ctx.rotate(-th);
      ctx.lineJoin = 'round';
      ctx.fillStyle = C.ink;
      ctx.fillRect(-w * 0.46, -6, w * 0.2, 7);
      ctx.fillRect(w * 0.26, -6, w * 0.2, 7);
      ctx.fillStyle = C.accent;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-w / 2, -h - 3, w, h, 7); else ctx.rect(-w / 2, -h - 3, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.surface;
      ctx.fillRect(-w * 0.32, -h + 1, w * 0.64, h * 0.42);
      ctx.strokeRect(-w * 0.32, -h + 1, w * 0.64, h * 0.42);
      ctx.restore();
      /* forces, from the car's middle */
      const ox = -Math.sin(th) * 0.45, oy = Math.cos(th) * 0.45;
      view.arrow(ox, oy, ox, oy - S.m * G * k, { color: C.force, width: 4, label: 'mg', labelSide: -1 });
      const Nx = -s * n.N * k, Ny = c * n.N * k;
      view.arrow(ox, oy, ox + Nx, oy + Ny, { color: C.force, width: 4, label: 'N', labelSide: 1 });
      view.line(ox + Nx, oy + Ny, ox, oy + Ny, { color: C.force, width: 1.8, dash: [4, 4] });
      view.line(ox + Nx, oy + Ny, ox + Nx, oy, { color: C.force, width: 1.8, dash: [4, 4] });
      if (Math.abs(n.f) > 60) {
        const fx = -c * n.f * k, fy = -s * n.f * k;
        view.arrow(ox, oy, ox + fx, oy + fy, { color: C.force, width: 3, alpha: 0.75, label: 'f', labelSide: n.f > 0 ? 1 : -1 });
      }
      /* the turn asks for this much, toward the center on the left */
      const px = oy + 2.15;
      view.arrow(0.9, px, 0.9 - (S.m * n.a) * k, px, { color: C.acceleration, width: 3.5, label: 'v²/R', labelSide: -1, labelGap: 12 });
      view.text(-3.1, px + 0.02, 'למרכז הסיבוב', { size: small ? 11.5 : 13, weight: 700, color: C.soft });
      out.set('ideal', F.unit(n.vIdeal, 'ms', 1));
      out.set('f', Math.abs(n.f) < 60 ? '0 ניוטון' : F.unit(Math.abs(n.f), 'N', 0));
    }
    const loop = PHY.SimLoop({ view, render });
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { S.deg = 20; S.v = 13.5; sD.set(20); sV.set(13.5); loop.requestRender(); },
      setParam(name, v) {
        if (name === 'deg') { S.deg = v; sD.set(v); }
        if (name === 'v') { S.v = v; sV.set(v); }
        loop.requestRender();
      },
      getState() { const n = nums(); return { deg: S.deg, v: S.v, vIdeal: n.vIdeal, f: n.f, N: n.N }; },
    };
  }

  PHY.sims.curveRoad = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'skid', v: 18, R: 50, wet: false, m: 1000, pair: false, locked: true }, opts || {});
    return opts.mode === 'bank' ? bankSim(canvasEl, controlsEl, opts) : skidSim(canvasEl, controlsEl, opts);
  };
})();

/* PHY.sims.loopTrack: closes chapter 5's question. Frictionless ramp from height h into a loop of radius R.
   Speed comes from energy, v² = 2g(h - y). On the loop N = m(v²/R + g cos φ), φ from the bottom. The track can only push,
   so at N = 0 the cat leaves it and falls as a projectile. h = 2R fails, h = 2.5R just passes with N = 0 at the top.
   opts: {R, h, m, locked}. sim.play({h}) -> Promise. sim.pause(s) -> Promise. setParam: h, R, locked.
   getState(): phase, h, R, result ('pass' | 'fell'), vTop, nTop (N), nBottom (N), detachDeg, detachY, k (J), u (J), e0 (J). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;
  const RAD = Math.PI / 180;

  PHY.sims.loopTrack = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ R: 2, h: 6, m: 5, locked: true, rate: 0.8 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.32, minHeight: 300, maxHeight: 460 });
    const tw = PHY.ch02.tweens();
    const S = {
      R: opts.R, h: opts.h, m: opts.m, phase: 'ready', part: 'ramp', s: 0, phi: 0, x: 0, y: 0, v: 0, deg: 0, N: 0, ramp: [], rampLen: 0,
      p: null, u: null, result: null, vTop: null, nTop: null, nBottom: null, detachDeg: null, detachY: null, pose: 'standing', caption: '', rate: opts.rate,
      locked: opts.locked, resolve: null, prevN: null,
    };
    const sH = U.Slider(controlsEl, {
      label: 'גובה ההתחלה, h', min: 3, max: 7, step: 0.1, value: S.h, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { S.h = v; rebuild(); idle(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const goBtn = U.Button(row, 'לשלוח את ניוטון', function () { if (!S.locked) api.play({ h: S.h }); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'r', label: 'h / R' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'N', label: 'הכוח הנורמלי, N', color: 'var(--c-force)' },
      { key: 'top', label: 'מהירות בפסגה' },
    ]);
    function setLocked(v) { S.locked = v; sH.setEnabled(!v); goBtn.disabled = v; }

    function rebuild() {
      /* a smooth ramp into a short flat section, then the bottom of the loop at x = 0 */
      const R = S.R;
      const L = 2.2 * R, a = 0.45 * R;
      const pts = [];
      let len = 0;
      for (let i = 0; i <= 240; i++) {
        const q = i / 240;
        const x = -a - L + L * q;
        const y = S.h * (0.5 + 0.5 * Math.cos(Math.PI * q));
        if (i) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
        pts.push({ x: x, y: y, s: len });
      }
      pts.push({ x: 0, y: 0, s: len + a });
      S.ramp = pts;
      S.rampLen = len + a;
    }
    function rampAt(s) {
      const P = S.ramp;
      let lo = 0, hi = P.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
      const A = P[lo], B = P[hi];
      const k = K.clamp((s - A.s) / (B.s - A.s || 1), 0, 1);
      return { x: K.lerp(A.x, B.x, k), y: K.lerp(A.y, B.y, k), deg: Math.atan2(B.y - A.y, B.x - A.x) / RAD };
    }
    function layout() {
      const R = S.R;
      view.setWorld({ xMin: -3.3 * R, xMax: 2.1 * R, yMin: -0.42 * R, yMax: 3.72 * R });
    }

    function idle() {
      tw.clear();
      K.settle(S);
      S.phase = 'ready';
      S.part = 'ramp';
      S.s = 0;
      S.phi = 0;
      const p = rampAt(0);
      S.x = p.x; S.y = p.y; S.deg = p.deg; S.v = 0; S.N = 0;
      S.p = null; S.u = null; S.result = null;
      S.vTop = null; S.nTop = null; S.nBottom = null; S.detachDeg = null; S.detachY = null;
      S.pose = 'standing';
      S.caption = '';
      S.prevN = null;
      loop.requestRender();
    }
    function nOn(phi, v) { return S.m * ((v * v) / S.R + G * Math.cos(phi)); }
    function speed(y) { return Math.sqrt(Math.max(0, 2 * G * (S.h - y))); }

    function step(dt0) {
      tw.step(dt0);
      if (S.phase !== 'run') return;
      const dt = dt0 * S.rate;
      if (S.part === 'ramp') {
        S.v = Math.max(speed(S.y), 0.5);
        S.s += S.v * dt;
        if (S.s >= S.rampLen) {
          S.part = 'loop';
          S.phi = 0;
          S.nBottom = nOn(0, speed(0));
        } else {
          const p = rampAt(S.s);
          S.x = p.x; S.y = p.y; S.deg = p.deg;
          S.N = S.m * G * Math.cos(p.deg * RAD);
        }
      } else if (S.part === 'loop') {
        let y = S.R * (1 - Math.cos(S.phi));
        S.v = speed(y);
        const N = nOn(S.phi, S.v);
        if (N < -1e-7) {
          /* back up to the exact crossing, so the printed angle does not depend on the step size */
          if (S.prevN) {
            S.phi = S.prevN.phi + ((S.phi - S.prevN.phi) * S.prevN.N) / (S.prevN.N - N);
            y = S.R * (1 - Math.cos(S.phi));
            S.v = speed(y);
          }
          S.part = 'air';
          S.detachDeg = S.phi / RAD;
          S.detachY = y;
          S.p = { x: S.R * Math.sin(S.phi), y: y };
          S.u = { x: S.v * Math.cos(S.phi), y: S.v * Math.sin(S.phi) };
          S.N = 0;
          S.pose = 'falling';
          S.caption = 'המסילה הפסיקה לדחוף, וניוטון נושר.';
          return;
        }
        S.N = N;
        S.prevN = { phi: S.phi, N: N };
        const next = S.phi + (S.v / S.R) * dt;
        if (S.phi < Math.PI && next >= Math.PI) {
          S.vTop = speed(2 * S.R);
          S.nTop = nOn(Math.PI, S.vTop);
          S.pose = 'dizzy';
          S.caption = 'בפסגה: ' + F.unit(S.vTop, 'ms', 1) + ', והמסילה דוחפת ' + F.unit(Math.max(0, S.nTop), 'N', 0);
        }
        S.phi = next;
        if (S.phi >= 2 * Math.PI) {
          S.part = 'exit';
          S.phi = 2 * Math.PI;
          S.s = 0;
          S.N = S.m * G;
          S.pose = 'happy';
        } else {
          S.x = S.R * Math.sin(S.phi);
          S.y = S.R * (1 - Math.cos(S.phi));
          S.deg = S.phi / RAD;
        }
      } else if (S.part === 'exit') {
        S.v = speed(0);
        S.x += S.v * dt;
        S.y = 0;
        S.deg = 0;
        if (S.x >= 1.75 * S.R) {
          S.result = 'pass';
          S.phase = 'done';
          S.caption = 'עבר! גובה של ' + F.num(S.h / S.R, 2) + 'R מספיק.';
          K.settle(S);
        }
      } else if (S.part === 'air') {
        S.u.y -= G * dt;
        S.p.x += S.u.x * dt;
        S.p.y += S.u.y * dt;
        S.x = S.p.x; S.y = S.p.y;
        S.v = Math.hypot(S.u.x, S.u.y);
        S.deg += 240 * dt;
        const r = Math.hypot(S.p.x, S.p.y - S.R);
        if (r >= S.R || S.p.y <= 0) {
          S.part = 'crash';
          S.result = 'fell';
          S.pose = 'dizzy';
          S.v = 0;
          const x0 = S.x, y0 = S.y, d0 = S.deg;
          S.caption = 'נפל מ-' + F.unit(S.detachY, 'm', 1) + '. חסרה לו מהירות בפסגה.';
          tw.run(0.8, function (k) {
            const q = K.ease(k);
            S.x = x0 * (1 - q); S.y = y0 * (1 - q); S.deg = d0 * (1 - q);
          }).then(function () {
            S.deg = 0;
            S.phase = 'done';
            K.settle(S);
          });
        }
      }
    }

    function render() {
      const small = view.w < 420;
      const R = S.R;
      const px = small ? 32 : 40;
      view.clear();
      view.grid(R / 2);
      const r = view.visible;
      /* floor, ramp, loop */
      view.poly([{ x: r.xMin, y: 0 }, { x: r.xMax, y: 0 }, { x: r.xMax, y: r.yMin }, { x: r.xMin, y: r.yMin }], { fill: C.shade, close: true });
      view.line(r.xMin, 0, r.xMax, 0, { color: C.axis, width: 3 });
      const fill = S.ramp.map(function (q) { return { x: q.x, y: q.y }; });
      fill.push({ x: S.ramp[0].x, y: 0 });
      view.poly(fill, { fill: C.shade, close: true });
      view.poly(S.ramp, { color: C.axis, width: 4 });
      view.circle(0, R, R, { color: C.axis, width: 4 });
      /* reference heights */
      view.line(-3.2 * R, 2 * R, 1.25 * R, 2 * R, { color: C.gold, width: 1.5, dash: [5, 6] });
      view.text(1.35 * R, 2 * R, '2R', { size: 12, weight: 700, color: C.soft, halo: true, align: 'left' });
      const X0 = S.ramp[0].x;
      view.line(X0, 0, X0, S.h, { color: C.displacement, width: 2.5 });
      view.text(X0, S.h / 2, F.unit(S.h, 'm', 1), { size: small ? 11.5 : 13, weight: 700, color: C.displacement, halo: true, offset: [small ? -22 : -26, 0] });
      view.text(X0, S.h / 2, 'h', { size: small ? 12.5 : 14, weight: 800, color: C.displacement, halo: true, offset: [10, 0] });
      view.line(0, R, -R * 0.7, R + R * 0.71, { color: C.soft, width: 1.5 });
      view.text(-R * 0.3, R + R * 0.42, 'R', { size: 12, weight: 700, color: C.soft, halo: true, offset: [-9, -2] });

      /* the cat */
      const onLoop = S.part === 'loop' && S.phase === 'run';
      if (onLoop) {
        const ux = -Math.sin(S.phi), uy = Math.cos(S.phi);
        const k = 0.9 * R / (6 * S.m * G);
        const L = S.N * k;
        if (L > 0.02 * R) {
          view.arrow(S.x, S.y, S.x + ux * L, S.y + uy * L, { color: C.force, width: 4 });
          K.tipLabel(view, S.x, S.y, S.x + ux * L, S.y + uy * L, 'N', { color: C.force });
        }
        view.arrow(S.x + 14 / view.scale, S.y, S.x + 14 / view.scale, S.y - S.m * G * k, { color: C.force, width: 3, alpha: 0.75 });
        const vx = S.x + Math.cos(S.phi) * S.v * 0.07 * R, vy = S.y + Math.sin(S.phi) * S.v * 0.07 * R;
        view.arrow(S.x, S.y, vx, vy, { color: C.velocity, width: 3.5 });
        K.tipLabel(view, S.x, S.y, vx, vy, 'v', { color: C.velocity });
      }
      PHY.mascot.draw(view, S.x, S.y, { pose: S.pose, px: px, rot: S.deg });

      /* energy bars, top right */
      const E = S.m * G * S.h;
      const bx = view.w - (small ? 84 : 102), by = small ? 42 : 48, bw = small ? 26 : 30, bh = small ? 56 : 74;
      const U0 = S.m * G * Math.max(0, S.y);
      const K0 = Math.max(0, E - U0);
      const fracs = [[K0 / E, C.accent, 'תנועה'], [U0 / E, C.gold, 'גובה']];
      fracs.forEach(function (b, i) {
        const x = bx + i * (bw + 10);
        const ctx = view.ctx;
        ctx.save();
        ctx.fillStyle = C.grid;
        ctx.fillRect(x, by, bw, bh);
        ctx.fillStyle = b[1];
        const H = K.clamp(b[0], 0, 1) * bh;
        ctx.fillRect(x, by + bh - H, bw, H);
        ctx.restore();
        view.screenText(x + bw / 2, by + bh + 10, b[2], { size: small ? 10.5 : 11.5, weight: 700, color: C.soft });
      });

      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      out.set('r', S.locked && S.phase === 'ready' ? '?' : F.num(S.h / S.R, 2));
      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('N', F.unit(Math.max(0, S.N), 'N', 0));
      out.set('top', S.result === 'fell' ? 'לא הגיע' : S.vTop !== null ? F.unit(S.vTop, 'ms', 1) : 'עוד לא');
    }

    const loop = PHY.SimLoop({ view, step, render });
    rebuild();
    layout();
    idle();

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: idle,
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'h') { S.h = v; sH.set(v); rebuild(); idle(); }
        if (name === 'R') { S.R = v; layout(); rebuild(); idle(); }
      },
      getState() {
        const U0 = S.m * G * S.y;
        return {
          phase: S.phase, part: S.part, h: S.h, R: S.R, m: S.m, result: S.result, vTop: S.vTop, nTop: S.nTop, nBottom: S.nBottom, detachDeg: S.detachDeg, detachY: S.detachY,
          x: S.x, y: S.y, v: S.v, u: U0, k: 0.5 * S.m * S.v * S.v, e0: S.m * G * S.h,
        };
      },
      play(o) {
        o = o || {};
        idle();
        if (o.R !== undefined && o.R !== S.R) { S.R = o.R; layout(); }
        if (o.h !== undefined) { S.h = o.h; if (o.h >= 3 && o.h <= 7) sH.set(o.h); }
        rebuild();
        const p = rampAt(0);
        S.x = p.x; S.y = p.y; S.deg = p.deg;
        S.phase = 'run';
        S.caption = o.label || 'יוצאים מגובה ' + F.num(S.h / S.R, 2) + 'R';
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      pause(seconds) { return tw.run(seconds, null); },
      advance(seconds) { for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120); },
    };
    setLocked(S.locked);
    return api;
  };
})();

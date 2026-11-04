/* PHY.sims.bucket: a vertical circle on a string, with the hand fixed at the center, so the string does no work and
   energy is conserved: v² = v_b² - 2gR(1 - cos φ), φ measured from the bottom.
   Tension: T = m(v²/R + g cos φ). A string can only pull, so when T would go negative it goes slack and the load
   becomes a projectile until the string catches it again. The water then keeps going, usually onto the cat.
   opts: {R, m, vTop, payload: 'bucket' | 'apple', locked}. sim.play({vTop | vBottom, revs}) -> Promise. sim.pause(s) -> Promise.
   setParam: vTop, R, locked. getState(): phase, phi, v, T, tTop, tBottom, tMax, tMin, slack {deg, height}, vBottom, vMin, wet. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const G = 10;
  const RAD = Math.PI / 180;

  PHY.sims.bucket = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ R: 1, m: 1, vTop: 4, payload: 'bucket', locked: true, rate: 0.62 }, opts || {});
    /* Wide screens put the graph beside the circle, phones put it underneath, and that needs a taller canvas. */
    const narrowStart = ((canvasEl.parentElement && canvasEl.parentElement.clientWidth) || 640) < 520;
    const view = PHY.canvas.create(canvasEl, { aspect: narrowStart ? 0.8 : 1.8, minHeight: narrowStart ? 420 : 320, maxHeight: 440 });
    const tw = PHY.ch02.tweens();
    const S = {
      R: opts.R, m: opts.m, vb: Math.sqrt(opts.vTop * opts.vTop + 4 * G * opts.R), phase: 'ready', phi: 0, v: 0, T: 0, trace: [], revs: 2, payload: opts.payload,
      p: null, u: null, slack: null, drops: [], tTop: null, tBottom: null, tMax: -Infinity, tMin: Infinity, wet: false, caption: '', locked: opts.locked, resolve: null,
      wide: true, passedTop: false, rate: opts.rate, hang: null, plot: null, pose: 'standing', spilled: false, topSpeed: null,
    };
    const sV = U.Slider(controlsEl, {
      label: 'המהירות בפסגה, אם מגיעים אליה', min: 0, max: 6, step: 0.1, value: opts.vTop, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { setVTop(v); idle(); },
    });
    const sR = U.Slider(controlsEl, {
      label: 'אורך החוט, R', min: 0.5, max: 1.5, step: 0.1, value: S.R, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { const vt = sV.value; S.R = v; setVTop(vt); layout(); idle(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const goBtn = U.Button(row, 'לסובב!', function () { if (!S.locked) api.play({ vTop: sV.value }); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות עכשיו', color: 'var(--c-velocity)' },
      { key: 'T', label: 'מתיחות עכשיו', color: 'var(--c-force)' },
      { key: 'vm', label: 'המינימום בפסגה', color: 'var(--c-velocity)' },
    ]);

    function setVTop(v) { S.vb = Math.sqrt(Math.max(0, v * v + 4 * G * S.R)); }
    function vAt(phi) { return Math.sqrt(Math.max(0, S.vb * S.vb - 2 * G * S.R * (1 - Math.cos(phi)))); }
    function tensionAt(phi) { return S.m * ((S.vb * S.vb) / S.R - 2 * G + 3 * G * Math.cos(phi)); }
    function setLocked(v) { S.locked = v; if (!v) S.revealed = true; sV.setEnabled(!v); sR.setEnabled(!v); goBtn.disabled = v; }

    function layout() {
      S.wide = view.w >= 520;
      if (S.wide) {
        const Sc = Math.min((view.h - 44) / 2.75, (view.w * 0.56) / 3.5) / S.R;
        K.place(view, view.w * 0.32, view.h - 1.36 * S.R * Sc - 4, Sc);
        S.plot = { x: view.w * 0.58, y: view.h * 0.14, w: view.w * 0.41, h: view.h * 0.74 };
      } else {
        const Sc = Math.min((view.h * 0.62 - 40) / 2.75, view.w / 3.5) / S.R;
        K.place(view, view.w * 0.56, 36 + Sc * S.R * 1.28, Sc);
        S.plot = { x: 2, y: view.h * 0.65, w: view.w - 6, h: view.h * 0.35 - 2 };
      }
    }

    function idle() {
      tw.clear();
      K.settle(S);
      S.phase = 'ready';
      S.phi = 0;
      S.v = S.vb;
      S.T = tensionAt(0);
      S.trace = [];
      S.p = null; S.u = null; S.slack = null; S.drops = []; S.hang = null;
      S.tTop = null; S.tBottom = null; S.tMax = -Infinity; S.tMin = Infinity; S.wet = false; S.spilled = false; S.topSpeed = null;
      S.passedTop = false;
      S.prev = null;
      S.pose = 'standing';
      S.caption = '';
      loop.requestRender();
    }

    function record(phi, T) {
      S.T = T;
      S.tMax = Math.max(S.tMax, T);
      S.tMin = Math.min(S.tMin, T);
      if (phi <= 2 * Math.PI) S.trace.push({ t: phi / RAD, y: T });
    }

    function finish(caption, pose) {
      S.phase = 'done';
      if (caption) S.caption = caption;
      if (pose) S.pose = pose;
      K.settle(S);
    }

    function step(dt0) {
      tw.step(dt0);
      const dt = dt0 * S.rate;
      if (S.phase === 'circle') {
        const T = tensionAt(S.phi);
        if (T < -1e-7) {
          /* the string can only pull: from here on it is a projectile.
             Back up to the exact crossing, so the printed angle does not depend on the step size. */
          if (S.prev) S.phi = S.prev.phi + ((S.phi - S.prev.phi) * S.prev.T) / (S.prev.T - T);
          const v = vAt(S.phi);
          S.slack = { deg: S.phi / RAD, height: S.R * (1 - Math.cos(S.phi)), v: v };
          S.p = { x: S.R * Math.sin(S.phi), y: -S.R * Math.cos(S.phi) };
          S.u = { x: v * Math.cos(S.phi), y: v * Math.sin(S.phi) };
          S.phase = 'slack';
          S.T = 0;
          S.caption = 'החוט נרפה! מכאן זו קשת של נפילה.';
          S.pose = 'thinking';
          return;
        }
        record(S.phi, T);
        S.prev = { phi: S.phi, T: T };
        S.v = vAt(S.phi);
        const nextPhi = S.phi + (S.v / S.R) * dt;
        if (S.phi < Math.PI && nextPhi >= Math.PI) {
          S.tTop = tensionAt(Math.PI);
          S.topSpeed = vAt(Math.PI);
          S.passedTop = true;
          if (S.payload === 'bucket') S.caption = 'בפסגה: ' + F.unit(S.topSpeed, 'ms', 1) + ', והמים נשארים למעלה!';
        }
        if (S.phi < 2 * Math.PI && nextPhi >= 2 * Math.PI) S.tBottom = tensionAt(0);
        S.phi = nextPhi;
        if (S.phi >= S.revs * 2 * Math.PI) {
          S.phi = S.revs * 2 * Math.PI;
          finish(S.payload === 'bucket' ? 'יבש! החתול לא מאמין.' : 'סיבוב שלם. המתיחות בפסגה: ' + F.unit(S.tTop, 'N', 1) + '.', 'happy');
        }
      } else if (S.phase === 'slack') {
        S.u.y -= G * dt;
        S.p.x += S.u.x * dt;
        S.p.y += S.u.y * dt;
        const r = Math.hypot(S.p.x, S.p.y);
        if (r >= S.R) {
          /* the string catches the load. Water has no string. */
          S.p.x *= S.R / r;
          S.p.y *= S.R / r;
          const start = Math.atan2(S.p.x, -S.p.y);
          S.phase = 'caught';
          S.hang = { a: start };
          if (S.payload === 'bucket') {
            S.spilled = true;
            for (let i = 0; i < 26; i++) {
              const q = i / 25;
              S.drops.push({
                x: S.p.x, y: S.p.y,
                vx: S.u.x * (0.55 + 0.55 * q) + 0.5 * Math.sin(i * 2.4),
                vy: S.u.y * 0.6 + 0.9 * Math.cos(i * 1.7),
                alive: true,
              });
            }
          }
          tw.run(0.75, function (k) { S.hang.a = start * (1 - K.ease(k)); }).then(function () {
            if (S.payload !== 'bucket') {
              finish('נפל. בלי המהירות √(gR) בפסגה, החוט לא עוזר.', 'thinking');
            }
          });
        }
      }
      if (S.drops.length) {
        const ground = -1.22 * S.R;
        const cat = { x: -0.62 * S.R, top: -0.06 * S.R, half: 0.4 * S.R };
        let alive = 0;
        S.drops.forEach(function (d) {
          if (!d.alive) return;
          d.vy -= G * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y <= cat.top && Math.abs(d.x - cat.x) <= cat.half) {
            if (!S.wet) { S.wet = true; S.pose = 'dizzy'; S.caption = 'רטוב! ניוטון שונא את הפיזיקה הזאת.'; }
            d.alive = false;
          } else if (d.y <= ground) {
            d.alive = false;
          } else {
            alive++;
          }
        });
        if (!alive && S.phase === 'caught') {
          S.drops = [];
          finish(S.wet ? 'רטוב! אנרגיה ל-' + F.unit(Math.sqrt(S.vb * S.vb - 4 * G * S.R), 'ms', 1) + ' בפסגה לא מספיקה.' : 'המים נשפכו ליד ניוטון. הפעם ניצל.', 'dizzy');
        }
      }
    }

    function loadPos() {
      if (S.phase === 'slack') return { x: S.p.x, y: S.p.y };
      if (S.hang) return { x: S.R * Math.sin(S.hang.a), y: -S.R * Math.cos(S.hang.a) };
      return { x: S.R * Math.sin(S.phi), y: -S.R * Math.cos(S.phi) };
    }

    function drawPlot() {
      const P = S.plot;
      const H2 = PHY.ch02;
      const tBot = tensionAt(0);
      const yMax = Math.max(20, H2.niceRange(0, Math.max(tBot, S.tMax) * 1.05, 10).max);
      const plot = H2.Plot(view, { tMin: 0, tMax: 360, yMin: 0, yMax: yMax, tLabel: '', title: 'מתיחות החוט, T (ניוטון)', titleColor: 'force', noTicks: true, tTick: 90, yTick: yMax / 2 });
      plot.box(P.x, P.y, P.w, P.h - 18);
      plot.frame();
      const r = plot.r;
      view.screenText(r.x - 5, plot.Y(yMax), F.num(yMax, 0), { size: 10.5, color: C.soft, align: 'right' });
      view.screenText(r.x - 5, plot.Y(yMax / 2), F.num(yMax / 2, 0), { size: 10.5, color: C.soft, align: 'right' });
      view.screenText(r.x - 5, plot.Y(0), '0', { size: 10.5, color: C.soft, align: 'right' });
      [[0, 'למטה'], [180, 'למעלה'], [360, 'למטה']].forEach(function (q) {
        view.screenText(plot.X(q[0]), r.y + r.h + 12, q[1], { size: 11, weight: 600, color: C.soft, align: q[0] === 0 ? 'left' : q[0] === 360 ? 'right' : 'center' });
      });
      if (S.trace.length > 1) plot.curve(S.trace, { color: C.force, width: 3 });
      if (S.phase === 'circle' && S.phi <= 2 * Math.PI) plot.dot(S.phi / RAD, S.T, { color: C.force });
    }

    function render() {
      const small = view.w < 420;
      const R = S.R;
      view.clear();
      const ground = -1.22 * R;
      const r = view.visible;
      view.poly([{ x: r.xMin, y: ground }, { x: r.xMax, y: ground }, { x: r.xMax, y: ground - 0.14 * R }, { x: r.xMin, y: ground - 0.14 * R }], { fill: C.shade, close: true });
      view.line(r.xMin, ground, r.xMax, ground, { color: C.axis, width: 2.5 });
      view.circle(0, 0, R, { color: C.gridStrong, width: 2, dash: [5, 6] });

      /* Newton stands left of the hand, right under the left half of the circle. */
      const catPx = 1.2 * R * view.scale;
      const catX = -0.62 * R;
      PHY.mascot.draw(view, catX, ground, { pose: S.pose, px: catPx });
      if (S.wet) {
        for (let i = 0; i < 6; i++) view.circle(catX + (i - 2.5) * 0.12 * R, ground + (0.92 + (i % 2) * 0.09) * R, 3, { px: true, fill: K.WATER });
      }
      /* the arm and the hand */
      view.line(catX + 0.26 * R, ground + 0.72 * R, 0, 0, { color: C.accent, width: small ? 5 : 6.5 });
      view.circle(0, 0, 5, { px: true, fill: C.ink });

      const q = loadPos();
      const slackNow = S.phase === 'slack';
      if (slackNow) {
        /* a slack string: a soft curve, not a straight line */
        const mx = q.x * 0.5 + q.y * 0.18, my = q.y * 0.5 - Math.abs(q.x) * 0.22;
        view.poly([{ x: 0, y: 0 }, { x: mx, y: my }, q], { color: C.soft, width: 1.8 });
      } else {
        view.line(0, 0, q.x, q.y, { color: C.ink, width: 2 });
      }
      if (S.slack) {
        const a = S.slack.deg * RAD;
        const sx = R * Math.sin(a), sy = -R * Math.cos(a);
        view.circle(sx, sy, 5, { px: true, color: C.bad, width: 2.5 });
        view.text(sx, sy, 'T = 0', { size: 12, weight: 800, color: C.bad, halo: true, offset: [26, -10] });
      }

      const towardCenter = Math.atan2(-q.y, -q.x) / RAD;
      if (S.payload === 'bucket') {
        K.bucket(view, q.x, q.y, towardCenter, { size: small ? 28 : 34, full: S.spilled ? 0 : 1 });
      } else {
        K.apple(view, q.x, q.y, small ? 18 : 22);
      }

      S.drops.forEach(function (d) {
        if (d.alive) view.circle(d.x, d.y, 3, { px: true, fill: K.WATER });
      });

      /* arrows while it is on the circle */
      if (S.phase === 'circle' || S.phase === 'ready') {
        const d = Math.hypot(q.x, q.y) || 1;
        const ux = -q.x / d, uy = -q.y / d;
        const T = S.phase === 'ready' ? tensionAt(0) : S.T;
        const lenT = (T / 60) * R;
        if (lenT > 0.02 * R) {
          view.arrow(q.x, q.y, q.x + ux * lenT, q.y + uy * lenT, { color: C.force, width: 4 });
          K.tipLabel(view, q.x, q.y, q.x + ux * lenT, q.y + uy * lenT, 'T', { color: C.force });
        }
        const lenG = ((S.m * G) / 60) * R;
        view.arrow(q.x + 20 / view.scale, q.y, q.x + 20 / view.scale, q.y - lenG, { color: C.force, width: 3, alpha: 0.7 });
        view.text(q.x + 20 / view.scale, q.y - lenG, 'mg', { size: 12, weight: 700, color: C.force, halo: true, offset: [0, 10] });
        const v = S.phase === 'ready' ? S.vb : S.v;
        const tx = Math.cos(S.phi), ty = Math.sin(S.phi);
        const vx = q.x + tx * v * 0.09 * R, vy = q.y + ty * v * 0.09 * R;
        view.arrow(q.x, q.y, vx, vy, { color: C.velocity, width: 3.5 });
        K.tipLabel(view, q.x, q.y, vx, vy, 'v', { color: C.velocity });
      }
      drawPlot();
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 13.5, weight: 700, pill: true });
      out.set('v', F.unit(S.phase === 'slack' ? Math.hypot(S.u.x, S.u.y) : S.phase === 'ready' ? S.vb : S.v, 'ms', 1));
      out.set('T', F.unit(S.phase === 'slack' || S.phase === 'caught' ? 0 : S.T, 'N', 1));
      out.set('vm', S.locked && !S.revealed ? '?' : F.unit(Math.sqrt(G * R), 'ms', 2));
    }

    const loop = PHY.SimLoop({ view, step, render });
    view.onResize(layout);
    layout();
    S.v = S.vb;
    S.T = tensionAt(0);

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: idle,
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'vTop') { sV.set(v); setVTop(v); idle(); }
        if (name === 'R') { const vt = sV.value; S.R = v; sR.set(v); setVTop(vt); layout(); idle(); }
        if (name === 'm') { S.m = v; idle(); }
      },
      getState() {
        return {
          phase: S.phase, phi: S.phi / RAD, v: S.v, T: S.T, R: S.R, m: S.m, vBottom: S.vb, vMin: Math.sqrt(G * S.R), vTop: S.topSpeed,
          tTop: S.tTop, tBottom: S.tBottom, tMax: S.tMax, tMin: S.tMin, slack: S.slack, wet: S.wet, spilled: S.spilled,
        };
      },
      play(o) {
        o = o || {};
        idle();
        if (o.vBottom !== undefined) {
          S.vb = o.vBottom;
          sV.set(Math.round(Math.sqrt(Math.max(0, S.vb * S.vb - 4 * G * S.R)) * 10) / 10);
        } else if (o.vTop !== undefined) {
          setVTop(o.vTop);
          sV.set(o.vTop);
        }
        if (o.m !== undefined) S.m = o.m;
        S.revs = o.revs || 2;
        S.v = S.vb;
        S.phase = 'circle';
        S.caption = o.label || (S.payload === 'bucket' ? 'מסובבים. נראה מה יקרה למעלה.' : 'יוצאים מלמטה ב-' + F.unit(S.vb, 'ms', 1));
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      pause(seconds) { return tw.run(seconds, null); },
      advance(seconds) { for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120); },
    };
    setLocked(S.locked);
    return api;
  };
})();

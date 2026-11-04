/* PHY.sims.cradle: Newton's cradle with five balls of 0.1 kg on 1 m strings. The pulled group swings on the real
   pendulum equation. When it reaches the bottom, the velocities pass along the row, as they do between equal
   elastic balls, so the same number leaves on the far side at the same speed.
   Default pull 36.87 degrees: the ball drops 0.2 m and reaches 2 m/s at the bottom.
   The panel compares what went in, what came out, and the imagined "one ball at double speed".
   opts: {n, pull, locked}. sim.play({n}) -> Promise. setParam: n, locked. A ball can also be dragged when unlocked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU, JU = K.JU;
  const L = 1, G = 10, M = 0.1, R = 0.1, N = 5;
  const RAD = Math.PI / 180;

  PHY.sims.cradle = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ n: 2, pull: 36.87, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1.7, xMax: 1.7, yMin: -2.15, yMax: 0.34 }, aspect: 1.5, minHeight: 340, maxHeight: 460 });
    const S = {
      n: opts.n, pull: opts.pull, theta: 0, omega: 0, side: -1, phase: 'rest', pullT: 0, impacts: 0, target: 3,
      vIn: 0, vOut: 0, nOut: 0, caption: '', locked: opts.locked, showGhost: false, drag: null, resolve: null, age: 0,
    };

    const row = U.h('div', { class: 'sim-row' });
    row.appendChild(U.h('span', { class: 'small', text: 'כמה כדורים למשוך?' }));
    const nBtns = [1, 2, 3, 4].map(function (k) {
      return U.Button(row, String(k), function () { if (!S.locked) launch({ n: k }); }, { class: k === S.n ? 'btn-primary' : '' });
    });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'in', label: 'נכנסים' },
      { key: 'out', label: 'יוצאים' },
      { key: 'v', label: 'מהירות בתחתית', color: 'var(--c-velocity)' },
    ]);
    function setLocked(v) {
      S.locked = v;
      nBtns.forEach(function (b) { b.disabled = v; });
    }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function paintBtns() {
      nBtns.forEach(function (b, i) { b.classList.toggle('btn-primary', i + 1 === S.n); });
    }

    function pivot(i) { return (i - (N - 1) / 2) * 2 * R; }
    /* Which balls swing right now: the leftmost n when the angle is negative, the rightmost n when positive. */
    function moving(i, theta) { return theta < 0 ? i < S.n : i >= N - S.n; }
    function ballPos(i) {
      const a = moving(i, S.theta) ? S.theta : 0;
      return { x: pivot(i) + L * Math.sin(a), y: -L * Math.cos(a) };
    }

    function launch(o) {
      o = o || {};
      settle();
      S.n = o.n || S.n;
      paintBtns();
      S.side = -1;
      S.theta = 0;
      S.omega = 0;
      S.pull = o.pull || opts.pull;
      S.phase = 'pull';
      S.pullT = 0;
      S.impacts = 0;
      S.vIn = 0;
      S.vOut = 0;
      S.nOut = 0;
      S.showGhost = false;
      S.age = 0;
      S.caption = S.n === 1 ? 'מושכים כדור אחד' : 'מושכים ' + S.n + ' כדורים';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }

    /* Starts swinging from wherever the drag or the pull left it. */
    function release() {
      S.phase = 'swing';
      S.omega = 0;
      S.caption = '';
    }

    function step(dt) {
      if (S.phase === 'pull') {
        S.pullT += dt / 0.55;
        const k = Math.min(1, S.pullT);
        S.theta = -S.pull * RAD * (1 - (1 - k) * (1 - k));
        if (k >= 1) release();
        return;
      }
      if (S.phase !== 'swing' && S.phase !== 'fade') return;
      const h = dt * 0.8;
      const prev = S.theta;
      S.omega += (-(G / L) * Math.sin(S.theta)) * h;
      if (S.phase === 'fade') S.omega *= Math.exp(-0.9 * h);
      S.theta += S.omega * h;
      S.age += h;
      if ((prev < 0 && S.theta >= 0) || (prev > 0 && S.theta <= 0)) {
        /* Impact at the bottom. */
        S.impacts++;
        const speed = Math.abs(S.omega) * L;
        if (S.impacts === 1) {
          S.vIn = speed;
          S.vOut = speed;
          S.nOut = S.n;
          S.caption = S.n + (S.n === 1 ? ' נכנס, ' : ' נכנסים, ') + S.n + (S.n === 1 ? ' יוצא' : ' יוצאים');
        }
        if (S.phase === 'swing' && S.impacts >= S.target) {
          S.phase = 'fade';
          S.showGhost = true;
          settle();
        }
      }
      if (S.phase === 'fade' && Math.abs(S.omega) < 0.02 && Math.abs(S.theta) < 0.01) {
        S.phase = 'rest';
        S.theta = 0;
        S.omega = 0;
      }
    }

    function render() {
      view.clear();
      const W = view.w;
      const small = W < 420;
      /* Frame */
      const topY = 0.05;
      const fx = pivot(N - 1) + 0.42;
      view.line(-fx, topY, fx, topY, { color: C.axis, width: 6 });
      view.line(-fx, topY, -fx, -L - R - 0.06, { color: C.axis, width: 5 });
      view.line(fx, topY, fx, -L - R - 0.06, { color: C.axis, width: 5 });
      view.line(-fx - 0.12, -L - R - 0.06, fx + 0.12, -L - R - 0.06, { color: C.axis, width: 7 });
      /* Balls */
      for (let i = 0; i < N; i++) {
        const b = ballPos(i);
        view.line(pivot(i), topY, b.x, b.y, { color: C.soft, width: 1.6 });
      }
      for (let i = 0; i < N; i++) {
        const b = ballPos(i);
        const isMoving = S.theta !== 0 && moving(i, S.theta);
        view.circle(b.x, b.y, R * 0.985, { fill: isMoving ? C.accent : C.gridStrong, color: C.ink, width: 2 });
      }
      /* The cat watches, hypnotized, from the side of the base. */
      PHY.mascot.draw(view, 1.42, -L - R - 0.06, { pose: S.phase === 'rest' ? 'thinking' : 'dizzy', px: small ? 46 : 62 });

      /* A velocity-colored p arrow on the moving group near the bottom */
      if (S.phase === 'swing' || S.phase === 'fade') {
        const sp = S.omega * L;
        if (Math.abs(sp) > 0.25) {
          const i0 = S.theta < 0 ? S.n - 1 : N - 1;
          const b = ballPos(S.theta < 0 ? 0 : N - 1);
          const dir = Math.sign(sp);
          view.arrow(b.x + (i0 * 0), b.y + R + 0.12, b.x + dir * Math.abs(sp) * 0.14 * S.n, b.y + R + 0.12, { color: C.velocity, width: 3.6, label: 'p', labelSide: dir > 0 ? 1 : -1, labelGap: 11 });
        }
      }

      /* Panel: what went in, what came out, and the impossible one. */
      const panelTop = view.sy(-L - R - 0.06) + 12;
      panel(panelTop);
      K.caption(view, S.caption, 16);

      out.set('in', S.vIn ? S.n + ' ב-' + F.unit(S.vIn, 'ms', 1) : '...');
      out.set('out', S.vOut ? S.nOut + ' ב-' + F.unit(S.vOut, 'ms', 1) : '...');
      out.set('v', S.vIn ? F.unit(S.vIn, 'ms', 2) : '...');
    }

    function panel(top) {
      const W = view.w, H = view.h;
      const pad = 10, nameW = W < 420 ? 110 : 150;
      const colW = (W - pad * 2 - nameW - 12) / 2;
      const rh = Math.max(16, Math.min(22, (H - top - 22) / 3 - 3));
      const v = S.vIn || 0;
      const n = S.n;
      const pIn = n * M * v, eIn = 0.5 * n * M * v * v;
      const pG = M * (n * v), eG = 0.5 * M * (n * v) * (n * v);
      const pMaxBar = Math.max(pIn, 1e-6), eMaxBar = Math.max(eG, 1e-6);
      const xE = pad, xP = pad + colW + 12;
      view.screenText(xP + colW / 2, top + 6, 'תנע (' + PU + ')', { size: 11, weight: 700, color: C.velocity });
      view.screenText(xE + colW / 2, top + 6, 'אנרגיה (' + JU + ')', { size: 11, weight: 700, color: C.accent });
      let y = top + 15;
      const rows = [
        { name: n + (n === 1 ? ' נכנס' : ' נכנסים'), p: pIn, e: eIn, on: S.vIn > 0 },
        /* How many come out is what the card asks, so it stays "?" until the first impact. */
        { name: S.vOut > 0 ? n + (n === 1 ? ' יוצא' : ' יוצאים') : '? יוצאים', p: pIn, e: eIn, on: S.vOut > 0 },
      ];
      if (n > 1 && S.showGhost) rows.push({ name: 'דמיון: 1 ב-' + F.unit(n * v, 'ms', 0), p: pG, e: eG, on: S.showGhost, ghost: true });
      rows.forEach(function (r) {
        K.bar(view, xP, y + 1, colW, rh - 3, C.grid);
        K.bar(view, xE, y + 1, colW, rh - 3, C.grid);
        if (r.on) {
          K.bar(view, xP, y + 1, (r.p / pMaxBar) * colW, rh - 3, C.velocity, r.ghost ? 0.55 : 1);
          K.bar(view, xE, y + 1, (r.e / eMaxBar) * colW, rh - 3, r.ghost ? C.bad : C.accent, r.ghost ? 0.75 : 1);
          view.screenText(xP + 5, y + rh / 2 - 1, F.num(r.p, 2), { size: 10.5, weight: 700, align: 'left', color: C.surface });
          view.screenText(xE + 5, y + rh / 2 - 1, F.num(r.e, 2), { size: 10.5, weight: 700, align: 'left', color: C.surface });
        }
        view.screenText(W - pad, y + rh / 2 - 1, r.name, { size: 11, weight: 600, align: 'right', color: r.ghost ? C.bad : C.ink });
        y += rh;
      });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* Dragging a ball pulls it and everything on its outer side. */
    view.drag({
      hit(p) {
        if (S.locked || S.phase === 'pull' || S.phase === 'swing') return null;
        for (let i = 0; i < 4; i++) {
          const b = ballPos(i);
          if (view.pxDist(p, b) < 30) return { i: i };
        }
        return null;
      },
      start(h) {
        settle();
        S.n = h.i + 1;
        paintBtns();
        S.phase = 'drag';
        S.impacts = 0;
        S.vIn = 0;
        S.vOut = 0;
        S.showGhost = false;
        S.caption = '';
        S.omega = 0;
      },
      move(h, p) {
        const a = Math.atan2(p.x - pivot(0), -p.y);
        S.theta = Math.max(-65 * RAD, Math.min(-6 * RAD, a));
      },
      end() {
        if (S.phase === 'drag') { S.pull = -S.theta / RAD; release(); }
      },
    });

    setLocked(opts.locked);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { settle(); S.phase = 'rest'; S.theta = 0; S.omega = 0; S.vIn = 0; S.vOut = 0; S.showGhost = false; S.caption = ''; loop.requestRender(); },
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'n') { S.n = v; paintBtns(); loop.requestRender(); }
      },
      getState() {
        const n = S.nOut || S.n;
        return { phase: S.phase, n: S.n, nOut: S.nOut, vIn: S.vIn, vOut: S.vOut, impacts: S.impacts, pIn: S.n * M * S.vIn, pOut: n * M * S.vOut, keIn: 0.5 * S.n * M * S.vIn * S.vIn, keOut: 0.5 * n * M * S.vOut * S.vOut, keGhost: 0.5 * M * Math.pow(S.n * S.vIn, 2) };
      },
      play(o) { return launch(o); },
    };
  };
})();

/* PHY.sims.fishCut: the trap "balanced means equal masses". A fish balances on a wedge, is cut exactly at
   the balance point, and the two pieces go on a pan balance. The profile is integrated numerically:
   the center of mass and both masses come from the shape. The balance then tilts by the real torque.
   sim.play() -> Promise. getState(): balance point, masses, the arms of each piece, and the tilt. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  /* Half height of the fish at x, head at x = 0. */
  const PROFILE = [[0, 0], [0.06, 0.2], [0.2, 0.42], [0.42, 0.52], [0.7, 0.46], [1.05, 0.24], [1.5, 0.08], [2.1, 0.04], [2.26, 0.07], [2.42, 0.3], [2.48, 0.33]];
  const LEN = 2.48;
  function rawHalf(x) {
    if (x <= 0 || x >= LEN) return 0;
    for (let i = 1; i < PROFILE.length; i++) {
      if (x <= PROFILE[i][0]) {
        const a = PROFILE[i - 1], b = PROFILE[i];
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      }
    }
    return 0;
  }
  /* The outline, smoothed a little so that the fish looks like a fish. */
  const TABLE = (function () {
    const t = [];
    for (let i = 0; i <= 800; i++) {
      const x = (LEN * i) / 800;
      let sum = 0, n = 0;
      for (let k = -8; k <= 8; k++) { const q = x + k * 0.008; if (q >= 0 && q <= LEN) { sum += rawHalf(q); n++; } }
      t.push(sum / n);
    }
    t[0] = 0;
    return t;
  })();
  function half(x) {
    const f = Math.max(0, Math.min(800, (x / LEN) * 800));
    const i = Math.min(799, Math.floor(f));
    return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (f - i);
  }
  const MASS = 2;
  const DATA = (function () {
    const n = 2400, dx = LEN / n;
    let area = 0, mom = 0;
    for (let i = 0; i < n; i++) { const x = (i + 0.5) * dx, w = 2 * half(x); area += w * dx; mom += w * x * dx; }
    const cut = mom / area;
    let aH = 0, mH = 0, aT = 0, mT = 0;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * dx, w = 2 * half(x);
      if (x < cut) { aH += w * dx; mH += w * x * dx; } else { aT += w * dx; mT += w * x * dx; }
    }
    return {
      cut: cut, mHead: (MASS * aH) / area, mTail: (MASS * aT) / area,
      dHead: cut - mH / aH, dTail: mT / aT - cut,
    };
  })();

  PHY.sims.fishCut = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -2.6, xMax: 2.6, yMin: -0.2, yMax: 2.75 }, aspect: 1.65, minHeight: 260, maxHeight: 440,
    });
    const tw = B.tweens();
    const REST = { y: 1.72, k: 1 };
    const S = {
      wob: 0, gap: 0, cutLine: 0, k: 1, stage: 0, tilt: 0, om: 0, showPans: 0,
      head: { x: 0, y: REST.y }, tail: { x: 0, y: REST.y }, caption: '', pose: 'thinking', resolve: null, balancing: false,
    };
    const PAN = { arm: 1.35, cy: 1.42, drop: 0.72 };

    function fresh() {
      tw.clear();
      S.wob = 0; S.gap = 0; S.cutLine = 0; S.k = 1; S.stage = 0; S.tilt = 0; S.om = 0; S.showPans = 0;
      S.head = { x: 0, y: REST.y }; S.tail = { x: 0, y: REST.y };
      S.caption = ''; S.pose = 'thinking'; S.balancing = false;
    }
    function panPoint(side) {
      /* side -1: left pan, +1: right pan */
      const a = S.tilt * RAD;
      return { x: side * PAN.arm * Math.cos(a), y: PAN.cy + side * PAN.arm * Math.sin(a) - PAN.drop };
    }
    function step(dt) {
      tw.step(dt);
      if (S.balancing) {
        /* The same law as the seesaw: head on the left, tail on the right. */
        const a = S.tilt * RAD, e = 0.12;
        const moment = (DATA.mTail - DATA.mHead) * PAN.arm;
        const I = (DATA.mHead + DATA.mTail) * PAN.arm * PAN.arm;
        const tau = -G * moment * Math.cos(a) - G * e * MASS * Math.sin(a);
        const c = 2 * 0.65 * Math.sqrt((G * e * MASS) / I);
        S.om += (tau / I - c * S.om) * dt;
        S.tilt += (S.om * dt) / RAD;
        if (S.tilt > 16) { S.tilt = 16; S.om = 0; }
      }
    }
    async function play() {
      fresh();
      /* It wobbles on the wedge, and stays. */
      await tw.add(1.1, function (k) { S.wob = 4 * Math.sin(k * Math.PI * 4) * (1 - k); });
      S.wob = 0;
      S.caption = 'מאוזן. עכשיו חותכים בדיוק מעל התומך.';
      await tw.add(0.7, function (k) { S.cutLine = k; });
      await tw.add(0.4, function (k) { S.gap = 0.14 * k; });
      S.stage = 1;
      S.caption = '';
      const headFrom = { x: 0, y: REST.y }, tailFrom = { x: 0, y: REST.y };
      await tw.add(1.1, function (k) {
        const e = k * k * (3 - 2 * k);
        S.k = 1 - 0.42 * e;
        S.showPans = e;
        const L = panPoint(-1), R = panPoint(1);
        S.head = { x: headFrom.x + (L.x - headFrom.x) * e, y: headFrom.y + (L.y - headFrom.y) * e };
        S.tail = { x: tailFrom.x + (R.x - tailFrom.x) * e, y: tailFrom.y + (R.y - tailFrom.y) * e };
      });
      S.stage = 2;
      S.balancing = true;
      await tw.add(2.2, null);
      S.pose = 'happy';
      S.caption = 'הראש כבד יותר. והחתול כבר יודע איזה חלק שלו.';
      await tw.add(0.5, null);
    }

    /* A piece of the fish, x0..x1 along it, drawn so that the cut point sits at (ax, ay). */
    function drawPiece(x0, x1, ax, ay, k, deg, withEye) {
      const ctx = view.ctx, s = view.scale * k;
      ctx.save();
      ctx.translate(view.sx(ax), view.sy(ay));
      ctx.rotate((-deg * Math.PI) / 180);
      ctx.beginPath();
      const N = 80;
      for (let i = 0; i <= N; i++) {
        const x = x0 + ((x1 - x0) * i) / N;
        const px = (x - DATA.cut) * s, py = -half(x) * s;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      for (let i = N; i >= 0; i--) {
        const x = x0 + ((x1 - x0) * i) / N;
        ctx.lineTo((x - DATA.cut) * s, half(x) * s);
      }
      ctx.closePath();
      ctx.fillStyle = C.gold;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.stroke();
      if (withEye) {
        ctx.beginPath();
        ctx.arc((0.28 - DATA.cut) * s, -0.14 * s, Math.max(2.5, 0.055 * s), 0, Math.PI * 2);
        ctx.fillStyle = C.surface;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc((0.29 - DATA.cut) * s, -0.14 * s, Math.max(1.2, 0.024 * s), 0, Math.PI * 2);
        ctx.fillStyle = C.ink;
        ctx.fill();
        /* gill */
        ctx.beginPath();
        ctx.arc((0.28 - DATA.cut) * s, 0, 0.3 * s, -0.75, 0.75);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();
    }

    function render() {
      const small = view.w < 520;
      view.clear();
      view.grid(0.5, {});
      B.drawGround(view, 0, {});
      const size = small ? 11.5 : 13.5;

      if (S.stage === 0) {
        /* stand and wedge */
        view.line(0, 0, 0, REST.y - half(DATA.cut) - (small ? 21 : 29) / view.scale, { color: C.axis, width: small ? 6 : 8, cap: 'butt' });
        St.wedge(view, 0, REST.y - half(DATA.cut), small ? 34 : 46, small ? 22 : 30, {});
        drawPiece(0, DATA.cut, -S.gap / 2, REST.y + Math.sin(S.wob * RAD) * 0, 1, S.wob, true);
        drawPiece(DATA.cut, LEN, S.gap / 2, REST.y, 1, S.wob, false);
        if (S.cutLine > 0) {
          view.line(0, REST.y + 0.6, 0, REST.y + 0.6 - 1.2 * S.cutLine, { color: C.bad, width: 2.4, dash: [6, 5] });
        }
      } else {
        /* the balance */
        const a = S.tilt * RAD;
        const A = S.showPans;
        const L = { x: -PAN.arm * Math.cos(a), y: PAN.cy - PAN.arm * Math.sin(a) };
        const R = { x: PAN.arm * Math.cos(a), y: PAN.cy + PAN.arm * Math.sin(a) };
        view.line(0, 0, 0, PAN.cy, { color: C.axis, width: small ? 6 : 8, cap: 'butt' });
        St.plank(view, L.x, L.y, R.x, R.y, small ? 6 : 8, { fill: C.accent, alpha: A });
        view.circle(0, PAN.cy, small ? 5 : 6.5, { px: true, fill: C.surface, color: C.ink, width: 2 });
        [[L, -1], [R, 1]].forEach(function (pair) {
          const p = pair[0];
          view.line(p.x, p.y, p.x, p.y - PAN.drop, { color: C.ink, width: 1.6, alpha: A });
          view.line(p.x - 0.62, p.y - PAN.drop, p.x + 0.62, p.y - PAN.drop, { color: C.ink, width: 3.4, alpha: A });
        });
        const headP = S.stage === 2 ? { x: L.x, y: L.y - PAN.drop } : S.head;
        const tailP = S.stage === 2 ? { x: R.x, y: R.y - PAN.drop } : S.tail;
        drawPiece(0, DATA.cut, headP.x + 0.26, headP.y + 0.31, S.k, 0, true);
        drawPiece(DATA.cut, LEN, tailP.x - 0.46, tailP.y + 0.21, S.k, 0, false);
        if (S.stage === 2) {
          view.text(headP.x, headP.y, F.unit(DATA.mHead, 'kg', 2), { size: size, weight: 800, color: C.ink, halo: true, offset: [0, small ? 15 : 18] });
          view.text(tailP.x, tailP.y, F.unit(DATA.mTail, 'kg', 2), { size: size, weight: 800, color: C.ink, halo: true, offset: [0, small ? 15 : 18] });
        }
      }

      PHY.mascot.draw(view, view.visible.xMax - 0.42, 0, { pose: S.pose, px: small ? 54 : 74 });
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: small ? 11.5 : 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { fresh(); loop.requestRender(); },
      play,
      setParam() {},
      getState() {
        return {
          cut: DATA.cut, mHead: DATA.mHead, mTail: DATA.mTail, dHead: DATA.dHead, dTail: DATA.dTail,
          tilt: S.tilt, stage: S.stage, torqueHead: DATA.mHead * G * DATA.dHead, torqueTail: DATA.mTail * G * DATA.dTail,
        };
      },
    };
  };
})();

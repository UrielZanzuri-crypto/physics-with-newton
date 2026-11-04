/* PHY.sims.hangShape: hang a flat shape from a pin. It swings and settles with its center of mass under the pin.
   After each settling, the plumb line is recorded in the shape's own frame, so it rotates along with the
   shape at the next pin. The crossing of the recorded lines is measured from those lines, not from a formula.
   Shapes: L, ring, triangle. opts: {shape, locked}. sim.play() hangs from two pins and marks the crossing.
   sim.hang(i) -> Promise for one pin. setParam: shape, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  const inPoly = function (poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const LP = [{ x: 0, y: 0 }, { x: 1.7, y: 0 }, { x: 1.7, y: 0.32 }, { x: 0.32, y: 0.32 }, { x: 0.32, y: 1.7 }, { x: 0, y: 1.7 }];
  const TRI = [{ x: 0, y: 0 }, { x: 1.9, y: 0 }, { x: 0, y: 1.5 }];
  const SHAPES = {
    L: {
      name: 'L', poly: LP,
      inside: (x, y) => inPoly(LP, x, y),
      box: { x0: 0, x1: 1.7, y0: 0, y1: 1.7 },
      pins: [{ x: 1.56, y: 0.16 }, { x: 0.16, y: 1.56 }, { x: 0.16, y: 0.16 }],
    },
    ring: {
      name: 'טבעת', R: 0.85, r: 0.62,
      inside: (x, y) => { const d = Math.hypot(x, y); return d <= 0.85 && d >= 0.62; },
      box: { x0: -0.85, x1: 0.85, y0: -0.85, y1: 0.85 },
      pins: [{ x: 0, y: 0.735 }, { x: 0.6365, y: -0.3675 }, { x: -0.6365, y: -0.3675 }],
    },
    triangle: {
      name: 'משולש', poly: TRI,
      inside: (x, y) => inPoly(TRI, x, y),
      box: { x0: 0, x1: 1.9, y0: 0, y1: 1.5 },
      pins: [{ x: 1.62, y: 0.1 }, { x: 0.1, y: 1.26 }, { x: 0.12, y: 0.1 }],
    },
  };
  Object.keys(SHAPES).forEach(function (k) {
    const s = SHAPES[k];
    s.cm = St.sample(s.inside, s.box, 90);
    s.solidAtCm = s.inside(s.cm.cx, s.cm.cy);
  });

  PHY.sims.hangShape = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({ shape: 'L', locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -2.25, xMax: 2.25, yMin: -1.15, yMax: 1.75 }, aspect: 1.5, minHeight: 280, maxHeight: 460,
    });
    const PIN = { x: 0, y: 1.42 };
    const tw = B.tweens();
    const S = {
      key: o.shape, pin: 0, th: 0, om: 0, thEq: 0, pos: { x: 0, y: 1.42 }, lines: [], cross: null,
      phase: 'idle', settle: null, caption: '', locked: o.locked, pose: 'thinking', resolve: null, showCm: false, hangId: 0,
    };
    const shape = () => SHAPES[S.key];

    function thEqFor(i) {
      const s = shape(), pin = s.pins[i];
      const ang = Math.atan2(s.cm.cy - pin.y, s.cm.cx - pin.x) / RAD;
      return -90 - ang;
    }
    /* Mean squared distance from the pin, kept once computed: it only depends on the shape and the pin. */
    function inertia(i) {
      const s = shape(), pin = s.pins[i];
      s.k2 = s.k2 || [];
      if (s.k2[i] === undefined) {
        let sum = 0;
        s.cm.pts.forEach(function (p) { sum += (p.x - pin.x) * (p.x - pin.x) + (p.y - pin.y) * (p.y - pin.y); });
        s.k2[i] = sum / s.cm.pts.length;
      }
      return s.k2[i];
    }
    /* Shape frame to world. */
    function W(p) {
      const s = shape(), pin = s.pins[S.pin];
      const a = S.th * RAD, c = Math.cos(a), sn = Math.sin(a);
      const dx = p.x - pin.x, dy = p.y - pin.y;
      return { x: S.pos.x + dx * c - dy * sn, y: S.pos.y + dx * sn + dy * c };
    }
    /* World to shape frame. */
    function Inv(p) {
      const s = shape(), pin = s.pins[S.pin];
      const a = -S.th * RAD, c = Math.cos(a), sn = Math.sin(a);
      const dx = p.x - S.pos.x, dy = p.y - S.pos.y;
      return { x: pin.x + dx * c - dy * sn, y: pin.y + dx * sn + dy * c };
    }

    function recordLine() {
      const a = Inv({ x: S.pos.x, y: S.pos.y });
      const b = Inv({ x: S.pos.x, y: S.pos.y - 1 });
      S.lines.push({ a: a, b: b, pin: S.pin });
      if (S.lines.length >= 2) {
        const l0 = S.lines[S.lines.length - 2], l1 = S.lines[S.lines.length - 1];
        const d0 = { x: l0.b.x - l0.a.x, y: l0.b.y - l0.a.y }, d1 = { x: l1.b.x - l1.a.x, y: l1.b.y - l1.a.y };
        const den = d0.x * d1.y - d0.y * d1.x;
        if (Math.abs(den) > 1e-6) {
          const t = ((l1.a.x - l0.a.x) * d1.y - (l1.a.y - l0.a.y) * d1.x) / den;
          S.cross = { x: l0.a.x + t * d0.x, y: l0.a.y + t * d0.y };
        }
      }
    }

    /* Rehang from pin i, keeping the shape where it is for a moment, then let it swing. */
    function hang(i, kick) {
      return new Promise(function (resolve) {
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        const id = ++S.hangId;
        tw.clear();
        S.resolve = resolve;
        const old = W(shape().pins[i]);
        const th = S.th;
        S.pin = i;
        S.th = th;
        S.pos = old;
        S.om = 0;
        S.phase = 'move';
        const from = { x: old.x, y: old.y };
        tw.add(0.5, function (k) {
          S.pos = { x: from.x + (PIN.x - from.x) * k, y: from.y + (PIN.y - from.y) * k };
          S.th = th + (kick || 0) * k;
        }).then(function () {
          if (id !== S.hangId) return;
          S.pos = { x: PIN.x, y: PIN.y };
          S.thEq = thEqFor(i);
          /* Take the short way round. */
          while (S.th - S.thEq > 180) S.th -= 360;
          while (S.th - S.thEq < -180) S.th += 360;
          S.phase = 'swing';
          S.settle = { calm: 0, left: 5 };
        });
      });
    }

    function step(dt) {
      tw.step(dt);
      if (S.phase !== 'swing') return;
      const s = shape(), pin = s.pins[S.pin];
      const d = Math.hypot(s.cm.cx - pin.x, s.cm.cy - pin.y);
      const k2 = inertia(S.pin);
      const w02 = (G * d) / k2;
      const c = 2 * 0.62 * Math.sqrt(w02);
      const alpha = -w02 * Math.sin((S.th - S.thEq) * RAD) - c * S.om;
      S.om += alpha * dt;
      S.th += (S.om * dt) / RAD;
      S.settle.left -= dt;
      if (Math.abs(S.th - S.thEq) < 0.4 && Math.abs(S.om) < 0.03) S.settle.calm += dt;
      if (S.settle.calm > 0.08 || S.settle.left <= 0) {
        recordLine();
        S.om = 0;
        S.phase = 'idle';
        const r = S.resolve;
        S.resolve = null;
        if (r) r();
      }
    }

    function fresh() {
      S.hangId++;
      tw.clear();
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.lines = []; S.cross = null; S.caption = ''; S.showCm = false; S.pose = 'thinking';
      S.pin = 0; S.pos = { x: PIN.x, y: PIN.y }; S.om = 0;
      S.thEq = thEqFor(0);
      S.th = S.thEq;
      S.phase = 'idle';
    }

    async function play() {
      fresh();
      const was = S.locked;
      setLocked(true);
      S.pose = 'thinking';
      await hang(0, 42);
      await tw.add(0.35, null);
      await hang(1);
      await tw.add(0.25, null);
      S.showCm = true;
      S.pose = 'happy';
      const s = shape();
      S.caption = s.solidAtCm ? 'הקווים נפגשים בתוך החומר.' : 'הקווים נפגשים באוויר. שם אין כלום!';
      await tw.add(0.5, null);
      setLocked(was);
    }

    function pathShape(s) {
      const ctx = view.ctx;
      ctx.beginPath();
      if (s.poly) {
        s.poly.forEach(function (p, i) {
          const q = W(p);
          if (i) ctx.lineTo(view.sx(q.x), view.sy(q.y));
          else ctx.moveTo(view.sx(q.x), view.sy(q.y));
        });
        ctx.closePath();
      } else {
        const c = W({ x: 0, y: 0 });
        ctx.arc(view.sx(c.x), view.sy(c.y), s.R * view.scale, 0, Math.PI * 2);
        ctx.moveTo(view.sx(c.x) + s.r * view.scale, view.sy(c.y));
        ctx.arc(view.sx(c.x), view.sy(c.y), s.r * view.scale, 0, Math.PI * 2, true);
      }
    }

    function render() {
      const small = view.w < 520;
      const s = shape(), ctx = view.ctx, r = view.visible;
      view.clear();
      view.grid(0.5, {});
      B.drawGround(view, -1.05, {});
      St.hatch(view, -1, 1.62, 1, 1.62, 0, 1, {});
      view.line(PIN.x, 1.62, PIN.x, PIN.y, { color: C.axis, width: 3 });

      /* the shape */
      ctx.save();
      pathShape(s);
      ctx.fillStyle = C.gold;
      ctx.globalAlpha = 0.85;
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      /* lines recorded so far, in the shape's frame */
      S.lines.forEach(function (l) {
        const a = W(l.a), bb = W(l.b);
        const dx = bb.x - a.x, dy = bb.y - a.y;
        view.line(a.x - dx * 4, a.y - dy * 4, a.x + dx * 4, a.y + dy * 4, { color: C.accent, width: 2.4, dash: [8, 6] });
      });

      /* pins */
      s.pins.forEach(function (p, i) {
        const q = W(p);
        view.circle(q.x, q.y, i === S.pin ? 6 : 5, { px: true, fill: i === S.pin ? C.ink : C.surface, color: C.ink, width: 2 });
      });

      /* the plumb line hanging from the pin */
      const bobY = -0.92;
      view.line(PIN.x, PIN.y, PIN.x, bobY, { color: C.ink, width: 1.6 });
      view.circle(PIN.x, bobY, small ? 6 : 8, { px: true, fill: C.soft, color: C.ink, width: 2 });

      /* the crossing */
      if (S.cross) {
        const q = W(S.cross);
        view.circle(q.x, q.y, small ? 7 : 9, { px: true, color: C.accent, width: 3, fill: C.surface });
        view.circle(q.x, q.y, 2.6, { px: true, fill: C.accent });
        if (S.showCm) {
          const len = (small ? 42 : 58) / view.scale;
          view.arrow(q.x, q.y, q.x, q.y - len, { color: C.force, width: 3.4, head: 12 });
          view.text(q.x, q.y - len, 'המשקל', { size: small ? 11 : 13, weight: 700, color: C.force, halo: true, offset: [0, 10] });
          view.text(q.x, q.y, 'מרכז הכובד', { size: small ? 11.5 : 13.5, weight: 800, color: C.accent, halo: true, offset: [q.x > 0.1 ? -(small ? 54 : 66) : (small ? 54 : 66), 0] });
        }
      }

      PHY.mascot.draw(view, r.xMax - 0.42, -1.05, { pose: S.pose, px: small ? 58 : 84 });
      if (S.caption) view.screenText(view.w * 0.45, view.h - 17, S.caption, { size: small ? 11.5 : 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* free play */
    const row1 = U.h('div', { class: 'sim-row' });
    const row2 = U.h('div', { class: 'sim-row' });
    controlsEl.appendChild(row1);
    controlsEl.appendChild(row2);
    const pinBtns = [0, 1, 2].map(function (i) {
      return U.Button(row1, 'תלייה מנקודה ' + (i + 1), function () { hang(i); }, {});
    });
    const shapeBtns = [['L', 'L'], ['ring', 'טבעת'], ['triangle', 'משולש']].map(function (p) {
      return U.Button(row2, p[1], function () { setShape(p[0]); hang(0); }, { ghost: true });
    });
    function setLocked(v) {
      S.locked = !!v;
      pinBtns.concat(shapeBtns).forEach(function (b) { b.disabled = S.locked; });
    }
    function setShape(k) {
      S.key = k;
      fresh();
      loop.requestRender();
    }
    setLocked(S.locked);
    fresh();

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { fresh(); loop.requestRender(); },
      play, hang,
      setParam(name, v) {
        if (name === 'locked') setLocked(v);
        if (name === 'shape') setShape(v);
        loop.requestRender();
      },
      getState() {
        const s = shape();
        return {
          shape: S.key, pin: S.pin, th: S.th, thEq: S.thEq, phase: S.phase, lines: S.lines.length, cross: S.cross,
          cm: { x: s.cm.cx, y: s.cm.cy }, solidAtCm: s.solidAtCm, crossSolid: S.cross ? s.inside(S.cross.x, S.cross.y) : null,
          cmBelowPin: W({ x: s.cm.cx, y: s.cm.cy }).x - S.pos.x,
        };
      },
    };
  };
})();

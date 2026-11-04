/* PHY.sims.beam: one rigid beam with loads, on one or two supports. It serves the hook, the seesaw,
   the two scales, the free pivot, and the playground.
   One support: the beam turns about it. Torque = -g cos(th) sum m(x - xp), plus a restoring term -g e M sin(th),
   as in a real balance whose pin sits a little above the beam line. e is small, so any imbalance tilts the beam
   until an end reaches the floor. An exact balance uses the larger eLevel, so the beam settles level soon.
   Two supports: the forces come from the balance conditions. If one would have to pull, the beam
   turns about the other support, for real.
   opts: {xA, xB, y0, mb, supports: [{x, kind}], items: [{id, m, x, kind, label, drag}], locked, held, panel, graph, ...}
   Scripts: moveItem(id, x, T), wait(T), settle(T), sweep(T) -> Promise, all driven from step(dt). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G, NM = St.NM;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  PHY.sims.beam = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({
      world: { xMin: -5.3, xMax: 5.3, yMin: -0.45, yMax: 4.1 },
      aspect: 2, minHeight: 260, maxHeight: 470,
      xA: -4.6, xB: 4.6, y0: 1.4, mb: 0,
      supports: [{ x: 0, kind: 'wedge' }], items: [],
      e: 0.02, eLevel: 0.3, zeta: 0.75, timeScale: 1.6, maxTilt: 30, th0: 0,
      snap: 0.25, locked: true, held: false, dragSupports: false,
      panel: 'seesaw', graph: false, arms: true, weights: true, torques: true, hud: true,
      hudLeft: 'נגד השעון: ', hudRight: 'עם השעון: ', hudStack: false,
      catH: 0.85, post: false, rise: false, mbSlider: false, lab: false, maxItems: 7, onInteract: null, captionX: 0.5,
    }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: o.world, aspect: o.aspect, minHeight: o.minHeight, maxHeight: o.maxHeight });
    const tw = B.tweens();
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const S = {
      th: o.th0, om: 0, held: o.held, locked: o.locked, mb: o.mb,
      items: clone(o.items), supports: clone(o.supports),
      tipAbout: null, caption: '', sweepX: null, settlers: [], ptsL: [], ptsR: [], lastGraphX: null,
      sackY0: null, nextId: 1, dragging: null, touched: false, walkT: 0,
    };

    function loads() {
      const list = S.items.map(function (it) { return { m: it.m, x: it.x }; });
      if (S.mb > 0) list.push({ m: S.mb, x: (o.xA + o.xB) / 2 });
      return list;
    }
    function sortedSupports() { return S.supports.slice().sort(function (a, b) { return a.x - b.x; }); }

    /* Forces and torques of the beam as it stands now. */
    function solve() {
      const L = loads();
      const sup = sortedSupports();
      const W = L.reduce(function (a, l) { return a + l.m * G; }, 0);
      if (sup.length === 1) {
        const xp = sup[0].x;
        let ccw = 0, cw = 0;
        L.forEach(function (l) {
          const t = l.m * G * (l.x - xp);
          if (t < 0) ccw -= t; else cw += t;
        });
        return { one: true, xp: xp, W: W, N: [W], ccw: ccw, cw: cw, net: ccw - cw, tip: null };
      }
      const r = St.reactions(L, sup[0].x, sup[1].x);
      let tip = null;
      if (r.N1 < -1e-6) tip = 1;
      else if (r.N2 < -1e-6) tip = 0;
      const xp = tip === null ? sup[0].x : sup[tip].x;
      let ccw = 0, cw = 0;
      L.forEach(function (l) {
        const t = l.m * G * (l.x - xp);
        if (t < 0) ccw -= t; else cw += t;
      });
      return { one: false, xp: xp, W: W, N: [r.N1, r.N2], ccw: ccw, cw: cw, net: ccw - cw, tip: tip, sup: sup };
    }
    function limits(xp) {
      const a = o.xB - xp, b = xp - o.xA;
      const lo = a > o.y0 ? Math.asin(o.y0 / a) / RAD : 89;
      const hi = b > o.y0 ? Math.asin(o.y0 / b) / RAD : 89;
      return { lo: -Math.min(lo, o.maxTilt), hi: Math.min(hi, o.maxTilt) };
    }
    /* Which point the beam is turning about right now. */
    function pivotX() {
      const sup = sortedSupports();
      if (sup.length === 1) return sup[0].x;
      return S.tipAbout === null ? sup[0].x : sup[S.tipAbout].x;
    }
    function P(x) {
      const xp = pivotX(), c = Math.cos(S.th * RAD), s = Math.sin(S.th * RAD);
      return { x: xp + (x - xp) * c, y: o.y0 + (x - xp) * s };
    }

    function rotate(dt, xp, lo, hi, e) {
      const L = loads();
      if (!L.length) { S.om = 0; return; }
      let I = 0.05, M = 0, moment = 0;
      L.forEach(function (l) { I += l.m * (l.x - xp) * (l.x - xp); M += l.m; moment += l.m * (l.x - xp); });
      if (S.mb > 0) { const len = o.xB - o.xA; I += (S.mb * len * len) / 12; }
      const th = S.th * RAD;
      const eNow = Math.abs(moment) < 1e-9 ? o.eLevel : e;
      const tau = -G * moment * Math.cos(th) - G * eNow * M * Math.sin(th);
      const c = 2 * o.zeta * Math.sqrt((G * Math.max(eNow, 0.02) * M) / I);
      S.om += (tau / I - c * S.om) * dt;
      S.th += (S.om * dt) / RAD;
      if (S.th <= lo) { S.th = lo; S.om = Math.max(S.om, 0); }
      if (S.th >= hi) { S.th = hi; S.om = Math.min(S.om, 0); }
    }

    function step(dt0) {
      tw.step(dt0);
      S.walkT += dt0;
      const dt = dt0 * o.timeScale;
      const before = S.th;
      if (S.held) {
        S.th = 0; S.om = 0; S.tipAbout = null;
      } else if (S.supports.length === 1) {
        const xp = S.supports[0].x, lim = limits(xp);
        rotate(dt, xp, lim.lo, lim.hi, o.e);
      } else {
        const r = solve();
        if (S.tipAbout === null && r.tip !== null) S.tipAbout = r.tip;
        if (S.tipAbout !== null) {
          const xp = sortedSupports()[S.tipAbout].x, lim = limits(xp);
          /* Turning about the right support tilts clockwise only, about the left one counter-clockwise only. */
          if (S.tipAbout === 1) rotate(dt, xp, lim.lo, 0, 0);
          else rotate(dt, xp, 0, lim.hi, 0);
          if (Math.abs(S.th) < 1e-6 && r.tip === null) { S.th = 0; S.om = 0; S.tipAbout = null; }
        }
      }
      if (S.th !== before) loop.requestRender();
      if (o.graph) {
        const cat = byId('cat');
        if (cat && (S.lastGraphX === null || Math.abs(cat.x - S.lastGraphX) > 0.02)) {
          const r = solve();
          S.ptsL.push({ t: cat.x, y: r.N[0] });
          S.ptsR.push({ t: cat.x, y: r.N[1] });
          S.lastGraphX = cat.x;
        }
      }
      S.settlers = S.settlers.filter(function (w) {
        w.left -= dt0;
        if (Math.abs(S.om) < 0.006) w.calm += dt0; else w.calm = 0;
        if (w.left <= 0 || w.calm > 0.25) { w.res(); return false; }
        return true;
      });
    }

    function byId(id) { return S.items.find(function (it) { return it.id === id; }); }
    function clearScripts() {
      tw.clear();
      S.settlers.forEach(function (w) { w.res(); });
      S.settlers = [];
    }

    /* ---------- drawing ---------- */
    const small = () => view.w < 520;
    function itemSize(it) {
      const k = small() ? 1 : 1.3;
      if (it.kind === 'sack') return { w: 46 * k, h: 50 * k };
      const s = (17 + 11 * Math.cbrt(it.m)) * k;
      return { w: s * 1.05, h: s * 0.92 };
    }
    function drawSack(pt, it, sz) {
      const ctx = view.ctx;
      ctx.save();
      ctx.translate(view.sx(pt.x), view.sy(pt.y));
      ctx.rotate((-S.th * Math.PI) / 180);
      ctx.fillStyle = C.gridStrong;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      const w = sz.w, h = sz.h;
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, -h);
      ctx.quadraticCurveTo(-w * 0.28, -h * 0.82, -w * 0.5, -h * 0.5);
      ctx.quadraticCurveTo(-w * 0.62, -h * 0.05, -w * 0.3, 0);
      ctx.lineTo(w * 0.3, 0);
      ctx.quadraticCurveTo(w * 0.62, -h * 0.05, w * 0.5, -h * 0.5);
      ctx.quadraticCurveTo(w * 0.28, -h * 0.82, w * 0.2, -h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.25, -h * 0.84);
      ctx.lineTo(w * 0.25, -h * 0.84);
      ctx.stroke();
      ctx.restore();
      const a = S.th * RAD;
      view.screenText(view.sx(pt.x) - Math.sin(a) * (h * 0.42), view.sy(pt.y) - Math.cos(a) * (h * 0.42), it.label || F.unit(it.m, 'kg', 0), { size: small() ? 11 : 13, weight: 800, color: C.ink });
    }
    function topOf(x) {
      const p = P(x), a = S.th * RAD, k = (beamThick() / 2 + 1) / view.scale;
      return { x: p.x - Math.sin(a) * k, y: p.y + Math.cos(a) * k };
    }
    function beamThick() { return small() ? 7 : 9; }

    function drawItem(it) {
      const pt = topOf(it.x);
      if (it.kind === 'cat') {
        const wob = it.moving ? Math.sin(S.walkT * 15) * 3 : 0;
        PHY.mascot.draw(view, pt.x, pt.y, { pose: it.pose || 'standing', h: o.catH, rot: S.th + wob });
        return;
      }
      const sz = itemSize(it);
      if (it.kind === 'sack') { drawSack(pt, it, sz); return; }
      St.block(view, pt.x, pt.y, sz.w, sz.h, S.th, {
        fill: it.fill ? C[it.fill] : C.gold, slats: true,
        label: it.label || F.unit(it.m, 'kg', 0), labelSize: small() ? 10.5 : 12.5,
      });
    }

    function drawGraph() {
      const cat = byId('cat');
      const r = solve();
      const W = view.w, boxW = Math.min(W - 16, 520);
      const yMax = Math.max(50, r.W);
      const plot = PHY.ch02.Plot(view, { tMin: 0, tMax: o.xB - o.xA, yMin: 0, yMax: yMax, title: 'קריאת המאזניים (ניוטון)', tLabel: "החתול (מ')", tTick: 1, yTick: yMax > 60 ? 50 : 25 });
      plot.box((W - boxW) / 2, 6, boxW, small() ? 110 : 136).frame();
      plot.curve(S.ptsL, { color: C.force, width: 2.8 });
      plot.curve(S.ptsR, { color: C.force, width: 2.8, dash: [7, 6] });
      if (cat) {
        const x = cat.x - o.xA;
        plot.dot(x, r.N[0], { color: C.force });
        plot.dot(x, r.N[1], { color: C.force, r: 4.5 });
        plot.text(Math.min(x + 0.32, (o.xB - o.xA) - 0.3), r.N[0], 'שמאל', { size: 11, color: C.force, weight: 700 });
        plot.text(Math.min(x + 0.32, (o.xB - o.xA) - 0.3), r.N[1], 'ימין', { size: 11, color: C.force, weight: 700 });
      }
    }

    /* Each force's torque about the free pivot, as bars, with their sum. */
    function sweepList() {
      const r = solve(), sup = sortedSupports(), xo = S.sweepX;
      const list = [
        { name: 'מאזניים שמאליים', v: r.N[0] * (sup[0].x - xo) },
        { name: 'מאזניים ימניים', v: r.N[1] * (sup[1].x - xo) },
      ];
      S.items.forEach(function (it) { list.push({ name: it.kind === 'cat' ? 'ניוטון' : F.unit(it.m, 'kg', 0), v: -it.m * G * (it.x - xo) }); });
      if (S.mb > 0) list.push({ name: 'הקורה', v: -S.mb * G * ((o.xA + o.xB) / 2 - xo) });
      list.push({ name: 'הסכום', v: list.reduce(function (a, b) { return a + b.v; }, 0), total: true });
      return list;
    }
    function drawSweepBars() {
      const list = sweepList();
      const W = view.w, sm = small();
      const boxW = Math.min(W - 16, 480), x0 = (W - boxW) / 2;
      const y0 = sm ? 62 : 76, maxPx = sm ? 42 : 52;
      const big = 170;
      const col = boxW / list.length;
      view.ctx.save();
      view.screenText(W / 2, 12, 'מומנט של כל כוח סביב הציר המדומה', { size: sm ? 11.5 : 13, weight: 700, color: C.ink });
      view.ctx.restore();
      const a = view.toWorld(x0, y0), b = view.toWorld(x0 + boxW, y0);
      view.line(a.x, a.y, b.x, b.y, { color: C.axis, width: 1.6 });
      list.forEach(function (it, i) {
        const cx = x0 + col * (i + 0.5);
        const h = (it.v / big) * maxPx;
        const c0 = view.toWorld(cx - col * 0.28, y0), c1 = view.toWorld(cx + col * 0.28, y0 - h);
        if (Math.abs(h) > 0.5) view.poly([{ x: c0.x, y: c0.y }, { x: c1.x, y: c0.y }, { x: c1.x, y: c1.y }, { x: c0.x, y: c1.y }], { fill: it.total ? C.accent : C.force, close: true, alpha: 0.85 });
        else if (it.total) view.line(c0.x, c0.y, c1.x, c0.y, { color: C.accent, width: 4 });
        const valY = h >= 0 ? y0 - h - 9 : y0 - h + 9;
        view.screenText(cx, valY, F.num(it.v, 0), { size: sm ? 10.5 : 12, weight: 700, color: it.total ? C.accent : C.force, halo: true });
        view.screenText(cx, y0 + maxPx + (sm ? 12 : 16), it.name, { size: sm ? 9.5 : 11, weight: it.total ? 800 : 500, color: it.total ? C.accent : C.soft });
      });
    }

    function render() {
      const r = solve(), sm = small();
      const vis = view.visible;
      view.clear();
      view.grid(1, {});
      B.drawGround(view, 0, {});
      const xp = pivotX();

      if (o.post) {
        const px = o.xA;
        view.line(px, 0, px, o.y0 - Math.sin(limits(xp).hi * RAD) * (xp - o.xA) - 0.02, { color: C.axis, width: sm ? 5 : 7, cap: 'butt' });
      }

      /* supports */
      sortedSupports().forEach(function (s, i) {
        if (s.kind === 'scale') {
          const w = sm ? 66 : 92, top = view.sy(o.y0), bottom = view.sy(0), h = bottom - top;
          const tl = view.toWorld(view.sx(s.x) - w / 2, top + 5), br = view.toWorld(view.sx(s.x) + w / 2, bottom);
          view.poly([{ x: tl.x, y: tl.y }, { x: br.x, y: tl.y }, { x: br.x, y: br.y }, { x: tl.x, y: br.y }], { fill: C.surface, color: C.axis, width: 2, close: true });
          view.line(s.x - (w * 0.5) / view.scale, o.y0 - 2 / view.scale, s.x + (w * 0.5) / view.scale, o.y0 - 2 / view.scale, { color: C.axis, width: 4, cap: 'butt' });
          view.screenText(view.sx(s.x), top + h * 0.42, F.num(r.N[i], 1), { size: sm ? 15 : 19, weight: 800, color: C.force });
          view.screenText(view.sx(s.x), top + h * 0.72, 'ניוטון', { size: sm ? 10.5 : 12.5, weight: 600, color: C.force });
        } else {
          const h = view.sy(0) - view.sy(o.y0);
          St.wedge(view, s.x, o.y0, Math.min(46, h * 0.9), h, {});
        }
      });

      /* the beam */
      const a = P(o.xA), b = P(o.xB);
      St.plank(view, a.x, a.y, b.x, b.y, beamThick(), { fill: C.accent });
      if (S.sweepX === null && o.ticks) {
        for (let x = Math.ceil(o.xA); x <= o.xB; x++) {
          const p = P(x);
          view.circle(p.x, p.y, 1.6, { px: true, fill: C.surface });
        }
      }
      if (r.one || S.tipAbout !== null) {
        const pv = P(xp);
        view.circle(pv.x, pv.y, sm ? 4.5 : 5.5, { px: true, fill: C.surface, color: C.ink, width: 2 });
      }

      /* the beam's own weight */
      if (S.mb > 0 && o.weights) {
        const c = P((o.xA + o.xB) / 2);
        view.circle(c.x, c.y, 3, { px: true, fill: C.ink });
        const len = forcePx(S.mb * G) / view.scale;
        view.arrow(c.x, c.y, c.x, c.y - len, { color: C.force, width: 2.6, alpha: 0.9 });
        view.text(c.x, c.y - len, F.unit(S.mb * G, 'N', 0), { size: sm ? 10.5 : 12, weight: 700, color: C.force, halo: true, offset: [0, 10] });
      }

      /* items, then their arrows */
      S.items.forEach(drawItem);
      if (o.arms && r.one) {
        S.items.forEach(function (it) {
          if (Math.abs(it.x - xp) < 0.01 || it.noArm) return;
          const d = (sm ? 11 : 14) / view.scale, A = P(xp), Z = P(it.x), an = S.th * RAD;
          const ox = Math.sin(an) * d, oy = -Math.cos(an) * d;
          view.line(A.x + ox, A.y + oy, Z.x + ox, Z.y + oy, { color: C.soft, width: 1.5, dash: [4, 3] });
          view.line(Z.x + ox * 0.5, Z.y + oy * 0.5, Z.x + ox * 1.5, Z.y + oy * 1.5, { color: C.soft, width: 1.5 });
          const m = P((it.x + xp) / 2);
          if (Math.abs(it.x - xp) * view.scale > 64) view.text(m.x + ox * 2.1, m.y + oy * 2.1, F.unit(Math.abs(it.x - xp), 'm', it.dig === undefined ? 2 : it.dig), { size: sm ? 11 : 12.5, weight: 700, color: C.soft, halo: true });
        });
      }
      if (o.weights) {
        S.items.forEach(function (it) {
          if (r.one && Math.abs(it.x - xp) < 0.01) return;  /* a weight through the pivot has no say */
          const p = P(it.x);
          const len = forcePx(it.m * G) / view.scale;
          const under = (beamThick() / 2 + 2) / view.scale;
          view.arrow(p.x, p.y - under, p.x, p.y - under - len, { color: C.force, width: 3, head: 11 });
          view.text(p.x, p.y - under - len, F.unit(it.m * G, 'N', 0), { size: sm ? 10.5 : 12, weight: 700, color: C.force, halo: true, offset: [0, 10] });
        });
      }
      if (!r.one && o.weights && S.tipAbout === null) {
        r.sup.forEach(function (s, i) {
          if (r.N[i] < 0.5) return;
          const p = P(s.x), len = forcePx(r.N[i]) / view.scale, top = (beamThick() / 2 + 2) / view.scale;
          view.arrow(p.x, p.y + top, p.x, p.y + top + len, { color: C.force, width: 3, head: 11 });
          if (s.kind !== 'scale') view.text(p.x, p.y + top + len, F.unit(r.N[i], 'N', 0), { size: sm ? 10.5 : 12, weight: 700, color: C.force, halo: true, offset: [0, -9] });
        });
      }

      /* torque arrows around the pivot */
      if (r.one && o.torques) {
        const pv = P(xp);
        const big = Math.max(r.ccw, r.cw, 1);
        const R = sm ? 26 : 34;
        const ccwSweep = 16 + 70 * (r.ccw / big), cwSweep = 16 + 70 * (r.cw / big);
        if (r.ccw > 0.01) St.curved(view, pv.x, pv.y, R, 180 + 8, 188 + ccwSweep, { width: 3.2 });
        if (r.cw > 0.01) St.curved(view, pv.x, pv.y, R + 7, 360 - 8, 352 - cwSweep, { width: 3.2, alpha: 0.85 });
      }

      /* the sack's rise */
      if (o.rise && S.sackY0 !== null) {
        const sack = byId('sack');
        const y = P(sack.x).y;
        const up = y - S.sackY0;
        if (up > 0.03) {
          const x = P(sack.x).x - (sm ? 34 : 50) / view.scale;
          view.line(x - 8 / view.scale, S.sackY0, x + 8 / view.scale, S.sackY0, { color: C.displacement, width: 1.6, dash: [3, 3] });
          view.arrow(x, S.sackY0, x, y, { color: C.displacement, width: 2.6, head: 8 });
          view.text(x, y, F.unit(up, 'm', 2), { size: sm ? 11 : 12.5, weight: 700, color: C.displacement, halo: true, offset: [sm ? 3 : 0, -11] });
        }
      }

      /* the free pivot */
      if (S.sweepX !== null) {
        const p = P(S.sweepX), w = (sm ? 26 : 34);
        St.curved(view, p.x, p.y, sm ? 13 : 16, 40, 320, { color: C.accent, width: 2.2 });
        view.circle(p.x, p.y, sm ? 4 : 5, { px: true, fill: C.accent, color: C.ink, width: 1.5 });
        view.text(p.x, p.y, 'ציר', { size: sm ? 11 : 13, weight: 800, color: C.accent, halo: true, offset: [0, -w] });
        drawSweepBars();
      } else if (o.graph) {
        drawGraph();
      } else if (o.hud && r.one) {
        const left = o.hudLeft + F.unit(r.ccw, NM, 0), right = o.hudRight + F.unit(r.cw, NM, 0);
        const sz = sm ? 11 : 13;
        if (o.hudStack) {
          view.screenText(sm ? 92 : 120, 18, left, { size: sz, weight: 700, color: C.force, pill: true });
          view.screenText(sm ? 92 : 120, 46, right, { size: sz, weight: 700, color: C.force, pill: true });
        } else {
          view.screenText(view.w * 0.25, 18, left, { size: sz, weight: 700, color: C.force, pill: true });
          view.screenText(view.w * 0.75, 18, right, { size: sz, weight: 700, color: C.force, pill: true });
        }
      }
      if (!r.one && S.tipAbout !== null) {
        view.screenText(view.w / 2, 18, 'התומך השני היה צריך למשוך. הקורה מתהפכת.', { size: sm ? 11.5 : 13, weight: 700, color: C.bad, pill: true });
      }
      if (S.caption) view.screenText(view.w * o.captionX, view.h - 18, S.caption, { size: sm ? 12 : 14, weight: 700, pill: true });

      paint(r);
    }
    function forcePx(N) {
      const r = solve();
      const big = Math.max(r.W, 1);
      const max = small() ? (o.forceMaxSmall || 44) : (o.forceMax || 70);
      return Math.max(9, (N / big) * max);
    }

    /* ---------- controls ---------- */
    let out = null;
    const unitN = (v) => F.unit(v, 'N', 1);
    if (o.panel === 'seesaw') {
      out = U.Readouts(controlsEl, [
        { key: 'ccw', label: 'מומנט נגד השעון (+)', color: 'var(--c-force)' },
        { key: 'cw', label: 'מומנט עם השעון (−)', color: 'var(--c-force)' },
        { key: 'net', label: 'המומנט השקול', color: 'var(--accent)' },
      ]);
    } else if (o.panel === 'scales') {
      out = U.Readouts(controlsEl, [
        { key: 'n0', label: 'המאזניים השמאליים', color: 'var(--c-force)' },
        { key: 'n1', label: 'המאזניים הימניים', color: 'var(--c-force)' },
        { key: 'sum', label: 'הסכום', color: 'var(--accent)' },
      ]);
    } else if (o.panel === 'lab') {
      out = U.Readouts(controlsEl, [
        { key: 'n0', label: 'הכוח בתומך השמאלי', color: 'var(--c-force)' },
        { key: 'n1', label: 'הכוח בתומך הימני', color: 'var(--c-force)' },
        { key: 'sum', label: 'סכום המשקלים', color: 'var(--c-force)' },
        { key: 'state', label: 'מצב', color: 'var(--accent)' },
      ]);
    }
    /* What the floor carries once a beam end rests on it. Null while that end is in the air. */
    function floorForce() {
      if (S.th === 0) return null;
      const xp = pivotX(), end = S.th < 0 ? o.xB : o.xA;
      if (o.y0 + (end - xp) * Math.sin(S.th * RAD) > 0.01) return null;
      const moment = loads().reduce(function (a, l) { return a + l.m * G * (l.x - xp); }, 0);
      return Math.abs(moment / (end - xp));
    }
    function paint(r) {
      if (!out) return;
      if (o.panel === 'seesaw') {
        out.set('ccw', F.unit(r.ccw, NM, 1));
        out.set('cw', F.unit(r.cw, NM, 1));
        out.set('net', F.unit(r.net, NM, 1));
      } else if (o.panel === 'scales') {
        out.set('n0', unitN(r.N[0]));
        out.set('n1', unitN(r.N[1]));
        out.set('sum', unitN(r.N[0] + r.N[1]));
      } else if (o.panel === 'lab') {
        const fl = floorForce();
        const onFloor = fl === null ? 'מתהפכת' : 'הרצפה נושאת ' + unitN(fl);
        /* While the beam is turning, the force on the pivot is not a balance result, so no number is shown. */
        const pivotN = fl === null ? 'משתנה' : unitN(r.W - fl);
        if (r.one) {
          const level = Math.abs(r.net) < 0.01;
          out.set('n0', level ? unitN(r.W) : pivotN);
          out.set('n1', 'אין');
          out.set('state', level ? 'מאוזנת' : onFloor);
        } else {
          out.set('n0', S.tipAbout === null ? unitN(r.N[0]) : S.tipAbout === 1 ? unitN(0) : pivotN);
          out.set('n1', S.tipAbout === null ? unitN(r.N[1]) : S.tipAbout === 1 ? pivotN : unitN(0));
          out.set('state', S.tipAbout === null ? 'יציבה' : onFloor);
        }
        out.set('sum', unitN(r.W));
      }
    }

    let mbSlider = null, oneToggle = null, labBtns = [];
    if (o.mbSlider || o.lab) {
      mbSlider = U.Slider(controlsEl, {
        label: 'מסת הקורה', min: 0, max: 20, step: 1, value: S.mb, unit: 'kg', digits: 0, color: 'var(--accent)',
        onInput(v) { S.mb = v; touched(); changed(); },
      });
    }
    if (o.lab) {
      const row = U.h('div', { class: 'sim-row' });
      controlsEl.appendChild(row);
      labBtns.push(U.Button(row, 'עוד 2 ק"ג', function () { addBlock(2); }));
      labBtns.push(U.Button(row, 'עוד 10 ק"ג', function () { addBlock(10); }));
      labBtns.push(U.Button(row, 'להוריד את האחרון', function () { removeLast(); }, { ghost: true }));
      oneToggle = U.Toggle(row, 'תומך אחד בלבד', {
        value: false,
        onChange(v) { setOneSupport(v); touched(); },
      });
    }
    function setLocked(v) {
      S.locked = !!v;
      if (mbSlider) mbSlider.setEnabled(!S.locked);
      labBtns.forEach(function (b) { b.disabled = S.locked; });
      if (oneToggle) oneToggle.input.disabled = S.locked;
    }
    function changed() { S.ptsL = []; S.ptsR = []; S.lastGraphX = null; loop.requestRender(); }
    function touched() {
      if (!S.touched) { S.touched = true; if (o.onInteract) o.onInteract(); }
    }
    function addBlock(m) {
      if (S.items.length >= o.maxItems) { PHY.mascot.say('יש גבול. גם לקורה, וגם לי.', 'dizzy'); return null; }
      const taken = S.items.map(function (it) { return it.x; });
      const spots = [-3, 3, -1.5, 1.5, -2.25, 2.25, -0.75, 0.75, -3.5, 3.5];
      const x = spots.find(function (v) { return taken.indexOf(v) < 0 && v >= o.xA && v <= o.xB; });
      const it = { id: 'b' + S.nextId++, m: m, x: x === undefined ? 0 : x, kind: 'block', drag: true, dig: 2 };
      S.items.push(it);
      touched();
      loop.requestRender();
      return it;
    }
    function removeLast() {
      const list = S.items.filter(function (it) { return it.kind !== 'cat'; });
      if (!list.length) return;
      S.items.splice(S.items.indexOf(list[list.length - 1]), 1);
      touched();
      loop.requestRender();
    }
    function setOneSupport(one) {
      if (one && S.supports.length === 2) { S.savedSup = S.supports[1]; S.supports = [S.supports[0]]; S.supports[0].x = 0; }
      if (!one && S.supports.length === 1) {
        S.supports[0].x = -3;
        S.supports.push(S.savedSup || { x: 3, kind: 'wedge' });
        S.supports[1].x = 3;
      }
      S.th = 0; S.om = 0; S.tipAbout = null;
      loop.requestRender();
    }

    /* ---------- dragging ---------- */
    function localX(p) {
      const xp = pivotX(), pv = P(xp), a = S.th * RAD;
      return xp + (p.x - pv.x) * Math.cos(a) + (p.y - pv.y) * Math.sin(a);
    }
    view.drag({
      hit(p) {
        if (S.locked) return null;
        let best = null, bestD = 30;
        S.items.forEach(function (it) {
          if (!it.drag) return;
          const top = topOf(it.x);
          const sz = it.kind === 'cat' ? { h: o.catH * view.scale } : itemSize(it);
          const a = S.th * RAD;
          const c = { x: top.x - (Math.sin(a) * sz.h * 0.5) / view.scale, y: top.y + (Math.cos(a) * sz.h * 0.5) / view.scale };
          const d = view.pxDist(c, p);
          if (d < bestD) { bestD = d; best = { type: 'item', it: it }; }
        });
        if (best) return best;
        if (o.dragSupports) {
          S.supports.forEach(function (s) {
            const d = view.pxDist({ x: s.x, y: o.y0 * 0.5 }, p);
            if (d < bestD + 6 && S.supports.length > 1) { bestD = d; best = { type: 'sup', s: s }; }
          });
        }
        return best;
      },
      start(h) { S.dragging = h; S.caption = ''; touched(); },
      move(h, p) {
        const sn = (v) => Math.round(v / o.snap) * o.snap;
        if (h.type === 'item') {
          h.it.x = clamp(sn(localX(p)), o.xA, o.xB);
          h.it.pose = 'standing';
        } else {
          const other = S.supports.find(function (s) { return s !== h.s; });
          let x = clamp(sn(p.x), o.xA, o.xB);
          if (Math.abs(x - other.x) < 1) x = other.x + (x >= other.x ? 1 : -1);
          h.s.x = x;
          S.th = 0; S.om = 0; S.tipAbout = null;
        }
        changed();
      },
      end() { S.dragging = null; },
    });

    const loop = PHY.SimLoop({ view, step, render });

    function reset() {
      clearScripts();
      S.items = clone(o.items);
      S.supports = clone(o.supports);
      S.mb = o.mb;
      if (mbSlider) mbSlider.set(S.mb);
      if (oneToggle) oneToggle.set(false);
      S.th = o.th0; S.om = 0; S.held = o.held; S.tipAbout = null;
      S.caption = ''; S.sweepX = null;
      S.sackY0 = null;
      changed();
    }

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset,
      setParam(name, v) {
        if (name === 'locked') { setLocked(v); return; }
        if (name === 'held') S.held = !!v;
        if (name === 'caption') S.caption = v;
        if (name === 'mb') { S.mb = v; if (mbSlider) mbSlider.set(v); changed(); }
        if (name === 'oneSupport') setOneSupport(!!v);
        loop.requestRender();
      },
      getState() {
        const r = solve();
        return {
          theta: S.th, om: S.om, held: S.held, tipAbout: S.tipAbout, sweepX: S.sweepX,
          ccw: r.ccw, cw: r.cw, net: r.net, N: r.N.slice(), W: r.W, tip: r.tip, mb: S.mb, floor: floorForce(), caption: S.caption,
          items: S.items.map(function (it) { const p = P(it.x); return { id: it.id, m: it.m, x: it.x, wx: p.x, wy: p.y }; }),
          sweep: S.sweepX === null ? null : sweepList(),
          graph: S.ptsL.length,
        };
      },
      setItem(id, v) {
        const it = byId(id);
        if (it) Object.assign(it, v);
        changed();
      },
      setPose(id, pose) { const it = byId(id); if (it) it.pose = pose; loop.requestRender(); },
      moveItem(id, x, T) {
        const it = byId(id);
        if (!it) return Promise.resolve();
        const from = it.x;
        it.moving = true;
        return tw.add(T, function (k) { it.x = from + (x - from) * k; }).then(function () { it.moving = false; });
      },
      wait(T) { return tw.add(T, null); },
      /* Waits until the beam stops turning, or until T seconds have passed. */
      settle(T) {
        return new Promise(function (res) { S.settlers.push({ left: T, calm: 0, res: res }); });
      },
      sweep(T, from, to) {
        const a = from === undefined ? o.xA : from, b = to === undefined ? o.xB : to;
        S.sweepX = a;
        return tw.add(T, function (k) { S.sweepX = a + (b - a) * k; });
      },
      setSweep(x) { S.sweepX = x; loop.requestRender(); },
      markSack() { const s = byId('sack'); S.sackY0 = s ? P(s.x).y : null; },
      addBlock, removeLast,
      /* Same path as a pointer drag. */
      dragItem(id, x) { const it = byId(id); if (it) { S.caption = ''; it.x = clamp(Math.round(x / o.snap) * o.snap, o.xA, o.xB); touched(); changed(); } },
    };
    setLocked(S.locked);
    return api;
  };
})();

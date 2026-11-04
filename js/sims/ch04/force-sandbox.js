/* PHY.sims.forceSandbox: a crate on a frictionless floor, seen from above. Gravity and the floor cancel, so only
   the dragged arrows count. Net force dashed green, a red, v blue. The inset chains the forces head to tail:
   when the chain closes, the net force is 0 and the velocity stays as it is.
   Physics pauses while an arrow is being dragged. setParam: m. setForces([{x, y}]), run(bool), advance(s). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const V = PHY.vec, F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const SC = 0.14;         /* meters on screen per newton */
  const SNAP = 5, MAX_F = 50, MAX_FORCES = 3, MAX_V = 40;
  const START = [{ x: 20, y: 0 }, { x: -10, y: 15 }];

  PHY.sims.forceSandbox = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -8, xMax: 8, yMin: -4.5, yMax: 4.5 }, aspect: 16 / 9, minHeight: 320, maxHeight: 480 });
    const S = { forces: START.map(function (f) { return V.v(f.x, f.y); }), m: opts.m || 4, pos: V.v(0, 0), vel: V.v(0, 0), running: false, dragging: null, trail: [], nextTrail: 0, t: 0, caption: '', touched: false };

    function net() { return V.sum(S.forces); }
    function accel() { return V.scale(net(), 1 / S.m); }
    function touched() {
      if (S.touched) return;
      S.touched = true;
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
    }

    const slider = U.Slider(controlsEl, { label: 'מסת הארגז', min: 1, max: 10, step: 1, value: S.m, unit: 'kg', digits: 0, onInput(v) { S.m = v; touched(); loop.requestRender(); } });
    const row = U.h('div', { class: 'sim-row' });
    const runBtn = U.Button(row, 'להפעיל', function () { setRunning(!S.running); touched(); }, { primary: true });
    const addBtn = U.Button(row, 'עוד כוח', function () { addForce(); touched(); });
    U.Button(row, 'מההתחלה', function () { restart(); });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'net', label: 'כוח שקול', color: 'var(--c-force)' },
      { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
    ]);

    function setRunning(on) {
      S.running = on;
      runBtn.textContent = on ? 'לעצור' : 'להפעיל';
    }
    function addForce() {
      if (S.forces.length >= MAX_FORCES) return;
      const free = [V.v(0, -20), V.v(-20, 0), V.v(0, 20), V.v(20, 0)];
      const f = free.find(function (c) { return !S.forces.some(function (x) { return V.dist(x, c) < 10; }); }) || free[0];
      S.forces.push(f);
      addBtn.disabled = S.forces.length >= MAX_FORCES;
      loop.requestRender();
    }
    function restart() {
      S.forces = START.map(function (f) { return V.v(f.x, f.y); });
      S.pos = V.v(0, 0); S.vel = V.v(0, 0); S.trail = []; S.t = 0; S.caption = '';
      addBtn.disabled = false;
      setRunning(false);
      loop.requestRender();
    }

    function step(dt) {
      if (!S.running || S.dragging !== null) return;
      S.t += dt;
      const a = accel();
      const nv = V.add(S.vel, V.scale(a, dt));
      S.pos = V.add(S.pos, V.scale(V.add(S.vel, nv), dt / 2));
      S.vel = nv;
      if (S.t >= S.nextTrail) { S.trail.push(S.pos); S.nextTrail = S.t + 0.2; if (S.trail.length > 60) S.trail.shift(); }
      const r = view.visible;
      /* The room wraps around, like a screen with no walls: a wall would be one more force. */
      let wrapped = false;
      if (S.pos.x > r.xMax) { S.pos = V.v(r.xMin, S.pos.y); wrapped = true; }
      if (S.pos.x < r.xMin) { S.pos = V.v(r.xMax, S.pos.y); wrapped = true; }
      if (S.pos.y > r.yMax) { S.pos = V.v(S.pos.x, r.yMin); wrapped = true; }
      if (S.pos.y < r.yMin) { S.pos = V.v(S.pos.x, r.yMax); wrapped = true; }
      if (wrapped) S.trail = [];
      if (V.len(S.vel) > MAX_V) {
        S.pos = V.v(0, 0); S.vel = V.v(0, 0); S.trail = [];
        S.caption = 'ניוטון ביקש לרדת. מתחילים שוב.';
        S.captionT = S.t + 2.2;
      }
      if (S.caption && S.t > S.captionT) S.caption = '';
    }

    function tip(f) { return V.add(S.pos, V.scale(f, SC)); }

    view.drag({
      hit(p) {
        let best = null, bestD = 30;
        S.forces.forEach(function (f, i) {
          const d = view.pxDist(p, tip(f));
          if (d < bestD) { bestD = d; best = { i }; }
        });
        return best;
      },
      start(h) { S.dragging = h.i; touched(); },
      move(h, p) {
        let f = V.snap(V.scale(V.sub(p, S.pos), 1 / SC), SNAP);
        const l = V.len(f);
        if (l > MAX_F) f = V.scale(f, MAX_F / l);
        S.forces[h.i] = f;
        loop.requestRender();
      },
      end(h) {
        S.dragging = null;
        /* A force dragged back into the crate is gone. */
        if (V.len(S.forces[h.i]) < 1) {
          S.forces.splice(h.i, 1);
          addBtn.disabled = false;
        }
        setRunning(true);
      },
    });

    function drawChain() {
      const box = view.w < 460 ? { w: 106, h: 84 } : { w: 136, h: 104 };
      const x0 = 8, y0 = 8;
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y0, box.w, box.h, 10);
      else ctx.rect(x0, y0, box.w, box.h);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.restore();
      view.screenText(x0 + box.w / 2, y0 + 11, 'ראש לזנב', { size: 10.5, weight: 700, color: C.soft });
      const P = PHY.ch02.pix(view);
      /* Fit the chain into the box. */
      const pts = [V.v(0, 0)];
      S.forces.forEach(function (f) { pts.push(V.add(pts[pts.length - 1], f)); });
      const xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
      const spanX = Math.max(10, Math.max.apply(null, xs) - Math.min.apply(null, xs));
      const spanY = Math.max(10, Math.max.apply(null, ys) - Math.min.apply(null, ys));
      const k = Math.min((box.w - 22) / spanX, (box.h - 34) / spanY);
      const cx = x0 + box.w / 2 - (k * (Math.max.apply(null, xs) + Math.min.apply(null, xs))) / 2;
      const cy = y0 + 18 + (box.h - 18) / 2 + (k * (Math.max.apply(null, ys) + Math.min.apply(null, ys))) / 2;
      const px = (p) => ({ x: cx + p.x * k, y: cy - p.y * k });
      for (let i = 1; i < pts.length; i++) {
        const a = px(pts[i - 1]), b = px(pts[i]);
        P.arrow(a.x, a.y, b.x, b.y, { color: C.force, width: 2.2, head: 8 });
      }
      const closed = V.len(net()) < 0.5 && S.forces.length >= 2;
      if (closed) P.circle(px(pts[0]).x, px(pts[0]).y, 5, { color: C.good, width: 2.5 });
      else if (S.forces.length) {
        const a = px(pts[0]), b = px(pts[pts.length - 1]);
        P.arrow(a.x, a.y, b.x, b.y, { color: C.force, width: 2.2, head: 8, dash: [4, 3], alpha: 0.75 });
      }
    }

    function render() {
      view.clear();
      view.grid(1, { majorEvery: 4 });
      const small = view.w < 460;
      drawChain();
      S.trail.forEach(function (q) { view.circle(q.x, q.y, 2.5, { px: true, fill: C.displacement, alpha: 0.45 }); });

      const w = small ? 44 : 56;
      K().crate(view, S.pos.x, S.pos.y - (w / 2) / view.scale, w, w, {});
      PHY.mascot.draw(view, S.pos.x, S.pos.y - (w * 0.42) / view.scale, { pose: V.len(S.vel) > 14 ? 'dizzy' : 'standing', px: w * 0.9 });
      view.text(S.pos.x, S.pos.y, F.unit(S.m, 'kg', 0), { size: 11, weight: 800, offset: [0, w / 2 + 11], halo: true });

      /* the velocity first, so forces stay on top */
      const speed = V.len(S.vel);
      if (speed > 0.05) {
        const shown = V.scale(V.norm(S.vel), Math.min(4.5, speed * 0.28));
        const head = V.add(S.pos, shown);
        view.arrow(S.pos.x, S.pos.y, head.x, head.y, { color: C.velocity, width: 3.4 });
        const un = V.norm(S.vel);
        view.text(head.x, head.y, 'v', { size: 13, weight: 800, color: C.velocity, offset: [un.x * 11, -un.y * 11], halo: true });
      }

      const N = net();
      const netLen = V.len(N);
      S.forces.forEach(function (f, i) {
        const t = tip(f);
        view.arrow(S.pos.x, S.pos.y, t.x, t.y, { color: C.force, width: 3.6 });
        view.circle(t.x, t.y, 9, { px: true, fill: C.surface, color: C.force, width: 3 });
        const out0 = V.norm(f);
        view.text(t.x, t.y, F.unit(V.len(f), 'N', 0), { size: 11.5, weight: 700, color: C.force, offset: [out0.x * 30, -out0.y * 18], halo: true });
      });
      if (netLen > 0.5) {
        const head = V.add(S.pos, V.scale(N, SC));
        view.arrow(S.pos.x, S.pos.y, head.x, head.y, { color: C.force, width: 4.5, dash: [8, 6] });
        /* a is parallel to the net force: drawn beside it, so the two stay apart */
        const a = accel();
        const u = V.norm(a);
        const off = V.v((-u.y * 15) / view.scale, (u.x * 15) / view.scale);
        const alen = Math.min(5, V.len(a) * 0.3);
        const from = V.add(S.pos, off), to = V.add(from, V.scale(u, alen));
        view.arrow(from.x, from.y, to.x, to.y, { color: C.acceleration, width: 3.4 });
        view.text(to.x, to.y, 'a', { size: 13, weight: 800, color: C.acceleration, offset: [u.x * 11, -u.y * 11], halo: true });
      }
      if (S.caption) view.screenText(view.w / 2, view.h - 18, S.caption, { size: 13, weight: 700, pill: true });
      else if (netLen < 0.5 && S.forces.length >= 2) view.screenText(view.w / 2, view.h - 18, 'שקול אפס: השרשרת נסגרת, והמהירות לא משתנה.', { size: small ? 11.5 : 13, weight: 700, pill: true, color: C.good });
      else if (!S.running && !S.touched) view.screenText(view.w / 2, view.h - 18, 'אפשר לגרור את קצות החצים', { size: small ? 12 : 13, weight: 700, pill: true });

      out.set('net', F.unit(netLen, 'N', 1));
      out.set('a', F.unit(netLen / S.m, 'ms2', 1));
      out.set('v', F.unit(speed, 'ms', 1));
    }
    function K() { return PHY.ch04; }

    const loop = PHY.SimLoop({ view, step, render });
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam(name, v) {
        if (name === 'm') { S.m = v; slider.set(v); }
        loop.requestRender();
      },
      setForces(list) {
        S.forces = list.map(function (f) { return V.v(f.x, f.y); });
        addBtn.disabled = S.forces.length >= MAX_FORCES;
        loop.requestRender();
      },
      run(on) { setRunning(!!on); },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 120) step(1 / 120);
      },
      getState() {
        const N = net();
        return { m: S.m, t: S.t, net: N, netLen: V.len(N), a: accel(), vel: S.vel, pos: S.pos, running: S.running, forces: S.forces.slice() };
      },
    };
  };
})();

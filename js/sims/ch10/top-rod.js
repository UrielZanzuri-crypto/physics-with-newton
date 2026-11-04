/* PHY.sims.topRod: rods seen from above, pushed by forces that keep their angle to the rod.
   A hinged rod (door, wrench): alpha = F d sin(rel) / I. A free rod (stick on ice): the center moves with
   the net force and the rod spins with the net torque, so a couple spins in place.
   Shows the force, its line of action, the lever arm and a curved torque arrow.
   opts: {rods: [{id, skin, hx, hy, L, I, m, ang0, F, d, rel, hinge, forces, title}], free, locked, slow, stopAt, T}
   hideUntilRun: for a predict card, the torque, the lever arm and the curved arrow wait for the first run.
   inward: the free door's angle slider sets the force pressing toward the hinge, so rel = 180 - angle.
   sim.play() -> Promise. Numbers come from the integration, and getState() reports them per rod. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, NM = St.NM;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  PHY.sims.topRod = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({
      world: { xMin: -0.5, xMax: 3.6, yMin: -0.95, yMax: 1.95 },
      aspect: 1.42, minHeight: 270, maxHeight: 470,
      rods: [], free: false, inward: false, hideUntilRun: false, locked: true, slow: 0.6, stopAt: 90, T: 0, arrowM: 0.62, cat: true, arm: true,
    }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: o.world, aspect: o.aspect, minHeight: o.minHeight, maxHeight: o.maxHeight });
    const fresh = () => clone(o.rods).map(function (r) {
      return Object.assign({ th: r.ang0 || 0, om: 0, cx: r.hx, cy: r.hy, vx: 0, vy: 0 }, r);
    });
    const S = { rods: fresh(), phase: 'ready', t: 0, resolve: null, caption: '', locked: o.locked };

    function tauOf(r) {
      if (r.hinge !== false) return r.F * r.d * Math.sin(r.rel * RAD);
      return r.forces.reduce(function (a, f) { return a + f.F * f.s * Math.sin(f.rel * RAD); }, 0);
    }
    function netForce(r) {
      if (r.hinge !== false) return { x: 0, y: 0 };
      const u = r.th;
      return r.forces.reduce(function (a, f) {
        return { x: a.x + f.F * Math.cos((u + f.rel) * RAD), y: a.y + f.F * Math.sin((u + f.rel) * RAD) };
      }, { x: 0, y: 0 });
    }
    function armOf(r) { return Math.abs(r.d * Math.sin(r.rel * RAD)); }
    const resultHidden = () => o.hideUntilRun && S.phase === 'ready';
    /* The slider shows the angle between the force and the door. */
    const relOf = (angle) => (o.inward ? 180 - angle : angle);

    function finish() {
      S.phase = 'done';
      const res = S.resolve;
      S.resolve = null;
      if (res) res();
      paintRun();
    }
    function step(dt0) {
      if (S.phase !== 'run') return;
      /* Constant torque, so the update is exact, and a timed run ends exactly on its time. */
      const dt = o.T ? Math.min(dt0 * o.slow, o.T - S.t) : dt0 * o.slow;
      S.t += dt;
      let reached = false;
      S.rods.forEach(function (r) {
        const al = tauOf(r) / r.I;
        if (r.hinge !== false) {
          r.th += (r.om * dt + 0.5 * al * dt * dt) / RAD;
          r.om += al * dt;
          if (r.th >= o.stopAt) { reached = true; }
        } else {
          const f = netForce(r);
          r.cx += r.vx * dt + (0.5 * f.x * dt * dt) / r.m;
          r.cy += r.vy * dt + (0.5 * f.y * dt * dt) / r.m;
          r.vx += (f.x / r.m) * dt;
          r.vy += (f.y / r.m) * dt;
          r.th += (r.om * dt + 0.5 * al * dt * dt) / RAD;
          r.om += al * dt;
        }
      });
      if (reached) {
        /* Back up to the exact moment the first door arrived, so the printed angles do not depend on dt. */
        const lead = S.rods.reduce(function (a, b) { return a.th > b.th ? a : b; });
        const over = lead.th - o.stopAt;
        const leadOm = lead.om / RAD;
        const back = over / leadOm;
        S.rods.forEach(function (r) { r.th -= (r.om / RAD) * back; });
        S.t -= back;
        S.arrived = S.t;
        S.rods.forEach(function (r) { r.om = 0; });
        finish();
        return;
      }
      if (o.T && S.t >= o.T - 1e-9) finish();
      else if (!o.T && S.rods.every(function (r) { return Math.abs(tauOf(r)) < 1e-9; }) && S.t > 1) {
        S.caption = 'אפס מומנט. שום דבר לא זז.';
        finish();
      }
    }

    function play() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.rods.forEach(function (r) {
        r.th = r.ang0 || 0; r.om = 0; r.cx = r.hx; r.cy = r.hy; r.vx = 0; r.vy = 0;
      });
      S.t = 0;
      S.arrived = null;
      S.caption = '';
      S.phase = 'run';
      return new Promise(function (res) { S.resolve = res; });
    }
    function reset() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.rods.forEach(function (r) { r.th = r.ang0 || 0; r.om = 0; r.cx = r.hx; r.cy = r.hy; r.vx = 0; r.vy = 0; });
      S.phase = 'ready'; S.t = 0; S.caption = ''; S.arrived = null;
      loop.requestRender();
    }

    /* ---------- drawing ---------- */
    function small() { return view.w < 520; }
    function pointOn(r, s) {
      const a = r.th * RAD;
      return { x: r.cx + s * Math.cos(a), y: r.cy + s * Math.sin(a) };
    }
    function drawDoorFrame(r) {
      const k = 16 / view.scale;
      St.hatch(view, r.hx - 3 * k, r.hy - 0.02, r.hx - 0.02, r.hy - 0.02, 0, -1, {});
      St.hatch(view, r.hx + r.L + 0.04, r.hy - 0.02, r.hx + r.L + 0.04 + 2 * k, r.hy - 0.02, 0, -1, {});
    }
    function drawRod(r) {
      const end = pointOn(r, r.L);
      if (r.skin === 'door') {
        St.plank(view, r.cx, r.cy, end.x, end.y, small() ? 8 : 11, { fill: C.gold });
        const h = pointOn(r, r.L * 0.9);
        view.circle(h.x, h.y, 2.6, { px: true, fill: C.ink });
      } else if (r.skin === 'wrench') {
        St.plank(view, r.cx, r.cy, end.x, end.y, small() ? 8 : 11, { fill: C.soft });
        const R = small() ? 15 : 20;
        view.circle(r.cx, r.cy, R, { px: true, fill: C.soft, color: C.ink, width: 2.5 });
        const pts = [];
        for (let i = 0; i < 6; i++) pts.push({
          x: r.cx + ((R * 0.6) / view.scale) * Math.cos((r.th + i * 60) * RAD),
          y: r.cy + ((R * 0.6) / view.scale) * Math.sin((r.th + i * 60) * RAD),
        });
        view.poly(pts, { fill: C.gridStrong, color: C.ink, width: 2, close: true });
      }
      if (r.hinge !== false && r.skin !== 'wrench') {
        view.circle(r.cx, r.cy, small() ? 6 : 8, { px: true, fill: C.surface, color: C.ink, width: 2.5 });
      }
    }
    function forceArrow(p, deg, label, opt) {
      opt = opt || {};
      const len = o.arrowM * (opt.k || 1);
      const a = deg * RAD;
      const tail = { x: p.x - len * Math.cos(a), y: p.y - len * Math.sin(a) };
      view.arrow(tail.x, tail.y, p.x, p.y, { color: C.force, width: 4, head: 14 });
      if (label && opt.head) view.text(p.x, p.y, label, { size: small() ? 11.5 : 13, weight: 700, color: C.force, halo: true, offset: opt.off || [0, -14] });
      else if (label) view.text(tail.x, tail.y, label, { size: small() ? 11.5 : 13, weight: 700, color: C.force, halo: true, offset: opt.off || [0, 14] });
      return tail;
    }

    function drawHinged(r) {
      const p = pointOn(r, r.d);
      const deg = r.th + r.rel;
      const a = deg * RAD;
      const ux = Math.cos(a), uy = Math.sin(a);
      const tau = tauOf(r);

      const footAt = -((p.x - r.cx) * ux + (p.y - r.cy) * uy);
      if (o.arm) {
        const L0 = -(o.arrowM * 2.6), L1 = Math.max(o.arrowM * 0.9, footAt + 0.12);
        view.line(p.x + L0 * ux, p.y + L0 * uy, p.x + L1 * ux, p.y + L1 * uy, { color: C.soft, width: 1.4, dash: [5, 5] });
      }
      if (o.arm && !resultHidden() && armOf(r) > 0.005 && Math.abs(r.rel - 90) > 0.5) {
        const foot = { x: p.x + footAt * ux, y: p.y + footAt * uy };
        view.line(r.cx, r.cy, foot.x, foot.y, { color: C.accent, width: 3 });
        view.circle(foot.x, foot.y, 3, { px: true, fill: C.accent });
      }
      drawRod(r);
      const tail = forceArrow(p, deg, F.unit(r.F, 'N', 0), { off: r.offLabel || [0, 14] });
      if (r.showCat) PHY.mascot.draw(view, tail.x, tail.y, { pose: r.pose || 'standing', px: small() ? 36 : 50, anchor: [0.5, 0.75] });
      /* The sharp angle between the force's line and the door. */
      if (r.rel > 90 && r.rel < 179) {
        view.arc(p.x, p.y, small() ? 26 : 32, r.th + r.rel, r.th + 180, { color: C.soft, width: 1.8 });
      } else if (r.rel < 90 && r.rel > 1) {
        view.arc(p.x, p.y, small() ? 26 : 32, r.th + 180, r.th + r.rel + 180, { color: C.soft, width: 1.8 });
      }
      if (!resultHidden() && Math.abs(tau) > 1e-6) {
        const sweep = 30 + Math.min(200, Math.abs(tau) * (r.torqueDeg || 8));
        St.curved(view, r.cx, r.cy, small() ? 22 : 28, r.th + 30, r.th + 30 + sweep, { width: 3.4 });
      }
      const sz = small() ? 11.5 : 13;
      if (!resultHidden()) view.text(r.hx, o.world.yMax, (r.pillPrefix === undefined ? 'מומנט: ' : r.pillPrefix) + F.unit(tau, NM, 1), { size: sz, weight: 700, color: C.force, pill: true, align: 'left', offset: [r.pillOff || 0, 14] });
      if (r.title) view.text(r.hx, o.world.yMax, r.title, { size: sz, weight: 700, color: C.ink, halo: true, align: 'left', offset: [r.pillOff || 0, 38] });
    }

    function drawFree(r) {
      const end0 = pointOn(r, -r.L / 2), end1 = pointOn(r, r.L / 2);
      St.plank(view, end0.x, end0.y, end1.x, end1.y, small() ? 7 : 10, { fill: C.gold });
      r.forces.forEach(function (f) {
        const p = pointOn(r, f.s);
        forceArrow(p, r.th + f.rel, F.unit(f.F, 'N', 0), { head: true, off: [0, f.s > 0 ? -16 : 16] });
      });
      const spinning = Math.abs(r.om) > 0.1;
      PHY.mascot.draw(view, r.cx, r.cy, { pose: spinning ? 'dizzy' : (S.phase === 'done' ? 'happy' : 'standing'), px: small() ? 44 : 62, anchor: [0.5, 0.55], rot: r.th });
      view.circle(r.cx, r.cy, 3, { px: true, fill: C.ink });
      const tau = tauOf(r);
      if (!resultHidden() && Math.abs(tau) > 1e-6) St.curved(view, r.cx, r.cy, small() ? 32 : 44, r.th + 30, r.th + 150, { width: 3.4 });
      if (r.title) view.text(r.hx, o.world.yMin, r.title, { size: small() ? 11.5 : 13, weight: 700, color: C.ink, offset: [0, -2], halo: true });
    }

    function render() {
      view.clear();
      view.grid(o.gridStep || 0.5, {});
      S.rods.forEach(function (r) {
        if (r.hinge !== false) {
          if (r.skin === 'door') drawDoorFrame(r);
          drawHinged(r);
        } else {
          drawFree(r);
        }
      });
      if (S.arrived !== null && S.rods.length > 1 && S.rods[0].hinge !== false) {
        S.rods.forEach(function (r) {
          view.text(r.hx, r.hy, F.deg(r.th, 0), { size: small() ? 12.5 : 15, weight: 800, color: C.accent, halo: true, offset: [small() ? -18 : -24, 14] });
        });
      }
      if (S.caption) view.screenText(view.w / 2, view.h - 18, S.caption, { size: small() ? 12 : 14, weight: 700, pill: true });
      paintRun();
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- free door ---------- */
    let out = null, sF, sD, sR, pushBtn, closeBtn;
    if (o.free) {
      const r0 = () => S.rods[0];
      sF = U.Slider(controlsEl, { label: 'הכוח', min: 0, max: 40, step: 1, value: r0().F, unit: 'N', digits: 0, color: 'var(--c-force)', onInput(v) { r0().F = v; idle(); } });
      sD = U.Slider(controlsEl, { label: 'המרחק מהציר', min: 0.1, max: 1, step: 0.05, value: r0().d, unit: 'm', digits: 2, color: 'var(--accent)', onInput(v) { r0().d = v; idle(); } });
      sR = U.Slider(controlsEl, { label: 'הזווית בין הכוח לדלת', min: 0, max: 90, step: 5, value: relOf(r0().rel), format: (v) => St.deg(v), color: 'var(--accent)', onInput(v) { r0().rel = relOf(v); idle(); } });
      out = U.Readouts(controlsEl, [
        { key: 'arm', label: 'הזרוע', color: 'var(--accent)' },
        { key: 'tau', label: 'המומנט', color: 'var(--c-force)' },
        { key: 'ang', label: 'פתיחת הדלת' },
      ]);
      const row = U.h('div', { class: 'sim-row' });
      controlsEl.appendChild(row);
      pushBtn = U.Button(row, 'לדחוף', function () { play(); }, { primary: true });
      closeBtn = U.Button(row, 'לסגור את הדלת', reset, { ghost: true });
    }
    function idle() {
      if (S.phase === 'run') return;
      reset();
    }
    function paintRun() {
      if (!out) return;
      const r = S.rods[0];
      out.set('arm', F.unit(armOf(r), 'm', 2));
      out.set('tau', F.unit(tauOf(r), NM, 1));
      out.set('ang', St.deg(r.th, 0));
    }
    function setLocked(v) {
      S.locked = !!v;
      [sF, sD, sR].forEach(function (s) { if (s) s.setEnabled(!S.locked); });
      if (pushBtn) pushBtn.disabled = S.locked;
      if (closeBtn) closeBtn.disabled = S.locked;
    }
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset,
      play,
      setParam(name, v) {
        if (name === 'locked') { setLocked(v); return; }
        const r = S.rods[0];
        if (name === 'F') { r.F = v; if (sF) sF.set(v); }
        if (name === 'd') { r.d = v; if (sD) sD.set(v); }
        if (name === 'rel') { r.rel = relOf(v); if (sR) sR.set(v); }
        loop.requestRender();
      },
      getState() {
        return {
          phase: S.phase, t: S.t, arrived: S.arrived, resultShown: !resultHidden(),
          rods: S.rods.map(function (r) {
            const f = netForce(r);
            return { id: r.id, th: r.th, om: r.om, tau: tauOf(r), arm: r.hinge !== false ? armOf(r) : null, along: r.hinge !== false ? r.F * Math.cos(r.rel * RAD) : null, cx: r.cx, cy: r.cy, netX: f.x, netY: f.y };
          }),
        };
      },
    };
  };
})();

/* PHY.sims.ladder: a uniform ladder against a smooth wall, on a rough floor, with the cat somewhere on it.
   Standing: all forces come from the balance conditions (PHY.statics.ladderForces).
   Slipping: one degree of freedom, the angle. M(th) th'' + M'(th)/2 th'^2 = Q, with kinetic friction at the foot
   (0.75 of the static coefficient) and N found from the vertical accelerations. So the slip follows the real equation.
   opts: {deg, mu, m, M, L, s, locked}. sim.climb() -> Promise: the cat walks up until the top or a slip.
   setParam: deg, mu, s, locked. getState(): forces, needed friction and the slip point. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  PHY.sims.ladder = function (canvasEl, controlsEl, opts) {
    const o = Object.assign({ deg: 53, mu: 0.4, m: 10, M: 5, L: 5, s: 0, cat: true, locked: true, speed: 1 }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -0.7, xMax: 5.6, yMin: -0.4, yMax: 5.15 }, aspect: 1.15, minHeight: 320, maxHeight: 480,
    });
    const S = {
      deg: o.deg, mu: o.mu, s: o.s, onLadder: o.cat, th: o.deg, om: 0, phase: 'stand', resolve: null,
      caption: '', pose: 'standing', slipAt: null, locked: o.locked, catFloor: null,
    };
    const forces = () => St.ladderForces({ deg: S.th, m: o.m, M: S.onLadder ? o.M : 0, L: o.L, s: S.s, mu: S.mu });

    function finish() {
      const r = S.resolve;
      S.resolve = null;
      if (r) r();
    }
    function beginSlip() {
      S.phase = 'slip';
      S.slipAt = { s: S.s, deg: S.th };
      S.om = 0;
      S.pose = 'falling';
      S.caption = 'הסולם מחליק!';
    }
    function slipStep(dt) {
      const m = o.m, M = S.onLadder ? o.M : 0, L = o.L, s = S.s, mu = S.mu * 0.75;
      const th = S.th * RAD, sn = Math.sin(th), cs = Math.cos(th);
      const A = (m * L) / 2 + M * s;
      const Mq = (m * L * L) / 3 + M * ((L - s) * (L - s) * sn * sn + s * s * cs * cs);
      const dM = M * 2 * sn * cs * ((L - s) * (L - s) - s * s);
      const w2 = S.om * S.om;
      const den = Mq - mu * L * sn * A * cs;
      const num = -A * G * cs + mu * L * sn * ((m + M) * G - A * sn * w2) - 0.5 * dM * w2;
      S.om += (num / den) * dt;
      S.th += (S.om * dt) / RAD;
      if (S.om > 0) S.om = 0;
      if (S.th <= 7) {
        S.th = 7;
        S.om = 0;
        S.phase = 'fallen';
        S.pose = 'dizzy';
        S.caption = 'על הרגליים, כרגיל. הסולם פחות.';
        const a = S.th * RAD;
        S.catFloor = (L - S.s) * Math.cos(a);
        finish();
      }
    }
    function step(dt) {
      if (S.phase === 'climb') {
        S.s += o.speed * dt;
        sCat.set(Math.round(S.s * 4) / 4);
        if (S.s >= o.L) {
          S.s = o.L;
          S.phase = 'stand';
          finish();
        }
        if (forces().slips) beginSlip();
      } else if (S.phase === 'stand' && forces().slips) {
        beginSlip();
      } else if (S.phase === 'slip') {
        slipStep(dt);
      }
    }

    /* Foot on the floor to the right of the wall at x = 0. */
    function pointAt(s) {
      const a = S.th * RAD;
      return { x: (o.L - s) * Math.cos(a), y: s * Math.sin(a) };
    }
    function erect(v) {
      finish();
      if (v !== undefined) S.deg = v;
      S.th = S.deg;
      S.om = 0;
      S.phase = 'stand';
      S.caption = '';
      S.pose = 'standing';
      S.slipAt = null;
      S.catFloor = null;
    }
    function climb() {
      finish();
      erect();
      S.s = 0;
      sCat.set(0);
      S.onLadder = true;
      S.phase = 'climb';
      return new Promise(function (res) { S.resolve = res; });
    }

    function drawLadder(foot, top, small) {
      const dx = top.x - foot.x, dy = top.y - foot.y, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      /* The lower rail runs exactly from the floor to the wall, and the other one lies beside it. */
      const w = (small ? 14 : 20) / view.scale;
      const sx = nx < 0 ? -1 : 1;
      const ox = nx * w * sx, oy = ny * w * sx;
      view.line(foot.x, foot.y, top.x, top.y, { color: C.accent, width: small ? 3.4 : 4.5 });
      view.line(foot.x + ox, foot.y + oy, top.x + ox, top.y + oy, { color: C.accent, width: small ? 3.4 : 4.5 });
      for (let k = 0.5; k < len; k += 0.5) {
        const px = foot.x + ux * k, py = foot.y + uy * k;
        view.line(px, py, px + ox, py + oy, { color: C.accent, width: small ? 2.4 : 3 });
      }
    }

    function render() {
      const small = view.w < 520;
      const r = view.visible;
      view.clear();
      view.grid(1, {});
      B.drawGround(view, 0, {});
      St.hatch(view, 0, 0, 0, Math.min(5.1, r.yMax), -1, 0, {});
      const foot = pointAt(0), top = pointAt(o.L);
      /* Waiting beside the ladder, under the force labels. */
      if (!S.onLadder) PHY.mascot.draw(view, Math.min(foot.x + 1.5, r.xMax - 0.4), 0, { pose: 'standing', h: 0.95 });
      drawLadder(foot, top, small);

      const f = forces();
      const standing = S.phase === 'stand' || S.phase === 'climb';
      const kN = (small ? 0.42 : 0.62) / view.scale;   /* meters per newton on screen */
      const mid = pointAt(o.L / 2);

      if (standing) {
        const lab = (v) => F.unit(v, 'N', 0);
        const size = small ? 11 : 13;
        /* floor force, up */
        view.arrow(foot.x, foot.y, foot.x, foot.y + f.Nf * kN, { color: C.force, width: 3.2, head: 12 });
        view.text(foot.x, foot.y + f.Nf * kN, lab(f.Nf), { size: size, weight: 700, color: C.force, halo: true, offset: [small ? 30 : 36, 2] });
        /* friction, toward the wall */
        view.arrow(foot.x, foot.y, foot.x - f.f * kN, foot.y, { color: C.force, width: 3.2, head: 12 });
        view.text(foot.x - f.f * kN, foot.y, 'חיכוך ' + lab(f.f), { size: size, weight: 700, color: f.slips ? C.bad : C.force, halo: true, offset: [small ? -8 : 0, 13] });
        /* wall force, away from the wall */
        view.arrow(top.x, top.y, top.x + f.Nw * kN, top.y, { color: C.force, width: 3.2, head: 12 });
        view.text(top.x + f.Nw * kN, top.y, lab(f.Nw), { size: size, weight: 700, color: C.force, halo: true, offset: [small ? 22 : 28, -2] });
        /* the ladder's weight */
        view.arrow(mid.x, mid.y, mid.x, mid.y - o.m * G * kN, { color: C.force, width: 3.2, head: 12 });
        const catBelow = S.onLadder && S.s < o.L / 2;  /* the cat's arrow is then on the right of the ladder's */
        view.text(mid.x, mid.y - o.m * G * kN, lab(o.m * G), { size: size, weight: 700, color: C.force, halo: true, offset: [(catBelow ? -1 : 1) * (small ? 26 : 32), 2] });
      }

      /* the cat */
      if (S.onLadder) {
        if (S.phase === 'fallen') {
          PHY.mascot.draw(view, Math.min(S.catFloor + 0.7, r.xMax - 0.4), 0, { pose: 'standing', h: 0.95 });
        } else {
          const p = pointAt(S.s);
          const a = S.th * RAD;
          const offs = (small ? 9 : 13) / view.scale;
          const catX = p.x + Math.sin(a) * offs, catY = p.y + Math.cos(a) * offs;
          const lean = 90 - S.th;
          PHY.mascot.draw(view, catX, catY, { pose: S.pose, h: 0.95, rot: lean, anchor: S.pose === 'falling' ? [0.5, 0.75] : undefined });
          if (standing && o.M > 0) {
            view.arrow(p.x, p.y, p.x, p.y - o.M * G * kN, { color: C.force, width: 3, head: 11 });
            if (S.s > 0.4 && S.s < 4.7) view.text(p.x, p.y - o.M * G * kN, lab50(), { size: small ? 11 : 13, weight: 700, color: C.force, halo: true, offset: [(S.s < o.L / 2 ? 1 : -1) * (small ? 24 : 30), 3] });
          }
        }
      }

      const W = view.w;
      /* needed versus available friction */
      if (standing) {
      const bw = small ? 118 : 170, bh = 13, bx = W - bw - 12, by = 28;
      const big = Math.max(f.fMax, f.f, 1) * 1.15;
      view.screenText(bx + bw, by - 12, 'חיכוך דרוש מול המקסימום', { size: small ? 10.5 : 12, weight: 700, color: C.ink, align: 'right' });
      const P0 = view.toWorld(bx, by), P1 = view.toWorld(bx + bw, by + bh);
      view.poly([{ x: P0.x, y: P0.y }, { x: P1.x, y: P0.y }, { x: P1.x, y: P1.y }, { x: P0.x, y: P1.y }], { fill: C.grid, color: C.axis, width: 1.4, close: true });
      const shown = standing ? f.f : Math.max(f.fMax * 1.02, f.f);
      const P2 = view.toWorld(bx + (Math.min(shown, big) / big) * bw, by + bh);
      view.poly([{ x: P0.x, y: P0.y }, { x: P2.x, y: P0.y }, { x: P2.x, y: P2.y }, { x: P0.x, y: P2.y }], { fill: f.slips || !standing ? C.bad : C.force, close: true });
      const mx = bx + (f.fMax / big) * bw;
      const M0 = view.toWorld(mx, by - 4), M1 = view.toWorld(mx, by + bh + 4);
      view.line(M0.x, M0.y, M1.x, M1.y, { color: C.ink, width: 2.5, cap: 'butt' });
      }

      if (S.caption) view.screenText(W / 2, view.h - 16, S.caption, { size: small ? 12 : 14, weight: 700, pill: true });

      out.set('need', standing ? F.unit(f.f, 'N', 1) : 'החליק');
      out.set('max', F.unit(f.fMax, 'N', 1));
      out.set('mu', standing ? F.num(f.need, 3) : 'לא רלוונטי');
      out.set('min', St.deg(Math.atan(1 / (2 * S.mu)) / RAD, 1));
    }
    function lab50() { return F.unit(o.M * G, 'N', 0); }

    const loop = PHY.SimLoop({ view, step, render });

    const sAngle = U.Slider(controlsEl, {
      label: 'זווית הסולם מהרצפה', min: 25, max: 85, step: 1, value: S.deg, format: (v) => St.deg(v), color: 'var(--accent)',
      onInput(v) { erect(v); },
    });
    const sMu = U.Slider(controlsEl, {
      label: 'מקדם החיכוך ברצפה', min: 0.1, max: 1, step: 0.05, value: S.mu, format: (v) => F.num(v, 2), color: 'var(--accent)',
      onInput(v) { S.mu = v; erect(); },
    });
    const sCat = U.Slider(controlsEl, {
      label: 'החתול, מרחק מתחתית הסולם', min: 0, max: 5, step: 0.25, value: S.s, unit: 'm', digits: 2, color: 'var(--accent)',
      onInput(v) { S.s = v; S.onLadder = true; erect(); },
    });
    const out = U.Readouts(controlsEl, [
      { key: 'need', label: 'החיכוך הדרוש', color: 'var(--c-force)' },
      { key: 'max', label: 'החיכוך המקסימלי', color: 'var(--c-force)' },
      { key: 'mu', label: 'μ דרוש', color: 'var(--accent)' },
      { key: 'min', label: 'זווית מינימלית, סולם ריק' },
    ]);
    const row = U.h('div', { class: 'sim-row' });
    controlsEl.appendChild(row);
    const standBtn = U.Button(row, 'להעמיד מחדש', function () {
      const safe = St.ladderForces({ deg: S.deg, m: o.m, M: S.onLadder ? o.M : 0, L: o.L, s: S.s, mu: S.mu }).slips ? 80 : S.deg;
      sAngle.set(safe);
      erect(safe);
    }, {});
    const emptyBtn = U.Button(row, 'להוריד את החתול', function () { S.onLadder = false; erect(); }, { ghost: true });
    function setLocked(v) {
      S.locked = !!v;
      [sAngle, sMu, sCat].forEach(function (s) { s.setEnabled(!S.locked); });
      standBtn.disabled = S.locked;
      emptyBtn.disabled = S.locked;
    }
    setLocked(S.locked);

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        finish();
        S.mu = o.mu; S.s = o.s; S.onLadder = o.cat; S.deg = o.deg;
        sAngle.set(o.deg); sMu.set(o.mu); sCat.set(o.s);
        erect();
        loop.requestRender();
      },
      climb,
      setParam(name, v) {
        if (name === 'locked') { setLocked(v); return; }
        if (name === 'deg') { sAngle.set(v); erect(v); }
        if (name === 'mu') { S.mu = v; sMu.set(v); erect(); }
        if (name === 's') { S.s = v; S.onLadder = true; sCat.set(v); erect(); }
        if (name === 'empty') { S.onLadder = !v; erect(); }
        if (name === 'caption') S.caption = v;
        loop.requestRender();
      },
      getState() {
        const f = forces();
        return Object.assign({ phase: S.phase, deg: S.th, s: S.s, mu: S.mu, slipAt: S.slipAt, thMin: Math.atan(1 / (2 * S.mu)) / RAD, footX: pointAt(0).x, topY: pointAt(o.L).y }, f);
      },
    };
  };
})();

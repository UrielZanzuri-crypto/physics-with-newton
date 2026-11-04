/* PHY.statics: the one place chapter 10 does equilibrium math, plus small drawing helpers.
   Load it first, after ch03/ballistics.js (tweens, ground) and ch02/plot.js (graphs).
   Counter-clockwise torque is positive. Angles are degrees, y is up, g = 10 m/s².
   reactions(loads, x1, x2): support forces of a rigid beam, from the two balance conditions.
   ladderForces, cableForces: the same two conditions for the ladder and for the hinged beam.
   curved: torque arrow. wedge, block, hatch, plank, sample: small drawing and shape helpers. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors;
  const RAD = Math.PI / 180;
  const G = 10;
  const NM = "ניוטון·מ'";

  /* Degrees that stay in order inside Hebrew text: "30°" would otherwise show its sign on the wrong side. */
  function deg(v, digits) { return PHY.fmt.LRM + PHY.fmt.deg(v, digits) + PHY.fmt.LRM; }

  /* loads: [{m, x}]. Returns the two support forces, taking moments about the first support. */
  function reactions(loads, x1, x2) {
    let W = 0, moment = 0;
    loads.forEach(function (l) { W += l.m * G; moment += l.m * G * (l.x - x1); });
    const N2 = moment / (x2 - x1);
    return { N1: W - N2, N2: N2, W: W };
  }

  /* Ladder of length L and mass m, a cat of mass M a distance s up it, at deg from the floor.
     Smooth wall, rough floor. Moments about the foot give the wall force, and the floor friction balances it. */
  function ladderForces(o) {
    const th = o.deg * RAD;
    const Nf = (o.m + o.M) * G;
    const Nw = ((o.m * G * o.L) / 2 + o.M * G * o.s) * Math.cos(th) / (o.L * Math.sin(th));
    return { Nf: Nf, Nw: Nw, f: Nw, fMax: o.mu * Nf, need: Nw / Nf, slips: Nw > o.mu * Nf + 1e-9 };
  }

  /* Horizontal beam on a wall hinge, cable from its end at deg above the beam. Moments about the hinge. */
  function cableForces(o) {
    const s = Math.sin(o.deg * RAD), c = Math.cos(o.deg * RAD);
    const T = (o.m * G * o.L / 2 + o.M * G * o.x) / (o.L * s);
    return { T: T, H: T * c, V: (o.m + o.M) * G - T * s };
  }

  /* Curved arrow around (x, y) from a0 to a1 degrees, counter-clockwise when a1 > a0. r in pixels. */
  function curved(view, x, y, r, a0, a1, o) {
    o = o || {};
    if (Math.abs(a1 - a0) < 4) return;
    const ctx = view.ctx;
    const cx = view.sx(x), cy = view.sy(y);
    const color = o.color || C.force;
    const width = o.width || 3;
    const dir = a1 > a0 ? 1 : -1;
    const head = o.head || 7 + width * 1.7;
    const headDeg = Math.min(head / r / RAD, Math.abs(a1 - a0) * 0.6);
    const endA = a1 - dir * headDeg;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -a0 * RAD, -endA * RAD, dir > 0);
    ctx.stroke();
    const tx = cx + r * Math.cos(a1 * RAD), ty = cy - r * Math.sin(a1 * RAD);
    const bx = cx + r * Math.cos(endA * RAD), by = cy - r * Math.sin(endA * RAD);
    const ux = tx - bx, uy = ty - by, len = Math.hypot(ux, uy) || 1;
    const hw = head * 0.55;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(bx - (uy / len) * hw, by + (ux / len) * hw);
    ctx.lineTo(bx + (uy / len) * hw, by - (ux / len) * hw);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (o.label) {
      const mid = ((a0 + a1) / 2) * RAD;
      const R = r + (o.labelGap || 16);
      view.screenText(cx + R * Math.cos(mid), cy - R * Math.sin(mid), o.label, { color: color, size: o.labelSize || 12.5, weight: 700, halo: true });
    }
  }

  /* A support: apex at world (x, y), pixels for size. */
  function wedge(view, x, y, w, h, o) {
    o = o || {};
    const px = view.sx(x), py = view.sy(y);
    const pts = [{ x: px, y: py }, { x: px + w / 2, y: py + h }, { x: px - w / 2, y: py + h }].map(function (p) { return view.toWorld(p.x, p.y); });
    view.poly(pts, { fill: o.fill || C.gridStrong, color: o.color || C.axis, width: 2, close: true });
  }

  /* A box whose bottom middle is at world (x, y), rotated with deg. Pixel sizes. */
  function block(view, x, y, w, h, deg, o) {
    o = o || {};
    const ctx = view.ctx;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    ctx.rotate((-(deg || 0) * Math.PI) / 180);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = o.fill || C.gold;
    ctx.strokeStyle = o.color || C.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h, w, h, Math.min(5, w / 5));
    else ctx.rect(-w / 2, -h, w, h);
    ctx.fill();
    ctx.stroke();
    if (o.slats) {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 2, -(h * k) / 3);
        ctx.lineTo(w / 2 - 2, -(h * k) / 3);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (o.label) {
      const a = ((deg || 0) * Math.PI) / 180;
      const lx = view.sx(x) - Math.sin(a) * (h / 2), ly = view.sy(y) - Math.cos(a) * (h / 2);
      view.screenText(lx, ly, o.label, { size: o.labelSize || 12, weight: 800, color: o.labelColor || C.ink });
    }
  }

  /* A wall or ceiling line with short hatch marks. dir is the side the marks go to, in world units per pixel. */
  function hatch(view, x1, y1, x2, y2, dx, dy, o) {
    o = o || {};
    const n = Math.max(3, Math.round(Math.hypot(view.sx(x2) - view.sx(x1), view.sy(y2) - view.sy(y1)) / 14));
    const k = 10 / view.scale;
    for (let i = 0; i <= n; i++) {
      const px = x1 + ((x2 - x1) * i) / n, py = y1 + ((y2 - y1) * i) / n;
      view.line(px, py, px + (dx - dy * 0.7) * k, py + (dy + dx * 0.7) * k, { color: C.soft, width: 1.4 });
    }
    view.line(x1, y1, x2, y2, { color: o.color || C.axis, width: o.width || 3 });
  }

  /* A thick bar between two world points. thick in pixels. */
  function plank(view, ax, ay, bx, by, thick, o) {
    o = o || {};
    view.line(ax, ay, bx, by, { color: o.edge || C.ink, width: thick + 3, cap: 'round', alpha: o.alpha });
    view.line(ax, ay, bx, by, { color: o.fill || C.gold, width: thick, cap: 'round', alpha: o.alpha });
  }

  /* Uniform flat shape as a grid of equal mass points: area, center of mass, and points for inertia. */
  function sample(inside, box, n) {
    const pts = [];
    let sx = 0, sy = 0;
    const dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = box.x0 + (i + 0.5) * dx, y = box.y0 + (j + 0.5) * dy;
        if (inside(x, y)) { pts.push({ x: x, y: y }); sx += x; sy += y; }
      }
    }
    return { pts: pts, area: pts.length * dx * dy, cx: sx / pts.length, cy: sy / pts.length };
  }

  PHY.statics = { G, NM, RAD, deg, reactions, ladderForces, cableForces, curved, wedge, block, hatch, plank, sample };
})();

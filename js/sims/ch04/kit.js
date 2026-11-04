/* PHY.ch04: drawing helpers shared by the chapter 4 sims. Load it right after ch02/plot.js.
   gate(): a promise that can always be settled, so a PredictCard can never hang on a reset.
   crate, ground, bathScale, springScale, paw, dial: small drawings in theme colors, read at draw time.
   shaft, cabin: the elevator, used by elevator.js and elevator-game.js. Sizes are pixels unless noted. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, C = PHY.colors;
  const RAD = Math.PI / 180;
  const HEBREW = /[֐-׿]/;
  /* The crate is always gold, in both themes, so its outline and label are one fixed dark color. */
  const DARK = 'rgb(59, 42, 32)';
  const FONT = 'Heebo, Rubik, system-ui, sans-serif';

  function gate() {
    let resolve = null;
    return {
      open() {
        if (resolve) { const r = resolve; resolve = null; r(); }
        return new Promise(function (res) { resolve = res; });
      },
      close(v) { if (resolve) { const r = resolve; resolve = null; r(v); } },
      get pending() { return !!resolve; },
    };
  }

  function label(ctx, str, x, y, size, color) {
    ctx.font = '700 ' + size + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('direction' in ctx) ctx.direction = HEBREW.test(str) ? 'rtl' : 'ltr';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  /* (x, y): world position of the middle of the bottom edge. w, h in pixels. opt: {rot, label, size, alpha}. */
  function crate(view, x, y, w, h, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    if (opt.rot) ctx.rotate((-opt.rot * Math.PI) / 180);
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    const inset = Math.min(w, h) * 0.12;
    ctx.lineJoin = 'round';
    ctx.fillStyle = C.gold;
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-w / 2, -h, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = (opt.alpha === undefined ? 1 : opt.alpha) * 0.4;
    ctx.beginPath();
    ctx.rect(-w / 2 + inset, -h + inset, w - inset * 2, h - inset * 2);
    ctx.moveTo(-w / 2 + inset, -inset);
    ctx.lineTo(w / 2 - inset, -h + inset);
    ctx.stroke();
    ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    if (opt.label) label(ctx, opt.label, 0, -h / 2, opt.size || 13, DARK);
    ctx.restore();
  }

  /* A floor across the whole visible width, with its top at world height y. */
  function ground(view, y, opt) {
    opt = opt || {};
    const r = view.visible;
    const x0 = opt.from === undefined ? r.xMin : opt.from;
    const x1 = opt.to === undefined ? r.xMax : opt.to;
    const depth = opt.depth === undefined ? y - r.yMin : opt.depth;
    view.poly([{ x: x0, y: y }, { x: x1, y: y }, { x: x1, y: y - depth }, { x: x0, y: y - depth }], { fill: C.gridStrong, alpha: 0.55, close: true });
    view.line(x0, y, x1, y, { color: C.axis, width: 2.5, cap: 'butt' });
    if (opt.ticks) {
      const every = opt.ticks;
      const shift = opt.shift || 0;
      const first = Math.ceil((x0 + shift) / every);
      for (let i = first; i * every - shift <= x1; i++) {
        const tx = i * every - shift;
        view.line(tx, y, tx - 6 / view.scale, y - 7 / view.scale, { color: C.axis, width: 1.4 });
      }
    }
  }

  /* A bathroom scale. (px, py): pixels, the middle of its top plate. */
  function bathScale(view, px, py, w, text, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    const h = opt.h || 18;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px - w / 2, py, w, h, 5);
    else ctx.rect(px - w / 2, py, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (text) view.screenText(px + (opt.textDx || 0), py + h / 2 + 0.5, text, { size: opt.size || 12, weight: 800, color: C.force });
  }

  /* A spring scale on a rope, vertical. (px, py): its center in pixels. */
  function springScale(view, px, py, text) {
    const ctx = view.ctx;
    ctx.save();
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px - 31, py - 12, 62, 24, 6);
    else ctx.rect(px - 31, py - 12, 62, 24);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    view.screenText(px, py + 0.5, text, { size: 11.5, weight: 800, color: C.force });
  }

  /* A paw pressing down (rot = 0), or pulling at any angle. (px, py): pixels, the tip of the paw. */
  function paw(view, px, py, size, rot) {
    const ctx = view.ctx;
    const s = size / 30;
    ctx.save();
    ctx.translate(px, py);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.fillStyle = C.accent;
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    /* the arm comes in from above, the pad spreads, four toes press */
    ctx.beginPath();
    ctx.moveTo(-9, -600);
    ctx.lineTo(9, -600);
    ctx.lineTo(11, -18);
    ctx.lineTo(-11, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -11, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    [-15, -5, 5, 15].forEach(function (dx) {
      ctx.beginPath();
      ctx.ellipse(dx, -3, 5.2, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  /* The dial of a scale: half a circle, 0 on the left and max on the right. (cx, cy): pixels, the pivot.
     opt: {max, value (null hides the needle), band: [lo, hi], target, unit, hidden} */
  function dial(view, cx, cy, r, opt) {
    const ctx = view.ctx;
    const max = opt.max;
    const ang = (v) => Math.PI - (Math.max(0, Math.min(max, v)) / max) * Math.PI;
    const at = (v, rr) => ({ x: cx + Math.cos(ang(v)) * rr, y: cy - Math.sin(ang(v)) * rr });
    ctx.save();
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, Math.PI, 0);
    ctx.lineTo(cx + r + 8, cy + 8);
    ctx.lineTo(cx - r - 8, cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (opt.band) {
      ctx.strokeStyle = C.good;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 12;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, -ang(opt.band[0]), -ang(opt.band[1]), false);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const step = opt.tick || max / 10;
    for (let i = 0; i * step <= max + 1e-9; i++) {
      const v = i * step;
      const a = at(v, r), b = at(v, r - (i % 2 ? 7 : 12));
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = i % 2 ? 1.4 : 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i * step <= max + 1e-9; i += 2) {
      const p = at(i * step, r - 24);
      view.screenText(p.x, p.y, F.num(i * step, 0), { size: r < 90 ? 10.5 : 12, weight: 600, color: C.soft });
    }
    if (opt.target !== undefined && opt.target !== null) {
      const a = at(opt.target, r + 7), b = at(opt.target, r - 15);
      ctx.save();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    if (opt.value !== null && opt.value !== undefined) {
      const tip = at(opt.value, r - 9);
      ctx.save();
      ctx.strokeStyle = opt.color || C.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.fillStyle = opt.color || C.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      if (opt.handle) {
        ctx.fillStyle = C.surface;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  /* Pointer position to a dial value. Null when the pointer is under the dial or far from it. */
  function dialValue(cx, cy, r, max, px, py) {
    const dx = px - cx, dy = cy - py;
    const dist = Math.hypot(dx, dy);
    if (dist > r + 34 || dist < 14 || dy < -30) return null;
    let a = Math.atan2(Math.max(0, dy), dx);
    return ((Math.PI - a) / Math.PI) * max;
  }

  /* The shaft behind the cabin: floor lines scroll past, the cabin stays still on the screen.
     o: {x, w, floorPy, pos (height of the cabin floor, m), pxPerM, floorH, target (floor number), top, bottom} */
  function shaft(view, P, o) {
    const fh = o.floorH || 3;
    const y = (h) => o.floorPy - (h - o.pos) * o.pxPerM;
    P.poly([{ x: o.x, y: o.top }, { x: o.x + o.w, y: o.top }, { x: o.x + o.w, y: o.bottom }, { x: o.x, y: o.bottom }], { fill: C.gridStrong, alpha: 0.28, close: true });
    const first = Math.floor((o.pos - (o.bottom - o.floorPy) / o.pxPerM) / fh) - 1;
    const last = Math.ceil((o.pos + (o.floorPy - o.top) / o.pxPerM) / fh) + 1;
    for (let k = first; k <= last; k++) {
      const py = y(k * fh);
      if (py < o.top - 2 || py > o.bottom + 2) continue;
      const isT = o.target === k;
      P.line(o.x, py, o.x + o.w, py, { color: isT ? C.good : C.axis, width: isT ? 4 : 1.6, cap: 'butt', alpha: isT ? 1 : 0.65 });
      view.screenText(o.x + 9, py - 9, F.num(k, 0), { size: 11, weight: isT ? 800 : 600, color: isT ? C.good : C.soft });
    }
    P.line(o.x, o.top, o.x, o.bottom, { color: C.axis, width: 2, cap: 'butt' });
    P.line(o.x + o.w, o.top, o.x + o.w, o.bottom, { color: C.axis, width: 2, cap: 'butt' });
  }

  /* The cabin with the cat on the scale. Arrows use newton-to-pixel kF.
     o: {x, y (top), w, h, reading (null shows "?"), weight, pose, cut, forces, kF, a, v, kA, kV, top} */
  function cabin(view, P, o) {
    const cx = o.x + o.w / 2;
    const floorPy = o.y + o.h;
    const ctx = view.ctx;
    if (o.cut) {
      P.line(cx, o.y, cx, o.y - 12, { color: C.axis, width: 2 });
      P.line(cx, o.y - 12, cx + 5, o.y - 18, { color: C.axis, width: 2 });
      P.line(cx, o.y - 12, cx - 5, o.y - 17, { color: C.axis, width: 2 });
      P.line(cx, o.top, cx, o.top + 12, { color: C.axis, width: 2, alpha: 0.5 });
    } else {
      P.line(cx, o.top, cx, o.y, { color: C.axis, width: 2.2 });
    }
    ctx.save();
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(o.x, o.y, o.w, o.h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const plateW = o.w * 0.78;
    bathScale(view, cx, floorPy - 22, plateW, o.reading === null ? '?' : F.unit(o.reading, 'N', 0), { h: 20, size: o.w < 110 ? 11 : 12.5 });
    const catPx = o.h * 0.62;
    P.cat(cx, floorPy - 22, { pose: o.pose || 'standing', px: catPx, anchor: [0.5, 0.96] });
    if (o.forces) {
      const midY = floorPy - 22 - catPx * 0.48;
      const k = o.kF;
      const dx = o.w * 0.33;
      if (o.reading > 0.5) {
        P.arrow(cx + dx, midY, cx + dx, midY - o.reading * k, { color: C.force, width: 3.4 });
        view.screenText(cx + dx + 1, midY - o.reading * k - 9, 'N', { size: 12.5, weight: 800, color: C.force, halo: true });
      }
      P.arrow(cx - dx, midY, cx - dx, midY + o.weight * k, { color: C.force, width: 3.4 });
      view.screenText(cx - dx, midY + o.weight * k + 10, 'mg', { size: 12.5, weight: 800, color: C.force, halo: true });
    }
    const ax = o.x + o.w + 13;
    const mid = o.y + o.h / 2;
    if (o.a !== undefined && Math.abs(o.a) > 0.05) {
      const len = Math.max(10, Math.min(o.h * 0.48, Math.abs(o.a) * (o.kA || 6)));
      P.arrow(ax, mid, ax, mid - Math.sign(o.a) * len, { color: C.acceleration, width: 3.4 });
      view.screenText(ax, mid - Math.sign(o.a) * (len + 9), 'a', { size: 12.5, weight: 800, color: C.acceleration, halo: true });
    }
    const vx = o.x - 12;
    if (o.v !== undefined && Math.abs(o.v) > 0.05) {
      const len = Math.max(10, Math.min(o.h * 0.48, Math.abs(o.v) * (o.kV || 5)));
      P.arrow(vx, mid, vx, mid - Math.sign(o.v) * len, { color: C.velocity, width: 3.4 });
      view.screenText(vx, mid - Math.sign(o.v) * (len + 9), 'v', { size: 12.5, weight: 800, color: C.velocity, halo: true });
    }
  }

  PHY.ch04 = { gate, crate, ground, bathScale, springScale, paw, dial, dialValue, shaft, cabin, DARK, RAD };
})();

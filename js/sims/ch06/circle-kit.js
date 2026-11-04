/* PHY.ch06: small helpers for the chapter 6 sims. Load after ch02/plot.js and before the other ch06 files.
   place(view, cx, cy, S): world (0, 0) lands on pixel (cx, cy), S pixels per meter.
   apple, bucket, topCar, road: drawing, with colors read at draw time.
   bar: a horizontal bar in pixels. tipLabel: text just past an arrow's tip. deg: F.deg that stays right in RTL text.
   friendly(deg): the course's exact 37 and 53 degree angles.
   settle(S): resolves a pending play() promise, so a card never hangs. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors;
  const RAD = Math.PI / 180;
  /* Water is water in both themes, and blue is reserved for velocity arrows. */
  const WATER = 'hsl(188, 85%, 45%)';

  function place(view, cx, cy, S) {
    const pad = 6;
    view.setWorld({ xMin: (pad - cx) / S, xMax: (view.w - pad - cx) / S, yMin: -(view.h - pad - cy) / S, yMax: (cy - pad) / S });
  }

  function settle(S) {
    if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
  }

  /* F.deg, with a mark that keeps the degree sign on the right of the number inside right-to-left text. */
  const deg = (x, digits) => PHY.fmt.deg(x, digits) + '\u200E';

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);

  /* In this course sin 37° = 0.6 and cos 37° = 0.8, so the sims use those exact values at those two angles. */
  function friendly(deg) {
    if (deg === 37) return Math.atan2(3, 4);
    if (deg === 53) return Math.atan2(4, 3);
    return deg * RAD;
  }

  function apple(view, x, y, px, o) {
    o = o || {};
    const ctx = view.ctx;
    const r = (px || 16) / 2;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = C.apple;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (!o.plain) {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.28, -r * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(r * 0.62, -r * 1.22, r * 0.42, r * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = C.leaf;
      ctx.fill();
    }
    ctx.restore();
  }

  /* A bucket whose open end faces the direction deg (y up). full: 0..1 of water in it. */
  function bucket(view, x, y, deg, o) {
    o = o || {};
    const size = o.size || 30;
    const full = o.full === undefined ? 1 : o.full;
    const ctx = view.ctx;
    const w0 = size * 0.42, w1 = size * 0.56, L = size * 0.92;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    ctx.rotate(-deg * RAD);
    /* +x points out of the opening, -x is the bottom of the bucket */
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(-L / 2, -w0);
    ctx.lineTo(L / 2, -w1);
    ctx.lineTo(L / 2, w1);
    ctx.lineTo(-L / 2, w0);
    ctx.closePath();
    ctx.fill();
    if (full > 0) {
      const lev = -L / 2 + L * 0.72 * full;
      const wl = w0 + ((lev + L / 2) / L) * (w1 - w0);
      ctx.fillStyle = WATER;
      ctx.beginPath();
      ctx.moveTo(-L / 2, -w0);
      ctx.lineTo(lev, -wl);
      ctx.lineTo(lev, wl);
      ctx.lineTo(-L / 2, w0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(L / 2, -w1);
    ctx.lineTo(-L / 2, -w0);
    ctx.lineTo(-L / 2, w0);
    ctx.lineTo(L / 2, w1);
    ctx.stroke();
    /* the handle, drawn to the center of the opening */
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L / 2, -w1);
    ctx.lineTo(L / 2 + size * 0.3, 0);
    ctx.lineTo(L / 2, w1);
    ctx.stroke();
    ctx.restore();
  }

  /* A car from above, heading along deg (y up). o: {len, wid, color, alpha, cargo} in pixels. */
  function topCar(view, x, y, deg, o) {
    o = o || {};
    const L = o.len || 38, W = o.wid || 19;
    const ctx = view.ctx;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    ctx.rotate(-deg * RAD);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.lineJoin = 'round';
    ctx.fillStyle = C.ink;
    [[-L * 0.3, -W * 0.54], [L * 0.28, -W * 0.54], [-L * 0.3, W * 0.54], [L * 0.28, W * 0.54]].forEach(function (p) {
      ctx.fillRect(p[0] - L * 0.09, p[1] - W * 0.1, L * 0.18, W * 0.2);
    });
    ctx.fillStyle = o.color || C.accent;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-L / 2, -W / 2, L, W, W * 0.28);
    else ctx.rect(-L / 2, -W / 2, L, W);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.surface;
    if (o.cargo) {
      ctx.fillRect(L * 0.2, -W * 0.36, L * 0.14, W * 0.72);
      ctx.strokeRect(L * 0.2, -W * 0.36, L * 0.14, W * 0.72);
      ctx.strokeRect(-L * 0.44, -W * 0.38, L * 0.56, W * 0.76);
    } else {
      ctx.fillRect(L * 0.1, -W * 0.36, L * 0.17, W * 0.72);
      ctx.strokeRect(L * 0.1, -W * 0.36, L * 0.17, W * 0.72);
      ctx.fillRect(-L * 0.32, -W * 0.3, L * 0.12, W * 0.6);
      ctx.strokeRect(-L * 0.32, -W * 0.3, L * 0.12, W * 0.6);
    }
    ctx.restore();
  }

  /* Text just past the tip of an arrow from (x1, y1) to (x2, y2), so labels stay off each other. */
  function tipLabel(view, x1, y1, x2, y2, text, o) {
    o = o || {};
    const dx = view.sx(x2) - view.sx(x1), dy = view.sy(y2) - view.sy(y1);
    const d = Math.hypot(dx, dy) || 1;
    const gap = o.gap || 11;
    view.screenText(view.sx(x2) + (dx / d) * gap, view.sy(y2) + (dy / d) * gap, text, { size: o.size || 13.5, weight: 700, color: o.color, halo: true });
  }

  /* A road along world points. Widths in pixels. */
  function road(view, pts, o) {
    o = o || {};
    const w = o.width || 30;
    view.poly(pts, { color: C.shade, width: w });
    view.poly(pts, { color: C.axis, width: w + 2, alpha: 0.28 });
    view.poly(pts, { color: C.bg, width: 1.6, dash: [9, 10], alpha: 0.95 });
  }

  /* A labeled bar in pixels: frac 0..1 of its width is filled. limit: a mark at that fraction. */
  function bar(view, x, y, w, h, frac, o) {
    o = o || {};
    const ctx = view.ctx;
    ctx.save();
    ctx.fillStyle = C.grid;
    ctx.strokeStyle = C.gridStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 3);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    const f = clamp(frac, 0, 1);
    if (f > 0) {
      ctx.fillStyle = o.color || C.force;
      ctx.fillRect(x + 1, y + 1, Math.max(0, f * w - 2), h - 2);
    }
    if (o.limit !== undefined) {
      const mx = x + clamp(o.limit, 0, 1) * w;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, y - 3);
      ctx.lineTo(mx, y + h + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  PHY.ch06 = { RAD, WATER, deg, place, settle, clamp, lerp, ease, friendly, apple, bucket, topCar, road, bar, tipLabel };
})();

/* PHY.ch07: chapter 7 drawing helpers. Loads after js/sims/ch02/plot.js, whose pix, Plot and tweens it reuses.
   Everything here works in screen pixels and reads its colors at draw time.
   stars, caption, ship, spaceCat, wrench, cart, bar, signedBar, row, plus the unit strings PU and JU. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const C = PHY.colors;
  const FONT = 'Heebo, Rubik, system-ui, sans-serif';
  const PU = 'ק"ג·מ/ש';
  const JU = "ג'ול";

  /* A fixed star field, as fractions of the canvas, so it never flickers between frames. */
  const STARS = [];
  (function () {
    let s = 40503;
    const r = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 64; i++) STARS.push({ x: r(), y: r(), r: 0.7 + r() * 1.2, z: 0.3 + r() * 0.7 });
  })();

  /* shiftPx slides the field sideways, nearer stars faster, to show motion when the camera follows something. */
  function stars(view, shiftPx, heightPx) {
    const ctx = view.ctx, W = view.w, H = heightPx || view.h;
    ctx.save();
    ctx.fillStyle = C.soft;
    STARS.forEach(function (p) {
      const raw = p.x * W - (shiftPx || 0) * p.z;
      const x = ((raw % W) + W) % W;
      ctx.globalAlpha = 0.25 + p.z * 0.45;
      ctx.beginPath();
      ctx.arc(x, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /* A pill caption that never runs off a phone: it shrinks first, then breaks in two lines. */
  function caption(view, text, y) {
    if (!text) return;
    const ctx = view.ctx;
    const maxW = view.w - 34;
    y = y === undefined ? 20 : y;
    let size = 14;
    const measure = function (s) {
      ctx.save();
      ctx.font = '700 ' + size + 'px ' + FONT;
      const w = ctx.measureText(s).width;
      ctx.restore();
      return w;
    };
    while (measure(text) > maxW && size > 12) size -= 0.5;
    if (measure(text) <= maxW) {
      view.screenText(view.w / 2, y, text, { size: size, weight: 700, pill: true });
      return;
    }
    const words = text.split(' ');
    let cut = 1, best = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = measure(words.slice(0, i).join(' ')), b = measure(words.slice(i).join(' '));
      if (Math.max(a, b) < best) { best = Math.max(a, b); cut = i; }
    }
    view.screenText(view.w / 2, y, words.slice(0, cut).join(' '), { size: size, weight: 700, pill: true });
    view.screenText(view.w / 2, y + size + 13, words.slice(cut).join(' '), { size: size, weight: 700, pill: true });
  }

  /* The ship, with its door on the right side at (px, py). The hull runs off to the left. */
  function ship(view, px, py, k, opt) {
    const ctx = view.ctx;
    k = k || 1;
    opt = opt || {};
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = C.ink;
    /* fins */
    ctx.fillStyle = C.accent;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(-96, s * 26);
      ctx.lineTo(-136, s * 58);
      ctx.lineTo(-66, s * 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    /* hull */
    ctx.fillStyle = C.surface;
    ctx.beginPath();
    ctx.moveTo(-170, -32);
    ctx.lineTo(-30, -34);
    ctx.quadraticCurveTo(6, -30, 6, 0);
    ctx.quadraticCurveTo(6, 30, -30, 34);
    ctx.lineTo(-170, 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    /* windows */
    ctx.fillStyle = C.gold;
    [-54, -92].forEach(function (x) {
      ctx.beginPath();
      ctx.arc(x, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    /* door */
    ctx.strokeStyle = opt.doorColor || C.good;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(3, -15);
    ctx.lineTo(3, 15);
    ctx.stroke();
    ctx.restore();
  }

  /* Newton in a suit: the cat inside a round bubble helmet that covers all of him. (x, y) is his center, in meters. */
  function spaceCat(view, x, y, o) {
    o = o || {};
    const px = o.px || 52;
    PHY.mascot.draw(view, x, y, { pose: o.pose || 'flying', px: px, rot: o.rot, flipX: o.flipX, anchor: [0.5, 0.5], alpha: o.alpha });
    view.circle(x, y, px * 0.56, { px: true, fill: C.glow, alpha: o.alpha === undefined ? 0.55 : o.alpha * 0.55 });
    view.circle(x, y, px * 0.56, { px: true, color: C.soft, width: 2, alpha: o.alpha });
  }

  function wrench(view, px, py, rotDeg, size) {
    const ctx = view.ctx;
    const k = (size || 30) / 30;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(((rotDeg || 0) * Math.PI) / 180);
    ctx.scale(k, k);
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(14, 0, 7, -2.2, 2.2);
    ctx.stroke();
    ctx.restore();
  }

  /* A cart with its wheels on the ground line. cx and groundY in pixels. opt: color, label, bumpL, bumpR (pixel lengths). */
  function cart(view, cx, groundY, w, h, opt) {
    opt = opt || {};
    const ctx = view.ctx;
    const color = opt.color || C.accent;
    const wheel = Math.min(6, h * 0.18);
    const top = groundY - wheel * 2 - h;
    ctx.save();
    ctx.lineJoin = 'round';
    /* bumpers */
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const midY = top + h * 0.55;
    if (opt.bumpR) {
      ctx.beginPath(); ctx.moveTo(cx + w / 2, midY); ctx.lineTo(cx + w / 2 + opt.bumpR, midY);
      ctx.moveTo(cx + w / 2 + opt.bumpR, midY - 7); ctx.lineTo(cx + w / 2 + opt.bumpR, midY + 7); ctx.stroke();
    }
    if (opt.bumpL) {
      ctx.beginPath(); ctx.moveTo(cx - w / 2, midY); ctx.lineTo(cx - w / 2 - opt.bumpL, midY);
      ctx.moveTo(cx - w / 2 - opt.bumpL, midY - 7); ctx.lineTo(cx - w / 2 - opt.bumpL, midY + 7); ctx.stroke();
    }
    /* body */
    ctx.fillStyle = C.surface;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - w / 2, top, w, h, 6);
    else ctx.rect(cx - w / 2, top, w, h);
    ctx.fill();
    ctx.stroke();
    /* wheels */
    ctx.fillStyle = C.ink;
    [-0.28, 0.28].forEach(function (s) {
      ctx.beginPath();
      ctx.arc(cx + s * w, groundY - wheel, wheel, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    if (opt.label) view.screenText(cx, top + h / 2, opt.label, { size: opt.labelSize || 12, weight: 700, color: C.ink });
    return { top: top };
  }

  /* A plain filled bar. */
  function bar(view, x, y, w, h, color, alpha) {
    if (w <= 0 || h <= 0) return;
    const ctx = view.ctx;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(3, w / 2, h / 2));
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.restore();
  }

  /* A bar growing from the middle of its box: right for positive, left for negative, like the x axis. */
  function signedBar(view, x, y, w, h, value, max, color) {
    const mid = x + w / 2;
    const len = max > 0 ? Math.min(1, Math.abs(value) / max) * (w / 2) : 0;
    bar(view, x, y, w, h, C.grid);
    if (value >= 0) bar(view, mid, y, len, h, color);
    else bar(view, mid - len, y, len, h, color);
    const ctx = view.ctx;
    ctx.save();
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mid, y - 2);
    ctx.lineTo(mid, y + h + 2);
    ctx.stroke();
    ctx.restore();
  }

  /* One table row in a bar panel: the value on the far left, the name on the far right. */
  function row(view, y, h, name, value, o) {
    o = o || {};
    const W = view.w;
    view.screenText(W - (o.pad || 10), y + h / 2, name, { size: 11.5, weight: 600, align: 'right', color: o.nameColor || C.ink });
    if (value !== undefined && value !== null) view.screenText(o.pad || 10, y + h / 2, value, { size: 11.5, weight: 700, align: 'left', color: o.valueColor || C.ink });
  }

  PHY.ch07 = { PU, JU, stars, caption, ship, spaceCat, wrench, cart, bar, signedBar, row };
})();

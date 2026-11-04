/* PHY.ch05: shared parts of the energy chapter.
   Track(points): a rail measured in arc length. at(s) gives position, unit tangent and curvature.
   line, fn, join, curveThrough: ways to build the points of a rail.
   Rider(track, o): a bead on a rail. Each step integrates the tangential motion, then sets the speed
     from the energy still available, so it cannot gain or leak energy however long it runs. Everything
     is per unit mass: multiply by m for joules. Friction removes energy, and heat records what it took.
   energyPanel, miniBar: the stacked energy bars. drawSpring, drawCrate, ground, roughPatch, rideCat, pill. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, C = PHY.colors;
  const G = 10;
  const JOULE = "ג'ול";

  function Track(points) {
    const n = points.length;
    const xs = new Float64Array(n), ys = new Float64Array(n), S = new Float64Array(n);
    const ux = new Float64Array(n), uy = new Float64Array(n), kk = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = points[i].x;
      ys[i] = points[i].y;
      if (i) S[i] = S[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.hypot(dx, dy) || 1;
      ux[i] = dx / l;
      uy[i] = dy / l;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      const ds = S[b] - S[a] || 1;
      /* Signed curvature: positive when the rail bends to the left of the direction of travel. */
      kk[i] = (ux[a] * uy[b] - uy[a] * ux[b]) / ds;
    }
    const L = S[n - 1];
    let last = 0;
    function find(s) {
      if (s <= 0) return 0;
      if (s >= L) return n - 2;
      let i = last;
      while (i < n - 2 && S[i + 1] < s) i++;
      while (i > 0 && S[i] > s) i--;
      last = i;
      return i;
    }
    return {
      length: L,
      points,
      at(s) {
        const c = s < 0 ? 0 : s > L ? L : s;
        const i = find(c);
        const seg = S[i + 1] - S[i] || 1;
        const f = (c - S[i]) / seg;
        return {
          x: xs[i] + (xs[i + 1] - xs[i]) * f,
          y: ys[i] + (ys[i + 1] - ys[i]) * f,
          ux: ux[i] + (ux[i + 1] - ux[i]) * f,
          uy: uy[i] + (uy[i + 1] - uy[i]) * f,
          k: kk[i] + (kk[i + 1] - kk[i]) * f,
        };
      },
      /* The arc length of the point nearest to (x, y). */
      nearest(p) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < n; i++) {
          const d = (xs[i] - p.x) * (xs[i] - p.x) + (ys[i] - p.y) * (ys[i] - p.y);
          if (d < bd) { bd = d; best = i; }
        }
        return S[best];
      },
      /* The arc length where the rail first reaches this x, for rails that move rightward. */
      atX(x) {
        for (let i = 1; i < n; i++) {
          if (xs[i] >= x) return S[i - 1] + ((x - xs[i - 1]) / ((xs[i] - xs[i - 1]) || 1)) * (S[i] - S[i - 1]);
        }
        return L;
      },
    };
  }

  /* ---------- Building rails ---------- */
  function line(x0, y0, x1, y1, n) {
    n = n || 40;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
    return pts;
  }
  function fn(f, x0, x1, n) {
    n = n || 200;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push({ x, y: f(x) });
    }
    return pts;
  }
  /* Joins point lists, dropping repeated joints. */
  function join() {
    const out = [];
    Array.prototype.forEach.call(arguments, function (list) {
      list.forEach(function (p) {
        const q = out[out.length - 1];
        if (!q || Math.hypot(q.x - p.x, q.y - p.y) > 1e-6) out.push(p);
      });
    });
    return out;
  }
  /* A smooth curve y(x) through control points with increasing x. The slopes are the monotone (PCHIP)
     ones, so it never overshoots: a hill is exactly as high as its control point. */
  function curveThrough(ctrl, step) {
    const n = ctrl.length;
    const h = [], d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) {
      h[i] = ctrl[i + 1].x - ctrl[i].x;
      d[i] = (ctrl[i + 1].y - ctrl[i].y) / h[i];
    }
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] > 0) {
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    /* A straight start and end, so that a cart released at the first point really starts to move. */
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    const pts = [];
    const ds = step || 0.04;
    for (let i = 0; i < n - 1; i++) {
      const count = Math.max(4, Math.ceil(h[i] / ds));
      for (let j = i ? 1 : 0; j <= count; j++) {
        const t = j / count, t2 = t * t, t3 = t2 * t;
        pts.push({
          x: ctrl[i].x + h[i] * t,
          y: (2 * t3 - 3 * t2 + 1) * ctrl[i].y + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ctrl[i + 1].y + (t3 - t2) * h[i] * m[i + 1],
        });
      }
    }
    return pts;
  }

  /* ---------- A bead on a rail ---------- */
  /* o: {s, v, g, mu(s), spring: {s, kOverM}, ends: 'stop' | 'bounce', kCap}
     spring: an elastic contact behind arc length spring.s, pushing the bead forward until it passes that point.
     r.stopped is set when friction holds the bead, or when a 'stop' end is reached (then r.end is 'start' or 'finish'). */
  function Rider(track, o) {
    o = Object.assign({ s: 0, v: 0, g: G, mu: null, spring: null, ends: 'stop', kCap: 3 }, o || {});
    const L = track.length;
    function pot(s) {
      const p = track.at(s);
      let u = o.g * p.y, du = o.g * p.uy;
      if (o.spring) {
        const d = o.spring.s - s;
        if (d > 0) {
          u += 0.5 * o.spring.kOverM * d * d;
          du -= o.spring.kOverM * d;
        }
      }
      return { u, du, p };
    }
    const r = { s: o.s, v: o.v, t: 0, heat: 0, path: 0, roughPath: 0, stopped: false, end: null, tEnd: null, bounces: 0, reversals: 0, e: 0, pot };
    r.e = 0.5 * r.v * r.v + pot(r.s).u;
    r.step = function (dt) {
      if (r.stopped) return;
      r.t += dt;
      const s0 = r.s, v0 = r.v;
      const a = -pot(s0).du;
      let v1 = v0 + a * dt;
      let s1 = s0 + 0.5 * (v0 + v1) * dt;
      if (s1 >= L || s1 <= 0) {
        const edge = s1 >= L ? L : 0;
        if (o.ends === 'bounce') {
          /* A wall. Too slow to bounce means it is simply resting against the wall. */
          if (Math.abs(v1) < 0.08) {
            r.s = edge;
            r.v = 0;
            r.heat += Math.max(0, r.e - pot(edge).u);
            r.e = pot(edge).u;
            r.stopped = true;
            r.end = 'wall';
            return;
          }
          s1 = 2 * edge - s1;
          v1 = -v1;
          r.bounces++;
        } else {
          r.tEnd = r.t - dt + (Math.abs(edge - s0) / (Math.abs(s1 - s0) || 1)) * dt;
          r.path += Math.abs(edge - s0);
          r.s = edge;
          const K = Math.max(0, r.e - pot(edge).u);
          r.v = (v1 < 0 ? -1 : 1) * Math.sqrt(2 * K);
          r.stopped = true;
          r.end = edge === L ? 'finish' : 'start';
          return;
        }
      }
      const ds = Math.abs(s1 - s0);
      r.path += ds;
      /* Averaged across the step, so a patch's edge does not depend on where a step happens to land. */
      let mu = 0, rough = 0;
      if (o.mu) {
        for (let i = 0; i < 8; i++) {
          const m = o.mu(s0 + ((s1 - s0) * (i + 0.5)) / 8);
          mu += m / 8;
          if (m > 0) rough += 1 / 8;
        }
      }
      if (mu > 0 && ds > 0) {
        const q = track.at(s1);
        const k = Math.max(-o.kCap, Math.min(o.kCap, q.k));
        const N = Math.abs(o.g * q.ux + v0 * v0 * k);
        const loss = mu * N * ds;
        r.e -= loss;
        r.heat += loss;
        r.roughPath += ds * rough;
      }
      r.s = s1;
      const p1 = pot(s1);
      const K = r.e - p1.u;
      if (K >= 0) {
        const sp = Math.sqrt(2 * K);
        const dir = v1 < 0 ? -1 : v1 > 0 ? 1 : p1.du > 0 ? -1 : 1;
        if (v0 * dir < 0) r.reversals++;
        r.v = dir * sp;
      } else if (mu > 0) {
        /* Friction asked for more than there was: it takes only what is left. */
        r.heat += K;
        r.e = p1.u;
        r.v = 0;
      } else {
        if (v0 * v1 < 0) r.reversals++;
        r.v = v1; /* a turning point, inside one step */
      }
      if (Math.abs(r.v) < 0.02) {
        const m2 = o.mu ? o.mu(s1) : 0;
        if (Math.abs(p1.du) <= m2 * o.g * Math.abs(p1.p.ux) + 1e-4) {
          r.v = 0;
          r.stopped = true;
        }
      }
    };
    return r;
  }

  /* ---------- Drawing ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /* A stacked bar of energies, with a legend under it. Pixel coordinates. The whole bar keeps its length
     when energy only changes form, which is the point of the picture.
     o: {x, y, w, max, items: [{label, value, color}], sum (label, or false), unit, digits}. Returns its height. */
  function energyPanel(view, o) {
    const ctx = view.ctx;
    const x = o.x === undefined ? 8 : o.x, y = o.y === undefined ? 8 : o.y;
    const w = o.w || view.w - 16;
    const pad = 7, barH = 12;
    const unit = o.unit || JOULE;
    const digits = o.digits === undefined ? 0 : o.digits;
    const items = o.items;
    const showSum = o.sum !== false;
    const cols = items.length + (showSum ? 1 : 0);
    const H = pad + barH + 5 + 13 + 14 + pad - 2;
    ctx.save();
    ctx.globalAlpha = 0.93;
    ctx.fillStyle = C.surface;
    roundRect(ctx, x, y, w, H, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.gridStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    const bx = x + pad, by = y + pad, bw = w - pad * 2;
    ctx.fillStyle = C.grid;
    roundRect(ctx, bx, by, bw, barH, 5);
    ctx.fill();
    ctx.save();
    roundRect(ctx, bx, by, bw, barH, 5);
    ctx.clip();
    let cx = bx, total = 0;
    items.forEach(function (it) {
      const part = Math.max(0, it.value);
      total += part;
      const seg = o.max > 0 ? (part / o.max) * bw : 0;
      ctx.fillStyle = it.color;
      ctx.fillRect(cx, by, seg, barH);
      cx += seg;
    });
    ctx.restore();
    ctx.restore();
    const cw = bw / cols;
    items.forEach(function (it, i) {
      const tx = bx + cw * (i + 0.5);
      const ty = by + barH + 11;
      const lab = it.label;
      view.screenText(tx + 6, ty, lab, { size: 11, weight: 600, color: C.soft });
      ctx.save();
      ctx.font = '600 11px Heebo, Rubik, system-ui, sans-serif';
      const lw = ctx.measureText(lab).width;
      ctx.fillStyle = it.color;
      ctx.fillRect(tx + 6 - lw / 2 - 11, ty - 4, 8, 8);
      ctx.restore();
      view.screenText(tx, ty + 14, F.unit(Math.max(0, it.value), unit, digits), { size: 12, weight: 700, color: C.ink });
    });
    if (showSum) {
      const tx = bx + cw * (items.length + 0.5);
      view.screenText(tx, by + barH + 11, o.sum || 'סך הכול', { size: 11, weight: 700, color: C.ink });
      view.screenText(tx, by + barH + 25, F.unit(total, unit, digits), { size: 12, weight: 800, color: C.ink });
    }
    return H;
  }

  /* One thin bar with a label above it. segs: [{value, color}]. Pixel coordinates. */
  function miniBar(view, x, y, w, o) {
    const ctx = view.ctx;
    const h = o.h || 9;
    view.screenText(x, y + 6, o.label, { size: o.size || 11.5, weight: 600, align: 'left', color: C.ink, halo: true });
    if (o.right) view.screenText(x + w, y + 6, o.right, { size: o.size || 11.5, weight: 700, align: 'right', color: C.ink, halo: true });
    const by = y + 14;
    ctx.save();
    ctx.fillStyle = C.grid;
    roundRect(ctx, x, by, w, h, 4);
    ctx.fill();
    roundRect(ctx, x, by, w, h, 4);
    ctx.clip();
    let cx = x;
    o.segs.forEach(function (s) {
      const seg = (Math.max(0, s.value) / o.max) * w;
      ctx.fillStyle = s.color;
      ctx.fillRect(cx, by, seg, h);
      cx += seg;
    });
    ctx.restore();
    return 14 + h;
  }

  /* A zigzag spring between two world points. The coil width is in pixels. */
  function drawSpring(view, x1, y1, x2, y2, o) {
    o = o || {};
    const coils = o.coils || 9;
    const wid = (o.width || 10) / view.scale;
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const pts = [{ x: x1, y: y1 }];
    const lead = Math.min(0.12 * l, 12 / view.scale);
    const a = lead, b = l - lead;
    const zig = coils * 2;
    pts.push({ x: x1 + ux * a, y: y1 + uy * a });
    for (let i = 1; i < zig; i++) {
      const d = a + ((b - a) * i) / zig;
      const side = i % 2 ? 1 : -1;
      pts.push({ x: x1 + ux * d + nx * wid * side, y: y1 + uy * d + ny * wid * side });
    }
    pts.push({ x: x1 + ux * b, y: y1 + uy * b });
    pts.push({ x: x2, y: y2 });
    view.poly(pts, { color: o.color || C.soft, width: o.lineWidth || 2.5 });
  }

  /* A wooden crate. (x, y) is the middle of its bottom edge, size in pixels. */
  function drawCrate(view, x, y, size, o) {
    o = o || {};
    const ctx = view.ctx;
    const px = view.sx(x), py = view.sy(y);
    const s = size;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(px, py);
    if (o.rot) ctx.rotate((-o.rot * Math.PI) / 180);
    ctx.fillStyle = o.fill || 'rgb(197, 130, 63)';
    ctx.strokeStyle = 'rgb(59, 42, 32)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(-s / 2, -s, s, s);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-s / 2, -s);
    ctx.lineTo(s / 2, 0);
    ctx.moveTo(s / 2, -s);
    ctx.lineTo(-s / 2, 0);
    ctx.stroke();
    ctx.restore();
    if (o.label) view.screenText(px, py - s / 2, o.label, { size: o.labelSize || 11, weight: 800, color: 'rgb(42, 26, 16)' });
  }

  /* The floor: a line and short hatch marks under it. */
  function ground(view, x0, x1, y, o) {
    o = o || {};
    const step = (o.every || 14) / view.scale;
    view.line(x0, y, x1, y, { color: C.axis, width: 2.5, cap: 'butt' });
    for (let x = x0; x <= x1; x += step) {
      view.line(x, y, x - 6 / view.scale, y - 6 / view.scale, { color: C.gridStrong, width: 1.5 });
    }
  }

  /* A rough stretch of floor. heat from 0 to 1 makes it glow. */
  function roughPatch(view, x0, x1, y, o) {
    o = o || {};
    const heat = o.heat || 0;
    const ctx = view.ctx;
    const a = view.sx(x0), b = view.sx(x1), py = view.sy(y);
    ctx.save();
    ctx.fillStyle = C.gold;
    ctx.globalAlpha = 0.34;
    ctx.fillRect(a, py, b - a, 7);
    if (heat > 0) {
      ctx.fillStyle = C.apple;
      ctx.globalAlpha = 0.25 + 0.65 * Math.min(1, heat);
      ctx.fillRect(a, py - 2, b - a, 9);
    }
    ctx.restore();
    const n = Math.max(3, Math.round((b - a) / 7));
    for (let i = 0; i <= n; i++) {
      const px = a + ((b - a) * i) / n;
      view.screenText(px, py - 1, '^', { size: 10, weight: 800, color: heat > 0.05 ? C.apple : C.axis });
    }
  }

  /* The cat riding the rail, feet on it, tilted with the slope. */
  function rideCat(view, p, o) {
    o = o || {};
    const rot = (Math.atan2(p.uy, p.ux) * 180) / Math.PI;
    PHY.mascot.draw(view, p.x, p.y, { pose: o.pose || 'sliding', px: o.px || 40, rot: rot, flipX: !!o.flip, alpha: o.alpha });
  }

  /* A little cart on the rail, with the cat's feet on top of it. Returns the point for the cat. */
  function drawCart(view, p, o) {
    o = o || {};
    const w = o.w || 34, h = o.h || 10;
    const ctx = view.ctx;
    const ang = Math.atan2(p.uy, p.ux);
    ctx.save();
    ctx.translate(view.sx(p.x), view.sy(p.y));
    ctx.rotate(-ang);
    ctx.fillStyle = C.axis;
    [-0.3, 0.3].forEach(function (k) {
      ctx.beginPath();
      ctx.arc(k * w, -3, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = C.accent;
    ctx.strokeStyle = 'rgb(59, 42, 32)';
    ctx.lineWidth = 1.6;
    roundRect(ctx, -w / 2, -5 - h, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const lift = (h + 4) / view.scale;
    return { x: p.x - p.uy * lift, y: p.y + p.ux * lift, ux: p.ux, uy: p.uy };
  }

  const unitJ = (v, digits) => F.unit(v, JOULE, digits === undefined ? 0 : digits);
  const unitW = (v, digits) => F.unit(v, 'ואט', digits === undefined ? 0 : digits);

  PHY.ch05 = { G, JOULE, Track, Rider, line, fn, join, curveThrough, energyPanel, miniBar, drawSpring, drawCrate, ground, roughPatch, rideCat, drawCart, unitJ, unitW };
})();

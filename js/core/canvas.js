/* PHY.canvas: HiDPI canvas with a world coordinate system (x right, y UP, meters).
   PHY.colors: canvas colors mirrored from the CSS variables, mutated in place on theme change.
   PHY.theme: light/dark switch.

   const view = PHY.canvas.create(canvasEl, {world: {xMin, xMax, yMin, yMax}, aspect: 16 / 9, minHeight, maxHeight});
   Scale is always uniform: 1 m is the same number of pixels on both axes. */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});

  const VARS = {
    velocity: '--c-velocity',
    acceleration: '--c-acceleration',
    force: '--c-force',
    displacement: '--c-displacement',
    accent: '--accent',
    apple: '--apple',
    leaf: '--leaf',
    gold: '--gold',
    good: '--good',
    bad: '--bad',
    surface: '--surface',
    bg: '--canvas-bg',
    grid: '--canvas-grid',
    gridStrong: '--canvas-grid-strong',
    axis: '--canvas-axis',
    ink: '--canvas-ink',
    soft: '--canvas-soft',
    shade: '--canvas-shade',
    glow: '--canvas-glow',
  };

  /* Read these fresh at draw time (PHY.colors.force), never cache them in a sim. */
  PHY.colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    Object.keys(VARS).forEach(function (k) {
      PHY.colors[k] = cs.getPropertyValue(VARS[k]).trim();
    });
  }
  readColors();

  PHY.theme = {
    KEY: 'phy-theme',
    get() { return document.documentElement.getAttribute('data-theme') || 'light'; },
    set(t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem(PHY.theme.KEY, t); } catch (e) { /* session only */ }
      readColors();
      document.dispatchEvent(new CustomEvent('phy:theme', { detail: { theme: t } }));
    },
    toggle() { PHY.theme.set(PHY.theme.get() === 'dark' ? 'light' : 'dark'); },
  };

  const HEBREW = /[֐-׿]/;
  const FONT = 'Heebo, Rubik, system-ui, sans-serif';

  function create(canvas, o) {
    o = o || {};
    const ctx = canvas.getContext('2d');
    canvas.setAttribute('dir', 'ltr');
    let world = o.world || { xMin: -5, xMax: 5, yMin: -3, yMax: 3 };
    const aspect = o.aspect || 16 / 9;
    const minH = o.minHeight || 220;
    const maxH = o.maxHeight || 520;
    const pad = o.padding === undefined ? 6 : o.padding;
    let W = 0, H = 0, S = 1, ox = 0, oy = 0, dpr = 1;
    const resizeCbs = [];

    const view = {
      canvas, ctx,
      get w() { return W; },
      get h() { return H; },
      get scale() { return S; },
      get world() { return world; },
      /* The world rectangle actually visible, which is larger than `world` when the aspect differs. */
      get visible() { return { xMin: (0 - ox) / S, xMax: (W - ox) / S, yMin: (oy - H) / S, yMax: oy / S }; },
      sx: (x) => ox + x * S,
      sy: (y) => oy - y * S,
      toScreen: (x, y) => ({ x: ox + x * S, y: oy - y * S }),
      toWorld: (px, py) => ({ x: (px - ox) / S, y: (oy - py) / S }),
      setWorld(w) { world = w; fit(); },
      onResize(fn) { resizeCbs.push(fn); },
      resize,

      clear(color) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = color || PHY.colors.bg;
        ctx.fillRect(0, 0, W, H);
      },

      grid(step, opt) {
        opt = opt || {};
        const r = view.visible;
        const major = opt.majorEvery || 0;
        step = step || 1;
        ctx.lineWidth = 1;
        for (let i = Math.ceil(r.xMin / step); i * step <= r.xMax; i++) {
          ctx.strokeStyle = major && i % major === 0 ? PHY.colors.gridStrong : PHY.colors.grid;
          const px = Math.round(view.sx(i * step)) + 0.5;
          ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
        }
        for (let j = Math.ceil(r.yMin / step); j * step <= r.yMax; j++) {
          ctx.strokeStyle = major && j % major === 0 ? PHY.colors.gridStrong : PHY.colors.grid;
          const py = Math.round(view.sy(j * step)) + 0.5;
          ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
        }
      },

      /* Axes through (ox, oy). opt: {origin, xLabel, yLabel, tickEvery, tickLabels, xOnly, yOnly} */
      axes(opt) {
        opt = opt || {};
        const c = PHY.colors.axis;
        const o0 = opt.origin || { x: 0, y: 0 };
        const r = view.visible;
        const margin = 6 / S;
        if (!opt.yOnly) {
          view.arrow(r.xMin + margin, o0.y, r.xMax - margin, o0.y, { color: c, width: 1.6, head: 9 });
          if (opt.xLabel !== false) view.text(r.xMax - 16 / S, o0.y, opt.xLabel || 'x', { color: c, size: 13, weight: 600, offset: [0, 13] });
        }
        if (!opt.xOnly) {
          view.arrow(o0.x, r.yMin + margin, o0.x, r.yMax - margin, { color: c, width: 1.6, head: 9 });
          if (opt.yLabel !== false) view.text(o0.x, r.yMax - 14 / S, opt.yLabel || 'y', { color: c, size: 13, weight: 600, offset: [-11, 0] });
        }
        if (opt.tickEvery) {
          const t = opt.tickEvery;
          ctx.strokeStyle = c; ctx.lineWidth = 1.2;
          if (!opt.yOnly) {
            for (let i = Math.ceil(r.xMin / t); i * t <= r.xMax - 1 / S; i++) {
              const x = i * t + o0.x;
              if (Math.abs(i) < 1e-9) continue;
              ctx.beginPath(); ctx.moveTo(view.sx(x), view.sy(o0.y) - 3); ctx.lineTo(view.sx(x), view.sy(o0.y) + 3); ctx.stroke();
              if (opt.tickLabels) view.text(x, o0.y, PHY.fmt.num(i * t), { color: PHY.colors.soft, size: 11, offset: [0, 13] });
            }
          }
          if (!opt.xOnly) {
            for (let j = Math.ceil(r.yMin / t); j * t <= r.yMax - 1 / S; j++) {
              const y = j * t + o0.y;
              if (Math.abs(j) < 1e-9) continue;
              ctx.beginPath(); ctx.moveTo(view.sx(o0.x) - 3, view.sy(y)); ctx.lineTo(view.sx(o0.x) + 3, view.sy(y)); ctx.stroke();
              if (opt.tickLabels) view.text(o0.x, y, PHY.fmt.num(j * t), { color: PHY.colors.soft, size: 11, offset: [-13, 0] });
            }
          }
        }
      },

      line(x1, y1, x2, y2, opt) {
        opt = opt || {};
        ctx.save();
        ctx.strokeStyle = opt.color || PHY.colors.ink;
        ctx.lineWidth = opt.width || 2;
        ctx.lineCap = opt.cap || 'round';
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        if (opt.dash) ctx.setLineDash(opt.dash);
        ctx.beginPath();
        ctx.moveTo(view.sx(x1), view.sy(y1));
        ctx.lineTo(view.sx(x2), view.sy(y2));
        ctx.stroke();
        ctx.restore();
      },

      /* points: [{x, y}, ...]. opt: {color, width, fill, close, dash, alpha} */
      poly(points, opt) {
        opt = opt || {};
        if (!points.length) return;
        ctx.save();
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (opt.dash) ctx.setLineDash(opt.dash);
        ctx.beginPath();
        points.forEach(function (p, i) {
          if (i) ctx.lineTo(view.sx(p.x), view.sy(p.y));
          else ctx.moveTo(view.sx(p.x), view.sy(p.y));
        });
        if (opt.close) ctx.closePath();
        if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
        if (opt.color) { ctx.strokeStyle = opt.color; ctx.lineWidth = opt.width || 2; ctx.stroke(); }
        ctx.restore();
      },

      /* Radius in world meters, or pixels with opt.px = true. */
      circle(x, y, r, opt) {
        opt = opt || {};
        ctx.save();
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        if (opt.dash) ctx.setLineDash(opt.dash);
        ctx.beginPath();
        ctx.arc(view.sx(x), view.sy(y), opt.px ? r : r * S, 0, Math.PI * 2);
        if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
        if (opt.color) { ctx.strokeStyle = opt.color; ctx.lineWidth = opt.width || 2; ctx.stroke(); }
        ctx.restore();
      },

      /* World endpoints, pixel widths. opt: {color, width, head, dash, alpha, label, labelColor, labelSide, labelGap} */
      arrow(x1, y1, x2, y2, opt) {
        opt = opt || {};
        const ax = view.sx(x1), ay = view.sy(y1), bx = view.sx(x2), by = view.sy(y2);
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) return;
        const color = opt.color || PHY.colors.ink;
        const width = opt.width || 3;
        const head = Math.min(opt.head || 8 + width * 2.4, len * 0.6);
        const ux = dx / len, uy = dy / len;
        const baseX = bx - ux * head, baseY = by - uy * head;
        ctx.save();
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (opt.dash) ctx.setLineDash(opt.dash);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(baseX, baseY); ctx.stroke();
        ctx.setLineDash([]);
        const hw = head * 0.52;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(baseX - uy * hw, baseY + ux * hw);
        ctx.lineTo(baseX + uy * hw, baseY - ux * hw);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (opt.label) {
          const side = opt.labelSide || 1;
          const gap = (opt.labelGap || 14) * side;
          view.screenText((ax + bx) / 2 - uy * gap, (ay + by) / 2 + ux * gap, opt.label, {
            color: opt.labelColor || color, size: opt.labelSize || 14, weight: 700, halo: true,
          });
        }
      },

      /* Angle arc at (cx, cy) from a0 to a1 degrees (CCW, y up). Radius in pixels. */
      arc(cx, cy, rPx, a0, a1, opt) {
        opt = opt || {};
        ctx.save();
        ctx.strokeStyle = opt.color || PHY.colors.soft;
        ctx.lineWidth = opt.width || 2;
        if (opt.dash) ctx.setLineDash(opt.dash);
        ctx.beginPath();
        ctx.arc(view.sx(cx), view.sy(cy), rPx, (-a0 * Math.PI) / 180, (-a1 * Math.PI) / 180, a1 > a0);
        ctx.stroke();
        ctx.restore();
      },

      /* Text at world coordinates. opt.offset = [dxPx, dyPx] */
      text(x, y, str, opt) {
        opt = opt || {};
        const off = opt.offset || [0, 0];
        view.screenText(view.sx(x) + off[0], view.sy(y) + off[1], str, opt);
      },

      /* Hebrew strings are drawn RTL so "3.5 מ'" reads correctly on the LTR canvas. */
      screenText(px, py, str, opt) {
        opt = opt || {};
        str = String(str);
        ctx.save();
        if ('direction' in ctx) ctx.direction = HEBREW.test(str) ? 'rtl' : 'ltr';
        ctx.font = (opt.weight || 500) + ' ' + (opt.size || 13) + 'px ' + (opt.font || FONT);
        ctx.textAlign = opt.align || 'center';
        ctx.textBaseline = opt.baseline || 'middle';
        if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
        if (opt.pill) {
          const m = ctx.measureText(str);
          const w = m.width + 20, h = (opt.size || 13) + 12;
          let x0 = px - w / 2;
          if (ctx.textAlign === 'left') x0 = px - 10;
          if (ctx.textAlign === 'right') x0 = px - w + 10;
          ctx.fillStyle = opt.pillColor || PHY.colors.surface;
          ctx.strokeStyle = opt.pillBorder || PHY.colors.gridStrong;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x0, py - h / 2, w, h, h / 2);
          else ctx.rect(x0, py - h / 2, w, h);
          ctx.fill();
          ctx.stroke();
        }
        if (opt.halo) {
          ctx.strokeStyle = PHY.colors.bg;
          ctx.lineWidth = 4;
          ctx.lineJoin = 'round';
          ctx.strokeText(str, px, py);
        }
        ctx.fillStyle = opt.color || PHY.colors.ink;
        ctx.fillText(str, px, py);
        ctx.restore();
      },

      /* Distance between two world points, in screen pixels (for hit testing). */
      pxDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) * S; },

      /* Touch-friendly dragging. handlers.hit(p) returns a truthy handle to start a drag, or null.
         The page can still scroll when a touch starts away from a handle. */
      drag(h) {
        let active = null;
        const pos = function (e) {
          const r = canvas.getBoundingClientRect();
          return view.toWorld(e.clientX - r.left, e.clientY - r.top);
        };
        canvas.addEventListener('pointerdown', function (e) {
          const p = pos(e);
          const handle = h.hit ? h.hit(p, e) : true;
          if (!handle) return;
          active = handle;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
          canvas.style.cursor = 'grabbing';
          if (h.start) h.start(handle, p, e);
          e.preventDefault();
        });
        canvas.addEventListener('pointermove', function (e) {
          const p = pos(e);
          if (active) {
            if (h.move) h.move(active, p, e);
          } else if (h.hit && e.pointerType === 'mouse') {
            canvas.style.cursor = h.hit(p, e) ? 'grab' : '';
          }
        });
        const end = function (e) {
          if (!active) return;
          const handle = active;
          active = null;
          canvas.style.cursor = '';
          if (h.end) h.end(handle, pos(e), e);
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('touchstart', function (e) { if (active) e.preventDefault(); }, { passive: false });
      },

      /* Click or tap at world coordinates. Does not block page scrolling. */
      onTap(fn) {
        canvas.addEventListener('click', function (e) {
          const r = canvas.getBoundingClientRect();
          fn(view.toWorld(e.clientX - r.left, e.clientY - r.top), e);
        });
      },
    };

    function fit() {
      const rx = world.xMax - world.xMin;
      const ry = world.yMax - world.yMin;
      S = Math.min((W - pad * 2) / rx, (H - pad * 2) / ry);
      ox = W / 2 - ((world.xMin + world.xMax) / 2) * S;
      oy = H / 2 + ((world.yMin + world.yMax) / 2) * S;
    }

    function resize() {
      const parent = canvas.parentElement;
      const cssW = (parent && parent.clientWidth) || 320;
      const cssH = Math.max(minH, Math.min(maxH, Math.round(cssW / aspect)));
      if (cssW === W && cssH === H) return;
      W = cssW;
      H = cssH;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit();
      resizeCbs.forEach(function (f) { f(); });
    }

    resize();
    if ('ResizeObserver' in window && canvas.parentElement) {
      new ResizeObserver(resize).observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', resize);
    }
    return view;
  }

  PHY.canvas = { create };
})();

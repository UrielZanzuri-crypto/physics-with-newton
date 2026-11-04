/* PHY.sims.spray: paint through a frame onto a wall, the picture behind 1/r². Side view on one side, the wall seen
   head on, on the other. Droplets are real: the number landing on one frame-sized tile is counted, not computed.
   sim.play() -> Promise: sprays at distance 1, then moves the wall to distance 2.
   setParam: distance (in frame distances, 1 to 4), locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const GRID = 20;
  const TOTAL = GRID * GRID;

  PHY.sims.spray = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ locked: true, distance: 1 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.65, minHeight: 280, maxHeight: 420 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      d: opts.distance, drops: [], stuck: [], next: 0, spraying: false, sprayRate: 170, run: 0, caption: '', locked: opts.locked,
      history: {}, resolve: null,
    };

    const slider = U.Slider(controlsEl, {
      label: 'מרחק הקיר, ביחס למסגרת', min: 1, max: 4, step: 0.1, value: S.d, format: (v) => G.ltr('×' + F.num(v, 1)), color: 'var(--c-displacement)',
      onInput(v) { S.d = v; clearPaint(); loop.requestRender(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const btn = U.Button(row, 'לרסס!', function () { if (!S.locked) api.spray(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'd', label: 'מרחק', color: 'var(--c-displacement)' },
      { key: 'area', label: 'שטח הכתם, במשבצות' },
      { key: 'tile', label: 'טיפות על משבצת אחת' },
      { key: 'share', label: 'חלק מהתרסיס' },
    ]);

    function setLocked(v) {
      S.locked = v;
      slider.setEnabled(!v);
      btn.disabled = v;
    }
    function clearPaint() {
      S.drops = [];
      S.stuck = [];
      S.next = 0;
      S.spraying = false;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    /* One droplet for every cell of a fine grid in the frame, jittered and shuffled in a fixed way. */
    function droplet(i) {
      const n = (i * 137) % TOTAL;
      const cx = n % GRID, cy = Math.floor(n / GRID);
      const frac = (x) => x - Math.floor(x);
      const j1 = frac(Math.sin(i * 12.9898) * 43758.5453), j2 = frac(Math.sin(i * 78.233) * 12543.123);
      return { u: (cx + j1) / GRID - 0.5, w: (cy + j2) / GRID - 0.5, s: 0 };
    }
    const inTile = (p) => Math.abs(p.u * S.d) <= 0.5 && Math.abs(p.w * S.d) <= 0.5;
    const tileCount = () => S.stuck.filter(inTile).length;

    function step(dt) {
      tw.step(dt);
      if (S.spraying) {
        const emit = dt * S.sprayRate;
        S.acc = (S.acc || 0) + emit;
        while (S.acc >= 1 && S.next < TOTAL) {
          S.acc -= 1;
          S.drops.push(droplet(S.next++));
        }
        if (S.next >= TOTAL && S.drops.length === 0) {
          S.spraying = false;
          if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        }
      }
      const speed = 1.9 / Math.max(1, S.d * 0.8);
      for (let i = S.drops.length - 1; i >= 0; i--) {
        const p = S.drops[i];
        p.s += dt * speed;
        if (p.s >= 1) {
          S.stuck.push(p);
          S.drops.splice(i, 1);
        }
      }
    }

    function layout() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const panelW = small ? w * 0.42 : w * 0.38;
      const sideW = w - panelW;
      const sx0 = small ? 30 : 56;
      const unit = (sideW - sx0 - 20) / 4;
      const cy = h / 2 + 14;
      const half = ((h - 54) / 2) / 4;
      const tile = Math.min((panelW - 16) / 4.2, (h - 50) / 4.2);
      return { w, h, small, panelW, sideW, sx0, unit, cy, half, tile, px: sideW + panelW / 2, py: h / 2 + 14 };
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.spraying || S.drops.length > 0 || tw.busy; });
    function render() {
      if (!drawNow()) return;
      const L = layout();
      const accent = C.accent;
      view.clear();

      /* Divider and captions */
      P.line(L.sideW, 0, L.sideW, L.h, { color: C.gridStrong, width: 1.5 });
      view.screenText(L.sideW / 2, 14, 'מהצד', { size: 12, weight: 700, color: C.soft });
      view.screenText(L.px, 14, 'הקיר, מלפנים', { size: 12, weight: 700, color: C.soft });

      const x0 = L.sx0, y0 = L.cy;
      const xFrame = x0 + L.unit;
      const xWall = x0 + L.unit * S.d;
      const hAtWall = L.half * S.d;

      /* The spray cone */
      P.poly([{ x: x0, y: y0 }, { x: xWall, y: y0 - hAtWall }, { x: xWall, y: y0 + hAtWall }], { fill: accent, alpha: 0.13, close: true });
      P.line(x0, y0, xWall, y0 - hAtWall, { color: accent, width: 1.2, dash: [4, 4], alpha: 0.8 });
      P.line(x0, y0, xWall, y0 + hAtWall, { color: accent, width: 1.2, dash: [4, 4], alpha: 0.8 });

      /* The wall */
      P.line(xWall, y0 - L.half * 4.1, xWall, y0 + L.half * 4.1, { color: C.axis, width: 4, cap: 'butt' });
      P.line(xWall + 3, y0 - hAtWall, xWall + 3, y0 + hAtWall, { color: accent, width: 3.5, cap: 'butt' });

      /* The frame with its opening */
      P.line(xFrame, y0 - L.half * 4.1, xFrame, y0 - L.half, { color: C.ink, width: 3.5, cap: 'butt', alpha: S.d > 1.02 ? 1 : 0 });
      P.line(xFrame, y0 + L.half, xFrame, y0 + L.half * 4.1, { color: C.ink, width: 3.5, cap: 'butt', alpha: S.d > 1.02 ? 1 : 0 });

      /* Droplets in flight, side view */
      S.drops.forEach(function (p) {
        const x = x0 + p.s * (xWall - x0);
        const y = y0 - p.w * 2 * L.half * S.d * p.s;
        P.circle(x, y, 2, { fill: accent });
      });

      /* The can and the cat */
      const can = view.ctx;
      can.save();
      can.fillStyle = C.apple;
      can.strokeStyle = C.ink;
      can.lineWidth = 1.5;
      can.fillRect(x0 - 17, y0 - 9, 14, 18);
      can.strokeRect(x0 - 17, y0 - 9, 14, 18);
      can.fillStyle = C.soft;
      can.fillRect(x0 - 3, y0 - 3, 5, 6);
      can.restore();
      P.cat(x0 - 6, y0 + 58, { pose: 'thinking', px: L.small ? 30 : 42, anchor: [0.5, 1] });

      /* Distance marks */
      view.screenText(xWall, L.h - 12, '×' + F.num(S.d, 1), { size: 12.5, weight: 700, color: C.displacement, halo: true });

      /* The wall head on: fixed tiles, one highlighted, and the stain that grows */
      const t = L.tile;
      const cx = L.px, cy = L.py;
      const n = 4;
      const gx = cx - (n / 2) * t, gy = cy - (n / 2) * t;
      for (let i = 0; i <= n; i++) {
        P.line(gx + i * t, gy, gx + i * t, gy + n * t, { color: C.gridStrong, width: 1 });
        P.line(gx, gy + i * t, gx + n * t, gy + i * t, { color: C.gridStrong, width: 1 });
      }
      const stain = S.d * t;
      const ctx = view.ctx;
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.2 / (S.d * S.d);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - stain / 2 + 0.5, cy - stain / 2, stain, stain);
      ctx.restore();
      /* The tile that the frame covers at distance 1 */
      ctx.save();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - t / 2, cy - t / 2, t, t);
      ctx.restore();
      S.stuck.forEach(function (p) {
        P.circle(cx + p.u * stain, cy - p.w * stain, 1.5, { fill: accent, alpha: 0.85 });
      });
      S.drops.forEach(function (p) {
        if (p.s > 0.8) P.circle(cx + p.u * stain, cy - p.w * stain, 1.5, { fill: accent, alpha: (p.s - 0.8) * 3 });
      });

      if (S.caption) view.screenText(L.sideW / 2, 34, S.caption, { size: L.small ? 11.5 : 13, weight: 700, pill: true });

      const c = tileCount();
      out.set('d', G.ltr('×' + F.num(S.d, 1)));
      out.set('area', F.num(S.d * S.d, 1));
      out.set('tile', c + ' מתוך ' + S.stuck.length);
      out.set('share', G.ltr(F.num(S.stuck.length ? (100 * c) / S.stuck.length : 100 / (S.d * S.d), 0) + '%'));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        clearPaint();
        S.caption = '';
        S.history = {};
        S.d = opts.distance;
        slider.set(S.d);
        setLocked(opts.locked);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'distance') { S.d = v; slider.set(v); clearPaint(); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        return { d: S.d, total: S.stuck.length, tile: tileCount(), share: S.stuck.length ? tileCount() / S.stuck.length : 0, area: S.d * S.d, history: Object.assign({}, S.history), locked: S.locked };
      },
      spray() {
        clearPaint();
        S.acc = 0;
        S.spraying = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        setLocked(true);
        S.d = 1;
        slider.set(1);
        S.caption = 'מרחק ' + G.ltr('×1');
        await api.spray();
        if (id !== S.run) return;
        S.history[1] = tileCount();
        await tw.add(0.5, null);
        if (id !== S.run) return;
        S.caption = 'אותו תרסיס, קיר ' + G.ltr('×2');
        clearPaint();
        await tw.add(0.9, function (k) { S.d = 1 + k; slider.set(S.d); });
        if (id !== S.run) return;
        await api.spray();
        if (id !== S.run) return;
        S.history[2] = tileCount();
        S.caption = 'כתם פי 4, ' + F.unit(S.history[2], 'טיפות', 0) + ' למשבצת';
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

/* PHY.sims.freeFall: who lands first? A heavy apple, a light apple and Newton drop from a height.
   The "air" toggle adds quadratic drag and brings in a feather. With opts.strobe the sim leaves a
   ghost apple at every whole second and labels the gaps. g = 10 m/s².
   sim.play() -> Promise (resolves when the apples are down). setParam: air, feather, locked.
   getState(): {t, air, bodies: [{name, y, v, land}]}. opts: {height, strobe, bodies, air, feather} */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const G = 10;
  /* km = drag constant / mass, in 1/m. Terminal speed is sqrt(G / km). */
  const KIND = {
    heavy: { name: 'תפוח כבד', km: 0.005, r: 14 },
    light: { name: 'תפוח קל', km: 0.012, r: 8.5 },
    feather: { name: 'נוצה', km: 1.6, r: 10 },
    cat: { name: 'ניוטון', km: 0.002, r: 18 },
  };

  PHY.sims.freeFall = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ height: 20, bodies: ['heavy', 'light', 'cat'], strobe: false, air: false, feather: false, controls: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 1.25, minHeight: 370, maxHeight: 470 });
    const P = H2.pix(view);
    const S = { air: opts.air, feather: opts.feather, t: 0, running: false, resolve: null, bodies: [], caption: '', ghosts: [], lastMark: 0, doneT: null, locked: false };

    function build() {
      const list = opts.bodies.slice();
      if (S.feather && list.indexOf('feather') < 0) list.splice(2, 0, 'feather');
      S.bodies = list.map(function (k) {
        const d = KIND[k];
        return { key: k, name: opts.strobe ? 'תפוח' : d.name, km: d.km, r: d.r, y: opts.height, v: 0, land: null };
      });
    }

    let air = null, drop = null;
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'y', label: 'מהירות התפוח', color: 'var(--c-velocity)' },
      { key: 'a', label: opts.strobe ? 'נפל עד עכשיו' : 'נחיתת התפוח הכבד', color: opts.strobe ? 'var(--c-displacement)' : undefined },
      { key: 'b', label: opts.strobe ? 'התפוח נחת אחרי' : 'נחיתת התפוח הקל' },
    ]);
    if (opts.controls) {
      const row = U.h('div', { class: 'sim-row' });
      air = U.Toggle(row, 'אוויר', {
        value: S.air,
        onChange(v) {
          S.air = v;
          if (v) S.feather = true;
          api.reset();
        },
      });
      drop = U.Button(row, 'שחרר!', function () { api.play(); }, { primary: true });
      controlsEl.appendChild(row);
    }
    function setLocked(v) {
      S.locked = v;
      if (air) air.input.disabled = v;
      if (drop) drop.disabled = v;
    }

    function update() {
      const b = S.bodies[0];
      out.set('t', F.unit(S.t, 's', 2));
      out.set('y', F.unit(Math.abs(b.v), 'ms', 1));
      if (opts.strobe) {
        out.set('a', F.unit(opts.height - b.y, 'm', 1));
        out.set('b', b.land === null ? '—' : F.unit(b.land, 's', 2));
      } else {
        const lt = S.bodies.find((x) => x.key === 'light');
        out.set('a', b.land === null ? '—' : F.unit(b.land, 's', 2));
        out.set('b', !lt || lt.land === null ? '—' : F.unit(lt.land, 's', 2));
      }
    }

    function step(dt) {
      if (!S.running) return;
      S.t += dt;
      let anyMoving = false, applesDown = true;
      S.bodies.forEach(function (b) {
        if (b.land !== null) return;
        /* Exact for constant acceleration; with drag, the small step keeps it accurate. */
        const drag = S.air ? b.km * b.v * Math.abs(b.v) : 0;
        const a = -G - drag;
        const y0 = b.y;
        b.y += b.v * dt + 0.5 * a * dt * dt;
        b.v += a * dt;
        if (b.y <= 0) {
          const k = y0 / (y0 - b.y);
          b.land = S.t - dt + k * dt;
          b.v = (b.v - a * dt) + a * dt * k;
          b.y = 0;
          if (b.key === 'cat') S.caption = 'על הרגליים. כמו תמיד.';
        } else anyMoving = true;
        if (b.key !== 'feather' && b.land === null) applesDown = false;
      });
      if (opts.strobe) {
        const whole = Math.floor(S.t + 1e-9);
        while (S.lastMark < whole && S.bodies[0].land === null) {
          S.lastMark++;
          S.ghosts.push({ t: S.lastMark, y: opts.height - 0.5 * G * S.lastMark * S.lastMark });
        }
      }
      update();
      if (applesDown && S.doneT === null) S.doneT = S.t;
      if (S.doneT !== null && S.resolve && S.t >= S.doneT + 0.8) { S.resolve(); S.resolve = null; setLocked(false); }
      if (!anyMoving && S.t >= (S.doneT || 0) + 0.8) S.running = false;
    }

    function drawFeather(px, py) {
      const ctx = view.ctx;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(S.t * 2.4) * 0.5);
      ctx.fillStyle = C.soft;
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(8, -3, 0, 12);
      ctx.quadraticCurveTo(-8, -3, 0, -12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      const hasCat = S.bodies.some((b) => b.key === 'cat');
      const top = hasCat ? 70 : 38, bottom = Hh - 34, left = 50;
      const Y = (h) => bottom - (h / opts.height) * (bottom - top);
      const tickStep = opts.height > 30 ? 10 : 5;
      /* Ruler */
      P.line(left, top, left, bottom, { color: C.axis, width: 2 });
      for (let h = 0; h <= opts.height + 1e-9; h += tickStep) {
        P.line(left - 5, Y(h), W - 8, Y(h), { color: C.grid, width: 1 });
        view.screenText(left - 9, Y(h), F.num(h, 0), { size: 11, color: C.soft, align: 'right' });
      }
      view.screenText(8, top - 18, "גובה (מ')", { size: 11, color: C.soft, align: 'left' });
      /* Ground and the shelf they drop from */
      P.poly([{ x: 0, y: bottom }, { x: W, y: bottom }, { x: W, y: Hh }, { x: 0, y: Hh }], { fill: C.shade, close: true });
      P.line(0, bottom, W, bottom, { color: C.axis, width: 2.5 });
      P.line(left, top, W - 8, top, { color: C.soft, width: 2, dash: [8, 6] });

      const n = S.bodies.length;
      const gap = (W - left - 14) / n;
      S.bodies.forEach(function (b, i) {
        const px = left + gap * (i + 0.5);
        const py = Y(b.y);
        if (b.key === 'cat') {
          const landed = b.land !== null;
          P.cat(px, landed ? bottom : py, { pose: landed ? 'standing' : S.running ? 'falling' : 'standing', px: W < 420 ? 44 : 56 });
        } else if (b.key === 'feather') {
          drawFeather(px, py - (b.land !== null ? 6 : 0));
        } else {
          H2.drawApple(view, px, py - (b.land !== null ? b.r : 0), b.r);
        }
        view.screenText(px, bottom + 14, b.name, { size: W < 420 ? 10.5 : 12, weight: 700, color: C.ink });
        if (b.land !== null) view.screenText(px, bottom - (b.key === 'cat' ? 62 : 36), F.unit(b.land, 's', 2), { size: 12, weight: 800, color: C.accent, halo: true });
      });

      /* Strobe: ghosts every whole second with the gap between them. */
      if (opts.strobe) {
        const px = left + gap * 0.5;
        let prev = opts.height;
        S.ghosts.forEach(function (g) {
          if (g.y > 0.01) H2.drawApple(view, px, Y(g.y), 9, { alpha: 0.4 });
          const mid = (Y(g.y) + Y(prev)) / 2;
          P.line(px + 26, Y(prev), px + 26, Y(g.y), { color: C.displacement, width: 3 });
          P.line(px + 20, Y(g.y), px + 32, Y(g.y), { color: C.displacement, width: 3 });
          view.screenText(px + 34, mid, 'בשנייה ה-' + g.t + ': ' + F.unit(prev - g.y, 'm', 0), { size: W < 420 ? 11 : 12.5, weight: 700, color: C.displacement, align: 'left', halo: true });
          prev = g.y;
        });
      }
      if (S.caption) view.screenText(W / 2, 15, S.caption, { size: 12.5, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.t = 0;
        S.running = false;
        if (S.resolve) { S.resolve(); S.resolve = null; }
        S.ghosts = [];
        S.lastMark = 0;
        S.doneT = null;
        S.caption = S.air ? 'אוויר דולק. עכשיו יש במה להיתקע.' : '';
        build();
        update();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'air') { S.air = !!v; if (air) air.set(v); if (v) S.feather = true; api.reset(); }
        /* Takes effect on the next reset, so the result on screen stays until the reader moves on. */
        if (name === 'feather') S.feather = !!v;
        if (name === 'locked') setLocked(!!v);
      },
      getState() {
        return { t: S.t, air: S.air, running: S.running, bodies: S.bodies.map((b) => ({ key: b.key, y: b.y, v: b.v, land: b.land })), ghosts: S.ghosts.slice() };
      },
      play() {
        api.reset();
        S.running = true;
        S.caption = S.bodies.some((b) => b.key === 'cat') ? 'אני באוויר! למה הבטן שלי עולה?!' : '';
        setLocked(true);
        return new Promise(function (res) { S.resolve = res; });
      },
    };
    build();
    update();
    return api;
  };
})();

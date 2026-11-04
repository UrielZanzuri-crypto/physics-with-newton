/* PHY.sims.appleMoon: the apple and the Moon obey one law. The apple falls 5 m in a second. The Moon, 60 R away,
   runs on a real integrated orbit, and the gap between it and the straight line it would follow is its fall.
   Earth is drawn to the same scale as the Moon's orbit, with a minimum size so it can be seen.
   sim.play() -> Promise. sim.launch() -> Promise for a free run. setParam: gravity (bool), locked.
   getState: aRatio (g / 3600), aCircle (v²/r from the running orbit), period from the integrator, in days. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const RM = 60 * R;
  const DAY = 86400;
  const SIM_PER_SEC = 1.45 * DAY;

  PHY.sims.appleMoon = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.5, minHeight: 310, maxHeight: 450 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      appleT: 0, m: null, m0: null, simT: 0, trail: [], running: false, gravity: true, locked: opts.locked, caption: '', run: 0, resolve: null,
      showGap: false, showCompare: false, tRun: 0, played: false,
    };

    const row = U.h('div', { class: 'sim-row' });
    const btn = U.Button(row, 'להפעיל את הירח', function () { if (!S.locked) api.launch(); }, { primary: true });
    const grav = U.Toggle(row, 'לכבות את הכבידה', { value: false, onChange(off) { S.gravity = !off; resetMoon(); loop.requestRender(); } });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'ratio', label: 'תאוצה, לפי המרחק', color: 'var(--c-acceleration)' },
      { key: 'circle', label: 'תאוצה, לפי ההקפה', color: 'var(--c-acceleration)' },
      { key: 'v', label: 'מהירות הירח', color: 'var(--c-velocity)' },
      { key: 'days', label: 'זמן שעבר' },
    ]);

    /* Before the guess, neither the numbers, nor the labels that name the method, nor the arrow may answer the card. */
    const secret = () => S.locked && !S.played;
    const rLabels = out.el.querySelectorAll('.r-label');
    const setLabel = (i, t) => { if (rLabels[i].textContent !== t) rLabels[i].textContent = t; };

    function setLocked(v) {
      S.locked = v;
      btn.disabled = v;
      grav.input.disabled = v;
    }
    function resetMoon() {
      S.m = G.circular(RM, 90, -1);
      S.m0 = { x: S.m.x, y: S.m.y, vx: S.m.vx, vy: S.m.vy };
      S.simT = 0;
      S.trail = [];
      S.running = false;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    const gm = () => (S.gravity ? G.GM : 0);

    function stepMoon(dt) {
      const total = dt * SIM_PER_SEC;
      G.advance(S.m, total, 400, gm());
      S.simT += total;
      const last = S.trail[S.trail.length - 1];
      if (!last || Math.hypot(S.m.x - last.x, S.m.y - last.y) > RM * 0.015) S.trail.push({ x: S.m.x, y: S.m.y });
      const done = S.gravity ? S.simT >= 7 * DAY : Math.hypot(S.m.x, S.m.y) > RM * 1.5;
      if (done) {
        S.running = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }
    function step(dt) {
      tw.step(dt);
      if (S.running) stepMoon(dt);
    }

    function layout() {
      const w = view.w, h = view.h;
      const small = w < 480;
      const appleW = small ? w * 0.31 : w * 0.27;
      const moonW = w - appleW;
      const top = 42, bottom = small ? 44 : 50;
      const cx = appleW + moonW / 2 - moonW * 0.06;
      const cy = top + (h - top - bottom) * 0.68;
      const pr = Math.min(moonW / 2 - 18, (h - top - bottom) * 0.68 - 6);
      return { w, h, small, appleW, moonW, top, bottom, cx, cy, pr };
    }

    const drawNow = G.idleGate(view, controlsEl, function () { return S.running || tw.busy; });
    function render() {
      if (!drawNow()) return;
      const L = layout();
      view.clear();
      G.drawStars(view, 30);
      P.line(L.appleW, 0, L.appleW, L.h, { color: C.gridStrong, width: 1.5 });
      view.screenText(L.appleW / 2, 14, 'התפוח', { size: 12.5, weight: 700, color: C.soft });
      view.screenText(L.appleW + L.moonW / 2, 14, 'הירח, 60 רדיוסים מהמרכז', { size: 12.5, weight: 700, color: C.soft });

      /* The apple: 5 m ruler, branch, ground */
      const ax = L.appleW * 0.55;
      const yTop = L.top + 18, yBot = L.h - L.bottom - 8;
      P.line(6, yBot, L.appleW - 6, yBot, { color: C.axis, width: 2.5 });
      P.line(ax - 22, yTop - 12, ax + 20, yTop - 12, { color: 'rgb(120, 84, 52)', width: 5 });
      const fall = 5 * S.appleT * S.appleT;
      const ay = yTop + (fall / 5) * (yBot - yTop - 12);
      const rx = L.appleW * 0.2;
      P.line(rx, yTop, rx, yBot, { color: C.displacement, width: 2 });
      P.line(rx - 4, yTop, rx + 4, yTop, { color: C.displacement, width: 2 });
      P.line(rx - 4, yBot, rx + 4, yBot, { color: C.displacement, width: 2 });
      view.screenText(rx + 5, (yTop + yBot) / 2, F.unit(5, 'm', 0), { size: 12, weight: 700, color: C.displacement, halo: true, align: 'left' });
      PHY.ch02.drawApple(view, ax, ay, 8);
      if (S.appleT > 0.02 && S.appleT < 1) P.arrow(ax + 12, ay, ax + 12, ay + 26, { color: C.acceleration, width: 2.5, head: 8 });
      P.cat(ax + 6, yBot, { pose: S.appleT >= 1 ? 'dizzy' : 'thinking', px: L.small ? 30 : 40 });
      view.screenText(L.appleW / 2, L.h - L.bottom + 12, 'בשנייה: ' + F.unit(fall, 'm', 1), { size: L.small ? 11.5 : 12.5, weight: 700, color: C.displacement });
      view.screenText(L.appleW / 2, L.h - L.bottom + 28, 'זמן: ' + F.unit(S.appleT, 's', 2), { size: 11, color: C.soft });

      /* Earth and the Moon's orbit, to scale */
      const k = L.pr / RM;
      const map = (p) => ({ x: L.cx + p.x * k, y: L.cy - p.y * k });
      P.circle(L.cx, L.cy, L.pr, { color: C.gridStrong, width: 1.2, dash: [4, 6] });
      G.drawEarth(view, L.cx, L.cy, Math.max(4.5, R * k));
      view.screenText(L.cx, L.cy + 15, 'כדור הארץ', { size: 11, color: C.soft, halo: true });
      const q0 = map(S.m0);
      const end = { x: S.m0.x + S.m0.vx * 8 * DAY, y: S.m0.y };
      const qEnd = map(end);
      P.line(q0.x, q0.y, Math.min(qEnd.x, L.w - 4), q0.y, { color: C.soft, width: 1.5, dash: [6, 6] });
      G.drawPath(view, S.trail, map, { color: C.accent, width: 2.6 });
      const q = map(S.m);
      if (S.showGap && S.gravity && S.simT > 0.25 * DAY) {
        const ghost = map({ x: S.m0.x + S.m0.vx * S.simT, y: S.m0.y });
        if (ghost.x < L.w) {
          P.circle(ghost.x, ghost.y, 5, { color: C.soft, width: 1.5, dash: [2, 3] });
          P.arrow(ghost.x, ghost.y, q.x, q.y, { color: C.displacement, width: 2.5, head: 9 });
          const mx = (ghost.x + q.x) / 2 + 4, my = (ghost.y + q.y) / 2;
          view.screenText(mx, my, 'נפילה', { size: 11.5, weight: 700, color: C.displacement, align: 'left', halo: true });
        }
      }
      const speed = Math.hypot(S.m.vx, S.m.vy);
      G.drawPlanet(view, 'moon', q.x, q.y, L.small ? 7 : 9);
      const vLen = L.small ? 34 : 44;
      if (speed > 0) P.arrow(q.x, q.y, q.x + (S.m.vx / speed) * vLen, q.y - (S.m.vy / speed) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 12, labelGap: 10 });
      if (S.gravity && !secret()) {
        const rr = Math.hypot(S.m.x, S.m.y);
        P.arrow(q.x, q.y, q.x - (S.m.x / rr) * 26, q.y + (S.m.y / rr) * 26, { color: C.acceleration, width: 3, label: 'a', labelSize: 12, labelGap: 10 });
      }

      /* Bottom strip: the comparison */
      if (S.showCompare) {
        view.screenText(L.appleW + L.moonW / 2, L.h - L.bottom + 14, 'הירח בשנייה: ' + F.unit(0.5 * (G.G0 / 3600) * 1000, "מ\"מ", 1) + ' בלבד', { size: L.small ? 12 : 13.5, weight: 800, color: C.displacement, halo: true });
        view.screenText(L.appleW + L.moonW / 2, L.h - L.bottom + 32, 'התפוח: 5 מ\'. היחס: פי 3600', { size: L.small ? 11 : 12, weight: 600, color: C.soft });
      } else {
        view.screenText(L.appleW + L.moonW / 2, L.h - L.bottom + 18, 'זמן שעבר: ' + F.unit(S.simT / DAY, 'ימים', 1), { size: 11.5, color: C.soft });
      }
      if (S.caption) view.screenText(L.w / 2, 34, S.caption, { size: L.small ? 11.5 : 13, weight: 700, pill: true });

      const st = api.getState();
      setLabel(0, secret() ? 'תאוצה, לפי המרחק' : 'לפי 1/60²');
      setLabel(1, secret() ? 'תאוצה, לפי ההקפה' : 'לפי v²/r');
      out.set('ratio', secret() ? '?' : F.unit(st.aRatio, 'מ/ש²', 4));
      out.set('circle', secret() ? '?' : F.unit(st.aCircle, 'מ/ש²', 4));
      out.set('v', F.unit(speed, 'מ/ש', 0));
      out.set('days', F.unit(S.simT / DAY, 'ימים', 1));
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.appleT = 0;
        S.gravity = true;
        grav.set(false);
        S.showCompare = false;
        S.showGap = false;
        S.played = false;
        S.caption = '';
        resetMoon();
        setLocked(opts.locked);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'gravity') { S.gravity = !!v; grav.set(!v); resetMoon(); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        const m = S.m;
        const v = Math.hypot(m.vx, m.vy), r = Math.hypot(m.x, m.y);
        return {
          aRatio: G.G0 / 3600, aCircle: S.gravity ? (v * v) / r : 0, aReal: Math.hypot(m.ax, m.ay), v, r, days: S.simT / DAY, appleFall: 5 * S.appleT * S.appleT, appleT: S.appleT,
          moonFall1s: 0.5 * (G.G0 / 3600), running: S.running, gravity: S.gravity, locked: S.locked, secret: secret(),
        };
      },
      /* A whole lap on a copy with the same integrator, for the period in days. */
      measurePeriod() {
        const b = G.circular(RM, 90, -1);
        const h = 400;
        let t = 0, prev = Math.atan2(b.x, b.y), total = 0;
        while (total < G.TAU && t < 60 * DAY) {
          G.verlet(b, h);
          t += h;
          const a = Math.atan2(b.x, b.y);
          let d = a - prev;
          if (d < -Math.PI) d += G.TAU;
          total += d;
          prev = a;
        }
        return t / DAY;
      },
      launch() {
        resetMoon();
        S.showGap = S.gravity;
        S.running = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        S.played = true;
        S.gravity = true;
        grav.set(false);
        S.appleT = 0;
        S.showCompare = false;
        S.caption = 'התפוח: שנייה אחת של נפילה';
        setLocked(true);
        resetMoon();
        await tw.add(2.2, function (k) { S.appleT = k; });
        if (id !== S.run) return;
        S.caption = 'הירח: נופל מהקו הישר, יום אחרי יום';
        await api.launch();
        if (id !== S.run) return;
        S.caption = '';
        S.showCompare = true;
      },
    };
    resetMoon();
    setLocked(opts.locked);
    return api;
  };
})();

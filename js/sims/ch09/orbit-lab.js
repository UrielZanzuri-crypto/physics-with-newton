/* PHY.sims.orbitLab: circular orbits, measured from real integration.
   mode 'race': two satellites at r and 4r. Inner laps are counted while the outer does one, so T×8 is seen.
   mode 'heavy': two satellites of different mass on one orbit, 40° apart. The gap never changes.
   mode 'phasing': a station 40° ahead on the same orbit. One copy of the ship speeds up, another brakes.
   sim.play() -> Promise. setParam: rA, ratio (race), massB (heavy), locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;

  const wrap = (a) => { while (a <= -Math.PI) a += G.TAU; while (a > Math.PI) a -= G.TAU; return a; };

  PHY.sims.orbitLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'race', locked: true, rA: 1.5 * R, ratio: 4, massA: 1, massB: 4 }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.25, minHeight: 310, maxHeight: 450 });
    const P = PHY.ch02.pix(view);
    const tw = B.tweens();
    const S = {
      mode: opts.mode, locked: opts.locked, run: 0, running: false, caption: '', list: [], rA: opts.rA, ratio: opts.ratio, massA: opts.massA, massB: opts.massB,
      accel: 1, t: 0, tEnd: Infinity, resolve: null, viewR: 7 * R, result: {}, played: false,
    };

    let sliders = {}, btn = null, out;
    const row = U.h('div', { class: 'sim-row' });
    if (S.mode === 'race') {
      sliders.rA = U.Slider(controlsEl, {
        label: 'מרחק הפנימי מהמרכז', min: 1.1, max: 3, step: 0.1, value: S.rA / R, format: (v) => G.ltr(F.num(v, 1) + 'R'), color: 'var(--c-displacement)',
        onInput(v) { S.rA = v * R; build(); },
      });
      sliders.ratio = U.Slider(controlsEl, {
        label: 'פי כמה החיצוני רחוק יותר', min: 1.5, max: 9, step: 0.5, value: S.ratio, format: (v) => G.ltr('×' + F.num(v, 1)), color: 'var(--accent)',
        onInput(v) { S.ratio = v; build(); },
      });
      out = U.Readouts(controlsEl, [
        { key: 'vA', label: 'מהירות פנימי', color: 'var(--c-velocity)' },
        { key: 'vB', label: 'מהירות חיצוני', color: 'var(--c-velocity)' },
        { key: 'tA', label: 'הקפה, פנימי' },
        { key: 'tB', label: 'הקפה, חיצוני' },
      ]);
    } else if (S.mode === 'heavy') {
      sliders.massB = U.Slider(controlsEl, {
        label: 'מסת הלוויין הכבד', min: 1, max: 100, step: 1, value: S.massB, format: (v) => F.unit(v, 'טון', 0), color: 'var(--accent)',
        onInput(v) { S.massB = v; loop.requestRender(); },
      });
      out = U.Readouts(controlsEl, [
        { key: 'fA', label: 'כוח על הקל', color: 'var(--c-force)' },
        { key: 'fB', label: 'כוח על הכבד', color: 'var(--c-force)' },
        { key: 'a', label: 'תאוצה', color: 'var(--c-acceleration)' },
        { key: 'gap', label: 'הפער ביניהם' },
      ]);
    } else {
      out = U.Readouts(controlsEl, [
        { key: 'up', label: 'מי שהאיץ: פיגור' },
        { key: 'down', label: 'מי שבלם: פיגור' },
        { key: 't', label: 'זמן' },
      ]);
    }
    btn = U.Button(row, 'עוד סיבוב', function () { if (!S.locked) api.play(); }, { primary: true });
    controlsEl.appendChild(row);

    /* Before the guess, nothing here may answer the card: no speeds, no equal arrows, no good and bad colors. */
    const secret = () => S.locked && !S.played;
    const lapText = (n) => (n === 1 ? 'סיבוב אחד' : n + ' סיבובים');

    function setLocked(v) {
      S.locked = v;
      Object.keys(sliders).forEach(function (k) { sliders[k].setEnabled(!v); });
      btn.disabled = v;
      loop.requestRender();
    }

    /* Bodies: {b, name, r0, laps, lapT, angle, prev, color, trail, size} */
    function mk(b, o) {
      const a = Math.atan2(b.y, b.x);
      return Object.assign({ b, trail: [], prev: a, swept: 0, laps: 0, lapTimes: [], size: 13, keepTrail: true, label: '' }, o || {});
    }
    function build() {
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      S.running = false;
      S.t = 0;
      S.result = {};
      S.caption = '';
      if (S.mode === 'race') {
        const rB = S.rA * S.ratio;
        S.list = [mk(G.circular(S.rA, 90, -1), { name: 'A', r0: S.rA }), mk(G.circular(rB, 90, -1), { name: 'B', r0: rB })];
        S.viewR = rB * 1.14;
      } else if (S.mode === 'heavy') {
        const r = 2 * R;
        S.list = [mk(G.circular(r, 90, -1), { name: 'A', r0: r }), mk(G.circular(r, 130, -1), { name: 'B', r0: r })];
        S.viewR = r * 1.5;
      } else {
        const r = 2 * R;
        const st = mk(G.circular(r, 50, -1), { name: 'station', r0: r });
        const up = mk(G.circular(r, 90, -1), { name: 'up', r0: r });
        const dn = mk(G.circular(r, 90, -1), { name: 'down', r0: r });
        const dv = burnFor40();
        const speedUp = (c, d) => {
          const v = Math.hypot(c.b.vx, c.b.vy);
          c.b.vx *= (v + d) / v;
          c.b.vy *= (v + d) / v;
        };
        speedUp(up, dv);
        speedUp(dn, -dv);
        S.list = [st, up, dn];
        S.result.dv = dv;
        S.viewR = 2.7 * R;
      }
      loop.requestRender();
    }
    /* The brake that brings the ship back to the burn point just as the station arrives there:
       its period must be 320/360 of the station's. */
    function burnFor40() {
      const r = 2 * R;
      const a = r * Math.pow(320 / 360, 2 / 3);
      const v = Math.sqrt(G.GM * (2 / r - 1 / a));
      return G.vCirc(r) - v;
    }

    function stepRun(dt) {
      const total = dt * S.accel;
      const h = Math.min(total, 10);
      const n = Math.max(1, Math.ceil(total / h));
      const sub = total / n;
      for (let i = 0; i < n && S.running; i++) {
        const left = S.tEnd - S.t;
        const useH = left < sub ? left : sub;
        if (useH <= 0) break;
        S.list.forEach(function (c) {
          G.verlet(c.b, useH);
          const a = Math.atan2(c.b.y, c.b.x);
          const before = c.swept;
          c.swept += -wrap(a - c.prev);
          c.prev = a;
          const lap = Math.floor(c.swept / G.TAU);
          if (lap > c.laps) {
            /* Interpolate the exact moment the lap closed. */
            const over = (c.swept - lap * G.TAU) / (c.swept - before);
            c.laps = lap;
            c.lapTimes.push(S.t + useH * (1 - over));
          }
        });
        S.t += useH;
      }
      S.list.forEach(function (c) {
        const last = c.trail[c.trail.length - 1];
        if (!last || Math.hypot(c.b.x - last.x, c.b.y - last.y) * pxPerM() > 3) c.trail.push({ x: c.b.x, y: c.b.y });
        if (c.trail.length > 700) c.trail.shift();
      });
      if (S.t >= S.tEnd - 1e-6) finishRun();
    }
    function finishRun() {
      S.running = false;
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    function step(dt) {
      tw.step(dt);
      if (S.running) stepRun(dt);
    }
    let cachedK = 1 / R;
    const pxPerM = () => cachedK;

    const drawNow = G.idleGate(view, controlsEl, function () { return S.running; });
    function render() {
      if (!drawNow()) return;
      const w = view.w, h = view.h;
      const small = w < 480;
      const cx = w / 2, cy = h / 2 + 8;
      const k = (Math.min(w, h - 24) / 2 - 8) / S.viewR;
      cachedK = k;
      const map = (p) => ({ x: cx + p.x * k, y: cy - p.y * k });
      view.clear();
      G.drawStars(view);
      G.drawEarth(view, cx, cy, Math.max(5, R * k));

      if (S.mode === 'race') renderRace(cx, cy, k, map, small);
      else if (S.mode === 'heavy') renderHeavy(cx, cy, k, map, small);
      else renderPhasing(cx, cy, k, map, small);
      if (S.caption) view.screenText(w / 2, 15, S.caption, { size: small ? 12 : 13.5, weight: 700, pill: true });
    }

    function vArrow(c, map, len, label) {
      const q = map(c.b);
      const sp = Math.hypot(c.b.vx, c.b.vy) || 1;
      P.arrow(q.x, q.y, q.x + (c.b.vx / sp) * len, q.y - (c.b.vy / sp) * len, { color: C.velocity, width: 3, label: label || 'v', labelSize: 12, labelGap: 11 });
    }

    function renderRace(cx, cy, k, map, small) {
      const list = S.list;
      list.forEach(function (c) { P.circle(cx, cy, c.r0 * k, { color: C.gridStrong, width: 1.2, dash: [3, 5] }); });
      const vMax = G.vCirc(S.rA);
      list.forEach(function (c, i) {
        G.drawPath(view, c.trail.slice(-160), map, { color: i ? C.gold : C.accent, width: 2, alpha: 0.85 });
        const q = map(c.b);
        G.drawSat(view, q.x, q.y, small ? 10 : 13, { color: i ? C.gold : C.accent });
        if (!secret()) vArrow(c, map, (G.vCirc(c.r0) / vMax) * (small ? 44 : 58));
      });
      /* Lap counters */
      const a = list[0], b = list[1];
      /* Gold is too pale for text on the light theme, so a dot carries the color and the text stays dark. */
      P.circle(view.w - 11, view.h - 30, 5, { fill: C.accent, color: C.ink, width: 1 });
      P.circle(view.w - 11, view.h - 12, 5, { fill: C.gold, color: C.ink, width: 1 });
      view.screenText(view.w - 21, view.h - 30, 'פנימי: ' + lapText(a.laps), { size: small ? 12 : 13.5, weight: 800, halo: true, align: 'right' });
      view.screenText(view.w - 21, view.h - 12, 'חיצוני: ' + lapText(b.laps), { size: small ? 12 : 13.5, weight: 800, halo: true, align: 'right' });
      out.set('vA', secret() ? '?' : G.kms(Math.hypot(a.b.vx, a.b.vy), 2));
      out.set('vB', secret() ? '?' : G.kms(Math.hypot(b.b.vx, b.b.vy), 2));
      out.set('tA', secret() ? '?' : G.dur(a.lapTimes[0] || G.period(S.rA)));
      out.set('tB', secret() ? '?' : G.dur(b.lapTimes[0] || G.period(S.rA * S.ratio)));
    }

    function renderHeavy(cx, cy, k, map, small) {
      const list = S.list;
      P.circle(cx, cy, list[0].r0 * k, { color: C.gridStrong, width: 1.2, dash: [3, 5] });
      const masses = [S.massA, S.massB];
      const gHere = G.gAt(2 * R);
      list.forEach(function (c, i) {
        const q = map(c.b);
        const sp = Math.hypot(c.b.vx, c.b.vy) || 1;
        G.drawPath(view, c.trail.slice(-120), map, { color: i ? C.gold : C.accent, width: 2, alpha: 0.75 });
        if (!secret()) vArrow(c, map, small ? 40 : 52);
        const rr = Math.hypot(c.b.x, c.b.y);
        /* Force: grows with the mass. Acceleration: the same arrow on both. */
        const fLen = Math.min(small ? 92 : 124, (small ? 15 : 20) * masses[i]);
        P.arrow(q.x + 6 * (-c.b.vy / sp), q.y + 6 * (-c.b.vx / sp), q.x + 6 * (-c.b.vy / sp) - (c.b.x / rr) * fLen, q.y + 6 * (-c.b.vx / sp) + (c.b.y / rr) * fLen, { color: C.force, width: 4, label: 'F', labelSize: 12, labelGap: 11 });
        const aLen = small ? 26 : 34;
        if (!secret()) P.arrow(q.x - 6 * (-c.b.vy / sp), q.y - 6 * (-c.b.vx / sp), q.x - 6 * (-c.b.vy / sp) - (c.b.x / rr) * aLen, q.y - 6 * (-c.b.vx / sp) + (c.b.y / rr) * aLen, { color: C.acceleration, width: 3, label: 'a', labelSize: 12, labelGap: 11, labelSide: -1 });
        G.drawSat(view, q.x, q.y, (small ? 8 : 10) * (i ? Math.min(1.8, 1 + Math.log10(masses[i]) * 0.65) : 1), { color: i ? C.gold : C.accent });
        view.screenText(q.x, q.y - (small ? 18 : 22), F.unit(masses[i], 'טון', 0), { size: small ? 11 : 12.5, weight: 700, halo: true });
      });
      const gap = (Math.abs(wrap(Math.atan2(list[1].b.y, list[1].b.x) - Math.atan2(list[0].b.y, list[0].b.x))) * 180) / Math.PI;
      S.result.gap = gap;
      out.set('fA', F.unit(masses[0] * 1000 * gHere, 'N', 0));
      out.set('fB', F.unit(masses[1] * 1000 * gHere, 'N', 0));
      const aLabel = out.el.querySelectorAll('.r-label')[2];
      const aText = secret() ? 'תאוצה' : 'תאוצה של שניהם';
      if (aLabel.textContent !== aText) aLabel.textContent = aText;
      out.set('a', secret() ? '?' : F.unit(gHere, 'מ/ש²', 1));
      out.set('gap', G.deg(gap, 1));
    }

    function renderPhasing(cx, cy, k, map, small) {
      const [st, up, dn] = S.list;
      P.circle(cx, cy, st.r0 * k, { color: C.gridStrong, width: 1.4, dash: [3, 5] });
      G.drawPath(view, up.trail, map, { color: C.bad, width: 2.2, alpha: 0.8 });
      G.drawPath(view, dn.trail, map, { color: C.good, width: 2.2, alpha: 0.85 });
      const qs = map(st.b), qu = map(up.b), qd = map(dn.b);
      PHY.ch02.drawApple(view, qs.x, qs.y, small ? 9 : 11);
      view.screenText(qs.x, qs.y - (small ? 18 : 22), 'התחנה', { size: small ? 11 : 12, weight: 700, halo: true });
      if (secret()) {
        G.drawSat(view, qu.x, qu.y, small ? 9 : 11, { color: C.accent });
        view.screenText(qu.x, qu.y + (small ? 16 : 19), 'אנחנו', { size: small ? 11 : 12, weight: 700, halo: true });
      } else {
        G.drawSat(view, qu.x, qu.y, small ? 9 : 11, { color: C.bad });
        view.screenText(qu.x, qu.y + (small ? 16 : 19), 'האיץ', { size: small ? 11 : 12, weight: 700, color: C.bad, halo: true });
        G.drawSat(view, qd.x, qd.y, small ? 9 : 11, { color: C.good });
        view.screenText(qd.x, qd.y + (small ? 16 : 19), 'בלם', { size: small ? 11 : 12, weight: 700, color: C.good, halo: true });
      }
      const lagUp = lagOf(up), lagDown = lagOf(dn);
      S.result.lagUp = lagUp;
      S.result.lagDown = lagDown;
      out.set('up', G.deg(lagUp));
      out.set('down', G.deg(lagDown));
      out.set('t', G.dur(S.t));
    }
    /* How many degrees behind the station a ship has fallen, along the direction of motion. */
    function lagOf(c) {
      const st = S.list[0];
      return ((st.swept - c.swept) * 180) / Math.PI + 40;
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        S.played = false;
        build();
        setLocked(opts.locked);
      },
      setParam(name, v) {
        if (name === 'rA') { S.rA = v; if (sliders.rA) sliders.rA.set(v / R); build(); }
        if (name === 'ratio') { S.ratio = v; if (sliders.ratio) sliders.ratio.set(v); build(); }
        if (name === 'massB') { S.massB = v; if (sliders.massB) sliders.massB.set(v); }
        if (name === 'locked') setLocked(!!v);
        loop.requestRender();
      },
      getState() {
        const list = S.list.map(function (c) {
          return { name: c.name, r: Math.hypot(c.b.x, c.b.y), v: Math.hypot(c.b.vx, c.b.vy), a: Math.hypot(c.b.ax, c.b.ay), laps: c.laps, lapTimes: c.lapTimes.slice(), swept: c.swept, el: G.elements(c.b) };
        });
        const r = { mode: S.mode, t: S.t, running: S.running, list, rA: S.rA, ratio: S.ratio, locked: S.locked, massA: S.massA, massB: S.massB, secret: secret(), caption: S.caption };
        if (S.mode === 'heavy') {
          r.gap = (Math.abs(wrap(Math.atan2(S.list[1].b.y, S.list[1].b.x) - Math.atan2(S.list[0].b.y, S.list[0].b.x))) * 180) / Math.PI;
          r.fA = S.massA * 1000 * Math.hypot(S.list[0].b.ax, S.list[0].b.ay);
          r.fB = S.massB * 1000 * Math.hypot(S.list[1].b.ax, S.list[1].b.ay);
        }
        if (S.mode === 'phasing') {
          r.dv = S.result.dv;
          r.lagUp = lagOf(S.list[1]);
          r.lagDown = lagOf(S.list[2]);
          r.meet = Math.hypot(S.list[2].b.x - S.list[0].b.x, S.list[2].b.y - S.list[0].b.y);
        }
        return r;
      },
      async play() {
        const id = ++S.run;
        tw.clear();
        const wasLocked = S.locked;
        S.played = true;
        setLocked(true);
        build();
        if (S.mode === 'race') {
          const tB = G.period(S.rA * S.ratio);
          S.tEnd = tB * 1.0005;
          S.accel = tB / Math.min(10, Math.max(5, 1.2 * Math.pow(S.ratio, 1.5)));
        } else if (S.mode === 'heavy') {
          const T = G.period(2 * R);
          S.tEnd = T;
          S.accel = T / 6.5;
        } else {
          const r = 2 * R;
          const tB = G.period(r) * (320 / 360);
          S.tEnd = tB;
          S.accel = tB / 8;
        }
        S.running = true;
        await new Promise(function (resolve) { S.resolve = resolve; });
        if (id !== S.run) return;
        if (S.mode === 'race') S.caption = 'הפנימי: ' + lapText(S.list[0].laps) + '. החיצוני: ' + lapText(S.list[1].laps);
        if (S.mode === 'heavy') S.caption = 'אותה מהירות, אותו פער: ' + G.deg(api.getState().gap, 0);
        if (S.mode === 'phasing') S.caption = 'מי שבלם הגיע לתחנה. מי שהאיץ נשאר מאחור';
        if (!wasLocked) setLocked(false);
      },
    };
    build();
    setLocked(opts.locked);
    return api;
  };
})();

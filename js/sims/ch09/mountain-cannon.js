/* PHY.sims.mountainCannon: the cat in a cannon on an absurd mountain, seen from far away. The hook and the playground.
   Physics: real orbit integration around GM = gR². The peak is at r = R = 6400 km, where g = 10 m/s², so
   8 km/s gives the exact circle of the chapter. The drawn ground sits lower, at r = 0.9 R, so the mountain
   can be seen: the picture says it is not to scale.
   opts: {free, chapter, section, speed, angle, quests: host element}.
   sim.play() -> Promise: fires 5, 7, then 8 km/s. sim.fire() -> Promise of a result: 'crash', 'orbit', 'far' (left the
   frame with total energy clearly below 0, so it still comes back) or 'away' (never comes back, or on the threshold
   of the page's rounded 11.3 km/s: see G.onEdge). sim.advance(seconds) runs
   without frames. setParam: speed (km/s), angle (degrees above the horizon), locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav, B = PHY.ballistics;
  const R = G.R;
  const SURF = 0.9;
  const LIMIT = 9.5;
  const H = 5;

  const QUESTS = [
    { key: 'circle', text: 'מסלול שהוא כמעט מעגל (סטייה קטנה מ-3%)' },
    { key: 'oval', text: 'אליפסה שמגיעה לפחות פי 3 רחוק מהמרכז, וחוזרת' },
    { key: 'gone', text: 'בריחה: מהירות שאיתה ניוטון לא חוזר לעולם' },
  ];

  PHY.sims.mountainCannon = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ free: false, speed: 8, angle: 0, locked: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: worldFor(1.32), aspect: 1.2, minHeight: 310, maxHeight: 470 });
    const tw = B.tweens();
    const S = {
      v: opts.speed, a: opts.angle, run: 0, cur: null, shots: [], caption: '', locked: opts.locked,
      zoom: 1.32, zoomTo: 1.32, last: null, fired: 0, done: {}, drag: false, preview: null,
    };

    function worldFor(z) { return { xMin: -z, xMax: z, yMin: -z * 0.92, yMax: z * 1.08 }; }

    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות היציאה מהתותח', min: 1, max: 14, step: 0.1, value: S.v, format: (v) => F.unit(v, G.KMS, 1), color: 'var(--c-velocity)',
      onInput(v) { S.v = v; aimChanged(); },
    });
    const angSlider = opts.free ? U.Slider(controlsEl, {
      label: 'זווית מעל האופק', min: 0, max: 80, step: 1, value: S.a, format: (v) => G.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; aimChanged(); },
    }) : null;
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'אש!', function () { if (!S.locked) fire(); }, { primary: true });
    const clearBtn = U.Button(row, 'לנקות מסלולים', function () { if (!S.locked) clearAll(); }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות עכשיו', color: 'var(--c-velocity)' },
      { key: 'r', label: 'מרחק מהמרכז' },
      { key: 't', label: 'זמן טיסה' },
      { key: 'kind', label: 'מה קרה' },
    ]);
    let questEls = null;
    if (opts.quests) {
      questEls = {};
      QUESTS.forEach(function (q) {
        const mark = U.h('span', { class: 'quest-mark', 'aria-hidden': 'true' });
        const el = U.h('div', { class: 'quest' }, [mark, U.h('span', { text: q.text })]);
        questEls[q.key] = { el, mark };
        opts.quests.appendChild(el);
      });
    }

    function startBody() {
      const a = (S.a * Math.PI) / 180;
      const v = S.v * 1000;
      return G.body(0, R, v * Math.cos(a), v * Math.sin(a));
    }

    function setLocked(v) {
      S.locked = v;
      speedSlider.setEnabled(!v);
      if (angSlider) angSlider.setEnabled(!v);
      fireBtn.disabled = v;
      clearBtn.disabled = v;
      loop.requestRender();
    }
    function aimChanged() {
      S.preview = null;
      loop.requestRender();
    }
    function ensurePreview() {
      if (!S.preview && opts.free && !S.cur) {
        S.preview = G.fly(startBody(), { rMin: SURF * R, rMax: LIMIT * R, h: 12, every: 4, tMax: 2e5 });
      }
      return S.preview;
    }
    function clearAll() {
      S.shots = [];
      S.caption = '';
      S.zoomTo = 1.32;
      S.last = null;
      aimChanged();
    }

    /* How long a shot should take on screen. */
    function plan(b) {
      const trial = G.fly(b, { rMin: SURF * R, rMax: LIMIT * R, h: 10, every: 1000, tMax: 2e5 });
      const seconds = trial.result === 'crash' ? Math.min(3.2, Math.max(1, trial.t / 1500)) : trial.result === 'orbit' ? 5.2 : 4.6;
      return { trial, accel: Math.max(600, trial.t / seconds) };
    }

    function fire() {
      if (S.cur) endShot(null);
      const b = startBody();
      const el = G.elements(b);
      const p = plan(b);
      S.fired++;
      S.preview = null;
      S.caption = '';
      S.zoomTo = zoomForEl(el);
      S.cur = { b, el, t: 0, accel: p.accel, pts: [{ x: b.x, y: b.y }], v0: S.v, a0: S.a, start: { x: b.x, y: b.y } };
      if (opts.chapter && opts.section && opts.free) PHY.progress.markSection(opts.chapter, opts.section);
      return new Promise(function (resolve) { S.cur.resolve = resolve; });
    }
    function zoomForEl(el) {
      const reach = el.bound ? el.ra / R : LIMIT;
      return Math.max(1.32, Math.min(LIMIT + 0.5, reach * 1.14));
    }

    function endShot(result) {
      const c = S.cur;
      if (!c) return;
      S.cur = null;
      if (result) {
        const r = Math.hypot(c.b.x, c.b.y);
        const sweep = (Math.atan2(c.b.x, c.b.y) * 180) / Math.PI;
        const rec = {
          pts: c.pts, result, v0: c.v0, a0: c.a0, t: c.t, x: c.b.x, y: c.b.y, r, e: c.el.e,
          T: c.el.T, ra: c.el.ra, rp: c.el.rp, E: c.el.E, sweep: sweep < 0 ? sweep + 360 : sweep,
          closeError: result === 'orbit' ? Math.hypot(c.b.x - c.start.x, c.b.y - c.start.y) : null,
          vEnd: Math.hypot(c.b.vx, c.b.vy),
        };
        S.shots.push(rec);
        if (S.shots.length > 12) S.shots.shift();
        S.last = rec;
        const v = F.unit(c.v0, G.KMS, 1);
        if (result === 'crash') S.caption = v + ': נחת אחרי ' + G.deg(rec.sweep) + ' סביב הכדור';
        else if (result === 'orbit') S.caption = v + ': סיבוב שלם ב-' + G.dur(rec.T) + ', בלי לנחות';
        else if (result === 'far') S.caption = v + ': יצא מהתמונה, אבל עוד יחזור';
        else S.caption = v + ': בורח ולא חוזר';
        checkQuests(rec);
      }
      if (c.resolve) c.resolve(result ? S.last : null);
    }

    function verdict(L) {
      if (L.result === 'crash') return 'נחת';
      if (L.result === 'orbit') return L.e < 0.03 ? 'מעגל' : 'אליפסה';
      return L.result === 'far' ? 'אליפסה ארוכה' : 'בורח';
    }

    function checkQuests(rec) {
      if (!questEls) return;
      if (rec.result === 'orbit' && rec.e < 0.03) mark('circle');
      if (rec.result === 'orbit' && rec.ra >= 3 * R) mark('oval');
      if (rec.result === 'away') mark('gone');
    }
    function mark(key) {
      if (S.done[key]) return;
      S.done[key] = true;
      questEls[key].el.classList.add('is-done');
      questEls[key].mark.textContent = '✓';
      U.burst(questEls[key].el, 14);
      if (Object.keys(S.done).length === QUESTS.length) PHY.mascot.say('שלושתן. אני מבקש דמי סיבוב.', 'happy');
    }

    function stepFlight(dt) {
      const c = S.cur;
      if (!c) return;
      const total = dt * c.accel;
      const n = Math.max(1, Math.ceil(total / H));
      const h = total / n;
      for (let i = 0; i < n; i++) {
        /* The last step lands exactly on the period, so "the orbit closes" is measured, not assumed. */
        const stepH = c.el.bound && c.t + h > c.el.T ? c.el.T - c.t : h;
        if (stepH > 0) G.verlet(c.b, stepH);
        c.t += stepH;
        const r = Math.hypot(c.b.x, c.b.y);
        if (r < SURF * R) { pushPoint(c); endShot('crash'); return; }
        if (c.el.bound && c.t >= c.el.T - 1e-6) { pushPoint(c); endShot('orbit'); return; }
        if (r > LIMIT * R) { pushPoint(c); endShot(c.el.bound && !G.onEdge(c.el.E) ? 'far' : 'away'); return; }
      }
      const last = c.pts[c.pts.length - 1];
      if (Math.hypot(c.b.x - last.x, c.b.y - last.y) * view.scale / R > 2.5) pushPoint(c);
    }
    function pushPoint(c) { c.pts.push({ x: c.b.x, y: c.b.y }); }

    function step(dt) {
      tw.step(dt);
      stepFlight(dt);
      if (Math.abs(S.zoom - S.zoomTo) > 0.002) {
        S.zoom += (S.zoomTo - S.zoom) * Math.min(1, dt * 3);
        view.setWorld(worldFor(S.zoom));
      }
    }

    const map = (p) => ({ x: view.sx(p.x / R), y: view.sy(p.y / R) });

    const drawNow = G.idleGate(view, controlsEl, function () { return !!S.cur || tw.busy || Math.abs(S.zoom - S.zoomTo) > 0.002; });
    function render() {
      if (!drawNow()) return;
      const small = view.w < 420;
      view.clear();
      G.drawStars(view);
      const cx = view.sx(0), cy = view.sy(0);
      const pr = SURF * view.scale;
      G.drawEarth(view, cx, cy, pr);

      /* The mountain: from the drawn ground up to the peak at r = R. */
      view.poly([{ x: -0.24, y: Math.sqrt(SURF * SURF - 0.0576) }, { x: -0.03, y: 0.985 }, { x: 0, y: 1 }, { x: 0.03, y: 0.985 }, { x: 0.24, y: Math.sqrt(SURF * SURF - 0.0576) }],
        { fill: 'rgb(132, 118, 106)', color: 'rgb(70, 60, 52)', width: 1.5, close: true });
      view.poly([{ x: -0.055, y: 0.965 }, { x: 0, y: 1 }, { x: 0.055, y: 0.965 }, { x: 0, y: 0.95 }], { fill: 'rgb(245, 245, 250)', close: true });

      S.shots.forEach(function (s) {
        const col = s.result === 'orbit' ? C.good : s.result === 'crash' ? C.soft : C.accent;
        G.drawPath(view, s.pts, map, { color: col, width: 2, alpha: 0.85 });
        if (s.result === 'crash') {
          const q = map(s.pts[s.pts.length - 1]);
          view.circle(view.toWorld(q.x, q.y).x, view.toWorld(q.x, q.y).y, 4, { px: true, fill: C.apple, color: C.ink, width: 1.2 });
        }
      });

      const P = ensurePreview();
      if (P && !S.locked) G.drawPath(view, P.pts, map, { color: C.soft, width: 1.6, dash: [5, 6] });

      /* Cannon and arrow at the peak */
      const c = S.cur;
      const showA = c ? c.a0 : S.a;
      B.drawCannon(view, 0, 1, showA, { len: small ? 19 : 25, w: small ? 8 : 10 });
      if (!c && !S.locked && opts.free) {
        const k = aimScale();
        const a = (S.a * Math.PI) / 180;
        view.arrow(0, 1, (S.v * Math.cos(a) * k), 1 + S.v * Math.sin(a) * k, { color: C.velocity, width: 3.5, label: F.unit(S.v, G.KMS, 1), labelSize: 12, labelSide: -1 });
      }

      const size = small ? 30 : 38;
      if (c) {
        const G0 = G.gAt(Math.hypot(c.b.x, c.b.y));
        const p = map(c.b);
        G.drawPath(view, c.pts.concat([{ x: c.b.x, y: c.b.y }]), map, { color: C.accent, width: 2.6 });
        const sp = Math.hypot(c.b.vx, c.b.vy) || 1;
        const rot = (Math.atan2(c.b.vy, c.b.vx) * 180) / Math.PI;
        PHY.mascot.draw(view, c.b.x / R, c.b.y / R, { pose: 'flying', px: size, rot: rot });
        const vLen = (sp / 8000) * (small ? 42 : 56);
        G.pxArrow(view, p.x, p.y, p.x + (c.b.vx / sp) * vLen, p.y - (c.b.vy / sp) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 13, labelGap: 11 });
        const rr = Math.hypot(c.b.x, c.b.y);
        const aLen = Math.max(6, (G0 / 10) * (small ? 32 : 42));
        G.pxArrow(view, p.x, p.y, p.x - (c.b.x / rr) * aLen, p.y + (c.b.y / rr) * aLen, { color: C.acceleration, width: 3, label: 'a', labelSize: 13, labelGap: 11 });
      } else if (S.last && S.last.result !== 'away' && S.last.result !== 'far') {
        const pose = S.last.result === 'crash' ? 'dizzy' : 'happy';
        PHY.mascot.draw(view, S.last.x / R, S.last.y / R, { pose: pose, px: size, anchor: [0.5, 0.75] });
      } else {
        PHY.mascot.draw(view, -0.14 * Math.min(1.6, S.zoom), 1, { pose: 'thinking', px: size, anchor: [0.5, 0.9] });
      }

      if (S.caption) view.screenText(view.w / 2, 19, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
      view.screenText(view.w / 2, view.h - 11, 'ההר והחתול לא בקנה מידה. בחישוב הפסגה היא ב-r = R', { size: 11, color: C.soft });

      const now = c ? c.b : null;
      const L = S.last;
      if (now) {
        out.set('v', G.kms(Math.hypot(now.vx, now.vy)));
        out.set('r', G.km(Math.hypot(now.x, now.y)));
        out.set('t', G.dur(c.t));
        out.set('kind', 'בדרך...');
      } else if (L) {
        out.set('v', G.kms(L.vEnd));
        out.set('r', G.km(L.r));
        out.set('t', G.dur(L.t));
        out.set('kind', verdict(L));
      } else {
        out.set('v', G.kms(S.v * 1000));
        out.set('r', G.km(R));
        out.set('t', G.dur(0));
        out.set('kind', 'מחכה');
      }
    }

    /* World units of arrow length per km/s. */
    function aimScale() { return 0.05 * (S.zoom / 1.32); }

    const loop = PHY.SimLoop({ view, step, render });

    if (opts.free) {
      view.drag({
        hit(p) {
          if (S.locked || S.cur) return null;
          const a = (S.a * Math.PI) / 180, k = aimScale();
          const tip = { x: S.v * Math.cos(a) * k, y: 1 + S.v * Math.sin(a) * k };
          return view.pxDist(p, tip) < 30 ? 'tip' : null;
        },
        move(h, p) {
          const k = aimScale();
          const dx = Math.max(0.01, p.x), dy = p.y - 1;
          S.v = Math.max(1, Math.min(14, Math.round((Math.hypot(dx, dy) / k) * 10) / 10));
          S.a = Math.max(0, Math.min(80, Math.round((Math.atan2(dy, dx) * 180) / Math.PI)));
          speedSlider.set(S.v);
          angSlider.set(S.a);
          aimChanged();
        },
      });
    }

    function pause(sec) { return tw.add(sec, null); }

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.run++;
        tw.clear();
        if (S.cur) endShot(null);
        clearAll();
        setLocked(opts.locked);
      },
      setParam(name, v) {
        if (name === 'speed') { S.v = v; speedSlider.set(v); aimChanged(); }
        if (name === 'angle' && angSlider) { S.a = v; angSlider.set(v); aimChanged(); }
        if (name === 'locked') setLocked(!!v);
      },
      getState() {
        const c = S.cur;
        return {
          v: S.v, a: S.a, locked: S.locked, flying: !!c, t: c ? c.t : 0, shots: S.shots.slice(),
          last: S.last, quests: Object.assign({}, S.done), zoom: S.zoom, caption: S.caption, verdict: S.last ? verdict(S.last) : null,
          hasPreview: !!S.preview,
        };
      },
      fire,
      /* Hook: three shots in a row, each with its own trail. */
      async play() {
        const id = ++S.run;
        tw.clear();
        if (S.cur) endShot(null);
        clearAll();
        setLocked(true);
        for (const v of [5, 7, 8]) {
          S.v = v;
          speedSlider.set(v);
          await fire();
          if (id !== S.run) return S.last;
          if (v !== 8) { await pause(0.45); if (id !== S.run) return S.last; }
        }
        return S.last;
      },
      advance(seconds) {
        for (let t = 0; t < seconds && S.cur; t += 1 / 120) stepFlight(1 / 120);
      },
    };
    setLocked(opts.locked);
    return api;
  };
})();

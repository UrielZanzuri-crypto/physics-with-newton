/* PHY.sims.riverBoat: a boat on a river, seen from above, in meters. The river flows to +x.
   Heading 0° points straight across; a positive heading turns the bow downstream, negative upstream.
   The frame toggle changes the viewpoint: from the shore the water moves, from the river the water
   stands still and the shores slide past. Same boat, two different paths.
   mode 'free': opts {u, b, heading, width, locked, hideGround}. hideGround keeps the ground speed off the stage until the first play. sim.play(heading) -> Promise; sim.race([headings]) -> Promise.
   mode 'game': reach the dock opposite, reach a downstream dock, cross as fast as possible.
   setParam: heading, u, frame, locked, dock. getState(): {t, groundSpeed, measured, boats, ...}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, V = PHY.vec, H2 = PHY.ch02;
  const WATER = 'rgba(56,160,205,0.2)', BANK = 'rgba(190,155,85,0.28)';
  const RATE = 3;
  const LEVELS = [
    { name: 'שלב 1: מזח ממול' },
    { name: 'שלב 2: מזח במורד הזרם' },
    { name: 'שלב 3: הכי מהר' },
  ];
  const TOL = 3;
  const LABEL_FONT = 'Heebo, Rubik, system-ui, sans-serif';

  PHY.sims.riverBoat = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'free', u: 3, b: 4, heading: 0, width: 60, locked: true, frame: 'shore', rate: RATE }, opts || {});
    const game = opts.mode === 'game';
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -34, xMax: 84, yMin: -11, yMax: 78 },
      aspect: 1.42,
      minHeight: 250,
      maxHeight: 470,
    });
    const P = H2.pix(view);
    const S = {
      u: opts.u, b: opts.b, W: opts.width, heading: opts.heading, frame: opts.frame, t: 0, running: false, resolve: null,
      locked: opts.locked, boats: [], dock: opts.dock === undefined ? null : opts.dock, caption: '', race: false, hideGround: !!opts.hideGround,
    };

    function newBoat(th) { return { th, x: 0, y: 0, land: null, path: [{ t: 0, x: 0, y: 0 }] }; }
    function boatV(th) {
      const r = V.polar(S.b, 90 - th); /* heading measured from "straight across" */
      return { x: r.x, y: r.y };
    }
    const landT = (th) => S.W / boatV(th).y;
    S.boats = [newBoat(S.heading)];

    /* ---------- controls ---------- */
    const heading = U.Slider(controlsEl, {
      label: 'כיוון החרטום (0° = ישר לגדה ממול)', min: -70, max: 70, step: 1, value: S.heading, format: (v) => (v === 0 ? '0°' : Math.abs(v) + '° ' + (v < 0 ? 'נגד הזרם' : 'עם הזרם')), color: 'var(--c-velocity)',
      onInput(v) { setHeading(v); },
    });
    let uSlider = null;
    if (!game && opts.uSlider) {
      uSlider = U.Slider(controlsEl, {
        label: 'מהירות הזרם', min: 0, max: 4, step: 0.5, value: S.u, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
        onInput(v) { S.u = v; api.toStart(); },
      });
    }
    const row = U.h('div', { class: 'sim-row' });
    const frameT = U.Toggle(row, 'מבט מתוך הנהר', { value: S.frame === 'river', onChange(v) { S.frame = v ? 'river' : 'shore'; loop.requestRender(); if (opts.onFrame) opts.onFrame(S.frame); } });
    let goBtn = null, backBtn = null;
    if (!game) {
      goBtn = U.Button(row, 'שוט!', function () { api.play(); }, { primary: true });
      backBtn = U.Button(row, 'חזרה להתחלה', function () { api.toStart(); }, { ghost: true });
    }
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'v', label: 'מהירות ביחס לחוף', color: 'var(--c-velocity)' },
      { key: 'b', label: 'מהירות ביחס למים', color: 'var(--c-velocity)' },
      { key: 'x', label: 'כמה נסחף', color: 'var(--c-displacement)' },
    ]);

    function setHeading(v) {
      S.heading = v;
      if (!S.running) {
        S.boats = [newBoat(v)];
        S.t = 0;
        S.race = false;
      }
      update();
      loop.requestRender();
    }
    function setLocked(v) {
      S.locked = v;
      heading.setEnabled(!v);
      if (goBtn) goBtn.disabled = v;
      if (uSlider) uSlider.setEnabled(!v);
    }
    function groundVec(th) { const b = boatV(th); return { x: b.x + S.u, y: b.y }; }
    function update() {
      const bt = S.boats[0];
      const g = groundVec(bt.th);
      out.set('t', F.unit(S.t, 's', 1));
      /* Mid-race one number cannot describe three boats. Before the guess this number is the answer. */
      out.set('v', S.race ? 'שונה לכל סירה' : S.hideGround ? '?' : F.unit(V.len(g), 'ms', 2));
      out.set('b', F.unit(S.b, 'ms', 1));
      out.set('x', S.race ? 'שונה לכל סירה' : F.unit(bt.x, 'm', 1));
    }

    /* ---------- physics: exact straight lines ---------- */
    function step(dt) {
      if (!S.running) return;
      S.t += dt * opts.rate;
      let moving = false;
      S.boats.forEach(function (b) {
        if (b.land !== null) return;
        const T = landT(b.th);
        const q = Math.min(S.t, T);
        const g = groundVec(b.th);
        b.x = g.x * q;
        b.y = g.y * q;
        const last = b.path[b.path.length - 1];
        if (q - last.t >= 0.1 || q >= T) b.path.push({ t: q, x: b.x, y: b.y });
        if (S.t >= T) { b.land = T; b.y = S.W; } else moving = true;
      });
      update();
      if (!moving) {
        S.running = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }

    /* ---------- drawing ---------- */
    function rectW(x0, y0, x1, y1, fill) {
      view.poly([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], { fill, close: true });
    }
    function mod(a, n) { return ((a % n) + n) % n; }
    function drawBoat(b, opt) {
      const ctx = view.ctx;
      const px = view.sx(frameX(b.x, S.t)), py = view.sy(b.y);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((b.th * Math.PI) / 180);
      ctx.fillStyle = '#C5823F';
      ctx.strokeStyle = '#3B2A20';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      const k = view.w < 420 ? 0.72 : 1;
      ctx.beginPath();
      ctx.moveTo(0, -17 * k);
      ctx.quadraticCurveTo(9 * k, -6 * k, 8 * k, 12 * k);
      ctx.lineTo(-8 * k, 12 * k);
      ctx.quadraticCurveTo(-9 * k, -6 * k, 0, -17 * k);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (!opt || !opt.noCat) P.cat(px, py + 7, { pose: 'standing', px: view.w < 420 ? 20 : 28 });
    }
    const frameX = (x, t) => (S.frame === 'river' ? x - S.u * t : x);

    /* Race labels keep separate columns, in the boats' left-to-right order, so two of them can never
       touch, whatever the finish order and however close the boats are. A boat that has left the canvas
       gets its label on a row of its own, so the boats still in view keep their labels above them.
       All three fit in one row down to a 320px screen. */
    function drawRaceLabels() {
      const size = view.w < 420 ? 10.5 : 12, weight = 800, edge = 4, gap = 8, lift = view.w < 420 ? 21 : 24;
      const ctx = view.ctx;
      ctx.save();
      ctx.font = weight + ' ' + size + 'px ' + LABEL_FONT;
      const items = S.boats.map(function (b) {
        const text = (b.th === 0 ? 'ישר' : b.th < 0 ? 'נגד הזרם' : 'עם הזרם') + (b.land !== null ? ': ' + F.unit(b.land, 's', 1) : '');
        return { b, text, w: ctx.measureText(text).width, x: view.sx(frameX(b.x, S.t)) };
      }).sort((p, q) => p.x - q.x || p.b.th - q.b.th);
      ctx.restore();
      const inView = items.filter((it) => it.x >= 0 && it.x <= view.w);
      const gone = items.filter((it) => inView.indexOf(it) < 0);
      /* Pushed right first, then back in from the right edge. */
      [inView, gone].forEach(function (row) {
        row.forEach(function (it, i) {
          const p = row[i - 1];
          it.x = Math.max(it.x, p ? p.x + (p.w + it.w) / 2 + gap : edge + it.w / 2);
        });
        for (let i = row.length - 1; i >= 0; i--) {
          const it = row[i], n = row[i + 1];
          it.x = Math.min(it.x, n ? n.x - (n.w + it.w) / 2 - gap : view.w - edge - it.w / 2);
        }
      });
      items.forEach(function (it) {
        const y = gone.indexOf(it) < 0 ? view.sy(Math.min(it.b.y, S.W)) - lift : view.sy(S.W) + 16;
        view.screenText(it.x, y, it.text, { size, weight, font: LABEL_FONT, color: it.b.land !== null ? C.accent : C.ink, halo: true });
      });
    }

    function render() {
      view.clear();
      const r = view.visible;
      /* Water and banks */
      rectW(r.xMin, r.yMin, r.xMax, 0, BANK);
      rectW(r.xMin, S.W, r.xMax, r.yMax, BANK);
      rectW(r.xMin, 0, r.xMax, S.W, WATER);
      view.line(r.xMin, 0, r.xMax, 0, { color: C.axis, width: 2 });
      view.line(r.xMin, S.W, r.xMax, S.W, { color: C.axis, width: 2 });

      /* Flow streaks: they move in the shore frame and stand still in the river frame. */
      const shift = S.frame === 'river' ? S.u * S.t : 0;
      const flow = S.frame === 'river' ? 0 : S.u * S.t;
      const L = 24;
      for (let row = 0; row < 5; row++) {
        const y = 7 + row * 11.5;
        for (let i = -1; i < 7; i++) {
          const x = r.xMin + mod(i * L + row * 9 + flow, L * 7) - 6;
          view.line(x, y, x + 5, y, { color: C.axis, width: 1.5, alpha: 0.3 });
        }
      }
      /* Shore features move in the river frame. */
      const treeL = 26;
      [{ y: -5.5, off: 4 }, { y: S.W + 5.5, off: 15 }].forEach(function (bank) {
        for (let i = 0; i < 7; i++) {
          const x = r.xMin + mod(i * treeL + bank.off - shift, treeL * 7);
          view.circle(x, bank.y, 2.3, { fill: C.leaf, alpha: 0.75 });
        }
      });
      /* Docks */
      view.poly([{ x: -3 - shift, y: 0 }, { x: 3 - shift, y: 0 }, { x: 3 - shift, y: -3.5 }, { x: -3 - shift, y: -3.5 }], { fill: '#7A4B26', close: true });
      view.text(-shift, -7.5, 'יציאה', { size: 11, color: C.soft, weight: 700, halo: true });
      if (S.dock !== null) {
        const dx = S.dock - shift;
        view.poly([{ x: dx - TOL, y: S.W }, { x: dx + TOL, y: S.W }, { x: dx + TOL, y: S.W + 4 }, { x: dx - TOL, y: S.W + 4 }], { fill: C.gold, color: '#7A4B26', width: 2, close: true });
        view.text(dx, S.W + 8, 'מזח', { size: 12, weight: 800, halo: true });
      }

      /* Paths in the current frame: straight lines in both, in different directions. */
      S.boats.forEach(function (b) {
        const pts = b.path.map((p) => ({ x: frameX(p.x, p.t), y: p.y }));
        view.poly(pts, { color: C.displacement, width: 3.5, alpha: 0.85 });
      });
      S.boats.forEach(function (b) { drawBoat(b, { noCat: S.race }); });
      if (S.race) drawRaceLabels();

      /* Vector triangle at the boat. All three are velocities: all blue, told apart by style. */
      if (!S.race) {
        const b = S.boats[0];
        const k = 4.4;
        /* Parked in a corner of the water rather than on the boat, so it never runs off the river. */
        const ox = -20, oy = 7;
        const vb = boatV(b.th);
        const tx = ox + vb.x * k, ty = oy + vb.y * k;
        const fs = view.w < 420 ? 10.5 : 12;
        const label = (x, y, str, off, align) => view.text(x, y, str, { size: fs, weight: 700, color: C.velocity, halo: true, offset: off, align });
        /* Labels sit at the arrow tips: the bow to the left, the ground velocity to the right, the current above. */
        if (S.frame === 'shore') {
          const gx = tx + S.u * k;
          if (S.u > 0) {
            view.arrow(tx, ty, gx, ty, { color: C.velocity, width: 3, dash: [6, 4] });
            label((tx + gx) / 2, ty, 'זרם', [0, -13]);
          }
          if (!S.hideGround) {
            view.arrow(ox, oy, gx, ty, { color: C.velocity, width: 5 });
            label(gx, ty, 'ביחס לחוף', [8, 4], 'left');
          }
        } else if (S.u > 0) {
          view.arrow(ox, oy, ox - S.u * k, oy, { color: C.velocity, width: 3, dash: [6, 4] });
          label(ox - (S.u * k) / 2, oy, 'החוף', [0, 12]);
        }
        view.arrow(ox, oy, tx, ty, { color: C.velocity, width: 3 });
        /* Near the left edge the label slides right rather than leave the canvas. */
        label(Math.max(tx, r.xMin + 44 / view.scale), ty, 'חרטום', [-8, 4], 'right');
      }

      const cap = S.caption || (S.frame === 'river' ? 'מתוך הנהר: המים עומדים, והחוף נוסע לאחור' : 'מהחוף: החוף עומד, והמים זורמים');
      view.screenText(view.w / 2, 15, cap, { size: view.w < 420 ? 11.5 : 13, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- game ---------- */
    const Gm = { level: 0, points: [], attempts: 0, phase: 'aim', u: 3, stars: null };
    let hud = null, shootBtn = null, nextBtn = null;
    function buildGame() {
      hud = H2.gameHud(controlsEl, LEVELS.map((l) => l.name));
      /* The HUD comes first so the task sits right under the river. */
      controlsEl.insertBefore(controlsEl.lastChild, controlsEl.firstChild);
      const r2 = U.h('div', { class: 'sim-row' });
      shootBtn = U.Button(r2, 'שוט!', function () { shoot(); }, { primary: true });
      nextBtn = U.Button(r2, 'לשלב הבא', function () { nextLevel(); }, { primary: true });
      nextBtn.hidden = true;
      hud.main.appendChild(hud.task);
      hud.main.appendChild(hud.feedback);
      hud.main.appendChild(r2);
      restartGame();
    }
    function startGameLevel(i) {
      Gm.level = i;
      Gm.attempts = 0;
      Gm.phase = 'aim';
      hud.say('');
      nextBtn.hidden = true;
      shootBtn.hidden = false;
      heading.set(0);
      S.heading = 0;
      if (i === 0) {
        S.u = H2.pick([1.5, 2, 2.4, 3]);
        S.dock = 0;
        hud.setTask('הגע ל<b>מזח שממול</b>. הזרם ' + F.unit(S.u, 'ms', 1) + ', והסירה ' + F.unit(S.b, 'ms', 0) + ' ביחס למים. כוון את החרטום ושוט.');
      } else if (i === 1) {
        S.u = H2.pick([1, 2]);
        S.dock = H2.pick([20, 30, 40, 50]);
        hud.setTask('המזח <b>' + F.unit(S.dock, 'm', 0) + ' במורד הזרם</b>. הזרם ' + F.unit(S.u, 'ms', 0) + ', והסירה ' + F.unit(S.b, 'ms', 0) + '.');
      } else {
        S.u = 3;
        S.dock = null;
        hud.setTask('הפעם לא משנה לאן. <b>הגע לגדה השנייה הכי מהר שאפשר</b>. הזרם ' + F.unit(S.u, 'ms', 0) + ', והסירה ' + F.unit(S.b, 'ms', 0) + '.');
      }
      api.toStart();
      setLocked(false);
      hud.paint(Gm.level, Gm.points, false);
    }
    async function shoot() {
      if (Gm.phase !== 'aim') return;
      Gm.phase = 'run';
      Gm.attempts++;
      shootBtn.disabled = true;
      setLocked(true);
      await api.play(S.heading);
      const bt = S.boats[0];
      const best = S.W / S.b;
      let ok, msg;
      if (Gm.level < 2) {
        const miss = bt.x - S.dock;
        ok = Math.abs(miss) <= TOL;
        msg = ok ? 'בול במזח!' : 'פספסת ב-' + F.unit(Math.abs(miss), 'm', 1) + (miss > 0 ? ' במורד הזרם.' : ' במעלה הזרם.');
        if (!ok && Gm.attempts >= 2) msg += Gm.level === 0 ? ' הרכיב של הסירה נגד הזרם חייב לבטל את הזרם.' : ' זמן הצליחה כפול המהירות לאורך הנהר צריך לתת את המרחק למזח.';
      } else {
        ok = bt.land <= best * 1.005;
        msg = ok ? 'הגעת ב-' + F.unit(bt.land, 's', 1) + ', וזה המינימום!' : 'הגעת ב-' + F.unit(bt.land, 's', 1) + '. אפשר מהר יותר.';
        if (!ok && Gm.attempts >= 2) msg += ' רק הרכיב של הסירה ישר לעבר הגדה מקצר את הצליחה.';
      }
      shootBtn.disabled = false;
      if (ok) {
        const pts = Gm.attempts === 1 ? 3 : Gm.attempts === 2 ? 2 : 1;
        Gm.points[Gm.level] = pts;
        hud.say(msg + ' ' + pts + ' מתוך 3 נקודות בשלב.', 'good');
        U.burst(canvasEl, 22);
        PHY.mascot.say(Gm.level === 2 ? 'כמה שסחפת אותי! אבל הגעתי ראשון.' : 'נחתתי יבש. ברוב הגוף.', 'happy');
        Gm.phase = 'next';
        shootBtn.hidden = true;
        nextBtn.hidden = false;
        nextBtn.textContent = Gm.level < 2 ? 'לשלב הבא' : 'לסיכום';
        hud.paint(Gm.level, Gm.points, false);
      } else {
        hud.say(msg, 'bad');
        Gm.phase = 'aim';
        setLocked(false);
        shootBtn.textContent = 'נסה שוב';
      }
      Gm.lastOk = ok;
    }
    function nextLevel() {
      if (Gm.phase !== 'next') return;
      shootBtn.textContent = 'שוט!';
      if (Gm.level < 2) { startGameLevel(Gm.level + 1); return; }
      const total = Gm.points.reduce((a, b) => a + b, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      Gm.stars = stars;
      Gm.phase = 'done';
      hud.paint(-1, Gm.points, true);
      hud.showFinal(stars, 'צברת ' + total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'רב-חובל ניוטון מצדיע לך, רטוב.' : stars === 2 ? 'יפה. הנהר כבר פחות מפחיד.' : 'הגעת לכל המזחים. בפעם הבאה בפחות ניסיונות.'), restartGame);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restartGame() {
      Gm.points = [];
      Gm.stars = null;
      hud.showMain();
      startGameLevel(0);
    }

    const api = {
      start: loop.start,
      stop: loop.stop,
      toStart() {
        S.running = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        S.t = 0;
        S.race = false;
        S.boats = [newBoat(S.heading)];
        update();
        loop.requestRender();
      },
      reset() { api.toStart(); },
      setParam(name, v) {
        if (name === 'heading') { heading.set(v); setHeading(v); }
        if (name === 'u') { S.u = v; if (uSlider) uSlider.set(v); api.toStart(); }
        if (name === 'frame') { S.frame = v; frameT.set(v === 'river'); loop.requestRender(); }
        if (name === 'locked') setLocked(!!v);
        if (name === 'dock') { S.dock = v; loop.requestRender(); }
        if (name === 'caption') { S.caption = v || ''; loop.requestRender(); }
      },
      getState() {
        const b = S.boats[0];
        const n = b.path.length;
        const a0 = b.path[0], a1 = b.path[n - 1];
        const dtt = a1.t - a0.t;
        return {
          t: S.t, u: S.u, b: S.b, heading: S.heading, frame: S.frame, running: S.running, dock: S.dock,
          groundSpeed: V.len(groundVec(b.th)),
          measured: dtt > 0 ? Math.hypot(a1.x - a0.x, a1.y - a0.y) / dtt : 0,
          boats: S.boats.map((q) => ({ th: q.th, x: q.x, y: q.y, land: q.land })),
          game: game ? { level: Gm.level, attempts: Gm.attempts, phase: Gm.phase, points: Gm.points.slice(), stars: Gm.stars, ok: Gm.lastOk } : null,
        };
      },
      play(th) {
        if (th !== undefined) { heading.set(th); S.heading = th; }
        S.hideGround = false;
        api.toStart();
        S.running = true;
        return new Promise(function (res) { S.resolve = res; });
      },
      race(list) {
        api.toStart();
        S.boats = list.map(newBoat);
        S.race = true;
        S.running = true;
        update();
        return new Promise(function (res) { S.resolve = res; });
      },
      shoot,
      nextLevel,
    };
    if (game) buildGame();
    else setLocked(S.locked);
    update();
    return api;
  };
})();

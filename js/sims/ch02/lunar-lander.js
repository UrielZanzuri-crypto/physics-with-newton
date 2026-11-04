/* PHY.sims.lunarLander: 1D soft landing. Hold thrust to fight gravity, touch down with |v| < 2 m/s
   before the fuel runs out, while your v-t graph draws itself. 3 levels with different gravity.
   After two failures the "burn here" height appears, from v² = 2·g·h1 = 2·(A − g)·h2.
   opts: {chapter, section, onDone}. Hooks: launch(), setThrust(bool), next(), getState(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const SAFE = 2;
  const LEVELS = [
    { name: 'שלב 1: הירח', place: 'הירח', g: 1.6, A: 4, h: 40, fuel: 8, ground: 'rgba(150,150,165,0.42)', T0: 16 },
    { name: 'שלב 2: מאדים', place: 'מאדים', g: 3.7, A: 8, h: 60, fuel: 6, ground: 'rgba(205,95,55,0.42)', T0: 11 },
    { name: 'שלב 3: כדור הארץ', place: 'כדור הארץ', g: 10, A: 14, h: 40, fuel: 6, ground: 'rgba(90,155,95,0.42)', T0: 8 },
  ];

  PHY.sims.lunarLander = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { aspect: 1.45, minHeight: 400, maxHeight: 460 });
    const P = H2.pix(view);
    const plot = H2.Plot(view, { title: 'מהירות v (מ/ש)', titleColor: 'velocity' });
    const S = {
      level: 0, points: [], attempts: 0, phase: 'ready', y: 0, v: 0, t: 0, fuel: 0, thrust: false, holding: false,
      hist: [], last: -1, lastV: null, result: null, stars: null, fails: 0,
    };
    const lv = () => LEVELS[S.level];
    const burnHeight = () => (lv().g * lv().h) / lv().A;

    const hud = H2.gameHud(controlsEl, LEVELS.map((l) => l.name));
    const out = U.Readouts(null, [
      { key: 'y', label: 'גובה', color: 'var(--c-displacement)' },
      { key: 'v', label: 'מהירות v', color: 'var(--c-velocity)' },
      { key: 'a', label: 'תאוצה a', color: 'var(--c-acceleration)' },
      { key: 'f', label: 'דלק' },
    ]);
    const row = U.h('div', { class: 'sim-row' });
    const thrustBtn = U.Button(row, 'דחף (להחזיק)', null, { primary: true, disabled: true });
    thrustBtn.style.touchAction = 'none';
    thrustBtn.style.userSelect = 'none';
    thrustBtn.style.webkitUserSelect = 'none';
    thrustBtn.style.minWidth = '150px';
    const goBtn = U.Button(row, 'התחל נפילה', function () { launch(); });
    const nextBtn = U.Button(row, 'לשלב הבא', function () { next(); }, { primary: true });
    nextBtn.hidden = true;
    hud.main.appendChild(hud.task);
    hud.main.appendChild(out.el);
    hud.main.appendChild(row);
    hud.main.appendChild(hud.feedback);

    thrustBtn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      S.holding = true;
      try { thrustBtn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) {
      thrustBtn.addEventListener(n, function () { S.holding = false; });
    });
    thrustBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    const isThrustKey = (e) => e.code === 'Space' || e.key === 'ArrowUp';
    document.addEventListener('keydown', function (e) {
      if (S.phase === 'fly' && isThrustKey(e) && loop.visible) { e.preventDefault(); S.holding = true; }
    });
    document.addEventListener('keyup', function (e) { if (isThrustKey(e)) S.holding = false; });

    function setUpLevel(i) {
      S.level = i;
      S.attempts = 0;
      S.fails = 0;
      hud.paint(S.level, S.points, false);
      hud.setTask('נחיתה על <b>' + lv().place + '</b>: תאוצת הנפילה ' + F.unit(lv().g, 'ms2', 1) + '. המנוע נותן ' + F.unit(lv().A, 'ms2', 0) + ' כלפי מעלה, ויש דלק ל-' + F.unit(lv().fuel, 's', 0) + '. תיגע בקרקע עם מהירות קטנה מ-' + F.unit(SAFE, 'ms', 0) + '.');
      prepare();
      hud.say('');
    }
    function prepare() {
      S.phase = 'ready';
      S.y = lv().h;
      S.v = 0;
      S.t = 0;
      S.fuel = lv().fuel;
      S.hist = [];
      S.last = -1;
      S.holding = false;
      S.thrust = false;
      S.lastV = null;
      S.result = null;
      thrustBtn.disabled = true;
      goBtn.hidden = false;
      goBtn.textContent = 'התחל נפילה';
      nextBtn.hidden = true;
      update();
      loop.requestRender();
    }
    function launch() {
      if (S.phase === 'done') return;
      if (S.phase !== 'ready') prepare();
      S.phase = 'fly';
      S.attempts++;
      thrustBtn.disabled = false;
      goBtn.hidden = true;
      hud.say('');
    }
    function accel() { return (S.thrust ? lv().A : 0) - lv().g; }
    function update() {
      out.set('y', F.unit(S.y, 'm', 1));
      out.set('v', F.unit(S.v, 'ms', 1));
      out.set('a', F.unit(accel(), 'ms2', 1));
      out.set('f', F.unit(Math.max(0, S.fuel), 's', 1));
    }
    function step(dt) {
      if (S.phase !== 'fly') return;
      S.t += dt;
      S.thrust = S.holding && S.fuel > 0;
      if (S.thrust) S.fuel = Math.max(0, S.fuel - dt);
      const a = accel();
      const y0 = S.y, v0 = S.v;
      S.y += v0 * dt + 0.5 * a * dt * dt;
      S.v = v0 + a * dt;
      if (S.t - S.last >= 0.04) {
        S.hist.push({ t: S.t, y: S.v });
        S.last = S.t;
      }
      if (S.y <= 0) {
        const k = y0 / (y0 - S.y);
        S.v = v0 + a * dt * k;
        S.y = 0;
        touchdown();
      }
      update();
    }
    function touchdown() {
      S.thrust = false;
      S.holding = false;
      thrustBtn.disabled = true;
      S.lastV = S.v;
      S.hist.push({ t: S.t, y: S.v });
      const speed = Math.abs(S.v);
      if (speed < SAFE) {
        S.phase = 'landed';
        S.result = 'good';
        const pts = S.attempts === 1 ? 3 : S.attempts <= 3 ? 2 : 1;
        S.points[S.level] = pts;
        hud.paint(S.level, S.points, false);
        hud.say('נחיתה רכה ב-' + F.unit(speed, 'ms', 2) + '! ' + pts + ' מתוך 3 נקודות בשלב.', 'good');
        U.burst(canvasEl, 26);
        PHY.mascot.say(S.level === 2 ? 'נחתתי. על הרגליים. אני רוצה שתדע שזה בזכותי.' : 'צעד קטן לחתול. שלום לתפוחים של ' + lv().place + '.', 'happy');
        nextBtn.hidden = false;
        nextBtn.textContent = S.level < LEVELS.length - 1 ? 'לשלב הבא' : 'לסיכום';
      } else {
        S.phase = 'crashed';
        S.result = 'bad';
        S.fails++;
        let tip = 'התרסקות ב-' + F.unit(speed, 'ms', 1) + '.';
        tip += S.fuel <= 0 ? ' הדלק נגמר באוויר. נסה להדליק את המנוע מאוחר יותר.' : S.fails >= 2 ? ' הקו המקווקו מראה מתי להדליק: מהירות הנפילה חייבת להיבלם בדיוק עד הקרקע.' : ' מי שמדליק מוקדם מבזבז דלק. מי שמאחר נוחת חזק.';
        hud.say(tip, 'bad');
        PHY.mascot.say(speed > 15 ? 'נפלתי על הרגליים. כל הארבע. בבת אחת.' : 'זה היה קרוב. אני עדיין רועד.', 'dizzy');
        goBtn.hidden = false;
        goBtn.textContent = 'נסה שוב';
      }
    }
    function next() {
      if (S.phase !== 'landed') return;
      if (S.level < LEVELS.length - 1) { setUpLevel(S.level + 1); return; }
      const total = S.points.reduce((a, b) => a + b, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      S.stars = stars;
      S.phase = 'done';
      hud.paint(-1, S.points, true);
      PHY.progress.setGame(opts.chapter, stars);
      if (opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.showFinal(stars, 'צברת ' + total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'סוכנות החלל של ניוטון מציעה לך משרה. שכר בתפוחים.' : stars === 2 ? 'כל הנחיתות הצליחו, וזה מה שחשוב לנוסע.' : 'נחת, בסוף. בפעם הבאה תדליק בזמן.'), restart);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() {
      S.points = [];
      S.stars = null;
      hud.showMain();
      setUpLevel(0);
    }

    function drawShip(px, py, thrust, dead) {
      const ctx = view.ctx;
      if (thrust) {
        const len = 18 + Math.random() * 10;
        P.poly([{ x: px - 7, y: py + 7 }, { x: px + 7, y: py + 7 }, { x: px, y: py + 7 + len }], { fill: C.gold, color: C.accent, width: 2, close: true });
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, 2); ctx.lineTo(-16, 11);
      ctx.moveTo(10, 2); ctx.lineTo(16, 11);
      ctx.stroke();
      ctx.fillStyle = C.surface;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-13, -14, 26, 21, 8);
      else ctx.rect(-13, -14, 26, 21);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      P.cat(px, py - 3, { pose: dead ? 'dizzy' : S.result === 'good' ? 'happy' : 'standing', px: 30 });
    }

    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      const narrow = W < 520;
      const sceneW = Math.max(150, W * 0.42);
      const top = 26, bottom = Hh - 26, left = 32;
      const maxY = lv().h * 1.08;
      const Y = (h) => bottom - (Math.min(h, maxY) / maxY) * (bottom - top);
      const tick = H2.niceStep(maxY, 5);
      P.line(left, top, left, bottom, { color: C.axis, width: 2 });
      for (let i = 0; i * tick <= maxY; i++) {
        P.line(left - 4, Y(i * tick), sceneW, Y(i * tick), { color: C.grid, width: 1 });
        view.screenText(left - 7, Y(i * tick), F.num(i * tick, 0), { size: 10.5, color: C.soft, align: 'right' });
      }
      P.poly([{ x: 0, y: bottom }, { x: sceneW, y: bottom }, { x: sceneW, y: Hh }, { x: 0, y: Hh }], { fill: lv().ground, close: true });
      P.line(0, bottom, sceneW, bottom, { color: C.axis, width: 2.5 });
      view.screenText(sceneW / 2, bottom + 14, lv().place, { size: 12, weight: 700 });

      /* After two failures, show where to light the engine. */
      if (S.fails >= 2 && S.phase !== 'landed') {
        const yb = Y(burnHeight());
        P.line(left, yb, sceneW, yb, { color: C.accent, width: 2, dash: [6, 4] });
        view.screenText(sceneW - 4, yb - 9, 'להדליק בערך כאן: ' + F.unit(burnHeight(), 'm', 0), { size: 10.5, weight: 700, color: C.accent, align: 'right', halo: true });
      }

      /* Fuel gauge */
      const fx = left + 6, fw = sceneW - left - 12, fy = 9;
      P.poly([{ x: fx, y: fy }, { x: fx + fw, y: fy }, { x: fx + fw, y: fy + 7 }, { x: fx, y: fy + 7 }], { color: C.axis, width: 1.3, close: true });
      const k = S.fuel / lv().fuel;
      if (k > 0) P.poly([{ x: fx, y: fy }, { x: fx + fw * k, y: fy }, { x: fx + fw * k, y: fy + 7 }, { x: fx, y: fy + 7 }], { fill: k < 0.25 ? C.bad : C.gold, close: true });

      const px = left + (sceneW - left) * 0.5;
      const py = Y(S.y) - 11;
      drawShip(px, py, S.thrust, S.phase === 'crashed');
      if (S.phase === 'fly') {
        /* Clamped so a fast fall does not run the arrow off the scene. */
        if (Math.abs(S.v) > 0.2) P.arrow(px + 26, py, px + 26, py - Math.max(-70, Math.min(70, S.v * 4)), { color: C.velocity, width: 4 });
        const a = accel();
        P.arrow(px - 26, py, px - 26, py - Math.max(-60, Math.min(60, a * 8)), { color: C.acceleration, width: 4 });
      }

      /* Live v-t graph with the safe band. */
      const vmax = Math.sqrt(2 * lv().g * lv().h) * 1.1;
      const tMax = Math.max(lv().T0, S.t * 1.08);
      plot.range({ tMin: 0, tMax, tTick: H2.niceStep(tMax, narrow ? 3 : 5), yMin: -vmax, yMax: Math.max(5, vmax * 0.25), yTick: H2.niceStep(vmax, 3) });
      plot.box(sceneW + 4, 6, W - sceneW - 4, Hh - 10);
      plot.frame();
      plot.rect(0, tMax, -SAFE, SAFE, { fill: C.gold, alpha: 0.28 });
      plot.curve(S.hist, { color: C.velocity, width: 3 });
      if (S.phase === 'fly' || S.lastV !== null) plot.dot(S.t, S.v, { color: C.velocity });
      plot.text(tMax * 0.62, -SAFE - (vmax * 0.1), 'לנחות בתוך הפס', { color: C.soft, size: narrow ? 10.5 : 11.5, weight: 700 });
    }

    const loop = PHY.SimLoop({ view, step, render });
    restart();
    return {
      start: loop.start,
      stop: loop.stop,
      reset() { restart(); },
      setParam() {},
      getState() {
        return { level: S.level, phase: S.phase, y: S.y, v: S.v, t: S.t, a: accel(), fuel: S.fuel, attempts: S.attempts, fails: S.fails, points: S.points.slice(), lastV: S.lastV, burnHeight: burnHeight(), g: lv().g, stars: S.stars };
      },
      launch,
      setThrust(on) { S.holding = !!on; },
      next,
    };
  };
})();

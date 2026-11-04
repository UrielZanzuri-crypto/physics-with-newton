/* PHY.sims.swingGame: "נדנדה בקצב".
   Level 1: tap to push the swing and reach the apple. A push along the motion adds energy. A push against it steals
            energy if the swing is faster than half the push, and otherwise reverses it and adds a little.
            par is found by playing the level with perfect timing, so every level is winnable by construction.
   Level 2: tune m and k until the spring keeps time with a metronome. T comes from a real spot on the slider grid.
   Level 3: a second cart waits at its end. Release it so that the two run in phase. Amplitudes differ on purpose.
   Points 1-3 per level (pushes, checks, phase error), and stars from the total.
   opts: {chapter, section, rng, onDone}. Actions: push(), check(), release(), retry(), next(), restart().
   setParam: m, k. advance(seconds) runs the physics without frames. getState(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch08, H2 = PHY.ch02;
  const RAD = Math.PI / 180, TAU = Math.PI * 2;
  const NAMES = ['שלב 1: הנדנדה', 'שלב 2: המטרונום', 'שלב 3: באותו מופע'];
  const WORLD = { xMin: -2.3, xMax: 2.3, yMin: -0.4, yMax: 3.1 };
  const PIVOT_Y = 2.85, DAMP = 0.06, DV = 0.6, TH0 = 10;
  const NAT = 2.1;
  const M_GRID = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], K_GRID = [10, 20, 30, 40, 50, 60, 70, 80];
  const START_M = 2, START_K = 40, TOL2 = 0.03, WIN3 = 0.08;

  function peakHeight(s, L) { return L * (1 - Math.cos(s.th)) + (L * s.om) * (L * s.om) / 20; }

  /* The number of pushes with perfect timing: one at the bottom of each swing to the right. */
  function idealPushes(L, thT) {
    let th = TH0 * RAD, om = 0, n = 0, t = 0;
    const dt = 1 / 120;
    while (t < 200) {
      const s = K.pendStep(th, om, 10 / L, dt, DAMP);
      if (th < 0 && s.th >= 0 && s.om > 0) { s.om += DV / L; n++; }
      th = s.th; om = s.om; t += dt;
      if (th >= thT * RAD) return n;
    }
    return Infinity;
  }

  PHY.sims.swingGame = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const randInt = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = (list) => list[Math.floor(rng() * list.length)];
    const view = PHY.canvas.create(canvasEl, { world: WORLD, aspect: 1.45, minHeight: 300, maxHeight: 460 });
    const G = { i: 0, points: [], phase: 'play', floaters: [], stars: 0 };

    function makeLevel(i) {
      if (i === 0) {
        const L = pick([1, 1.5, 2]);
        const thT = randInt(35, 55);
        const par = idealPushes(L, thT);
        return { L, thT, par, limit: par + 8, T: K.pendPeriod(L, 10) };
      }
      if (i === 1) {
        for (let tries = 0; tries < 400; tries++) {
          const m = pick(M_GRID), k = pick(K_GRID), T = K.period(m, k);
          if (T >= 1 && T <= 2.6 && Math.abs(T - K.period(START_M, START_K)) / T > 0.15) return { T, witness: { m, k } };
        }
        throw new Error('swingGame: no level');
      }
      const T = 1.6 + 0.2 * randInt(0, 5);
      const k = (TAU * TAU) / (T * T);
      return { T, k, m: 1, A1: 0.8, A2: pick([0.45, 0.55, 1.1, 1.2]) };
    }

    /* ---------- HUD ---------- */
    const hud = H2.gameHud(controlsEl, NAMES);
    hud.main.appendChild(hud.task);
    const slidersBox = U.h('div', { class: 'sim-controls-inner' });
    hud.main.appendChild(slidersBox);
    const mSlider = U.Slider(slidersBox, { label: 'מסה', min: 0.5, max: 4, step: 0.5, value: START_M, unit: 'kg', digits: 1, onInput(v) { setTune('m', v); } });
    const kSlider = U.Slider(slidersBox, { label: 'קבוע הקפיץ k', min: 10, max: 80, step: 10, value: START_K, unit: "ניוטון/מ'", digits: 0, color: 'var(--c-force)', onInput(v) { setTune('k', v); } });
    const out = U.Readouts(hud.main, [{ key: 'a', label: '' }, { key: 'b', label: '' }]);
    const labels = out.el.querySelectorAll('.r-label');
    hud.main.appendChild(hud.feedback);
    const actionRow = U.h('div', { class: 'sim-row' });
    const action = U.Button(actionRow, '', function () { if (action.fn) action.fn(); }, { primary: true });
    action.style.minHeight = '52px';
    action.style.minWidth = '150px';
    hud.main.appendChild(actionRow);

    function setAction(text, fn) { action.textContent = text; action.fn = fn; action.disabled = !fn; }
    function setLabels(a, b) { labels[0].textContent = a; labels[1].textContent = b; }
    function floater(text, color) { G.floaters.push({ text, color, t: 1.3 }); }
    function paint() { hud.paint(G.i, G.points, G.phase === 'final'); }

    /* ---------- levels ---------- */
    function startLevel(i) {
      G.i = i;
      G.L = makeLevel(i);
      G.phase = 'play';
      G.floaters = [];
      G.retries = 0;
      hud.say('');
      slidersBox.hidden = i !== 1;
      if (i === 0) {
        const half = G.L.L * Math.sin(62 * RAD) + 0.75;
        view.setWorld({ xMin: -half, xMax: half, yMin: PIVOT_Y - G.L.L - 0.55, yMax: PIVOT_Y + 0.35 });
      } else {
        view.setWorld(WORLD);
      }
      if (i === 0) initSwing();
      else if (i === 1) initMetro();
      else initTwo();
      paint();
      loop.requestRender();
    }

    function initSwing() {
      const L = G.L;
      G.th = TH0 * RAD; G.om = 0; G.pushes = 0; G.cool = 0; G.flash = 0; G.lostIn = null; G.peak = peakHeight({ th: G.th, om: 0 }, L.L);
      G.target = L.L * (1 - Math.cos(L.thT * RAD));
      hud.setTask('התפוח תלוי בגובה ' + F.unit(G.target, 'm', 2) + ' מעל נקודת השפל. הדחיפה תמיד ימינה, אז הכול שאלה של מתי. לדחוף (כפתור או הקשה על הציור) כדי שהנדנדה תגיע אליו, בכמה שפחות דחיפות.');
      setLabels('דחיפות', 'גובה השיא');
      setAction('דחיפה!', api.push);
    }

    function initMetro() {
      G.m = START_M; G.k = START_K; G.attempts = 0;
      mSlider.set(START_M); kSlider.set(START_K);
      resetMetro();
      hud.setTask('המטרונום מתקתק כל ' + F.unit(G.L.T, 's', 2) + '. לכוון מסה וקבוע קפיץ כדי שהקרונית תגיע לקצה הימני בדיוק בכל תקתוק. אפשר לחשב קודם, ואפשר לסמוך על העיניים. כשהנקודות בשתי השורות נופלות זו מעל זו, הקצב נכון.');
      setLabels('בדיקות', 'T של המטרונום');
      setAction('בדיקה', api.check);
    }
    function resetMetro() { G.t = 0; G.x = 0.7; G.v = 0; G.meter = K.cycleMeter(1); G.springTicks = []; G.lastT = null; }
    function setTune(name, v) {
      if (G.i !== 1 || G.phase !== 'play') return;
      G[name] = v;
      resetMetro();
      hud.say('');
      loop.requestRender();
    }

    function initTwo() {
      const L = G.L;
      G.x1 = L.A1; G.v1 = 0; G.x2 = L.A2; G.v2 = 0; G.released = false; G.t = 0; G.watch = 0; G.err = null; G.tries = 0;
      hud.setTask('הקרונית העליונה כבר נעה. התחתונה מחכה בקצה, עם משרעת אחרת. לשחרר אותה (כפתור או הקשה על הציור) ברגע שהעליונה מגיעה לקצה הימני, כדי ששתיהן יגיעו לקצה יחד מעכשיו והלאה.');
      setLabels('ניסיונות', 'T של שתיהן');
      setAction('שחרור!', api.release);
    }
    function phaseOf(x, v, A, w) { return Math.atan2(-v / (w * A), x / A); }
    function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

    function win(pts, text) {
      G.points[G.i] = pts;
      G.phase = 'won';
      hud.say(text, 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(['תפוח! ואני רק ישבתי שם ונהניתי.', 'בול בקצב. עכשיו אפשר לרקוד.', 'שני קפיצים, קצב אחד. אני מתחיל לראות כפול.'][G.i], 'happy');
      paint();
      if (G.i < 2) setAction('לשלב הבא', function () { startLevel(G.i + 1); });
      else setAction('לסיכום', finish);
    }

    function finish() {
      const total = G.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G.stars = stars;
      G.phase = 'final';
      paint();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון מפקיד בידינו את כל הנדנדות בשכונה.' : stars === 2 ? 'כמעט בול. עוד סיבוב, והקצב שלנו.' : 'הקצב נתפס בסוף. בסיבוב הבא בפחות דחיפות.') }));
      U.Button(hud.final, 'עוד סיבוב, במספרים חדשים', api.restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }

    /* ---------- physics ---------- */
    function stepSwing(dt) {
      const L = G.L;
      const s = K.pendStep(G.th, G.om, 10 / L.L, dt, DAMP);
      const crossedOut = G.om * s.om <= 0;
      G.th = s.th; G.om = s.om;
      G.cool = Math.max(0, G.cool - dt);
      G.flash = Math.max(0, G.flash - dt);
      if (crossedOut) G.peak = L.L * (1 - Math.cos(G.th));
      if (G.phase !== 'play') return;
      if (G.th >= L.thT * RAD) {
        const pts = Math.min(G.pushes <= L.par + 1 ? 3 : G.pushes <= L.par + 3 ? 2 : 1, G.retries ? 2 : 3);
        win(pts, 'הגענו לתפוח ב-' + G.pushes + ' דחיפות! עם תזמון מושלם זה ' + L.par + '. ' + pts + ' מתוך 3 נקודות.');
        return;
      }
      if (G.lostIn !== null) {
        G.lostIn -= dt;
        if (G.lostIn <= 0) {
          G.phase = 'lost';
          hud.say('נגמר הכוח בידיים, והתפוח עדיין שם. הדחיפה מוסיפה הכי הרבה כשהנדנדה עוברת בשפל ונעה ימינה.', 'bad');
          PHY.mascot.say('אני עדיין פה. התפוח עדיין שם. זה הכי עצוב.', 'dizzy');
          setAction('מנסים שוב', api.retry);
        }
      }
    }

    function stepMetro(dt) {
      const w2 = G.k / G.m;
      const n = K.verlet(G.x, G.v, function (x) { return -w2 * x; }, dt);
      G.x = n.x; G.v = n.v;
      G.t += dt;
      const before = G.meter.n;
      G.meter.feed(G.v, G.t, dt);
      if (G.meter.n > before) G.springTicks.push(G.meter.last);
      if (G.t >= 8) {
        if (G.phase === 'play') resetMetro();
        else { G.t = 0; G.springTicks = []; G.meter = K.cycleMeter(1); G.x = 0.7; G.v = 0; }
      }
    }

    function stepTwo(dt) {
      const L = G.L, w2 = L.k / L.m;
      const acc = function (x) { return -w2 * x; };
      const a = K.verlet(G.x1, G.v1, acc, dt);
      G.x1 = a.x; G.v1 = a.v;
      if (G.released) {
        const b = K.verlet(G.x2, G.v2, acc, dt);
        G.x2 = b.x; G.v2 = b.v;
      }
      G.t += dt;
      if (G.phase === 'watch') {
        G.watch -= dt;
        if (G.watch <= 0) judge();
      }
    }

    function measuredError() {
      const L = G.L, w = TAU / L.T;
      return wrap(phaseOf(G.x1, G.v1, L.A1, w) - phaseOf(G.x2, G.v2, L.A2, w));
    }

    function judge() {
      const L = G.L;
      const d = measuredError();
      G.err = d;
      const frac = Math.abs(d) / TAU;
      const dt = (Math.abs(d) / TAU) * L.T;
      if (frac <= WIN3) {
        const pts = frac <= 0.04 ? 3 : frac <= 0.06 ? 2 : 1;
        win(pts, 'באותו מופע! הפרש של ' + F.unit(dt, 's', 2) + ' בלבד, אף שהמשרעות שונות. ' + pts + ' מתוך 3 נקודות.');
      } else {
        G.phase = 'missed';
        hud.say((d > 0 ? 'שחררנו מאוחר ב-' : 'שחררנו מוקדם ב-') + F.unit(dt, 's', 2) + '. הן אף פעם לא יתיישרו לבד, כי לשתיהן אותו T. על השעון בצד רואים את הפער.', 'bad');
        PHY.mascot.say('אחד הולך, השני חוזר. זה לא ריקוד, זה ויכוח.', 'dizzy');
        setAction('לתפוס אותה שוב', api.retry);
      }
    }

    function step(dt) {
      G.floaters = G.floaters.filter(function (f) { f.t -= dt; return f.t > 0; });
      if (G.phase === 'final') return;
      if (G.i === 0) stepSwing(dt);
      else if (G.i === 1) stepMetro(dt);
      else stepTwo(dt);
    }

    /* ---------- drawing ---------- */
    const catSize = (lo, hi) => Math.max(lo, Math.min(hi, view.scale * 0.62));
    function drawFloaters() {
      G.floaters.forEach(function (f, i) {
        view.screenText(view.w / 2, 46 + i * 22 - (1.3 - f.t) * 14, f.text, { size: 14, weight: 700, color: C[f.color], alpha: Math.min(1, f.t * 2), halo: true });
      });
    }

    function drawSwing() {
      const L = G.L;
      const r = view.visible;
      const seat = { x: L.L * Math.sin(G.th), y: PIVOT_Y - L.L * Math.cos(G.th) };
      const low = PIVOT_Y - L.L;
      view.line(r.xMin, PIVOT_Y, r.xMax, PIVOT_Y, { color: C.axis, width: 5, cap: 'butt' });
      view.arc(0, PIVOT_Y, L.L * view.scale, -90 - 62, -90 + 62, { color: C.gridStrong, width: 2, dash: [4, 5] });
      /* Target height line and the apple on it. */
      const ax = L.L * Math.sin(L.thT * RAD), ay = PIVOT_Y - L.L * Math.cos(L.thT * RAD);
      view.line(-ax, ay, ax, ay, { color: C.soft, width: 1.5, dash: [5, 6], alpha: 0.7 });
      if (G.phase !== 'won') H2.drawApple(view, view.sx(ax + 0.12), view.sy(ay + 0.1), 12);
      /* The peak of the current swing. */
      const pk = Math.acos(Math.max(-1, Math.min(1, 1 - G.peak / L.L)));
      view.circle(L.L * Math.sin(pk), PIVOT_Y - L.L * Math.cos(pk), 5, { px: true, fill: C.gold, color: C.ink, width: 1.5 });
      view.line(0, PIVOT_Y, seat.x, seat.y, { color: C.ink, width: 2.5 });
      const nx = Math.cos(G.th), ny = Math.sin(G.th);
      view.line(seat.x - nx * 0.28, seat.y - ny * 0.28, seat.x + nx * 0.28, seat.y + ny * 0.28, { color: C.ink, width: 6, cap: 'butt' });
      PHY.mascot.draw(view, seat.x, seat.y + 2 / view.scale, { pose: G.phase === 'won' ? 'happy' : G.phase === 'lost' ? 'dizzy' : 'standing', px: catSize(44, 84), rot: G.th / RAD });
      /* Velocity, tangent to the arc, and the push. */
      const vLen = L.L * G.om * 0.32;
      if (Math.abs(vLen) > 0.05) view.arrow(seat.x, seat.y, seat.x + nx * vLen, seat.y + ny * vLen, { color: C.velocity, width: 3.2, head: 11 });
      if (G.flash > 0) view.arrow(seat.x - 0.72, seat.y + 0.2, seat.x - 0.12, seat.y + 0.2, { color: C.force, width: 4.5, head: 13 });
      view.line(-0.25, low - 0.1, 0.25, low - 0.1, { color: C.gridStrong, width: 2 });
      view.text(0, low - 0.1, 'שפל', { size: 11.5, color: C.soft, offset: [0, 11], halo: true });
      out.set('a', G.pushes + ' מתוך ' + L.limit);
      out.set('b', F.unit(G.peak, 'm', 2));
    }

    function drawMetro() {
      const L = G.L;
      const s = view.scale;
      /* The metronome: its rod is at the right end exactly at each tick. */
      const base = { x: 0, y: 1.22 };
      const tick = G.t % L.T;
      const ang = 28 * Math.cos((TAU * G.t) / L.T);
      const near = Math.min(tick, L.T - tick) < 0.09;
      view.poly([{ x: -0.42, y: base.y }, { x: 0.42, y: base.y }, { x: 0.2, y: base.y + 0.92 }, { x: -0.2, y: base.y + 0.92 }], { fill: near ? C.gold : C.grid, color: C.axis, width: 2, close: true });
      const tip = { x: base.x + 0.9 * Math.sin(ang * RAD), y: base.y + 0.9 * Math.cos(ang * RAD) };
      view.line(base.x, base.y + 0.08, tip.x, tip.y, { color: C.ink, width: 3 });
      view.circle(tip.x, tip.y, 5, { px: true, fill: C.apple, color: C.ink, width: 1.5 });
      /* The cart. */
      const deck = 16 / s;
      K.wall(view, -NAT, 0, 0.92);
      K.floor(view, 0);
      K.spring(view, -NAT, deck * 0.72, G.x - 23 / s, deck * 0.72, { amp: 7, coils: 9 });
      view.line(0.7, -0.06, 0.7, 0.9, { color: C.displacement, width: 1.6, dash: [4, 5] });
      K.cart(view, G.x, 0, { catPx: catSize(44, 72), pose: G.phase === 'won' ? 'happy' : 'standing' });
      /* Two rows of marks on a timeline: when the metronome ticked, and when the cart reached the end. */
      const x0 = view.sx(-2.2), x1 = view.sx(2.2), y1 = view.sy(2.74), y2 = view.sy(2.46);
      const X = (t) => x0 + (t / 8) * (x1 - x0);
      const P = H2.pix(view);
      P.line(x0, y1, x1, y1, { color: C.grid, width: 1.5 });
      P.line(x0, y2, x1, y2, { color: C.grid, width: 1.5 });
      for (let n = 1; n * L.T <= G.t; n++) P.circle(X(n * L.T), y1, 5, { fill: C.gold, color: C.ink, width: 1 });
      G.springTicks.forEach(function (t) { P.circle(X(t), y2, 5, { fill: C.accent, color: C.ink, width: 1 }); });
      P.line(X(G.t), y1 - 8, X(G.t), y2 + 8, { color: C.soft, width: 1.5 });
      view.screenText(x0, y1 - 13, 'תקתוק', { size: 11, weight: 700, align: 'left', color: C.soft });
      view.screenText(x0, y2 + 13, 'קרונית בקצה', { size: 11, weight: 700, align: 'left', color: C.soft });
      out.set('a', String(G.attempts));
      out.set('b', F.unit(L.T, 's', 2));
    }

    function drawRow(y, x, A, label, pose) {
      const s = view.scale;
      const deck = 16 / s;
      K.wall(view, -NAT, y, y + 0.88);
      K.floor(view, y);
      K.spring(view, -NAT, y + deck * 0.72, x - 21 / s, y + deck * 0.72, { amp: 6.5, coils: 9 });
      view.line(A, y - 0.05, A, y + 0.86, { color: C.displacement, width: 1.6, dash: [4, 5] });
      K.cart(view, x, y, { w: 42, catPx: catSize(42, 66), pose: pose });
      view.text(view.visible.xMax, y, label, { size: 12, weight: 700, align: 'right', offset: [-4, 11], halo: true });
    }

    function drawTwo() {
      const L = G.L, w = TAU / L.T;
      drawRow(1.16, G.x1, L.A1, 'רצה', 'happy');
      drawRow(0, G.x2, L.A2, G.released ? 'רצה' : 'מחכה', G.released ? 'happy' : 'thinking');
      /* The phase clock: each cart is the shadow of a dot on this circle. */
      const R = 0.46, cx = 1.72, cy = 2.56;
      view.circle(cx, cy, R, { fill: C.grid, color: C.axis, width: 2 });
      view.line(cx + R * 0.82, cy, cx + R * 1.18, cy, { color: C.ink, width: 2 });
      const p1 = phaseOf(G.x1, G.v1, L.A1, w), p2 = phaseOf(G.x2, G.v2, L.A2, w);
      view.circle(cx + R * Math.cos(p1), cy + R * Math.sin(p1), 6.5, { px: true, fill: C.accent, color: C.ink, width: 1.5 });
      view.circle(cx + R * Math.cos(p2), cy + R * Math.sin(p2), 6.5, { px: true, fill: C.gold, color: C.ink, width: 1.5 });
      view.text(cx, cy, 'מופע', { size: 11.5, weight: 700, color: C.soft, offset: [0, 0] });
      out.set('a', String(G.tries));
      out.set('b', F.unit(L.T, 's', 2));
    }

    function render() {
      view.clear();
      if (G.phase === 'final') {
        view.screenText(view.w / 2, 26, 'הנדנדה נחה, הקפיצים נחים, ניוטון לא.', { size: 14, weight: 700 });
        PHY.mascot.draw(view, 0, 0.3, { pose: 'happy', px: 130 });
        return;
      }
      if (G.i === 0) drawSwing();
      else if (G.i === 1) drawMetro();
      else drawTwo();
      drawFloaters();
    }

    const loop = PHY.SimLoop({ view, step, render });

    view.onTap(function () {
      if (G.phase !== 'play') return;
      if (G.i === 0) api.push();
      else if (G.i === 2) api.release();
    });

    /* ---------- the API, which the buttons and the tests both drive ---------- */
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { api.restart(); },
      restart() {
        G.points = [];
        G.stars = 0;
        hud.showMain();
        startLevel(0);
      },
      /* Level 1. Returns the change in peak height, or null if the hand is not back yet. */
      push() {
        if (G.i !== 0 || G.phase !== 'play') return null;
        const L = G.L;
        if (G.cool > 0) { floater('היד עוד חוזרת...', 'soft'); return null; }
        if (G.pushes >= L.limit) return null;
        const before = { th: G.th, om: G.om };
        G.om += DV / L.L;
        G.pushes++;
        G.cool = 0.45 * L.T;
        G.flash = 0.3;
        const d = peakHeight({ th: G.th, om: G.om }, L.L) - peakHeight(before, L.L);
        const moving = before.om > 0.02;
        /* How fast the swing is here, compared with its speed at the bottom of this same swing. */
        const fast = Math.abs(before.om) * L.L >= 0.6 * Math.sqrt(20 * peakHeight(before, L.L));
        if (moving) {
          floater('+' + F.unit(d, 'm', 2) + ' גובה', 'good');
          hud.say(fast ? 'יפה! דחיפה עם התנועה, כשהנדנדה מהירה, והיא מרוויחה הכי הרבה גובה.' : 'עם התנועה, אבל כאן הנדנדה איטית. בשפל היא מהירה, ושם אותה דחיפה שווה יותר.', 'good');
        } else if (d < 0) {
          floater(F.unit(d, 'm', 2) + ' גובה', 'bad');
          hud.say('הנדנדה נעה שמאלה, והדחיפה ימינה: זו דחיפה נגד התנועה, והיא גנבה אנרגיה.', 'bad');
          if (G.pushes === 3) PHY.mascot.say('היי! עצרת אותי באמצע התעופה.', 'dizzy');
        } else if (before.om < -0.02) {
          floater('+' + F.unit(d, 'm', 2) + ' גובה', 'soft');
          hud.say('הנדנדה נעה שמאלה לאט, והדחיפה הפכה את הכיוון. זה הוסיף קצת גובה, ובשפל, בתנועה ימינה, זה היה מוסיף הרבה יותר.', '');
        } else {
          floater('+' + F.unit(d, 'm', 2) + ' גובה', 'soft');
          hud.say('בקצה הנדנדה כמעט עומדת, אז הדחיפה מוסיפה מעט מאוד.', '');
        }
        if (G.pushes >= L.limit) G.lostIn = 1.2 * L.T;
        return d;
      },
      /* Level 2. Returns the relative mismatch. */
      check() {
        if (G.i !== 1 || G.phase !== 'play') return null;
        G.attempts++;
        const L = G.L, T = K.period(G.m, G.k);
        const e = (T - L.T) / L.T;
        if (Math.abs(e) <= TOL2) {
          const pts = G.attempts <= 2 ? 3 : G.attempts <= 4 ? 2 : 1;
          win(pts, 'בקצב! T של הקפיץ ' + F.unit(T, 's', 2) + '. בבדיקה מספר ' + G.attempts + '. ' + pts + ' מתוך 3 נקודות.');
          resetMetro();
        } else if (e > 0) {
          hud.say('הקפיץ איטי מדי: T = ' + F.unit(T, 's', 2) + ', והמטרונום ' + F.unit(L.T, 's', 2) + '. צריך מסה קטנה יותר או קפיץ קשיח יותר.', 'bad');
        } else {
          hud.say('הקפיץ מהיר מדי: T = ' + F.unit(T, 's', 2) + ', והמטרונום ' + F.unit(L.T, 's', 2) + '. צריך מסה גדולה יותר או קפיץ רך יותר.', 'bad');
        }
        if (G.attempts === 4 && G.phase === 'play') PHY.mascot.say('עוד קצת מסה ואני כבר לא מסתובב, אני רק נאנח.', 'dizzy');
        return e;
      },
      /* Level 3. Lets the waiting cart go, then watches for 1.5 periods before judging. */
      release() {
        if (G.i !== 2 || G.phase !== 'play') return;
        G.released = true;
        G.tries++;
        G.phase = 'watch';
        G.watch = 1.5 * G.L.T;
        hud.say('רואים אם הן נפגשות בקצה...', '');
        setAction('', null);
        action.textContent = 'מסתכלים...';
      },
      /* After a failure: the same level, same numbers, a clean try. */
      retry() {
        if (G.i === 0 && G.phase === 'lost') {
          G.retries++;
          const r = G.retries;
          initSwing();
          G.retries = r;
          G.phase = 'play';
          hud.say('');
        } else if (G.i === 2 && G.phase === 'missed') {
          G.x2 = G.L.A2; G.v2 = 0; G.released = false; G.err = null;
          G.phase = 'play';
          hud.say('');
          setAction('שחרור!', api.release);
        }
        loop.requestRender();
      },
      next() { if (G.phase === 'won') action.click(); },
      setParam(name, v) {
        if (name === 'm') { mSlider.set(v); setTune('m', v); }
        if (name === 'k') { kSlider.set(v); setTune('k', v); }
      },
      advance(seconds) {
        const n = Math.round(seconds * 120);
        for (let j = 0; j < n; j++) step(1 / 120);
      },
      solutions() {
        const list = [];
        M_GRID.forEach(function (m) {
          K_GRID.forEach(function (k) { if (Math.abs(K.period(m, k) - G.L.T) / G.L.T <= TOL2) list.push({ m, k }); });
        });
        return list;
      },
      getState() {
        const L = G.L;
        const base = { level: G.i, phase: G.phase, points: G.points.slice(), stars: G.stars, feedback: hud.feedback.textContent };
        if (G.i === 0) return Object.assign(base, { th: G.th, om: G.om, pushes: G.pushes, par: L.par, limit: L.limit, L: L.L, thT: L.thT, T: L.T, cool: G.cool, peak: G.peak, target: G.target });
        if (G.i === 1) return Object.assign(base, { T: L.T, m: G.m, k: G.k, attempts: G.attempts, x: G.x, witness: L.witness, springT: G.meter.T });
        return Object.assign(base, { T: L.T, x1: G.x1, v1: G.v1, x2: G.x2, v2: G.v2, A1: L.A1, A2: L.A2, released: G.released, err: G.err, tries: G.tries, phaseGap: measuredError() });
      },
    };

    startLevel(0);
    return api;
  };
})();

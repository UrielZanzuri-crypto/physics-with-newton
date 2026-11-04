/* PHY.sims.missionOrbit: "משימה למסלול". Three levels with random numbers. Time is accelerated. Stars by fuel.
   Level 1: pick the launch speed for a circular orbit at a given height.
   Level 2: two burns to a higher ring. A slider sets the burn, a dashed line shows its result, and the second burn
            only makes a circle if it happens at the far point.
   Level 3: catch the apple station. The burns are fixed, the moment is the choice. A ghost shows where the station
            will be on arrival. A miss costs the fuel of the failed trip and of coming back.
   Fuel is the sum of all speed changes, in km/s, against the cheapest way: 3 points close to it, then 2, then 1.
   opts: {chapter, section, onDone(stars, total), seed}.
   API for the solver: launch() -> Promise, burn(), next(), advance(s), reset(), setParam: speed (km/s), dv (km/s), retro.
   getState() has the level, phase, target numbers, the window error and the current orbit. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav;
  const R = G.R;
  const NAMES = ['שלב 1: שיגור', 'שלב 2: שתי הדלקות', 'שלב 3: תחנת התפוחים'];
  const HEIGHTS = [400, 800, 1600, 3200, 6400];
  const E_WIN = 0.035;
  const RING_TOL = 0.06;
  const WINDOW_TOL = 10;

  function rngFrom(seed) {
    if (seed === undefined || seed === null) return Math.random;
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const wrapDeg = (d) => { let x = d % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };
  const angDeg = (b) => (Math.atan2(b.y, b.x) * 180) / Math.PI;

  PHY.sims.missionOrbit = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const rand = rngFrom(opts.seed);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 10, yMin: 0, yMax: 6 }, aspect: 1.25, minHeight: 330, maxHeight: 480 });
    const P = PHY.ch02.pix(view);
    const M = {
      i: 0, L: null, phase: 'aim', fuel: 0, attempts: 0, points: [], ship: null, st: null, trail: [], accel: 1, caption: '', speed: 7.5, dv: 0, retro: false,
      t: 0, tEnd: 0, resolve: null, burns: [], stars: 0, lastMiss: null, flightEnd: null,
    };
    const hud = {};

    function makeLevel(i) {
      if (i === 0) {
        const h = pick(HEIGHTS) * 1000;
        const r = R + h;
        return { h, r, vc: G.vCirc(r), viewR: Math.max(r * 1.38, 2.1 * R), ideal: G.vCirc(r) };
      }
      if (i === 1) {
        const r1 = pick([1.2, 1.4, 1.6]) * R;
        const r2 = Math.round((r1 / R) * (1.6 + rand() * 0.6) * 10) / 10 * R;
        const H = G.hohmann(r1, r2);
        return { r1, r2, H, viewR: r2 * 1.22, ideal: H.dv1 + H.dv2, accel: G.period(r1) / 9 };
      }
      const r1 = pick([1.3, 1.4, 1.5]) * R;
      const r2 = r1 * (1.55 + rand() * 0.25);
      const H = G.hohmann(r1, r2);
      const accel = H.t / 8;
      return { r1, r2, H, viewR: r2 * 1.22, ideal: H.dv1 + H.dv2, accel };
    }

    /* Level 3: places the ship and the station so that the window opens `wait` seconds on screen from now. */
    function placeStation(L, wait) {
      const n1 = 360 / G.period(L.r1), n2 = 360 / G.period(L.r2);
      const shipA = 200;
      const stationA = shipA + 180 - n2 * L.H.t + (n1 - n2) * wait * L.accel;
      M.ship = G.circular(L.r1, shipA, 1);
      M.st = G.circular(L.r2, stationA, 1);
    }

    function startLevel(i) {
      M.i = i;
      M.L = makeLevel(i);
      M.phase = 'aim';
      M.fuel = 0;
      M.attempts = 0;
      M.trail = [];
      M.caption = '';
      M.burns = [];
      M.t = 0;
      M.lastMiss = null;
      M.flightEnd = null;
      M.retro = false;
      M.dv = 0;
      const L = M.L;
      hud.speedWrap.hidden = i !== 0;
      hud.dvWrap.hidden = i !== 1;
      hud.restart.hidden = i !== 1;
      hud.retro.el.hidden = i !== 1;
      hud.retro.set(false);
      if (i === 0) {
        M.ship = null;
        M.st = null;
        M.accel = 1;
        M.speed = 5;
        hud.speed.set(5);
        hud.speed.setEnabled(true);
        hud.task.textContent = 'מגדל בגובה ' + G.km(L.h) + ' מעל הקרקע. איזו מהירות אופקית נותנת מעגל בדיוק בגובה של המגדל? R הוא ' + G.km(R) + ', ו-g הוא 10 מ/ש².';
        setAction('שיגור!', launch);
      } else if (i === 1) {
        M.ship = G.circular(L.r1, 200, 1);
        M.st = null;
        M.accel = L.accel;
        hud.dv.set(0);
        hud.dv.setEnabled(true);
        hud.task.textContent = 'להעלות את ניוטון לטבעת הירוקה בשתי הדלקות. הסליידר קובע את הדחיפה, והקו המקווקו מראה לאן היא תוביל. עדיף לחסוך: כל דחיפה שורפת דלק.';
        setAction('הדלקה!', burn);
      } else {
        M.accel = L.accel;
        placeStation(L, 3.2 + rand() * 2.6);
        hud.task.textContent = 'התחנה בטבעת הירוקה, והטיסה אליה קבועה. נשאר רק לבחור מתי. התפוח השקוף מראה איפה התחנה תהיה בזמן ההגעה, והוא צריך לפגוש את ה-X.';
        setAction('הדלקה!', burn);
      }
      hud.main.hidden = false;
      hud.task.hidden = false;
      hud.final.hidden = true;
      feedback('');
      paintPips();
      paintStats();
      loop.requestRender();
    }

    function setAction(text, fn) {
      hud.action.textContent = text;
      hud.action.onclick = fn;
      hud.action.disabled = false;
    }
    function feedback(text, kind) {
      hud.feedback.textContent = text;
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === M.i && M.phase !== 'done' ? ' is-now' : '') + (M.points[j] ? ' is-done' : '');
        p.textContent = NAMES[j] + (M.points[j] ? ' (' + M.points[j] + ')' : '');
      });
    }
    function paintStats() {
      hud.out.set('fuel', G.kms(M.fuel, 2));
      /* In level 1 the cheapest fuel is the answer itself, so it stays hidden until the win. */
      hud.out.set('ideal', M.i === 0 && M.phase !== 'won' ? '?' : G.kms(M.L.ideal, 2));
      hud.out.set('tries', String(M.attempts));
    }

    /* ---------- Level 1 ---------- */
    function launch() {
      if (M.phase !== 'aim' || M.i !== 0) return Promise.resolve(null);
      const L = M.L;
      const v = M.speed * 1000;
      M.attempts++;
      M.fuel += v;
      M.ship = G.body(0, L.r, v, 0);
      M.el = G.elements(M.ship);
      M.phase = 'fly';
      M.t = 0;
      M.trail = [{ x: M.ship.x, y: M.ship.y }];
      M.caption = '';
      const shown = M.el.bound ? Math.min(M.el.T, 2.4 * G.period(L.r)) : 3 * G.period(L.r);
      M.accel = shown / 4.2;
      M.tEnd = M.el.bound ? M.el.T : Infinity;
      hud.action.disabled = true;
      hud.speed.setEnabled(false);
      feedback('');
      paintStats();
      return new Promise(function (resolve) { M.resolve = resolve; });
    }
    function endFlight(kind) {
      const L = M.L;
      const el = M.el;
      M.phase = 'aim';
      const result = { kind, e: el.e, rp: el.rp, ra: el.ra };
      M.flightEnd = result;
      const win = kind === 'orbit' && el.e <= E_WIN;
      if (win) levelWon();
      else {
        const vcTxt = M.attempts >= 2 ? ' כדאי לחשב: ‎' + 'v² = gR² / r.' : '';
        if (kind === 'crash') {
          feedback('איטי מדי: הקרקע הגיעה לפני שהאדמה התעקלה מספיק. צריך יותר מהירות.' + vcTxt, 'bad');
          PHY.mascot.say('אדמה. שוב. אני מתחיל לזהות את הגרגרים.', 'dizzy');
        } else if (kind === 'away' || el.ra > L.r * (1 + 2 * E_WIN)) {
          const far = isFinite(el.ra) ? ' הוא הגיע עד ' + G.km(el.ra) + ' מהמרכז.' : '';
          feedback((el.bound ? 'מהיר מדי: יצאה אליפסה, לא מעגל.' : 'מהיר מדי: ניוטון בורח ולא חוזר.') + far + ' צריך פחות מהירות.' + vcTxt, 'bad');
        } else {
          feedback('כמעט, אבל איטי מדי: המסלול צלל ל-' + G.km(el.rp) + ' מהמרכז. צריך עוד קצת מהירות.' + vcTxt, 'bad');
        }
        hud.speed.setEnabled(true);
        hud.action.disabled = false;
      }
      if (M.resolve) { const r = M.resolve; M.resolve = null; r(result); }
    }

    /* ---------- Levels 2 and 3 ---------- */
    function burn() {
      if (M.i === 0) return launch();
      if (M.phase !== 'aim') return;
      const L = M.L;
      if (M.i === 1) {
        if (M.dv <= 0) { feedback('הסליידר על 0. דחיפה של 0 ק"מ/ש משאירה הכול כמו שהוא.', 'bad'); return; }
        applyBurn(M.ship, (M.retro ? -1 : 1) * M.dv * 1000);
        M.attempts++;
        M.burns.push({ dv: M.dv, phase: orbitPhase() });
        hud.dv.set(0);
        M.dv = 0;
        M.trail = [];
        const el = G.elements(M.ship);
        if (ringOk(el, L.r2)) { levelWon(); return; }
        if (!el.bound || el.rp < R * 1.005 || el.ra > L.viewR * 2.2) {
          feedback(el.rp < R * 1.005 ? 'המסלול החדש פוגע בקרקע. מתחילים שוב מהמסלול הפנימי, וכל מה שנשרף נספר.' : 'הדחיפה הזאת שולחת את ניוטון רחוק מדי. מתחילים שוב מהמסלול הפנימי, וכל מה שנשרף נספר.', 'bad');
          PHY.mascot.say('תודה על הטיול. לא ביקשתי.', 'dizzy');
          M.ship = G.circular(L.r1, 200, 1);
        } else if (Math.abs(el.ra - L.r2) / L.r2 > RING_TOL) {
          feedback(el.ra < L.r2 ? 'הנקודה הרחוקה עדיין לא בטבעת. אפשר עוד דחיפה, אבל זה דלק נוסף.' : 'הנקודה הרחוקה עברה את הטבעת. אפשר לתקן בבלימה, אבל זה דלק נוסף.', 'bad');
        } else {
          feedback('הנקודה הרחוקה בטבעת. עכשיו מחכים שניוטון יגיע אליה, ושם הדלקה שנייה.', 'good');
        }
        paintStats();
        return;
      }
      /* Level 3 */
      M.attempts++;
      applyBurn(M.ship, L.H.dv1);
      M.phase = 'transfer';
      M.t = 0;
      M.tEnd = L.H.t;
      M.trail = [{ x: M.ship.x, y: M.ship.y }];
      hud.action.disabled = true;
      feedback('');
      paintStats();
    }
    function applyBurn(b, dv) {
      const v = Math.hypot(b.vx, b.vy);
      b.vx *= (v + dv) / v;
      b.vy *= (v + dv) / v;
      M.fuel += Math.abs(dv);
    }
    function ringOk(el, r2) {
      return el.bound && Math.abs(el.rp - r2) / r2 <= RING_TOL && Math.abs(el.ra - r2) / r2 <= RING_TOL;
    }
    /* Where the ship is on its orbit, from the near point: 0 and 360 near, 180 far. */
    function orbitPhase() {
      const el = G.elements(M.ship);
      return ((angDeg(M.ship) - (el.w * 180) / Math.PI) % 360 + 360) % 360;
    }
    /* Level 3: how far apart the station and the ship would be on arrival if the burn were now. */
    function windowError() {
      const L = M.L;
      if (M.i !== 2 || !M.ship || !M.st) return null;
      const n2 = 360 / G.period(L.r2);
      return wrapDeg(angDeg(M.st) + n2 * L.H.t - (angDeg(M.ship) + 180));
    }
    function arriveAtStation() {
      const L = M.L;
      /* Second burn: at the far point, onto the ring. */
      applyBurn(M.ship, L.H.dv2);
      const gap = wrapDeg(angDeg(M.st) - angDeg(M.ship));
      if (Math.abs(gap) <= WINDOW_TOL) {
        M.lastMiss = null;
        levelWon();
        return;
      }
      M.lastMiss = gap;
      M.phase = 'aim';
      feedback('החמצה ב-' + G.deg(Math.abs(gap)) + (gap > 0 ? ': התחנה עוד לפנינו, אז הדלקנו מוקדם מדי. אפשר לחכות יותר.' : ': התחנה כבר עברה, אז הדלקנו מאוחר מדי. עדיף קצת קודם.') + ' החזרה למסלול הפנימי שורפת עוד דלק.', 'bad');
      PHY.mascot.say('הגעתי. התפוחים לא. זה הסיפור של החיים שלי.', 'dizzy');
      M.fuel += L.H.dv1 + L.H.dv2;
      placeStation(L, 3 + rand() * 2.4);
      M.trail = [];
      hud.action.disabled = false;
      paintStats();
    }

    function levelWon() {
      const L = M.L;
      const ratio = M.fuel / L.ideal;
      const limits = M.i === 0 ? [1.1, 2.2] : M.i === 1 ? [1.08, 1.35] : [1.1, 3.2];
      const pts = ratio <= limits[0] ? 3 : ratio <= limits[1] ? 2 : 1;
      M.points[M.i] = pts;
      M.phase = 'won';
      M.lastRatio = ratio;
      M.trail = [];
      M.caption = pts + ' מתוך 3 נקודות';
      const texts = [
        'מעגל! ' + G.kms(M.speed * 1000) + ' בגובה הזה זה בדיוק מה שצריך.',
        'בטבעת! ' + G.kms(M.fuel, 2) + ' דלק, והכי חסכוני הוא ' + G.kms(L.ideal, 2) + '.',
        'עגינה! התפוחים בהישג יד, ובעלות של ' + G.kms(M.fuel, 2) + ' דלק.',
      ];
      feedback(texts[M.i], 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(M.i === 2 ? 'תחנה. תפוחים. אפס כבידה מורגשת. אני נשאר פה.' : pts === 3 ? 'חסכוני. אני מתרשם, אבל לא אגיד את זה בקול.' : 'הגענו. מה שנשרף לא יחזור, אבל גם אני לא.', 'happy');
      hud.speed.setEnabled(false);
      hud.dv.setEnabled(false);
      hud.retro.el.hidden = true;
      hud.restart.hidden = true;
      if (M.i < 2) setAction('לשלב הבא', function () { startLevel(M.i + 1); });
      else setAction('לסיכום', finish);
      paintPips();
      paintStats();
    }

    function finish() {
      const total = M.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      M.phase = 'done';
      M.stars = stars;
      paintPips();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.task.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', {
        class: 'game-task',
        text: total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'טיסה חסכונית לכל הדעות. ניוטון מבקש קידום, ותפוח.' : stars === 2 ? 'המשימה הושלמה. בסיבוב הבא אפשר לחסוך עוד דלק.' : 'התחנה הושגה, וזה מה שחשוב. בפעם הבאה: פחות דלק, אותה תאוצה.'),
      }));
      U.Button(hud.final, 'עוד משימה, עם מספרים חדשים', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() {
      M.points = [];
      M.stars = 0;
      startLevel(0);
    }

    /* ---------- Physics ---------- */
    function step(dt) {
      if (M.phase === 'done') return;
      const L = M.L;
      if (M.i === 0) {
        if (M.phase !== 'fly') {
          if (M.phase === 'won' && M.ship) G.advance(M.ship, dt * M.accel, 8);
          return;
        }
        const total = dt * M.accel;
        const n = Math.max(1, Math.ceil(total / 6));
        const h = total / n;
        for (let i = 0; i < n; i++) {
          const use = M.t + h > M.tEnd ? M.tEnd - M.t : h;
          if (use > 0) G.verlet(M.ship, use);
          M.t += use;
          const r = Math.hypot(M.ship.x, M.ship.y);
          if (r < R) { M.trail.push({ x: M.ship.x, y: M.ship.y }); endFlight('crash'); return; }
          if (M.t >= M.tEnd - 1e-6) { M.trail.push({ x: M.ship.x, y: M.ship.y }); endFlight('orbit'); return; }
          if (r > L.viewR * 1.7) { M.trail.push({ x: M.ship.x, y: M.ship.y }); endFlight('away'); return; }
        }
        pushTrail();
        return;
      }
      const total = dt * M.accel;
      const n = Math.max(1, Math.ceil(total / 8));
      const h = total / n;
      for (let i = 0; i < n; i++) {
        let use = h;
        if (M.phase === 'transfer' && M.t + h >= M.tEnd) use = M.tEnd - M.t;
        if (use > 0) {
          if (M.ship) G.verlet(M.ship, use);
          if (M.st) G.verlet(M.st, use);
        }
        M.t += use;
        if (M.phase === 'transfer' && M.t >= M.tEnd - 1e-6) { arriveAtStation(); }
      }
      pushTrail();
    }
    function pushTrail() {
      if (!M.ship || (M.phase === 'aim' && M.i === 2)) return;
      const last = M.trail[M.trail.length - 1];
      if (!last || Math.hypot(M.ship.x - last.x, M.ship.y - last.y) > R * 0.05) M.trail.push({ x: M.ship.x, y: M.ship.y });
      if (M.trail.length > 280) M.trail.shift();
    }

    /* ---------- Drawing ---------- */
    function render() {
      const L = M.L;
      const w = view.w, h = view.h;
      const small = w < 480;
      view.clear();
      G.drawStars(view);
      const cx = w / 2, cy = h / 2 + 10;
      const k = (Math.min(w, h - 26) / 2 - 6) / L.viewR;
      const map = (p) => ({ x: cx + p.x * k, y: cy - p.y * k });
      const toWorld = (p) => view.toWorld(map(p).x, map(p).y);
      G.drawEarth(view, cx, cy, R * k);

      const ringR = M.i === 0 ? L.r : L.r2;
      P.circle(cx, cy, ringR * k, { color: C.good, width: 2.4, dash: [6, 6] });
      if (M.i > 0) P.circle(cx, cy, L.r1 * k, { color: C.gridStrong, width: 1.2, dash: [3, 5] });

      if (M.i === 0) {
        /* Tower */
        P.line(cx, cy - R * k, cx, cy - L.r * k, { color: C.axis, width: 5, cap: 'butt' });
        view.screenText(cx - 8, cy - ((R + L.r) / 2) * k, G.km(L.h), { size: small ? 11.5 : 12.5, weight: 700, halo: true, align: 'right' });
        const tip = { x: 0, y: L.r };
        PHY.ballistics.drawCannon(view, view.toWorld(map(tip).x, map(tip).y).x, view.toWorld(map(tip).x, map(tip).y).y, 0, { len: small ? 18 : 22, w: small ? 8 : 10 });
      }

      /* Preview */
      if (M.i === 1 && M.phase === 'aim' && M.dv > 0) {
        const b = { x: M.ship.x, y: M.ship.y, vx: M.ship.vx, vy: M.ship.vy };
        const v = Math.hypot(b.vx, b.vy);
        const d = (M.retro ? -1 : 1) * M.dv * 1000;
        b.vx *= (v + d) / v;
        b.vy *= (v + d) / v;
        const el = G.elements(b);
        G.orbitPath(el, 180, L.viewR * 2).forEach(function (seg) { G.drawPath(view, seg, map, { color: C.soft, width: 2, dash: [5, 5] }); });
      }
      if (M.i === 2 && M.phase === 'aim') {
        const a = (angDeg(M.ship) * Math.PI) / 180;
        const pts = [];
        const aT = L.H.a, e = (L.r2 - L.r1) / (L.r2 + L.r1), p = aT * (1 - e * e);
        for (let j = 0; j <= 60; j++) {
          const th = (j / 60) * Math.PI;
          const r = p / (1 + e * Math.cos(th));
          pts.push({ x: r * Math.cos(a + th), y: r * Math.sin(a + th) });
        }
        G.drawPath(view, pts, map, { color: C.soft, width: 2, dash: [5, 5] });
        const end = pts[pts.length - 1];
        const q = map(end);
        const ctx = view.ctx;
        ctx.save();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(q.x - 6, q.y - 6); ctx.lineTo(q.x + 6, q.y + 6);
        ctx.moveTo(q.x + 6, q.y - 6); ctx.lineTo(q.x - 6, q.y + 6);
        ctx.stroke();
        ctx.restore();
        /* Ghost station */
        const n2 = (2 * Math.PI) / G.period(L.r2);
        const sa = Math.atan2(M.st.y, M.st.x) + n2 * L.H.t;
        const g = map({ x: L.r2 * Math.cos(sa), y: L.r2 * Math.sin(sa) });
        PHY.ch02.drawApple(view, g.x, g.y, small ? 9 : 11, { alpha: 0.45 });
        if (Math.abs(windowError()) <= WINDOW_TOL * 0.85) view.screenText(cx, 15, 'עכשיו!', { size: 15, weight: 800, color: C.good, pill: true });
      }

      G.drawPath(view, M.trail, map, { color: C.accent, width: 2.4, alpha: 0.85 });

      /* Far point marker on the current ellipse */
      if (M.i === 1 && M.ship) {
        const el = G.elements(M.ship);
        if (el.bound && el.e > 0.015) {
          G.orbitPath(el, 160, L.viewR * 2).forEach(function (seg) { G.drawPath(view, seg, map, { color: C.accent, width: 1.5, alpha: 0.45 }); });
          const fx = -el.ra * Math.cos(el.w + 0), fy = -el.ra * Math.sin(el.w + 0);
          const q = map({ x: fx, y: fy });
          P.circle(q.x, q.y, 6, { color: C.accent, width: 2.5 });
          const off = Math.abs(wrapDeg(angDeg(M.ship) - angDeg({ x: fx, y: fy })));
          if (off < 7 && M.phase === 'aim') view.screenText(cx, 15, 'בנקודה הרחוקה!', { size: small ? 13.5 : 15, weight: 800, color: C.good, pill: true });
        }
      }

      /* Station and ship */
      if (M.st) {
        const q = map(M.st);
        G.drawSat(view, q.x, q.y, small ? 11 : 14, { color: C.gold });
        PHY.ch02.drawApple(view, q.x, q.y - (small ? 12 : 15), small ? 6 : 8);
      }
      const size = small ? 28 : 36;
      if (M.ship) {
        const q = map(M.ship);
        const sp = Math.hypot(M.ship.vx, M.ship.vy) || 1;
        const rot = (Math.atan2(M.ship.vy, M.ship.vx) * 180) / Math.PI;
        const a = toWorld(M.ship);
        const stopped = M.phase === 'won' || (M.i === 0 && M.phase === 'aim');
        PHY.mascot.draw(view, a.x, a.y, { pose: M.phase === 'won' ? 'happy' : stopped ? 'dizzy' : 'flying', px: size, rot: stopped ? 0 : rot, anchor: stopped ? [0.5, 0.65] : undefined });
        const vLen = (sp / 8000) * (small ? 38 : 48);
        if (!(M.i === 0 && M.phase === 'aim')) P.arrow(q.x, q.y, q.x + (M.ship.vx / sp) * vLen, q.y - (M.ship.vy / sp) * vLen, { color: C.velocity, width: 3, label: 'v', labelSize: 12, labelGap: 10 });
      } else if (M.i === 0) {
        const tip = view.toWorld(map({ x: 0, y: L.r }).x, map({ x: 0, y: L.r }).y);
        PHY.mascot.draw(view, tip.x - 14 / view.scale, tip.y, { pose: 'thinking', px: size, anchor: [0.5, 0.9] });
      }
      if (M.caption) view.screenText(cx, h - 16, M.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- HUD ---------- */
    hud.levels = U.h('div', { class: 'game-levels' });
    hud.pips = NAMES.map(function (n) {
      const p = U.h('span', { class: 'game-pip', text: n });
      hud.levels.appendChild(p);
      return p;
    });
    hud.main = U.h('div', { class: 'game-hud' });
    hud.final = U.h('div', { class: 'game-final', hidden: true });
    hud.task = U.h('div', { class: 'game-task' });
    hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary' });
    /* The task sits above the picture, so the picture and the button stay on one phone screen. */
    const top = U.h('div', { class: 'game-hud' }, [hud.levels, hud.task]);
    top.style.padding = '12px 14px';
    canvasEl.parentNode.insertBefore(top, canvasEl);
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.main, hud.final]));
    hud.speedWrap = U.h('div');
    hud.speed = U.Slider(hud.speedWrap, {
      label: 'מהירות השיגור', min: 3, max: 12, step: 0.1, value: 5, format: (v) => F.unit(v, G.KMS, 1), color: 'var(--c-velocity)',
      onInput(v) { M.speed = v; loop.requestRender(); },
    });
    hud.main.appendChild(hud.speedWrap);
    hud.dvWrap = U.h('div');
    hud.dv = U.Slider(hud.dvWrap, {
      label: 'עוצמת הדחיפה', min: 0, max: 3, step: 0.02, value: 0, format: (v) => F.unit(v, G.KMS, 2), color: 'var(--accent)',
      onInput(v) { M.dv = v; loop.requestRender(); },
    });
    hud.main.appendChild(hud.dvWrap);
    const actions = U.h('div', { class: 'sim-row' });
    hud.main.appendChild(actions);
    hud.main.appendChild(hud.feedback);
    hud.out = U.Readouts(hud.main, [
      { key: 'fuel', label: 'דלק שנשרף' },
      { key: 'ideal', label: 'הכי חסכוני אפשרי', color: 'var(--good)' },
      { key: 'tries', label: 'הדלקות וניסיונות' },
    ]);
    actions.appendChild(hud.action);
    hud.retro = U.Toggle(actions, 'בלימה, לא דחיפה', { value: false, onChange(v) { M.retro = v; loop.requestRender(); } });
    hud.restart = U.Button(actions, 'חזרה למסלול הפנימי', function () {
      if (M.i === 1 && M.phase === 'aim') {
        M.ship = G.circular(M.L.r1, 200, 1);
        M.trail = [];
        feedback('חזרנו למסלול הפנימי. מה שנשרף כבר נספר.', '');
        loop.requestRender();
      }
    }, { ghost: true });

    const api = {
      start: loop.start,
      stop: loop.stop,
      reset: restart,
      setParam(name, v) {
        if (name === 'speed') { M.speed = v; hud.speed.set(v); }
        if (name === 'dv') { M.dv = v; hud.dv.set(v); }
        if (name === 'retro') { M.retro = !!v; hud.retro.set(!!v); }
        loop.requestRender();
      },
      getState() {
        const L = M.L;
        const el = M.ship ? G.elements(M.ship) : null;
        return {
          level: M.i, phase: M.phase, attempts: M.attempts, points: M.points.slice(), fuel: M.fuel, ideal: L.ideal, stars: M.stars, ratio: M.lastRatio,
          h: L.h, r: L.r, vc: L.vc, r1: L.r1, r2: L.r2, H: L.H, viewR: L.viewR,
          windowError: windowError(), el, lastMiss: M.lastMiss, flightEnd: M.flightEnd,
          shipAngle: M.ship ? angDeg(M.ship) : null,
          farOff: el && el.bound && M.i === 1 ? Math.abs(wrapDeg(angDeg(M.ship) - angDeg({ x: -Math.cos(el.w), y: -Math.sin(el.w) }))) : null,
        };
      },
      launch,
      burn,
      next() { if (M.phase === 'won') hud.action.click(); },
      /* Runs the physics now, without frames. */
      advance(seconds) {
        for (let t = 0; t < seconds; t += 1 / 120) step(1 / 120);
      },
      /* Runs physics until fn(state) is true or the time runs out. Returns whether it became true. */
      advanceUntil(fn, seconds) {
        for (let t = 0; t < seconds; t += 1 / 120) {
          step(1 / 120);
          if (fn(api.getState())) return true;
        }
        return false;
      },
    };
    startLevel(0);
    return api;
  };
})();

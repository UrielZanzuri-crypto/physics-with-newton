/* PHY.sims.newtonTrack: the game "מסלול ניוטון". Every run is a real Rider on a real rail.
   Level 1: pick the start height. Clear the hill, cross the rough carpet, and reach the basket slowly enough.
   Level 2: pick the spring compression. Reach the platform and stop on it before the far edge.
   Level 3: drag the track's points. Pass over the rock and reach the finish inside a speed band.
   Each level gives 1-3 points by attempts (1-2, 3-4, 5+), and the three add up to 1-3 stars.
   Numbers are random, and a level is only served if its winning range holds several slider values.
   opts: {chapter, section, onDone(stars, total)}.
   sim.fire() -> Promise of {hit, outcome, ...}, sim.next(), setParam: h, x. sim.setPoint(i, y). getState().level holds the numbers. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05, P2 = PHY.ch02;

  const NAMES = ['שלב 1: גבעה ושטיח', 'שלב 2: קפיץ ובמה', 'שלב 3: מסלול משלנו'];
  const WORLDS = [
    { xMin: -8, xMax: 19.6, yMin: -1.8, yMax: 13.4 },
    { xMin: -5.4, xMax: 12.2, yMin: -1.6, yMax: 10.6 },
    { xMin: -1.2, xMax: 21.8, yMin: -1.8, yMax: 13.4 },
  ];
  const CURVE = 0.14, HMAX = 7.5, CARPET0 = 6;
  const SPRING = { wall: -4.6, rest: -1.6, x0: -3.2, ramp0: 1, ramp1: 6, end: 9, P: 3, mu: 0.4 };
  const VBAND = 0.5;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const snap = (v, step) => Math.round(v / step) * step;
  const round1 = (v) => Math.round(v * 10) / 10;

  function makeLevel(i) {
    for (let tries = 0; tries < 300; tries++) {
      if (i === 0) {
        const mu = pick([0.3, 0.4, 0.5]), L = pick([6, 8, 10]), H = pick([1, 1.5, 2]);
        const low = mu * L;
        if (low < H + 0.3) continue;
        return { kind: 0, mu, L, H, vc: 4, low, high: low + (4 * 4) / 20, mass: 5, end: CARPET0 + L + 1 };
      }
      if (i === 1) {
        const c = pick([{ k: 500, m: 5 }, { k: 800, m: 5 }, { k: 500, m: 2 }, { k: 800, m: 4 }]);
        const H = pick([2, 2.5, 3, 3.5, 4]);
        const low = Math.sqrt((2 * c.m * 10 * H) / c.k);
        const high = Math.sqrt((2 * c.m * (10 * H + SPRING.mu * 10 * SPRING.P)) / c.k);
        if (high > 1.18 || high - low < 0.04) continue;
        return { kind: 1, k: c.k, mass: c.m, H, low, high, mu: SPRING.mu, P: SPRING.P };
      }
      const yf = pick([1, 1.5, 2]), vt = pick([6, 7, 8, 9]);
      const h0 = yf + (vt * vt) / 20;
      const rock = round1(h0 - pick([0.6, 0.8, 1, 1.2]));
      if (rock < 1.2 || h0 > 8) continue;
      return { kind: 2, yf, vt, h0, rock, lo: vt - VBAND, hi: vt + VBAND, mass: 5 };
    }
    throw new Error('newtonTrack: no level');
  }

  PHY.sims.newtonTrack = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: WORLDS[0], aspect: 1.5, minHeight: 255, maxHeight: 470 });
    const G = { i: 0, L: null, attempts: 0, points: [], phase: 'aim', track: null, r: null, h: 3, x: 0.5, pts: [], runT: 0, fly: null, after: 0, outcome: null, resolve: null, caption: '', stars: 0 };
    const hud = P2.gameHud(controlsEl, NAMES);

    hud.h = U.Slider(hud.main, {
      label: 'גובה ההתחלה', min: 0.5, max: HMAX, step: 0.1, value: G.h, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { setH(v); },
    });
    hud.x = U.Slider(hud.main, {
      label: 'כיווץ הקפיץ', min: 0.1, max: 1.2, step: 0.01, value: G.x, unit: 'm', digits: 2, color: 'var(--c-displacement)',
      onInput(v) { setX(v); },
    });
    hud.out = U.Readouts(hud.main, [
      { key: 'att', label: 'ניסיונות' },
      { key: 'a', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'b', label: 'אנרגיה בהתחלה' },
    ]);
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary', text: 'לצאת לדרך' });
    hud.main.insertBefore(hud.task, hud.main.firstChild);
    hud.main.appendChild(hud.feedback);
    hud.main.appendChild(U.h('div', { class: 'sim-row' }, [hud.action]));

    /* ---------- Building each level's rail ---------- */
    function buildL1() {
      const L = G.L;
      const hill = M.fn(function (x) { return (L.H * (1 - Math.cos((2 * Math.PI * (x - 0.5)) / 5))) / 2; }, 0.5, 5.5, 120);
      G.track = M.Track(M.join(
        M.fn(function (x) { return CURVE * x * x; }, -Math.sqrt(HMAX / CURVE), 0, 160),
        M.line(0, 0, 0.5, 0, 8), hill, M.line(5.5, 0, L.end, 0, 120)
      ));
    }
    function buildL2() {
      const L = G.L;
      G.track = M.Track(M.join(
        M.line(SPRING.x0, 0, SPRING.ramp0, 0, 60),
        M.fn(function (x) { return (L.H * (1 - Math.cos((Math.PI * (x - SPRING.ramp0)) / (SPRING.ramp1 - SPRING.ramp0)))) / 2; }, SPRING.ramp0, SPRING.ramp1, 140),
        M.line(SPRING.ramp1, L.H, SPRING.end, L.H, 60)
      ));
    }
    function buildL3() { G.track = M.Track(M.curveThrough(G.pts, 0.03)); }
    function arm() {
      const L = G.L;
      G.fly = null;
      G.runT = 0;
      if (L.kind === 0) {
        G.r = M.Rider(G.track, {
          s: G.track.atX(-Math.sqrt(G.h / CURVE)), v: 0, ends: 'stop', kCap: 0,
          mu: function (s) { const x = G.track.at(s).x; return x >= CARPET0 && x <= CARPET0 + L.L ? L.mu : 0; },
        });
      } else if (L.kind === 1) {
        G.sRest = SPRING.rest - SPRING.x0;
        G.r = M.Rider(G.track, {
          s: G.sRest - G.x, v: 0, ends: 'stop', kCap: 0, spring: { s: G.sRest, kOverM: L.k / L.mass },
          mu: function (s) { return G.track.at(s).x >= SPRING.ramp1 ? L.mu : 0; },
        });
      } else {
        G.r = M.Rider(G.track, { s: 0, v: 0, ends: 'stop' });
      }
    }
    function setH(v) { if (G.phase !== 'aim') return; G.h = round1(Math.max(0.5, Math.min(HMAX, v))); hud.h.set(G.h); arm(); loop.requestRender(); }
    function setX(v) { if (G.phase !== 'aim') return; G.x = Math.round(Math.max(0.1, Math.min(1.2, v)) * 100) / 100; hud.x.set(G.x); arm(); loop.requestRender(); }
    function setPoint(i, y) {
      if (G.phase !== 'aim' || G.i !== 2 || i < 0 || i > 3) return;
      G.pts[i].y = round1(Math.max(0.4, Math.min(8.4, y)));
      buildL3();
      arm();
      loop.requestRender();
    }

    function task() {
      const L = G.L;
      if (L.kind === 0) return 'גבעה בגובה ' + F.unit(L.H, 'm', 1) + ', ואחריה שטיח באורך ' + F.unit(L.L, 'm', 0) + ' עם μ = ' + F.num(L.mu, 2) + '. הסל תופס את ניוטון רק במהירות של עד ' + F.unit(L.vc, 'ms', 0) + '. מאיזה גובה לשלוח אותו?';
      if (L.kind === 1) return 'קפיץ עם k = ' + F.num(L.k, 0) + ' ניוטון/מ\', וחתול של ' + F.unit(L.mass, 'kg', 0) + '. הבמה בגובה ' + F.unit(L.H, 'm', 1) + ', אורכה ' + F.unit(L.P, 'm', 0) + ' ו-μ = ' + F.num(L.mu, 1) + ' עליה. צריך לעצור על הבמה, לא לפניה ולא אחריה.';
      return 'לגרור את הנקודות: המסלול צריך לעבור מעל הסלע בגובה ' + F.unit(L.rock, 'm', 1) + ', ולהגיע לדגל במהירות בין ' + F.num(L.lo, 1) + ' ל-' + F.unit(L.hi, 'ms', 1) + '. הדגל בגובה ' + F.unit(L.yf, 'm', 1) + '.';
    }

    function startLevel(i) {
      G.i = i;
      G.L = makeLevel(i);
      G.attempts = 0;
      G.phase = 'aim';
      G.caption = '';
      G.outcome = null;
      view.setWorld(WORLDS[i]);
      const L = G.L;
      hud.h.el.hidden = i !== 0;
      hud.x.el.hidden = i !== 1;
      if (L.kind === 0) {
        G.h = round1(Math.max(0.5, L.low - 1.2));
        hud.h.set(G.h);
        hud.h.setEnabled(true);
        buildL1();
      } else if (L.kind === 1) {
        G.x = 0.3;
        hud.x.set(G.x);
        hud.x.setEnabled(true);
        buildL2();
      } else {
        G.pts = [{ x: 0, y: round1(Math.max(0.6, L.rock - 0.5)) }, { x: 5, y: 1 }, { x: 10, y: round1(Math.max(0.6, L.rock - 1)) }, { x: 15, y: 0.8 }, { x: 20, y: L.yf }];
        buildL3();
      }
      arm();
      hud.setTask(task());
      hud.main.hidden = false;
      hud.final.hidden = true;
      hud.say('');
      setAction('לצאת לדרך', fire);
      hud.paint(G.i, G.points, false);
      paint();
      loop.requestRender();
    }
    function setAction(text, fn) {
      hud.action.textContent = text;
      hud.action.onclick = fn;
      hud.action.disabled = false;
    }
    function paint() {
      const L = G.L;
      hud.out.set('att', String(G.attempts));
      hud.out.set('b', M.unitJ(energyStart()));
      if (L.kind === 2) hud.out.set('a', F.unit(Math.abs(G.r.v), 'ms', 1));
    }
    function energyStart() {
      const L = G.L;
      if (L.kind === 0) return L.mass * 10 * G.h;
      if (L.kind === 1) return 0.5 * L.k * G.x * G.x;
      return L.mass * 10 * G.pts[0].y;
    }

    /* ---------- Running ---------- */
    function fire() {
      if (G.phase !== 'aim') return Promise.resolve(null);
      arm();
      G.attempts++;
      G.phase = 'run';
      G.caption = '';
      G.outcome = null;
      hud.action.disabled = true;
      hud.h.setEnabled(false);
      hud.x.setEnabled(false);
      hud.say('');
      paint();
      return new Promise(function (resolve) { G.resolve = resolve; });
    }
    function conclude(outcome, data) {
      G.phase = 'after';
      G.after = 0.55;
      G.outcome = Object.assign({ outcome: outcome, hit: outcome === 'hit', attempts: G.attempts }, data);
    }
    function deliver() {
      const res = G.outcome;
      if (res.hit) win(res);
      else miss(res);
      const r = G.resolve;
      G.resolve = null;
      if (r) r(res);
    }
    function miss(res) {
      const L = G.L;
      let t = '';
      if (L.kind === 0) {
        if (res.outcome === 'hill') t = 'הגיע רק לגובה ' + F.unit(G.h, 'm', 1) + ', והגבעה ' + F.unit(L.H, 'm', 1) + '. בלי חיכוך הוא לא יעלה מעל גובה ההתחלה.';
        if (res.outcome === 'short') t = 'נעצר אחרי ' + F.unit(res.d, 'm', 1) + ' על השטיח. השטיח גבה את כל האנרגיה, אז צריך לשלוח אותו מגבוה יותר.';
        if (res.outcome === 'over') t = 'הגיע לסל ב-' + F.unit(res.v, 'ms', 1) + ' ועף מעליו. עודף אנרגיה: צריך גובה קטן יותר.';
      } else if (L.kind === 1) {
        if (res.outcome === 'short') t = 'עלה רק עד ' + F.unit(res.y, 'm', 2) + ' וחזר. הקפיץ לא נתן מספיק: צריך עוד כיווץ.';
        if (res.outcome === 'over') t = 'עבר את הקצה של הבמה ב-' + F.unit(res.v, 'ms', 1) + '. פחות כיווץ, ולזכור: האנרגיה גדלה עם הריבוע שלו.';
      } else {
        if (res.outcome === 'rock') t = 'בום. המסלול עובר דרך הסלע. צריך להרים את הנקודה האמצעית מעל ' + F.unit(L.rock, 'm', 1) + '.';
        if (res.outcome === 'back') t = 'הוא הגיע רק עד גובה ' + F.unit(res.y, 'm', 1) + ' וחזר. אף גבעה לא יכולה להיות גבוהה מנקודת ההתחלה.';
        if (res.outcome === 'slow') t = 'הגיע ב-' + F.unit(res.v, 'ms', 1) + ', לאט מדי. רק ההפרש בין גובה ההתחלה לגובה הדגל קובע: להרים את ההתחלה.';
        if (res.outcome === 'fast') t = 'הגיע ב-' + F.unit(res.v, 'ms', 1) + ', מהר מדי. הצורה בדרך לא משנה: להוריד את ההתחלה.';
      }
      hud.say(t, 'bad');
      G.phase = 'aim';
      hud.action.disabled = false;
      hud.h.setEnabled(true);
      hud.x.setEnabled(true);
      arm();
      if (G.attempts === 3) PHY.mascot.say('אני מתחיל להכיר את הרצפה הזאת אישית.', 'dizzy');
    }
    function win(res) {
      const pts = G.attempts <= 2 ? 3 : G.attempts <= 4 ? 2 : 1;
      G.points[G.i] = pts;
      G.phase = 'won';
      G.caption = 'יש! ' + pts + ' מתוך 3 נקודות';
      const lines = [
        'נכנס לסל ב-' + F.unit(res.v, 'ms', 1) + '. השטיח לקח ' + M.unitJ(G.L.mass * 10 * G.L.mu * G.L.L) + ', והשאר הגיע לסל.',
        'נעצר ' + F.unit(res.d, 'm', 1) + ' מתחילת הבמה. כל הג\'ול של הקפיץ חולק לגובה ולחיכוך.',
        'הגיע ב-' + F.unit(res.v, 'ms', 1) + '. שום גבעה בדרך לא שינתה את זה: רק ההפרש בגבהים.',
      ];
      hud.say(lines[G.i], 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(G.i === 2 ? 'בנינו מסלול, ועברתי אותו, ואני עדיין מתלונן.' : 'נחיתה מדויקת. התפוח שלי מחכה.', 'happy');
      hud.paint(G.i, G.points, false);
      if (G.i < 2) setAction('לשלב הבא', function () { startLevel(G.i + 1); });
      else setAction('לסיכום', finish);
    }
    function finish() {
      const total = G.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G.phase = 'done';
      G.stars = stars;
      hud.paint(G.i, G.points, true);
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון חותם על המסלול, ומבקש שלא יזכירו את הסלע.' : stars === 2 ? 'יפה מאוד. עוד סיבוב, ואפשר לקצר את הדרך לשלושה כוכבים.' : 'כל השלבים הושלמו. בסיבוב הבא אפשר להסתפק בפחות ניסיונות.') }));
      U.Button(hud.final, 'עוד סיבוב, עם מספרים חדשים', restart, { primary: true });
      U.burst(hud.final, 30);
      PHY.mascot.say(stars === 3 ? 'שלושה כוכבים. והכול נשמר, אפילו החום.' : 'סיימנו. רק האנרגיה שלי נשארה, בצורת תלונה.', 'happy');
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() { G.points = []; startLevel(0); }

    function rockY(x) {
      const R = G.L.rock, d = Math.abs(x - 10);
      return d < 1.2 ? R * (1 - d / 1.2) : -1;
    }
    function step(dt) {
      if (G.phase === 'after') {
        G.after -= dt;
        if (G.after <= 0) { G.phase = 'delivering'; deliver(); }
        return;
      }
      if (G.phase !== 'run') return;
      const L = G.L;
      const h = dt * 0.85;
      G.runT += h;
      if (G.fly) {
        const f = G.fly;
        f.t += h;
        f.vy -= 10 * h;
        f.x += f.vx * h;
        f.y += f.vy * h;
        if (f.y <= 0 || f.t > 1.4) {
          f.y = Math.max(0, f.y);
          f.landed = true;
          conclude('over', { v: f.v0 });
        }
        return;
      }
      const r = G.r;
      const before = r.v;
      r.step(h);
      const q = G.track.at(r.s);
      if (L.kind === 0) {
        if (r.v < 0 || G.runT > 12) return conclude('hill', { y: r.e / 10 });
        if (r.end === 'finish') {
          const v = Math.abs(r.v);
          if (v <= L.vc) return conclude('hit', { v });
          G.fly = { x: q.x, y: 0.1, vx: v, vy: 3, t: 0, v0: v };
          return undefined;
        }
        if (r.stopped) return conclude('short', { d: q.x - CARPET0 });
      } else if (L.kind === 1) {
        const leftSpring = r.s > G.sRest;
        if (leftSpring && before > 0 && r.v <= 0 && !r.stopped) return conclude('short', { y: r.e / 10 });
        if (r.end === 'finish') {
          G.fly = { x: q.x, y: q.y, vx: Math.abs(r.v), vy: 0, t: 0, v0: Math.abs(r.v) };
          return undefined;
        }
        if (r.stopped) return conclude('hit', { d: q.x - SPRING.ramp1, v: 0 });
        if (G.runT > 12) return conclude('short', { y: r.e / 10 });
      } else {
        if (q.y < rockY(q.x)) { r.v = 0; return conclude('rock', {}); }
        if (r.v < 0 || r.end === 'start' || G.runT > 14) return conclude('back', { y: r.e / 10 });
        if (r.end === 'finish') {
          const v = Math.abs(r.v);
          if (v < L.lo) return conclude('slow', { v });
          if (v > L.hi) return conclude('fast', { v });
          return conclude('hit', { v });
        }
      }
      return undefined;
    }

    /* ---------- Dragging ---------- */
    view.drag({
      hit(p) {
        if (G.phase !== 'aim') return null;
        const L = G.L;
        if (L.kind === 2) {
          let best = null, bd = 30;
          for (let i = 0; i < 4; i++) {
            const d = view.pxDist(p, G.pts[i]);
            if (d < bd) { bd = d; best = { i }; }
          }
          return best;
        }
        const q = G.track.at(G.r.s);
        return view.pxDist(p, { x: q.x, y: q.y + 16 / view.scale }) < 34 ? { cat: true } : null;
      },
      move(h, p) {
        const L = G.L;
        if (L.kind === 0) setH(p.y);
        else if (L.kind === 1) setX(SPRING.rest - p.x);
        else setPoint(h.i, p.y);
      },
    });

    /* ---------- Drawing ---------- */
    function drawBasket(x, w) {
      const ctx = view.ctx;
      const a = view.sx(x), b = a + w * view.scale, y = view.sy(0);
      ctx.save();
      ctx.fillStyle = 'rgb(197, 130, 63)';
      ctx.strokeStyle = 'rgb(59, 42, 32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a, y - 14);
      ctx.lineTo(b, y - 14);
      ctx.lineTo(b - 3, y);
      ctx.lineTo(a + 3, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const n = Math.max(2, Math.floor((b - a) / 12));
      for (let k = 0; k < n; k++) P2.drawApple(view, a + ((k + 0.5) * (b - a)) / n, y - 16 - (k % 2) * 3, 5.5);
    }
    function render() {
      const L = G.L;
      const small = view.w < 460;
      const r = view.visible;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, r.xMax, 0, {});
      const px = small ? 34 : 46;
      const rider = G.r;
      const q = G.track.at(rider.s);
      if (L.kind === 0) {
        view.poly(G.track.points, { color: C.axis, width: 4 });
        M.roughPatch(view, CARPET0, CARPET0 + L.L, 0, { heat: rider.heat > 0 ? Math.min(1, (L.mass * rider.heat) / (L.mass * 10 * L.mu * L.L)) : 0 });
        view.text(CARPET0 + L.L * 0.28, 0, 'μ = ' + F.num(L.mu, 2), { size: 11.5, weight: 700, color: C.ink, halo: true, offset: [0, 18] });
        view.text(CARPET0 + L.L * 0.72, 0, F.unit(L.L, 'm', 0), { size: 11.5, weight: 700, color: C.displacement, halo: true, offset: [0, 18] });
        view.text(3, L.H, F.unit(L.H, 'm', 1), { size: 11.5, weight: 700, color: C.displacement, halo: true, offset: [0, -11] });
        drawBasket(L.end - 0.1, 2);
        view.line(r.xMin, G.h, r.xMax, G.h, { color: C.gold, width: 1.6, dash: [6, 5] });
        view.text(r.xMax, G.h, 'גובה ההתחלה ' + F.unit(G.h, 'm', 1), { size: 12, weight: 800, color: C.ink, halo: true, align: 'right', offset: [-8, -11] });
      } else if (L.kind === 1) {
        view.poly(G.track.points, { color: C.axis, width: 4 });
        view.poly(M.join(G.track.points.slice(60), [{ x: SPRING.end, y: 0 }, { x: SPRING.ramp0, y: 0 }]), { fill: C.gridStrong, alpha: 0.35, close: true });
        view.line(SPRING.end, L.H, SPRING.end, 0, { color: C.axis, width: 3 });
        M.roughPatch(view, SPRING.ramp1, SPRING.end, L.H, { heat: rider.heat > 0 ? 0.7 : 0 });
        view.text(SPRING.end, L.H / 2, F.unit(L.H, 'm', 1), { size: 12, weight: 700, color: C.displacement, halo: true, offset: [-22, 0] });
        view.text((SPRING.ramp1 + SPRING.end) / 2, L.H, 'כאן לעצור', { size: 12, weight: 800, color: C.good, halo: true, offset: [0, -34] });
        const hw = (px * 0.42) / view.scale;
        const plateX = Math.min(SPRING.rest, q.x) - hw;
        view.line(SPRING.wall, 0, SPRING.wall, 2.2, { color: C.axis, width: 6, cap: 'butt' });
        M.drawSpring(view, SPRING.wall, 0.7, plateX, 0.7, { color: C.soft, width: 11, coils: 6, lineWidth: 3 });
        view.line(plateX, 0.1, plateX, 1.3, { color: C.axis, width: 4 });
      } else {
        view.poly([{ x: 8.8, y: 0 }, { x: 10, y: L.rock }, { x: 11.2, y: 0 }], { fill: C.soft, color: C.axis, width: 2, close: true });
        view.text(10, 0, 'סלע ' + F.unit(L.rock, 'm', 1), { size: 11.5, weight: 800, color: C.ink, halo: true, offset: [0, 13] });
        view.line(20, L.yf, 20, L.yf + 2.4, { color: C.axis, width: 3 });
        view.poly([{ x: 20, y: L.yf + 2.4 }, { x: 21.3, y: L.yf + 2 }, { x: 20, y: L.yf + 1.6 }], { fill: C.good, close: true });
        view.text(19.9, L.yf + 2, F.num(L.lo, 1) + '-' + F.unit(L.hi, 'ms', 1), { size: 11.5, weight: 800, color: C.velocity, halo: true, align: 'right', offset: [-4, 0] });
        view.poly(G.track.points, { color: C.axis, width: 4.5 });
        view.line(r.xMin, G.pts[0].y, r.xMax, G.pts[0].y, { color: C.gold, width: 1.8, dash: [7, 5] });
        for (let i = 0; i < 4; i++) {
          view.circle(G.pts[i].x, G.pts[i].y, 9, { px: true, fill: C.surface, color: C.accent, width: 3 });
          view.text(G.pts[i].x, G.pts[i].y, F.unit(G.pts[i].y, 'm', 1), { size: 11, weight: 700, color: C.ink, halo: true, offset: [i === 0 ? 8 : 0, i === 0 ? 18 : -17] });
        }
      }
      /* the cat */
      if (G.fly) {
        PHY.mascot.draw(view, Math.min(G.fly.x, r.xMax - 0.6), G.fly.y + (G.fly.landed ? 0 : 0.5), { pose: G.fly.landed ? 'dizzy' : 'flying', px });
      } else {
        const out = G.outcome;
        const pose = G.phase === 'aim' ? 'standing' : out ? (out.hit ? 'happy' : 'dizzy') : 'sliding';
        M.rideCat(view, q, { px, pose, flip: rider.v < 0 });
        if (Math.abs(rider.v) > 0.4) {
          const k = 3.6 / view.scale;
          view.arrow(q.x, q.y, q.x + q.ux * rider.v * k, q.y + q.uy * rider.v * k, { color: C.velocity, width: 3 });
        }
        if (G.phase === 'aim' && L.kind !== 2) view.circle(q.x, q.y + 16 / view.scale, 24, { px: true, color: C.accent, width: 2, dash: [4, 4], alpha: 0.7 });
      }
      /* energy */
      const E = Math.max(energyStart(), 1);
      const m = L.mass;
      const pe = G.fly ? m * 10 * G.fly.y : m * 10 * q.y;
      const d = L.kind === 1 ? Math.max(0, G.sRest - rider.s) : 0;
      const es = L.kind === 1 ? 0.5 * L.k * d * d : 0;
      const heat = m * rider.heat;
      const ke = Math.max(0, E - pe - es - heat);
      const items = [{ label: 'קינטית', value: ke, color: C.accent }, { label: 'גובה', value: pe, color: C.gold }];
      if (L.kind === 1) items.unshift({ label: 'קפיץ', value: es, color: C.soft });
      if (L.kind !== 2) items.push({ label: 'חום', value: heat, color: C.apple });
      M.energyPanel(view, { x: 6, y: 5, w: view.w - 12, max: E, items: items });
      if (G.caption) view.screenText(view.w / 2, 78, G.caption, { size: small ? 13 : 14, weight: 700, pill: true });
      hud.out.set('a', F.unit(Math.abs(G.fly ? G.fly.v0 : rider.v), 'ms', 1));
      hud.out.set('b', M.unitJ(energyStart()));
    }
    const loop = PHY.SimLoop({ view, step, render });

    startLevel(0);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      fire, setPoint,
      /* Same as clicking the action button after a win. */
      next() { if (G.phase === 'won') hud.action.click(); },
      setParam(name, v) {
        if (name === 'h') setH(v);
        if (name === 'x') setX(v);
      },
      getState() {
        return { i: G.i, level: Object.assign({}, G.L), phase: G.phase, attempts: G.attempts, points: G.points.slice(), stars: G.stars, outcome: G.outcome, h: G.h, x: G.x, pts: G.pts.map(function (p) { return { x: p.x, y: p.y }; }) };
      },
      /* Builds n levels of every kind and reports the smallest number of winning slider values. */
      auditLevels(n) {
        return [0, 1, 2].map(function (i) {
          let min = Infinity;
          for (let k = 0; k < n; k++) {
            const L = makeLevel(i);
            let count = 0;
            if (i === 0) for (let h = 0.5; h <= HMAX + 1e-9; h += 0.1) { if (h >= L.low + 0.01 && h <= L.high - 0.01 && h > L.H) count++; }
            if (i === 1) for (let x = 0.1; x <= 1.2 + 1e-9; x += 0.01) { if (x >= L.low + 0.002 && x <= L.high - 0.002) count++; }
            if (i === 2) {
              const low = L.yf + (L.lo * L.lo) / 20, high = L.yf + (L.hi * L.hi) / 20;
              for (let y = 0.4; y <= 8.4 + 1e-9; y += 0.1) { if (y >= low + 0.01 && y <= high - 0.01 && y > L.rock) count++; }
            }
            min = Math.min(min, count);
          }
          return { level: i + 1, minValues: min };
        });
      },
    };
  };
})();

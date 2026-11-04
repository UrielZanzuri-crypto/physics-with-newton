/* PHY.sims.slingGame: "הקלע של ניוטון". An apple whirls overhead, a tap releases it, and it flies along the tangent.
   Level 1: a near basket. Level 2: a wall with one gap, so only some release points work.
   Level 3: a table with friction: set the speed too, and the apple must slide and stop inside the ring (d = v²/2a).
   Each level gives 3, 2 or 1 points by attempts (1-2, 3-4, 5+), which add up to 1-3 stars.
   Every outcome comes from one stepper, so solutions() tries the real flight for every release angle,
   and a level is served only if it can be won.
   opts: {chapter, section, onDone(stars, total)}. sim.release() -> Promise({hit, ...}), sim.next(), sim.advance(s).
   setParam: v (level 3), phi (degrees, for the checks). getState(), solutions(), idealDeg(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch06;
  const RAD = Math.PI / 180;
  const R = 1.4;
  const WORLD = { xMin: -6.6, xMax: 6.6, yMin: -4.3, yMax: 4.3 };
  const NAMES = ['שלב 1: סל קרוב', 'שלב 2: חומה עם פתח', 'שלב 3: להחליק ולעצור'];
  const A_FRICTION = 1; /* μ = 0.1, so friction takes 1 m/s every second */
  const DT = 1 / 120;

  const rand = (a, b) => a + Math.random() * (b - a);
  const wrap = (d) => { let x = d % 360; if (x > 180) x -= 360; if (x < -180) x += 360; return x; };

  function inBounds(p, m) { return Math.abs(p.x) <= WORLD.xMax - (m || 0) && Math.abs(p.y) <= WORLD.yMax - (m || 0); }

  function newFlight(phi, v) {
    const x = R * Math.cos(phi), y = R * Math.sin(phi);
    return { x0: x, y0: y, x, y, vx: -v * Math.sin(phi), vy: v * Math.cos(phi), v0: v, t: 0, done: false, hit: false, wall: false, stopped: false, out: false, phi };
  }
  function crossing(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null;
  }
  /* The only place a flight moves. Used by the game and by solutions(), so they can never disagree. */
  function advance(f, L, dt) {
    const prev = { x: f.x, y: f.y };
    if (L.kind === 'stop') {
      const sp = Math.hypot(f.vx, f.vy);
      const ns = Math.max(0, sp - A_FRICTION * dt);
      if (ns <= 0) {
        f.vx = 0; f.vy = 0;
        f.done = true;
        f.stopped = true;
        f.hit = Math.hypot(f.x - L.t.x, f.y - L.t.y) <= L.t.r;
        return;
      }
      f.vx *= ns / sp;
      f.vy *= ns / sp;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.t += dt;
    for (let i = 0; i < L.walls.length; i++) {
      const w = L.walls[i];
      const q = crossing(prev, f, w.a, w.b);
      if (q) { f.x = q.x; f.y = q.y; f.done = true; f.wall = true; return; }
    }
    if (L.kind !== 'stop' && Math.hypot(f.x - L.t.x, f.y - L.t.y) <= L.t.r) { f.done = true; f.hit = true; return; }
    if (!inBounds(f, -0.4)) { f.done = true; f.out = true; }
  }
  function outcome(L, phi, v) {
    const f = newFlight(phi, v);
    while (!f.done) advance(f, L, DT);
    return f;
  }
  function solutionsOf(L, v, stepDeg) {
    const list = [];
    const s = stepDeg || 1;
    for (let d = 0; d < 360; d += s) if (outcome(L, d * RAD, v).hit) list.push(d);
    return list;
  }
  /* The middle of the longest run of good release angles, on a circle. */
  function middle(sols) {
    if (!sols.length) return null;
    const set = new Set(sols);
    let best = sols[0], bestLen = 0;
    sols.forEach(function (d) {
      if (set.has((d + 359) % 360)) return;
      let n = 1;
      while (set.has((d + n) % 360) && n < 360) n++;
      if (n > bestLen) { bestLen = n; best = (d + (n - 1) / 2) % 360; }
    });
    return best;
  }
  function tangentLength(t) { return Math.sqrt(Math.max(0, t.x * t.x + t.y * t.y - R * R)); }

  function makeLevel(i) {
    for (let tries = 0; tries < 400; tries++) {
      let L;
      if (i === 0) {
        const b = rand(0, 360) * RAD, D = rand(3.8, 5.5);
        L = { kind: 'hit', period: 2.6, t: { x: D * Math.cos(b), y: D * Math.sin(b), r: 0.85 }, walls: [] };
      } else if (i === 1) {
        const side = Math.random() < 0.5 ? 0 : 180;
        const b = (side + rand(-22, 22)) * RAD;
        const n = { x: Math.cos(b), y: Math.sin(b) }, a = { x: -Math.sin(b), y: Math.cos(b) };
        const dw = rand(2.7, 3.1), half = 4, q = rand(-1.5, 1.5), g = 0.5;
        const at = (s) => ({ x: n.x * dw + a.x * s, y: n.y * dw + a.y * s });
        const walls = [{ a: at(-half), b: at(q - g) }, { a: at(q + g), b: at(half) }];
        const D = dw + rand(2, 2.6);
        L = { kind: 'gate', period: 2.3, gap: at(q), walls: walls, t: { x: n.x * D + a.x * q * 1.1, y: n.y * D + a.y * q * 1.1, r: 1 } };
      } else {
        const b = rand(0, 360) * RAD, D = rand(3.9, 5.6);
        L = { kind: 'stop', t: { x: D * Math.cos(b), y: D * Math.sin(b), r: 0.8 }, walls: [] };
      }
      if (!inBounds(L.t, L.t.r + 0.1)) continue;
      const v = L.kind === 'stop' ? Math.round(Math.sqrt(2 * A_FRICTION * tangentLength(L.t)) * 10) / 10 : (2 * Math.PI * R) / L.period;
      const sols = solutionsOf(L, v, 2);
      /* at least 12 degrees of good release angles, so that a tap can find them */
      if (sols.length >= 6) { L.fair = v; return L; }
    }
    throw new Error('slingGame: no winnable level');
  }

  PHY.sims.slingGame = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: WORLD, aspect: 1.55, minHeight: 280, maxHeight: 500 });
    const G = {
      i: 0, level: null, attempts: 0, points: [], phase: 'whirl', phi: 0.5, flight: null, traces: [], pose: 'standing', caption: '', resolve: null, v: 3, lastDelta: null, stars: 0, hint: null, lastResult: null,
    };
    const hud = {};

    function speed() { return G.level.kind === 'stop' ? G.v : (2 * Math.PI * R) / G.level.period; }
    function period() { return (2 * Math.PI * R) / speed(); }
    function feedback(t, kind) { hud.feedback.textContent = t; hud.feedback.className = 'game-feedback ' + (kind || ''); }
    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === G.i && G.phase !== 'done' ? ' is-now' : '') + (G.points[j] ? ' is-done' : '');
        p.textContent = NAMES[j] + (G.points[j] ? ' (' + G.points[j] + ')' : '');
      });
    }
    function idealDeg() {
      const L = G.level;
      if (L.kind === 'gate') return middle(solutionsOf(L, speed(), 1));
      const D = Math.hypot(L.t.x, L.t.y);
      return (((Math.atan2(L.t.y, L.t.x) - Math.acos(R / D)) / RAD) % 360 + 360) % 360;
    }
    function taskText() {
      const L = G.level;
      if (L.kind === 'hit') return 'התפוח מסתובב. הקשה על המסך משחררת אותו. המטרה: הסל במרחק ' + F.unit(Math.hypot(L.t.x, L.t.y), 'm', 1) + '.';
      if (L.kind === 'gate') return 'עכשיו יש חומה, ורק פתח אחד. רק חלק קטן מנקודות השחרור עובר דרכו ומגיע לסל.';
      return 'שולחן עם חיכוך: התפוח מאבד ' + F.unit(1, 'ms') + ' בכל שנייה. בוחרים מהירות, משחררים, והוא צריך לעצור בתוך הטבעת, במרחק ' + F.unit(tangentLength(L.t), 'm', 1) + ' מנקודת השחרור.';
    }
    function setAction(text, fn) { hud.action.textContent = text; hud.action.onclick = fn; hud.action.disabled = false; }

    function startLevel(i) {
      G.i = i;
      G.level = makeLevel(i);
      G.attempts = 0;
      G.traces = [];
      G.phase = 'whirl';
      G.flight = null;
      G.caption = '';
      G.pose = 'standing';
      G.hint = null;
      G.v = 2.5;
      hud.speed.set(G.v);
      hud.speed.el.hidden = G.level.kind !== 'stop';
      hud.task.textContent = taskText();
      hud.main.hidden = false;
      hud.final.hidden = true;
      feedback('');
      setAction('לשחרר!', function () { release(); });
      paintPips();
      paintStats();
      loop.requestRender();
    }
    function paintStats() {
      hud.out.set('att', String(G.attempts));
      hud.out.set('v', F.unit(speed(), 'ms', 1));
      hud.out.set('T', F.unit(period(), 's', 2));
    }

    function release() {
      if (G.phase !== 'whirl') return Promise.resolve(null);
      G.attempts++;
      G.phase = 'flying';
      G.flight = newFlight(G.phi, speed());
      G.caption = '';
      hud.action.disabled = true;
      hud.speed.setEnabled(false);
      feedback('');
      paintStats();
      return new Promise(function (resolve) { G.resolve = resolve; });
    }

    function land() {
      const f = G.flight;
      G.traces.push(f);
      if (G.traces.length > 4) G.traces.shift();
      G.flight = null;
      G.lastResult = { hit: f.hit, wall: f.wall, stopped: f.stopped, out: f.out, x: f.x, y: f.y, attempts: G.attempts, deg: f.phi / RAD };
      if (f.hit) win();
      else miss(f);
      const r = G.resolve;
      G.resolve = null;
      if (r) r(G.lastResult);
    }

    function miss(f) {
      const L = G.level;
      const ideal = idealDeg();
      const delta = ideal === null ? 0 : wrap(f.phi / RAD - ideal);
      G.lastDelta = delta;
      const when = delta < 0 ? 'מוקדם' : 'מאוחר';
      const size = K.deg(Math.abs(delta));
      let text;
      if (L.kind === 'stop') {
        const d = (f.v0 * f.v0) / (2 * A_FRICTION);
        const need = tangentLength(L.t);
        const off = d - need;
        if (Math.abs(delta) > 9) text = 'השחרור היה ' + when + ' ב-' + size + '. התפוח עף לפי המקום שבו שוחרר.';
        else if (Math.abs(off) > L.t.r) text = (off < 0 ? 'עצר ' + F.unit(Math.abs(off), 'm', 1) + ' לפני מרכז הטבעת' : 'החליק ' + F.unit(Math.abs(off), 'm', 1) + ' מעבר למרכז הטבעת') + '. המרחק הוא v²/2a, אז ' + (off < 0 ? 'צריך קצת יותר מהירות.' : 'צריך קצת פחות מהירות.');
        else text = 'כמעט! המרחק טוב, והכיוון עוד צריך תיקון קטן: ' + when + ' ב-' + size + '.';
      } else if (f.wall) {
        text = 'בום בחומה. השחרור היה ' + when + ' ב-' + size + ' מהנקודה שעוברת דרך הפתח.';
      } else {
        text = when + ' ב-' + size + '. התפוח לא עף לכיוון שאליו החוט מצביע, אלא לאורך המשיק.';
      }
      if (G.attempts >= 2) {
        G.hint = ideal;
        text += ' העיגול הזהוב מסמן נקודת שחרור טובה.';
      }
      feedback(text, 'bad');
      G.pose = G.attempts >= 3 ? 'dizzy' : 'thinking';
      if (G.attempts === 4) PHY.mascot.say('זה בסדר. גם ככה לא רציתי את התפוח הזה. שקר. רציתי.', 'dizzy');
      G.phase = 'whirl';
      hud.speed.setEnabled(true);
      hud.action.disabled = false;
    }

    function win() {
      const pts = G.attempts <= 2 ? 3 : G.attempts <= 4 ? 2 : 1;
      G.points[G.i] = pts;
      G.phase = 'won';
      G.pose = 'happy';
      G.caption = 'פגיעה! ' + pts + ' מתוך 3 נקודות';
      feedback('בפנים, ' + (G.attempts === 1 ? 'בניסיון הראשון' : 'ב-' + G.attempts + ' ניסיונות') + '. המשיק עבד בדיוק כמו בפתיח.', 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(G.i === 2 ? 'שולחן, חיכוך, ותפוח שעצר איפה שצריך. אני מתרגש.' : 'משיק! ידעתי שהחוט הזה טוב למשהו.', 'happy');
      paintPips();
      if (G.i < 2) setAction('לשלב הבא', function () { startLevel(G.i + 1); });
      else setAction('לסיכום', finish);
    }

    function finish() {
      const total = G.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G.phase = 'done';
      G.stars = stars;
      paintPips();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון מכריז על תואר קלע ראשי, ומבקש את התפוח בחזרה.' : stars === 2 ? 'יפה מאוד. עוד סיבוב, ויש שלושה כוכבים.' : 'כל המטרות נפלו. בסיבוב הבא יספיקו פחות ניסיונות.') }));
      U.Button(hud.final, 'לשחק שוב, במטרות חדשות', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() { G.points = []; startLevel(0); }

    function step(dt) {
      if (G.phase === 'whirl' || G.phase === 'won' || G.phase === 'done') G.phi += (speed() / R) * dt;
      else if (G.flight) {
        advance(G.flight, G.level, dt);
        if (G.flight.done) land();
      }
    }

    function drawTrace(f, last) {
      view.line(f.x0, f.y0, f.x, f.y, { color: f.hit ? C.good : C.soft, width: last ? 2.2 : 1.6, dash: f.hit ? null : [4, 5], alpha: last ? 0.9 : 0.45 });
      view.circle(f.x0, f.y0, 3.5, { px: true, fill: C.displacement, alpha: last ? 1 : 0.5 });
      if (!f.hit) K.apple(view, f.x, f.y, 12, { alpha: last ? 0.6 : 0.3, plain: true });
    }

    function render() {
      const L = G.level;
      const small = view.w < 420;
      view.clear();
      view.grid(1);
      /* the target */
      if (L.kind === 'stop') {
        [1, 0.62, 0.28].forEach(function (k, i) { view.circle(L.t.x, L.t.y, L.t.r * k, { fill: i === 1 ? C.bg : C.accent, alpha: i === 1 ? 1 : 0.28, color: C.accent, width: 2 }); });
      } else {
        view.circle(L.t.x, L.t.y, L.t.r, { fill: C.gold, alpha: 0.28 });
        view.circle(L.t.x, L.t.y, L.t.r, { color: C.gold, width: 3 });
        [[-0.3, -0.15], [0.3, -0.15], [0, 0.25]].forEach(function (o) { K.apple(view, L.t.x + o[0] * L.t.r, L.t.y + o[1] * L.t.r, small ? 11 : 14, { plain: true }); });
      }
      /* walls */
      L.walls.forEach(function (w) {
        view.line(w.a.x, w.a.y, w.b.x, w.b.y, { color: C.axis, width: small ? 7 : 9, cap: 'butt' });
      });
      G.traces.forEach(function (f, i) { drawTrace(f, i === G.traces.length - 1); });

      view.circle(0, 0, R, { color: C.gridStrong, width: 2, dash: [5, 6] });
      if (G.hint !== null) {
        const a = G.hint * RAD;
        view.circle(R * Math.cos(a), R * Math.sin(a), small ? 8 : 10, { px: true, color: C.gold, width: 3 });
      }
      const px = small ? 40 : 52;
      const f = G.flight;
      if (f) {
        view.line(f.x0, f.y0, f.x, f.y, { color: C.displacement, width: 2.6 });
        view.circle(f.x0, f.y0, 3.5, { px: true, fill: C.displacement });
        view.line(0, 0, f.x0 * 0.45, f.y0 * 0.45, { color: C.ink, width: 2 });
        PHY.mascot.draw(view, 0, 0, { pose: G.pose, px: px, anchor: [0.5, 0.62] });
        K.apple(view, f.x, f.y, small ? 16 : 19);
        view.arrow(f.x, f.y, f.x + f.vx * 0.3, f.y + f.vy * 0.3, { color: C.velocity, width: 3 });
      } else {
        const x = R * Math.cos(G.phi), y = R * Math.sin(G.phi);
        if (G.phase === 'whirl') view.line(0, 0, x, y, { color: C.ink, width: 2 });
        PHY.mascot.draw(view, 0, 0, { pose: G.pose, px: px, anchor: [0.5, 0.62] });
        if (G.phase === 'whirl') {
          const sp = speed();
          K.apple(view, x, y, small ? 16 : 19);
          view.arrow(x, y, x - Math.sin(G.phi) * sp * 0.34, y + Math.cos(G.phi) * sp * 0.34, { color: C.velocity, width: 3 });
        }
      }
      if (G.caption) view.screenText(view.w / 2, 20, G.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    hud.levels = U.h('div', { class: 'game-levels' });
    hud.pips = NAMES.map(function (n) { const p = U.h('span', { class: 'game-pip', text: n }); hud.levels.appendChild(p); return p; });
    hud.main = U.h('div', { class: 'game-hud' });
    hud.final = U.h('div', { class: 'game-final', hidden: true });
    hud.task = U.h('div', { class: 'game-task' });
    hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary', text: 'לשחרר!' });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]));
    hud.main.appendChild(hud.task);
    hud.speed = U.Slider(hud.main, {
      label: 'מהירות התפוח', min: 1.5, max: 5, step: 0.1, value: 2.5, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { G.v = v; paintStats(); },
    });
    hud.out = U.Readouts(hud.main, [
      { key: 'att', label: 'ניסיונות' },
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'T', label: 'זמן לסיבוב' },
    ]);
    hud.main.appendChild(hud.feedback);
    hud.main.appendChild(U.h('div', { class: 'sim-row' }, [hud.action]));

    view.onTap(function () { if (G.phase === 'whirl') release(); });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam(name, v) {
        if (name === 'v' && G.level.kind === 'stop') { G.v = v; hud.speed.set(v); paintStats(); }
        if (name === 'phi') G.phi = v * RAD;
      },
      getState() {
        const L = G.level;
        return {
          level: G.i, phase: G.phase, attempts: G.attempts, points: G.points.slice(), kind: L.kind, target: L.t, walls: L.walls, phi: ((G.phi / RAD) % 360 + 360) % 360,
          v: speed(), T: period(), fairSpeed: L.fair, stars: G.stars, lastDelta: G.lastDelta, last: G.lastResult, tangentLength: tangentLength(L.t), R: R, aFriction: A_FRICTION,
        };
      },
      solutions() { return solutionsOf(G.level, speed(), 1); },
      idealDeg,
      release,
      next() { if (G.phase === 'won') hud.action.click(); },
      advance(seconds) {
        const n = Math.round(seconds * 120);
        for (let i = 0; i < n; i++) step(DT);
      },
      /* Builds n levels of every kind and reports the fewest good release angles found. */
      auditLevels(n) {
        return [0, 1, 2].map(function (i) {
          let min = Infinity, bad = 0;
          for (let k = 0; k < n; k++) {
            const L = makeLevel(i);
            const count = solutionsOf(L, L.fair, 2).length * 2;
            if (!count) bad++;
            min = Math.min(min, count);
          }
          return { level: i + 1, minDegrees: min, unwinnable: bad };
        });
      },
    };
    startLevel(0);
    return api;
  };
})();

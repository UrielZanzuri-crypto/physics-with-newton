/* PHY.sims.angryNewton: "ניוטון הכועס". Fire the cat into a basket of apples.
   Level 1: free angle and speed. Level 2: fixed speed, angle only. Level 3: from a cliff to a target below.
   Each level gives 1-3 points by attempts (1-2, 3-4, 5+), the three add up to 1-3 stars.
   Targets are built from a real solution on the slider grid, then every allowed slider setting is
   tried, so a level is only served if it can be won. solutions() returns that list.
   opts: {chapter, section, onDone(stars, total)}. sim.fire() -> Promise, sim.next(), setParam: angle, speed. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;

  const NAMES = ['שלב 1: הכל פתוח', 'שלב 2: רק זווית', 'שלב 3: מהצוק'];
  const WORLDS = [
    { xMin: -5, xMax: 66, yMin: -4, yMax: 33 },
    { xMin: -5, xMax: 66, yMin: -4, yMax: 33 },
    { xMin: -11, xMax: 66, yMin: -4, yMax: 40 },
  ];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (list) => list[randInt(0, list.length - 1)];

  function grid(level) {
    return {
      angles: { min: level.minAngle, max: 80 },
      speeds: level.lockSpeed ? { min: level.lockSpeed, max: level.lockSpeed } : { min: 5, max: 25 },
    };
  }
  function isHit(level, v, a) {
    return Math.abs(B.range(v, a, level.h0) - level.c) <= level.half;
  }
  function solutionsOf(level) {
    const g = grid(level);
    const list = [];
    for (let v = g.speeds.min; v <= g.speeds.max; v++) {
      for (let a = g.angles.min; a <= g.angles.max; a++) {
        if (isHit(level, v, a)) list.push({ v: v, a: a });
      }
    }
    return list;
  }

  function makeLevel(i) {
    for (let tries = 0; tries < 200; tries++) {
      let L;
      if (i === 0) {
        const v = randInt(14, 23), a = randInt(25, 65);
        L = { h0: 0, minAngle: 10, lockSpeed: 0, half: 3, c: Math.round(B.range(v, a)), witness: { v, a } };
      } else if (i === 1) {
        const v = pick([18, 20, 22, 24]);
        const a = pick([randInt(20, 37), randInt(53, 70)]);
        L = { h0: 0, minAngle: 10, lockSpeed: v, half: 1.8, c: Math.round(B.range(v, a)), witness: { v, a } };
      } else {
        const h0 = pick([15, 20, 25]);
        const v = randInt(12, 21), a = randInt(5, 45);
        L = { h0: h0, minAngle: 0, lockSpeed: 0, half: 2.2, c: Math.round(B.range(v, a, h0)), witness: { v, a } };
      }
      const okRange = L.c >= 15 && L.c <= 58;
      if (okRange && isHit(L, L.witness.v, L.witness.a) && solutionsOf(L).length >= (i === 1 ? 2 : 8)) return L;
    }
    throw new Error('angryNewton: no winnable level');
  }

  PHY.sims.angryNewton = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { world: WORLDS[0], aspect: 1.75, minHeight: 240, maxHeight: 480 });
    const G = { i: 0, level: null, attempts: 0, points: [], phase: 'aim', flight: null, traces: [], a: 40, v: 15, cat: null, pose: 'standing', resolve: null, caption: '' };
    const hud = {};

    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === G.i && G.phase !== 'done' ? ' is-now' : '') + (G.points[j] ? ' is-done' : '');
        p.textContent = NAMES[j] + (G.points[j] ? ' (' + G.points[j] + ')' : '');
      });
    }
    function feedback(text, kind) {
      hud.feedback.textContent = text;
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function taskText() {
      const L = G.level;
      if (G.i === 0) return 'סל התפוחים במרחק ' + F.unit(L.c, 'm', 0) + '. בחר זווית ומהירות, ושגר את ניוטון לתוכו.';
      if (G.i === 1) return 'המהירות נעולה על ' + F.unit(L.lockSpeed, 'ms', 0) + '. הסל במרחק ' + F.unit(L.c, 'm', 0) + '. רק הזווית בידיים שלך.';
      return 'ניוטון על צוק בגובה ' + F.unit(L.h0, 'm', 0) + '. הסל למטה, ' + F.unit(L.c, 'm', 0) + ' מבסיס הצוק. אל תיתן לאינטואיציה מהשלבים הקודמים לבלבל אותך.';
    }

    function startLevel(i) {
      G.i = i;
      G.level = makeLevel(i);
      G.attempts = 0;
      G.traces = [];
      G.phase = 'aim';
      G.flight = null;
      G.cat = null;
      G.caption = '';
      view.setWorld(WORLDS[i]);
      const L = G.level;
      hud.ang.setRange(L.minAngle, 80);
      G.a = Math.max(L.minAngle, 40);
      hud.ang.set(G.a);
      if (L.lockSpeed) { G.v = L.lockSpeed; hud.speed.set(G.v); hud.speed.setEnabled(false); }
      else { G.v = 15; hud.speed.set(15); hud.speed.setEnabled(true); }
      hud.ang.setEnabled(true);
      hud.task.textContent = taskText();
      hud.main.hidden = false;
      hud.final.hidden = true;
      feedback('');
      setAction('אש!', fire);
      paintPips();
      paintStats();
      loop.requestRender();
    }

    function setAction(text, fn) {
      hud.action.textContent = text;
      hud.action.onclick = fn;
      hud.action.disabled = false;
    }
    function paintStats() {
      hud.out.set('att', String(G.attempts));
      hud.out.set('target', F.unit(G.level.c, 'm', 0));
      hud.out.set('last', G.lastR === null || G.lastR === undefined ? '—' : F.unit(G.lastR, 'm', 1));
    }

    function fire() {
      if (G.phase !== 'aim') return Promise.resolve(null);
      const L = G.level;
      G.attempts++;
      G.phase = 'flying';
      G.lastR = null;
      G.caption = '';
      hud.action.disabled = true;
      hud.ang.setEnabled(false);
      hud.speed.setEnabled(false);
      feedback('');
      G.flight = { v: G.v, a: G.a, h0: L.h0, t: 0, T: B.flightTime(G.v, G.a, L.h0) };
      G.cat = null;
      paintStats();
      return new Promise(function (resolve) { G.resolve = resolve; });
    }

    function land() {
      const f = G.flight;
      const L = G.level;
      const R = B.range(f.v, f.a, f.h0);
      const hit = Math.abs(R - L.c) <= L.half;
      G.traces.push({ v: f.v, a: f.a, h0: f.h0, R: R, hit: hit });
      G.flight = null;
      G.lastR = R;
      G.cat = { x: R, pose: hit ? 'happy' : G.attempts >= 3 ? 'dizzy' : 'standing' };
      paintStats();
      const result = { hit: hit, R: R, attempts: G.attempts };
      if (hit) win(f);
      else miss(R);
      const r = G.resolve;
      G.resolve = null;
      if (r) r(result);
    }

    function miss(R) {
      const L = G.level;
      const diff = R - L.c;
      const word = diff < 0 ? 'קצר ב-' : 'ארוך ב-';
      let tip = '';
      if (G.attempts >= 3) {
        if (G.i === 0) tip = diff < 0 ? ' הוסף מהירות, או התקרב ל-45°.' : ' הורד מהירות, או התרחק מ-45°.';
        else if (G.i === 1) tip = G.a < 45
          ? (diff < 0 ? ' מתחת ל-45°, הרמת הזווית מאריכה את הטווח.' : ' מתחת ל-45°, הורדת הזווית מקצרת את הטווח.')
          : (diff < 0 ? ' מעל 45°, הורדת הזווית מאריכה את הטווח.' : ' מעל 45°, הרמת הזווית מקצרת את הטווח.');
        else tip = ' מצוק, הנפילה הנוספת נותנת עוד זמן באוויר, אז גם זווית שטוחה יכולה להגיע רחוק.';
      }
      feedback(word + F.unit(Math.abs(diff), 'm', 1) + '. ניוטון נחת על הרגליים, וזה מה שטוב בזה.' + tip, 'bad');
      G.phase = 'aim';
      hud.ang.setEnabled(true);
      hud.speed.setEnabled(!L.lockSpeed);
      hud.action.disabled = false;
      if (G.attempts === 4) PHY.mascot.say('אני מתחיל לזהות את הרצפה הזאת באופן אישי.', 'dizzy');
    }

    function win(f) {
      const pts = G.attempts <= 2 ? 3 : G.attempts <= 4 ? 2 : 1;
      G.points[G.i] = pts;
      G.phase = 'won';
      G.caption = 'נכנס! ' + pts + ' מתוך 3 נקודות';
      const extra = G.i === 1 && isHit(G.level, f.v, 90 - f.a) ? ' גם ' + F.deg(90 - f.a) + ' הייתה נכנסת: זו הזווית המשלימה.' : '';
      feedback('בול בתוך הסל, ב-' + (G.attempts === 1 ? 'ניסיון ראשון' : G.attempts + ' ניסיונות') + '.' + extra, 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(G.i === 2 ? 'מצוק. מצוק! ובכל זאת, תפוחים.' : 'סל של תפוחים. הכאב עבר.', 'happy');
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
      hud.final.appendChild(U.h('div', { class: 'game-task', text: 'צברת ' + total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון ממנה אותך לתותחן הראשי, ומבקש לדבר עם העורך דין שלו.' : stars === 2 ? 'יפה מאוד. עוד סיבוב ואתה בשלושה כוכבים.' : 'כל הסלים נכבשו. בסיבוב הבא תכבוש אותם בפחות ניסיונות.') }));
      U.Button(hud.final, 'שחק שוב (סלים חדשים)', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }

    function restart() {
      G.points = [];
      G.lastR = null;
      startLevel(0);
    }

    function step(dt) {
      const f = G.flight;
      if (!f) return;
      f.t += dt * 1.5;
      if (f.t >= f.T) {
        f.t = f.T;
        land();
      }
    }

    function drawBasket(L) {
      const ctx = view.ctx;
      const cx = view.sx(L.c), by = view.sy(0);
      const w = L.half * 2 * view.scale;
      ctx.save();
      ctx.fillStyle = '#C5823F';
      ctx.strokeStyle = '#3B2A20';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, by - 13);
      ctx.lineTo(cx + w / 2, by - 13);
      ctx.lineTo(cx + w / 2 - 3, by);
      ctx.lineTo(cx - w / 2 + 3, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const n = Math.max(2, Math.min(5, Math.round(w / 12)));
      for (let k = 0; k < n; k++) {
        B.drawApple(view, L.c - L.half + ((k + 0.5) * 2 * L.half) / n, (15 + (k % 2) * 3) / view.scale, 10, { plain: true });
      }
      view.text(L.c, 0, F.unit(L.c, 'm', 0), { size: 12, weight: 700, color: C.displacement, offset: [0, 13], halo: true });
    }

    function render() {
      const L = G.level;
      const r = view.visible;
      view.clear();
      view.grid(5, {});
      B.drawGround(view, 0, {});
      if (L.h0) {
        view.poly([{ x: r.xMin, y: 0 }, { x: 0, y: 0 }, { x: 0, y: L.h0 }, { x: r.xMin, y: L.h0 }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
        view.text(-2 - 12 / view.scale, L.h0 / 2, F.unit(L.h0, 'm', 0), { size: 12.5, weight: 700 });
      }
      drawBasket(L);

      G.traces.forEach(function (t) {
        view.poly(B.path(t.v, t.a, t.h0), { color: t.hit ? C.good : C.soft, width: 1.8, alpha: 0.65, dash: t.hit ? null : [3, 5] });
        if (!t.hit) view.circle(t.R, 0, 4, { px: true, fill: C.soft });
      });

      const y0 = L.h0;
      const px = view.w < 420 ? 34 : 48;
      if (G.phase === 'aim') {
        const c = B.comps(G.v, G.a);
        view.arrow(0, y0, c.vx * 0.55, y0 + c.vy * 0.55, { color: C.velocity, width: 3.5, label: F.unit(G.v, 'ms', 0), labelSize: 12, labelSide: -1, labelGap: 13 });
      }
      B.drawCannon(view, 0, y0, G.flight ? G.flight.a : G.a, { len: 28, w: 12 });

      const f = G.flight;
      if (f) {
        const p = B.at(f.v, f.a, f.t, f.h0);
        view.poly(B.path(f.v, f.a, f.h0, 0, 50).filter(function (q) { return q.x <= p.x; }), { color: C.accent, width: 2 });
        PHY.mascot.draw(view, p.x, p.y, { pose: 'flying', px: px, rot: (Math.atan2(p.vy, p.vx) * 180) / Math.PI });
      } else if (G.cat) {
        PHY.mascot.draw(view, G.cat.x, 0, { pose: G.cat.pose, px: px });
      } else {
        PHY.mascot.draw(view, -2.4, y0, { pose: 'thinking', px: px });
      }
      if (G.caption) view.screenText(view.w / 2, 20, G.caption, { size: 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* HUD */
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
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary', text: 'אש!' });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]));
    hud.main.appendChild(hud.task);
    hud.ang = U.Slider(hud.main, {
      label: 'זווית', min: 10, max: 80, step: 1, value: G.a, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { G.a = v; loop.requestRender(); },
    });
    hud.speed = U.Slider(hud.main, {
      label: 'מהירות', min: 5, max: 25, step: 1, value: G.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { G.v = v; loop.requestRender(); },
    });
    hud.out = U.Readouts(hud.main, [
      { key: 'att', label: 'ניסיונות' },
      { key: 'target', label: 'מרחק הסל', color: 'var(--c-displacement)' },
      { key: 'last', label: 'נחיתה אחרונה', color: 'var(--c-displacement)' },
    ]);
    hud.main.appendChild(hud.feedback);
    hud.main.appendChild(U.h('div', { class: 'sim-row' }, [hud.action]));

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam(name, v) {
        if (name === 'angle') { G.a = v; hud.ang.set(v); }
        if (name === 'speed' && !G.level.lockSpeed) { G.v = v; hud.speed.set(v); }
        loop.requestRender();
      },
      getState() {
        const L = G.level;
        return { level: G.i, phase: G.phase, attempts: G.attempts, points: G.points.slice(), target: L.c, half: L.half, h0: L.h0, lockSpeed: L.lockSpeed, minAngle: L.minAngle, witness: L.witness, angle: G.a, speed: G.v, lastR: G.lastR, stars: G.stars };
      },
      solutions() { return solutionsOf(G.level); },
      fire,
      /* Same as clicking the action button when the level is won. */
      next() { if (G.phase === 'won') hud.action.click(); },
      /* Advance the flight now, without waiting for frames. */
      advance(seconds) {
        for (let t = 0; t < seconds && G.flight; t += 1 / 120) step(1 / 120);
      },
      /* Builds n levels of every kind and reports the smallest solution counts. */
      auditLevels(n) {
        const report = [0, 1, 2].map(function (i) {
          let min = Infinity, bad = 0;
          for (let k = 0; k < n; k++) {
            const L = makeLevel(i);
            const count = solutionsOf(L).length;
            if (count === 0) bad++;
            min = Math.min(min, count);
          }
          return { level: i + 1, minSolutions: min, unwinnable: bad };
        });
        return report;
      },
    };
    startLevel(0);
    return api;
  };
})();

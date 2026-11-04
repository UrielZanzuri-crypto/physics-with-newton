/* PHY.sims.mobileGame: "המובייל של ניוטון". Bars hang one from another, and the reader drags each bar's loop.
   Each bar turns about its loop, which sits a distance e above the bar:
     I th'' = -g [ m_L (0 - h) cos th + m_R (L - h) cos th + e M sin th ] - c th'
   so an unbalanced bar settles at a real tilt, tan th = -(moment) / (e M), and a balanced one settles level.
   What hangs from a bar's end counts for it as one weight, whatever is going on down there.
   Level 1: one bar. Level 2: two tiers. Level 3: three tiers, with given masses. Every level is built from
   a solution on the 0.1 m grid. Points by moves: par (one move per bar) gives 3, up to par + 2 gives 2, otherwise 1.
   opts: {chapter, section, random, onDone(stars, total)}. sim.moveHang(i, h) is the same path as a pointer drag.
   sim.settle(T) -> Promise. getState(): bars, solutions, moves, points. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, St = PHY.statics, B = PHY.ballistics;
  const RAD = St.RAD, G = St.G;

  const BAR = 1.2, CELL = 0.1, CELLS = 12, E = 0.17;
  const NAMES = ['שלב 1: מוט אחד', 'שלב 2: שתי קומות', 'שלב 3: שלוש קומות'];
  const WORLDS = [
    { xMin: -1.75, xMax: 1.75, yMin: 1.15, yMax: 3.25 },
    { xMin: -2.3, xMax: 2.3, yMin: 0.65, yMax: 3.25 },
    { xMin: -2.65, xMax: 2.65, yMin: 0.05, yMax: 3.25 },
  ];
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  /* Does a bar with a on its left and b on its right balance on the grid, away from the ends? */
  function cellOf(a, b) { return (CELLS * b) / (a + b); }
  function gridOk(a, b) {
    const k = cellOf(a, b);
    return near(k, Math.round(k)) && k >= 1 && k <= 11;
  }

  function pools() {
    const one = [], two = [], three = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a !== b && gridOk(a, b)) one.push([a, b]);
    for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      if (b === c || !gridOk(b, c)) continue;
      for (let a = 1; a <= 9; a++) if (a !== b + c && gridOk(a, b + c)) two.push([a, b, c]);
    }
    for (let c = 1; c <= 4; c++) for (let d = 1; d <= 4; d++) {
      if (c === d || !gridOk(c, d)) continue;
      for (let b = 1; b <= 6; b++) {
        if (b === c + d || !gridOk(b, c + d)) continue;
        for (let a = 1; a <= 12; a++) if (a !== b + c + d && gridOk(a, b + c + d)) three.push([a, b, c, d]);
      }
    }
    return [one, two, three];
  }
  const POOLS = pools();

  function makeLevel(i, rand) {
    const pool = POOLS[i];
    const pick = pool[Math.floor(rand() * pool.length) % pool.length];
    const mirror = rand() < 0.5;
    let bars;
    /* side: the side of the top bar that carries the next bar. The next one folds back inward, to stay on screen. */
    const m = (x) => ({ m: x });
    const b = (x) => ({ bar: x });
    if (i === 0) {
      bars = [{ left: m(pick[0]), right: m(pick[1]) }];
    } else if (i === 1) {
      const top = mirror ? { left: b(1), right: m(pick[0]) } : { left: m(pick[0]), right: b(1) };
      bars = [top, { left: m(pick[1]), right: m(pick[2]) }];
    } else {
      const top = mirror ? { left: b(1), right: m(pick[0]) } : { left: m(pick[0]), right: b(1) };
      const mid = mirror ? { left: m(pick[1]), right: b(2) } : { left: b(2), right: m(pick[1]) };
      bars = [top, mid, { left: m(pick[2]), right: m(pick[3]) }];
    }
    return bars;
  }

  PHY.sims.mobileGame = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const rand = opts.random || Math.random;
    const view = PHY.canvas.create(canvasEl, { world: WORLDS[0], aspect: 1.4, minHeight: 300, maxHeight: 500 });
    const G_ = { i: 0, bars: [], moves: 0, points: [], phase: 'play', drag: null, caption: '', pose: 'thinking', settlers: [], stars: 0, wrong: 0 };
    const hud = {};

    function massOf(load) {
      if (load.m !== undefined) return load.m;
      const bar = G_.bars[load.bar];
      return massOf(bar.left) + massOf(bar.right);
    }
    function moment(bar) {
      const mL = massOf(bar.left), mR = massOf(bar.right);
      return mL * (0 - bar.h) + mR * (BAR - bar.h);
    }
    function solution(bar) {
      const mL = massOf(bar.left), mR = massOf(bar.right);
      return (BAR * mR) / (mL + mR);
    }
    const isBalanced = (bar) => Math.abs(moment(bar)) < 1e-9;
    function setH(bar, h) { bar.h = Math.round(h / CELL) * CELL; }

    function startLevel(i) {
      G_.i = i;
      G_.bars = makeLevel(i, rand).map(function (b) { return Object.assign({ h: BAR / 2, vh: BAR / 2, th: 0, om: 0 }, b); });
      G_.bars.forEach(function (b) {
        const sol = solution(b);
        const start = near(sol, 0.6) ? 0.3 : 0.6;
        setH(b, start);
        b.vh = b.h;
      });
      G_.moves = 0;
      G_.wrong = 0;
      G_.phase = 'play';
      G_.drag = null;
      G_.caption = '';
      G_.pose = 'thinking';
      view.setWorld(WORLDS[i]);
      hud.task.textContent = taskText();
      hud.main.hidden = false;
      hud.final.hidden = true;
      hud.action.hidden = true;
      feedback('');
      paintPips();
      paintStats();
      loop.requestRender();
    }
    function taskText() {
      if (G_.i === 0) return 'המוט באורך 1.2 מ\'. לגרור את הלולאה שעל המוט למקום שבו הוא מתאזן. כל גרירה נספרת, אז כדאי לחשב לפני.';
      if (G_.i === 1) return 'שתי קומות, וכל מוט באורך 1.2 מ\'. בשביל המוט העליון, כל מה שתלוי על קצהו נספר כמשקל אחד.';
      return 'שלוש קומות, אותו אורך לכל מוט. מתחילים מלמטה, ועולים עם סכום המסות.';
    }
    function feedback(text, kind) {
      hud.feedback.textContent = text;
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === G_.i && G_.phase !== 'done' ? ' is-now' : '') + (G_.points[j] ? ' is-done' : '');
        p.textContent = NAMES[j] + (G_.points[j] ? ' (' + G_.points[j] + ')' : '');
      });
    }
    function paintStats() {
      hud.out.set('moves', String(G_.moves));
      hud.out.set('par', String(G_.bars.length));
      hud.out.set('ok', G_.bars.filter(isBalanced).length + ' מתוך ' + G_.bars.length);
    }

    function barName(i) {
      if (G_.bars.length === 1) return 'המוט';
      if (G_.bars.length === 2) return i === 0 ? 'המוט העליון' : 'המוט התחתון';
      return i === 0 ? 'המוט העליון' : i === 1 ? 'המוט האמצעי' : 'המוט התחתון';
    }
    /* A wrong move teaches: which bar, which side, and why. */
    function afterMove() {
      paintStats();
      const bad = [];
      G_.bars.forEach(function (b, i) { if (!isBalanced(b)) bad.push(i); });
      if (!bad.length) { feedback('כל המוטות מאוזנים. רגע, שיפסיקו להתנדנד.', 'good'); return; }
      const i = bad[bad.length - 1], b = G_.bars[i];
      const mL = massOf(b.left), mR = massOf(b.right), dL = b.h, dR = BAR - b.h;
      const left = mL * dL, right = mR * dR;
      const side = left > right ? 'שמאלה' : 'ימינה';
      let tip = '';
      if (G_.wrong >= 1) tip = ' מזיזים את הלולאה לכיוון הצד שיורד.';
      if (G_.wrong >= 3) tip = ' הלולאה צריכה לשבת במרכז הכובד של מה שתלוי על המוט: מרחק מכל צד ביחס הפוך למסות.';
      feedback(barName(i) + ' נוטה ' + side + ': ' + F.num(mL, 0) + ' ק"ג כפול ' + F.unit(dL, 'm', 1) + ' משמאל, מול ' + F.num(mR, 0) + ' ק"ג כפול ' + F.unit(dR, 'm', 1) + ' מימין.' + tip, 'bad');
      G_.wrong++;
      if (G_.wrong === 3) PHY.mascot.say('אני לא ממהר. אני תלוי פה בכל מקרה.', 'dizzy');
    }
    function moveHang(i, h) {
      if (G_.phase !== 'play') return false;
      const bar = G_.bars[i];
      const old = bar.h;
      const v = Math.max(CELL, Math.min(BAR - CELL, h));
      setH(bar, v);
      if (near(old, bar.h)) return false;
      G_.moves++;
      G_.pose = G_.wrong >= 2 ? 'dizzy' : 'thinking';
      afterMove();
      loop.requestRender();
      return true;
    }
    function checkWin() {
      if (G_.phase !== 'play') return;
      if (!G_.bars.every(isBalanced)) return;
      if (G_.bars.some(function (b) { return Math.abs(b.th) > 1.2 || Math.abs(b.om) > 0.1; })) return;
      const par = G_.bars.length;
      const pts = G_.moves <= par ? 3 : G_.moves <= par + 2 ? 2 : 1;
      G_.points[G_.i] = pts;
      G_.phase = 'won';
      G_.pose = 'happy';
      G_.caption = 'מאוזן! ' + pts + ' מתוך 3 נקודות';
      feedback('הכול ישר, ' + (G_.moves === 1 ? 'בגרירה אחת' : 'ב-' + G_.moves + ' גרירות') + '.', 'good');
      U.burst(canvasEl, 24);
      PHY.mascot.say(G_.i === 2 ? 'שלוש קומות, ואף אחת לא נפלה עליי. אני מתחיל לסמוך על הידיים שגוררות פה.' : pts === 3 ? 'בלי ניסיונות מיותרים. ככה נראה חישוב, אני יודע.' : 'ישר. עכשיו אל תזוזו, אל תנשמו.', 'happy');
      hud.action.hidden = false;
      hud.action.textContent = G_.i < 2 ? 'לשלב הבא' : 'לסיכום';
      hud.action.onclick = G_.i < 2 ? function () { startLevel(G_.i + 1); } : finish;
      paintPips();
      paintStats();
    }
    function finish() {
      const total = G_.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G_.phase = 'done';
      G_.stars = stars;
      paintPips();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: 'צברת ' + total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון מעביר לך את ניהול המובייל, ומבקש שאיש לא ינשוף עליו.' : stars === 2 ? 'יפה מאוד. עוד סיבוב, פחות גרירות, ושלושה כוכבים.' : 'כל המובייל ישר, וזה מה שחשוב. בסיבוב הבא כדאי לחשב לפני שגוררים.') }));
      U.Button(hud.final, 'עוד סיבוב, עם מסות חדשות', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() {
      G_.points = [];
      startLevel(0);
    }

    function step(dt) {
      G_.bars.forEach(function (b, idx) {
        if (G_.drag && G_.drag.i === idx) { b.om *= 0.9; }
        const M = massOf(b.left) + massOf(b.right);
        const mL = massOf(b.left), mR = massOf(b.right);
        const I = mL * b.h * b.h + mR * (BAR - b.h) * (BAR - b.h) + M * E * E;
        const a = b.th * RAD;
        const tau = -G * (moment(b) * Math.cos(a) + E * M * Math.sin(a));
        const w0 = Math.sqrt((G * E * M) / I);
        const c = 2 * 0.42 * w0;
        b.om += (tau / I - c * b.om) * dt;
        b.th += (b.om * dt) / RAD;
        if (b.th > 70) { b.th = 70; b.om = 0; }
        if (b.th < -70) { b.th = -70; b.om = 0; }
        if (isBalanced(b) && Math.abs(b.th) < 0.02 && Math.abs(b.om) < 0.02) { b.th = 0; b.om = 0; }
        b.vh += (b.h - b.vh) * Math.min(1, 12 * dt);
      });
      if (!G_.drag) checkWin();
      G_.settlers = G_.settlers.filter(function (w) {
        w.left -= dt;
        const calm = G_.bars.every(function (b) {
          const eq = Math.atan(-moment(b) / (E * (massOf(b.left) + massOf(b.right)))) / RAD;
          return Math.abs(b.om) < 0.02 && Math.abs(b.th - eq) < 0.5;
        });
        w.calm = calm ? w.calm + dt : 0;
        if (w.left <= 0 || w.calm > 0.2 || G_.phase !== 'play') { w.res(); return false; }
        return true;
      });
    }

    /* ---------- geometry, top down ---------- */
    function layout() {
      const out = [];
      function place(i, attach, stringLen, side) {
        const b = G_.bars[i];
        const P = { x: attach.x, y: attach.y - stringLen };
        const a = b.th * RAD;
        const u = { x: Math.cos(a), y: Math.sin(a) };
        const n = { x: Math.sin(a), y: -Math.cos(a) };  /* from the loop down to the bar line */
        const at = (x) => ({ x: P.x + (x - b.vh) * u.x + E * n.x, y: P.y + (x - b.vh) * u.y + E * n.y });
        const rec = { i: i, bar: b, P: P, at: at, u: u, attach: attach, ends: {}, side: side };
        out.push(rec);
        ['left', 'right'].forEach(function (side) {
          const E0 = at(side === 'left' ? 0 : BAR);
          rec.ends[side] = E0;
          const load = b[side];
          if (load.bar !== undefined) place(load.bar, E0, 0.58, side);
        });
      }
      place(0, { x: 0, y: 3.1 }, 0.27);
      return out;
    }

    function drawLoad(E0, m) {
      const small = view.w < 520;
      const k = small ? 1 : 1.25;
      const w = (30 + 7 * Math.cbrt(m)) * k, h = (20 + 7 * Math.cbrt(m)) * k;
      const drop = 0.2;
      view.line(E0.x, E0.y, E0.x, E0.y - drop, { color: C.ink, width: 1.6 });
      const bottom = E0.y - drop - h / view.scale;
      St.block(view, E0.x, bottom, w, h, 0, { fill: C.gold, slats: true, label: F.unit(m, 'kg', 0), labelSize: small ? 10.5 : 13 });
    }

    function render() {
      const small = view.w < 520, r = view.visible;
      view.clear();
      view.grid(0.5, {});
      St.hatch(view, -1.1, 3.14, 1.1, 3.14, 0, 1, {});
      /* the floor, for the cat */
      const floorY = r.yMin + 0.1;
      view.line(r.xMin, floorY, r.xMax, floorY, { color: C.axis, width: 2 });
      view.poly([{ x: r.xMin, y: floorY }, { x: r.xMax, y: floorY }, { x: r.xMax, y: r.yMin }, { x: r.xMin, y: r.yMin }], { fill: C.shade, close: true });
      PHY.mascot.draw(view, r.xMin + (small ? 0.34 : 0.3), floorY, { pose: G_.pose, px: small ? 54 : 78 });

      const recs = layout();
      recs.forEach(function (rec) {
        const b = rec.bar;
        const dragH = G_.drag && G_.drag.i === rec.i ? G_.drag.h : null;
        const showH = dragH === null ? b.vh : dragH;
        const onBar = rec.at(showH);
        const a = b.th * RAD;
        const top = { x: onBar.x - Math.sin(a) * E, y: onBar.y + Math.cos(a) * E };

        /* string from above */
        view.line(rec.attach.x, rec.attach.y, top.x, top.y, { color: C.ink, width: 1.8 });

        /* the bar */
        const L0 = rec.at(0), L1 = rec.at(BAR);
        const good = isBalanced(b);
        St.plank(view, L0.x, L0.y, L1.x, L1.y, small ? 6 : 8, { fill: good ? C.good : C.accent });
        for (let c = 1; c < CELLS; c++) {
          const p = rec.at(c * CELL);
          view.circle(p.x, p.y, c % 2 === 0 ? 1.7 : 1, { px: true, fill: C.surface });
        }

        /* the loads */
        ['left', 'right'].forEach(function (side) {
          const load = b[side];
          if (load.m !== undefined) drawLoad(rec.ends[side], load.m);
          else {
            /* the string to the next bar is drawn by that bar */
            view.circle(rec.ends[side].x, rec.ends[side].y, 2.5, { px: true, fill: C.ink });
          }
        });

        /* the loop: a little hanger you can drag */
        const h0 = { x: onBar.x - (Math.cos(a) * 0.09), y: onBar.y - Math.sin(a) * 0.09 };
        const h1 = { x: onBar.x + (Math.cos(a) * 0.09), y: onBar.y + Math.sin(a) * 0.09 };
        view.poly([top, h0, h1], { color: C.ink, width: 2, fill: C.surface, close: true });
        const active = dragH !== null;
        if (G_.phase === 'play') view.circle(top.x, top.y, active ? 9 : 7, { px: true, fill: active ? C.accent : C.surface, color: C.accent, width: 3 });
        if (G_.phase === 'play' && G_.i === 0 && G_.moves === 0 && !active) view.text(top.x, top.y, 'לגרור אותי', { size: small ? 11.5 : 13, weight: 700, color: C.accent, halo: true, offset: [small ? -52 : -60, -2] });

        /* torque arrow while the bar is unbalanced */
        const mom = moment(b);
        if (Math.abs(mom) > 1e-9 && !active) {
          const sweep = 26 + Math.min(70, Math.abs(mom) * 26);
          const R = small ? 15 : 20;
          if (mom > 0) St.curved(view, top.x, top.y, R, 40, 40 - sweep, { width: 2.6 });
          else St.curved(view, top.x, top.y, R, 140, 140 + sweep, { width: 2.6 });
        }

        /* arms while dragging */
        if (active) {
          const lp = rec.at(showH / 2), rp = rec.at((showH + BAR) / 2);
          const sz = small ? 11.5 : 13;
          view.text(lp.x, lp.y, F.unit(showH, 'm', 1), { size: sz, weight: 800, color: C.accent, halo: true, offset: [0, -13] });
          view.text(rp.x, rp.y, F.unit(BAR - showH, 'm', 1), { size: sz, weight: 800, color: C.accent, halo: true, offset: [0, -13] });
        }

        /* A balanced sub-bar reveals what it weighs in total. */
        if (rec.i > 0 && good) {
          const M = massOf(b.left) + massOf(b.right);
          const mx = (rec.attach.x + top.x) / 2, my = (rec.attach.y + top.y) / 2;
          view.text(mx, my, 'סך הכול ' + F.unit(M, 'kg', 0), { size: small ? 10.5 : 12, weight: 700, color: C.good, halo: true, offset: [(rec.side === 'left' ? -1 : 1) * (small ? 42 : 52), 0] });
        }
      });
      if (G_.caption) view.screenText(view.w / 2, 16, G_.caption, { size: small ? 12 : 14, weight: 700, pill: true });
    }

    /* ---------- pointer ---------- */
    function barHit(p) {
      if (G_.phase !== 'play') return null;
      let best = null, bestD = 26;
      layout().forEach(function (rec) {
        const b = rec.bar;
        const L0 = rec.at(0);
        const dx = p.x - L0.x, dy = p.y - L0.y;
        const along = dx * rec.u.x + dy * rec.u.y;
        const across = -dx * rec.u.y + dy * rec.u.x;
        if (along < -14 / view.scale || along > BAR + 14 / view.scale) return;
        /* near the bar itself, or near its loop */
        const dBar = Math.abs(across) * view.scale;
        const top = rec.at(b.vh);
        const a = b.th * RAD;
        const lx = top.x - Math.sin(a) * E, ly = top.y + Math.cos(a) * E;
        const dLoop = view.pxDist({ x: lx, y: ly }, p);
        const d = Math.min(dBar, dLoop);
        if (d < bestD) { bestD = d; best = { i: rec.i, rec: rec }; }
      });
      return best;
    }
    function candidate(h, p) {
      const rec = layout().find(function (x) { return x.i === h.i; });
      const L0 = rec.at(0);
      const along = (p.x - L0.x) * rec.u.x + (p.y - L0.y) * rec.u.y;
      const v = Math.max(CELL, Math.min(BAR - CELL, along));
      return Math.round(v / CELL) * CELL;
    }
    view.drag({
      hit: barHit,
      start(h, p) { G_.drag = { i: h.i, h: candidate(h, p) }; loop.requestRender(); },
      move(h, p) { if (G_.drag) { G_.drag.h = candidate(h, p); loop.requestRender(); } },
      end(h) {
        if (!G_.drag) return;
        const v = G_.drag.h;
        G_.drag = null;
        moveHang(h.i, v);
        loop.requestRender();
      },
    });

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
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary', text: 'לשלב הבא', hidden: true });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]));
    hud.main.appendChild(hud.task);
    hud.out = U.Readouts(hud.main, [
      { key: 'moves', label: 'גרירות' },
      { key: 'par', label: 'היעד לשלוש נקודות', color: 'var(--accent)' },
      { key: 'ok', label: 'מוטות מאוזנים', color: 'var(--accent)' },
    ]);
    hud.main.appendChild(hud.feedback);
    hud.main.appendChild(U.h('div', { class: 'sim-row' }, [hud.action]));

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam() {},
      moveHang,
      /* Waits until the bars stop swinging or a level is won. */
      settle(T) { return new Promise(function (res) { G_.settlers.push({ left: T, calm: 0, res: res }); }); },
      next() { if (G_.phase === 'won') hud.action.click(); },
      getState() {
        return {
          level: G_.i, phase: G_.phase, moves: G_.moves, points: G_.points.slice(), stars: G_.stars,
          bars: G_.bars.map(function (b) {
            return {
              h: b.h, th: b.th, om: b.om, solution: solution(b), moment: moment(b),
              mL: massOf(b.left), mR: massOf(b.right),
              thEq: (Math.atan(-moment(b) / (E * (massOf(b.left) + massOf(b.right)))) / RAD),
            };
          }),
        };
      },
      pools() { return POOLS.map(function (p) { return p.length; }); },
      /* Canvas pixels of a point on bar i, h from its left end. Lets a test drive a real pointer. */
      screenOf(i, h) {
        const rec = layout().find(function (x) { return x.i === i; });
        const p = rec.at(h);
        return { x: view.sx(p.x), y: view.sy(p.y) };
      },
    };
    startLevel(0);
    return api;
  };
})();

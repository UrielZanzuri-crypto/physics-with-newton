/* PHY.sims.treasureMap: מפת האוצר. Head-to-tail vector addition on a map.
   Three modes, chosen by opts.mode:

   'walk'  Scripted. sim.play(scenarios) returns a Promise. Used by predict cards and traps.
           scenario: {legs: [{x, y, name}], caption, result, keep, resultant, start, hold}
   'free'  Playground. Drag arrow tips (or focus the canvas: keys 1-4 pick an arrow, arrows move it).
   'game'  Three levels with stars: follow the directions, one arrow replaces all, subtract A−B.

   Coordinates: x = east (right), y = north (up), meters. Displacement is always purple. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const V = PHY.vec, F = PHY.fmt, U = PHY.ui;
  const C = PHY.colors;
  const M = (x) => F.unit(x, 'm', 1);

  PHY.sims.treasureMap = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ mode: 'walk', chapter: '01' }, opts || {});
    const defaults = {
      walk: { xMin: -3, xMax: 9, yMin: -1.2, yMax: 6.6 },
      free: { xMin: -9, xMax: 9, yMin: -5.5, yMax: 5.5 },
      game: { xMin: -8, xMax: 8, yMin: -5, yMax: 5 },
    };
    const world = opts.world || defaults[opts.mode];
    const view = PHY.canvas.create(canvasEl, {
      world,
      aspect: opts.aspect || (opts.mode === 'walk' ? 2 : 1.6),
      minHeight: opts.minHeight || (opts.mode === 'walk' ? 230 : 300),
      maxHeight: 500,
    });
    const HOME = V.v(0, 0);

    /* ---------- Shared scene state ---------- */
    const S = {
      t: 0,
      cat: { pos: HOME, pose: 'standing', flip: false, visible: true, moving: false },
      legs: [],       // drawn path pieces {a, b, name, alpha}
      results: [],    // purple resultant arrows {a, b, label}
      caption: '',
      treasure: null, // {pos, open}
      walked: 0,
    };

    /* ---------- Tweens ---------- */
    let tweens = [];
    let runId = 0;
    function tween(T, fn) {
      return new Promise(function (resolve) {
        tweens.push({ t: 0, T: Math.max(T, 1e-3), fn, resolve });
      });
    }
    const wait = (T) => tween(T, function () {});
    const ease = (x) => x * x * (3 - 2 * x);
    function cancelTweens() {
      tweens = [];
      runId++;
    }

    function step(dt) {
      S.t += dt;
      if (!tweens.length) return;
      const live = tweens.slice();
      live.forEach(function (tw) {
        tw.t += dt;
        const k = Math.min(tw.t / tw.T, 1);
        tw.fn(k, dt);
        if (k >= 1) {
          tweens.splice(tweens.indexOf(tw), 1);
          tw.resolve();
        }
      });
    }

    function walkLeg(from, to, speed) {
      const leg = { a: from, b: from, name: legName, alpha: 1 };
      S.legs.push(leg);
      const d = V.dist(from, to);
      S.cat.flip = to.x < from.x - 1e-6;
      S.cat.moving = true;
      let prev = 0;
      return tween(d / (speed || 3.2), function (k) {
        const p = V.lerp(from, to, k);
        leg.b = p;
        S.cat.pos = p;
        S.walked += (k - prev) * d;
        prev = k;
        updateWalkReadouts();
      }).then(function () { S.cat.moving = false; });
    }
    let legName = '';

    /* ---------- Rendering ---------- */
    function drawCompass() {
      const px = view.w - 34, py = 36;
      const ctx = view.ctx;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.gridStrong;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.apple;
      ctx.beginPath(); ctx.moveTo(px, py - 13); ctx.lineTo(px - 4.5, py); ctx.lineTo(px + 4.5, py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.soft;
      ctx.beginPath(); ctx.moveTo(px, py + 13); ctx.lineTo(px - 4.5, py); ctx.lineTo(px + 4.5, py); ctx.closePath(); ctx.fill();
      ctx.restore();
      view.screenText(px, py - 25, 'צפון', { size: 11, color: C.soft, weight: 600 });
    }

    function drawHome(p) {
      const q = p || HOME;
      const x = view.sx(q.x), y = view.sy(q.y);
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.accent;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 2); ctx.lineTo(x - 10, y - 8); ctx.lineTo(x, y - 17); ctx.lineTo(x + 10, y - 8); ctx.lineTo(x + 10, y + 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      view.screenText(x, y + 12, 'בית', { size: 11, color: C.soft, weight: 600, halo: true });
    }

    function drawChest(p, open) {
      const x = view.sx(p.x), y = view.sy(p.y);
      const ctx = view.ctx;
      ctx.save();
      if (open) {
        const g = 18 + Math.sin(S.t * 5) * 3;
        ctx.fillStyle = C.glow;
        ctx.beginPath(); ctx.arc(x, y - 8, g + 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3B2A20';
      ctx.fillStyle = '#A9692F';
      ctx.fillRect(x - 13, y - 13, 26, 15); ctx.strokeRect(x - 13, y - 13, 26, 15);
      ctx.fillStyle = '#C5823F';
      ctx.beginPath();
      if (open) { ctx.moveTo(x - 13, y - 13); ctx.lineTo(x - 16, y - 25); ctx.lineTo(x + 16, y - 25); ctx.lineTo(x + 13, y - 13); }
      else { ctx.moveTo(x - 13, y - 13); ctx.quadraticCurveTo(x, y - 27, x + 13, y - 13); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFC83D';
      ctx.fillRect(x - 3, y - 15, 6, 7); ctx.strokeRect(x - 3, y - 15, 6, 7);
      ctx.restore();
    }

    function drawCat() {
      if (!S.cat.visible) return;
      const hop = S.cat.moving ? Math.abs(Math.sin(S.t * 11)) * 0.12 : 0;
      PHY.mascot.draw(view, S.cat.pos.x, S.cat.pos.y + hop, { pose: S.cat.pose, px: opts.catPx || (view.w < 420 ? 40 : 54), flipX: S.cat.flip });
    }

    function drawLegs() {
      S.legs.forEach(function (l) {
        view.arrow(l.a.x, l.a.y, l.b.x, l.b.y, { color: C.displacement, width: 3, alpha: 0.5 * l.alpha, label: V.dist(l.a, l.b) > 0.6 ? l.name : '', labelSize: 13 });
      });
    }
    function drawResults() {
      S.results.forEach(function (r) {
        view.arrow(r.a.x, r.a.y, r.b.x, r.b.y, { color: C.displacement, width: 5, label: r.label, labelSide: r.side || -1, labelGap: 16, alpha: r.alpha });
      });
    }
    function drawCaption() {
      if (S.caption) view.screenText(view.w / 2, 24, S.caption, { size: 14.5, weight: 700, pill: true, color: C.ink });
    }

    function renderWalk() {
      view.clear();
      view.grid(1, { majorEvery: 5 });
      drawCompass();
      drawHome();
      if (S.treasure) drawChest(S.treasure.pos, S.treasure.open);
      drawLegs();
      drawResults();
      drawCat();
      drawCaption();
    }

    /* ---------- Walk mode ---------- */
    let walkOut = null, walkLog = null;
    if (opts.mode === 'walk') {
      walkOut = U.Readouts(controlsEl, [
        { key: 'walked', label: 'כמה הוא הלך בפועל', value: M(0) },
        { key: 'disp', label: 'כמה הוא רחוק מהבית', value: M(0), color: 'var(--c-displacement)' },
      ]);
      walkLog = U.h('div', { class: 'chips' });
      controlsEl.appendChild(walkLog);
    }
    function updateWalkReadouts() {
      if (!walkOut) return;
      walkOut.set('walked', M(S.walked));
      walkOut.set('disp', M(V.dist(S.cat.pos, HOME)));
    }
    function clearScene() {
      S.legs = [];
      S.results = [];
      S.caption = '';
      S.walked = 0;
      S.cat.pos = HOME;
      S.cat.pose = 'standing';
      S.cat.flip = false;
      S.cat.moving = false;
      updateWalkReadouts();
    }

    async function play(scenarios) {
      cancelTweens();
      const id = runId;
      clearScene();
      if (walkLog) walkLog.innerHTML = '';
      for (let i = 0; i < scenarios.length; i++) {
        const sc = scenarios[i];
        if (!sc.keep) {
          S.legs = [];
          S.results = [];
          S.walked = 0;
        } else {
          S.legs.forEach(function (l) { l.alpha = 0.7; });
          S.walked = 0;
        }
        const start = sc.start || HOME;
        S.cat.pos = start;
        S.cat.pose = 'standing';
        S.caption = sc.caption || '';
        updateWalkReadouts();
        await wait(sc.lead === undefined ? 0.35 : sc.lead);
        if (id !== runId) return;
        let here = start;
        for (let j = 0; j < sc.legs.length; j++) {
          const leg = sc.legs[j];
          const next = V.add(here, leg);
          legName = leg.name || '';
          await walkLeg(here, next, sc.speed);
          if (id !== runId) return;
          here = next;
          if (j < sc.legs.length - 1) { await wait(0.18); if (id !== runId) return; }
        }
        if (sc.resultant !== false && V.dist(here, start) > 0.01) {
          const res = { a: start, b: start, label: sc.resultantLabel || '' };
          S.results.push(res);
          const end = here;
          await tween(0.45, function (k) { res.b = V.lerp(start, end, ease(k)); });
          if (id !== runId) return;
        }
        S.cat.pose = sc.endPose || 'happy';
        if (sc.result) {
          S.caption = sc.result;
          if (walkLog) walkLog.appendChild(U.h('span', { class: 'chip', text: sc.result }));
        }
        await wait(sc.hold === undefined ? 1.1 : sc.hold);
        if (id !== runId) return;
      }
    }

    /* ---------- Free mode ---------- */
    const FR = { vecs: [], showComp: false, active: 0 };
    let frOut = null, frRemove = null, frAdd = null;
    const NAMES = ['A', 'B', 'C', 'D'];

    function chain() {
      const pts = [HOME];
      FR.vecs.forEach(function (v) { pts.push(V.add(pts[pts.length - 1], v)); });
      return pts;
    }
    function freeUpdate() {
      const pts = chain();
      const R = pts[pts.length - 1];
      const L = FR.vecs.reduce(function (a, v) { return a + V.len(v); }, 0);
      frOut.set('R', M(V.len(R)));
      frOut.set('ang', V.len(R) > 0.01 ? F.deg(V.angle(R)) : '—');
      frOut.set('Rx', M(R.x));
      frOut.set('Ry', M(R.y));
      frOut.set('L', M(L));
      S.cat.pos = R;
      const home = V.len(R) < 0.01;
      S.cat.pose = home ? 'happy' : 'standing';
      if (home && !FR.wasHome) PHY.mascot.say('הלכתי, הלכתי, וחזרתי הביתה. העתק: 0 מ\'. הרגליים חולקות על זה.', 'dizzy');
      FR.wasHome = home;
      if (frRemove) frRemove.disabled = FR.vecs.length <= 1;
      if (frAdd) frAdd.disabled = FR.vecs.length >= 4;
      if (loop) loop.requestRender();
      if (opts.onChange) opts.onChange(api.getState());
    }
    function freeSetHead(i, p) {
      const pts = chain();
      const r = view.visible;
      const clamped = V.v(Math.max(r.xMin + 0.5, Math.min(r.xMax - 0.5, p.x)), Math.max(r.yMin + 0.5, Math.min(r.yMax - 0.5, p.y)));
      const snapped = V.snap(clamped, 0.5);
      FR.vecs[i] = V.sub(snapped, pts[i]);
      FR.active = i;
      freeUpdate();
    }
    function renderFree() {
      view.clear();
      view.grid(1, { majorEvery: 5 });
      view.axes({ xLabel: 'x', yLabel: 'y', tickEvery: 1 });
      drawCompass();
      const pts = chain();
      const R = pts[pts.length - 1];
      if (FR.showComp && V.len(R) > 0.01) {
        const opt = { color: C.displacement, width: 2.5, dash: [6, 5], alpha: 0.8 };
        view.arrow(0, 0, R.x, 0, Object.assign({ label: 'x: ' + F.num(R.x, 1), labelSide: R.y >= 0 ? 1 : -1, labelGap: 13 }, opt));
        view.arrow(R.x, 0, R.x, R.y, Object.assign({ label: 'y: ' + F.num(R.y, 1), labelSide: R.x >= 0 ? -1 : 1, labelGap: 26 }, opt));
      }
      if (V.len(R) > 0.01) view.arrow(0, 0, R.x, R.y, { color: C.displacement, width: 6, alpha: 0.32 });
      FR.vecs.forEach(function (v, i) {
        view.arrow(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, { color: C.displacement, width: i === FR.active ? 4 : 3, label: NAMES[i], labelGap: 14 });
      });
      if (V.len(R) > 0.01) {
        const mid = V.lerp(HOME, R, 0.5);
        view.text(mid.x, mid.y, 'R', { color: C.displacement, weight: 800, size: 15, halo: true, offset: [0, -12] });
      }
      drawHome();
      for (let i = 1; i < pts.length; i++) {
        view.circle(pts[i].x, pts[i].y, 8 + Math.sin(S.t * 4) * 1, { px: true, fill: C.surface, color: C.displacement, width: 3 });
      }
      if (!S.free_walking) {
        const side = R.x + 1.8 > view.visible.xMax ? -0.9 : 0.9;
        PHY.mascot.draw(view, R.x + side, R.y - 0.3, { pose: S.cat.pose, px: view.w < 420 ? 36 : 46 });
      } else {
        drawCat();
      }
    }
    async function freeWalk() {
      cancelTweens();
      const id = runId;
      S.free_walking = true;
      const pts = chain();
      S.cat.pos = HOME;
      S.cat.pose = 'standing';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        S.cat.moving = true;
        S.cat.flip = b.x < a.x - 1e-6;
        await tween(Math.max(V.dist(a, b) / 4, 0.05), function (k) { S.cat.pos = V.lerp(a, b, k); });
        if (id !== runId) return;
      }
      S.cat.moving = false;
      S.cat.flip = false;
      S.cat.pose = 'happy';
      await wait(0.9);
      if (id !== runId) return;
      S.free_walking = false;
      S.cat.pos = pts[pts.length - 1];
    }
    function buildFree() {
      FR.vecs = (opts.vectors || [V.v(4, 1.5), V.v(1, 3)]).slice();
      frOut = U.Readouts(controlsEl, [
        { key: 'R', label: 'גודל השקול R', color: 'var(--c-displacement)' },
        { key: 'ang', label: 'זווית מציר x', color: 'var(--c-displacement)' },
        { key: 'Rx', label: 'רכיב x', color: 'var(--c-displacement)' },
        { key: 'Ry', label: 'רכיב y', color: 'var(--c-displacement)' },
        { key: 'L', label: 'אורך כל החצים יחד' },
      ]);
      const row = U.h('div', { class: 'sim-row' });
      controlsEl.appendChild(row);
      U.Toggle(row, 'הצג רכיבים', { onChange(v) { FR.showComp = v; loop.requestRender(); } });
      frAdd = U.Button(row, 'הוסף חץ', function () {
        if (FR.vecs.length < 4) {
          FR.vecs.push(V.v(FR.vecs.length % 2 ? -2 : 2, FR.vecs.length % 2 ? 1 : -2));
          FR.active = FR.vecs.length - 1;
          freeUpdate();
        }
      });
      frRemove = U.Button(row, 'הסר חץ', function () {
        if (FR.vecs.length > 1) {
          FR.vecs.pop();
          FR.active = Math.min(FR.active, FR.vecs.length - 1);
          freeUpdate();
        }
      });
      U.Button(row, 'הפוך סדר', function () {
        FR.vecs.reverse();
        freeUpdate();
        PHY.mascot.say('סדר אחר, אותו R. לחיבור וקטורים לא אכפת מי ראשון.', 'thinking');
      });
      U.Button(row, 'שלח את ניוטון', freeWalk, { primary: true });

      view.drag({
        hit(p) {
          const pts = chain();
          let best = -1, bestD = 30;
          for (let i = 1; i < pts.length; i++) {
            const d = view.pxDist(p, pts[i]);
            if (d < bestD) { bestD = d; best = i; }
          }
          return best > 0 ? { i: best - 1 } : null;
        },
        start(h) { S.free_walking = false; cancelTweens(); FR.active = h.i; markTouched(); },
        move(h, p) { freeSetHead(h.i, p); },
      });
      canvasEl.setAttribute('tabindex', '0');
      canvasEl.setAttribute('role', 'application');
      canvasEl.setAttribute('aria-label', 'מפה עם חצים. מקשים 1 עד 4 בוחרים חץ, מקשי החצים מזיזים את הקצה שלו.');
      canvasEl.addEventListener('keydown', function (e) {
        const dirs = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, 0.5], ArrowDown: [0, -0.5] };
        if (/^[1-4]$/.test(e.key) && +e.key <= FR.vecs.length) {
          FR.active = +e.key - 1;
          loop.requestRender();
        } else if (dirs[e.key]) {
          e.preventDefault();
          const pts = chain();
          const tip = pts[FR.active + 1];
          freeSetHead(FR.active, V.v(tip.x + dirs[e.key][0], tip.y + dirs[e.key][1]));
          markTouched();
        }
      });
    }
    function markTouched() {
      if (opts.section && !FR.touched) {
        FR.touched = true;
        PHY.progress.markSection(opts.chapter, opts.section);
      }
    }

    /* ---------- Game mode ---------- */
    const G = { level: 0, attempts: 0, points: [], phase: 'play', cursor: null, data: null };
    const hud = {};
    const LEVEL_NAMES = ['שלב 1: הוראות', 'שלב 2: חץ אחד', 'שלב 3: חיסור'];
    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const COMPASS = [
      { x: 1, y: 0, word: 'מזרחה' },
      { x: -1, y: 0, word: 'מערבה' },
      { x: 0, y: 1, word: 'צפונה' },
      { x: 0, y: -1, word: 'דרומה' },
    ];

    function genLevel1() {
      for (let tries = 0; tries < 200; tries++) {
        const legs = [];
        let p = HOME;
        let horiz = Math.random() < 0.5;
        let ok = true;
        for (let i = 0; i < 4 && ok; i++) {
          const opts2 = COMPASS.filter(function (c) { return horiz ? c.x !== 0 : c.y !== 0; });
          const dir = opts2[rand(0, 1)];
          const n = rand(2, horiz ? 6 : 4);
          const q = V.add(p, V.scale(dir, n));
          if (Math.abs(q.x) > 7 || Math.abs(q.y) > 4) ok = false;
          legs.push({ n, dir });
          p = q;
          horiz = !horiz;
        }
        if (ok && V.len(p) >= 3 && Math.abs(p.x) >= 1 && Math.abs(p.y) >= 1) return { legs, target: p };
      }
      return {
        legs: [{ n: 4, dir: COMPASS[0] }, { n: 3, dir: COMPASS[2] }, { n: 6, dir: COMPASS[1] }, { n: 1, dir: COMPASS[3] }],
        target: V.v(-2, 2),
      };
    }

    function randVec(maxX, maxY) {
      let v;
      do { v = V.v(rand(-maxX, maxX), rand(-maxY, maxY)); } while (V.len(v) < 2.2 || v.x === 0 || v.y === 0);
      return v;
    }

    function genLevel2() {
      for (let tries = 0; tries < 300; tries++) {
        const vecs = [randVec(4, 3), randVec(4, 3), randVec(4, 3)];
        const R = V.sum(vecs);
        if (Math.abs(R.x) > 7 || Math.abs(R.y) > 4 || V.len(R) < 2.5) continue;
        /* Parking spots away from the home, so arrows do not sit on top of each other. */
        const spots = [];
        const zones = [[-8, -2.5], [-1.5, 3], [3, 8]];
        const fits = vecs.every(function (v, i) {
          for (let k = 0; k < 40; k++) {
            const a = V.v(zones[i][0] + Math.random() * (zones[i][1] - zones[i][0]), rand(-4, 4));
            a.x = Math.round(a.x);
            const b = V.add(a, v);
            const mid = V.lerp(a, b, 0.5);
            if (Math.abs(a.y) <= 4.5 && Math.abs(b.y) <= 4.5 && Math.abs(a.x) <= 7.5 && Math.abs(b.x) <= 7.5 && V.len(mid) > 2 && V.len(a) > 1.5 && V.len(b) > 1.5) {
              spots.push(a);
              return true;
            }
          }
          return false;
        });
        if (fits) return { vecs, spots, anchors: spots.slice(), target: R };
      }
      return {
        vecs: [V.v(3, 2), V.v(-1, 3), V.v(2, -2)],
        spots: [V.v(-7, -4), V.v(-1, 2), V.v(4, 1)],
        anchors: [V.v(-7, -4), V.v(-1, 2), V.v(4, 1)],
        target: V.v(4, 3),
      };
    }

    function genLevel3() {
      for (let tries = 0; tries < 300; tries++) {
        const A = randVec(5, 4), B = randVec(5, 4);
        const D = V.sub(A, B);
        if (Math.abs(D.x) > 7 || Math.abs(D.y) > 4 || V.len(D) < 2.5) continue;
        if (V.dist(A, B) < 2.5) continue;
        return { A, B, target: D };
      }
      return { A: V.v(4, 2), B: V.v(-1, 3), target: V.v(5, -1) };
    }

    function gameFeedback(text, kind) {
      hud.feedback.textContent = text;
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function setAction(text, fn, primary) {
      hud.action.textContent = text;
      hud.action.onclick = fn;
      hud.action.disabled = false;
      hud.action.className = 'btn ' + (primary === false ? '' : 'btn-primary');
    }

    function paintPips() {
      hud.pips.forEach(function (pip, i) {
        pip.className = 'game-pip' + (i === G.level && G.phase !== 'done' ? ' is-now' : '') + (G.points[i] ? ' is-done' : '');
        pip.textContent = LEVEL_NAMES[i];
      });
    }

    function startLevel(i) {
      cancelTweens();
      G.level = i;
      G.attempts = 0;
      G.phase = 'play';
      G.cursor = null;
      G.anim = null;
      S.legs = [];
      S.results = [];
      S.treasure = null;
      S.cat.pos = HOME;
      S.cat.pose = 'standing';
      S.cat.flip = false;
      S.cat.moving = false;
      S.caption = '';
      gameFeedback('');
      hud.task.innerHTML = '';
      paintPips();
      hud.final.hidden = true;
      hud.main.hidden = false;
      if (i === 0) {
        G.data = genLevel1();
        const list = U.h('div', { class: 'game-steps' });
        G.data.legs.forEach(function (l) {
          list.appendChild(U.h('span', { class: 'chip', text: l.n + " מ' " + l.dir.word }));
        });
        hud.task.appendChild(U.h('div', { text: 'מפה ישנה! ניוטון מתחיל בבית והולך לפי ההוראות. הקש במקום שבו קבור האוצר.' }));
        hud.task.appendChild(list);
        G.cursor = null;
        setAction('חפור כאן!', submit);
        hud.action.disabled = true;
      } else if (i === 1) {
        G.data = genLevel2();
        G.cursor = V.v(1, 1);
        hud.task.textContent = 'שלושה חצים מפוזרים על המפה. גרור את החץ מהבית כך שיחליף את שלושתם יחד. רמז: בדמיון, שים אותם ראש לזנב.';
        setAction('בדוק', submit);
      } else {
        G.data = genLevel3();
        G.cursor = V.v(1, 1);
        S.treasure = { pos: G.data.A, open: false };
        hud.task.textContent = 'ניוטון עומד בקצה של B, והאוצר בקצה של A. איזה חץ יוביל אותו לשם? גרור את החץ הסגול מהבית כך שיהיה שווה ל-A − B.';
        setAction('בדוק', submit);
      }
      updateCursorReadout();
      loop.requestRender();
    }

    function updateCursorReadout() {
      if (G.cursor) {
        hud.readout.set('x', M(G.cursor.x));
        hud.readout.set('y', M(G.cursor.y));
        hud.readout.set('len', M(V.len(G.cursor)));
      } else {
        hud.readout.set('x', '—');
        hud.readout.set('y', '—');
        hud.readout.set('len', '—');
      }
    }

    function moveCursor(p) {
      if (G.phase !== 'play') return;
      const r = view.world;
      const q = V.snap(V.v(Math.max(r.xMin + 0.5, Math.min(r.xMax - 0.5, p.x)), Math.max(r.yMin + 0.5, Math.min(r.yMax - 0.5, p.y))), 1);
      G.cursor = q;
      if (G.level === 0) hud.action.disabled = false;
      updateCursorReadout();
      loop.requestRender();
    }

    function submit() {
      if (G.phase !== 'play' || !G.cursor) return;
      G.attempts++;
      const target = G.data.target;
      if (V.eq(G.cursor, target, 0.01)) { win(); return; }
      PHY.mascot.say(G.attempts >= 2 ? 'אני לא אומר שאני רעב, אבל חפרנו כבר הרבה.' : 'פה יש רק עפר. ועוד עפר.', 'thinking');
      const dx = target.x - G.cursor.x, dy = target.y - G.cursor.y;
      if (G.level === 0) {
        const d = V.len(V.v(dx, dy));
        const word = d <= 2 ? 'חם מאוד!' : d <= 4 ? 'חמים.' : 'קר.';
        if (G.attempts >= 2) {
          gameFeedback(word + ' חבר את כל מה שהולך מזרח-מערב לחוד, ואת כל מה שהולך צפון-דרום לחוד.', 'bad');
          const sx = G.data.legs.reduce(function (a, l) { return a + l.n * l.dir.x; }, 0);
          if (G.attempts >= 3) gameFeedback(word + ' מזרח-מערב יחד נותן ' + M(sx) + ' (מינוס זה מערבה). עכשיו אותו דבר לצפון-דרום.', 'bad');
        } else {
          gameFeedback(word + ' נסה שוב.', 'bad');
        }
      } else {
        const okX = Math.abs(dx) < 0.01, okY = Math.abs(dy) < 0.01;
        if (okX) gameFeedback('רכיב x מדויק! רק רכיב y עוד לא.', 'bad');
        else if (okY) gameFeedback('רכיב y מדויק! רק רכיב x עוד לא.', 'bad');
        else gameFeedback(G.level === 1 ? 'עוד לא. חבר בנפרד את רכיבי x ואת רכיבי y של החצים.' : 'עוד לא. A − B זה כמו A + (−B): הפוך את B ושים אותו בקצה של A.', 'bad');
        if (G.attempts >= 2) G.hint = true;
        if (G.attempts >= 3) {
          if (G.level === 1) gameFeedback('סכום x של שלושת החצים הוא ' + F.num(target.x) + ' מ\'. עכשיו הוסף בעצמך את y.', 'bad');
          else gameFeedback('החץ −B מצויר עכשיו מקווקו. מהבית דרך A ואז דרך −B: לשם אתה מכוון.', 'bad');
        }
      }
      loop.requestRender();
    }

    async function win() {
      const id = runId;
      G.phase = 'anim';
      hud.action.disabled = true;
      G.hint = false;
      const pts = Math.max(1, 4 - G.attempts);
      G.points[G.level] = pts;
      gameFeedback('מצאת! ניוטון יוצא לדרך...', 'good');
      if (G.level === 0) {
        let here = HOME;
        S.treasure = null;
        for (const l of G.data.legs) {
          const next = V.add(here, V.scale(l.dir, l.n));
          legName = '';
          await walkLeg(here, next, 6);
          if (id !== runId) return;
          here = next;
        }
        S.results = [{ a: HOME, b: here, label: 'השקול' }];
        S.treasure = { pos: here, open: true };
      } else if (G.level === 1) {
        const d = G.data;
        const startSpots = d.spots.slice();
        const chainPts = [HOME];
        d.vecs.forEach(function (v) { chainPts.push(V.add(chainPts[chainPts.length - 1], v)); });
        await tween(0.8, function (k) {
          d.spots.forEach(function (_, i) { d.spots[i] = V.lerp(startSpots[i], chainPts[i], ease(k)); });
        });
        if (id !== runId) return;
        for (let i = 1; i < chainPts.length; i++) {
          S.cat.moving = true;
          S.cat.flip = chainPts[i].x < chainPts[i - 1].x;
          const a = chainPts[i - 1], b = chainPts[i];
          await tween(V.dist(a, b) / 6, function (k) { S.cat.pos = V.lerp(a, b, k); });
          if (id !== runId) return;
        }
        S.cat.moving = false;
        S.treasure = { pos: d.target, open: true };
      } else {
        const d = G.data;
        const from = HOME;
        await tween(0.8, function (k) { G.anim = { offset: V.lerp(from, d.B, ease(k)) }; });
        if (id !== runId) return;
        S.cat.pos = d.B;
        S.cat.moving = true;
        S.cat.flip = d.A.x < d.B.x;
        await tween(V.dist(d.A, d.B) / 5, function (k) { S.cat.pos = V.lerp(d.B, d.A, k); });
        if (id !== runId) return;
        S.cat.moving = false;
        S.treasure = { pos: d.A, open: true };
      }
      S.cat.pose = 'happy';
      S.cat.flip = false;
      const label = pts === 3 ? 'בניסיון ראשון!' : 'נמצא!';
      gameFeedback(label + ' ' + pts + ' מתוך 3 נקודות בשלב.', 'good');
      U.burst(canvasEl, 24);
      PHY.mascot.say(G.level === 2 ? 'A − B מוביל מהקצה של B לקצה של A. זה כל הקסם.' : 'אוצר! קיוויתי לתפוחים, אבל בסדר.', 'happy');
      G.phase = 'result';
      paintPips();
      if (G.level < 2) setAction('לשלב הבא', function () { startLevel(G.level + 1); });
      else setAction('לסיכום', finish);
    }

    function finish() {
      const total = G.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G.phase = 'done';
      paintPips();
      PHY.progress.setGame(opts.chapter, stars);
      if (opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: 'צברת ' + total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון ממנה אותך לקברניט המשלחת.' : stars === 2 ? 'יפה מאוד. עוד סיבוב ואתה בשלושה כוכבים.' : 'מצאת את כל האוצרות. בסיבוב הבא תמצא אותם מהר יותר.') }));
      U.Button(hud.final, 'שחק שוב (מפה חדשה)', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }

    function restart() {
      G.points = [];
      G.hint = false;
      startLevel(0);
    }

    function buildGame() {
      hud.levels = U.h('div', { class: 'game-levels' });
      hud.pips = LEVEL_NAMES.map(function (n) {
        const p = U.h('span', { class: 'game-pip', text: n });
        hud.levels.appendChild(p);
        return p;
      });
      hud.task = U.h('div', { class: 'game-task' });
      hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
      hud.action = U.h('button', { type: 'button', class: 'btn btn-primary', text: 'בדוק' });
      hud.main = U.h('div', { class: 'game-hud' });
      hud.final = U.h('div', { class: 'game-final', hidden: true });
      const root = U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]);
      hud.main.appendChild(hud.task);
      hud.readout = U.Readouts(hud.main, [
        { key: 'x', label: 'רכיב x (מזרח)', color: 'var(--c-displacement)' },
        { key: 'y', label: 'רכיב y (צפון)', color: 'var(--c-displacement)' },
        { key: 'len', label: 'מרחק מהבית', color: 'var(--c-displacement)' },
      ]);
      hud.main.appendChild(hud.feedback);
      const row = U.h('div', { class: 'sim-row' }, [hud.action]);
      hud.main.appendChild(row);
      controlsEl.appendChild(root);

      view.onTap(function (p) {
        if (G.phase === 'play' && G.level === 0) moveCursor(p);
      });
      view.drag({
        hit(p) {
          if (G.phase !== 'play' || G.level === 0 || !G.cursor) return null;
          return view.pxDist(p, G.cursor) < 34 ? 'tip' : null;
        },
        move(_, p) { moveCursor(p); },
      });
      canvasEl.setAttribute('tabindex', '0');
      canvasEl.setAttribute('role', 'application');
      canvasEl.setAttribute('aria-label', 'מפת האוצר. מקשי החצים מזיזים את הסמן, Enter מאשר.');
      canvasEl.addEventListener('keydown', function (e) {
        const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        if (dirs[e.key] && G.phase === 'play') {
          e.preventDefault();
          const c = G.cursor || HOME;
          moveCursor(V.v(c.x + dirs[e.key][0], c.y + dirs[e.key][1]));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (!hud.action.disabled && !hud.main.hidden) hud.action.click();
        }
      });
      restart();
    }

    function renderGame() {
      view.clear();
      view.grid(1, { majorEvery: 5 });
      drawCompass();
      const d = G.data;
      if (!d) return;
      if (G.level === 0) {
        drawLegs();
        drawResults();
        drawHome();
        if (S.treasure) drawChest(S.treasure.pos, true);
        if (G.cursor && G.phase === 'play') {
          const c = G.cursor;
          const a = 7 / view.scale;
          view.line(c.x - a, c.y - a, c.x + a, c.y + a, { color: C.apple, width: 4 });
          view.line(c.x - a, c.y + a, c.x + a, c.y - a, { color: C.apple, width: 4 });
          view.circle(c.x, c.y, 14 + Math.sin(S.t * 5) * 2, { px: true, color: C.apple, width: 2, alpha: 0.5 });
        }
        drawCat();
      } else if (G.level === 1) {
        d.vecs.forEach(function (v, i) {
          const a = d.spots[i];
          view.arrow(a.x, a.y, a.x + v.x, a.y + v.y, { color: C.displacement, width: 3.5, alpha: 0.72, label: NAMES[i], labelGap: 14 });
        });
        drawHome();
        if (S.treasure) drawChest(S.treasure.pos, true);
        drawPlayerArrow(V.v(0, 0));
        drawCat();
      } else {
        drawHome();
        view.arrow(0, 0, d.A.x, d.A.y, { color: C.displacement, width: 3.5, alpha: 0.72, label: 'A', labelGap: 14 });
        view.arrow(0, 0, d.B.x, d.B.y, { color: C.displacement, width: 3.5, alpha: 0.72, label: 'B', labelGap: 14 });
        if (G.hint) {
          view.arrow(d.A.x, d.A.y, d.A.x - d.B.x, d.A.y - d.B.y, { color: C.displacement, width: 3, dash: [7, 6], label: '−B', alpha: 0.85 });
        }
        if (S.treasure) drawChest(S.treasure.pos, S.treasure.open);
        drawPlayerArrow(G.anim ? G.anim.offset : V.v(0, 0));
        if (G.phase !== 'play') drawCat();
        else PHY.mascot.draw(view, d.B.x, d.B.y, { pose: 'thinking', px: 40 });
      }
      if (G.level === 1 && G.hint && G.phase === 'play') {
        view.screenText(view.w / 2, view.h - 16, 'x כולל: ' + F.num(d.target.x) + " מ'", { size: 13, weight: 700, pill: true });
      }
    }
    function drawPlayerArrow(off) {
      if (!G.cursor) return;
      const c = G.cursor;
      view.arrow(off.x, off.y, off.x + c.x, off.y + c.y, { color: C.displacement, width: 5.5, label: G.level === 1 ? 'R' : 'A−B', labelGap: 16, labelSide: -1 });
      if (G.phase === 'play') {
        view.circle(c.x, c.y, 12 + Math.sin(S.t * 5) * 2, { px: true, color: C.displacement, width: 2.5, alpha: 0.6 });
        view.circle(c.x, c.y, 7, { px: true, fill: C.surface, color: C.displacement, width: 3 });
      }
    }

    /* ---------- Loop + API ---------- */
    const render = opts.mode === 'free' ? renderFree : opts.mode === 'game' ? renderGame : renderWalk;
    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        cancelTweens();
        if (opts.mode === 'game') restart();
        else if (opts.mode === 'free') {
          FR.vecs = (opts.vectors || [V.v(4, 1.5), V.v(1, 3)]).slice();
          S.free_walking = false;
          freeUpdate();
        } else {
          clearScene();
          if (walkLog) walkLog.innerHTML = '';
        }
        loop.requestRender();
      },
      setParam(name, value) {
        if (name === 'showComponents') FR.showComp = !!value;
        if (name === 'vectors') { FR.vecs = value.slice(); if (opts.mode === 'free') freeUpdate(); }
        if (name === 'treasure') S.treasure = value;
        if (name === 'caption') S.caption = value;
        loop.requestRender();
      },
      getState() {
        if (opts.mode === 'free') {
          const pts = chain();
          return { vectors: FR.vecs.slice(), resultant: pts[pts.length - 1] };
        }
        if (opts.mode === 'game') {
          return { level: G.level, phase: G.phase, attempts: G.attempts, points: G.points.slice(), target: G.data && G.data.target, cursor: G.cursor };
        }
        return { pos: S.cat.pos, walked: S.walked, displacement: V.dist(S.cat.pos, HOME) };
      },
      play,
      /* Game test hooks: the same paths a player's input takes. */
      setCursor: moveCursor,
      submit,
    };

    if (opts.mode === 'free') { buildFree(); freeUpdate(); }
    if (opts.mode === 'game') buildGame();
    if (opts.mode === 'walk') updateWalkReadouts();
    return api;
  };
})();

/* PHY.sims.spaceReturn: the game "חזרה לחללית". Newton floats with three items. Each throw obeys momentum:
   the cat's velocity changes by -(m / M) u, where M is what is left of him and u is the throw's speed as seen
   from the cat just before the throw.
   Level 1: everything on one line. Level 2: a drift to the side and a 2D aim. Level 3: the ship is moving too.
   He must reach the door before the air runs out, slower than the safe speed relative to the door.
   Points per level: items kept (0-2), plus 1 for a first attempt. Nine points are possible.
   8+ gives 3 stars, 5+ gives 2, anything that finishes gives 1. Numbers are random. Each level is checked to be winnable.
   opts: {chapter, section, onDone(stars, total), rng}.
   API for tests: choose(i), setAim(deg, speed), throwItem(), advance(s), next(), retry(), restart(), getState(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, K = PHY.ch07, G2 = PHY.ch02;
  const PU = K.PU;
  const WORLD = { xMin: -7, xMax: 30, yMin: -13.5, yMax: 13.5 };
  const CAT = 10;
  const DOCK_R = 2.6;
  const U_MIN = 1, U_MAX = 20;
  const RATE = 1.7;
  const NAMES = ['שלב 1: בקו ישר', 'שלב 2: לאיזה כיוון?', 'שלב 3: החללית זזה'];
  const RAD = Math.PI / 180;

  PHY.sims.spaceReturn = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ rng: Math.random }, opts || {});
    const rnd = (a, b) => a + (b - a) * opts.rng();
    const rint = (a, b) => a + Math.floor(opts.rng() * (b - a + 1));
    const view = PHY.canvas.create(canvasEl, { world: WORLD, aspect: 1.37, minHeight: 280, maxHeight: 520 });
    const G = { i: 0, level: null, phase: 'aim', sel: 1, u: 10, ang: 0, points: [], attempt: 1, stars: null, caption: '', pose: 'thinking', ghost: [], total: 0 };
    const hud = {};

    /* ---------- levels ---------- */
    function items() {
      return [
        { name: 'תפוח', kind: 'apple', m: rint(1, 2) * 0.5 },
        { name: 'מפתח', kind: 'wrench', m: rint(3, 5) * 0.5 },
        { name: 'ארגז', kind: 'box', m: rint(4, 6) },
      ];
    }
    /* Can one throw of one item win? Used only to refuse a level that cannot be solved. */
    function winnable(L) {
      const M0 = CAT + L.items.reduce(function (a, b) { return a + b.m; }, 0);
      const dx = L.shipX - L.catX, dy = L.shipY - L.catY;
      for (let t = 2; t < L.air; t += 0.5) {
        const vx = (dx + L.shipVx * t) / t, vy = (dy + L.shipVy * t) / t;
        const rel = Math.hypot(vx - L.shipVx, vy - L.shipVy);
        if (rel > L.safe * 0.9) continue;
        const need = Math.hypot(vx - L.v0x, vy - L.v0y);
        for (let k = 0; k < 3; k++) {
          const m = L.items[k].m;
          const u = (need * (M0 - m)) / m;
          if (u >= U_MIN && u <= U_MAX * 0.95) return true;
        }
      }
      return false;
    }
    function makeLevel(i) {
      for (let tries = 0; tries < 300; tries++) {
        let L;
        if (i === 0) {
          const D = rint(7, 11) * 2;
          L = { catX: D, catY: 0, v0x: 0, v0y: 0, shipX: 0, shipY: 0, shipVx: 0, shipVy: 0, safe: rint(5, 7) * 0.5, air: Math.round(D / rnd(0.95, 1.2)), line: true };
        } else if (i === 1) {
          const sy = rint(-7, 7);
          const cy = rint(-9, 9);
          const sign = cy >= sy ? 1 : -1;
          const sp = rint(2, 4) * 0.25;
          L = { catX: rint(9, 11) * 2, catY: cy, v0x: rnd(-0.25, 0.25), v0y: sign * sp, shipX: 0, shipY: sy, shipVx: 0, shipVy: 0, safe: rint(6, 8) * 0.5, air: rint(16, 20), line: false };
          if (Math.abs(cy - sy) < 4) continue;
        } else {
          const dir = opts.rng() < 0.5 ? 1 : -1;
          const vs = rint(3, 5) * 0.2;
          const air = rint(16, 20);
          const sy = -dir * rint(6, 9);
          L = { catX: rint(9, 11) * 2, catY: rint(-8, 8), v0x: 0, v0y: 0, shipX: 0, shipY: sy, shipVx: 0, shipVy: dir * vs, safe: rint(6, 8) * 0.5, air: air, line: false };
          if (Math.abs(sy + L.shipVy * air) > 12) continue;
        }
        L.items = items();
        if (winnable(L)) return L;
      }
      throw new Error('spaceReturn: no winnable level');
    }

    /* ---------- state ---------- */
    function startAttempt() {
      const L = G.level;
      G.cat = { x: L.catX, y: L.catY, vx: L.v0x, vy: L.v0y };
      G.ship = { x: L.shipX, y: L.shipY };
      G.items = L.items.map(function (it) { return Object.assign({}, it, { used: false }); });
      G.mass = CAT + L.items.reduce(function (a, b) { return a + b.m; }, 0);
      G.flown = [];
      G.trail = [];
      G.nextTrail = 0;
      G.air = L.air;
      G.t = 0;
      G.phase = 'aim';
      G.throws = 0;
      G.pose = 'thinking';
      G.caption = '';
      G.sel = 1;
      G.u = 10;
      G.ang = L.line ? 180 : Math.round(defaultAngle());
      G.minDist = Infinity;
      G.dist0 = Math.hypot(L.catX - L.shipX, L.catY - L.shipY);
      syncControls();
      paintItems();
      paintAction();
      feedback('', '');
    }
    function defaultAngle() {
      const L = G.level;
      const a = Math.atan2(L.catY - L.shipY, L.catX - L.shipX) / RAD;
      return ((a % 360) + 360) % 360;
    }
    function startLevel(i) {
      G.i = i;
      G.level = makeLevel(i);
      G.attempt = 1;
      G.ghost = [];
      hud.main.hidden = false;
      hud.final.hidden = true;
      startAttempt();
      paintPips();
      setTask();
      loop.requestRender();
    }
    function restart() {
      G.points = [];
      G.stars = null;
      startLevel(0);
    }
    function setTask() {
      const L = G.level;
      const air = F.unit(L.air, 's', 0), safe = F.unit(L.safe, 'ms', 1);
      if (G.i === 0) hud.task.textContent = 'החללית במרחק ' + F.unit(L.catX, 'm', 0) + '. האוויר מספיק ל-' + air + ', והדלת סופגת עד ' + safe + '. מה זורקים, כמה חזק, ולאן?';
      else if (G.i === 1) hud.task.textContent = 'ניוטון כבר נסחף הצידה, אז זריקה ישר אחורה תחטיא. אוויר ל-' + air + ', דלת עד ' + safe + '. אפשר לגרור את החץ או להשתמש בסליידרים.';
      else hud.task.textContent = 'החללית נעה ב-' + F.unit(Math.abs(L.shipVy), 'ms', 1) + ', אז מכוונים למקום שבו היא תהיה. אוויר ל-' + air + ', והדלת סופגת עד ' + safe + ' ביחס אליה.';
    }

    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === G.i && G.phase !== 'done' ? ' is-now' : '') + (G.points[j] !== undefined ? ' is-done' : '');
        p.textContent = NAMES[j] + (G.points[j] !== undefined ? ' (' + G.points[j] + ')' : '');
      });
    }
    function feedback(text, kind) {
      hud.feedback.textContent = text;
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function paintItems() {
      hud.itemBtns.forEach(function (b, k) {
        const it = G.items[k];
        b.textContent = it.name + ' ' + F.unit(it.m, 'kg', it.m % 1 ? 1 : 0);
        b.disabled = it.used || G.phase === 'won' || G.phase === 'lost';
        b.classList.toggle('btn-primary', k === G.sel && !it.used);
      });
    }
    function selectable() {
      if (G.items[G.sel] && !G.items[G.sel].used) return;
      const k = G.items.findIndex(function (it) { return !it.used; });
      if (k >= 0) G.sel = k;
    }
    function syncControls() {
      hud.speed.set(G.u);
      hud.angle.set(G.ang);
      hud.angle.el.hidden = !!G.level.line;
      hud.dirRow.hidden = !G.level.line;
      hud.toShip.classList.toggle('btn-primary', G.level.line && G.ang === 180);
      hud.away.classList.toggle('btn-primary', G.level.line && G.ang === 0);
    }
    function paintAction() {
      const flying = G.phase === 'aim' || G.phase === 'fly';
      const noneLeft = G.items && G.items.every(function (it) { return it.used; });
      hud.action.disabled = false;
      if (flying) {
        hud.action.textContent = 'לזרוק!';
        hud.action.onclick = function () { throwItem(); };
        hud.action.disabled = noneLeft;
      } else if (G.phase === 'lost') {
        hud.action.textContent = 'עוד ניסיון';
        hud.action.onclick = retry;
      } else if (G.phase === 'won') {
        hud.action.textContent = G.i < 2 ? 'לשלב הבא' : 'לסיכום';
        hud.action.onclick = function () { if (G.i < 2) startLevel(G.i + 1); else finish(); };
      }
      hud.again.hidden = !flying || G.phase === 'aim';
    }

    /* ---------- throwing ---------- */
    function dirNow() { return { x: Math.cos(G.ang * RAD), y: Math.sin(G.ang * RAD) }; }
    function recoilOf(k) {
      const it = G.items[k];
      const after = G.mass - it.m;
      const d = dirNow();
      return { x: -(it.m / after) * G.u * d.x, y: -(it.m / after) * G.u * d.y };
    }
    function throwItem() {
      if (G.phase !== 'aim' && G.phase !== 'fly') return false;
      const it = G.items[G.sel];
      if (!it || it.used) return false;
      const d = dirNow();
      const dv = recoilOf(G.sel);
      G.flown.push({ kind: it.kind, x: G.cat.x, y: G.cat.y, vx: G.cat.vx + G.u * d.x, vy: G.cat.vy + G.u * d.y, rot: 0 });
      G.cat.vx += dv.x;
      G.cat.vy += dv.y;
      G.mass -= it.m;
      it.used = true;
      G.throws++;
      if (G.phase === 'aim') G.phase = 'fly';
      G.pose = 'flying';
      selectable();
      paintItems();
      paintAction();
      feedback('', '');
      return true;
    }

    function shipV() { return { x: G.level.shipVx, y: G.level.shipVy }; }
    function relSpeed() {
      const s = shipV();
      return Math.hypot(G.cat.vx - s.x, G.cat.vy - s.y);
    }
    function distToDoor() { return Math.hypot(G.cat.x - G.ship.x, G.cat.y - G.ship.y); }

    function step(dt) {
      if (G.phase !== 'fly') return;
      const h = dt * RATE;
      G.t += h;
      G.air -= h;
      G.cat.x += G.cat.vx * h;
      G.cat.y += G.cat.vy * h;
      G.ship.x += G.level.shipVx * h;
      G.ship.y += G.level.shipVy * h;
      G.flown.forEach(function (f) { f.x += f.vx * h; f.y += f.vy * h; f.rot += h * 300; });
      if (G.t >= G.nextTrail) { G.trail.push({ x: G.cat.x, y: G.cat.y }); G.nextTrail += 0.5; }
      const dist = distToDoor();
      G.minDist = Math.min(G.minDist, dist);
      if (dist <= DOCK_R) { arrive(); return; }
      const off = G.cat.x > WORLD.xMax + 3 || G.cat.x < WORLD.xMin - 3 || Math.abs(G.cat.y) > WORLD.yMax + 3;
      if (off) { lose('off'); return; }
      if (G.air <= 0) { G.air = 0; lose('air'); return; }
      /* Out of items and moving away from the door: there is no point in waiting. */
      const s = shipV();
      const closing = (G.ship.x - G.cat.x) * (G.cat.vx - s.x) + (G.ship.y - G.cat.y) * (G.cat.vy - s.y);
      if (closing < 0 && G.items.every(function (it) { return it.used; }) && G.t > 0.6) lose('away');
    }

    function arrive() {
      const rel = relSpeed();
      if (rel <= G.level.safe) win(rel);
      else lose('crash', rel);
    }
    function win(rel) {
      const kept = G.items.filter(function (it) { return !it.used; }).length;
      const pts = Math.min(3, kept + (G.attempt === 1 ? 1 : 0));
      G.points[G.i] = Math.max(G.points[G.i] || 0, pts);
      G.phase = 'won';
      G.pose = 'happy';
      G.caption = 'בפנים! ' + pts + ' מתוך 3 נקודות';
      const keptText = kept === 2 ? 'נשארו 2 פריטים.' : kept === 1 ? 'נשאר פריט אחד.' : 'לא נשאר כלום, אבל הוא בפנים.';
      feedback('הגיע ב-' + F.unit(rel, 'ms', 1) + ', עם ' + F.unit(Math.max(0, G.air), 's', 0) + ' אוויר. ' + keptText, 'good');
      U.burst(canvasEl, 26);
      PHY.mascot.say(G.i === 2 ? 'חללית זזה, חתול זז, ועדיין נכנסתי. תזכירו לי לא לצאת שוב.' : 'בית! איפה התפוחים?', 'happy');
      paintPips();
      paintItems();
      paintAction();
    }
    function lose(why, rel) {
      G.phase = 'lost';
      G.lastWhy = why;
      G.pose = why === 'crash' ? 'dizzy' : 'falling';
      G.ghost = G.trail.slice();
      const L = G.level;
      let text;
      if (why === 'crash') {
        G.caption = 'בום!';
        text = 'פגע בדלת ב-' + F.unit(rel, 'ms', 1) + ', והיא סופגת עד ' + F.unit(L.safe, 'ms', 1) + '. פחות תנע בזריקה, או לשמור פריט ולזרוק אותו אל החללית כדי לבלום.';
      } else {
        const s = shipV();
        const toX = G.ship.x - G.cat.x, toY = G.ship.y - G.cat.y;
        const closing = toX * (G.cat.vx - s.x) + toY * (G.cat.vy - s.y);
        if (closing <= 0 && G.minDist >= G.dist0 - 1.5) {
          G.caption = 'הלך לאיבוד';
          text = G.level.line && G.cat.vx > 0
            ? 'ניוטון התרחק: הוא תמיד נע הפוך לפריט. צריך לזרוק הרחק מהחללית.'
            : 'ניוטון התרחק במקום להתקרב. הוא נע הפוך לפריט, אז מכוונים את הזריקה הרחק מהמקום שאליו רוצים להגיע.';
        } else if (closing > 0 && why === 'air') {
          G.caption = 'נגמר האוויר';
          text = 'האוויר נגמר, ' + F.unit(distToDoor(), 'm', 0) + ' מהחללית. הוא נע ב-' + F.unit(relSpeed(), 'ms', 1) + ': איטי מדי. פריט כבד יותר, או זריקה חזקה יותר.';
        } else {
          const cross = (G.cat.vx - s.x) * (G.ship.y - G.cat.y) - (G.cat.vy - s.y) * (G.ship.x - G.cat.x);
          G.caption = 'החטיא';
          text = 'החטיא את הדלת ב-' + F.unit(Math.max(0, G.minDist - DOCK_R), 'm', 0) + '. כדאי ' + (cross > 0 ? 'להגדיל' : 'להקטין') + ' קצת את זווית הזריקה.';
        }
      }
      feedback(text, 'bad');
      if (G.attempt === 2) PHY.mascot.say('האוויר פה מריח מפתח ברגים. עוד פעם, בעדינות.', 'dizzy');
      paintItems();
      paintAction();
    }
    function retry() {
      G.attempt++;
      startAttempt();
      loop.requestRender();
    }
    function finish() {
      const total = G.points.reduce(function (a, b) { return a + b; }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      G.stars = stars;
      G.total = total;
      G.phase = 'done';
      paintPips();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      const msg = stars === 3 ? 'ניוטון שמר כמעט את כל הציוד, ומסרב להחזיר את מפתח הברגים. אפילו לך.' : stars === 2 ? 'הוא חזר, וגם הציוד ברובו. עוד סיבוב, ופחות פריטים ימריאו לחלל.' : 'הוא חזר, וזה מה שחשוב. הציוד עדיין שם בחוץ, במהירות קבועה.';
      hud.final.appendChild(U.h('div', { class: 'game-task', text: total + ' מתוך 9 נקודות. ' + msg }));
      U.Button(hud.final, 'עוד סיבוב, מספרים חדשים', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }

    /* ---------- drawing ---------- */
    function drawItem(kind, px, py, rot, k) {
      k = k || 1;
      if (kind === 'apple') { G2.drawApple(view, px, py, 7 * k); return; }
      if (kind === 'wrench') { K.wrench(view, px, py, rot, 24 * k); return; }
      const ctx = view.ctx;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(((rot || 0) * Math.PI) / 180);
      ctx.fillStyle = C.accent;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.rect(-10 * k, -7 * k, 20 * k, 14 * k);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const AIM_K = 0.42; /* meters of arrow per m/s of throw */
    function aimTip() {
      const d = dirNow();
      return { x: G.cat.x + G.u * AIM_K * d.x, y: G.cat.y + G.u * AIM_K * d.y };
    }

    /* The velocity label, just past the arrow's tip and outside the helmet. */
    function labelV(vx, vy) {
      const sp = Math.hypot(vx, vy);
      if (sp < 0.02) return;
      const reach = Math.max(sp * 2.2, (view.w < 420 ? 24 : 34) / view.scale) + 12 / view.scale;
      view.text(G.cat.x + (vx / sp) * reach, G.cat.y + (vy / sp) * reach, 'v', { size: 13, weight: 700, color: C.velocity, halo: true });
    }

    function render() {
      const L = G.level;
      const small = view.w < 420;
      view.clear();
      K.stars(view);
      /* Ship */
      const k = small ? 0.55 : 0.82;
      if (L.shipVy) {
        const y1 = L.shipY + L.shipVy * L.air;
        view.line(0.1, L.shipY, 0.1, y1, { color: C.soft, width: 1.5, dash: [4, 6] });
        view.circle(0.1, y1, 4, { px: true, fill: C.soft });
      }
      K.ship(view, view.sx(G.ship.x), view.sy(G.ship.y), k);
      view.circle(G.ship.x, G.ship.y, DOCK_R, { color: C.good, width: 2, dash: [5, 5] });

      /* Last attempt, so a wrong try shows what happened. */
      G.ghost.forEach(function (q) { view.circle(q.x, q.y, 2, { px: true, fill: C.soft, alpha: 0.55 }); });
      G.trail.forEach(function (q) { view.circle(q.x, q.y, 2.4, { px: true, fill: C.ink, alpha: 0.5 }); });

      /* Items in flight */
      G.flown.forEach(function (f) {
        const px = view.sx(f.x), py = view.sy(f.y);
        if (px > -30 && px < view.w + 30 && py > -30 && py < view.h + 30) drawItem(f.kind, px, py, f.rot, small ? 0.85 : 1.1);
      });

      /* The cat, the aim, and what the throw would do */
      const catPx = small ? 40 : 56;
      K.spaceCat(view, G.cat.x, G.cat.y, { pose: G.pose, px: catPx, flipX: true });
      const aiming = (G.phase === 'aim' || G.phase === 'fly') && G.items[G.sel] && !G.items[G.sel].used;
      if (aiming) {
        const tip = aimTip();
        view.arrow(G.cat.x, G.cat.y, tip.x, tip.y, { color: C.velocity, width: 3, label: 'u', labelGap: 12 });
        view.circle(tip.x, tip.y, 9, { px: true, fill: C.surface, color: C.velocity, width: 2.5 });
        drawItem(G.items[G.sel].kind, view.sx(tip.x), view.sy(tip.y), 0, small ? 0.6 : 0.8);
        const dv = recoilOf(G.sel);
        const nx = G.cat.vx + dv.x, ny = G.cat.vy + dv.y;
        view.line(G.cat.x, G.cat.y, G.cat.x + nx * 3, G.cat.y + ny * 3, { color: C.velocity, width: 2, dash: [4, 5], alpha: 0.75 });
        view.arrow(G.cat.x, G.cat.y, G.cat.x + nx * 2.2, G.cat.y + ny * 2.2, { color: C.velocity, width: 4 });
        labelV(nx, ny);
      } else if (G.phase === 'fly') {
        view.arrow(G.cat.x, G.cat.y, G.cat.x + G.cat.vx * 2.2, G.cat.y + G.cat.vy * 2.2, { color: C.velocity, width: 4 });
        labelV(G.cat.vx, G.cat.vy);
      }

      /* The air bar */
      const bw = small ? 110 : 170;
      const frac = Math.max(0, G.air) / L.air;
      K.bar(view, 10, 10, bw, 12, C.grid);
      K.bar(view, 10, 10, bw * frac, 12, frac < 0.25 ? C.bad : C.good);
      view.screenText(10 + bw + 8, 16, 'אוויר', { size: 11, weight: 700, align: 'left' });

      K.caption(view, G.caption, 40);

      const dv = aiming ? recoilOf(G.sel) : { x: 0, y: 0 };
      const afterV = Math.hypot(G.cat.vx + dv.x, G.cat.vy + dv.y);
      hud.out.set('air', F.unit(Math.max(0, G.air), 's', 1));
      hud.out.set('v', F.unit(Math.hypot(G.cat.vx, G.cat.vy), 'ms', 2));
      hud.out.set('after', aiming ? F.unit(afterV, 'ms', 2) : '...');
      hud.out.set('dist', F.unit(Math.max(0, distToDoor() - DOCK_R), 'm', 1));
      hud.out.set('p', aiming ? F.unit(G.items[G.sel].m * G.u, PU, 1) : '...');
      hud.out.set('att', String(G.attempt));
    }

    const loop = PHY.SimLoop({ view, step, render });

    /* ---------- HUD ---------- */
    hud.levels = U.h('div', { class: 'game-levels' });
    hud.pips = NAMES.map(function (n) { const p = U.h('span', { class: 'game-pip', text: n }); hud.levels.appendChild(p); return p; });
    hud.main = U.h('div', { class: 'game-hud' });
    hud.final = U.h('div', { class: 'game-final', hidden: true });
    hud.task = U.h('div', { class: 'game-task' });
    hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]));
    hud.main.appendChild(hud.task);
    const itemRow = U.h('div', { class: 'sim-row' });
    hud.itemBtns = [0, 1, 2].map(function (k) {
      return U.Button(itemRow, '', function () { if (G.items[k] && !G.items[k].used) { G.sel = k; paintItems(); loop.requestRender(); } });
    });
    hud.main.appendChild(itemRow);
    hud.dirRow = U.h('div', { class: 'sim-row' });
    hud.toShip = U.Button(hud.dirRow, 'לזרוק אל החללית', function () { G.ang = 180; syncControls(); loop.requestRender(); });
    hud.away = U.Button(hud.dirRow, 'לזרוק הרחק ממנה', function () { G.ang = 0; syncControls(); loop.requestRender(); });
    hud.main.appendChild(hud.dirRow);
    hud.angle = U.Slider(hud.main, {
      label: 'כיוון הזריקה (0° ימינה, 90° למעלה)', min: 0, max: 359, step: 1, value: 0, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { G.ang = v; loop.requestRender(); },
    });
    hud.speed = U.Slider(hud.main, {
      label: 'מהירות הזריקה', min: U_MIN, max: U_MAX, step: 0.5, value: 10, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { G.u = v; loop.requestRender(); },
    });
    hud.out = U.Readouts(hud.main, [
      { key: 'p', label: 'תנע הפריט ביחס לניוטון', color: 'var(--c-velocity)' },
      { key: 'after', label: 'מהירות אחרי הזריקה', color: 'var(--c-velocity)' },
      { key: 'v', label: 'מהירות עכשיו', color: 'var(--c-velocity)' },
      { key: 'dist', label: 'עד הדלת', color: 'var(--c-displacement)' },
      { key: 'air', label: 'אוויר' },
      { key: 'att', label: 'ניסיון' },
    ]);
    hud.main.appendChild(hud.feedback);
    const actRow = U.h('div', { class: 'sim-row' });
    hud.action = U.Button(actRow, 'לזרוק!', function () {}, { primary: true });
    hud.again = U.Button(actRow, 'להתחיל מחדש', function () { retry(); }, { ghost: true });
    hud.main.appendChild(actRow);

    /* Aim by dragging the item at the tip of the arrow. */
    view.drag({
      hit(p) {
        if (G.phase !== 'aim' && G.phase !== 'fly') return null;
        const tip = aimTip();
        if (view.pxDist(p, tip) < 30) return { tip: true };
        return view.pxDist(p, G.cat) < 30 ? { tip: true } : null;
      },
      move(h, p) {
        const dx = p.x - G.cat.x, dy = p.y - G.cat.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.2) return;
        let a = Math.atan2(dy, dx) / RAD;
        a = ((a % 360) + 360) % 360;
        if (G.level.line) G.ang = a > 90 && a < 270 ? 180 : 0;
        else G.ang = Math.round(a) % 360;
        G.u = Math.max(U_MIN, Math.min(U_MAX, Math.round((d / AIM_K) * 2) / 2));
        syncControls();
      },
    });

    startLevel(0);
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam(name, v) {
        if (name === 'angle') G.ang = v;
        if (name === 'speed') G.u = v;
        syncControls();
        loop.requestRender();
      },
      getState() {
        const L = G.level;
        return {
          level: G.i, phase: G.phase, attempt: G.attempt, points: G.points.slice(), stars: G.stars, total: G.total,
          cat: Object.assign({}, G.cat), ship: Object.assign({}, G.ship), shipV: shipV(), mass: G.mass, air: G.air,
          safe: L.safe, airStart: L.air, dockR: DOCK_R, line: L.line, rel: relSpeed(), throws: G.throws, t: G.t,
          items: G.items.map(function (it) { return { m: it.m, used: it.used }; }), uMin: U_MIN, uMax: U_MAX, why: G.lastWhy,
          angle: G.ang, speed: G.u, sel: G.sel,
        };
      },
      choose(k) { if (G.items[k] && !G.items[k].used) { G.sel = k; paintItems(); } },
      setAim(deg, speed) {
        G.ang = ((Math.round(deg) % 360) + 360) % 360;
        G.u = Math.max(U_MIN, Math.min(U_MAX, Math.round(speed * 2) / 2));
        syncControls();
      },
      throwItem,
      advance(seconds) {
        for (let t = 0; t < seconds && G.phase === 'fly'; t += 1 / 120) step(1 / 120);
      },
      next() { if (G.phase === 'won') hud.action.click(); },
      retry,
      restart,
      auditLevels(n) {
        let bad = 0;
        for (let i = 0; i < 3; i++) for (let k = 0; k < n; k++) { if (!winnable(makeLevel(i))) bad++; }
        return bad;
      },
    };
  };
})();

/* PHY.sims.catchTheApple: mark where the apple will be after t seconds, then let it go.
   Trains the feel that the distance fallen grows like t squared. 3 levels, 2 rounds each.
   Level 1: whole seconds. Level 2: half seconds. Level 3: thrown down at 10 m/s.
   opts: {chapter, section, onDone}. Test hooks: setMark(d), release() -> Promise, next(), getState(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const G_ACC = 10, DEPTH = 80, ROUNDS = 2;
  const LEVELS = [
    { name: 'שלב 1: שניות שלמות', times: [1, 2, 3], v0: 0 },
    { name: 'שלב 2: חצאי שניות', times: [0.5, 1.5, 2.5, 3.5], v0: 0 },
    { name: 'שלב 3: זריקה למטה', times: [1, 2, 3], v0: 10 },
  ];

  PHY.sims.catchTheApple = function (canvasEl, controlsEl, opts) {
    opts = opts || {};
    const view = PHY.canvas.create(canvasEl, { aspect: 1.35, minHeight: 420, maxHeight: 480 });
    const P = H2.pix(view);
    const S = { level: 0, round: 0, points: [], levelPts: 0, t: 0, target: 1, v0: 0, mark: null, phase: 'aim', queue: [], resolve: null, stars: null, lastPts: 0 };
    const fallen = (t) => S.v0 * t + 0.5 * G_ACC * t * t;

    const hud = H2.gameHud(controlsEl, LEVELS.map((l) => l.name));
    const slider = U.Slider(null, {
      label: 'הסימון שלך: כמה מטרים מהענף', min: 0, max: DEPTH, step: 0.5, value: 0, unit: 'm', digits: 1, color: 'var(--c-displacement)',
      onInput(v) { setMark(v); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const releaseBtn = U.Button(row, 'שחרר את התפוח', function () { release(); }, { primary: true, disabled: true });
    const nextBtn = U.Button(row, 'הבא', function () { next(); }, { primary: true });
    nextBtn.hidden = true;
    hud.main.appendChild(hud.task);
    hud.main.appendChild(slider.el);
    hud.main.appendChild(hud.feedback);
    hud.main.appendChild(row);

    function setMark(d) {
      if (S.phase !== 'aim') return;
      S.mark = Math.max(0, Math.min(DEPTH, Math.round(d * 2) / 2));
      slider.set(S.mark);
      releaseBtn.disabled = false;
      loop.requestRender();
    }

    function startLevel(i) {
      S.level = i;
      S.round = 0;
      S.levelPts = 0;
      S.queue = H2.shuffle(LEVELS[i].times).slice(0, ROUNDS);
      S.v0 = LEVELS[i].v0;
      hud.paint(S.level, S.points, false);
      startRound();
    }
    function startRound() {
      S.target = S.queue[S.round];
      S.t = 0;
      S.mark = null;
      S.phase = 'aim';
      slider.set(0);
      slider.setEnabled(true);
      releaseBtn.hidden = false;
      releaseBtn.disabled = true;
      nextBtn.hidden = true;
      hud.say('');
      const when = F.unit(S.target, 's', 1);
      hud.setTask(S.v0
        ? 'ניוטון זורק את התפוח ישר למטה במהירות ' + F.unit(S.v0, 'ms', 0) + ' (סיבוב ' + (S.round + 1) + ' מתוך ' + ROUNDS + '). איפה הוא יהיה אחרי <b>' + when + '</b>? הקש על הסרגל או הזז את הסליידר.'
        : 'התפוח נשמט מהענף (סיבוב ' + (S.round + 1) + ' מתוך ' + ROUNDS + '). איפה הוא יהיה אחרי <b>' + when + '</b>? הקש על הסרגל או הזז את הסליידר.');
      loop.requestRender();
    }
    function release() {
      if (S.phase !== 'aim' || S.mark === null) return Promise.resolve();
      S.phase = 'fall';
      S.t = 0;
      slider.setEnabled(false);
      releaseBtn.hidden = true;
      return new Promise(function (res) { S.resolve = res; });
    }
    function landed() {
      const truth = fallen(S.target);
      const err = Math.abs(truth - S.mark);
      const pts = err <= 2 ? 3 : err <= 5 ? 2 : err <= 10 ? 1 : 0;
      S.lastPts = pts;
      S.levelPts += pts;
      S.phase = 'result';
      const msg = 'התפוח עבר ' + F.unit(truth, 'm', 2) + ', ואתה סימנת ' + F.unit(S.mark, 'm', 1) + '. ';
      hud.say(msg + (pts === 3 ? 'תפיסה מושלמת! 3 נקודות.' : pts === 2 ? 'קרוב! 2 נקודות.' : pts === 1 ? 'נגעת בקצה. נקודה אחת.' : 'פספוס. המרחק גדל מהר יותר ממה שהאינטואיציה אומרת.'), pts >= 2 ? 'good' : 'bad');
      if (pts === 3) U.burst(canvasEl, 18);
      nextBtn.hidden = false;
      const more = S.round < ROUNDS - 1;
      nextBtn.textContent = more ? 'סיבוב הבא' : S.level < LEVELS.length - 1 ? 'לשלב הבא' : 'לסיכום';
      if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
    }
    function next() {
      if (S.phase !== 'result') return;
      if (S.round < ROUNDS - 1) { S.round++; startRound(); return; }
      S.points[S.level] = S.levelPts;
      if (S.level < LEVELS.length - 1) { startLevel(S.level + 1); return; }
      const total = S.points.reduce((a, b) => a + b, 0);
      const stars = total >= 14 ? 3 : total >= 9 ? 2 : 1;
      S.stars = stars;
      S.phase = 'done';
      hud.paint(-1, S.points, true);
      hud.showFinal(stars, 'צברת ' + total + ' מתוך 18 נקודות. ' + (stars === 3 ? 'ניוטון מסרב להשאיר תפוחים לידך.' : stars === 2 ? 'יפה. הראש כבר מתחיל לחשוב בריבועים.' : 'זכור: פי 2 זמן נותן פי 4 מרחק.'), restart);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() {
      S.points = [];
      S.stars = null;
      hud.showMain();
      startLevel(0);
    }

    function step(dt) {
      if (S.phase !== 'fall') return;
      S.t = Math.min(S.target, S.t + dt);
      if (S.t >= S.target - 1e-9) { S.t = S.target; landed(); }
    }

    function layout() {
      const top = 44, bottom = view.h - 14;
      return { top, bottom, Y: (d) => top + (d / DEPTH) * (bottom - top), D: (py) => ((py - top) / (bottom - top)) * DEPTH };
    }

    function render() {
      view.clear();
      const W = view.w;
      const L = layout();
      const left = 42, ax = left + (W - left) * 0.34;
      /* Ruler, 0 at the branch and growing downward. */
      P.line(left, L.top, left, L.bottom, { color: C.axis, width: 2 });
      for (let d = 0; d <= DEPTH; d += 10) {
        P.line(left - 5, L.Y(d), W - 8, L.Y(d), { color: C.grid, width: 1 });
        view.screenText(left - 9, L.Y(d), F.num(d, 0), { size: 11, color: C.soft, align: 'right' });
      }
      for (let d = 5; d < DEPTH; d += 10) P.line(left - 3, L.Y(d), left + 3, L.Y(d), { color: C.axis, width: 1 });
      view.screenText(6, 16, "מטרים מהענף", { size: 11, color: C.soft, align: 'left' });
      /* Branch and cat */
      P.line(left + 8, L.top - 8, W - 10, L.top - 16, { color: '#7A4B26', width: 7 });
      P.cat(W * 0.8, L.top - 12, { pose: 'onBranch', px: W < 420 ? 50 : 66 });

      const running = S.phase === 'fall' || S.phase === 'result';
      const t = running ? S.t : 0;
      /* Ghost apple at every whole second, so the widening gaps can be seen. */
      if (S.phase === 'fall' || S.phase === 'result') {
        for (let k = 1; k <= Math.floor(t + 1e-9); k++) {
          const d = fallen(k);
          H2.drawApple(view, ax, L.Y(d), 8, { alpha: 0.38 });
          if (S.phase === 'result') view.screenText(ax + 15, L.Y(d), F.num(k, 0) + " ש': " + F.unit(d, 'm', 0), { size: 11.5, weight: 700, color: C.soft, align: 'left', halo: true });
        }
      }
      /* Marker */
      if (S.mark !== null) {
        const my = L.Y(S.mark);
        P.line(left, my, W - 8, my, { color: C.displacement, width: 2.5, dash: [8, 5] });
        P.circle(W - 34, my, 11, { fill: C.displacement, color: C.surface, width: 2 });
        view.screenText(W - 52, my - 12, F.unit(S.mark, 'm', 1), { size: 13, weight: 800, color: C.displacement, align: 'right', halo: true });
      }
      /* Apple */
      const ay = L.Y(fallen(t));
      H2.drawApple(view, ax, ay, 11);
      if (S.phase === 'result') {
        view.screenText(ax - 16, ay, F.unit(fallen(t), 'm', 2), { size: 13, weight: 800, color: C.accent, halo: true, align: 'right' });
      }
      view.screenText(W * 0.42, 15, S.phase === 'fall' ? 't = ' + F.num(t, 2) + " ש'" : 'אחרי ' + F.unit(S.target, 's', 1), { size: 14, weight: 800, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    view.onTap(function (p) {
      if (S.phase !== 'aim') return;
      const L = layout();
      setMark(L.D(view.sy(p.y)));
    });
    view.drag({
      hit(p) {
        if (S.phase !== 'aim' || S.mark === null) return null;
        const L = layout();
        return Math.abs(view.sy(p.y) - L.Y(S.mark)) < 22 ? 'mark' : null;
      },
      move(_, p) { setMark(layout().D(view.sy(p.y))); },
    });

    restart();
    return {
      start: loop.start,
      stop: loop.stop,
      reset() { restart(); },
      setParam() {},
      getState() {
        return { level: S.level, round: S.round, phase: S.phase, target: S.target, v0: S.v0, truth: fallen(S.target), mark: S.mark, t: S.t, points: S.points.slice(), lastPts: S.lastPts, stars: S.stars };
      },
      setMark,
      release,
      next,
    };
  };
})();

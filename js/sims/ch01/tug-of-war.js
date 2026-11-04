/* PHY.sims.tugOfWar: משיכת חבל בשלושה. Three ropes pull on one knot (with the cat tied to it).
   Set the sizes so the resultant is 0. The knot sits where the springy ropes balance, so an unbalanced
   force visibly drags the cat toward the resultant. Force is always green.
   opts: {locked, onSolved(i)}. sim.setPuzzle(i), sim.animateForces([F1, F2, F3], seconds) -> Promise. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const V = PHY.vec, F = PHY.fmt, U = PHY.ui;
  const C = PHY.colors;

  /* Every puzzle has an exact (or within 1 N) solution reachable with the sliders. */
  const PUZZLES = [
    { angles: [0, 90, 233.13], start: [30, 40, 0] },          // 30, 40, 50
    { angles: [0, 120, 240], start: [20, 40, 30] },           // all equal
    { angles: [20, 160, 270], start: [50, 20, 10] },          // F, F, 0.68 F
    { angles: [0, 135, 270], start: [20, 30, 40] },           // F, 1.41 F, F
  ];
  const NAMES = ['א', 'ב', 'ג'];
  const K = 16;            // N per meter of knot displacement
  const ARROW = 0.075;     // meters of arrow per newton
    const TOL = 1;           // |R| below this counts as balanced

  PHY.sims.tugOfWar = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ locked: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -9, xMax: 9, yMin: -8.2, yMax: 8.2 },
      aspect: 1.35,
      minHeight: 300,
      maxHeight: 480,
    });
    const S = {
      puzzle: 0, forces: PUZZLES[0].start.slice(), angles: PUZZLES[0].angles.slice(),
      p: V.v(0, 0), v: V.v(0, 0), t: 0, tw: null, locked: opts.locked, wasBalanced: false, solved: {}, hasInteracted: false,
    };

    const sliders = NAMES.map(function (n, i) {
      return U.Slider(controlsEl, {
        label: 'חבל ' + n, min: 0, max: 70, step: 1, value: S.forces[i], unit: 'N', digits: 0, color: 'var(--c-force)',
        onInput(v) { S.forces[i] = v; S.hasInteracted = true; S.tw = null; updateOut(); },
      });
    });
    const out = U.Readouts(controlsEl, [
      { key: 'R', label: 'השקול של שלושת החבלים', color: 'var(--c-force)' },
      { key: 'state', label: 'מה קורה לניוטון' },
    ]);
    const row = U.h('div', { class: 'sim-row' });
    controlsEl.appendChild(row);
    const nextBtn = U.Button(row, 'חידה חדשה', function () {
      api.setPuzzle((S.puzzle + 1) % PUZZLES.length);
    });

    function resultant() {
      return V.sum(S.forces.map(function (f, i) { return V.polar(f, S.angles[i]); }));
    }
    function updateOut() {
      const R = resultant();
      const m = V.len(R);
      out.set('R', F.unit(m < 0.05 ? 0 : m, 'N', 1));
      out.set('state', m < TOL ? 'מאוזן. שלו.' : m < 15 ? 'נגרר קצת' : m < 40 ? 'נגרר בכוח' : 'עף!');
      const bal = m < TOL;
      if (bal && !S.wasBalanced && S.hasInteracted && !S.tw) {
        if (!S.solved[S.puzzle]) {
          S.solved[S.puzzle] = true;
          U.burst(canvasEl, 22);
          PHY.mascot.say('שקול אפס! אני לא זז. זה הכי קרוב למנוחה שהיה לי היום.', 'happy');
          if (opts.onSolved) opts.onSolved(S.puzzle);
        }
      }
      S.wasBalanced = bal;
      loop.requestRender();
    }

    function setLocked(v) {
      S.locked = v;
      sliders.forEach(function (s) { s.setEnabled(!v); });
      nextBtn.disabled = v;
    }

    function step(dt) {
      S.t += dt;
      if (S.tw) {
        const tw = S.tw;
        tw.t += dt;
        const k = Math.min(tw.t / tw.T, 1);
        const e = k * k * (3 - 2 * k);
        S.forces = tw.f0.map(function (f, i) { return f + (tw.f1[i] - f) * e; });
        sliders.forEach(function (s, i) { s.set(Math.round(S.forces[i])); });
        updateOut();
        if (k >= 1) {
          S.tw = null;
          tw.resolve();
        }
      }
      /* Damped spring toward the balance point: a soft, physical wobble. */
      const R = resultant();
      const m = 3, c = 14;
      const ax = (R.x - K * S.p.x - c * S.v.x) / m;
      const ay = (R.y - K * S.p.y - c * S.v.y) / m;
      S.v = V.v(S.v.x + ax * dt, S.v.y + ay * dt);
      S.p = V.v(S.p.x + S.v.x * dt, S.p.y + S.v.y * dt);
    }

    function render() {
      const R = resultant();
      const rm = V.len(R);
      const balanced = rm < TOL;
      view.clear();
      view.grid(2, {});

      S.angles.forEach(function (a, i) {
        const end = V.polar(8.1, a);
        const scaled = V.v(Math.max(-8.2, Math.min(8.2, end.x)), Math.max(-7.3, Math.min(7.3, end.y)));
        const taut = S.forces[i] / 70;
        const wobble = (1 - taut) * 0.3 * Math.sin(S.t * 3 + i);
        const mid = V.lerp(S.p, scaled, 0.5);
        const ctx = view.ctx;
        ctx.save();
        ctx.strokeStyle = '#A9743F';
        ctx.lineWidth = 3 + taut * 2.5;
        ctx.lineCap = 'round';
        ctx.setLineDash([9, 3]);
        ctx.beginPath();
        ctx.moveTo(view.sx(S.p.x), view.sy(S.p.y));
        ctx.quadraticCurveTo(view.sx(mid.x), view.sy(mid.y + wobble - (1 - taut) * 0.6), view.sx(scaled.x), view.sy(scaled.y));
        ctx.stroke();
        ctx.restore();
        view.circle(scaled.x, scaled.y, 15, { px: true, fill: C.surface, color: C.force, width: 3 });
        view.text(scaled.x, scaled.y, NAMES[i], { color: C.force, weight: 800, size: 14 });
      });

      /* Arrows start outside the cat so he never hides them. Radius and label size follow the canvas width. */
      const narrow = view.w < 420;
      const catR = (narrow ? 25 : 38) / view.scale;
      const fLabel = (f) => (narrow ? F.num(f, 0) + ' N' : F.unit(f, 'N', 0));
      S.angles.forEach(function (a, i) {
        if (S.forces[i] < 0.5) return;
        const from = V.add(S.p, V.polar(catR, a));
        const tip = V.add(from, V.polar(S.forces[i] * ARROW, a));
        view.arrow(from.x, from.y, tip.x, tip.y, { color: C.force, width: 4.5, label: fLabel(S.forces[i]), labelSize: 12.5, labelGap: narrow ? 12 : 16 });
      });

      const pose = balanced ? 'happy' : rm < 15 ? 'standing' : rm < 40 ? 'sliding' : 'dizzy';
      PHY.mascot.draw(view, S.p.x, S.p.y - 0.1, { pose, px: narrow ? 46 : 64, anchor: [0.5, 0.6], rot: Math.max(-16, Math.min(16, -S.p.x * 3.5)) });

      if (!balanced) {
        const from = V.add(S.p, V.scale(V.norm(R), catR));
        const tip = V.add(from, V.scale(R, ARROW));
        view.arrow(from.x, from.y, tip.x, tip.y, { color: C.force, width: 7, alpha: 0.5, dash: [8, 6], label: 'שקול', labelSide: -1, labelGap: narrow ? 13 : 18 });
      } else {
        view.screenText(view.w / 2, view.h - 20, 'שקול = 0', { color: C.force, weight: 800, size: 15, pill: true, pillBorder: C.force });
      }
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { api.setPuzzle(S.puzzle); },
      setPuzzle(i) {
        S.puzzle = i;
        S.tw = null;
        S.angles = PUZZLES[i].angles.slice();
        S.forces = PUZZLES[i].start.slice();
        sliders.forEach(function (s, j) { s.set(S.forces[j]); });
        S.wasBalanced = false;
        updateOut();
      },
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'forces') {
          S.forces = v.slice();
          sliders.forEach(function (s, j) { s.set(S.forces[j]); });
          updateOut();
        }
      },
      getState() {
        const R = resultant();
        return { forces: S.forces.slice(), angles: S.angles.slice(), resultant: R, magnitude: V.len(R), balanced: V.len(R) < TOL };
      },
      animateForces(f, T) {
        return new Promise(function (resolve) {
          S.tw = { t: 0, T: T || 1, f0: S.forces.slice(), f1: f.slice(), resolve };
        });
      },
      /* Wait for the knot to settle, in sim time. */
      hold(T) {
        return new Promise(function (resolve) {
          S.tw = { t: 0, T: T || 1, f0: S.forces.slice(), f1: S.forces.slice(), resolve };
        });
      },
    };
    setLocked(S.locked);
    updateOut();
    return api;
  };
})();

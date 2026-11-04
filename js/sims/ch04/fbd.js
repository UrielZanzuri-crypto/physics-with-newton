/* PHY.sims.fbd: free-body diagrams with real numbers.
   opts.mode 'builder': four scenes (on a table, a paw pressing, hanging, on a slope). The reader picks which forces act.
     A complete diagram shows the head-to-tail chain closing. API: setScene(key), choose(forceKey) -> {ok, complete}.
   opts.mode 'press': a 5 kg cat on a scale on a table, a paw presses. N = mg + F. play() -> Promise, setParam: hand, locked.
   opts.mode 'pull':  a 10 kg crate, a rope at 37° above the floor pulls with 50 N. N = mg - F sinθ. play(), setParam: rope, locked. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10, SLOPE = 37;
  const sin37 = 0.6, cos37 = 0.8;

  const SCENES = {
    table: { name: 'על שולחן', needs: ['gravity', 'normal'], support: 'השולחן' },
    press: { name: 'כף לוחצת', needs: ['gravity', 'normal', 'hand'], support: 'השולחן' },
    hang: { name: 'תלוי בחבל', needs: ['gravity', 'tension'], support: 'החבל' },
    slope: { name: 'על מדרון', needs: ['gravity', 'normal', 'friction'], support: 'המדרון' },
  };
  const CHIPS = [
    { key: 'gravity', text: 'כבידה' },
    { key: 'normal', text: 'כוח נורמלי' },
    { key: 'tension', text: 'מתיחות בחבל' },
    { key: 'hand', text: 'כף יד' },
    { key: 'friction', text: 'חיכוך' },
    { key: 'motion', text: 'כוח התנועה' },
    { key: 'reaction', text: '' },
  ];
  const WHY = {
    friction: {
      table: 'אף אחד לא מנסה להזיז אותו, אז לחיכוך אין נגד מה לעבוד.',
      press: 'הכף לוחצת ישר למטה, ושום דבר לא מנסה להזיז אותו הצידה. לחיכוך אין עבודה.',
      hang: 'חיכוך צריך משטח, והוא תלוי באוויר.',
    },
    tension: {
      table: 'אין כאן חבל. בדקנו.',
      press: 'יש כאן כף, אבל חבל אין.',
      slope: 'אין כאן חבל. אם היה, הוא כבר היה מתלונן.',
    },
    hand: {
      table: 'אף יד לא נוגעת בו כרגע, וזה בדיוק מה שהוא ביקש.',
      hang: 'הוא תלוי לבד. אף יד לא נוגעת בו.',
      slope: 'אף יד לא מחזיקה אותו. משהו אחר עוצר אותו מלהחליק.',
    },
    normal: { hang: 'נורמלי הוא כוח של משטח שדוחף. כאן אין משטח, רק חבל.' },
    motion: 'אין כוח כזה. תנועה היא לא כוח, והוא גם לא זז.',
    reaction: 'הכוח הזה קיים, אבל הוא פועל על מה שתומך בו, לא עליו. בדיאגרמה מציירים רק כוחות שפועלים על הגוף שלנו.',
  };

  /* All forces in newtons, as vectors, for the 5 kg cat. */
  function forcesOf(scene) {
    const mg = 5 * G;
    if (scene === 'table') return { gravity: { x: 0, y: -mg }, normal: { x: 0, y: mg } };
    if (scene === 'press') return { gravity: { x: 0, y: -mg }, hand: { x: 0, y: -20 }, normal: { x: 0, y: mg + 20 } };
    if (scene === 'hang') return { gravity: { x: 0, y: -mg }, tension: { x: 0, y: mg } };
    return {
      gravity: { x: 0, y: -mg },
      normal: { x: -mg * cos37 * sin37, y: mg * cos37 * cos37 },
      friction: { x: mg * sin37 * cos37, y: mg * sin37 * sin37 },
    };
  }

  PHY.sims.fbd = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = Object.assign({ mode: 'builder', locked: true }, opts || {});
    const mode = opts.mode;
    /* In 'pull' the floor sits higher, the same scale: mg is drawn at its full 100 N, and it reaches below the floor. */
    const WORLD = mode === 'pull' ? { xMin: -6, xMax: 6, yMin: -2, yMax: 7 } : { xMin: -6, xMax: 6, yMin: -0.7, yMax: 8.3 };
    const view = PHY.canvas.create(canvasEl, { world: WORLD, aspect: 1.32, minHeight: 300, maxHeight: 430 });
    const gate = K.gate();
    const S = { scene: 'table', chosen: { table: [], press: [], hang: [], slope: [] }, done: {}, hand: 0, rope: 0, ropeTarget: 50, phase: 'ready', t: 0, locked: opts.locked };
    const hud = {};

    if (mode === 'builder') {
      const tabs = U.h('div', { class: 'sim-row' });
      hud.tabs = {};
      Object.keys(SCENES).forEach(function (k) {
        hud.tabs[k] = U.Button(tabs, SCENES[k].name, function () { api.setScene(k); });
      });
      controlsEl.appendChild(tabs);
      controlsEl.appendChild(U.h('div', { class: 'small muted', text: 'אילו כוחות פועלים על ניוטון? לבחור את כולם, ורק אותם.' }));
      const chips = U.h('div', { class: 'sim-row' });
      hud.chips = {};
      CHIPS.forEach(function (c) {
        hud.chips[c.key] = U.Button(chips, c.text, function () { api.choose(c.key); });
      });
      controlsEl.appendChild(chips);
      hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
      controlsEl.appendChild(hud.feedback);
    } else if (mode === 'press') {
      hud.hand = U.Slider(controlsEl, {
        label: 'הכף (חיובי לוחץ, שלילי מרים)', min: -40, max: 40, step: 5, value: 0, unit: 'N', digits: 0, color: 'var(--c-force)',
        onInput(v) { S.hand = v; S.phase = 'ready'; loop.requestRender(); },
      });
      hud.out = U.Readouts(controlsEl, [
        { key: 'mg', label: 'כבידה', color: 'var(--c-force)' },
        { key: 'hand', label: 'הכף', color: 'var(--c-force)' },
        { key: 'n', label: 'כוח נורמלי', color: 'var(--c-force)' },
      ]);
    } else {
      hud.rope = U.Slider(controlsEl, {
        label: 'המשיכה בחבל', min: 0, max: 60, step: 5, value: 0, unit: 'N', digits: 0, color: 'var(--c-force)',
        onInput(v) { S.rope = v; S.phase = 'ready'; loop.requestRender(); },
      });
      hud.out = U.Readouts(controlsEl, [
        { key: 'mg', label: 'כבידה', color: 'var(--c-force)' },
        { key: 'up', label: 'החבל מרים', color: 'var(--c-force)' },
        { key: 'n', label: 'כוח נורמלי', color: 'var(--c-force)' },
      ]);
    }

    function setLocked(v) {
      S.locked = v;
      if (hud.hand) hud.hand.setEnabled(!v);
      if (hud.rope) hud.rope.setEnabled(!v);
    }

    function normalPress() { return Math.max(0, 5 * G + S.hand); }
    function normalPull() { return Math.max(0, 10 * G - S.rope * sin37); }

    function step(dt) {
      if (S.phase === 'ready' || S.phase === 'done') return;
      S.t += dt;
      if (mode === 'press') {
        if (S.phase === 'down') {
          const k = Math.min(S.t / 1.6, 1);
          S.hand = 20 * k;
          if (k >= 1) { S.phase = 'hold'; S.t = 0; }
        } else if (S.t >= 1.2) { S.phase = 'done'; gate.close(); }
      } else if (mode === 'pull') {
        if (S.phase === 'down') {
          const k = Math.min(S.t / 2.2, 1);
          S.rope = S.ropeTarget * k;
          if (k >= 1) { S.phase = 'hold'; S.t = 0; }
        } else if (S.t >= 1.2) { S.phase = 'done'; gate.close(); }
      }
    }

    /* A force arrow with its name and value, from (x0, y0) along f, at k meters per newton. */
    function arrowF(x0, y0, f, k, text, side) {
      const x1 = x0 + f.x * k, y1 = y0 + f.y * k;
      view.arrow(x0, y0, x1, y1, { color: C.force, width: 3.8 });
      if (!text) return;
      const len = Math.hypot(f.x, f.y) || 1;
      const ox = (f.x / len) * 14, oy = (-f.y / len) * 12;
      view.text(x1, y1, text, { size: view.w < 460 ? 11.5 : 13, weight: 700, color: C.force, offset: [ox + (side || 0), oy], halo: true, align: side > 0 ? 'left' : side < 0 ? 'right' : 'center' });
    }

    function drawTable(y, halfW) {
      view.poly([{ x: -halfW, y: y }, { x: halfW, y: y }, { x: halfW, y: y - 0.32 }, { x: -halfW, y: y - 0.32 }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
      [-halfW + 0.45, halfW - 0.45].forEach(function (x) { view.line(x, y - 0.32, x, 0, { color: C.axis, width: 5, cap: 'butt' }); });
    }

    function drawChain(scene) {
      const P = PHY.ch02.pix(view);
      const list = SCENES[scene].needs.map(function (k) { return forcesOf(scene)[k]; });
      const box = { w: view.w < 460 ? 108 : 130, h: view.w < 460 ? 92 : 108 };
      const x0 = 8, y0 = 8;
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.good;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y0, box.w, box.h, 10);
      else ctx.rect(x0, y0, box.w, box.h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      view.screenText(x0 + box.w / 2, y0 + 12, 'ראש לזנב: נסגר', { size: 10.5, weight: 700, color: C.good });
      const pts = [{ x: 0, y: 0 }];
      list.forEach(function (f) { const l = pts[pts.length - 1]; pts.push({ x: l.x + f.x, y: l.y + f.y }); });
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const k = Math.min((box.w - 26) / Math.max(10, Math.max.apply(null, xs) - Math.min.apply(null, xs)), (box.h - 38) / Math.max(10, Math.max.apply(null, ys) - Math.min.apply(null, ys)));
      const cx = x0 + box.w / 2 - (k * (Math.max.apply(null, xs) + Math.min.apply(null, xs))) / 2;
      const cy = y0 + 22 + (box.h - 24) / 2 + (k * (Math.max.apply(null, ys) + Math.min.apply(null, ys))) / 2;
      /* A straight chain would draw on itself, so its arrows step sideways. */
      const flat = Math.max.apply(null, xs) - Math.min.apply(null, xs) < 1;
      for (let i = 1; i < pts.length; i++) {
        const dx = flat ? (i - (pts.length) / 2) * 12 : 0;
        P.arrow(cx + pts[i - 1].x * k + dx, cy - pts[i - 1].y * k, cx + pts[i].x * k + dx, cy - pts[i].y * k, { color: C.force, width: 2.6, head: 9 });
      }
    }

    /* The picture of a scene, plus the chosen forces. */
    function drawScene(scene, chosen) {
      const f = forcesOf(scene);
      const k = 0.036;
      const has = (key) => chosen.indexOf(key) >= 0;
      const small = view.w < 460;
      K.ground(view, 0, {});
      const catPx = small ? 78 : 96;
      const catH = catPx / view.scale;
      if (scene === 'table' || scene === 'press') {
        const top = 2.3;
        drawTable(top, 2.9);
        PHY.mascot.draw(view, 0, top, { pose: scene === 'press' ? 'dizzy' : 'standing', px: catPx });
        const cy = top + catH * 0.5;
        if (scene === 'press') {
          K.paw(view, view.sx(0), view.sy(top + catH * 0.86), small ? 30 : 36, 0);
          if (has('hand')) arrowF(1.25, top + catH * 0.9 + 0.75, f.hand, k, F.unit(20, 'N', 0), 8);
        }
        if (has('gravity')) arrowF(1.1, cy, f.gravity, k, F.unit(50, 'N', 0), 6);
        if (has('normal')) arrowF(-1.1, cy, f.normal, k, F.unit(f.normal.y, 'N', 0), 0);
      } else if (scene === 'hang') {
        const barY = 6.0;
        view.line(0, 8.3, 0, barY, { color: C.axis, width: 3 });
        view.line(-0.9, barY, 0.9, barY, { color: C.axis, width: 5 });
        PHY.mascot.draw(view, 0, barY, { pose: 'onBranch', px: catPx });
        const cy = barY - catH * 0.35;
        if (has('gravity')) arrowF(1.25, cy, f.gravity, k, F.unit(50, 'N', 0), 6);
        if (has('tension')) arrowF(-1.25, cy, f.tension, k, F.unit(50, 'N', 0), 0);
      } else {
        const A = { x: -4.2, y: 0 }, B = { x: 4.8, y: 0 }, T = { x: 4.8, y: 6.75 };
        view.poly([A, B, T], { fill: C.gridStrong, color: C.axis, width: 2.5, close: true, alpha: 0.75 });
        view.arc(A.x, A.y, 34, 0, SLOPE, { color: C.accent, width: 2.5 });
        view.text(A.x, A.y, F.deg(SLOPE), { size: 12, weight: 700, color: C.accent, offset: [52, -13], halo: true });
        const cs = { x: 1, y: (1 - A.x) * 0.75 };
        const u = { x: cos37, y: sin37 }, n = { x: -sin37, y: cos37 };
        PHY.mascot.draw(view, cs.x, cs.y, { pose: 'standing', px: catPx, rot: SLOPE });
        const c = { x: cs.x + n.x * catH * 0.45, y: cs.y + n.y * catH * 0.45 };
        if (has('gravity')) arrowF(c.x, c.y, f.gravity, k, F.unit(50, 'N', 0), 6);
        if (has('normal')) arrowF(c.x, c.y, f.normal, k * 1.25, F.unit(40, 'N', 0), 0);
        if (has('friction')) arrowF(cs.x + u.x * 0.55, cs.y + u.y * 0.55, f.friction, k * 1.25, F.unit(30, 'N', 0), 4);
      }
      if (S.done[scene]) drawChain(scene);
    }

    function renderBuilder() {
      view.clear();
      drawScene(S.scene, S.chosen[S.scene]);
    }

    function renderPress() {
      view.clear();
      const small = view.w < 460;
      K.ground(view, 0, {});
      const top = 2.3;
      drawTable(top, 2.9);
      const plate = small ? 92 : 112;
      K.bathScale(view, view.sx(0), view.sy(top) - 20, plate, F.unit(normalPress(), 'N', 0), { h: 20, size: small ? 12 : 14 });
      const catPx = small ? 74 : 92;
      const floorY = top + 20 / view.scale;
      const catH = catPx / view.scale;
      const H = S.hand;
      PHY.mascot.draw(view, 0, floorY, { pose: H > 25 ? 'dizzy' : H < -15 ? 'happy' : H > 0 ? 'thinking' : 'standing', px: catPx });
      const cy = floorY + catH * 0.5;
      const k = 0.036;
      const headPy = view.sy(floorY + catH * 0.86);
      if (H > 0.5) {
        K.paw(view, view.sx(0), headPy, small ? 30 : 36, 0);
        const y0 = floorY + catH * 0.95 + 0.25;
        view.arrow(1.25, y0 + H * k, 1.25, y0, { color: C.force, width: 3.8 });
        view.text(1.25, y0 + H * k, F.unit(H, 'N', 0), { size: 12, weight: 700, color: C.force, align: 'left', offset: [7, -2], halo: true });
      } else if (H < -0.5) {
        const y0 = floorY + catH * 0.95;
        view.line(0, y0, 0, 8.3, { color: C.axis, width: 2.5 });
        view.arrow(1.25, y0, 1.25, y0 - H * k, { color: C.force, width: 3.8 });
        view.text(1.25, y0 - H * k, F.unit(-H, 'N', 0), { size: 12, weight: 700, color: C.force, align: 'left', offset: [7, 0], halo: true });
      }
      const gx = (plate / 2 + 11) / view.scale;
      view.arrow(gx, cy, gx, cy - 50 * k, { color: C.force, width: 3.8 });
      view.text(gx, cy - 25 * k, 'mg = ' + F.unit(50, 'N', 0), { size: 12, weight: 700, color: C.force, align: 'left', offset: [7, 0], halo: true });
      const N = normalPress();
      if (N > 0.5) {
        view.arrow(-1.3, cy, -1.3, cy + N * k, { color: C.force, width: 3.8 });
        view.text(-1.3, cy + N * k, 'N = ' + F.unit(N, 'N', 0), { size: 12, weight: 700, color: C.force, align: 'right', offset: [-7, 0], halo: true });
      }
      hud.out.set('mg', F.unit(50, 'N', 0));
      hud.out.set('hand', H >= 0 ? F.unit(H, 'N', 0) + ' למטה' : F.unit(-H, 'N', 0) + ' למעלה');
      hud.out.set('n', F.unit(N, 'N', 0));
    }

    function renderPull() {
      view.clear();
      const small = view.w < 460;
      K.ground(view, 0, {});
      const k = 0.027;
      const plate = small ? 116 : 150;
      const cx = -1.7;
      K.bathScale(view, view.sx(cx), view.sy(0) - 18, plate, F.unit(normalPull(), 'N', 0), { h: 18, size: small ? 11.5 : 14, textDx: small ? 26 : 36 });
      const w = small ? 62 : 76, h = w * 0.85;
      const baseY = 18 / view.scale;
      K.crate(view, cx, baseY, w, h, { label: F.unit(10, 'kg', 0), size: small ? 12 : 14 });
      const cy = baseY + (h / 2) / view.scale;
      const hw = (w / 2) / view.scale;
      /* the rope, at 37° above the floor, from the crate's upper corner to the cat on the ledge */
      const rx0 = cx + hw, ry0 = cy;
      const L = 6.3;
      const rx1 = rx0 + L * cos37, ry1 = ry0 + L * sin37;
      view.line(rx0, ry0, rx1, ry1, { color: C.axis, width: 2.5 });
      view.poly([{ x: rx1 - 0.2, y: ry1 }, { x: 6.2, y: ry1 }, { x: 6.2, y: 0 }, { x: rx1 - 0.2, y: 0 }], { fill: C.gridStrong, alpha: 0.7, close: true, color: C.axis, width: 2 });
      PHY.mascot.draw(view, rx1 + 0.45, ry1, { pose: S.rope > 30 ? 'dizzy' : 'standing', px: small ? 62 : 76 });
      const T = S.rope;
      const rk = k * 1.2;
      const Tx = T * cos37, Ty = T * sin37;
      if (T > 0.5) {
        view.arrow(rx0, ry0, rx0 + Tx * rk, ry0 + Ty * rk, { color: C.force, width: 3.8 });
        view.text(rx0 + Tx * rk, ry0 + Ty * rk, F.unit(T, 'N', 0), { size: 12, weight: 700, color: C.force, align: 'left', offset: [4, -12], halo: true });
        /* its shadows from chapter 1 */
        view.line(rx0 + Tx * rk, ry0 + Ty * rk, rx0 + Tx * rk, ry0, { color: C.soft, width: 1.5, dash: [4, 4] });
        view.arrow(rx0, ry0, rx0 + Tx * rk, ry0, { color: C.force, width: 2.6, dash: [6, 4], alpha: 0.8 });
        view.text(rx0 + Tx * rk, ry0, F.unit(Tx, 'N', 0), { size: 11, weight: 700, color: C.force, offset: [8, 13], halo: true });
        view.line(rx0 + Tx * rk, ry0 + Ty * rk, rx0, ry0 + Ty * rk, { color: C.soft, width: 1.5, dash: [4, 4] });
        view.arrow(rx0, ry0, rx0, ry0 + Ty * rk, { color: C.force, width: 2.6, dash: [6, 4], alpha: 0.8 });
        view.text(rx0, ry0 + Ty * rk, F.unit(Ty, 'N', 0), { size: 11, weight: 700, color: C.force, offset: [-2, -12], halo: true });
      }
      const N = normalPull();
      const dx = -hw * 0.45;
      view.arrow(cx + dx, cy, cx + dx, cy - 100 * k, { color: C.force, width: 3.8 });
      view.text(cx + dx, cy - 100 * k, 'mg', { size: 12, weight: 800, color: C.force, align: 'right', offset: [-7, 2], halo: true });
      if (N > 0.5) {
        const nx = cx - hw * 0.45 - 0.45;
        view.arrow(nx, cy, nx, cy + N * k, { color: C.force, width: 3.8 });
        view.text(nx, cy + N * k, 'N = ' + F.unit(N, 'N', 0), { size: 12, weight: 700, color: C.force, offset: [0, -11], halo: true });
      }
      /* friction holds it still: it matches the sideways shadow of the rope */
      if (Tx > 0.5) {
        const fx = cx - (plate / 2) / view.scale;
        view.arrow(fx, baseY * 0.5, fx - Tx * rk, baseY * 0.5, { color: C.force, width: 3.2 });
        view.screenText(Math.max(30, view.sx(fx - (Tx * rk) / 2)), view.sy(baseY * 0.5) - 13, F.unit(Tx, 'N', 0), { size: 11, weight: 700, color: C.force, halo: true });
      }
      hud.out.set('mg', F.unit(100, 'N', 0));
      hud.out.set('up', F.unit(Ty, 'N', 0));
      hud.out.set('n', F.unit(N, 'N', 0));
    }

    function render() {
      if (mode === 'builder') renderBuilder();
      else if (mode === 'press') renderPress();
      else renderPull();
    }

    function paintBuilder() {
      Object.keys(hud.tabs).forEach(function (k) {
        const b = hud.tabs[k];
        b.classList.toggle('btn-primary', k === S.scene);
        b.textContent = SCENES[k].name + (S.done[k] ? ' ✓' : '');
      });
      CHIPS.forEach(function (c) {
        const b = hud.chips[c.key];
        if (c.key === 'reaction') b.textContent = 'הכוח שלו על ' + SCENES[S.scene].support;
        const on = S.chosen[S.scene].indexOf(c.key) >= 0;
        b.classList.toggle('is-on', on);
        b.style.borderColor = on ? 'var(--good)' : '';
        b.style.background = on ? 'var(--good-soft)' : '';
      });
    }

    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() {
        gate.close();
        S.phase = 'ready'; S.t = 0; S.hand = 0; S.rope = 0;
        if (hud.hand) hud.hand.set(0);
        if (hud.rope) hud.rope.set(0);
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'locked') { setLocked(!!v); return; }
        if (name === 'hand') { S.hand = v; if (hud.hand) hud.hand.set(v); S.phase = 'ready'; }
        if (name === 'rope') { S.rope = v; if (hud.rope) hud.rope.set(v); S.phase = 'ready'; }
        loop.requestRender();
      },
      getState() {
        const out = { mode, phase: S.phase, scene: S.scene, chosen: S.chosen[S.scene].slice(), done: Object.keys(S.done) };
        if (mode === 'press') { out.hand = S.hand; out.N = normalPress(); out.mg = 50; }
        if (mode === 'pull') { out.rope = S.rope; out.N = normalPull(); out.mg = 100; out.up = S.rope * sin37; out.side = S.rope * cos37; }
        if (mode === 'builder') {
          const f = forcesOf(S.scene);
          let nx = 0, ny = 0;
          S.chosen[S.scene].forEach(function (k) { if (f[k]) { nx += f[k].x; ny += f[k].y; } });
          out.net = { x: nx, y: ny };
          out.magnitudes = {};
          Object.keys(f).forEach(function (k) { out.magnitudes[k] = Math.hypot(f[k].x, f[k].y); });
          out.complete = !!S.done[S.scene];
        }
        return out;
      },
      play() {
        S.t = 0;
        S.phase = 'down';
        if (mode === 'press') { S.hand = 0; if (hud.hand) hud.hand.set(20); }
        if (mode === 'pull') { S.rope = 0; if (hud.rope) hud.rope.set(S.ropeTarget); }
        return gate.open();
      },
      setScene(k) {
        if (!SCENES[k]) return;
        S.scene = k;
        hud.feedback.textContent = '';
        hud.feedback.className = 'game-feedback';
        paintBuilder();
        loop.requestRender();
      },
      choose(key) {
        const sc = SCENES[S.scene];
        const list = S.chosen[S.scene];
        const ok = sc.needs.indexOf(key) >= 0;
        if (!ok) {
          const w = WHY[key];
          hud.feedback.textContent = typeof w === 'string' ? w : (w && w[S.scene]) || 'הכוח הזה לא פועל כאן.';
          hud.feedback.className = 'game-feedback bad';
          return { ok: false, complete: !!S.done[S.scene] };
        }
        if (list.indexOf(key) < 0) list.push(key);
        const complete = sc.needs.every(function (k) { return list.indexOf(k) >= 0; });
        if (complete && !S.done[S.scene]) {
          S.done[S.scene] = true;
          if (opts.onScene) opts.onScene(S.scene, Object.keys(S.done).length);
        }
        const left = sc.needs.length - list.length;
        hud.feedback.textContent = complete
          ? (S.scene === 'slope' ? 'שלם. כבידה 50 ניוטון, נורמלי 40 ניוטון, חיכוך 30 ניוטון: 3-4-5 מפרק 1, והחצים סוגרים משולש.' : 'שלם. השקול אפס, והחצים חוזרים לנקודה שממנה יצאו.')
          : 'נכון. ' + (left === 1 ? 'עוד כוח אחד.' : 'עוד ' + left + ' כוחות.');
        hud.feedback.className = 'game-feedback good';
        paintBuilder();
        loop.requestRender();
        return { ok: true, complete: complete };
      },
    };
    setLocked(opts.locked);
    if (mode === 'builder') paintBuilder();
    return api;
  };
})();

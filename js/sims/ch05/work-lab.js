/* PHY.sims.workLab: what counts as work. Three scenes share the frame.
   scene 'suitcase': the cat carries a 20 kg suitcase along a corridor. The hand pushes up, the motion is
     sideways, and the work is summed as force dot displacement on the real path, so it stays 0.
     After the card, lift and lower the suitcase for positive and negative work.
   scene 'pull': a force at any angle on a sled moving 10 m. Only its shadow along the motion counts.
     Drag the arrow's tip, or use the sliders.
   scene 'stairs': the same stairs walked and run. Same work, different power, and a bulb to prove it.
   opts: {scene, locked}. sim.play() -> Promise. setParam: locked, plus force, angle (pull), walkTime (stairs). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, M = PHY.ch05;
  const RAD = Math.PI / 180;

  /* ---------- suitcase ---------- */
  function suitcase(view, controlsEl, opts, ask) {
    const FORCE = 200, D = 10, SPEED = 2.5;
    const tw = PHY.ch02.tweens();
    const S = { x: 0, W: 0, tired: 0, lift: 0, walking: false, busy: false, done: false, resolve: null, locked: opts.locked, caption: '' };
    const row = U.h('div', { class: 'sim-row' });
    const walkBtn = U.Button(row, 'עוד הליכה', function () { if (!S.walking && !S.busy) walk(); }, { primary: true });
    const upBtn = U.Button(row, 'להרים 1 מ\'', function () { moveCase(1); });
    const downBtn = U.Button(row, 'להוריד 1 מ\'', function () { moveCase(-1); });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'f', label: 'כוח היד', color: 'var(--c-force)' },
      { key: 'd', label: 'העתק', color: 'var(--c-displacement)' },
      { key: 'w', label: 'עבודת היד' },
    ]);

    function setLocked(v) {
      S.locked = v;
      walkBtn.disabled = v;
      upBtn.disabled = v;
      downBtn.disabled = v;
    }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function walk() {
      settle();
      tw.clear();
      S.x = 0; S.W = 0; S.tired = 0; S.lift = 0; S.done = false; S.busy = false; S.walking = true; S.caption = '';
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function moveCase(dy) {
      if (S.walking || S.busy || S.locked) return Promise.resolve();
      const y0 = S.lift, y1 = y0 + dy;
      if (y1 < -1e-6 || y1 > 2 + 1e-6) {
        S.caption = dy > 0 ? 'יותר גבוה מזה אני לא מרים.' : 'יותר נמוך מזה היד לא מגיעה.';
        return Promise.resolve();
      }
      S.busy = true;
      S.caption = '';
      let prev = y0;
      return tw.run(1, function (k) {
        const y = y0 + (y1 - y0) * k;
        S.W += FORCE * (y - prev); /* the hand pushes up, so only the upward motion counts, with its sign */
        prev = y;
        S.lift = y;
      }).then(function () {
        S.busy = false;
        S.caption = dy > 0 ? 'עבודה חיובית: היד נותנת למזוודה אנרגיה.' : 'עבודה שלילית: המזוודה מחזירה אנרגיה ליד.';
      });
    }
    /* A suitcase with its handle. (x, y) is the middle of its bottom edge, w is its width in pixels. */
    function drawCase(x, y, w) {
      const ctx = view.ctx;
      const px = view.sx(x), py = view.sy(y), h = w * 0.72;
      ctx.save();
      ctx.strokeStyle = 'rgb(59, 42, 32)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(px - w * 0.2, py - h);
      ctx.lineTo(px - w * 0.2, py - h - w * 0.2);
      ctx.lineTo(px + w * 0.2, py - h - w * 0.2);
      ctx.lineTo(px + w * 0.2, py - h);
      ctx.stroke();
      ctx.fillStyle = 'rgb(197, 130, 63)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px - w / 2, py - h, w, h, 4);
      else ctx.rect(px - w / 2, py - h, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      view.screenText(px, py - h / 2, F.num(20, 0), { size: 11, weight: 800, color: 'rgb(42, 26, 16)' });
    }
    function step(dt) {
      tw.step(dt);
      if (!S.walking) return;
      const dx = SPEED * dt;
      S.x += dx;
      S.W += PHY.vec.dot(PHY.vec.v(0, FORCE), PHY.vec.v(dx, 0)); /* the hand pushes up, the step is sideways */
      S.tired = Math.min(1, S.x / D);
      if (S.x >= D) {
        S.x = D;
        S.walking = false;
        S.done = true;
        S.caption = 'עבודה: 0 ג\'ול. היד לא מסכימה.';
        settle();
      }
    }
    function render() {
      const r = view.visible;
      const small = view.w < 460;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, r.xMax, 0, {});
      for (let i = 0; i <= 10; i += 2) view.text(i, 0, F.unit(i, 'm', 0), { size: 11, color: C.soft, offset: [0, 13] });
      /* the door at the end of the corridor */
      view.poly([{ x: 10.9, y: 0 }, { x: 10.9, y: 3 }, { x: 12.1, y: 3 }, { x: 12.1, y: 0 }], { fill: C.gridStrong, color: C.axis, width: 2, close: true });
      view.circle(11.15, 1.45, 3, { px: true, fill: C.axis });
      const hop = S.walking ? Math.abs(Math.sin(S.x * 3.1)) * 0.12 : 0;
      const pose = S.done ? 'dizzy' : S.tired > 0.55 ? 'thinking' : 'standing';
      const P = small ? 50 : 64;
      PHY.mascot.draw(view, S.x, hop, { pose: pose, px: P });
      /* suitcase */
      const size = small ? 26 : 34;
      const cx = S.x + (P * 0.5 + size * 0.5) / view.scale, by = 0.45 + S.lift;
      drawCase(cx, by, size);
      const k = (small ? 0.3 : 0.38) / view.scale;
      const top = by + (size * 0.98) / view.scale;
      view.arrow(cx, top, cx, top + FORCE * k, { color: C.force, width: 3.5, label: F.unit(FORCE, 'N', 0), labelSide: -1, labelGap: small ? 36 : 40, labelSize: 12 });
      if (S.x > 0.3) view.arrow(0, -1.05, S.x, -1.05, { color: C.displacement, width: 3, label: F.unit(S.x, 'm', 1), labelSide: 1, labelGap: 13, labelSize: 12 });
      /* the square corner between the force and the motion */
      const c = 12 / view.scale;
      view.poly([{ x: cx + c, y: top }, { x: cx + c, y: top + c }, { x: cx, y: top + c }], { color: C.ink, width: 1.5 });
      /* top strip: the counter and the arm. The card asks for this number, and at the start it reads 0 J, so it waits for the run. */
      const work = S.locked && !S.walking && !S.done && !S.busy ? '?' : M.unitJ(S.W);
      view.screenText(view.w - 12, 20, 'עבודת היד: ' + work, { size: small ? 14 : 16, weight: 800, align: 'right', color: C.ink, halo: true });
      M.miniBar(view, 12, 8, Math.min(150, view.w * 0.38), { label: 'עייפות בזרוע', max: 1, segs: [{ value: S.tired + (S.lift > 0 ? 0.2 : 0), color: C.apple }] });
      if (S.caption) view.screenText(view.w / 2, 52, S.caption, { size: small ? 12.5 : 14, weight: 700, pill: true });
      out.set('f', F.unit(FORCE, 'N', 0));
      out.set('d', F.unit(S.x, 'm', 1) + (S.lift ? ', ' + F.unit(S.lift, 'm', 0) + ' למעלה' : ''));
      out.set('w', work);
    }
    setLocked(S.locked);
    return {
      step, render, play: walk, moveCase,
      setParam(name, v) { if (name === 'locked') setLocked(!!v); ask(); },
      reset() { settle(); tw.clear(); S.x = 0; S.W = 0; S.tired = 0; S.lift = 0; S.walking = false; S.busy = false; S.done = false; S.caption = ''; ask(); },
      getState() { return { x: S.x, W: S.W, tired: S.tired, lift: S.lift, done: S.done, busy: S.busy, force: FORCE }; },
    };
  }

  /* ---------- pull ---------- */
  function pull(view, controlsEl, opts, ask) {
    const D = 10, X0 = 0, SPEED = 3;
    const S = { force: opts.force || 100, angle: opts.angle === undefined ? 60 : opts.angle, x: X0, W: 0, running: false, ran: false, resolve: null };
    const fSlider = U.Slider(controlsEl, {
      label: 'גודל הכוח', min: 20, max: 200, step: 5, value: S.force, unit: 'N', digits: 0, color: 'var(--c-force)',
      onInput(v) { S.force = v; changed(); },
    });
    const aSlider = U.Slider(controlsEl, {
      label: 'זווית מול כיוון התנועה', min: 0, max: 180, step: 1, value: S.angle, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { S.angle = v; changed(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    U.Button(row, 'לגרור 10 מ\'', function () { go(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'shadow', label: 'הצל לאורך התנועה', color: 'var(--c-force)' },
      { key: 'd', label: 'העתק', color: 'var(--c-displacement)' },
      { key: 'w', label: 'עבודה' },
    ]);
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function changed() { settle(); S.x = X0; S.W = 0; S.running = false; S.ran = false; ask(); }
    function go() {
      settle();
      S.x = X0; S.W = 0; S.running = true; S.ran = false;
      if (opts.onUse) opts.onUse();
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    /* The camera follows the sled, so the arrows always fit. The floor marks scroll under it. */
    function kN() { return (view.w < 460 ? 0.62 : 1) / view.scale; }
    function center() { return { x: 0, y: 0.8 }; }
    function tip() {
      const c = center(), l = S.force * kN();
      return { x: c.x + l * Math.cos(S.angle * RAD), y: c.y + l * Math.sin(S.angle * RAD) };
    }
    view.drag({
      hit(p) { return view.pxDist(p, tip()) < 30 && !S.running ? 'tip' : null; },
      move(h, p) {
        const c = center();
        const dx = p.x - c.x, dy = Math.max(0, p.y - c.y);
        S.force = Math.max(20, Math.min(200, Math.round(Math.hypot(dx, dy) / kN() / 5) * 5));
        S.angle = Math.round(Math.atan2(dy, dx) / RAD);
        fSlider.set(S.force);
        aSlider.set(S.angle);
        changed();
      },
    });
    function step(dt) {
      if (!S.running) return;
      const dx = Math.min(SPEED * dt, X0 + D - S.x);
      S.x += dx;
      S.W += S.force * Math.cos(S.angle * RAD) * dx; /* force dot displacement, for this step */
      if (S.x >= X0 + D - 1e-9) {
        S.running = false;
        S.ran = true;
        settle();
      }
    }
    function render() {
      const r = view.visible;
      const small = view.w < 460;
      view.clear();
      view.grid(1, {});
      M.ground(view, r.xMin, r.xMax, 0, {});
      /* floor marks that scroll as the sled advances */
      const moved = S.x - X0;
      for (let m = Math.floor(r.xMin + moved); m <= r.xMax + moved; m++) {
        if (m % 2 === 0) view.circle(m - moved, 0.05, 2.5, { px: true, fill: C.axis });
      }
      const c = center(), t = tip();
      const shadow = S.force * Math.cos(S.angle * RAD);
      const kk = kN();
      /* how far along the 10 m we are */
      const y0 = -1.85, x0 = r.xMin + 0.5, x1 = r.xMax - 0.5;
      view.arrow(x0, y0, x1, y0, { color: C.displacement, width: 2.5, alpha: 0.3 });
      if (moved > 0.05) view.arrow(x0, y0, x0 + ((x1 - x0) * moved) / D, y0, { color: C.displacement, width: 3.2 });
      view.text((x0 + x1) / 2, y0, 'כיוון התנועה: ' + F.unit(moved, 'm', 1) + ' מתוך ' + F.unit(D, 'm', 0), { size: 12, weight: 700, color: C.displacement, halo: true, offset: [0, 13] });
      /* sled, with a passenger who approves of nothing */
      const size = small ? 34 : 44;
      const hw = (size * 0.72) / view.scale;
      view.line(-hw, 0.1, hw, 0.1, { color: C.axis, width: 3 });
      M.drawCrate(view, 0, 0.14, size, { fill: 'rgb(214, 158, 98)' });
      PHY.mascot.draw(view, 0, 0.14 + size / view.scale, { pose: 'standing', px: small ? 36 : 46 });
      /* the force and its shadow on the floor */
      view.line(t.x, t.y, t.x, -0.45, { color: C.soft, width: 1.5, dash: [4, 4] });
      if (Math.abs(shadow) * kk * view.scale > 3) {
        view.arrow(0, -0.45, shadow * kk, -0.45, { color: C.force, width: 3.4, alpha: 0.75 });
        view.text((shadow * kk) / 2, -0.45, 'F cos θ', { size: 12, weight: 700, color: C.force, halo: true, offset: [0, 13] });
      }
      view.arc(c.x, c.y, 30, 0, S.angle, { color: C.accent, width: 2.5 });
      view.arrow(c.x, c.y, t.x, t.y, { color: C.force, width: 4.5 });
      view.text(c.x, c.y, F.deg(S.angle), { size: 12, weight: 800, color: C.accent, halo: true, offset: [46 * Math.cos((S.angle * RAD) / 2), -46 * Math.sin((S.angle * RAD) / 2)] });
      view.circle(t.x, t.y, 9, { px: true, fill: C.surface, color: C.force, width: 2.5 });
      view.text(t.x, t.y, 'F', { size: 12.5, weight: 800, color: C.force });

      /* the work, as a bar around zero */
      const full = S.force * Math.cos(S.angle * RAD) * D;
      const shown = S.running || S.ran ? S.W : full;
      const bw = view.w - 24, bx = 12, by = 28, mid = bx + bw / 2;
      const ctx = view.ctx;
      ctx.save();
      ctx.fillStyle = C.grid;
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = shown >= 0 ? C.good : C.bad;
      const seg = (shown / 2000) * (bw / 2);
      ctx.fillRect(seg >= 0 ? mid : mid + seg, by, Math.abs(seg), 10);
      ctx.fillStyle = C.ink;
      ctx.fillRect(mid - 1, by - 3, 2, 16);
      ctx.restore();
      const msg = S.angle === 90 ? 'ניצב לתנועה: 0 ג\'ול' : S.angle > 90 ? 'נגד התנועה: עבודה שלילית' : 'עם התנועה: עבודה חיובית';
      view.screenText(12, 16, M.unitJ(shown), { size: 14, weight: 800, align: 'left', color: shown >= 0 ? C.good : C.bad, halo: true });
      view.screenText(view.w - 12, 16, msg, { size: small ? 12 : 13, weight: 700, align: 'right', color: C.ink, halo: true });
      out.set('shadow', F.unit(shadow, 'N', 0));
      out.set('d', F.unit(S.x - X0, 'm', 1));
      out.set('w', M.unitJ(shown));
    }
    return {
      step, render, play: go,
      setParam(name, v) {
        if (name === 'force') { S.force = v; fSlider.set(v); changed(); }
        if (name === 'angle') { S.angle = v; aSlider.set(v); changed(); }
        ask();
      },
      reset: changed,
      getState() { return { force: S.force, angle: S.angle, x: S.x - X0, W: S.W, ran: S.ran, formula: S.force * D * Math.cos(S.angle * RAD) }; },
    };
  }

  /* ---------- stairs ---------- */
  function stairs(view, controlsEl, opts, ask) {
    const MASS = 5, H = 4, STEPS = 8, RUN = 2;
    const S = { walk: 4, t: 0, running: false, done: false, hold: 0, wA: 0, wB: 0, yA: 0, yB: 0, resolve: null, locked: opts.locked, caption: '' };
    const slider = U.Slider(controlsEl, {
      label: 'כמה זמן לוקחת ההליכה', min: 1, max: 8, step: 1, value: S.walk, unit: 's', digits: 0, color: 'var(--accent)',
      onInput(v) { S.walk = v; clearRun(); ask(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'לעלות במדרגות', function () { climb(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'wa', label: 'עבודה, הולך' },
      { key: 'wb', label: 'עבודה, רץ' },
      { key: 'pa', label: 'הספק, הולך' },
      { key: 'pb', label: 'הספק, רץ' },
    ]);
    function setLocked(v) { S.locked = v; slider.setEnabled(!v); go.disabled = v; }
    function settle() { if (S.resolve) { const r = S.resolve; S.resolve = null; r(); } }
    function clearRun() { settle(); S.t = 0; S.running = false; S.done = false; S.hold = 0; S.wA = 0; S.wB = 0; S.yA = 0; S.yB = 0; S.caption = ''; }
    function climb() {
      clearRun();
      S.running = true;
      return new Promise(function (resolve) { S.resolve = resolve; });
    }
    function step(dt) {
      if (!S.running) return;
      S.t += dt;
      const yA = Math.min(H, (S.t / S.walk) * H), yB = Math.min(H, (S.t / RUN) * H);
      S.wA += MASS * 10 * (yA - S.yA);
      S.wB += MASS * 10 * (yB - S.yB);
      S.yA = yA;
      S.yB = yB;
      if (yA >= H && yB >= H) {
        S.hold += dt;
        S.caption = 'אותה עבודה. הספק שונה.';
        if (S.hold > 0.6) {
          S.running = false;
          S.done = true;
          settle();
        }
      }
    }
    function drawStairs(x0, y, T, name, work, power) {
      const small = view.w < 460;
      const pts = [{ x: x0, y: 0 }];
      for (let i = 0; i < STEPS; i++) {
        pts.push({ x: x0 + i * 0.5, y: (i + 1) * 0.5 });
        pts.push({ x: x0 + (i + 1) * 0.5, y: (i + 1) * 0.5 });
      }
      pts.push({ x: x0 + 4, y: 0 });
      view.poly(pts, { fill: C.gridStrong, color: C.axis, width: 2, close: true, alpha: 0.9 });
      view.text(x0 + 0.6, 3.6, name, { size: 13, weight: 700, color: C.ink, halo: true });
      /* the cat hops from step to step */
      const f = y / H;
      const idx = Math.min(STEPS, Math.floor(f * STEPS + 1e-9));
      const within = f * STEPS - idx;
      const hop = idx < STEPS ? Math.sin(within * Math.PI) * 0.26 : 0;
      const fy = idx * 0.5 + hop, fx = x0 + Math.max(idx * 0.5 - 0.1, 0.15);
      const arrived = y >= H - 1e-9;
      PHY.mascot.draw(view, fx, fy, { pose: arrived ? (T < 3 ? 'dizzy' : 'happy') : 'standing', px: small ? 34 : 44 });
      /* the bulb: a 100 W bulb is fully lit */
      const bx = x0 + 3.4, by = 6.15;
      const glow = Math.min(1, power / 100);
      if (power > 0.1) view.circle(bx, by, 16 + glow * 12, { px: true, fill: C.gold, alpha: 0.22 + glow * 0.3 });
      view.circle(bx, by, 11, { px: true, fill: power > 0.1 ? C.gold : C.surface, color: C.axis, width: 2 });
      view.line(bx, by - 11 / view.scale, bx, by - 22 / view.scale, { color: C.axis, width: 2 });
      view.text(bx, by, power > 0.1 ? M.unitW(power) : '0 ואט', { size: 12, weight: 800, halo: true, offset: [small ? -44 : -50, 0] });
      /* the bars under the stairs */
      const px0 = view.sx(x0), w = 4 * view.scale;
      M.miniBar(view, px0, view.sy(0) + 4, w, { label: 'עבודה', right: M.unitJ(work), max: MASS * 10 * H * 1.05, segs: [{ value: work, color: C.gold }], size: small ? 10.5 : 11.5 });
      M.miniBar(view, px0, view.sy(0) + 30, w, { label: 'הספק', right: M.unitW(power), max: 210, segs: [{ value: power, color: C.accent }], size: small ? 10.5 : 11.5 });
    }
    function render() {
      view.clear();
      /* Each bulb shows the power of that whole climb, W / t, and stays lit for comparing them. */
      const on = S.running || S.done;
      const pA = on ? (MASS * 10 * H) / S.walk : 0;
      const pB = on ? (MASS * 10 * H) / RUN : 0;
      drawStairs(0, S.yA, S.walk, 'הולך', S.wA, pA);
      drawStairs(5.6, S.yB, RUN, 'רץ', S.wB, pB);
      view.line(view.visible.xMin, 0, view.visible.xMax, 0, { color: C.axis, width: 2.5, cap: 'butt' });
      if (S.caption) view.screenText(view.w / 2, 18, S.caption, { size: 14, weight: 700, pill: true });
      out.set('wa', M.unitJ(S.wA));
      out.set('wb', M.unitJ(S.wB));
      out.set('pa', on ? M.unitW(pA) : '–');
      out.set('pb', on ? M.unitW(pB) : '–');
    }
    setLocked(S.locked);
    return {
      step, render, play: climb,
      setParam(name, v) {
        if (name === 'locked') setLocked(!!v);
        if (name === 'walkTime') { S.walk = v; slider.set(v); clearRun(); }
        ask();
      },
      reset() { clearRun(); ask(); },
      getState() { return { wA: S.wA, wB: S.wB, tA: S.walk, tB: RUN, pA: S.wA / S.walk, pB: S.wB / RUN, done: S.done, mass: MASS, H: H }; },
    };
  }

  const SCENES = { suitcase, pull, stairs };
  const WORLDS = {
    suitcase: { xMin: -1.3, xMax: 12.6, yMin: -1.9, yMax: 6.6 },
    pull: { xMin: -6.5, xMax: 6.5, yMin: -2.9, yMax: 7.5 },
    stairs: { xMin: -0.6, xMax: 10.2, yMin: -2.4, yMax: 7.6 },
  };

  PHY.sims.workLab = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ scene: 'pull', locked: false }, opts || {});
    const view = PHY.canvas.create(canvasEl, { world: WORLDS[opts.scene], aspect: 1.6, minHeight: 270, maxHeight: 430 });
    let loop = null;
    const scene = SCENES[opts.scene](view, controlsEl, opts, function () { if (loop) loop.requestRender(); });
    loop = PHY.SimLoop({ view, step: scene.step, render: scene.render });
    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: scene.reset,
      play: scene.play,
      moveCase: scene.moveCase,
      setParam: scene.setParam,
      getState: scene.getState,
    };
  };
})();

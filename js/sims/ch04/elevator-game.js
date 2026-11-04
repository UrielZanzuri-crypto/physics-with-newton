/* PHY.sims.elevatorGame: "המעלית של ניוטון". Three levels, random numbers every time.
   Level 1: a motion is shown with the reading hidden. Drag the needle to the reading. Two rounds.
   Level 2: a target reading. Set the acceleration, run it, see the reading. Two rounds, one up and one down.
   Level 3: hold to thrust, reach the target floor and stop there, with the reading inside the green band.
     Holding builds up the acceleration gradually, so a long hold leaves the band. Out of the band for
     OUT_LIMIT seconds ends the try, and so does running out of time.
   Points per level: no wrong tries 3, up to 2 wrong 2, more 1 (level 3: first try 3, second 2, more 1).
   Stars from the total: 8-9 → 3, 5-7 → 2, otherwise 1.
   opts: {chapter, section, random, onDone(stars, total)}.
   API for tests: setNeedle(v), confirm(), setAccel(a), fire() -> Promise, thrust(-1|0|1), advance(s), next(), restart(). */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  const G = 10;
  const NAMES = ['שלב 1: המחוג', 'שלב 2: התאוצה', 'שלב 3: הנהיגה'];
  const MOTIONS = [
    { text: 'עולה ומאיצה', vs: 1, as: 1 },
    { text: 'עולה ומאטה', vs: 1, as: -1 },
    { text: 'יורדת ומאיצה', vs: -1, as: -1 },
    { text: 'יורדת ומאטה', vs: -1, as: 1 },
    { text: 'עולה במהירות קבועה', vs: 1, as: 0 },
    { text: 'יורדת במהירות קבועה', vs: -1, as: 0 },
  ];
  const JERK_ON = 3, JERK_OFF = 10, A_MAX = 6, BAND_A = 3.5, OUT_LIMIT = 0.4, TIME_LIMIT = 45, HOLD_WIN = 0.6;
  const STOP_DIST = 0.6, STOP_V = 0.45, FLOOR_H = 3;
  const dialMax = (m) => m * 20;
  const dialTick = (m) => (m === 8 ? 20 : 10);

  PHY.sims.elevatorGame = function (canvasEl, controlsEl, opts) {
    const K = PHY.ch04;
    opts = opts || {};
    const rnd = opts.random || Math.random;
    const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = (l) => l[randInt(0, l.length - 1)];
    const view = PHY.canvas.create(canvasEl, { world: { xMin: 0, xMax: 16, yMin: 0, yMax: 10 }, aspect: 1.5, minHeight: 330, maxHeight: 460 });
    const P = PHY.ch02.pix(view);
    const gate = K.gate();
    const G0 = { i: 0, round: 0, wrong: 0, points: [], phase: 'aim', m: 5, a: 0, v: 0, y: 0, shownA: 0, needle: 0, target: null, q: null, thrust: 0, outT: 0, t: 0, inT: 0, tries: 1, floor: 0, caption: '', hidden: true, stars: 0, won: 0, clip: 0, lastReading: null };
    const Gm = Object.assign({}, G0);

    const hud = {};
    hud.levels = U.h('div', { class: 'game-levels' });
    hud.pips = NAMES.map(function (n) { const p = U.h('span', { class: 'game-pip', text: n }); hud.levels.appendChild(p); return p; });
    hud.main = U.h('div', { class: 'game-hud' });
    hud.final = U.h('div', { class: 'game-final', hidden: true });
    hud.task = U.h('div', { class: 'game-task' });
    hud.feedback = U.h('div', { class: 'game-feedback', role: 'status' });
    controlsEl.appendChild(U.h('div', { class: 'game-hud' }, [hud.levels, hud.main, hud.final]));
    hud.main.appendChild(hud.task);

    /* level 1 controls */
    hud.l1 = U.h('div', { class: 'sim-row' });
    U.Button(hud.l1, '−', function () { setNeedle(Gm.needle - 1); }, { class: 'game-fine' }).setAttribute('aria-label', 'ניוטון אחד פחות');
    U.Button(hud.l1, '+', function () { setNeedle(Gm.needle + 1); }, { class: 'game-fine' }).setAttribute('aria-label', 'ניוטון אחד יותר');
    hud.main.appendChild(hud.l1);

    /* level 2 controls */
    hud.l2 = U.h('div', {});
    hud.accel = U.Slider(hud.l2, { label: 'תאוצת המעלית (חיובי כלפי מעלה)', min: -10, max: 10, step: 0.5, value: 0, unit: 'ms2', digits: 1, color: 'var(--c-acceleration)', onInput(v) { if (Gm.phase === 'aim') { Gm.shownA = v; loop.requestRender(); } } });
    hud.main.appendChild(hud.l2);

    /* level 3 controls: two big hold buttons */
    hud.l3 = U.h('div', { class: 'sim-row' });
    hud.up = holdButton(hud.l3, 'למעלה ▲', 1);
    hud.down = holdButton(hud.l3, 'למטה ▼', -1);
    hud.main.appendChild(hud.l3);

    hud.main.appendChild(hud.feedback);
    hud.actionRow = U.h('div', { class: 'sim-row' });
    hud.action = U.h('button', { type: 'button', class: 'btn btn-primary' });
    hud.actionRow.appendChild(hud.action);
    hud.main.appendChild(hud.actionRow);

    function holdButton(host, text, dir) {
      const b = U.h('button', { type: 'button', class: 'btn game-hold', text: text });
      b.style.flex = '1 1 120px';
      b.style.minHeight = '60px';
      b.style.touchAction = 'none';
      b.style.userSelect = 'none';
      b.style.webkitUserSelect = 'none';
      const on = function (e) { e.preventDefault(); if (e.pointerId !== undefined && b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } } api.thrust(dir); };
      const off = function () { if (Gm.thrust === dir) api.thrust(0); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      b.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); api.thrust(dir); } });
      b.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') off(); });
      host.appendChild(b);
      return b;
    }

    const reading = () => Math.max(0, Gm.m * (G + Gm.a));

    function feedback(text, kind) {
      hud.feedback.textContent = text || '';
      hud.feedback.className = 'game-feedback ' + (kind || '');
    }
    function paintPips() {
      hud.pips.forEach(function (p, j) {
        p.className = 'game-pip' + (j === Gm.i && Gm.phase !== 'done' ? ' is-now' : '') + (Gm.points[j] ? ' is-done' : '');
        p.textContent = NAMES[j] + (Gm.points[j] ? ' (' + Gm.points[j] + ')' : '');
      });
    }
    function setAction(text, fn) {
      hud.action.textContent = text;
      hud.action.onclick = fn;
      hud.action.disabled = false;
      hud.action.hidden = false;
    }

    /* ---------- building rounds ---------- */
    function startLevel(i) {
      gate.close();
      Gm.i = i; Gm.round = 0; Gm.wrong = 0; Gm.tries = 1;
      hud.main.hidden = false;
      hud.final.hidden = true;
      if (i === 0) startRound1();
      else if (i === 1) startRound2();
      else startDrive();
      paintPips();
    }
    function startRound1() {
      const pool = Gm.round === 0 ? [MOTIONS[0], MOTIONS[1], MOTIONS[4]] : [MOTIONS[2], MOTIONS[3], MOTIONS[5]];
      /* The second round always goes down, so the classic trap (down and slowing) keeps coming back. */
      const mo = pick(pool);
      const mag = mo.as === 0 ? 0 : randInt(1, 5);
      Gm.m = pick([4, 5, 6, 8]);
      Gm.q = { text: mo.text, vs: mo.vs, as: mo.as, mag };
      Gm.shownA = mo.as * mag;
      Gm.a = Gm.shownA;
      Gm.v = clipV0(mo, mag);
      Gm.y = 0;
      Gm.clip = 0;
      Gm.needle = Math.round(dialMax(Gm.m) * 0.25);
      Gm.phase = 'aim';
      Gm.hidden = true;
      Gm.caption = '';
      Gm.target = null;
      hud.l1.hidden = false; hud.l2.hidden = true; hud.l3.hidden = true;
      const acc = mag ? ' ב-' + F.unit(mag, 'ms2', 0) : '';
      hud.task.textContent = 'ניוטון, ' + F.unit(Gm.m, 'kg', 0) + ', והמעלית ' + mo.text + acc + '. לאן יצביע המחוג? (סיבוב ' + (Gm.round + 1) + ' מתוך 2)';
      feedback('');
      setAction('בודקים', confirmNeedle);
      loop.requestRender();
    }
    function clipV0(mo, mag) { return mo.vs * (mag * 1.6 + 1.5); }

    function startRound2() {
      const sign = Gm.round === 0 ? 1 : -1;
      const star = sign * randInt(1, 6);
      Gm.m = pick([4, 5, 6, 8]);
      Gm.q = { aStar: star };
      Gm.target = Gm.m * (G + star);
      Gm.phase = 'aim';
      Gm.a = 0; Gm.v = 0; Gm.y = 0; Gm.shownA = 0;
      Gm.lastReading = null;
      Gm.hidden = false;
      Gm.caption = '';
      hud.accel.set(0);
      hud.accel.setEnabled(true);
      hud.l1.hidden = true; hud.l2.hidden = false; hud.l3.hidden = true;
      hud.task.textContent = 'ניוטון, ' + F.unit(Gm.m, 'kg', 0) + '. הפעם המאזניים צריכים להראות בדיוק ' + F.unit(Gm.target, 'N', 0) + '. איזו תאוצה תיתן את זה? (סיבוב ' + (Gm.round + 1) + ' מתוך 2)';
      feedback('');
      setAction('מפעילים', fire);
      loop.requestRender();
    }

    /* A new try keeps the same floor and the same cat, so the last try can teach something. */
    function startDrive(again) {
      if (!again) {
        Gm.m = pick([4, 5, 6, 8]);
        Gm.floor = pick([2, 3, 4]) * pick([1, -1]);
      }
      const k = Gm.floor;
      Gm.y = 0; Gm.v = 0; Gm.a = 0; Gm.thrust = 0; Gm.outT = 0; Gm.inT = 0; Gm.t = 0;
      Gm.phase = 'drive';
      Gm.hidden = false;
      Gm.caption = '';
      Gm.target = null;
      hud.l1.hidden = true; hud.l2.hidden = true; hud.l3.hidden = false;
      setHoldEnabled(true);
      const lo = Gm.m * (G - BAND_A), hi = Gm.m * (G + BAND_A);
      hud.task.textContent = 'יעד: קומה ' + F.num(k, 0) + '. להחזיק כדי להאיץ, לעזוב כדי לשוט, ולעצור בקומה. המחוג נשאר בפס הירוק, בין ' + F.unit(lo, 'N', 0) + ' ל-' + F.unit(hi, 'N', 0) + '.';
      feedback(Gm.tries > 1 ? 'ניסיון ' + Gm.tries + '.' : '');
      hud.action.hidden = true;
      /* The stage and the two buttons fit on a phone only when the stage starts right under the top bar. */
      if (canvasEl.scrollIntoView && canvasEl.getBoundingClientRect().top < 56) canvasEl.scrollIntoView({ block: 'start', behavior: U.reduced() ? 'auto' : 'smooth' });
      loop.requestRender();
    }
    function setHoldEnabled(on) { hud.up.disabled = !on; hud.down.disabled = !on; }

    /* ---------- level 1 ---------- */
    function setNeedle(v) {
      if (Gm.i !== 0 || Gm.phase !== 'aim') return;
      Gm.needle = Math.max(0, Math.min(dialMax(Gm.m), Math.round(v)));
      loop.requestRender();
    }
    function confirmNeedle() {
      if (Gm.i !== 0 || Gm.phase !== 'aim') return null;
      const right = Gm.m * (G + Gm.shownA);
      const off = Gm.needle - right;
      if (Math.abs(off) <= 1.5) {
        Gm.hidden = false;
        Gm.phase = 'solved';
        Gm.caption = 'בול. ' + F.unit(right, 'N', 0) + '.';
        U.burst(canvasEl, 18);
        const q = Gm.q;
        const why = q.as === 0
          ? 'מהירות קבועה היא בלי תאוצה, לכן הקריאה היא פשוט mg.'
          : 'התאוצה ' + (q.as > 0 ? 'כלפי מעלה' : 'כלפי מטה') + ', לכן הקריאה ' + (q.as > 0 ? 'גדולה' : 'קטנה') + ' מ-mg, בלי קשר לכיוון הנסיעה.';
        feedback(why, 'good');
        PHY.mascot.say(Gm.round === 0 ? 'יפה. אני מרגיש את זה בכריות של הרגליים.' : 'מרשים. כמעט כאילו ירדת איתי במעלית.', 'happy');
        if (Gm.round === 0) setAction('לסיבוב הבא', function () { Gm.round = 1; startRound1(); });
        else finishLevel(scoreByWrong());
        return true;
      }
      Gm.wrong++;
      const impliedA = Gm.needle / Gm.m - G;
      const q = Gm.q;
      const dirWord = q.as === 0 ? 'אין כאן תאוצה בכלל' : 'התאוצה כאן ' + (q.as > 0 ? 'כלפי מעלה' : 'כלפי מטה');
      let tip = (off > 0 ? 'גבוה מדי. ' : 'נמוך מדי. ') + 'קריאה של ' + F.unit(Gm.needle, 'N', 0) + ' הייתה אומרת שהתאוצה ' + F.unit(impliedA, 'ms2', 1) + ', ו' + dirWord + '.';
      if (Gm.wrong >= 3) tip += ' נציב: N = m(g + a), כש-a חיובית כלפי מעלה.';
      feedback(tip, 'bad');
      if (Gm.wrong === 2) PHY.mascot.say('אני עומד על המאזניים האלה כבר הרבה זמן.', 'dizzy');
      return false;
    }

    /* ---------- level 2 ---------- */
    function fire() {
      if (Gm.i !== 1 || Gm.phase !== 'aim') return Promise.resolve(null);
      Gm.a = Gm.shownA;
      Gm.v = 0; Gm.y = 0; Gm.t = 0;
      Gm.phase = 'run';
      hud.action.disabled = true;
      hud.accel.setEnabled(false);
      feedback('');
      return gate.open();
    }
    function landRun() {
      const got = Gm.m * (G + Gm.a);
      Gm.lastReading = got;
      const hit = Math.abs(got - Gm.target) < 0.01;
      const result = { hit, reading: got };
      if (hit) {
        Gm.phase = 'solved';
        U.burst(canvasEl, 18);
        Gm.caption = 'בדיוק ' + F.unit(got, 'N', 0) + '.';
        feedback('ההפרש מ-mg הוא ' + F.unit(got - Gm.m * G, 'N', 0) + ', ועל ' + F.unit(Gm.m, 'kg', 0) + ' זו תאוצה של ' + F.unit(Gm.a, 'ms2', 1) + '.', 'good');
        PHY.mascot.say(Gm.round === 0 ? 'מרגיש כבד. אבל כבד מדויק.' : 'קל לי קצת. נעים, בעצם.', 'happy');
        if (Gm.round === 0) setAction('לסיבוב הבא', function () { Gm.round = 1; startRound2(); });
        else finishLevel(scoreByWrong());
      } else {
        Gm.wrong++;
        Gm.phase = 'aim';
        Gm.v = 0; Gm.y = 0;
        hud.accel.setEnabled(true);
        Gm.a = Gm.shownA;
        const diff = Gm.target - got;
        const text = 'המאזניים הראו ' + F.unit(got, 'N', 0) + ', והיעד ' + F.unit(Gm.target, 'N', 0) + '. ';
        if (Gm.wrong === 1) feedback(text + (diff > 0 ? 'צריך קריאה גבוהה יותר: יותר תאוצה כלפי מעלה.' : 'צריך קריאה נמוכה יותר: יותר תאוצה כלפי מטה.'), 'bad');
        else feedback(text + 'חסרים ' + F.unit(Math.abs(diff), 'N', 0) + ', וכל מ/ש² על ' + F.unit(Gm.m, 'kg', 0) + ' שווה ' + F.unit(Gm.m, 'N', 0) + '.', 'bad');
        setAction('מפעילים', fire);
      }
      gate.close(result);
    }

    /* ---------- level 3 ---------- */
    function driveStep(dt) {
      Gm.t += dt;
      const want = Gm.thrust * A_MAX;
      if (Gm.thrust) {
        const d = want - Gm.a;
        Gm.a += Math.sign(d) * Math.min(Math.abs(d), JERK_ON * dt);
      } else {
        Gm.a -= Math.sign(Gm.a) * Math.min(Math.abs(Gm.a), JERK_OFF * dt);
      }
      const nv = Gm.v + Gm.a * dt;
      Gm.y += ((Gm.v + nv) / 2) * dt;
      Gm.v = nv;
      if (Math.abs(Gm.a) > BAND_A) Gm.outT += dt;
      else Gm.outT = 0;
      if (Gm.outT >= OUT_LIMIT) {
        failDrive(Gm.a > 0 ? 'יותר מדי זמן עם הכפתור: המחוג יצא מהפס וניוטון נמחץ לתוך המאזניים. כדאי לעזוב מוקדם יותר.' : 'יותר מדי זמן עם הכפתור: המחוג ירד מהפס, והבטן של ניוטון נשארה בקומה הקודמת. כדאי לעזוב מוקדם יותר.');
        return;
      }
      if (Gm.t >= TIME_LIMIT) { failDrive('נגמר הזמן, ' + F.unit(TIME_LIMIT, 's', 0) + '. השכנים כבר עלו ברגל.'); return; }
      const dist = Math.abs(Gm.y - Gm.floor * FLOOR_H);
      if (dist < STOP_DIST && Math.abs(Gm.v) < STOP_V && !Gm.thrust) {
        Gm.inT += dt;
        if (Gm.inT >= HOLD_WIN) winDrive();
      } else {
        Gm.inT = 0;
      }
    }
    function failDrive(text) {
      Gm.phase = 'crashed';
      Gm.thrust = 0;
      Gm.wrong++;
      setHoldEnabled(false);
      feedback(text, 'bad');
      PHY.mascot.say('אני נוחת על הרגליים. גם בתוך מעלית. רק בקושי.', 'dizzy');
      setAction('עוד ניסיון', function () { Gm.tries++; startDrive(true); });
    }
    function winDrive() {
      Gm.phase = 'solved';
      Gm.v = 0; Gm.a = 0;
      Gm.thrust = 0;
      setHoldEnabled(false);
      Gm.caption = 'קומה ' + F.num(Gm.floor, 0) + '!';
      U.burst(canvasEl, 26);
      feedback('עצירה נקייה. ההאצה והבלימה הן אותו N = m(g + a), רק בסימנים הפוכים.', 'good');
      PHY.mascot.say('נהיגה מוסמכת. אני מבקש טיפ בתפוחים.', 'happy');
      finishLevel(Gm.tries <= 1 ? 3 : Gm.tries === 2 ? 2 : 1);
    }

    function scoreByWrong() { return Gm.wrong === 0 ? 3 : Gm.wrong <= 2 ? 2 : 1; }
    function finishLevel(pts) {
      Gm.points[Gm.i] = pts;
      Gm.caption = (Gm.caption ? Gm.caption + ' ' : '') + pts + ' מתוך 3 נקודות';
      paintPips();
      if (Gm.i < 2) setAction('לשלב הבא', function () { startLevel(Gm.i + 1); });
      else setAction('לסיכום', finish);
    }
    function finish() {
      const total = Gm.points.reduce(function (a, b) { return a + (b || 0); }, 0);
      const stars = total >= 8 ? 3 : total >= 5 ? 2 : 1;
      Gm.phase = 'done';
      Gm.stars = stars;
      paintPips();
      if (opts.chapter) PHY.progress.setGame(opts.chapter, stars);
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      hud.main.hidden = true;
      hud.final.hidden = false;
      hud.final.innerHTML = '';
      U.StarScore(hud.final, { value: stars, animate: true });
      hud.final.appendChild(U.h('div', { class: 'game-task', text: total + ' מתוך 9 נקודות. ' + (stars === 3 ? 'ניוטון מוסר לך את מפתחות המעלית, ומבקש שלא יספרו לו כמה קומות יש.' : stars === 2 ? 'יפה מאוד. עוד סיבוב אחד, וזה שלושה כוכבים.' : 'הגעת עד הסוף, וזה מה שחשוב. בסיבוב הבא המספרים יהיו אחרים.') }));
      U.Button(hud.final, 'עוד סיבוב, במספרים חדשים', restart, { primary: true });
      U.burst(hud.final, 30);
      if (opts.onDone) opts.onDone(stars, total);
    }
    function restart() {
      Gm.points = [];
      startLevel(0);
    }

    /* ---------- the loop ---------- */
    function step(dt) {
      if (Gm.phase === 'done') return;
      if (Gm.i === 0 && (Gm.phase === 'aim' || Gm.phase === 'solved')) {
        /* The motion is a clip that loops. */
        const q = Gm.q;
        Gm.clip += dt;
        Gm.v += Gm.shownA * dt;
        Gm.y += Gm.v * dt;
        if (Gm.clip >= 1.5) {
          Gm.clip = 0;
          Gm.v = clipV0(q, q.mag);
          Gm.y = 0;
        }
        return;
      }
      if (Gm.i === 1 && Gm.phase === 'run') {
        Gm.t += dt;
        const nv = Gm.v + Gm.a * dt;
        Gm.y += ((Gm.v + nv) / 2) * dt;
        Gm.v = nv;
        if (Gm.t >= 2) landRun();
        return;
      }
      if (Gm.i === 2 && Gm.phase === 'drive') driveStep(dt);
    }

    function dialBox(L) {
      const x0 = L.xs + L.ws + 12;
      const w = L.W - x0 - 6;
      const r = Math.max(52, Math.min(w / 2 - 12, L.H * 0.42));
      return { cx: x0 + w / 2, cy: 26 + r, r };
    }
    function layout() {
      const W = view.w, H = view.h;
      const ws = Math.min(W * 0.42, 190);
      const cw = ws * 0.62;
      const ch = Math.min(H - 50, cw * 1.42);
      return { W, H, xs: 6, ws, cw, ch, cx: 6 + (ws - cw) / 2, cy: (H - ch) / 2 + 4 };
    }

    view.drag({
      hit(p) {
        if (Gm.i !== 0 || Gm.phase !== 'aim') return null;
        const L = layout();
        const d = dialBox(L);
        const v = K.dialValue(d.cx, d.cy, d.r, dialMax(Gm.m), view.sx(p.x), view.sy(p.y));
        return v === null ? null : { d };
      },
      start(h, p) { const v = K.dialValue(h.d.cx, h.d.cy, h.d.r, dialMax(Gm.m), view.sx(p.x), view.sy(p.y)); if (v !== null) setNeedle(v); },
      move(h, p) { const v = K.dialValue(h.d.cx, h.d.cy, h.d.r, dialMax(Gm.m), view.sx(p.x), view.sy(p.y)); if (v !== null) setNeedle(v); },
    });

    function render() {
      view.clear();
      const L = layout();
      const small = view.w < 460;
      const floorPy = L.cy + L.ch;
      const N = Gm.i === 0 ? Gm.m * (G + Gm.shownA) : Gm.i === 1 ? (Gm.phase === 'run' || Gm.lastReading !== null ? (Gm.phase === 'run' ? reading() : Gm.lastReading) : null) : reading();
      const pxPerM = L.ch / 5;
      K.shaft(view, P, { x: L.xs, w: L.ws, floorPy, pos: Gm.y, pxPerM, floorH: FLOOR_H, target: Gm.i === 2 ? Gm.floor : undefined, top: 2, bottom: L.H - 2 });
      const a = Gm.i === 0 ? Gm.shownA : Gm.a;
      const showReading = !(Gm.i === 0 && Gm.hidden) && N !== null;
      const pose = Gm.phase === 'crashed' ? 'dizzy' : Gm.phase === 'solved' ? 'happy' : a > 2.5 ? 'dizzy' : a < -2.5 ? 'falling' : Gm.i === 0 ? 'thinking' : 'standing';
      K.cabin(view, P, {
        x: L.cx, y: L.cy, w: L.cw, h: L.ch,
        reading: showReading ? N : null, weight: Gm.m * G, pose,
        forces: false, a, v: Gm.v, kA: small ? 5 : 7, kV: small ? 3 : 4, top: 2,
      });
      const d = dialBox(L);
      const max = dialMax(Gm.m);
      if (Gm.i === 0) {
        K.dial(view, d.cx, d.cy, d.r, { max, tick: dialTick(Gm.m), value: Gm.needle, handle: Gm.phase === 'aim', color: C.accent });
        view.screenText(d.cx, d.cy + 25, F.unit(Gm.needle, 'N', 0), { size: 17, weight: 800, color: C.accent });
        view.screenText(d.cx, d.cy + 46, 'אפשר לגרור את המחוג', { size: 12, color: C.soft });
      } else if (Gm.i === 1) {
        K.dial(view, d.cx, d.cy, d.r, { max, tick: dialTick(Gm.m), value: N, target: Gm.target, color: C.force });
        view.screenText(d.cx, d.cy + 25, 'יעד: ' + F.unit(Gm.target, 'N', 0), { size: 15, weight: 800, color: C.ink });
        view.screenText(d.cx, d.cy + 46, 'a = ' + F.unit(Gm.i === 1 && Gm.phase === 'run' ? Gm.a : Gm.shownA, 'ms2', 1), { size: 13, weight: 700, color: C.acceleration });
      } else {
        const lo = Gm.m * (G - BAND_A), hi = Gm.m * (G + BAND_A);
        const out = reading() < lo || reading() > hi;
        K.dial(view, d.cx, d.cy, d.r, { max, tick: dialTick(Gm.m), value: reading(), band: [lo, hi], color: out ? C.bad : C.force });
        view.screenText(d.cx, d.cy + 25, F.unit(reading(), 'N', 0), { size: 17, weight: 800, color: out ? C.bad : C.force });
        const dist = Gm.floor * FLOOR_H - Gm.y;
        view.screenText(d.cx, d.cy + 46, 'ליעד: ' + F.unit(Math.abs(dist), 'm', 1) + (Math.abs(dist) < STOP_DIST ? '' : dist > 0 ? ' למעלה' : ' למטה'), { size: 13, weight: 700, color: C.displacement });
        view.screenText(d.cx, d.cy + 65, 'מהירות: ' + F.unit(Math.abs(Gm.v), 'ms', 1), { size: 13, weight: 700, color: C.velocity });
      }
      if (Gm.caption) view.screenText(view.w / 2, view.h - 18, Gm.caption, { size: small ? 12 : 13.5, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });

    const api = {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset: restart,
      setParam(name, v) {
        if (name === 'accel') api.setAccel(v);
      },
      getState() {
        return {
          level: Gm.i, round: Gm.round, phase: Gm.phase, wrong: Gm.wrong, tries: Gm.tries, points: Gm.points.slice(), stars: Gm.stars,
          m: Gm.m, shownA: Gm.shownA, a: Gm.a, v: Gm.v, y: Gm.y, reading: reading(), needle: Gm.needle, target: Gm.target,
          floor: Gm.floor, floorY: Gm.floor * FLOOR_H, bandA: BAND_A, q: Gm.q,
        };
      },
      setNeedle,
      confirm: confirmNeedle,
      setAccel(v) { if (Gm.i === 1 && Gm.phase === 'aim') { Gm.shownA = v; hud.accel.set(v); loop.requestRender(); } },
      fire,
      thrust(dir) {
        if (Gm.i !== 2 || Gm.phase !== 'drive') { Gm.thrust = 0; return; }
        Gm.thrust = dir;
        hud.up.classList.toggle('btn-primary', dir > 0);
        hud.down.classList.toggle('btn-primary', dir < 0);
      },
      /* Same as clicking the action button when a round or a level is won. */
      next() { if (!hud.action.hidden && !hud.action.disabled) hud.action.click(); },
      /* Advance the physics now, without waiting for frames. */
      advance(seconds) {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 120) step(1 / 120);
      },
      restart,
    };
    startLevel(0);
    return api;
  };
})();

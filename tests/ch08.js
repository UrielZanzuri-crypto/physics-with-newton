/* Chapter 8: real sims, measured against the formulas. Runs inside tests/physics.html?only=08. */
PHY_T.load(['ch08/kit.js', 'ch08/lanes.js', 'ch08/spring-lab.js', 'ch08/circle-shadow.js', 'ch08/ghost-race.js', 'ch08/swing-game.js']);

PHY_T.add(async function (T) {
  var S = PHY.sims, K = PHY.ch08, TAU = Math.PI * 2;

  function lanes(list, duration) { return T.make(S.oscLanes, { world: { xMin: -3, xMax: 3, yMin: -1, yMax: 4 }, lanes: list, duration: duration }); }
  /* A small repeatable random source, so each game seed is a different run. */
  function lcg(seed) { var x = seed >>> 0; return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }

  await T.test('פרק 8: פתיח, אמפליטודה כפולה', async function () {
    var s = lanes([
      { type: 'vspring', x0: -1, y0: 0, m: 1, k: 10, A: 0.5, L0: 2.6 },
      { type: 'vspring', x0: 1, y0: 0, m: 1, k: 10, A: 1, L0: 2.6 },
    ], 6);
    await T.run(s.play());
    var l = s.getState().lanes;
    T.near('T עם 0.5 מ\' מול הנוסחה', K.period(1, 10), l[0].T, 0.005);
    T.near('T עם 1 מ\' מול הנוסחה', K.period(1, 10), l[1].T, 0.005);
    T.near('הפרש הזמנים בין שתי המשרעות', 0, l[0].T - l[1].T, 0.001);
    T.same('שלושה מחזורים בכל אחד', 3, l[0].cycles === l[1].cycles ? l[0].cycles : -1);
    T.near('נקודת המנוחה: mg/k מתחת לאורך הטבעי', -1, l[0].rest, 1e-9);
  });

  await T.test('פרק 8: קפיץ, כוח מחזיר', async function () {
    var s = T.make(S.springLab, { panel: 'fx', m: 1, k: 4, A: 1 });
    await T.run(s.play([{ set: { x: 0, v: 2 }, run: { x: 0.6, dir: 1 } }]));
    var q = s.getState();
    T.near('במיקום 0.6 מ\'', 0.6, q.x, 1e-6);
    T.near('הכוח שם: F = -kx', -2.4, q.F, 1e-6);
    T.near('התאוצה שם: a = F/m', -2.4, q.a, 1e-6);
    T.same('החתול עדיין מתרחק', true, q.v > 0);
    T.near('המהירות שם: 2 כפול שורש 1 פחות 0.36', 1.6, q.v, 0.005);
    await T.run(s.play([{ run: 'turn' }, { run: 'turn' }, { run: 'turn' }]));
    q = s.getState();
    T.near('אחרי שלוש נקודות עצירה: הקצה הימני', 0.0, Math.abs(q.x) - 1, 0.002);
    T.near('זמן מחזור מדוד, m=1, k=4', Math.PI, q.t * 2 / 3, 0.01);
  });

  await T.test('פרק 8: הצל של המעגל', async function () {
    var s = T.make(S.circleShadow, { T: 4, A: 1.5, turns: 2 });
    await T.run(s.play());
    var q = s.getState();
    T.near('הפער המרבי בין הצל לקרונית, במטרים', 0, q.maxGap, 0.002);
    T.near('זמן הריצה: שתי הקפות של 4 ש\'', 8, q.t, 0.02);
    T.near('אחרי שתי הקפות: בחזרה ב-A', 1.5, q.x, 0.002);
    T.near('ω = 2π/T', TAU / 4, q.omega, 1e-9);
    var f = T.make(S.circleShadow, { T: 2.5, A: 1.5, turns: 3 });
    await T.run(f.play());
    T.near('הפער גם ב-T = 2.5 ש\'', 0, f.getState().maxGap, 0.004);
  });

  await T.test('פרק 8: גרפים, x v a', async function () {
    var s = T.make(S.springLab, { panel: 'graphs', m: 1, k: 4, A: 1 });
    await T.run(s.play([{ run: { x: 0, dir: -1 } }]));
    var q = s.getState();
    T.near('באמצע: t = T/4', Math.PI / 2 / 2, q.t, 0.005);
    T.near('באמצע: |v| = Aω', 2, Math.abs(q.v), 0.002);
    T.near('באמצע: a = 0', 0, q.a, 1e-6);
    await T.run(s.play([{ run: 'turn' }]));
    q = s.getState();
    T.near('בקצה הראשון: t = T/2', Math.PI / 2, q.t, 0.01);
    T.near('בקצה: v = 0', 0, q.v, 1e-9);
    T.near('בקצה: |a| = Aω²', 4, Math.abs(q.a), 0.002);
    T.near('בקצה: x = -A', -1, q.x, 0.002);
  });

  await T.test('פרק 8: מעבדת זמן המחזור', async function () {
    var s = T.make(S.oscLanes, { world: { xMin: -3, xMax: 3, yMin: -1, yMax: 4 }, duration: 4.1, lanes: [
      { type: 'hspring', x0: -2, y0: 0.6, m: 1, k: 40, A: 0.5 },
      { type: 'hspring', x0: -2, y0: 0, m: 4, k: 40, A: 0.5 },
    ] });
    await T.run(s.play());
    var l = s.getState().lanes;
    T.near('1 ק"ג, k = 40', K.period(1, 40), l[0].T, 0.002);
    T.near('4 ק"ג, k = 40', K.period(4, 40), l[1].T, 0.002);
    T.near('יחס: מסה פי 4, זמן פי 2', 2, l[1].T / l[0].T, 0.002);
    T.same('מחזורים ב-4 ש\': 4 מול 2', '4,2', l[0].cycles + ',' + l[1].cycles);
    var p = T.make(S.oscLanes, { world: { xMin: -3, xMax: 3, yMin: -1, yMax: 4 }, duration: 6, lanes: [
      { type: 'hspring', x0: -2, y0: 1.2, m: 1, k: 20, A: 0.4 },
      { type: 'hspring', x0: -2, y0: 0.6, m: 1, k: 20, A: 0.4, config: 'parallel' },
      { type: 'hspring', x0: -2, y0: 0, m: 1, k: 20, A: 0.4, config: 'series' },
    ] });
    await T.run(p.play());
    l = p.getState().lanes;
    T.near('קפיץ אחד, k = 20', K.period(1, 20), l[0].T, 0.002);
    T.near('במקביל: k = 40', K.period(1, 40), l[1].T, 0.002);
    T.near('בטור: k = 10', K.period(1, 10), l[2].T, 0.002);
    T.near('יחס במקביל מול אחד', 1 / Math.SQRT2, l[1].T / l[0].T, 0.002);
    T.near('יחס בטור מול אחד', Math.SQRT2, l[2].T / l[0].T, 0.002);
  });

  await T.test('פרק 8: אנרגיה', async function () {
    var s = T.make(S.springLab, { panel: 'energy', m: 1, k: 4, A: 1 });
    await T.run(s.play([{ run: { x: 0.5, dir: -1 } }]));
    var q = s.getState();
    T.near('האנרגיה הכוללת ½kA²', 2, q.E, 0.001);
    T.near('אנרגיית קפיץ בחצי משרעת', 0.5, q.U, 1e-6);
    T.near('אנרגיית תנועה בחצי משרעת', 1.5, q.K, 0.001);
    T.near('שלושה רבעים', 0.75, q.K / q.E, 0.001);
    T.near('המהירות שם', Math.sqrt(3), Math.abs(q.v), 0.002);
    await T.run(s.play([{ run: { x: 0, dir: -1 } }]));
    q = s.getState();
    T.near('v מרבית: Aω', 2, Math.abs(q.v), 0.002);
    s.release(1);
    s.advance(20);
    q = s.getState();
    T.near('האנרגיה נשמרת אחרי 20 ש\'', 2, q.E, 0.002);
  });

  await T.test('פרק 8: מטוטלת', async function () {
    var s = lanes([
      { type: 'pendulum', x0: -1, y0: 4, L: 1, g: 10, theta0: 15 },
      { type: 'pendulum', x0: 1, y0: 4, L: 4, g: 10, theta0: 15 },
    ], 8.2);
    await T.run(s.play());
    var l = s.getState().lanes;
    T.near('L = 1 מ\', T מדוד ב-15°', K.pendPeriod(1, 10) * 1.0043, l[0].T, 0.003);
    T.near('L = 4 מ\', T מדוד ב-15°', K.pendPeriod(4, 10) * 1.0043, l[1].T, 0.005);
    T.near('יחס: אורך פי 4, זמן פי 2', 2, l[1].T / l[0].T, 0.002);

    var moon = lanes([
      { type: 'pendulum', x0: -1, y0: 4, L: 1, g: 10, theta0: 5 },
      { type: 'pendulum', x0: 1, y0: 4, L: 1, g: 1.6, theta0: 5 },
    ], 10.5);
    await T.run(moon.play());
    l = moon.getState().lanes;
    T.near('בכדור הארץ, 1 מ\'', 1.987, l[0].T, 0.005);
    T.near('על הירח, 1 מ\'', K.pendPeriod(1, 1.6), l[1].T, 0.01);

    /* The honest part: the real equation at large angles, against the elliptic-integral values. */
    var angles = [[5, 1.00048], [15, 1.00430], [30, 1.01741], [60, 1.07318]];
    for (var i = 0; i < angles.length; i++) {
      var a = lanes([{ type: 'pendulum', x0: 0, y0: 4, L: 1, g: 10, theta0: angles[i][0] }], 8.7);
      await T.run(a.play());
      T.near('T מדוד חלקי הנוסחה ב-' + angles[i][0] + '°', angles[i][1], a.getState().lanes[0].T / K.pendPeriod(1, 10), 0.0006);
    }
  });

  await T.test('פרק 8: מלכודות', async function () {
    var g = T.make(S.ghostRace, { m: 1, k: 4, A: 1, rate: 1 });
    await T.run(g.play());
    var q = g.getState();
    T.near('מירוץ: הקפיץ מגיע הביתה אחרי T/4', Math.PI / 4, q.tReal, 0.002);
    T.near('מירוץ: בתאוצה קבועה √(2A/a)', Math.SQRT1_2, q.tGhost, 0.002);
    T.near('מירוץ: מהירות הקפיץ בבית', 2, q.vReal, 0.002);
    T.near('מירוץ: מהירות הרוח בבית', 2 * Math.SQRT2, q.vGhost, 0.002);

    var m = lanes([
      { type: 'pendulum', x0: -1.2, y0: 4, L: 1, g: 10, theta0: 12, m: 1 },
      { type: 'pendulum', x0: 1.2, y0: 4, L: 1, g: 10, theta0: 12, m: 4 },
      { type: 'hspring', x0: -2.5, y0: 1, m: 1, k: 10, A: 0.5 },
      { type: 'hspring', x0: -2.5, y0: 0, m: 4, k: 10, A: 0.5 },
    ], 8.2);
    await T.run(m.play());
    var l = m.getState().lanes;
    T.near('מטוטלת: כבד מול קל', 0, l[1].T - l[0].T, 1e-6);
    T.near('קפיץ: 4 ק"ג חלקי 1 ק"ג', 2, l[3].T / l[2].T, 0.002);

    var v = lanes([
      { type: 'vspring', x0: -1, y0: 0, m: 1, k: 10, g: 10, A: 0.4, L0: 2.4 },
      { type: 'vspring', x0: 1, y0: 0, m: 1, k: 10, g: 1.6, A: 0.4, L0: 2.4 },
    ], 6.1);
    await T.run(v.play());
    l = v.getState().lanes;
    T.near('קפיץ אנכי בכדור הארץ', K.period(1, 10), l[0].T, 0.003);
    T.near('קפיץ אנכי על הירח', K.period(1, 10), l[1].T, 0.003);
    T.near('נקודת מנוחה בכדור הארץ', -1, l[0].rest, 1e-9);
    T.near('נקודת מנוחה על הירח', -0.16, l[1].rest, 1e-9);
  });

  await T.test('פרק 8: בלי תשובה על הבמה לפני הניחוש', async function () {
    function values() { return Array.prototype.map.call(T.stage.lastElementChild.querySelectorAll('.r-value'), function (e) { return e.textContent; }); }

    var fx = T.make(S.springLab, { panel: 'fx', m: 1, k: 4, A: 1, locked: true, hideUntilRun: true });
    var fxBox = T.stage.lastElementChild;
    await T.settle();
    var v = values();
    T.same('כוח: F מוסתר לפני הריצה', '?', v[1]);
    T.same('כוח: a מוסתר לפני הריצה', '?', v[2]);
    T.same('כוח: המיקום נשאר גלוי', true, v[0] !== '?');
    await T.run(fx.play([{ run: { time: 0.1 } }]));
    await T.settle();
    var after = fxBox.querySelectorAll('.r-value');
    T.same('כוח: F גלוי אחרי ההפעלה', true, after[1].textContent !== '?');
    T.same('כוח: a גלוי אחרי ההפעלה', true, after[2].textContent !== '?');
    fx.setParam('locked', false);
    fx.release(0.5);
    fx.advance(1);
    T.same('כוח: משחק חופשי אחרי הכרטיס', 'run', fx.getState().phase);
    T.near('כוח: F אמיתי במשחק חופשי', -4 * fx.getState().x, fx.getState().F, 1e-9);

    var gr = T.make(S.springLab, { panel: 'graphs', m: 1, k: 4, A: 1, locked: true, hideUntilRun: true });
    await T.settle();
    v = values();
    T.same('גרפים: a מוסתר לפני הריצה', '?', v[2]);
    T.same('גרפים: F מוסתר לפני הריצה', '?', v[3]);
    T.same('גרפים: v בקצה נשאר גלוי, השאלה נותנת אותו', true, v[1] !== '?');
    T.same('גרפים: מסומן כמוסתר', true, gr.getState().veiled);
    await T.run(gr.play([{ run: { time: 0.1 } }]));
    T.same('גרפים: נפתח בהפעלה', false, gr.getState().veiled);

    var en = T.make(S.springLab, { panel: 'energy', m: 1, k: 4, A: 1, locked: true, hideUntilRun: true, sliders: ['A'] });
    await T.settle();
    T.same('אנרגיה: הקערה מוסתרת לפני הריצה', true, en.getState().veiled);
    en.setParam('A', 1);
    T.same('אנרגיה: שינוי פרמטר לא חושף', true, en.getState().veiled);
    await T.run(en.play([{ run: { time: 0.1 } }]));
    T.same('אנרגיה: נפתח בהפעלה', false, en.getState().veiled);

    var open = T.make(S.springLab, { panel: 'live', m: 1, k: 4, A: 1 });
    T.same('סימולציה בלי האפשרות לא מוסתרת', false, open.getState().veiled);
  });

  await T.test('פרק 8: הכיתוב בסוף הריצה מספר מה קרה', async function () {
    var s = T.make(S.oscLanes, { world: { xMin: -3, xMax: 3, yMin: -1, yMax: 4 }, duration: 4.05,
      endCaption: function (ls) { return ls[0].meter.n + ',' + ls[1].meter.n; },
      lanes: [
        { type: 'hspring', x0: -2, y0: 0.6, m: 1, k: 40, A: 0.5 },
        { type: 'hspring', x0: -2, y0: 0, m: 4, k: 40, A: 0.5 },
      ] });
    await T.run(s.play());
    T.same('מסה פי 4: 4 מול 2', '4,2', s.getState().caption);
    s.setLane(1, { m: 4, k: 160 });
    await T.run(s.play());
    T.same('וגם k פי 4: 4 מול 4', '4,4', s.getState().caption);
  });

  await T.test('פרק 8: הסליידר של הצל לא מקפיא את הכפתור', async function () {
    var s = T.make(S.circleShadow, { T: 4, A: 1.5, turns: 2, locked: false });
    var box = T.stage.lastElementChild, btn = box.querySelector('button.btn-primary'), input = box.querySelector('input[type=range]');
    s.play();
    await T.settle();
    T.same('בזמן ריצה הכפתור כבוי', true, btn.disabled);
    input.value = 6;
    input.dispatchEvent(new Event('input'));
    T.same('אחרי שינוי סליידר הכפתור דולק', false, btn.disabled);
    T.same('הסימולציה חזרה למצב מוכן', 'ready', s.getState().phase);
  });

  await T.test('פרק 8: המשחק, הודעת האנרגיה על דחיפה שמאלה', async function () {
    /* Runs until the swing moves left at a speed in [lo, hi] m/s, pushes once, then follows it to the next turning point. */
    async function pushAt(seed, lo, hi) {
      var game = T.make(S.swingGame, { rng: lcg(seed) });
      var q = game.getState(), guard = 0, peak0 = q.peak;
      while (guard++ < 2000) {
        q = game.getState();
        if (q.om < 0 && -q.om * q.L >= lo && -q.om * q.L <= hi) break;
        game.advance(1 / 120);
      }
      var d = game.push(), text = game.getState().feedback, before = game.getState().om;
      guard = 0;
      while (guard++ < 2000 && game.getState().om * before > 0) game.advance(1 / 120);
      return { d: d, text: text, peak: game.getState().peak, peak0: peak0 };
    }
    var seeds = [1, 7, 42];
    for (var i = 0; i < seeds.length; i++) {
      var slow = await pushAt(seeds[i], 0.1, 0.25);
      T.same('זרע ' + seeds[i] + ': דחיפה מול תנועה איטית מוסיפה אנרגיה', true, slow.d > 0);
      T.same('זרע ' + seeds[i] + ': השיא הבא באמת גבוה יותר', true, slow.peak > slow.peak0);
      T.same('זרע ' + seeds[i] + ': ההודעה לא אומרת שנגנבה אנרגיה', false, slow.text.indexOf('גנבה') >= 0);
      T.same('זרע ' + seeds[i] + ': ההודעה אומרת שהכיוון התהפך', true, slow.text.indexOf('הפכה את הכיוון') >= 0);
      var fast = await pushAt(seeds[i], 0.4, 0.5);
      T.same('זרע ' + seeds[i] + ': דחיפה מול תנועה מהירה גונבת אנרגיה', true, fast.d < 0);
      T.same('זרע ' + seeds[i] + ': השיא הבא באמת נמוך יותר', true, fast.peak < fast.peak0);
      T.same('זרע ' + seeds[i] + ': ההודעה אומרת שנגנבה אנרגיה', true, fast.text.indexOf('גנבה') >= 0);
    }
  });

  await T.test('פרק 8: המשחק, פותר על כמה זרעים', async function () {
    var seeds = [1, 7, 42, 1234, 99999];
    for (var i = 0; i < seeds.length; i++) {
      var game = T.make(S.swingGame, { rng: lcg(seeds[i]) });
      /* Level 1: push at the bottom of each swing to the right. */
      var s = game.getState(), guard = 0, prev = s.th;
      while (game.getState().phase === 'play' && guard++ < 60000) {
        game.advance(1 / 120);
        var q = game.getState();
        if (prev < 0 && q.th >= 0 && q.om > 0) game.push();
        prev = q.th;
      }
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': שלב 1 נוצח', 'won', s.phase);
      T.near('זרע ' + seeds[i] + ': מספר הדחיפות שווה לתזמון המושלם', s.par, s.pushes, 0.5);
      T.same('זרע ' + seeds[i] + ': 3 נקודות', 3, s.points[0]);
      game.next();

      /* Level 2: compute from the period, as a reader would. Wrong first, to prove it does not pass. */
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': שלב 2', 1, s.level);
      var sols = game.solutions();
      T.same('זרע ' + seeds[i] + ': יש פתרון על הגריד', true, sols.length > 0);
      var w = s.witness;
      T.near('העד על הגריד נותן את T', s.T, K.period(w.m, w.k), 1e-9);
      game.setParam('m', 2); game.setParam('k', 40);
      var badE = game.check();
      T.same('זרע ' + seeds[i] + ': כיוון התחלתי לא עובר', 'play', game.getState().phase);
      T.same('זרע ' + seeds[i] + ': פער גדול מהסבילות', true, Math.abs(badE) > 0.03);
      game.setParam('m', w.m); game.setParam('k', w.k);
      game.advance(3);
      T.near('זרע ' + seeds[i] + ': T מדוד של הקפיץ', s.T, game.getState().springT, 0.003);
      game.check();
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': שלב 2 נוצח', 'won', s.phase);
      T.same('זרע ' + seeds[i] + ': 3 נקודות בבדיקה שנייה', 3, s.points[1]);
      game.next();

      /* Level 3: a bad release first, at the middle, and then a good one at the right end. */
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': שלב 3', 2, s.level);
      guard = 0;
      while (!(game.getState().x1 <= 0 && game.getState().v1 < 0) && guard++ < 2000) game.advance(1 / 120);
      game.release();
      game.advance(1.5 * s.T + 0.1);
      T.same('זרע ' + seeds[i] + ': שחרור באמצע מפסיד', 'missed', game.getState().phase);
      T.near('הפער נשאר רבע מחזור', Math.PI / 2, Math.abs(game.getState().err), 0.05);
      game.retry();
      T.same('אפשר לנסות שוב', 'play', game.getState().phase);
      guard = 0;
      var pv = game.getState().v1;
      while (guard++ < 4000) {
        game.advance(1 / 120);
        var v1 = game.getState().v1;
        if (pv > 0 && v1 <= 0) break;
        pv = v1;
      }
      game.release();
      game.advance(1.5 * s.T + 0.1);
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': שלב 3 נוצח', 'won', s.phase);
      T.near('זרע ' + seeds[i] + ': פער המופע', 0, s.err, 0.08);
      T.same('זרע ' + seeds[i] + ': 3 נקודות', 3, s.points[2]);
      game.next();
      s = game.getState();
      T.same('זרע ' + seeds[i] + ': המשחק נגמר', 'final', s.phase);
      T.same('זרע ' + seeds[i] + ': 3 כוכבים', 3, s.stars);
    }
  });

  await T.test('פרק 8: המשחק שומר התקדמות', async function () {
    var game = T.make(S.swingGame, { rng: lcg(77), chapter: 'x8', section: 'game' });
    var prev = game.getState().th, guard = 0;
    while (game.getState().phase === 'play' && guard++ < 60000) {
      game.advance(1 / 120);
      var q = game.getState();
      if (prev < 0 && q.th >= 0 && q.om > 0) game.push();
      prev = q.th;
    }
    game.next();
    var w = game.getState().witness;
    game.setParam('m', w.m); game.setParam('k', w.k);
    game.check();
    game.next();
    var s = game.getState();
    guard = 0;
    var pv = s.v1;
    while (guard++ < 4000) {
      game.advance(1 / 120);
      var v1 = game.getState().v1;
      if (pv > 0 && v1 <= 0) break;
      pv = v1;
    }
    game.release();
    game.advance(1.5 * s.T + 0.1);
    game.next();
    T.same('הכוכבים נשמרו', 3, PHY.progress.chapter('x8').game);
    T.same('הסעיף סומן', true, PHY.progress.hasSection('x8', 'game'));
    game.restart();
    s = game.getState();
    T.same('סיבוב חדש מתחיל משלב 1', 0, s.level);
    T.same('סיבוב חדש בלי נקודות', 0, s.points.length);
    T.same('השיא נשמר גם אחרי סיבוב חדש', 3, PHY.progress.chapter('x8').game);
  });

  await T.test('פרק 8: המשחק, תזמון רע מפסיד', async function () {
    var seeds = [3, 11, 500];
    for (var i = 0; i < seeds.length; i++) {
      var game = T.make(S.swingGame, { rng: lcg(seeds[i]) });
      var guard = 0, best = 0;
      /* Every push while the swing is moving left, against the motion. */
      while (game.getState().phase === 'play' && guard++ < 120000) {
        game.advance(1 / 120);
        var q = game.getState();
        best = Math.max(best, q.th);
        if ((q.om < -0.05 || Math.abs(q.th) < 0.02 && Math.abs(q.om) < 0.05) && q.cool === 0 && q.pushes < q.limit) game.push();
      }
      var s = game.getState();
      T.same('זרע ' + seeds[i] + ': דחיפות נגד התנועה מפסידות', 'lost', s.phase);
      T.same('זרע ' + seeds[i] + ': לא התקרבו לתפוח', true, best < (s.thT * Math.PI) / 180 * 0.8);
      game.retry();
      T.same('אחרי כישלון אפשר לנסות שוב', 'play', game.getState().phase);
      T.same('הספירה מתאפסת', 0, game.getState().pushes);
    }
    /* Pushing right at the ends adds much less than pushing at the bottom. */
    var a = T.make(S.swingGame, { rng: lcg(5) });
    a.advance(1 / 120);
    var dEnd = a.push();
    T.same('דחיפה ליד הקצה מוסיפה מעט', true, dEnd > 0 && dEnd < 0.05);
  });
});

/* Chapter 7: every sim is run for real and its numbers are compared with the formula. The game is won by a scripted
   solver that uses only what the sim shows, on several seeds, and bad throws are shown to lose. */
PHY_T.load([
  'ch07/kit.js', 'ch07/astronaut.js', 'ch07/egg-drop.js', 'ch07/spring-carts.js', 'ch07/collision-lab.js', 'ch07/cradle.js',
  'ch07/com-lab.js', 'ch07/com-flight.js', 'ch07/boat-walk.js', 'ch07/rocket.js', 'ch07/falling-cat.js', 'ch07/space-return.js',
]);
PHY_T.add(async function (T) {
  var near = T.near, same = T.same, make = T.make, run = T.run, test = T.test;
  var S = PHY.sims;

  await test('פרק 7: האסטרונאוט', async function () {
    var a = make(S.astronaut, {});
    await run(a.scene('away'));
    var s = a.getState();
    near('מפתח 2 ק"ג ב-10 מ/ש: מהירות ניוטון', -2, s.v, 1e-9);
    near('תנע ניוטון', -20, s.pCat, 1e-9);
    near('תנע המפתח', 20, s.pWrench, 1e-9);
    near('תנע כולל', 0, s.pCat + s.pWrench, 1e-9);
    near('זמן עד החללית, 10 מ\' ב-2 מ/ש', 5, s.arrivalT, 0.02);
    same('ניוטון הגיע', true, s.arrived);

    var b = make(S.astronaut, {});
    await run(b.scene('toward'));
    s = b.getState();
    near('זורקים אל החללית: ניוטון מתרחק ב-2 מ/ש', 2, s.v, 1e-9);
    same('המפתח הגיע לחללית', true, s.wStuck);
    same('ניוטון לא הגיע', false, s.arrived);

    var c = make(S.astronaut, {});
    await run(c.scene('swim'));
    near('שחייה: 0 מ\' התקדמות', 0, c.getState().moved, 1e-9);

    var d = make(S.astronaut, {});
    await run(d.play('toward'));
    same('אחרי ניחוש שגוי רואים גם את הדרך הנכונה', true, d.getState().arrived);
  });

  await test('פרק 7: ביצים', async function () {
    var e = make(S.eggDrop, {});
    await run(e.play());
    var s = e.getState();
    near('מהירות פגיעה מ-5 מ\'', 10, s.v0, 1e-9);
    near('תנע לפני הפגיעה', 0.5, s.p0, 1e-9);
    near('שטח על בטון', 0.5, s.hard.area, 0.005);
    near('שטח על כרית', 0.5, s.soft.area, 0.005);
    near('שיא על בטון', 78.54, s.hard.peak, 0.3);
    near('שיא על כרית', 7.854, s.soft.peak, 0.02);
    near('הביצה בבטון נעצרה', 0, s.hard.v, 0.05);
    near('הביצה בכרית נעצרה', 0, s.soft.v, 0.05);
    same('בטון שובר', true, s.hard.broken);
    same('כרית לא שוברת', false, s.soft.broken);
  });

  await test('פרק 7: קפיץ בין קרונות', async function () {
    var c = make(S.springCarts, {});
    await run(c.play());
    var s = c.getState();
    near('קרון 1 ק"ג', -3, s.v1, 0.02);
    near('קרון 3 ק"ג', 1, s.v2, 0.02);
    near('תנע כולל בכל רגע', 0, s.pMaxErr, 1e-9);
    near('אנרגיית הקפיץ, 6 ג\'ול', 6, s.ke, 0.05);
    same('הקרונות עזבו את הקפיץ', true, s.released);
  });

  await test('פרק 7: מעבדת התנגשויות', async function () {
    var lab = make(S.collisionLab, {});
    await run(lab.play({ m1: 2, m2: 1, u1: 6, u2: 0, type: 'plastic' }));
    var s = lab.getState();
    near('נדבקים: 2 ק"ג ב-6 מ/ש', 4, s.v1, 1e-9);
    near('נדבקים: אותה מהירות', 4, s.v2, 1e-9);
    near('אנרגיה לפני', 36, s.ke0, 1e-9);
    near('אנרגיה אחרי', 24, s.ke, 1e-9);
    near('הפך לחום', 12, s.lost, 1e-9);
    near('תנע לא זז בשום רגע', 0, s.pMax - s.pMin, 1e-9);

    await run(lab.play({ m1: 2, m2: 2, u1: 5, u2: 0, type: 'elastic' }));
    s = lab.getState();
    near('מסות שוות: הראשון עוצר', 0, s.v1, 1e-9);
    near('מסות שוות: השני ממשיך', 5, s.v2, 1e-9);
    near('אלסטי: אנרגיה נשמרת', 0, s.lost, 1e-9);

    await run(lab.play({ m1: 19, m2: 1, u1: 4, u2: 0, type: 'elastic' }));
    s = lab.getState();
    near('כבד פוגע בקל: הקל', 7.6, s.v2, 1e-9);
    near('כבד פוגע בקל: הכבד', 3.6, s.v1, 1e-9);

    await run(lab.play({ m1: 1, m2: 19, u1: 4, u2: 0, type: 'elastic' }));
    s = lab.getState();
    near('קל פוגע בכבד: הקל נרתע', -3.6, s.v1, 1e-9);
    near('קל פוגע בכבד: הכבד', 0.4, s.v2, 1e-9);

    await run(lab.play({ m1: 3, m2: 1, u1: 4, u2: 0, type: 'elastic' }));
    s = lab.getState();
    near('מלכודת 1, קפיץ: 3 ק"ג', 2, s.v1, 1e-9);
    near('מלכודת 1, קפיץ: 1 ק"ג', 6, s.v2, 1e-9);
    near('מלכודת 1, קפיץ: אנרגיה נשמרת', 24, s.ke, 1e-9);
    await run(lab.play({ m1: 3, m2: 1, u1: 4, u2: 0, type: 'plastic' }));
    s = lab.getState();
    near('מלכודת 1, סקוטש: 3 מ/ש', 3, s.v1, 1e-9);
    near('מלכודת 1, סקוטש: תנע', 12, s.p, 1e-9);
    near('מלכודת 1, סקוטש: 6 ג\'ול לחום', 6, s.lost, 1e-9);

    await run(lab.play({ m1: 2, m2: 2, u1: 3, u2: -3, type: 'plastic' }));
    s = lab.getState();
    near('מלכודת 2: תנע כולל', 0, s.p0, 1e-9);
    near('מלכודת 2: אנרגיה לפני', 18, s.ke0, 1e-9);
    near('מלכודת 2: עוצרים', 0, s.v1, 1e-9);
    near('מלכודת 2: אנרגיה אחרי', 0, s.ke, 1e-9);

    var never = make(S.collisionLab, {});
    await run(never.play({ m1: 1, m2: 1, u1: 1, u2: 3, type: 'elastic' }));
    same('הראשון איטי יותר: אין התנגשות', false, never.getState().collided);

    var truck = make(S.collisionLab, { m1: 1900, m2: 100, u1: 10, u2: 0, type: 'plastic', skin: 'truck', panel: 'force', tau: 0.1, world: 44 });
    await run(truck.play());
    s = truck.getState();
    near('משאית ואופניים: מהירות משותפת', 9.5, s.v1, 1e-9);
    near('שינוי מהירות המשאית', -0.5, s.dv1, 1e-9);
    near('שינוי מהירות האופניים', 9.5, s.dv2, 1e-9);
    near('מתקף שווה ומנוגד', 0, s.impulse1 + s.impulse2, 1e-6);
    near('כוח: 950 ק"ג·מ/ש ב-0.1 ש\'', 9500, s.force, 0.5);
  });

  await test('פרק 7: עריסה', async function () {
    var cr = make(S.cradle, {});
    for (var n = 1; n <= 4; n++) {
      await run(cr.play({ n: n }));
      var s = cr.getState();
      same('מושכים ' + n + ', יוצאים', n, s.nOut);
      near('מהירות בתחתית, 0.2 מ\' נפילה', 2, s.vOut, 0.02);
      near('תנע נכנס מול יוצא', s.pIn, s.pOut, 1e-9);
      near('אנרגיה נכנסת מול יוצאת', s.keIn, s.keOut, 1e-9);
      if (n === 2) {
        near('2 כדורים: תנע', 0.4, s.pIn, 0.005);
        near('2 כדורים: אנרגיה', 0.4, s.keIn, 0.01);
        near('כדור אחד ב-2v: אנרגיה פי 2', 2 * s.keIn, s.keGhost, 1e-9);
      }
    }
  });

  await test('פרק 7: מרכז מסה', async function () {
    var c = make(S.comLab, { masses: [2, 3, 5], xs: [1, 4, 8] });
    near('(2·1 + 3·4 + 5·8) / 10', 5.4, c.getState().xCm, 1e-9);
    c.setParam('x2', 2);
    near('מזיזים מסה', 2.4, c.getState().xCm, 1e-9);
    c.setParam('m0', 10);
    near('משנים מסה', 32 / 18, c.getState().xCm, 1e-9);

    var ham = make(S.comFlight, { shape: 'hammer' });
    await run(ham.play());
    var s = ham.getState();
    near('פטיש: מרכז המסה על הפרבולה, x', s.idealX, s.comX, 0.01);
    near('פטיש: מרכז המסה על הפרבולה, y', s.idealY, s.comY, 0.01);
    near('פטיש: סטייה מרבית בכל הטיסה', 0, s.maxDev, 0.01);

    var ring = make(S.comFlight, { shape: 'ring' });
    await run(ring.play());
    s = ring.getState();
    near('טבעת: סטייה מרבית מהפרבולה', 0, s.maxDev, 0.01);
    near('טבעת: מרכז המסה רחוק מהחומר ברדיוס שלם', 1.05, s.gapFromMaterial, 0.02);

    var fw = make(S.comFlight, { shape: 'firework' });
    await run(fw.play());
    s = fw.getState();
    same('התפוצץ', true, s.burst);
    same('8 רסיסים', 8, s.nPieces);
    near('זיקוק: מרכז המסה בסוף, x', 40, s.comX, 0.01);
    near('זיקוק: מרכז המסה בסוף, y', 0, s.comY, 0.01);
    near('זיקוק: סטייה מרבית', 0, s.maxDev, 0.01);
    near('זיקוק: תנע אופקי לא השתנה', 120, s.px, 0.01);
  });

  await test('פרק 7: סירה', async function () {
    var b = make(S.boatWalk, { catMass: 5, boatMass: 20, walk: 5 });
    await run(b.play());
    var s = b.getState();
    near('הסירה נסוגה', -1, s.boatMoved, 1e-9);
    near('החתול ביחס למים', 4, s.catMoved, 1e-9);
    near('מרכז המסה לא זז', 0, s.comMoved, 1e-9);
    b.setParam('boatMass', 15);
    b.setParam('walk', 4);
    await run(b.play());
    s = b.getState();
    near('נתוני התרגיל: הסירה 1 מ\'', -1, s.boatMoved, 1e-9);
    near('נתוני התרגיל: החתול 3 מ\'', 3, s.catMoved, 1e-9);
  });

  await test('פרק 7: טיל', async function () {
    var r = make(S.rocket, {});
    r.fire();
    near('תפוח ראשון: 1·20 / 29', 20 / 29, r.getState().v, 1e-9);
    near('תנע כולל אחרי זריקה', 0, r.getState().pTotal, 1e-9);
    await run(r.play());
    var s = r.getState();
    var expected = 0;
    for (var M = 29; M >= 20; M--) expected += 20 / M;
    same('כל התפוחים נזרקו', 0, s.left);
    near('מהירות סופית', expected, s.v, 1e-9);
    near('תנע כולל בסוף', 0, s.pTotal, 1e-9);
  });

  await test('פרק 7: החתול הנופל', async function () {
    var f = make(S.fallingCat, {});
    await run(f.play());
    var s = f.getState();
    near('זמן נפילה מ-1.25 מ\'', 0.5, s.t, 1e-9);
    near('החצי הקדמי הסתובב חצי סיבוב', 180, s.rotF, 1e-6);
    near('החצי האחורי הסתובב חצי סיבוב', 180, s.rotB, 1e-6);
    near('התנע הזוויתי נשאר 0 בכל רגע', 0, s.Lmax, 1e-6);
    f.setParam('tuck', false);
    await run(f.play());
    s = f.getState();
    near('בלי לקפל: הקדמי חוזר', 0, s.rotF, 1e-6);
    near('בלי לקפל: האחורי חוזר', 0, s.rotB, 1e-6);
    near('בלי לקפל: התנע הזוויתי 0', 0, s.Lmax, 1e-6);
  });

  /* ---------- the game ---------- */
  function seeded(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Reads the level from the state, as a reader would from the screen, and works out one throw. */
  function plan(st) {
    var c = st.cat, s = st.ship, sv = st.shipV;
    for (var t = 3; t < st.air * 0.9; t += 0.25) {
      var vx = (s.x - c.x) / t + sv.x, vy = (s.y - c.y) / t + sv.y;
      if (Math.hypot(vx - sv.x, vy - sv.y) > st.safe * 0.85) continue;
      var dvx = vx - c.vx, dvy = vy - c.vy, need = Math.hypot(dvx, dvy);
      for (var k = 0; k < 3; k++) {
        if (st.items[k].used) continue;
        var m = st.items[k].m, u = (need * (st.mass - m)) / m;
        if (u < st.uMin || u > st.uMax) continue;
        return { k: k, u: u, deg: (Math.atan2(-dvy, -dvx) * 180) / Math.PI };
      }
    }
    return null;
  }
  function solve(g) {
    var p = plan(g.getState());
    if (!p) return false;
    g.choose(p.k);
    g.setAim(p.deg, p.u);
    g.throwItem();
    g.advance(40);
    return g.getState().phase === 'won';
  }

  await test('פרק 7: המשחק, פותר על כמה זרעים', async function () {
    var seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    var wins = 0, perfect = 0;
    for (var i = 0; i < seeds.length; i++) {
      var stars = null, total = null;
      var g = make(S.spaceReturn, { rng: seeded(seeds[i]), onDone: function (st, tot) { stars = st; total = tot; } });
      var ok = true;
      for (var lvl = 0; lvl < 3; lvl++) {
        if (!solve(g)) ok = false;
        if (g.getState().phase === 'won') g.next();
      }
      if (ok) wins++;
      if (stars === 3 && total === 9) perfect++;
    }
    near('הפותר ניצח בכל הזרעים', seeds.length, wins, 0);
    near('זריקה אחת בכל שלב: 3 כוכבים, 9 נקודות', seeds.length, perfect, 0);
  });

  await test('פרק 7: המשחק, ניסיונות גרועים מפסידים', async function () {
    var g = make(S.spaceReturn, { rng: seeded(11) });
    var st = g.getState();
    /* Throwing toward the ship pushes him away. */
    g.choose(1);
    g.setAim(180, 10);
    g.throwItem();
    g.advance(40);
    st = g.getState();
    same('זורקים אל החללית: מפסידים', 'lost', st.phase);
    same('הוא התרחק', true, st.cat.x > 20);
    g.retry();
    same('ניסיון שני נספר', 2, g.getState().attempt);
    near('הניסיון השני מתחיל מחדש', g.getState().airStart, g.getState().air, 1e-9);
    /* The heavy box as hard as possible: he arrives too fast. */
    g.choose(2);
    g.setAim(0, 20);
    g.throwItem();
    g.advance(40);
    st = g.getState();
    same('זריקה חזקה מדי: התרסקות', 'crash', st.why);
    same('מפסידים גם כך', 'lost', st.phase);
    g.retry();
    /* An apple, gently: the air runs out. */
    g.choose(0);
    g.setAim(0, 1);
    g.throwItem();
    g.advance(60);
    st = g.getState();
    same('זריקה רכה מדי: האוויר נגמר', 'air', st.why);
    /* Too fast, then a brake with a second item, thrown toward the ship. */
    g.retry();
    g.choose(2);
    g.setAim(0, 20);
    g.throwItem();
    var v1 = -g.getState().cat.vx;
    g.choose(1);
    g.setAim(180, 20);
    g.throwItem();
    var v2 = -g.getState().cat.vx;
    same('זריקה קדימה בולמת', true, v2 < v1);
    g.advance(40);
    st = g.getState();
    if (st.phase === 'lost') {
      g.retry();
      var p = plan(g.getState());
      g.choose(p.k); g.setAim(p.deg, p.u); g.throwItem(); g.advance(40);
    }
    same('בסוף מגיעים', 'won', g.getState().phase);
    same('ניסיון שאינו ראשון לא מקבל נקודה נוספת', true, g.getState().points[0] <= 2);

    /* Level 2: a throw straight back, as if there were no drift, misses. */
    var missed = 0, tried = [21, 22, 23, 24, 25];
    for (var q = 0; q < tried.length; q++) {
      var g2 = make(S.spaceReturn, { rng: seeded(tried[q]) });
      solve(g2);
      g2.next();
      st = g2.getState();
      var deg = (Math.atan2(st.cat.y - st.ship.y, st.cat.x - st.ship.x) * 180) / Math.PI;
      var p2 = plan(st);
      g2.choose(p2.k);
      g2.setAim(deg, p2.u);
      g2.throwItem();
      g2.advance(40);
      if (g2.getState().phase === 'lost') missed++;
    }
    near('שלב 2: זריקה ישר אחורה, בלי לחשב את הסחיפה, מחטיאה', tried.length, missed, 0);

    /* Level 3: aiming at where the ship is now misses it. */
    var g3 = make(S.spaceReturn, { rng: seeded(31) });
    solve(g3); g3.next();
    solve(g3); g3.next();
    st = g3.getState();
    same('שלב 3: החללית זזה', true, Math.abs(st.shipV.y) > 0);
    var dx = st.ship.x - st.cat.x, dy = st.ship.y - st.cat.y, dist = Math.hypot(dx, dy);
    var sp = 2.2, dvx = (dx / dist) * sp, dvy = (dy / dist) * sp;
    var k = 2, m = st.items[k].m;
    g3.choose(k);
    g3.setAim((Math.atan2(-dvy, -dvx) * 180) / Math.PI, (sp * (st.mass - m)) / m);
    g3.throwItem();
    g3.advance(40);
    same('שלב 3: מכוונים למקום הנוכחי ומחטיאים', 'lost', g3.getState().phase);

    near('אלפי שלבים אקראיים ניתנים לניצחון', 0, make(S.spaceReturn, {}).auditLevels(300), 0);
  });

  /* A card that is still open must not show its answer on the stage. Canvas text is checked by eye: this covers the DOM. */
  await test('פרק 7: כרטיס נעול לא מגלה את התשובה', async function () {
    function built(factory, opts) {
      var sim = make(factory, opts);
      return { sim: sim, ctl: T.stage.lastElementChild };
    }
    function values(ctl) { return [].map.call(ctl.querySelectorAll('.r-value'), function (e) { return e.textContent; }); }
    function labels(ctl) { return [].map.call(ctl.querySelectorAll('.r-label'), function (e) { return e.textContent; }).join('|'); }

    var a = built(S.astronaut, {});
    var away = [].filter.call(a.ctl.querySelectorAll('button'), function (b) { return b.textContent === 'לזרוק הרחק מהחללית'; })[0];
    same('האסטרונאוט נעול: התשובה הנכונה לא מודגשת', false, away.classList.contains('btn-primary'));
    a.sim.setParam('locked', false);
    same('האסטרונאוט פתוח: הכפתור מודגש', true, away.classList.contains('btn-primary'));

    var e = built(S.eggDrop, {});
    var eggSlider = e.ctl.querySelector('.slider');
    same('ביצים נעול: זמן העצירה מוסתר', true, eggSlider.hidden);
    e.sim.setParam('locked', false);
    same('ביצים פתוח: זמן העצירה גלוי', false, eggSlider.hidden);

    var hm = built(S.comFlight, { shape: 'hammer', locked: true });
    await T.settle();
    same('פטיש נעול: הקריאה לא נותנת את שם הנקודה', false, labels(hm.ctl).indexOf('מרכז מסה') >= 0);
    same('פטיש נעול: בלי מיקום', '?', values(hm.ctl)[0]);

    var r = built(S.comFlight, { shape: 'ring', locked: true });
    await T.settle();
    same('טבעת נעולה: בלי מיקום', '?', values(r.ctl)[0]);
    same('טבעת נעולה: בלי גובה', '?', values(r.ctl)[1]);
    await run(r.sim.play());
    same('טבעת אחרי ריצה: יש מיקום', true, values(r.ctl)[0] !== '?');
    r.sim.setParam('locked', false);
    r.sim.setParam('spin', 300);
    await T.settle();
    same('טבעת פתוחה לפני זריקה: יש מיקום', true, values(r.ctl)[0] !== '?');

    var c = built(S.collisionLab, { m1: 2, m2: 2, u1: 3, u2: -3, type: 'plastic', blind: true });
    await T.settle();
    same('מלכודת 2 נעולה: תנע כולל', '?', values(c.ctl)[2]);
    same('מלכודת 2 נעולה: אנרגיה', '?', values(c.ctl)[3]);
    same('מלכודת 2 נעולה: המהירות מהשאלה גלויה', true, values(c.ctl)[0] !== '?');
    await run(c.sim.play({}));
    same('מלכודת 2 אחרי ריצה: תנע כולל', true, values(c.ctl)[2] !== '?');
    same('מלכודת 2 אחרי ריצה: אנרגיה', true, values(c.ctl)[3] !== '?');

    var t = built(S.collisionLab, { m1: 1900, m2: 100, u1: 10, u2: 0, type: 'plastic', skin: 'truck', panel: 'force', tau: 0.1, world: 44 });
    same('מלכודת 3: שם הקריאה לא אומר שהכוח משותף', false, labels(t.ctl).indexOf('כל אחד') >= 0);
  });
});

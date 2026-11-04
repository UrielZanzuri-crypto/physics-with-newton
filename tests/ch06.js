/* Chapter 6 physics: every number comes from the running sim and is compared with the formula. */
PHY_T.load(['ch06/circle-kit.js', 'ch06/sling-cut.js', 'ch06/carousel.js', 'ch06/delta-v.js', 'ch06/who-pulls.js', 'ch06/curve-road.js', 'ch06/car-inside.js', 'ch06/bucket.js', 'ch06/loop-track.js', 'ch06/circle-lab.js', 'ch06/sling-game.js']);

PHY_T.add(async function (T) {
  var S = PHY.sims;

  await T.test('פרק 6: החוט נגזר', async function () {
    var s = T.make(S.slingCut, { v: 4, R: 2 });
    await T.run(s.play());
    var q = s.getState();
    T.same('התפוח יצא מהמסך', 'gone', q.phase);
    T.near('נגזר בזווית המתוכננת', 300, ((q.cut.deg % 360) + 360) % 360, 0.5);
    T.near('כיוון המעוף הוא המשיק', q.tangentDeg, q.flightDeg, 0.01);
    T.near('מהירות אחרי החיתוך', 4, q.speed, 1e-9);
    T.near('סטייה מקו ישר', 0, q.lineErr, 1e-6);
    var moved = Math.hypot(q.pos.x - q.cut.x, q.pos.y - q.cut.y);
    T.near('מרחק = מהירות כפול זמן', 4 * q.flightT, moved, 1e-6);
  });

  await T.test('פרק 6: קרוסלה', async function () {
    var s = T.make(S.carousel, { T: 4, R: 2 });
    await T.run(s.play());
    var q = s.getState();
    T.near('ω = 2π/T', Math.PI / 2, q.omega, 1e-6);
    T.near('v פנימי = 2πR/T', Math.PI, q.v1, 1e-6);
    T.near('v חיצוני = 2π(2R)/T', 2 * Math.PI, q.v2, 1e-6);
    T.near('v חיצוני / v פנימי', 2, q.v2 / q.v1, 1e-9);
    T.near('קשת בשנייה אחת, פנימי', Math.PI, q.arc1, 0.01);
    T.near('קשת בשנייה אחת, חיצוני', 2 * Math.PI, q.arc2, 0.01);
    var r = T.make(S.carousel, { mode: 'radian' });
    r.setParam('deg', 360);
    T.near('סיבוב שלם הוא 2π רדיאנים', 2 * Math.PI, r.getState().rad, 1e-9);
    r.setParam('deg', 180 / Math.PI);
    T.near('רדיאן אחד: קשת של רדיוס אחד', 1, r.getState().arcInRadii, 1e-9);
  });

  await T.test('פרק 6: Δv', async function () {
    var s = T.make(S.deltaV, { v: 4, R: 2 });
    await T.run(s.play());
    var q = s.getState();
    T.near('Δv מכוון למרכז', q.toCenterDeg, q.dvDeg, 0.01);
    T.near('אורך v₁ = v', 4, q.speed, 1e-9);
    T.near('אורך v₂ = v', 4, q.speed2, 1e-9);
    T.near('Δv/Δt בסוף הכיווץ', 8, q.ratio, 0.01);
    T.near('תאוצה מדודה מהתנועה', 8, q.aMeasured, 0.01);
    T.near('משולשים דומים: Δr/R = Δv/v', q.sim1, q.sim2, 1e-9);
    s.setParam('dt', 0.7);
    var wide = s.getState();
    T.near('גם במרווח גדול Δv מכוון למרכז', wide.toCenterDeg, wide.dvDeg, 0.01);
    T.same('במרווח גדול Δv/Δt קטן מ-v²/R', true, wide.ratio < 8);

    var b = T.make(S.deltaV, { mode: 'scale' });
    await T.run(b.play());
    var st = b.getState();
    T.near('v = 4 מ/ש, R = 2 מ\'', 8, st.bars[0], 1e-6);
    T.near('v×2: פי 4', 32, st.bars[1], 1e-6);
    T.near('R×2: חצי', 4, st.bars[2], 1e-6);
    await T.settle();
    b.setParam('v', 8); b.setParam('R', 2);
    await T.settle(); await T.settle();
    T.near('תאוצה מדודה ב-8 מ/ש, 2 מ\'', 32, b.getState().aMeasured, 0.05);
  });

  await T.test('פרק 6: מי מושך', async function () {
    var g = T.make(S.whoPulls, { scene: 'string' });
    T.near('חוט: mv²/R', 1.8, g.getState().F, 1e-9);
    g.setParam('scene', 'road');
    T.near('כביש: mv²/R', 4500, g.getState().F, 1e-6);
    g.setParam('scene', 'moon');
    T.near('ירח: v²/R', 0.0028, g.getState().a, 0.0001);
    g.setParam('scene', 'wall');
    T.near('תוף: mv²/R', 90, g.getState().F, 1e-9);

    var s = T.make(S.whoPulls, { scene: 'table', mu: 0.4 });
    await T.run(s.play());
    var c = s.cats();
    T.near('חיצוני עף ב-ω = √(μg/R)', Math.sqrt(4 / 2), c[1].wSlip, 0.01);
    T.near('פנימי עף ב-ω = √(μg/R)', Math.sqrt(4 / 1), c[0].wSlip, 0.01);
    T.near('חיצוני: v²/R ברגע העזיבה', 4, (c[1].vSlip * c[1].vSlip) / 2, 0.02);
    T.near('פנימי: v²/R ברגע העזיבה', 4, (c[0].vSlip * c[0].vSlip) / 1, 0.02);
    T.same('החיצוני עף ראשון', true, c[1].wSlip < c[0].wSlip);
    T.same('הם באמת עזבו את הצלחת', true, Math.hypot(c[1].x, c[1].y) > 2.2);
  });

  await T.test('פרק 6: סיבוב בכביש', async function () {
    var s = T.make(S.curveRoad, { v: 18, R: 50, pair: true });
    await T.run(s.play({ v: 18 }));
    var a = s.getState();
    T.near('v מרבית: √(μgR) ב-μ = 0.8', 20, a.vMax, 1e-9);
    T.same('18 מ/ש מחזיק', 'held', a.result);
    T.same('שניהם עברו', 'end,end', a.cars.map(function (c) { return c.mode; }).join(','));
    T.near('מכונית: צריך mv²/R', 6480, a.cars[0].need, 1e-6);
    T.near('משאית: צריך mv²/R', 25920, a.cars[1].need, 1e-6);
    await T.run(s.play({ v: 22 }));
    var b = s.getState();
    T.same('22 מ/ש מחליק', 'skid', b.result);
    T.same('שניהם מחליקים', 'stop,stop', b.cars.map(function (c) { return c.mode; }).join(','));
    T.near('המשאית והמכונית נעצרות באותו מקום', b.cars[0].x, b.cars[1].x, 0.5);
    T.near('יחס צריך ליש, מכונית', 9.68 / 8, b.cars[0].need / b.cars[0].limit, 1e-6);
    T.near('יחס צריך ליש, משאית', 9.68 / 8, b.cars[1].need / b.cars[1].limit, 1e-6);
    T.near('נשארו על קו ישר', 0, b.cars[0].y, 1e-9);

    var w = T.make(S.curveRoad, { v: 14, R: 50, wet: true });
    await T.run(w.play({ v: 14 }));
    T.near('רטוב, μ = 0.4: v מרבית', Math.sqrt(200), w.getState().vMax, 1e-9);
    T.same('רטוב, 14 מ/ש מחזיק', 'held', w.getState().result);
    await T.run(w.play({ v: 15 }));
    T.same('רטוב, 15 מ/ש מחליק', 'skid', w.getState().result);

    var r = T.make(S.curveRoad, { mode: 'bank', R: 50 });
    r.setParam('deg', 37);
    var q = r.getState();
    T.near('שיפוע 37°: v² = gR tanθ', Math.sqrt(10 * 50 * 0.75), q.vIdeal, 1e-6);
    r.setParam('v', q.vIdeal);
    T.near('במהירות הזאת לא צריך חיכוך', 0, r.getState().f, 1e-6);
    T.near('N = mg/cosθ', 10000 / 0.8, r.getState().N, 1e-6);
  });

  await T.test('פרק 6: הדלת ומד המהירות', async function () {
    var d = T.make(S.carInside, { mode: 'door' });
    await T.run(d.play({ frame: 'road' }));
    var q = d.getState();
    T.same('הדלת פגשה אותו', true, q.contact);
    T.near('לפני המגע הוא בקו ישר', 0, q.sideways, 1e-9);
    T.near('כוח הדלת: m ω² r, ברדיוס שבו ניוטון צמוד לדלת', 5 * (10 / 16) * (10 / 16) * 17.5, q.door, 1e-9);
    /* the gap closes as R(1 - cos a) ≈ 1.5 m with R = 16 m */
    T.near('זווית המגע', 25, q.contactDeg, 2);

    var m = T.make(S.carInside, { mode: 'meter' });
    await T.run(m.play());
    var s = m.getState();
    T.near('מד מהירות מינימום', 20, s.speedMin, 0.02);
    T.near('מד מהירות מקסימום', 20, s.speedMax, 0.02);
    T.near('בסיבוב: a = v²/R', 4, s.aMax, 0.01);
    T.near('בקטע הישר: a = 0', 0, s.aStraight, 1e-9);
    T.near('הטיית התפוח: tanθ = a/g', (Math.atan(0.4) * 180) / Math.PI, s.tiltOnArc, 0.5);
  });

  await T.test('פרק 6: הדלי', async function () {
    var b = T.make(S.bucket, { R: 1, m: 1 });
    await T.run(b.play({ vTop: Math.sqrt(10), revs: 1 }));
    var q = b.getState();
    T.near('v מינימלית = √(gR)', 3.162, q.vMin, 0.001);
    T.same('ב-√(gR) החוט לא נרפה', null, q.slack);
    T.near('בפסגה T = 0', 0, q.tTop, 1e-6);
    T.near('T מקסימלי, למטה: 6mg', 60, q.tMax, 0.05);
    T.same('יבש', false, q.spilled);

    await T.run(b.play({ vTop: 2 }));
    var w = b.getState();
    T.near('ב-2 מ/ש החוט נרפה ב-cosφ = -0.8', (Math.acos(-0.8) * 180) / Math.PI, w.slack.deg, 0.3);
    T.same('המים נשפכו', true, w.spilled);
    T.same('ניוטון נרטב', true, w.wet);

    /* Exam problem (b): 0.5 kg, 1 m, 5 m/s at the top */
    var e = T.make(S.bucket, { R: 1, m: 0.5 });
    await T.run(e.play({ vTop: 5, revs: 1 }));
    var x = e.getState();
    T.near('תרגיל: T בפסגה', 7.5, x.tTop, 1e-6);
    T.near('תרגיל: T למטה', 37.5, x.tMax, 0.05);
    T.near('תרגיל: v² למטה', 65, x.vBottom * x.vBottom, 1e-6);
    T.near('T למטה פחות T למעלה = 6mg', 30, x.tMax - x.tTop, 0.05);

    /* The trap: energy for v = 0 at the top is not enough for a string */
    var a = T.make(S.bucket, { R: 1, m: 1, payload: 'apple' });
    await T.run(a.play({ vBottom: Math.sqrt(40) }));
    var s = a.getState();
    T.near('החוט נרפה ב-cosφ = -2/3', (Math.acos(-2 / 3) * 180) / Math.PI, s.slack.deg, 0.3);
    T.near('בגובה 5R/3', 5 / 3, s.slack.height, 0.01);
    await T.run(a.play({ vBottom: Math.sqrt(50), revs: 1 }));
    T.same('עם v² = 5gR עובר', null, a.getState().slack);
    T.near('ומגיע לפסגה ב-√(gR)', Math.sqrt(10), a.getState().vTop, 1e-6);
  });

  await T.test('פרק 6: הלולאה', async function () {
    var s = T.make(S.loopTrack, { R: 2, h: 4, m: 5 });
    await T.run(s.play({ h: 4 }));
    var a = s.getState();
    T.same('h = 2R נכשל', 'fell', a.result);
    T.near('נושר ב-cosφ = -2/3', (Math.acos(-2 / 3) * 180) / Math.PI, a.detachDeg, 0.3);
    T.near('בגובה 5R/3', (5 / 3) * 2, a.detachY, 0.02);
    await T.run(s.play({ h: 5 }));
    var b = s.getState();
    T.same('h = 2.5R עובר', 'pass', b.result);
    T.near('v בפסגה = √(gR)', Math.sqrt(20), b.vTop, 1e-6);
    T.near('N בפסגה = 0', 0, b.nTop, 1e-6);
    T.near('N למטה = 6mg', 300, b.nBottom, 1e-6);
    await T.run(s.play({ h: 4.9 }));
    T.same('h = 2.45R נכשל', 'fell', s.getState().result);
    await T.run(s.play({ h: 6 }));
    T.near('h = 3R: N בפסגה = mg', 50, s.getState().nTop, 1e-6);
    /* The same 2.5 for another radius */
    var r = T.make(S.loopTrack, { R: 4, h: 10, m: 5 });
    await T.run(r.play({ h: 10 }));
    T.same('R = 4 מ\', h = 10 מ\' עובר', 'pass', r.getState().result);
    await T.run(r.play({ h: 9.8 }));
    T.same('R = 4 מ\', h = 9.8 מ\' נכשל', 'fell', r.getState().result);
  });

  await T.test('פרק 6: מגרש משחקים', async function () {
    var s = T.make(S.circleLab, { mode: 'table' });
    s.setParam('v', 4); s.setParam('R', 2); s.setParam('m', 1);
    await T.settle();
    var q = s.getState();
    T.near('F = mv²/R', 8, q.F, 1e-9);
    T.near('T = 2πR/v', Math.PI, q.T, 1e-9);
    T.same('החוט שלם', false, q.broken);
    s.setParam('v', 7); s.setParam('R', 1);
    await T.settle(); await T.settle();
    q = s.getState();
    T.near('v = 7 מ/ש, R = 1 מ\': 49 ניוטון', 49, q.F, 1e-9);
    T.same('החוט נקרע מעל 40 ניוטון', true, q.broken);
    T.near('אחרי הקריעה המהירות נשמרת', 7, Math.hypot(q.vel.x, q.vel.y), 1e-9);

    s.setParam('mode', 'cone');
    s.setParam('L', 1); s.setParam('deg', 37); s.setParam('cm', 2);
    await T.settle(); await T.settle();
    var c = s.getState();
    T.near('תרגיל: R = L sinθ', 0.6, c.R, 1e-6);
    T.near('תרגיל: v = √(gR tanθ)', 2.1213, c.v, 0.001);
    T.near('תרגיל: T = 2πR/v', 1.777, c.period, 0.001);
    T.near('מהירות מדודה מהתנועה', c.v, c.measured, 0.01);
    T.near('מתיחות mg/cosθ', 25, c.tension, 1e-6);
    T.near('הכוח למרכז mg tanθ', 15, c.net, 1e-6);
    s.setParam('cm', 3);
    await T.settle();
    T.near('מסה אחרת: אותה מהירות', c.v, s.getState().v, 1e-9);
  });

  /* A seeded Math.random, so that a failure can be reproduced. */
  function seeded(seed) {
    var x = seed;
    return function () { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  }
  function bestRelease(sols) {
    var set = {}; sols.forEach(function (d) { set[d] = true; });
    var best = null, bestN = 0;
    sols.forEach(function (d) {
      if (set[(d + 359) % 360]) return;
      var n = 1; while (set[(d + n) % 360] && n < 360) n++;
      if (n > bestN) { bestN = n; best = (d + (n - 1) / 2) % 360; }
    });
    return { deg: best, width: bestN };
  }
  async function aim(sim, deg) {
    var guard = 0;
    while (guard++ < 2000) {
      var d = Math.abs(((sim.getState().phi - deg + 540) % 360) - 180);
      if (d <= 1.2) return true;
      sim.advance(1 / 120);
    }
    return false;
  }

  await T.test('פרק 6: הקלע, פותר אוטומטי', async function () {
    var real = Math.random;
    try {
      var seeds = [11, 202, 3303, 40404, 505];
      for (var si = 0; si < seeds.length; si++) {
        Math.random = seeded(seeds[si]);
        var done = null;
        var sim = T.make(S.slingGame, { onDone: function (stars, total) { done = { stars: stars, total: total }; } });
        var minWidth = 360;
        for (var lev = 0; lev < 3; lev++) {
          var st = sim.getState();
          if (st.kind === 'stop') sim.setParam('v', st.fairSpeed);
          st = sim.getState();
          var sols = sim.solutions();
          var pick = bestRelease(sols);
          minWidth = Math.min(minWidth, pick.width);
          await aim(sim, pick.deg);
          var r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
          T.same('זרע ' + seeds[si] + ', שלב ' + (lev + 1) + ': פגיעה', true, r.hit);
          T.same('זרע ' + seeds[si] + ', שלב ' + (lev + 1) + ': 3 נקודות', 3, sim.getState().points[lev]);
          sim.next();
          await T.settle();
        }
        T.same('זרע ' + seeds[si] + ': שלושה כוכבים', 3, done && done.stars);
        T.same('זרע ' + seeds[si] + ': חלון שחרור של 10° לפחות', true, minWidth >= 10);
      }
    } finally { Math.random = real; }
  });

  await T.test('פרק 6: הקלע, קלט רע מפסיד', async function () {
    var real = Math.random;
    try {
      Math.random = seeded(777);
      var done = null;
      var sim = T.make(S.slingGame, { onDone: function (stars) { done = stars; } });
      var st = sim.getState();
      /* L1: release at the angle that points right at the basket, the classic wrong idea */
      var toward = (((Math.atan2(st.target.y, st.target.x) * 180) / Math.PI) + 360) % 360;
      await aim(sim, toward);
      var r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('שלב 1: לשחרר כשהחוט מצביע על הסל מחטיא', false, r.hit);
      T.same('נספר ניסיון', 1, sim.getState().attempts);
      T.same('חוזרים לסיבוב', 'whirl', sim.getState().phase);
      var ideal = sim.idealDeg();
      await aim(sim, (ideal + 180) % 360);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('שחרור הפוך מחטיא', false, r.hit);
      await aim(sim, (ideal + 70) % 360);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('שחרור מאוחר ב-70° מחטיא', false, r.hit);
      await aim(sim, ideal);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('הניסיון הרביעי פוגע', true, r.hit);
      T.same('ארבעה ניסיונות, 2 נקודות', 2, sim.getState().points[0]);
      sim.next();
      await T.settle();
      /* L2: every wall gets hit from a release that points the apple into it */
      var s2 = sim.getState();
      T.same('שלב 2 הוא חומה', 'gate', s2.kind);
      var sols = sim.solutions();
      T.same('רק חלק מנקודות השחרור עובדות', true, sols.length > 0 && sols.length < 60);
      var badDeg = null;
      for (var d = 0; d < 360 && badDeg === null; d += 5) {
        var a = (d * Math.PI) / 180;
        var dirx = -Math.sin(a), diry = Math.cos(a);
        var g = s2.walls[0];
        var mx = (g.a.x + g.b.x) / 2 - 1.4 * Math.cos(a), my = (g.a.y + g.b.y) / 2 - 1.4 * Math.sin(a);
        if (((mx * dirx + my * diry) / Math.hypot(mx, my)) > 0.99) badDeg = d;
      }
      await aim(sim, badDeg);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('שחרור שמכוון לחומה נעצר בה', true, r.wall);
      T.same('וזו החטאה', false, r.hit);
      var pick = bestRelease(sim.solutions());
      await aim(sim, pick.deg);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('שלב 2: דרך הפתח פוגע', true, r.hit);
      sim.next();
      await T.settle();
      /* L3: a good direction with the wrong speed stops outside the ring */
      var s3 = sim.getState();
      T.same('שלב 3 הוא טבעת', 'stop', s3.kind);
      var fair = s3.fairSpeed;
      T.near('המהירות הנכונה: d = v²/2a', s3.tangentLength, (fair * fair) / (2 * s3.aFriction), 0.4);
      sim.setParam('v', Math.max(1.5, fair - 1));
      T.same('מהירות נמוכה מדי: אין שום שחרור מנצח', 0, sim.solutions().length);
      await aim(sim, sim.idealDeg());
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('מהירות נמוכה עוצרת קצר', true, r.stopped && !r.hit);
      sim.setParam('v', fair);
      pick = bestRelease(sim.solutions());
      await aim(sim, pick.deg);
      r = await new Promise(function (res) { var pr = sim.release(); sim.advance(30); pr.then(res); });
      T.same('מהירות נכונה עוצרת בטבעת', true, r.hit);
      sim.next();
      await T.settle();
      T.same('המשחק מסתיים ומחזיר כוכבים', true, done >= 1 && done <= 3);
    } finally { Math.random = real; }
    var audit = T.make(S.slingGame, {}).auditLevels(30);
    audit.forEach(function (a) {
      T.same('שלב ' + a.level + ': כל הרמות ניתנות לניצחון', 0, a.unwinnable);
      T.same('שלב ' + a.level + ': חלון של 12° לפחות', true, a.minDegrees >= 12);
    });
  });
});

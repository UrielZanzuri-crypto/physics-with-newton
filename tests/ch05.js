/* Chapter 5: key numbers measured from the running sims, against the formulas, plus the game solver. */
PHY_T.load([
  'ch05/energy.js', 'ch05/slides.js', 'ch05/work-lab.js', 'ch05/braking.js', 'ch05/lift-paths.js',
  'ch05/drop-bars.js', 'ch05/bowl.js', 'ch05/spring-launcher.js', 'ch05/loop.js', 'ch05/coaster.js', 'ch05/newton-track.js',
]);
PHY_T.add(async function (T) {
  var S = PHY.sims, M = PHY.ch05;

  await T.test('פרק 5: רכיב על מסילה', async function () {
    /* A straight incline against the textbook answer: a = g sin(alpha), t = sqrt(2L / a). */
    var track = M.Track(M.line(0, 5, 5, 0, 60));
    var r = M.Rider(track, { s: 0, v: 0 });
    for (var i = 0; i < 2000 && !r.stopped; i++) r.step(1 / 120);
    T.near('מישור 45°: מהירות בתחתית', 10, Math.abs(r.v), 0.001);
    T.near('מישור 45°: זמן הירידה', Math.sqrt(2) , r.tEnd, 0.002);
    T.same('הגיע לקצה', 'finish', r.end);
    /* The rail with curvature: the free-fall speed law at every height. */
    var c = M.Track(M.fn(function (x) { return 5 * Math.pow(1 - x / 9, 1.8); }, 0, 9, 200));
    var q = M.Rider(c, { s: 0, v: 0 });
    var worst = 0;
    for (var j = 0; j < 2000 && !q.stopped; j++) {
      q.step(1 / 120);
      worst = Math.max(worst, Math.abs(Math.abs(q.v) - Math.sqrt(Math.max(0, 2 * 10 * (5 - c.at(q.s).y)))));
    }
    T.near('מהירות מהאנרגיה, סטייה מרבית', 0, worst, 1e-9);
    /* A flat rough floor: v^2 = v0^2 - 2 mu g d. */
    var f = M.Track(M.line(0, 0, 40, 0, 400));
    var g = M.Rider(f, { s: 0, v: 10, mu: function () { return 0.25; } });
    for (var k = 0; k < 4000 && !g.stopped; k++) g.step(1 / 120);
    T.near('10 מ/ש על רצפה עם μ = 0.25: מרחק עצירה', 20, g.s, 0.02);
    T.near('החום שווה לאנרגיה שאבדה, לכל ק"ג', 50, g.heat, 0.01);
    /* The monotone curve through control points must not overshoot. */
    var pts = M.curveThrough([{ x: 0, y: 6 }, { x: 2, y: 1 }, { x: 3.5, y: 4 }, { x: 9, y: 0.5 }], 0.03);
    var hi = -Infinity, lo = Infinity;
    pts.forEach(function (p) { hi = Math.max(hi, p.y); lo = Math.min(lo, p.y); });
    T.near('העקומה לא חורגת למעלה', 6, hi, 1e-9);
    T.near('העקומה לא חורגת למטה', 0.5, lo, 1e-9);
  });

  await T.test('פרק 5: מגלשות', async function () {
    var a = T.make(S.slides, { mode: 'race' });
    await T.run(a.play());
    var s = a.getState();
    s.list.forEach(function (d) { T.near('מהירות בתחתית, ' + d.key, 10, d.vEnd, 0.01); });
    var byKey = {};
    s.list.forEach(function (d) { byKey[d.key] = d; });
    T.near('מגלשה תלולה, זמן: L / 5', Math.sqrt(50) / 5, byKey.steep.tEnd, 0.01);
    T.near('מגלשה מתונה, זמן: L / 5', Math.sqrt(250) / 5, byKey.gentle.tEnd, 0.01);
    T.same('התלולה ראשונה', 1, byKey.steep.order);
    T.same('המתונה אחרונה', 3, byKey.gentle.order);
    var analytic = 0;
    var tr = M.Track(M.fn(function (x) { var u = x / 10; return 5 * (1 - u) - 0.8 * Math.sin(2 * Math.PI * u); }, 0, 10, 300));
    for (var si = 0.0005; si < tr.length; si += 0.001) analytic += 0.001 / Math.sqrt(2 * 10 * (5 - tr.at(si).y));
    T.near('מתפתלת: זמן מול אינטגרל ds/v', analytic, byKey.curvy.tEnd, 0.02);
    T.same('המתפתלת באמצע', 2, byKey.curvy.order);

    var m = T.make(S.slides, { mode: 'mass' });
    await T.run(m.play());
    var ms = m.getState();
    T.near('כבד: 10 מ/ש', 10, ms.list[1].vEnd, 0.01);
    T.near('קל: 10 מ/ש', 10, ms.list[0].vEnd, 0.01);
    T.near('אותו זמן, קל מול כבד', ms.list[0].tEnd, ms.list[1].tEnd, 1e-9);
    T.near('קל: 250 ג\'ול', 250, ms.list[0].ke, 0.5);
    T.near('כבד: 1000 ג\'ול', 1000, ms.list[1].ke, 2);

    var n = T.make(S.slides, { mode: 'normal' });
    await T.run(n.play());
    var ns = n.getState();
    T.near('עבודת הכוח הנורמלי', 0, ns.Wn, 0.5);
    T.near('עבודת הכבידה: mgh', 250, ns.Wg, 0.01);
    T.near('הקינטית שווה לעבודת הכבידה', ns.Wg, ns.list[0].ke, 0.5);
  });

  await T.test('פרק 5: עבודה', async function () {
    var c = T.make(S.workLab, { scene: 'suitcase', locked: false });
    await T.run(c.play());
    var s = c.getState();
    T.near('מזוודה, הליכה 10 מ\'', 10, s.x, 1e-6);
    T.near('עבודת היד בהליכה', 0, s.W, 1e-9);
    T.near('עייפות מלאה בסוף', 1, s.tired, 1e-6);
    await T.run(c.moveCase(1));
    T.near('הרמה 1 מ\': 200 ג\'ול', 200, c.getState().W, 1e-6);
    await T.run(c.moveCase(-1));
    T.near('ואחרי הורדה: חזרה ל-0', 0, c.getState().W, 1e-6);

    var p = T.make(S.workLab, { scene: 'pull', force: 100, angle: 0 });
    var cases = [[0, 1000], [37, 798.6], [60, 500], [90, 0], [120, -500], [180, -1000]];
    for (var i = 0; i < cases.length; i++) {
      p.setParam('angle', cases[i][0]);
      await T.run(p.play());
      T.near('100 ניוטון, 10 מ\', זווית ' + cases[i][0], cases[i][1], p.getState().W, 0.1);
    }

    var t = T.make(S.workLab, { scene: 'stairs', locked: false });
    await T.run(t.play());
    var st = t.getState();
    T.near('מדרגות, הולך: 200 ג\'ול', 200, st.wA, 1e-6);
    T.near('מדרגות, רץ: 200 ג\'ול', 200, st.wB, 1e-6);
    T.near('הולך: 50 ואט', 50, st.pA, 1e-6);
    T.near('רץ: 100 ואט', 100, st.pB, 1e-6);
  });

  await T.test('פרק 5: בלימה', async function () {
    var b = T.make(S.braking, { mode: 'brake', v2: 40, locked: false });
    await T.run(b.play());
    var s = b.getState();
    T.near('מ-20 מ/ש: 20 מ\'', 20, s.d1, 0.01);
    T.near('מ-40 מ/ש: 80 מ\'', 80, s.d2, 0.01);
    T.near('עבודת הבלמים מול 200 אלף ג\'ול', s.ke1, s.W1, 10);
    T.near('עבודת הבלמים מול 800 אלף ג\'ול', s.ke2, s.W2, 10);
    b.setParam('v2', 30);
    await T.run(b.play());
    T.near('מ-30 מ/ש: 45 מ\'', 45, b.getState().d2, 0.01);

    var o = T.make(S.braking, { mode: 'boost', locked: false });
    await T.run(o.play());
    var q = o.getState();
    T.near('מ-0 ל-10 מ/ש: 5000 ג\'ול', 5000, q.boost1, 0.01);
    T.near('מ-10 ל-20 מ/ש: 15000 ג\'ול', 15000, q.boost2, 0.01);
    T.near('נסיעה עד 10 מ/ש: 10 מ\'', 10, q.mark, 1e-6);
    T.near('סך הנסיעה: 40 מ\'', 40, q.x, 1e-6);
  });

  await T.test('פרק 5: הרמה בשלושה מסלולים', async function () {
    var l = T.make(S.liftPaths, {});
    var keys = ['up', 'ramp', 'wave'];
    for (var i = 0; i < keys.length; i++) {
      l.setParam('path', keys[i]);
      await T.run(l.play());
      var s = l.getState();
      T.near('עבודה במסלול ' + keys[i] + ': mgh', 500, s.W, 1e-6);
    }
    T.same('שלושה מסלולים הושלמו', 3, Object.keys(l.getState().results).length);
    /* The wave goes down on the way: part way, the work is less than it was. */
    l.setParam('path', 'wave');
    var peak = -1, later = 0, top = l.getState().length;
    for (var d = 0; d <= top; d += 0.1) {
      l.setParam('s', d);
      var st = l.getState();
      if (st.W > peak) peak = st.W;
      later = Math.min(peak, st.W) === st.W && st.W < peak - 20 ? st.W : later;
    }
    T.same('בירידה בגל העבודה יורדת', true, later > 0);
    /* The hand holds the crate back from sliding, so its arrow points uphill even where the crate goes down. */
    l.setParam('path', 'wave');
    var downs = 0, ups = 0, notUphill = 0, wrongOnDescent = 0, wrongOnAscent = 0;
    var prev = l.getState();
    for (var w = 0.1; w < top; w += 0.1) {
      l.setParam('s', w);
      var now = l.getState(), dy = now.y - prev.y;
      if (Math.abs(dy) > 0.03) {
        if (now.hand.y <= 0) notUphill++;
        if (dy < 0) {
          downs++;
          if (now.hand.x >= 0 || now.W >= prev.W) wrongOnDescent++;
        } else {
          ups++;
          if (now.hand.x <= 0 || now.W <= prev.W) wrongOnAscent++;
        }
      }
      prev = now;
    }
    T.same('גל: יש קטעי ירידה וקטעי עלייה', true, downs > 5 && ups > 5);
    T.same('גל: חץ היד תמיד במעלה המסלול', 0, notUphill);
    T.same('גל, ירידה: חץ היד נגד התנועה והעבודה יורדת', 0, wrongOnDescent);
    T.same('גל, עלייה: חץ היד עם התנועה והעבודה עולה', 0, wrongOnAscent);
    l.setParam('path', 'ramp');
    T.near('רמפה: 11.18 מ\' מסלול', Math.sqrt(125), l.getState().length, 0.01);
    l.setParam('s', 2);
    T.near('רמפה: כוח mg sin', 100 * 5 / Math.sqrt(125), l.getState().force, 0.01);
    [-2, 0, 3, 5].forEach(function (z) {
      l.setParam('zero', z);
      var g = l.getState();
      T.near('רמת אפס ' + z + ': הפרש מדף-רצפה', 500, g.peShelf - g.peFloor, 1e-9);
    });
  });

  await T.test('פרק 5: נפילה ואנרגיה', async function () {
    var d = T.make(S.dropBars, { height: 20, locked: false });
    var totals = [];
    var pr = d.play();
    var done = false;
    pr.then(function () { done = true; });
    for (var i = 0; i < 2000 && !done; i++) {
      window.__frame();
      await Promise.resolve();
      if (i % 3 === 0) totals.push(d.getState().total);
      if (i % 200 === 0) await new Promise(function (r) { setTimeout(r, 0); });
    }
    var s = d.getState();
    T.near('מהירות בחצי גובה', Math.sqrt(200), s.halfV, 0.01);
    T.near('זמן עד חצי גובה', Math.SQRT2, s.halfT, 0.01);
    T.near('מהירות בתחתית', 20, s.v, 0.001);
    var lo = Math.min.apply(null, totals), hi = Math.max.apply(null, totals);
    T.near('הסכום נשמר, מינימום', 800, lo, 0.1);
    T.near('הסכום נשמר, מקסימום', 800, hi, 0.1);
  });

  await T.test('פרק 5: קערה עם חיכוך', async function () {
    var b = T.make(S.bowl, { locked: false });
    await T.run(b.play());
    var s = b.getState();
    T.near('פסגה 1', 3.8, s.peaks[0], 0.01);
    T.near('פסגה 2', 2.6, s.peaks[1], 0.01);
    T.near('פסגה 3', 1.4, s.peaks[2], 0.01);
    T.near('פסגה 4', 0.2, s.peaks[3], 0.01);
    T.near('דרך על המשטח: h / μ', 12.5, s.roughPath, 0.02);
    T.near('חום בסוף', 100, s.heat, 0.1);
    T.near('סך האנרגיה נשמר', 100, s.total, 0.1);
    T.near('הפסד למעבר: μmgL', 24, 2 * 10 * (s.peaks[0] - s.peaks[1]), 0.2);
    T.near('המעברים שווים', s.peaks[0] - s.peaks[1], s.peaks[1] - s.peaks[2], 0.01);

    var t = T.make(S.bowl, { locked: false, mu: 0.8, thermal: true, speed: 1.3 });
    await T.run(t.play());
    var q = t.getState();
    T.near('מלכודת: כל 100 הג\'ול בחום', 100, q.heat, 0.1);
    T.near('מלכודת: אין קינטית', 0, q.ke, 0.01);
    T.near('מלכודת: אין גובה', 0, q.pe, 0.01);
    /* Twice the patch length, half the crossings: friction work depends on the path. */
    var u = T.make(S.bowl, { locked: false, L: 6 });
    await T.run(u.play());
    T.near('משטח כפול: פסגה ראשונה', 2.6, u.getState().peaks[0], 0.01);
  });

  await T.test('פרק 5: קפיץ', async function () {
    var c = T.make(S.springLauncher, { k: 500, m: 5, locked: false });
    await T.run(c.playDouble(0.5));
    var mk = c.getState().marks;
    T.near('כיווץ 0.5 מ\': 5 מ/ש', 5, mk[0].v, 0.02);
    T.near('כיווץ 0.5 מ\': 1.25 מ\'', 1.25, mk[0].h, 0.01);
    T.near('כיווץ 1 מ\': 10 מ/ש', 10, mk[1].v, 0.02);
    T.near('כיווץ 1 מ\': 5 מ\'', 5, mk[1].h, 0.01);
    T.near('פי 2 במהירות', 2, mk[1].v / mk[0].v, 0.01);
    T.near('פי 4 בגובה', 4, mk[1].h / mk[0].h, 0.01);
    var e = T.make(S.springLauncher, { k: 800, m: 0.5, x: 0.1, locked: false });
    await T.run(e.play(0.1));
    var q = e.getState();
    T.near('שאלת מכינה: 4 ג\'ול', 4, q.spring, 1e-9);
    T.near('שאלת מכינה: 4 מ/ש', 4, q.launchV, 0.02);
    T.near('שאלת מכינה: 0.8 מ\'', 0.8, q.hMax, 0.01);
    /* Off the ramp's end only the upward part of the speed still climbs: 8.6 m + sin^2(69 deg) * (36 m - 8.6 m). */
    var o = T.make(S.springLauncher, { k: 500, m: 1, locked: false });
    await T.run(o.play(1.2));
    var os = o.getState();
    T.same('קל וכיווץ גדול: עף מקצה הרמפה', true, os.over);
    T.near('גובה מרבי אחרי המעוף', 32.52, os.hMax, 0.1);
  });

  await T.test('פרק 5: כרטיס נעול לא מגלה את התשובה, ואחריו הכול חוזר', async function () {
    function read(ctl, label) {
      var boxes = ctl.querySelectorAll('.readout');
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].querySelector('.r-label').textContent === label) return boxes[i].querySelector('.r-value').textContent;
      }
      return null;
    }
    var c = T.make(S.workLab, { scene: 'suitcase', locked: true }), cc = T.stage.lastChild;
    await T.settle();
    T.same('מזוודה נעולה: עבודת היד', '?', read(cc, 'עבודת היד'));
    await T.run(c.play());
    c.setParam('locked', false);
    await T.settle();
    T.same('מזוודה אחרי הריצה: 0 ג\'ול', '0', read(cc, 'עבודת היד').replace(/[^0-9.]/g, ''));
    await T.run(c.moveCase(1));
    T.near('מזוודה במשחק חופשי: הרמה', 200, c.getState().W, 1e-6);

    var n = T.make(S.slides, { mode: 'normal', locked: true }), nc = T.stage.lastChild;
    await T.settle();
    T.same('נורמלי נעול: עבודת N', '?', read(nc, 'עבודת הכוח הנורמלי'));
    await T.run(n.play());
    n.setParam('locked', false);
    await T.settle();
    T.same('נורמלי אחרי הריצה: מספר', true, /\d/.test(read(nc, 'עבודת הכוח הנורמלי')));

    var b = T.make(S.bowl, { locked: true }), bc = T.stage.lastChild;
    await T.settle();
    T.same('קערה נעולה: הפסד בכל מעבר', '?', read(bc, 'הפסד בכל מעבר'));
    await T.run(b.play());
    b.setParam('locked', false);
    b.setParam('L', 6);
    await T.settle();
    T.same('קערה במשחק חופשי: 48 ג\'ול', true, read(bc, 'הפסד בכל מעבר').indexOf('48') >= 0);

    var l = T.make(S.loopTheLoop, { R: 2, height: 4, locked: true }), lc = T.stage.lastChild;
    await T.settle();
    T.same('לולאה נעולה: המילה ניתוק לא מופיעה', -1, lc.textContent.indexOf('ניתוק'));
    await T.run(l.play());
    l.setParam('locked', false);
    await T.settle();
    T.same('לולאה אחרי הריצה: גובה הניתוק', true, (read(lc, 'גובה הניתוק') || '').indexOf('3.33') >= 0);
  });

  await T.test('פרק 5: הלולאה', async function () {
    var a = T.make(S.loopTheLoop, { R: 2, height: 4, locked: false });
    await T.run(a.play());
    var s = a.getState();
    T.same('מגובה 2R: נופל', 'fell', s.result);
    T.near('גובה הניתוק: 5R/3', 10 / 3, s.sepY, 0.02);
    T.near('מהירות בניתוק', Math.sqrt(2 * 10 * (4 - 10 / 3)), s.sepV, 0.02);
    var cases = [[4.9, 'fell'], [5, 'cleared'], [6, 'cleared']];
    for (var i = 0; i < cases.length; i++) {
      var b = T.make(S.loopTheLoop, { R: 2, height: cases[i][0], locked: false });
      await T.run(b.play());
      T.same('מגובה ' + cases[i][0] + ' מ\'', cases[i][1], b.getState().result);
      if (cases[i][1] === 'cleared') T.near('מהירות בפסגה מהאנרגיה', Math.sqrt(2 * 10 * (cases[i][0] - 4)), b.getState().vTop, 0.05);
    }
  });

  await T.test('פרק 5: בונה הרכבת', async function () {
    var c = T.make(S.coaster, {});
    c.ride();
    var worstE = 0, st, top = 0;
    for (var i = 0; i < 40 * 120; i++) {
      c.advance(1 / 120);
      st = c.getState();
      worstE = Math.max(worstE, Math.abs(st.ke + st.pe - st.startE));
      top = Math.max(top, st.y);
    }
    T.near('בלי חיכוך, 40 ש\': סטיית אנרגיה מרבית', 0, worstE, 0.6);
    T.same('לא עלה מעל נקודת ההתחלה', true, top <= st.pts[0].y + 0.005);
    T.same('עדיין על המסילה', true, st.s >= 0 && st.s <= st.length);

    /* Hostile shapes: every rail, thousands of steps, no divergence and no escape. */
    var bad = 0;
    for (var seed = 0; seed < 40; seed++) {
      c.randomize();
      c.setParam('friction', seed % 2 === 1);
      c.ride();
      for (var t = 0; t < 2400; t++) {
        c.advance(1 / 120);
        var g = c.getState();
        var sum = g.ke + g.pe + (g.friction ? g.heat : 0);
        if (!isFinite(g.s) || !isFinite(g.v) || g.s < -1e-6 || g.s > g.length + 1e-6 || Math.abs(sum - g.startE) > 1.5) bad++;
      }
    }
    T.same('40 מסלולים אקראיים: צעדים חריגים', 0, bad);

    /* Friction on the same rail: the cart ends up at rest, and the heat holds the difference. */
    c.reset();
    c.setParam('friction', true);
    c.ride();
    c.advance(120);
    var f = c.getState();
    T.same('עם חיכוך הוא נעצר', true, f.stopped);
    T.near('חום ועוד גובה שווים לאנרגיה בהתחלה', f.startE, f.heat + f.pe, 1.5);

    /* A start lower than the next hill: he stays put, and says so. */
    c.setParam('friction', false);
    c.setPoints([{ x: 0, y: 1 }, { x: 5, y: 4 }, { x: 10, y: 2 }, { x: 20, y: 3 }]);
    c.ride();
    c.advance(5);
    T.same('התחלה בעלייה: לא זז', true, c.getState().stopped);
    /* Dragging limits keep x increasing, so the rail is always a function of x. */
    var ps = c.getState().pts, inc = true;
    for (var pi = 1; pi < ps.length; pi++) if (ps[pi].x <= ps[pi - 1].x) inc = false;
    T.same('נקודות בסדר עולה', true, inc);
  });

  await T.test('פרק 5: איפוס אמיתי, והבטחות שתמיד נסגרות', async function () {
    /* A second run must not inherit anything from the first. */
    var b = T.make(S.bowl, { locked: false, mu: 0.8, speed: 1.3 });
    await T.run(b.play());
    var first = b.getState();
    await T.run(b.play());
    var second = b.getState();
    T.same('קערה: אותו מספר פסגות בריצה שנייה', first.peaks.length, second.peaks.length);
    T.near('קערה: אותו חום בריצה שנייה', first.heat, second.heat, 0.01);
    var d = T.make(S.dropBars, { locked: false, height: 20 });
    await T.run(d.play());
    await T.run(d.play());
    T.near('נפילה: מהירות בחצי הגובה אחרי ריצה חוזרת', Math.sqrt(200), d.getState().halfV, 0.01);
    var l = T.make(S.loopTheLoop, { R: 2, height: 4, locked: false });
    await T.run(l.play());
    l.setParam('height', 6);
    T.same('לולאה: אחרי שינוי גובה אין ניתוק ישן', null, l.getState().sepY);
    await T.run(l.play());
    T.same('לולאה: מגובה 6 מ\' הוא עובר אחרי הנפילה', 'cleared', l.getState().result);
    var c = T.make(S.coaster, {});
    c.setParam('friction', true);
    c.ride();
    c.advance(5);
    T.same('רכבת: נוצר חום', true, c.getState().heat > 1);
    c.ride();
    T.near('רכבת: נסיעה חדשה מתחילה בלי חום', 0, c.getState().heat, 1e-9);

    /* A reset in the middle of a run settles the promise, so a card can never hang. */
    var cases = [
      [S.slides, { mode: 'race', locked: false }], [S.slides, { mode: 'normal', locked: false }],
      [S.workLab, { scene: 'suitcase', locked: false }], [S.workLab, { scene: 'pull' }], [S.workLab, { scene: 'stairs', locked: false }],
      [S.braking, { mode: 'brake', locked: false }], [S.braking, { mode: 'boost', locked: false }], [S.liftPaths, {}],
      [S.dropBars, { locked: false }], [S.bowl, { locked: false }], [S.springLauncher, { locked: false }], [S.loopTheLoop, { locked: false }],
    ];
    for (var i = 0; i < cases.length; i++) {
      var sim = T.make(cases[i][0], cases[i][1]);
      var pr = sim.play();
      for (var f = 0; f < 6; f++) { window.__frame(); await Promise.resolve(); }
      sim.reset();
      await T.run(pr, 200);
      T.same('נסגר אחרי איפוס באמצע ריצה, מקרה ' + (i + 1), true, true);
    }
  });

  await T.test('פרק 5: המשחק', async function () {
    var audit = T.make(S.newtonTrack, {}).auditLevels(200);
    audit.forEach(function (a) { T.same('שלב ' + a.level + ': לפחות 3 ערכים מנצחים ב-200 רמות', true, a.minValues >= 3); });

    async function solveLevel(g) {
      var s = g.getState(), L = s.level, res;
      if (L.kind === 0) {
        g.setParam('h', Math.round((L.low + 0.4) * 10) / 10);
        res = await runFire(g);
      } else if (L.kind === 1) {
        g.setParam('x', Math.round(((L.low + L.high) / 2) * 100) / 100);
        res = await runFire(g);
      } else {
        g.setPoint(0, Math.round((L.h0) * 10) / 10);
        g.setPoint(1, 1);
        g.setPoint(2, Math.round((L.rock + 0.2) * 10) / 10);
        g.setPoint(3, 0.8);
        res = await runFire(g);
      }
      return res;
    }
    async function runFire(g) {
      var out = null;
      await T.run(g.fire().then(function (r) { out = r; }));
      return out;
    }
    var wins = 0, total = 0;
    for (var seed = 0; seed < 12; seed++) {
      var g = T.make(S.newtonTrack, {});
      for (var l = 0; l < 3; l++) {
        total++;
        var r = await solveLevel(g);
        if (r && r.hit) wins++;
        g.next();
      }
      if (seed === 0) { T.same('שלושה כוכבים בניסיון ראשון', 3, g.getState().stars); T.same('סטטוס סיום', 'done', g.getState().phase); }
    }
    T.same('הפותר מנצח בכל שלב, 12 סבבים', total, wins);

    /* Bad inputs lose, each in its own way, and the numbers reported are the real ones. */
    var b = T.make(S.newtonTrack, {});
    var L = b.getState().level;
    b.setParam('h', Math.max(0.5, L.H - 0.3));
    var r1 = await runFire(b);
    T.same('שלב 1, נמוך מהגבעה', 'hill', r1.outcome);
    b.setParam('h', Math.round((L.H + (L.low - L.H) * 0.5) * 10) / 10 > L.H ? Math.round((L.H + (L.low - L.H) * 0.5) * 10) / 10 : L.H + 0.1);
    if (b.getState().h < L.low - 0.01 && b.getState().h > L.H) {
      var r2 = await runFire(b);
      T.same('שלב 1, נעצר על השטיח', 'short', r2.outcome);
      T.near('המרחק שעצר: h / μ', b.getState().h / L.mu, r2.d, 0.05);
    }
    b.setParam('h', 7.5);
    var r3 = await runFire(b);
    T.same('שלב 1, מהר מדי', 'over', r3.outcome);
    T.near('המהירות בסל מהאנרגיה', Math.sqrt(2 * 10 * (7.5 - L.low)), r3.v, 0.05);
    b.setParam('h', Math.round((L.low + 0.4) * 10) / 10);
    await runFire(b);
    b.next();

    var L2 = b.getState().level;
    b.setParam('x', 0.1);
    T.same('שלב 2, כיווץ קטן', 'short', (await runFire(b)).outcome);
    b.setParam('x', 1.2);
    var rs = await runFire(b);
    T.same('שלב 2, כיווץ גדול', 'over', rs.outcome);
    T.near('שלב 2, מהירות בקצה', Math.sqrt(2 * (0.5 * L2.k * 1.44 / L2.mass - 10 * L2.H - L2.mu * 10 * L2.P)), rs.v, 0.05);
    b.setParam('x', Math.round(((L2.low + L2.high) / 2) * 100) / 100);
    var hit2 = await runFire(b);
    T.same('שלב 2, ניצחון', true, hit2.hit);
    T.near('שלב 2, מרחק על הבמה', (0.5 * L2.k * b.getState().x * b.getState().x / L2.mass - 10 * L2.H) / (L2.mu * 10), hit2.d, 0.03);
    b.next();

    var L3 = b.getState().level;
    b.setPoint(0, L3.h0); b.setPoint(1, 1); b.setPoint(2, L3.rock - 0.4); b.setPoint(3, 0.8);
    T.same('שלב 3, דרך הסלע', 'rock', (await runFire(b)).outcome);
    b.setPoint(0, L3.rock + 0.1); b.setPoint(2, L3.rock + 0.7);
    T.same('שלב 3, גבעה גבוהה מההתחלה', 'back', (await runFire(b)).outcome);
    b.setPoint(0, Math.min(8.4, L3.h0 + 2)); b.setPoint(2, L3.rock + 0.2);
    var fast = await runFire(b);
    T.same('שלב 3, מהר מדי', 'fast', fast.outcome);
    T.near('שלב 3, מהירות בדגל', Math.sqrt(2 * 10 * (b.getState().pts[0].y - L3.yf)), fast.v, 0.02);
    T.same('ניסיונות כושלים נספרו', 3, b.getState().attempts);
    b.setPoint(0, Math.round(L3.h0 * 10) / 10);
    /* Shape does not matter: a very different rail gives the same speed. */
    b.setPoint(1, 3); b.setPoint(3, 3);
    var other = await runFire(b);
    T.same('שלב 3, צורה אחרת, אותה מהירות', true, other.hit);
    T.near('שלב 3, מהירות', Math.sqrt(2 * 10 * (Math.round(L3.h0 * 10) / 10 - L3.yf)), other.v, 0.02);
    b.next();
    T.same('עם ניסיונות מיותרים: פחות מ-3 כוכבים', true, b.getState().stars <= 2);
  });
});

/* Chapter 10 checks: every number is read from the running sim and compared with the formula. */
PHY_T.load([
  'ch10/statics.js', 'ch10/beam.js', 'ch10/top-rod.js', 'ch10/hang-shape.js', 'ch10/box-tip.js',
  'ch10/book-stack.js', 'ch10/ladder.js', 'ch10/cable-beam.js', 'ch10/fish-cut.js', 'ch10/mobile-game.js', 'ch10/graduation.js',
]);
PHY_T.add(async function (T) {
  var S = PHY.sims;
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- the hook ---------- */
  function hookOpts() {
    return {
      world: { xMin: -1.9, xMax: 7.2, yMin: -0.25, yMax: 5.75 }, aspect: 1.5, xA: -1, xB: 6.5, y0: 2.4, e: 0.02, timeScale: 2.5, maxTilt: 22, th0: 22,
      items: [{ id: 'sack', m: 100, x: -0.3, kind: 'sack' }, { id: 'cat', m: 5, x: 1, kind: 'cat' }],
    };
  }
  await T.test('פרק 10: חתול נגד שק', async function () {
    var s = T.make(S.beam, hookOpts());
    await T.settle();
    T.near('זווית התחלה: השק למטה', 22, s.getState().theta, 0.01);
    s.markSack();
    var y0 = s.getState().items[0].wy;
    await T.run(s.moveItem('cat', 6.2, 4.2));
    await T.run(s.settle(5));
    var st = s.getState();
    T.near('מומנט השק, 1000 ניוטון ב-0.3 מ\'', 300, st.ccw);
    T.near('מומנט החתול, 50 ניוטון ב-6.2 מ\'', 310, st.cw);
    T.near('הקרש ירד עד הרצפה בצד החתול', -Math.asin(2.4 / 6.5) * 180 / Math.PI, st.theta, 0.01);
    T.near('השק עלה (מ\')', 0.3 * (Math.sin(22 * Math.PI / 180) + 2.4 / 6.5), st.items[0].wy - y0, 0.001);
    s.setItem('cat', { x: 6 });
    var b = s.getState();
    T.near('יחס 20 ל-1: אפס מומנט שקול', 0, b.net);
    await T.run(s.settle(16));
    T.near('ביחס 20 ל-1 הקרש חוזר לאופק', 0, s.getState().theta, 0.5);
    var far = T.make(S.beam, Object.assign(hookOpts(), { items: [{ id: 'sack', m: 100, x: -0.3, kind: 'sack' }, { id: 'cat', m: 5, x: 6.2, kind: 'cat' }] }));
    var top = far.getState().items[1].wy;
    await T.run(far.settle(6));
    T.near('החתול ירד (מ\')', 4.61, top - far.getState().items[1].wy, 0.01);
  });

  /* ---------- the seesaw ---------- */
  function see(x3) {
    return { held: true, items: [{ id: 'a', m: 2, x: -3, kind: 'block', drag: true }, { id: 'b', m: 3, x: x3, kind: 'block', drag: true }, { id: 'cat', m: 5, x: 0, kind: 'cat' }] };
  }
  await T.test('פרק 10: נדנדה', async function () {
    var s = T.make(S.beam, see(2));
    var a = s.getState();
    T.near('2 ק"ג ב-3 מ\': מומנט נגד השעון', 60, a.ccw);
    T.near('3 ק"ג ב-2 מ\': מומנט עם השעון', 60, a.cw);
    s.setParam('held', false);
    await T.run(s.wait(3));
    T.near('2 מ\': הנדנדה נשארת באופק', 0, s.getState().theta, 0.001);
    var w = T.make(S.beam, see(3));
    w.setParam('held', false);
    await T.run(w.settle(6));
    T.near('3 מ\': מומנט שקול', -30, w.getState().net);
    T.near('3 מ\': הצד של 3 ק"ג יורד עד הרצפה', -Math.asin(1.4 / 4.6) * 180 / Math.PI, w.getState().theta, 0.01);
    var v = T.make(S.beam, see(1));
    v.setParam('held', false);
    await T.run(v.settle(6));
    T.row('1 מ\': הצד של 2 ק"ג יורד', '> 0', v.getState().theta.toFixed(2), v.getState().theta > 5);
    var d = T.make(S.beam, Object.assign(see(3), { locked: false }));
    d.setParam('held', false);
    d.dragItem('b', 2);
    await T.run(d.settle(8));
    T.near('גרירה ל-2 מ\': אפס מומנט', 0, d.getState().net);
    T.near('גרירה ל-2 מ\': חוזרת לאופק', 0, d.getState().theta, 1.5);
    var floorDeg = -Math.asin(1.4 / 4.6) * 180 / Math.PI;
    var off = T.make(S.beam, see(2.25));
    off.setParam('held', false);
    await T.run(off.settle(10));
    T.near('קפיצה אחת מהאיזון, 2.25 מ\': מומנט שקול', -7.5, off.getState().net);
    T.near('קפיצה אחת מהאיזון: יורדת עד הרצפה, לא נעצרת באוויר', floorDeg, off.getState().theta, 0.01);
    off.setParam('caption', 'מאוזנת');
    off.dragItem('b', 2);
    T.same('גרירה מוחקת את הכיתוב של הריצה', '', off.getState().caption);
    await T.run(off.wait(3.5));
    T.near('חזרה לאיזון: הנדנדה חוזרת לאופק', 0, off.getState().theta, 0.5);
    var left = T.make(S.beam, Object.assign(see(2), { items: [{ id: 'a', m: 2, x: -3.25, kind: 'block', drag: true }, { id: 'b', m: 3, x: 2, kind: 'block', drag: true }, { id: 'cat', m: 5, x: 0, kind: 'cat' }] }));
    left.setParam('held', false);
    await T.run(left.settle(10));
    T.near('הארגז הקל קפיצה אחת החוצה: יורדת לצד שלו, עד הרצפה', -floorDeg, left.getState().theta, 0.01);
  });

  /* ---------- two scales ---------- */
  function scales(extra) {
    return Object.assign({
      world: { xMin: -0.6, xMax: 4.6, yMin: -0.2, yMax: 3.6 }, xA: 0, xB: 4, y0: 0.85,
      supports: [{ x: 0, kind: 'scale' }, { x: 4, kind: 'scale' }],
      items: [{ id: 'cat', m: 5, x: 0, kind: 'cat', drag: true }], panel: 'scales', graph: true, arms: false, torques: false,
    }, extra || {});
  }
  await T.test('פרק 10: שני מאזניים', async function () {
    var s = T.make(S.beam, scales());
    T.near('החתול על השמאלי: שמאל', 50, s.getState().N[0]);
    T.near('החתול על השמאלי: ימין', 0, s.getState().N[1]);
    await T.run(s.moveItem('cat', 1, 1));
    T.near('ברבע מהאורך: שמאל', 37.5, s.getState().N[0]);
    T.near('ברבע מהאורך: ימין', 12.5, s.getState().N[1]);
    T.row('הגרף נמשך', '> 10', s.getState().graph, s.getState().graph > 10);
    s.setParam('mb', 10);
    T.near('עם קורה של 10 ק"ג: שמאל', 87.5, s.getState().N[0]);
    T.near('עם קורה של 10 ק"ג: סכום', 150, s.getState().N[0] + s.getState().N[1]);
    var p = T.make(S.beam, scales({ mb: 10, graph: false, items: [{ id: 'load', m: 20, x: 1, kind: 'block' }] }));
    T.near('שאלה א: שמאל', 200, p.getState().N[0]);
    T.near('שאלה א: ימין', 100, p.getState().N[1]);
    var q = T.make(S.beam, scales({ graph: false, items: [{ id: 'cat', m: 5, x: 1, kind: 'cat' }] }));
    for (var i = 0; i <= 4; i++) {
      q.setSweep(i);
      var list = q.getState().sweep;
      T.near('ציר מדומה ב-' + i + ' מ\': סכום המומנטים', 0, list[list.length - 1].v, 1e-6);
    }
    q.setSweep(0);
    T.near('ציר על השמאלי: מומנט הכוח השמאלי', 0, q.getState().sweep[0].v, 1e-9);
    T.near('ציר על השמאלי: מומנט הכוח הימני', 50, q.getState().sweep[1].v, 1e-6);
    q.setSweep(4);
    T.near('ציר על הימני: מומנט הכוח השמאלי', -150, q.getState().sweep[0].v, 1e-6);
  });

  /* ---------- playground: tipping past a support ---------- */
  await T.test('פרק 10: מגרש המשחקים', async function () {
    var o = {
      world: { xMin: -4.8, xMax: 4.8, yMin: -0.4, yMax: 3.9 }, xA: -4, xB: 4, y0: 1.4, mb: 10, locked: false, lab: true, panel: 'lab',
      supports: [{ x: -2, kind: 'wedge' }, { x: 2, kind: 'wedge' }],
      items: [{ id: 'cat', m: 5, x: 0, kind: 'cat', drag: true }],
    };
    var s = T.make(S.beam, o);
    T.near('שני תומכים סימטריים: שמאל', 75, s.getState().N[0]);
    T.near('שני תומכים סימטריים: ימין', 75, s.getState().N[1]);
    s.addBlock(10);
    var x = s.getState().items[1].x;
    T.near('התוסף הראשון נוחת ב-3 מ\' משמאל', -3, x);
    T.near('עם 10 ק"ג ב-(-3): ימין', 75 + 100 * (-3 + 2) / 4, s.getState().N[1]);
    s.removeLast();
    s.addBlock(2);
    s.removeLast();
    var it = T.make(S.beam, Object.assign({}, o, { mb: 0, items: [{ id: 'k', m: 10, x: 3.5, kind: 'block', drag: true }] }));
    await T.settle();
    var a = it.getState();
    T.same('עומס מעבר לתומך הימני: התומך השמאלי היה צריך למשוך', 1, a.tip);
    await T.run(it.settle(4));
    T.row('הקורה הסתובבה עם השעון', '< -5', it.getState().theta.toFixed(1), it.getState().theta < -5);
    it.dragItem('k', 0);
    await T.run(it.wait(4));
    T.near('העומס חזר פנימה: הקורה חזרה לתומכים', 0, it.getState().theta, 0.001);
    T.near('וכל תומך נושא חצי', 50, it.getState().N[0]);
    var one = T.make(S.beam, Object.assign({}, o, { mb: 0, items: [{ id: 'k', m: 10, x: 1, kind: 'block', drag: true }, { id: 'j', m: 5, x: -2, kind: 'block', drag: true }] }));
    one.setParam('oneSupport', true);
    T.near('תומך אחד: מאוזנת', 0, one.getState().net);
    function lab(items, supports) {
      return { world: { xMin: -4.7, xMax: 4.7, yMin: -0.45, yMax: 3.8 }, xA: -4, xB: 4, y0: 1.5, mb: 10, e: 0.005, locked: false, lab: true, panel: 'lab', supports: supports, items: items };
    }
    var labFloor = -Math.asin(1.5 / 4) * 180 / Math.PI;
    var tiny = T.make(S.beam, lab([{ id: 'cat', m: 5, x: -1.5, kind: 'cat' }, { id: 'b', m: 10, x: 1, kind: 'block' }], [{ x: 0, kind: 'wedge' }]));
    await T.run(tiny.settle(14), 16000);
    T.near('תומך אחד, חוסר איזון קטן: עד הרצפה', labFloor, tiny.getState().theta, 0.01);
    var heavy = T.make(S.beam, lab([{ id: 'cat', m: 5, x: -1.5, kind: 'cat' }, { id: 'b', m: 10, x: 1.5, kind: 'block' }], [{ x: 0, kind: 'wedge' }]));
    await T.run(heavy.settle(14), 16000);
    T.near('נחה על הרצפה: הרצפה נושאת 75 ניוטון·מ\' חלקי 4 מ\'', 18.75, heavy.getState().floor, 0.001);
    var cat15 = { id: 'cat', m: 5, x: -1.5, kind: 'cat' }, box15 = { id: 'b', m: 10, x: 1.5, kind: 'block' };
    var near0 = T.make(S.beam, lab([cat15, box15], [{ x: -3, kind: 'wedge' }, { x: 0.5, kind: 'wedge' }]));
    await T.settle();
    T.same('התומך הימני ב-0.5 מ\': עוד יציבה', null, near0.getState().tip);
    var past = T.make(S.beam, lab([cat15, box15], [{ x: -3, kind: 'wedge' }, { x: 0.25, kind: 'wedge' }]));
    await T.settle();
    T.same('התומך הימני ב-0.25 מ\': השמאלי היה צריך למשוך', 1, past.getState().tip);
  });

  /* ---------- rods from above ---------- */
  function doors() {
    return {
      slow: 0.6, hideUntilRun: true,
      rods: [
        { id: 'A', skin: 'door', hx: 0, hy: 0, L: 1, I: 20, F: 20, d: 1, rel: 90 },
        { id: 'B', skin: 'door', hx: 2.1, hy: 0, L: 1, I: 20, F: 20, d: 1, rel: 150 },
      ],
    };
  }
  await T.test('פרק 10: דלתות', async function () {
    var s = T.make(S.topRod, doors());
    var a = s.getState().rods;
    T.near('מומנט בניצב', 20, a[0].tau);
    T.near('מומנט ב-30°', 10, a[1].tau);
    T.near('זרוע ב-30°', 0.5, a[1].arm);
    T.row('הרכיב לאורך הדלת לוחץ אל הציר', '< 0', a[1].along.toFixed(1), a[1].along < 0);
    T.near('הרכיב לאורך הדלת: F cos 30°', -17.32, a[1].along, 0.01);
    T.same('לפני הניחוש: המומנט מוסתר', false, s.getState().resultShown);
    await T.run(s.play());
    var r = s.getState().rods;
    T.same('אחרי הריצה: המומנט גלוי', true, s.getState().resultShown);
    T.near('הדלת השמאלית הגיעה ל-90°', 90, r[0].th, 0.001);
    T.near('אז הימנית בדיוק ב-45°', 45, r[1].th, 0.001);
    T.near('זמן: שורש של 2θ/α', Math.sqrt(2 * (Math.PI / 2) / 1), s.getState().arrived, 0.01);
    var f = T.make(S.topRod, { free: true, locked: false, rods: [{ id: 'A', skin: 'door', hx: 0, hy: 0, L: 1, I: 20, F: 40, d: 1, rel: 0 }] });
    T.near('כוח דרך הציר: מומנט', 0, f.getState().rods[0].tau, 1e-9);
    T.near('כוח דרך הציר: זרוע', 0, f.getState().rods[0].arm, 1e-9);
    await T.run(f.play());
    T.near('כוח דרך הציר: הדלת לא זזה', 0, f.getState().rods[0].th, 1e-9);
    f.setParam('rel', 90);
    f.setParam('d', 0.5);
    f.setParam('F', 30);
    T.near('30 ניוטון ב-0.5 מ\' בניצב', 15, f.getState().rods[0].tau);
    var g = T.make(S.topRod, { free: true, inward: true, locked: false, rods: [{ id: 'A', skin: 'door', hx: 0, hy: 0, L: 1, I: 20, F: 20, d: 1, rel: 120 }] });
    T.same('דלת חופשית: הכול גלוי', true, g.getState().resultShown);
    T.near('דלת חופשית, 60° לדלת: מומנט', 20 * Math.sin(60 * Math.PI / 180), g.getState().rods[0].tau);
    T.row('דלת חופשית: לוחץ אל הציר', '< 0', g.getState().rods[0].along.toFixed(1), g.getState().rods[0].along < 0);
    g.setParam('rel', 0);
    g.setParam('F', 40);
    T.near('דלת חופשית, 0°: כוח דרך הציר', 0, g.getState().rods[0].tau, 1e-9);
    await T.run(g.play());
    T.near('דלת חופשית, 0°: לא זזה', 0, g.getState().rods[0].th, 1e-9);
    g.setParam('rel', 30);
    T.near('דלת חופשית, 30° לדלת: מומנט', 20, g.getState().rods[0].tau);
  });
  await T.test('פרק 10: מפתח שוודי', async function () {
    var s = T.make(S.topRod, { slow: 0.4, hideUntilRun: true, rods: [
      { id: 'A', skin: 'wrench', hx: 0, hy: 0, L: 0.4, I: 1, F: 50, d: 0.4, rel: 30 },
      { id: 'B', skin: 'wrench', hx: 0.7, hy: 0, L: 0.2, I: 1, F: 50, d: 0.2, rel: 90 },
    ] });
    var a = s.getState().rods;
    T.near('מפתח ארוך ב-30°: מומנט', 10, a[0].tau);
    T.near('מפתח קצר בניצב: מומנט', 10, a[1].tau);
    T.near('מפתח ארוך: זרוע', 0.2, a[0].arm);
    T.same('מפתחות, לפני הניחוש: המומנט מוסתר', false, s.getState().resultShown);
    await T.run(s.play());
    T.near('מסתובבים יחד', 0, s.getState().rods[0].th - s.getState().rods[1].th, 1e-6);
    T.same('מפתחות, אחרי הריצה: המומנט גלוי', true, s.getState().resultShown);
  });
  await T.test('פרק 10: צמד כוחות', async function () {
    var s = T.make(S.topRod, { hideUntilRun: true, slow: 1, T: 3, stopAt: 1e9, rods: [
      { id: 'line', hinge: false, hx: 0, hy: 0, L: 2, I: 5, m: 15, forces: [{ s: 1, F: 5, rel: 0 }, { s: -1, F: 5, rel: 180 }] },
      { id: 'couple', hinge: false, hx: 2.8, hy: 0, L: 2, I: 5, m: 15, forces: [{ s: 1, F: 5, rel: 90 }, { s: -1, F: 5, rel: -90 }] },
    ] });
    T.same('צמד, לפני הניחוש: החץ המעוקל מוסתר', false, s.getState().resultShown);
    await T.run(s.play());
    var r = s.getState().rods;
    T.same('צמד, אחרי הריצה: החץ המעוקל גלוי', true, s.getState().resultShown);
    T.near('על אותו קו: לא מסתובב', 0, r[0].th, 1e-9);
    T.near('על אותו קו: לא זז', 0, r[0].cx, 1e-9);
    T.near('צמד: שקול הכוחות', 0, r[1].netX * r[1].netX + r[1].netY * r[1].netY, 1e-9);
    T.near('צמד: המרכז לא זז (x)', 2.8, r[1].cx, 1e-9);
    T.near('צמד: המרכז לא זז (y)', 0, r[1].cy, 1e-9);
    T.near('צמד: מומנט', 10, r[1].tau);
    T.near('צמד: זווית ½αt² (מעלות)', 0.5 * 2 * 9 * 180 / Math.PI, r[1].th, 2);
  });

  /* ---------- center of gravity ---------- */
  await T.test('פרק 10: תלייה משתי נקודות', async function () {
    var s = T.make(S.hangShape, { shape: 'L' });
    await T.run(s.play(), 8000);
    var a = s.getState();
    /* L as two rectangles: 1.7 x 0.32 and 0.32 x 1.38 */
    var A1 = 1.7 * 0.32, A2 = 0.32 * 1.38;
    var cx = (A1 * 0.85 + A2 * 0.16) / (A1 + A2), cy = (A1 * 0.16 + A2 * 1.01) / (A1 + A2);
    T.near('L: מרכז כובד x מהנוסחה', cx, a.cm.x, 0.01);
    T.near('L: מרכז כובד y מהנוסחה', cy, a.cm.y, 0.01);
    T.near('L: הקווים נפגשים ב-x', cx, a.cross.x, 0.04);
    T.near('L: הקווים נפגשים ב-y', cy, a.cross.y, 0.04);
    T.same('L: נקודת המפגש מחוץ לחומר', false, a.crossSolid);
    T.near('בסוף מרכז הכובד מתחת לציר', 0, a.cmBelowPin, 0.02);
    var r = T.make(S.hangShape, { shape: 'ring' });
    await T.run(r.play(), 8000);
    var b = r.getState();
    T.near('טבעת: מרכז x', 0, b.cross.x, 0.03);
    T.near('טבעת: מרכז y', 0, b.cross.y, 0.03);
    T.same('טבעת: מחוץ לחומר', false, b.crossSolid);
    var t = T.make(S.hangShape, { shape: 'triangle' });
    await T.run(t.play(), 8000);
    var c = t.getState();
    T.near('משולש: x', 1.9 / 3, c.cross.x, 0.03);
    T.near('משולש: y', 0.5, c.cross.y, 0.03);
    T.same('משולש: בתוך החומר', true, c.crossSolid);
    await T.run(t.hang(2), 8000);
    var c2 = t.getState();
    T.near('נקודה שלישית עוברת באותה נקודה', 0, c2.cmBelowPin, 0.02);
  });

  await T.test('פרק 10: ארגז על מדרון', async function () {
    var s = T.make(S.boxTip, {});
    T.same('ארגז נעול, לפני הניחוש: זווית ההתהפכות מוסתרת', false, s.getState().limitShown);
    await T.run(s.play(), 8000);
    var a = s.getState();
    T.same('אחרי ההתהפכות: הזווית גלויה', true, a.limitShown);
    T.near('מתהפך כש-tan = 0.9/1.2 (מעלות)', 36.87, a.tipAngle, 0.15);
    T.near('נפל על הצד', 90, a.phi, 0.001);
    var f = T.make(S.boxTip, { locked: false });
    T.same('ארגז פתוח: הזווית גלויה', true, f.getState().limitShown);
    f.setParam('h', 0.9);
    T.near('ריבוע: הגבול 45°', 45, f.getState().limit, 0.001);
    f.setParam('angle', 44);
    await T.settle();
    T.same('44°: עומד', 'ready', f.getState().phase);
    f.setParam('angle', 46);
    T.same('46°: מתהפך', 'freeTip', f.getState().phase);
  });

  await T.test('פרק 10: ספרים', async function () {
    var s = T.make(S.bookStack, {});
    var h = s.getState().harmonic;
    h.forEach(function (x, i) { s.drop(i, x); });
    await T.settle();
    var a = s.getState();
    T.same('ערימה הרמונית יציבה', null, a.unstable);
    T.near('בליטה, ס"מ', 30 * (1 / 2 + 1 / 4 + 1 / 6 + 1 / 8 + 1 / 10), a.overhang * 100, 0.01);
    T.same('הספר העליון כולו באוויר', true, a.achieved);
    T.row('הקצה האחורי מעבר לשולחן', '> 0', a.backEdge.toFixed(4), a.backEdge > 0);
    var stood = s.drop(4, a.xs[4] + 0.01);
    T.same('עוד ס"מ אחד למעלה: נופל', false, stood);
    T.same('הקריסה רצה', true, s.getState().falling);
    var w = T.make(S.bookStack, {});
    T.same('ספר תחתון בחוץ, כל הערימה איתו: נופל', false, w.drop(0, 0.2));
    var k = T.make(S.bookStack, {});
    await T.run(k.solve());
    T.same('הפתרון של ניוטון יציב', null, k.getState().unstable);
    T.same('הפתרון של ניוטון מגיע ליעד', true, k.getState().achieved);
  });

  /* ---------- ladder ---------- */
  await T.test('פרק 10: סולם', async function () {
    var s = T.make(S.ladder, { deg: 53.13, mu: 0.4, cat: false });
    await T.settle();
    var a = s.getState();
    T.near('שאלה ג: נורמל ברצפה', 100, a.Nf);
    T.near('שאלה ג: חיכוך', 37.5, a.f, 0.01);
    T.near('שאלה ג: μ מינימלי', 0.375, a.need, 0.0005);
    T.same('μ = 0.4: עומד', 'stand', a.phase);
    s.setParam('mu', 0.35);
    await T.settle();
    T.same('μ = 0.35: מחליק', 'slip', s.getState().phase);
    var e = T.make(S.ladder, { deg: 52, mu: 0.4, cat: false });
    await T.settle();
    T.near('זווית מינימלית ב-μ = 0.4', Math.atan(1 / 0.8) * 180 / Math.PI, e.getState().thMin, 0.01);
    T.same('52°: עומד', 'stand', e.getState().phase);
    e.setParam('deg', 51);
    await T.settle();
    T.same('51°: מחליק', 'slip', e.getState().phase);
    var c = T.make(S.ladder, { deg: 53.13, mu: 0.4 });
    T.near('החתול בתחתית: μ דרוש', 0.25, c.getState().need, 0.001);
    c.setParam('s', 2.5);
    T.near('החתול באמצע: μ דרוש', 0.375, c.getState().need, 0.001);
    c.setParam('s', 5);
    T.near('החתול למעלה: μ דרוש', 0.5, c.getState().need, 0.001);
    var d = T.make(S.ladder, { deg: 53.13, mu: 0.4, speed: 1 });
    await T.run(d.climb(), 8000);
    var z = d.getState();
    T.near('החתול מטפס: נקודת ההחלקה (מ\')', 3, z.slipAt.s, 0.02);
    T.same('הסולם נפל', 'fallen', z.phase);
    T.row('הרגל התרחקה מהקיר', '> 4', z.footX.toFixed(2), z.footX > 4);
    var h = T.make(S.ladder, { deg: 53.13, mu: 0.6 });
    await T.run(h.climb(), 8000);
    T.same('μ = 0.6: מגיע לראש בלי להחליק', 'stand', h.getState().phase);
  });

  /* ---------- hinged beam ---------- */
  await T.test('פרק 10: סולם, ההתחלה של הכרטיס', async function () {
    var e = T.make(S.ladder, { deg: 53.13, mu: 0.4, cat: false, locked: true });
    T.near('הסולם הריק: μ דרוש', 0.375, e.getState().need, 0.001);
    T.same('הסולם הריק עומד', 'stand', e.getState().phase);
    await T.run(e.climb(), 8000);
    T.near('הטיפוס: נקודת ההחלקה (מ\')', 3, e.getState().slipAt.s, 0.02);
    e.reset();
    T.near('אחרי איפוס שוב ריק: μ דרוש', 0.375, e.getState().need, 0.001);
    e.setParam('s', 1);
    T.near('משחק חופשי: החתול על הסולם, μ דרוש', 0.3, e.getState().need, 0.001);
  });

  await T.test('פרק 10: קורה וכבל', async function () {
    var s = T.make(S.cableBeam, { deg: 30 });
    var a = s.getState();
    T.near('שאלה ב: מתיחות', 500, a.T);
    T.near('שאלה ב: ציר אופקי', 433.01, a.H, 0.01);
    T.near('שאלה ב: ציר אנכי', 50, a.V);
    s.setParam('deg', 60);
    T.near('ב-60°', 500 * Math.sin(30 * Math.PI / 180) / Math.sin(60 * Math.PI / 180), s.getState().T, 0.01);
    T.near('V לא תלוי בזווית', 50, s.getState().V);
    s.setParam('deg', 15);
    T.row('ב-15° יותר מ-30°', '> 500', s.getState().T.toFixed(0), s.getState().T > 500);
    T.same('ב-15° עוד מחזיק', false, s.getState().snapped);
    var c = T.make(S.cableBeam, { deg: 60 });
    T.same('כבל נעול, לפני הניחוש: בלי עקומה', null, c.getState().curve);
    await T.run(c.lower(10, 3.5), 8000);
    var z = c.getState();
    T.near('בריצה העקומה רק עוקבת: מ-60°', 60, z.curve.to);
    T.near('בריצה העקומה רק עוקבת: עד הקרע', z.deg, z.curve.from);
    c.setParam('locked', false);
    T.near('אחרי הניחוש: העקומה המלאה', 6, c.getState().curve.from);
    T.same('הורדה ל-10°: נקרע', true, z.snapped);
    T.near('נקרע ליד 14.5°', Math.asin(0.25) * 180 / Math.PI, z.deg, 0.4);
    T.same('הקורה נחתה', 'down', z.phase);
    var d = T.make(S.cableBeam, { deg: 60 });
    await T.run(d.lower(30, 2));
    T.near('הורדה ל-30°: לא נקרע', 500, d.getState().T, 0.5);
    T.same('הורדה ל-30°: שלם', false, d.getState().snapped);
  });

  /* ---------- the fish ---------- */
  await T.test('פרק 10: הדג', async function () {
    var s = T.make(S.fishCut, {});
    await T.run(s.play(), 8000);
    var a = s.getState();
    T.near('מסה כוללת', 2, a.mHead + a.mTail);
    T.near('מומנטים שווים סביב נקודת האיזון', a.torqueHead, a.torqueTail, 1e-6);
    T.row('הראש כבד מהזנב', 'ראש > זנב', a.mHead.toFixed(3) + ' מול ' + a.mTail.toFixed(3), a.mHead > a.mTail);
    T.row('הזרוע של הזנב ארוכה', 'זנב > ראש', a.dTail.toFixed(3) + ' מול ' + a.dHead.toFixed(3), a.dTail > a.dHead);
    T.row('המאזניים נוטים לצד הראש', '> 0', a.tilt.toFixed(1), a.tilt > 3);
  });

  /* ---------- the game ---------- */
  await T.test('פרק 10: המובייל', async function () {
    var pools = T.make(S.mobileGame, {}).pools();
    T.row('יש גיוון בשלבים', '> 8 בכל שלב', pools.join(', '), pools.every(function (n) { return n > 8; }));
    for (var seed = 1; seed <= 12; seed++) {
      var g = T.make(S.mobileGame, { random: seeded(seed * 977) });
      var done = null;
      for (var lv = 0; lv < 3; lv++) {
        var st = g.getState();
        for (var i = st.bars.length - 1; i >= 0; i--) g.moveHang(i, g.getState().bars[i].solution);
        await T.run(g.settle(14), 8000);
        st = g.getState();
        if (st.phase !== 'won') T.row('זרע ' + seed + ' שלב ' + (lv + 1) + ': פותר מנצח', 'won', st.phase, false);
        if (st.moves !== st.bars.length) T.row('זרע ' + seed + ': מהלכים', st.bars.length, st.moves, false);
        g.next();
      }
      var fin = g.getState();
      if (fin.points.join() !== '3,3,3') T.row('זרע ' + seed + ': נקודות', '3,3,3', fin.points.join(), false);
    }
    T.row('12 זרעים: הפותר ניצח בכל השלבים', 'כן', 'נבדק', true);

    var b = T.make(S.mobileGame, { random: seeded(5) });
    var s0 = b.getState().bars[0];
    var off = s0.solution + (s0.solution < 0.6 ? 0.2 : -0.2);
    b.moveHang(0, off);
    await T.run(b.settle(14), 8000);
    var s1 = b.getState();
    T.same('מיקום שגוי: לא מנצחים', 'play', s1.phase);
    T.near('נטייה אמיתית: tan = -מומנט/(eM)', s1.bars[0].thEq, s1.bars[0].th, 0.8);
    T.row('המוט באמת נוטה', '> 5°', Math.abs(s1.bars[0].th).toFixed(1), Math.abs(s1.bars[0].th) > 5);
    /* Two more wrong drags, wherever is free, so the count is exactly 4 with the right one. */
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1, 1.1].forEach(function (h) {
      if (b.getState().moves < 3 && Math.abs(h - s0.solution) > 0.05) b.moveHang(0, h);
    });
    b.moveHang(0, s0.solution);
    await T.run(b.settle(14), 8000);
    var s2 = b.getState();
    T.same('בסוף זה עובד', 'won', s2.phase);
    T.same('4 גרירות במוט אחד: נקודה אחת', 1, s2.points[0]);
    var m = T.make(S.mobileGame, { random: seeded(77) });
    var ms = m.getState().bars[0];
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 1, 1.1].forEach(function (h) {
      if (m.getState().moves < 1 && Math.abs(h - ms.solution) > 0.05) m.moveHang(0, h);
    });
    m.moveHang(0, ms.solution);
    await T.run(m.settle(14), 8000);
    T.same('2 גרירות: 2 נקודות', 2, m.getState().points[0]);

    /* A full game with too many moves gets fewer stars, and finishing reports them. */
    var result = null;
    PHY.progress.reset();
    var f = T.make(S.mobileGame, { random: seeded(9), chapter: '10', section: 'game', onDone: function (stars, total) { result = { stars: stars, total: total }; } });
    for (var lv2 = 0; lv2 < 3; lv2++) {
      var bars = f.getState().bars;
      for (var j = bars.length - 1; j >= 0; j--) {
        var sol = bars[j].solution;
        f.moveHang(j, sol + (sol < 0.6 ? 0.1 : -0.1));
        f.moveHang(j, sol + (sol < 0.6 ? 0.2 : -0.2));
        f.moveHang(j, sol);
      }
      await T.run(f.settle(14), 8000);
      f.next();
    }
    T.same('הרבה גרירות: כוכב אחד', 1, result && result.stars);
    T.same('הכוכבים נשמרו בהתקדמות', 1, PHY.progress.chapter('10').game);
    T.same('הסעיף סומן', true, PHY.progress.hasSection('10', 'game'));
  });

  /* ---------- graduation ---------- */
  await T.test('פרק 10: תעודת הסיום', async function () {
    PHY.progress.reset();
    PHY.progress.setQuiz('01', 1);
    PHY.progress.setGame('01', 3);
    PHY.progress.setQuiz('04', 0.7);
    PHY.progress.setGame('10', 2);
    var host = document.createElement('div');
    T.stage.appendChild(host);
    var g = S.graduation(host, null, {});
    var a = g.getState();
    T.same('מספר השורות כמספר הפרקים', PHY.course.length, a.rows.length);
    T.same('מקסימום כוכבים', PHY.course.length * 6, a.max);
    T.same('סך הכוכבים', 3 + 3 + 2 + 2, a.total);
    T.same('פרק 4: בוחן 0.7 נותן 2', 2, a.rows[3].quiz);
    PHY.progress.setGame('02', 3);
    T.same('מתעדכן עם ההתקדמות', 13, g.getState().total);
    T.same('כוכבים מצוירים', true, host.querySelectorAll('.star.is-on').length === 13);
    PHY.progress.reset();
  });
});

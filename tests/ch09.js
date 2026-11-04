/* Chapter 9: gravity. Key numbers measured from the running sims, against the formulas, and a scripted solver for the game. */
PHY_T.load(['ch09/grav-kit.js', 'ch09/mountain-cannon.js', 'ch09/falling-curve.js', 'ch09/spray.js', 'ch09/apple-moon.js', 'ch09/worlds.js', 'ch09/tower-station.js', 'ch09/orbit-lab.js', 'ch09/kepler.js', 'ch09/escape.js', 'ch09/orbit-3d.js', 'ch09/mission-orbit.js']);

PHY_T.add(async function (T) {
  var G = PHY.grav, S = PHY.sims, R = G.R;

  await T.test('פרק 9: מספרי הבסיס', async function () {
    T.near('GM = gR²', 4.096e14, G.GM, 1e9);
    T.near('מהירות מסלול צמוד, מ/ש', 8000, G.vCirc(R), 0.01);
    T.near('זמן הקפה צמוד, דק׳', 83.78, G.period(R) / 60, 0.01);
    T.near('g בגובה h = R', 2.5, G.gAt(2 * R), 1e-9);
    T.near('g בגובה 400 ק"מ', 8.858, G.gAt(6.8e6), 0.001);
    T.near('מהירות מסלול ב-r = 2R', 5656.9, G.vCirc(2 * R), 0.1);
    T.near('זמן הקפה ב-r = 2R, ש׳', 14217, G.period(2 * R), 1);
    T.near('מהירות בריחה', 11313.7, G.vEsc(R), 0.1);
    T.near('בריחה לחלק למסלול', Math.SQRT2, G.vEsc(R) / G.vCirc(R), 1e-9);
  });

  await T.test('פרק 9: אינטגרטור סגור ויציב', async function () {
    /* 50 laps of an orbit with e = 0.6: a drifting integrator would show here. */
    var a = 3 * R, e = 0.6, ra = a * (1 + e);
    var b = G.body(-ra, 0, 0, -Math.sqrt(G.GM * (2 / ra - 1 / a)));
    var el0 = G.elements(b);
    var E0 = el0.E, L0 = el0.L;
    G.advance(b, 50 * el0.T, 5);
    var el = G.elements(b);
    T.near('שגיאת אנרגיה יחסית אחרי 50 הקפות', 0, Math.abs((el.E - E0) / E0), 1e-4);
    T.near('שגיאת תנע זוויתי יחסית', 0, Math.abs((el.L - L0) / L0), 1e-9);
    T.near('אורך הציר הגדול, ביחידות R', 3, el.a / R, 0.001);
    T.near('אקסצנטריות', 0.6, el.e, 0.001);
  });

  await T.test('פרק 9: התותח על ההר', async function () {
    var c = T.make(S.mountainCannon, {});
    await T.run(c.play());
    var s = c.getState().shots;
    T.same('5 ק"מ/ש: נוחת', 'crash', s[0].result);
    T.same('7 ק"מ/ש: נוחת', 'crash', s[1].result);
    T.same('8 ק"מ/ש: מקיף', 'orbit', s[2].result);
    T.same('נחיתה רחוקה יותר במהירות גבוהה יותר', true, s[1].sweep > s[0].sweep);
    T.near('8 ק"מ/ש: סטייה ממעגל', 0, s[2].e, 1e-6);
    T.near('8 ק"מ/ש: זמן הקפה, דק׳', 83.8, s[2].t / 60, 0.1);
    T.near('המסלול נסגר: מרחק מנקודת ההתחלה, ביחידות R', 0, s[2].closeError / R, 0.001);

    var d = T.make(S.mountainCannon, { free: true, speed: 10, angle: 0 });
    d.setParam('speed', 10);
    await T.run(d.fire());
    var e1 = d.getState().last;
    T.same('10 ק"מ/ש: אליפסה', 'orbit', e1.result);
    T.near('10 ק"מ/ש: נקודה רחוקה, ביחידות R', 1 / (2 - 100 / 64) * 2 - 1, e1.ra / R, 0.001);
    T.near('אליפסה נסגרת, ביחידות R', 0, e1.closeError / R, 0.002);
    d.setParam('speed', 11.4);
    await T.run(d.fire());
    T.same('11.4 ק"מ/ש: בורח', 'away', d.getState().last.result);
    d.setParam('speed', 11.2);
    await T.run(d.fire());
    T.same('11.2 ק"מ/ש: חוזר', true, d.getState().last.E < 0);
    d.reset();
    T.same('איפוס מנקה מסלולים', 0, d.getState().shots.length);
    T.same('שום דבר לא נשאר נעול', false, d.getState().locked);
  });

  await T.test('פרק 9: 8 ק"מ ו-5 מ\'', async function () {
    var f = T.make(S.fallingCurve, {});
    var st = f.getState();
    T.near('האדמה יורדת לאורך 8 ק"מ, מ\'', 5, st.drop8km, 0.001);
    T.near('נפילה בשנייה הראשונה, מ\'', 5, st.fall1s, 1e-9);
    T.near('מהירות המסלול', 8000, st.vOrbit, 0.01);
    await T.run(f.play());
    st = f.getState();
    T.same('ב-8 ק"מ/ש לא נופל', false, st.crashed);
    T.near('גובה מעל הקרקע בסוף, מ\'', 5, st.gap, 0.01);
    T.near('הסרגל נפתח עד הסוף', 1, st.ruler, 1e-9);
    T.near('אחרי שנייה: 8 ק"מ לאורך הקו', 8000, st.stamp.x, 1e-6);
    T.near('אחרי שנייה: 5 מ\' מתחת לגובה ההתחלה', 0, st.stamp.y, 1e-6);
    await T.run(f.fly(4));
    st = f.getState();
    T.same('ב-4 ק"מ/ש נופל', true, st.crashed);
    T.near('מיקום הנפילה, מ\'', 4619, st.x, 60);
    await T.run(f.fly(12));
    st = f.getState();
    T.same('ב-12 ק"מ/ש הגובה גדל', true, st.gap > 5.5);
  });

  await T.test('פרק 9: ריבוע הפוך מהתרסיס', async function () {
    var s = T.make(S.spray, {});
    await T.run(s.play());
    var st = s.getState();
    T.same('כל הטיפות הגיעו', 400, st.total);
    T.same('במרחק 1 הכל על משבצת אחת', 400, st.history[1]);
    T.near('במרחק 2, טיפות למשבצת', 100, st.history[2], 3);
    T.near('שטח במרחק 2', 4, st.area, 1e-9);
    s.setParam('distance', 3);
    await T.run(s.spray());
    T.near('במרחק 3, חלק מהטיפות', 1 / 9, s.getState().share, 0.02);
  });

  await T.test('פרק 9: התפוח והירח', async function () {
    var m = T.make(S.appleMoon, {});
    T.near('ימים להקפה, מהאינטגרטור', 27.04, m.measurePeriod(), 0.03);
    await T.run(m.play());
    var st = m.getState();
    T.near('התפוח נפל בשנייה, מ\'', 5, st.appleFall, 1e-6);
    T.near('g/3600', 0.002778, st.aRatio, 1e-6);
    T.near('v²/r של הירח הרץ', st.aRatio, st.aCircle, 1e-6);
    T.near('התאוצה מהאינטגרטור', st.aRatio, st.aReal, 1e-6);
    T.near('נפילת הירח בשנייה, מ"מ', 1.39, st.moonFall1s * 1000, 0.01);
    T.near('יחס תפוח לירח', 3600, st.appleFall / st.moonFall1s, 1);
    T.near('מהירות הירח, מ/ש', 1033, st.v, 1);
    m.setParam('gravity', false);
    await T.run(m.launch());
    T.same('בלי כבידה הירח עוזב', true, m.getState().r > 60 * R * 1.45);
  });

  await T.test('פרק 9: כוכבים אחרים', async function () {
    var w = T.make(S.worlds, { mode: 'lanes' });
    await T.run(w.drop());
    var st = w.getState();
    T.near('ירח: 5 מ\', ש\'', 2.5, st.landed.moon, 1e-6);
    T.near('מאדים: 5 מ\', ש\'', 1.644, st.landed.mars, 0.001);
    T.near('כדור הארץ: 5 מ\', ש\'', 1, st.landed.earth, 1e-6);
    T.near('צדק: 5 מ\', ש\'', 0.632, st.landed.jupiter, 0.001);
    T.near('5 ק"ג על הירח, ניוטון', 8, st.weights.moon, 1e-9);
    T.near('5 ק"ג על מאדים, ניוטון', 18.5, st.weights.mars, 1e-9);
    T.near('5 ק"ג על צדק, ניוטון', 125, st.weights.jupiter, 1e-9);
    var c = T.make(S.worlds, { mode: 'custom', locked: true });
    await T.run(c.play());
    st = c.getState();
    T.near('מסה ×2 ורדיוס ×2: g', 5, st.g, 1e-6);
    T.near('אותו כוכב: משקל 5 ק"ג', 25, st.weight, 1e-6);
    c.setParam('M', 9);
    c.setParam('Rk', 3);
    T.near('מסה ×9 ורדיוס ×3: g', 10, c.getState().g, 1e-9);
  });

  await T.test('פרק 9: למה מרחפים', async function () {
    var f = T.make(S.towerStation, { mode: 'float' });
    await T.run(f.play());
    var s = f.getState().seen;
    T.near('g ב-400 ק"מ', 8.858, s.g, 0.001);
    T.near('על המגדל: המאזניים', 44.29, s.tower, 0.01);
    T.near('בלי מגדל: המאזניים', 0, s.fall, 1e-9);
    T.near('בלי מגדל: תאוצת התא שווה ל-g במקום', s.gFall, s.aFall, 1e-6);
    T.near('במסלול: המאזניים', 0, s.orbit, 1e-9);
    T.near('במסלול: תאוצה', 8.858, s.aOrbit, 0.001);
    T.near('במסלול: מהירות, מ/ש', 7761, s.v, 1);
    T.near('במסלול: זמן הקפה, דק\'', 91.8, s.T / 60, 0.1);
    var h = T.make(S.towerStation, { mode: 'height' });
    await T.run(h.play());
    var st = h.getState();
    T.near('h = R: r', 2 * R, st.r, 1);
    T.near('h = R: g', 2.5, st.g, 1e-6);
    T.near('h = R: המאזניים', 12.5, st.reading, 1e-6);
    h.setParam('height', 3 * R);
    T.near('h = 3R: המאזניים', 3.125, h.getState().reading, 1e-6);
  });

  await T.test('פרק 9: מעבדת מסלולים', async function () {
    var r = T.make(S.orbitLab, { mode: 'race' });
    await T.run(r.play());
    var st = r.getState();
    var a = st.list[0], b = st.list[1];
    T.near('יחס מהירויות', 2, a.v / b.v, 1e-3);
    T.near('יחס זמני הקפה, מדוד', 8, b.lapTimes[0] / a.lapTimes[0], 0.01);
    T.near('הפנימי: סיבובים', 8, a.laps, 0);
    T.near('החיצוני: סיבובים', 1, b.laps, 0);
    T.near('זמן הפנימי, מדוד מול נוסחה, דק\'', G.period(1.5 * R) / 60, a.lapTimes[0] / 60, 0.2);
    T.near('נשאר במעגל: רדיוס פנימי, ביחידות R', 1.5, a.r / R, 1e-3);

    var h = T.make(S.orbitLab, { mode: 'heavy' });
    await T.run(h.play());
    st = h.getState();
    T.near('כבד וקל: אותה מהירות', 0, st.list[0].v - st.list[1].v, 0.01);
    T.near('אותה תאוצה', 0, st.list[0].a - st.list[1].a, 1e-6);
    T.near('תאוצה ב-r = 2R', 2.5, st.list[0].a, 1e-3);
    T.near('יחס כוחות', 4, st.fB / st.fA, 1e-6);
    T.near('הפער נשאר 40°', 40, st.gap, 0.01);

    var p = T.make(S.orbitLab, { mode: 'phasing' });
    await T.run(p.play());
    st = p.getState();
    T.same('מי שהאיץ נשאר מאחור', true, st.lagUp > 60);
    T.near('מי שבלם פוגש את התחנה, במעלות', 0, st.lagDown, 0.2);
    T.near('מרחק פגישה, ביחידות R', 0, st.meet / R, 0.01);
    T.near('גודל ההדלקה, מ/ש', 236, st.dv, 3);
  });

  await T.test('פרק 9: קפלר', async function () {
    var k = T.make(S.kepler, { mode: 'areas', e: 0.6 });
    await T.run(k.play());
    var st = k.getState();
    T.same('עשר פרוסות', 10, st.wedgeCount);
    var min = Math.min.apply(null, st.wedges), max = Math.max.apply(null, st.wedges);
    T.near('פיזור השטחים, יחסי', 0, (max - min) / min, 0.002);
    T.near('שטח הפרוסות, מול שטח האליפסה לחלק ל-10', Math.PI * 9 * R * R * 0.8 / 10 / (R * R), st.wedges[0] / (R * R), 0.01);
    T.near('מהירות הכי מהירה, מ/ש', 9238, st.vMax, 5);
    T.near('מהירות הכי איטית, מ/ש', 2309, st.vMin, 5);
    T.near('מול הנוסחה', st.vp, st.vMax, 5);
    T.near('יחס המהירויות כמו יחס המרחקים', 4, st.vp / st.va, 1e-6);
    T.near('חוזר למקום: x, ביחידות R', -4.8, st.x / R, 0.003);
    T.near('חוזר למקום: y, ביחידות R', 0, st.y / R, 0.003);
    var third = T.make(S.kepler, { mode: 'third' });
    var geo = third.geoRadius();
    T.near('גיאוסטציונרי, ק"מ מהמרכז', 42600, geo / 1000, 50);
    third.setParam('r', geo);
    T.near('שם זמן הקפה, שעות', 24, third.getState().T / 3600, 1e-6);
    var q = third.getState().ratio;
    third.setParam('r', 60 * R);
    T.near('T²/r³ לא משתנה', 1, third.getState().ratio / q, 1e-9);
    T.near('ב-60R: ימים', 27.04, third.getState().T / 86400, 0.01);
    third.setParam('r', 6.8e6);
    T.near('ב-6800 ק"מ: דק\'', 91.75, third.getState().T / 60, 0.05);
  });

  await T.test('פרק 9: בריחה', async function () {
    var e = T.make(S.escape, {});
    await T.run(e.play());
    var st = e.getState(), s = st.shots;
    T.same('8 ק"מ/ש: סיבוב', 'orbit', s[0].kind);
    T.near('סיבוב נסגר, ביחידות R', 0, s[0].closeError / R, 0.002);
    T.same('10 ק"מ/ש: חוזר', 'orbit', s[1].kind);
    T.near('10 ק"מ/ש: הכי רחוק, ביחידות R', 3.571, s[1].maxR / R, 0.01);
    T.same('11.3 ק"מ/ש: לא חוזר', 'away', s[2].kind);
    T.near('אנרגיה כוללת בבריחה, מגה-ג\'ול לק"ג', 0, s[2].E / 1e6, 1e-6);
    T.near('אנרגיה כוללת נשמרת, מגה-ג\'ול לק"ג', 0, st.Enow / 1e6, 0.001);
    T.near('מהירות ב-12R, מ/ש', G.vEsc(12 * R), s[2].vEnd, 15);
    e.setParam('speed', 11.2);
    await T.run(e.fire(11.2));
    T.same('11.2 ק"מ/ש נשאר קשור', true, e.getState().E < 0);
    await T.run(e.fire(11.4));
    T.same('11.4 ק"מ/ש בורח', 'away', e.getState().result);
  });

  /* A shot past the edge of the frame is not an escape: only total energy decides. */
  await T.test('פרק 9: יצא מהתמונה לא אומר ברח', async function () {
    var has = function (s, t) { return String(s).indexOf(t) >= 0; };

    var d = T.make(S.mountainCannon, { free: true, speed: 11, angle: 0, quests: document.createElement('div') });
    await T.run(d.fire());
    var st = d.getState();
    T.same('מגרש, 11 ק"מ/ש: אנרגיה שלילית', true, st.last.E < 0);
    T.same('מגרש, 11 ק"מ/ש: יצא מהתמונה וחוזר', 'far', st.last.result);
    T.same('מגרש, 11 ק"מ/ש: הפסק', 'אליפסה ארוכה', st.verdict);
    T.same('מגרש, 11 ק"מ/ש: הכיתוב אומר שיחזור', true, has(st.caption, 'עוד יחזור'));
    T.same('מגרש, 11 ק"מ/ש: הכיתוב לא אומר בריחה', false, has(st.caption, 'לא חוזר'));
    T.same('מגרש, 11 ק"מ/ש: משימת הבריחה לא מסומנת', undefined, st.quests.gone);
    d.setParam('speed', 11.2);
    await T.run(d.fire());
    st = d.getState();
    T.same('מגרש, 11.2 ק"מ/ש: יצא מהתמונה וחוזר', 'far', st.last.result);
    T.same('מגרש, 11.2 ק"מ/ש: הפסק', 'אליפסה ארוכה', st.verdict);
    T.same('מגרש, 11.2 ק"מ/ש: הכיתוב אומר שיחזור', true, has(st.caption, 'עוד יחזור'));
    T.same('מגרש, 11.2 ק"מ/ש: משימת הבריחה לא מסומנת', undefined, st.quests.gone);
    d.setParam('speed', 11.3);
    await T.run(d.fire());
    st = d.getState();
    T.near('מגרש, 11.3 ק"מ/ש: סך האנרגיה, מגה-ג\'ול לק"ג', -0.155, st.last.E / 1e6, 0.001);
    T.same('מגרש, 11.3 ק"מ/ש: על הסף, לא חוזר', 'away', st.last.result);
    T.same('מגרש, 11.3 ק"מ/ש: הפסק', 'בורח', st.verdict);
    T.same('מגרש, 11.3 ק"מ/ש: הכיתוב', true, has(st.caption, 'בורח ולא חוזר'));
    T.same('מגרש, 11.3 ק"מ/ש: הכיתוב לא אומר שיחזור', false, has(st.caption, 'עוד יחזור'));
    T.same('מגרש, 11.3 ק"מ/ש: משימת הבריחה מסומנת', true, st.quests.gone);
    d = T.make(S.mountainCannon, { free: true, speed: 11.4, angle: 0, quests: document.createElement('div') });
    await T.run(d.fire());
    st = d.getState();
    T.same('מגרש, 11.4 ק"מ/ש: בריחה', 'away', st.last.result);
    T.same('מגרש, 11.4 ק"מ/ש: הפסק', 'בורח', st.verdict);
    T.same('מגרש, 11.4 ק"מ/ש: הכיתוב', true, has(st.caption, 'בורח ולא חוזר'));
    T.same('מגרש, 11.4 ק"מ/ש: משימת הבריחה מסומנת', true, st.quests.gone);

    T.same('סף: 11.3 ק"מ/ש בתוך העיגול של הדף', true, G.onEdge(11300 * 11300 / 2 - G.GM / R));
    T.same('סף: 11.2 ק"מ/ש מחוץ לו', false, G.onEdge(11200 * 11200 / 2 - G.GM / R));
    T.same('סף: 11.4 ק"מ/ש מחוץ לו', false, G.onEdge(11400 * 11400 / 2 - G.GM / R));

    var e = T.make(S.escape, { locked: false }), ec = T.stage.lastElementChild;
    await T.run(e.fire(11.3));
    await T.settle();
    st = e.getState();
    T.same('בריחה, 11.3 ק"מ/ש: על הסף, לא חוזר', 'away', st.result);
    T.same('בריחה, 11.3 ק"מ/ש: הכיתוב', true, has(st.caption, 'סך האנרגיה כ-0, לא חוזר'));
    T.same('בריחה, 11.3 ק"מ/ש: הכיתוב לא אומר שיחזור', false, has(st.caption, 'עוד יחזור'));
    T.same('בריחה, 11.3 ק"מ/ש: המדד אומר כ-0', true, has(ec.textContent, "כ-0 מגה-ג'ול"));
    T.same('בריחה, 11.3 ק"מ/ש: המדד בלי ערך שלילי', false, has(ec.textContent, '0.2 מגה'));
    await T.run(e.fire(11.2));
    await T.settle();
    st = e.getState();
    T.same('בריחה, 11.2 ק"מ/ש: יצא מהתמונה וחוזר', 'far', st.result);
    T.same('בריחה, 11.2 ק"מ/ש: הכיתוב אומר שיחזור', true, has(st.caption, 'עוד יחזור'));
    T.same('בריחה, 11.2 ק"מ/ש: המדד שלילי', true, has(ec.textContent, "1.3 מגה-ג'ול"));
    await T.run(e.fire(11.29));
    T.same('בריחה, 11.29 ק"מ/ש: מתחת לסף', 'far', e.getState().result);
    await T.run(e.fire(11));
    st = e.getState();
    T.same('בריחה, 11 ק"מ/ש: אנרגיה שלילית', true, st.E < 0);
    T.same('בריחה, 11 ק"מ/ש: יצא מהתמונה וחוזר', 'far', st.result);
    T.same('בריחה, 11 ק"מ/ש: הכיתוב אומר שיחזור', true, has(st.caption, 'עוד יחזור'));
    T.same('בריחה, 11 ק"מ/ש: הכיתוב לא אומר בריחה', false, has(st.caption, 'לא חוזר'));
    await T.run(e.fire(10.5));
    T.same('בריחה, 10.5 ק"מ/ש: חוזר על המסך', 'orbit', e.getState().result);
    T.near('בריחה, 10.5 ק"מ/ש: הכי רחוק, ביחידות R', 6.21, e.getState().maxR / R, 0.02);
    await T.run(e.fire(11.4));
    st = e.getState();
    T.same('בריחה, 11.4 ק"מ/ש: אנרגיה חיובית', true, st.E > 0);
    T.same('בריחה, 11.4 ק"מ/ש: הכיתוב', true, has(st.caption, 'כבר לא חוזר'));

    var c = T.make(S.fallingCurve, { locked: false });
    await T.run(c.fly(7));
    T.same('עיקול, 7 ק"מ/ש: הגובה ירד', true, has(c.getState().caption, 'הגובה ירד'));
    T.same('עיקול, 7 ק"מ/ש: לא אומר שהגובה לא השתנה', false, has(c.getState().caption, 'לא השתנה'));
    await T.run(c.fly(8));
    T.same('עיקול, 8 ק"מ/ש: הגובה לא השתנה', true, has(c.getState().caption, 'לא השתנה'));

    var g = T.make(S.missionOrbit, { seed: 5 }), gc = T.stage.lastElementChild;
    g.setParam('speed', 12);
    g.launch();
    g.advance(30);
    T.same('משחק, 12 ק"מ/ש: יצא מהמסלול', 'away', g.getState().flightEnd.kind);
    T.same('משחק, 12 ק"מ/ש: לא נקרא אליפסה', false, has(gc.textContent, 'יצאה אליפסה'));
    T.same('משחק, 12 ק"מ/ש: נקרא בריחה', true, has(gc.textContent, 'בורח ולא חוזר'));

    var k = T.make(S.kepler, { mode: 'third' });
    k.setParam('r', k.geoRadius());
    T.same('גיאוסטציונרי מדויק: הכיתוב מופיע', true, k.getState().geo);
    k.setParam('r', 42100e3);
    T.same('42,100 ק"מ: הכיתוב לא מופיע', false, k.getState().geo);
  });

  /* While a card's sim is locked and ready, its stage must not answer the card. After the run it works in free play. */
  await T.test('פרק 9: לפני הניחוש הבמה לא עונה על השאלה', async function () {
    var has = function (el, t) { return el.textContent.indexOf(t) >= 0; };

    var c = T.make(S.fallingCurve, { locked: true }), cc = T.stage.lastElementChild;
    await T.settle();
    T.same('עיקול נעול: מוסתר', true, c.getState().secret);
    T.same('עיקול נעול: 5 מ\' לא מופיע', false, has(cc, "5 מ'"));
    await T.run(c.play());
    await T.settle();
    T.same('עיקול אחרי הריצה: 5 מ\' מופיע', true, has(cc, "5 מ'"));
    c.setParam('locked', false);
    await T.run(c.fly(4));
    T.same('עיקול חופשי: 4 ק"מ/ש נופל', true, c.getState().crashed);

    var m = T.make(S.appleMoon, { locked: true }), mc = T.stage.lastElementChild;
    await T.settle();
    T.same('ירח נעול: מוסתר', true, m.getState().secret);
    T.same('ירח נעול: התאוצה לא מופיעה', false, has(mc, '0.0028'));
    T.same('ירח נעול: התווית לא מגלה את הדרך', false, has(mc, '1/60'));
    await T.run(m.play());
    await T.settle();
    T.same('ירח אחרי הריצה: התאוצה מופיעה', true, has(mc, '0.0028'));
    T.same('ירח אחרי הריצה: התווית חוזרת', true, has(mc, '1/60'));
    m.setParam('locked', false);
    m.setParam('gravity', false);
    await T.run(m.launch());
    T.same('ירח חופשי: בלי כבידה הוא עוזב', true, m.getState().r > 60 * R * 1.45);

    var f = T.make(S.towerStation, { mode: 'float', locked: true }), fc = T.stage.lastElementChild;
    await T.settle();
    T.same('תחנה נעולה: מוסתר', true, f.getState().secret);
    T.same('תחנה נעולה: g לא מופיע', false, has(fc, '8.9'));
    T.same('תחנה נעולה: המאזניים לא מופיעים', false, has(fc, '44.3'));
    await T.run(f.play());
    await T.settle();
    T.same('תחנה אחרי הריצה: לא מוסתר', false, f.getState().secret);
    T.same('תחנה אחרי הריצה: g מופיע', true, has(fc, '8.9'));

    var h = T.make(S.towerStation, { mode: 'height', locked: true }), hc = T.stage.lastElementChild;
    await T.settle();
    T.same('גובה נעול: מוסתר', true, h.getState().secret);
    T.same('גובה נעול: r לא מופיע', false, has(hc, '6,400'));
    T.same('גובה נעול: המשקל על הקרקע, שהשאלה נותנת, מופיע', true, has(hc, '50 ניוטון'));
    await T.run(h.play());
    await T.settle();
    T.same('גובה אחרי הריצה: r מופיע', true, has(hc, '12,800'));
    h.setParam('locked', false);
    h.setParam('height', 2651e3);
    T.near('גובה חופשי: 25 ניוטון', 25, h.getState().reading, 0.02);

    var r = T.make(S.orbitLab, { mode: 'race', locked: true }), rc = T.stage.lastElementChild;
    await T.settle();
    T.same('מרוץ נעול: מוסתר', true, r.getState().secret);
    T.same('מרוץ נעול: מהירויות לא מופיעות', false, has(rc, '6.53') || has(rc, '3.27'));
    T.same('מרוץ נעול: זמנים לא מופיעים', false, has(rc, 'שעות'));
    await T.run(r.play());
    await T.settle();
    T.same('מרוץ אחרי הריצה: מהירויות מופיעות', true, has(rc, '6.53') && has(rc, '3.27'));
    T.same('מרוץ: "סיבוב אחד" בכיתוב', true, r.getState().caption.indexOf('סיבוב אחד') >= 0);
    r.setParam('locked', false);
    r.setParam('ratio', 9);
    await T.run(r.play());
    T.near('מרוץ חופשי: פי 9, 27 סיבובים', 27, r.getState().list[0].laps, 0);

    var w = T.make(S.orbitLab, { mode: 'heavy', locked: true, massA: 1, massB: 4 }), wc = T.stage.lastElementChild;
    await T.settle();
    T.same('כבד וקל נעול: מוסתר', true, w.getState().secret);
    T.same('כבד וקל נעול: התאוצה לא מופיעה', false, has(wc, '2.5 מ/ש'));
    T.same('כבד וקל נעול: התווית לא אומרת "של שניהם"', false, has(wc, 'של שניהם'));
    await T.run(w.play());
    await T.settle();
    T.same('כבד וקל אחרי הריצה: התאוצה מופיעה', true, has(wc, '2.5 מ/ש'));
    T.same('כבד וקל אחרי הריצה: התווית חוזרת', true, has(wc, 'של שניהם'));
    w.setParam('locked', false);
    w.setParam('massB', 100);
    await T.run(w.play());
    T.near('כבד וקל חופשי: 100 טון, הפער 40°', 40, w.getState().gap, 0.01);

    var p = T.make(S.orbitLab, { mode: 'phasing', locked: true }), pc = T.stage.lastElementChild;
    await T.settle();
    T.same('השגה נעולה: מוסתר', true, p.getState().secret);
    T.same('השגה: המדדים בלי צבע של נכון ולא נכון', '', pc.querySelector('.readout').style.getPropertyValue('--r-color'));
    await T.run(p.play());
    T.same('השגה אחרי הריצה: לא מוסתר', false, p.getState().secret);

    var k = T.make(S.kepler, { mode: 'areas', e: 0.6, locked: true }), kc = T.stage.lastElementChild;
    await T.settle();
    T.same('קפלר נעול: מוסתר', true, k.getState().secret);
    T.same('קפלר נעול: המהירויות לא מופיעות', false, has(kc, '9.2') || has(kc, '2.3'));
    await T.run(k.play());
    await T.settle();
    T.same('קפלר אחרי הריצה: המהירויות מופיעות', true, has(kc, '9.2') && has(kc, '2.3'));
    k.setParam('locked', false);
    k.setParam('e', 0.3);
    await T.run(k.play());
    T.same('קפלר חופשי: עשר פרוסות', 10, k.getState().wedgeCount);

    var e = T.make(S.escape, { locked: true }), ec = T.stage.lastElementChild;
    await T.settle();
    T.same('בריחה נעולה: 11.3 לא מופיע', false, has(ec, '11.3'));
    T.same('בריחה נעולה: מתחילים מ-8 ק"מ/ש', true, has(ec, '8 ק"מ/ש'));
    await T.run(e.play());
    await T.settle();
    T.same('בריחה אחרי הריצה: 11.3 מופיע', true, has(ec, '11.3'));
    var card = e.getState();
    T.same('ריצת הכרטיס: הירייה האחרונה לא חוזרת', 'away', card.result);
    T.same('ריצת הכרטיס: הכיתוב', '11.3 ק"מ/ש: סך האנרגיה 0, לא חוזר', card.caption);
    T.same('ריצת הכרטיס: סך האנרגיה מוצג כ-0', true, has(ec, "0 מגה-ג'ול") && !has(ec, 'כ-0'));
    T.near('ריצת הכרטיס: יחס למהירות המסלול, פי 1.41', 1.41, card.shots[2].v / 8, 0.005);
    T.near('ריצת הכרטיס: בור של 64 מגה-ג\'ול לק"ג', 64, G.GM / R / 1e6, 1e-9);
    e.setParam('locked', false);
    await T.run(e.fire(9));
    T.same('בריחה חופשית: 9 ק"מ/ש חוזר', 'orbit', e.getState().result);
  });

  await T.test('פרק 9: תלת-ממד, מספרים ונפילה מסודרת', async function () {
    var host = document.createElement('div'), ctl = document.createElement('div');
    T.stage.appendChild(host);
    T.stage.appendChild(ctl);
    var o = S.orbit3d(host, ctl, { threeUrl: 'nonexistent-three.js', r: 6.66, inclination: 0 });
    var st = o.getState();
    T.near('אותם מספרים: 6.66R, שעות', 24, st.T / 3600, 0.1);
    T.near('אותם מספרים: מהירות, מ/ש', G.vCirc(6.66 * R), st.v, 1e-6);
    o.start();
    for (var i = 0; i < 200 && o.getState().state !== 'failed'; i++) {
      await T.settle();
      await new Promise(function (r) { setTimeout(r, 10); });
    }
    T.same('בלי ספרייה: נופל לטקסט ולא נתקע', 'failed', o.getState().state);
    T.same('ההודעה בעברית מופיעה', true, !!host.querySelector('.c3d-fallback'));
    T.same('יש קישור למגרש הדו-ממדי', '#playground', host.querySelector('.c3d-fallback a').getAttribute('href'));
  });

  /* ---------- The game ---------- */
  var grid = function (v, step) { return Math.round(v / step) * step; };
  function solveLevel1(g) {
    var s = g.getState();
    g.setParam('speed', grid(s.vc / 1000, 0.1));
    return g.launch();
  }
  function solveLevel2(g) {
    var s = g.getState();
    g.setParam('dv', grid(s.H.dv1 / 1000, 0.02));
    g.burn();
    g.advanceUntil(function (q) { return q.farOff !== null && q.farOff < 1.2; }, 30);
    s = g.getState();
    var dv2 = G.vCirc(s.el.r) - s.el.v;
    g.setParam('dv', grid(dv2 / 1000, 0.02));
    g.burn();
  }
  function solveLevel3(g) {
    g.advanceUntil(function (q) { return Math.abs(q.windowError) < 1.5; }, 40);
    g.burn();
    return g.advanceUntil(function (q) { return q.phase !== 'transfer'; }, 30);
  }

  for (var seed = 1; seed <= 8; seed++) {
    await (async function (seed) {
      await T.test('פרק 9: משחק, גרעין ' + seed, async function () {
        var done = null;
        var g = T.make(S.missionOrbit, { seed: seed * 7919, onDone: function (stars, total) { done = { stars: stars, total: total }; } });
        await T.run(solveLevel1(g));
        var s = g.getState();
        T.same('שלב 1: הפותר מנצח', 'won', s.phase);
        T.same('שלב 1: 3 נקודות', 3, s.points[0]);
        g.next();
        s = g.getState();
        T.same('עוברים לשלב 2', 1, s.level);
        solveLevel2(g);
        s = g.getState();
        T.same('שלב 2: הפותר מנצח', 'won', s.phase);
        T.same('שלב 2: 3 נקודות', 3, s.points[1]);
        T.near('שלב 2: דלק מול הכי חסכוני', 1, s.ratio, 0.04);
        T.near('שלב 2: מסלול סופי, סטייה מהטבעת', 0, Math.abs(s.el.a - s.r2) / s.r2, 0.04);
        g.next();
        s = g.getState();
        T.same('עוברים לשלב 3', 2, s.level);
        solveLevel3(g);
        s = g.getState();
        T.same('שלב 3: הפותר מנצח', 'won', s.phase);
        T.same('שלב 3: 3 נקודות', 3, s.points[2]);
        g.next();
        s = g.getState();
        T.same('סיום', 'done', s.phase);
        T.same('3 כוכבים', 3, s.stars);
        T.same('onDone נקרא', 3, done && done.stars);
      });
    })(seed);
  }

  await T.test('פרק 9: משחק, קלט רע מפסיד', async function () {
    var g = T.make(S.missionOrbit, { seed: 4242 });
    var s = g.getState();
    /* Too slow: lands, or at best a sunken orbit. Not a win. */
    g.setParam('speed', 3);
    var r = null;
    await T.run(g.launch().then(function (x) { r = x; }));
    T.same('שלב 1: 3 ק"מ/ש נוחת', 'crash', r.kind);
    T.same('שלב 1: לא ניצחון', 'aim', g.getState().phase);
    /* Too fast: not a circle. */
    g.setParam('speed', 11.9);
    await T.run(g.launch().then(function (x) { r = x; }));
    T.same('שלב 1: מהיר מדי לא ניצחון', 'aim', g.getState().phase);
    T.same('שלב 1: נשאר ניסיון נוסף', 2, g.getState().attempts);
    await T.run(solveLevel1(g));
    s = g.getState();
    T.same('שלב 1: ניצחון בניסיון שלישי', 'won', s.phase);
    T.same('שלב 1: נקודה אחת', 1, s.points[0]);
    g.next();

    /* Level 2: the second burn at the wrong moment, right after the first, leaves an ellipse. */
    s = g.getState();
    g.setParam('dv', grid(s.H.dv1 / 1000, 0.02));
    g.burn();
    g.advance(0.1);
    g.setParam('dv', grid(s.H.dv2 / 1000, 0.02));
    g.burn();
    s = g.getState();
    T.same('שלב 2: הדלקה בזמן הלא נכון לא מנצחת', 'aim', s.phase);
    T.same('שלב 2: דלק נשרף', true, s.fuel > 0);

    /* Burning with an empty slider does nothing. */
    var f0 = g.getState().fuel;
    g.setParam('dv', 0);
    g.burn();
    T.same('שלב 2: דחיפה של 0 לא שורפת דלק', f0, g.getState().fuel);

    /* Throw it away: a huge burn resets to the inner orbit instead of a dead end. */
    g.setParam('dv', 3);
    g.burn();
    g.setParam('dv', 3);
    g.burn();
    s = g.getState();
    T.near('שלב 2: אין מבוי סתום, חזרה למסלול הפנימי', s.r1, s.el.r, s.r1 * 0.01);
    solveLevel2(g);
    s = g.getState();
    T.same('שלב 2: עדיין אפשר לנצח', 'won', s.phase);
    T.same('שלב 2: פחות נקודות על בזבוז', 1, s.points[1]);
    g.next();

    /* Level 3: burning at once, when the window is far, misses. */
    s = g.getState();
    T.same('שלב 3: החלון עוד רחוק', true, Math.abs(s.windowError) > 30);
    g.burn();
    g.advanceUntil(function (q) { return q.phase !== 'transfer'; }, 30);
    s = g.getState();
    T.same('שלב 3: הדלקה מוקדמת מחמיצה', 'aim', s.phase);
    T.same('שלב 3: מדווח על ההחמצה', true, Math.abs(s.lastMiss) > 10);
    var fuelAfterMiss = s.fuel;
    T.near('שלב 3: החמצה עולה טיסה וחזרה', 2, fuelAfterMiss / s.ideal, 0.01);
    solveLevel3(g);
    s = g.getState();
    T.same('שלב 3: ניצחון אחרי החמצה', 'won', s.phase);
    T.near('שלב 3: סך הדלק, פי', 3, s.ratio, 0.01);
    T.same('שלב 3: 2 נקודות', 2, s.points[2]);
    g.next();
    s = g.getState();
    T.same('סיום', 'done', s.phase);
    T.same('כוכב אחד: 4 נקודות מתוך 9', 1, s.stars);
    g.reset();
    s = g.getState();
    T.same('משחק חוזר: שלב 1', 0, s.level);
    T.same('משחק חוזר: בלי נקודות', 0, s.points.length);
  });

  await T.test('פרק 9: בכל גובה יש פתרון על הסליידר', async function () {
    [400, 800, 1600, 3200, 6400].forEach(function (hKm) {
      var r = R + hKm * 1000, vc = G.vCirc(r), found = 0;
      for (var v = 30; v <= 120; v++) {
        var b = G.body(0, r, v * 100, 0);
        if (G.elements(b).e <= 0.035) found++;
      }
      T.same('גובה ' + hKm + ': לפחות ערך אחד', true, found >= 1 && vc > 0);
    });
  });
});

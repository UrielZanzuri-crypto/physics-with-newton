/* Chapter 4: key numbers measured from the running sims against the formulas, plus the game solver. */
PHY_T.load([
  'ch04/kit.js', 'ch04/inertia.js', 'ch04/crate-lanes.js', 'ch04/force-sandbox.js', 'ch04/fbd.js', 'ch04/pairs.js',
  'ch04/friction-pull.js', 'ch04/incline.js', 'ch04/pulley.js', 'ch04/elevator.js', 'ch04/elevator-game.js',
]);

PHY_T.add(async function (T) {
  var S = PHY.sims, F = PHY.fmt;

  /* The canvas and the controls of the sim that T.make just added. */
  function lastControls() { return T.stage.lastElementChild; }
  function lastCanvas() { return T.stage.lastElementChild.previousElementSibling; }
  function values(controls) { return [].map.call(controls.querySelectorAll('.r-value'), function (e) { return e.textContent; }); }

  /* Builds a sim in a box of a given width and records what its last frame drew: arrows and text, in pixels. */
  function measured(factory, opts, width) {
    var box = document.createElement('div'), canvas = document.createElement('canvas'), controls = document.createElement('div');
    box.style.width = width + 'px';
    box.appendChild(canvas);
    T.stage.appendChild(box);
    T.stage.appendChild(controls);
    var create = PHY.canvas.create, marks = [], view = null;
    PHY.canvas.create = function () {
      view = create.apply(this, arguments);
      var arrow = view.arrow, screenText = view.screenText, clear = view.clear;
      view.clear = function () { marks.length = 0; return clear.apply(this, arguments); };
      view.arrow = function (x1, y1, x2, y2, o) {
        marks.push({ arrow: true, x1: view.sx(x1), y1: view.sy(y1), x2: view.sx(x2), y2: view.sy(y2), color: o && o.color });
        return arrow.apply(this, arguments);
      };
      view.screenText = function (px, py, str, o) {
        o = o || {};
        var ctx = view.ctx;
        ctx.save();
        ctx.font = (o.weight || 500) + ' ' + (o.size || 13) + 'px Heebo, Rubik, system-ui, sans-serif';
        var w = ctx.measureText(String(str)).width;
        ctx.restore();
        var x0 = o.align === 'left' ? px : o.align === 'right' ? px - w : px - w / 2;
        var hh = (o.size || 13) / 2 + (o.pill ? 6 : 0);
        marks.push({ str: String(str), x0: x0, x1: x0 + w, y0: py - hh, y1: py + hh });
        return screenText.apply(this, arguments);
      };
      return view;
    };
    var sim;
    try { sim = factory(canvas, controls, opts); } finally { PHY.canvas.create = create; }
    sim.start();
    return { sim: sim, view: view, marks: marks };
  }
  /* How many pixels the last frame goes past the edge of the canvas. An arrowhead needs a few pixels of room. */
  function overflow(m) {
    var w = m.view.w, h = m.view.h, worst = 0, what = '';
    m.marks.forEach(function (k) {
      var over = k.arrow
        ? Math.max(6 - k.x2, k.x2 + 6 - w, 6 - k.y2, k.y2 + 6 - h, -k.x1, k.x1 - w, -k.y1, k.y1 - h)
        : Math.max(-k.x0, k.x1 - w, -k.y0, k.y1 - h);
      if (over > worst) { worst = over; what = k.arrow ? 'חץ' : k.str; }
    });
    return { px: worst, what: what };
  }
  /* The gap in pixels between a segment and a text box, with the segment's head taken as 7 pixels wide. */
  function gap(a, t) {
    var best = Infinity;
    for (var i = 0; i <= 200; i++) {
      var x = a.x1 + ((a.x2 - a.x1) * i) / 200, y = a.y1 + ((a.y2 - a.y1) * i) / 200;
      var dx = Math.max(t.x0 - x, 0, x - t.x1), dy = Math.max(t.y0 - y, 0, y - t.y1);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best - 7;
  }

  await T.test('פרק 4: הדיסקית', async function () {
    var sim = T.make(S.inertia, { mode: 'puck' });
    await T.run(sim.play());
    var l = sim.getState().lanes;
    T.near('שטיח, דרך לעצירה v²/2μg', 1.6, l[0].stopX, 0.01);
    T.near('שטיח, זמן לעצירה', 0.8, l[0].stopT, 0.01);
    T.near('עץ, דרך לעצירה', 4, l[1].stopX, 0.01);
    T.near('קרח, דרך לעצירה', 8, l[2].stopX, 0.02);
    T.near('קרח, זמן לעצירה', 4, l[2].stopT, 0.01);
    T.near('בלי חיכוך, מהירות בסוף', 4, l[3].v, 1e-9);
    T.same('בלי חיכוך, לא עצר', null, l[3].stopT);
    T.near('בלי חיכוך, דרך ב-4 ש\' ועוד 1.3 ש\'', 4 * 5.3, l[3].x, 0.1);
  });

  await T.test('פרק 4: האוטובוס', async function () {
    var sim = T.make(S.inertia, { mode: 'bus' });
    await T.run(sim.play());
    var s = sim.getState();
    T.near('מהירות התפוח לפני הפגיעה לא השתנתה', 6, s.appleV, 1e-9);
    T.near('האוטובוס עצר', 0, s.busV, 1e-9);
    T.near('דרך האוטובוס: 0.5 ש\' ועוד v²/2a', 3 + 4.5, s.busX, 0.05);
    var d = [];
    var st = s.stamps.filter(function (q, i) { return i > 0; });
    for (var i = 1; i < st.length; i++) if (st[i].rel < 6) d.push(st[i].apple - st[i - 1].apple);
    var min = Math.min.apply(null, d), max = Math.max.apply(null, d);
    T.near('נקודות התפוח, פיזור בין מרווחים', 0, max - min, 0.07);
    T.near('מרווח בין נקודות: 6 מ/ש כפול 0.25 ש\'', 1.5, (min + max) / 2, 0.05);
  });

  await T.test('פרק 4: החוק השני', async function () {
    var sim = T.make(S.crateLanes, { mode: 'push', F: 10, m: 2 });
    await T.run(sim.play());
    var s = sim.getState();
    T.near('תאוצת 2 ק"ג, נמדדת', 5, s.lanes[0].v / s.t, 0.01);
    T.near('תאוצת 4 ק"ג, נמדדת', 2.5, s.lanes[1].v / s.t, 0.01);
    T.near('באותו זמן, הכבד עבר חצי דרך', 0.5, s.lanes[1].x / s.lanes[0].x, 0.001);
    T.near('x = ½at², 2 ק"ג', 0.5 * 5 * s.t * s.t, s.lanes[0].x, 0.01);
    sim.setParam('locked', false);
    sim.setParam('F', 20);
    await T.run(sim.play());
    var q = sim.getState();
    T.near('כוח כפול, תאוצה כפולה', 10, q.lanes[0].v / q.t, 0.02);
  });

  await T.test('פרק 4: מהירות קבועה', async function () {
    var sim = T.make(S.crateLanes, { mode: 'steady' });
    await T.run(sim.play());
    var l = sim.getState().lanes;
    T.near('משיכה 25 ניוטון, מהירות אחרי 4.5 ש\'', 4.25, l[0].v, 0.02);
    T.near('משיכה 20 ניוטון, מהירות אחרי 4.5 ש\'', 2, l[1].v, 1e-9);
    T.near('משיכה 20 ניוטון, שקול', 0, l[1].net, 1e-9);
    T.near('משיכה 20 ניוטון, דרך', 9, l[1].x, 0.05);
    T.near('משיכה 15 ניוטון, נעצר', 0, l[2].v, 1e-9);
    T.near('משיכה 15 ניוטון, זמן עצירה', 4, l[2].stopT, 0.02);
    T.near('משיכה 15 ניוטון, דרך', 4, l[2].x, 0.03);
  });

  await T.test('פרק 4: מסה ומשקל', async function () {
    var sim = T.make(S.crateLanes, { mode: 'fall', m2: 3 });
    await T.run(sim.play());
    var l = sim.getState().lanes;
    T.near('1 ק"ג, זמן נפילה מ-20 מ\'', 2, l[0].landT, 0.01);
    T.near('3 ק"ג, זמן נפילה מ-20 מ\'', 2, l[1].landT, 0.01);
    T.near('1 ק"ג, כוח', 10, l[0].net, 1e-9);
    T.near('3 ק"ג, כוח', 30, l[1].net, 1e-9);
    T.near('3 ק"ג, תאוצה', 10, l[1].a, 1e-9);
    T.near('מהירות בנחיתה', 20, l[1].v, 0.05);
    sim.setParam('locked', false);
    sim.setParam('m2', 10);
    await T.run(sim.play());
    T.near('10 ק"ג, אותו זמן', 2, sim.getState().lanes[1].landT, 0.01);
  });

  await T.test('פרק 4: ארגז החול', async function () {
    var sim = T.make(S.forceSandbox, { m: 2 });
    sim.setForces([{ x: 20, y: 0 }]);
    sim.run(true);
    sim.advance(1);
    var s = sim.getState();
    T.near('20 ניוטון על 2 ק"ג, תאוצה', 10, s.a.x, 1e-9);
    T.near('מהירות אחרי 1 ש\'', 10, s.vel.x, 0.01);
    T.near('דרך אחרי 1 ש\'', 5, s.pos.x, 0.05);
    sim.setForces([{ x: 30, y: 0 }, { x: 0, y: 40 }]);
    T.near('שקול 30 ו-40 בניצב', 50, sim.getState().netLen, 1e-9);
    sim.setForces([{ x: 30, y: 0 }, { x: 0, y: 40 }, { x: -30, y: -40 }]);
    var v0 = sim.getState().vel.x;
    sim.advance(0.5);
    T.near('משולש סגור, שקול', 0, sim.getState().netLen, 1e-9);
    T.near('משולש סגור, המהירות לא משתנה', v0, sim.getState().vel.x, 1e-9);
    sim.setForces([{ x: 10, y: 0 }]);
    sim.setParam('m', 4);
    T.near('מסה 4 ק"ג, 10 ניוטון', 2.5, sim.getState().a.x, 1e-9);
    sim.reset();
    T.near('התחלה מחדש מאפסת מהירות', 0, sim.getState().vel.x, 1e-9);
  });

  await T.test('פרק 4: כוח נורמלי', async function () {
    var sim = T.make(S.fbd, { mode: 'press' });
    T.near('בלי כף, N = mg', 50, sim.getState().N, 1e-9);
    await T.run(sim.play());
    T.near('כף לוחצת 20 ניוטון', 70, sim.getState().N, 1e-6);
    sim.setParam('hand', -20);
    T.near('כף מרימה 20 ניוטון', 30, sim.getState().N, 1e-9);
    var p = T.make(S.fbd, { mode: 'pull' });
    var pc = lastControls();
    T.near('בלי חבל, N = mg', 100, p.getState().N, 1e-9);
    await T.run(p.play());
    var q = p.getState();
    T.near('חבל 50 ניוטון ב-37°, רכיב אנכי', 30, q.up, 1e-6);
    T.near('חבל 50 ניוטון ב-37°, רכיב אופקי', 40, q.side, 1e-6);
    T.near('חבל 50 ניוטון ב-37°, N', 70, q.N, 1e-6);
    p.setParam('rope', 60);
    var w = p.getState();
    T.near('חבל 60 ניוטון ב-37°, רכיב אנכי', 36, w.up, 1e-6);
    T.near('חבל 60 ניוטון ב-37°, רכיב אופקי', 48, w.side, 1e-6);
    T.near('חבל 60 ניוטון ב-37°, המאזניים', 64, w.N, 1e-6);
    T.near('החיכוך הדרוש בקצה הסליידר: 48 ניוטון על 64 ניוטון', 0.75, w.side / w.N, 1e-9);
    T.same('הסליידר נעצר ב-60 ניוטון', '60', pc.querySelector('input[type=range]').max);
  });

  await T.test('פרק 4: דיאגרמות כוחות', async function () {
    var sim = T.make(S.fbd, { mode: 'builder' });
    T.same('חיכוך על שולחן נדחה', false, sim.choose('friction').ok);
    T.same('כוח התנועה נדחה', false, sim.choose('motion').ok);
    T.same('כוח על השולחן נדחה', false, sim.choose('reaction').ok);
    T.same('כבידה מתקבלת', true, sim.choose('gravity').ok);
    T.same('עוד לא שלם', false, sim.getState().complete);
    T.same('נורמלי משלים', true, sim.choose('normal').complete);
    T.near('שולחן, שקול', 0, sim.getState().net.y, 1e-9);
    sim.setScene('press');
    sim.choose('gravity'); sim.choose('hand');
    T.same('כף, נורמלי משלים', true, sim.choose('normal').complete);
    T.near('כף, N', 70, sim.getState().magnitudes.normal, 1e-9);
    T.near('כף, שקול', 0, sim.getState().net.y, 1e-9);
    sim.setScene('hang');
    T.same('תלוי, נורמלי נדחה', false, sim.choose('normal').ok);
    sim.choose('gravity');
    T.same('תלוי, מתיחות משלימה', true, sim.choose('tension').complete);
    sim.setScene('slope');
    sim.choose('gravity'); sim.choose('normal');
    T.same('מדרון, חיכוך משלים', true, sim.choose('friction').complete);
    var s = sim.getState();
    T.near('מדרון, N = mg cos37°', 40, s.magnitudes.normal, 1e-9);
    T.near('מדרון, f = mg sin37°', 30, s.magnitudes.friction, 1e-9);
    T.near('מדרון, שקול x', 0, s.net.x, 1e-9);
    T.near('מדרון, שקול y', 0, s.net.y, 1e-9);
    T.same('ארבע סצנות הושלמו', 4, s.done.length);
  });

  await T.test('פרק 4: החוק השלישי', async function () {
    var sim = T.make(S.pairs, { mode: 'push' });
    await T.run(sim.play());
    var s = sim.getState();
    T.near('מהירות הקטן: F t / m', 4, -s.vSmall, 0.02);
    T.near('מהירות הגדול: F t / m', 1, s.vBig, 0.01);
    T.near('יחס המהירויות', 4, -s.vSmall / s.vBig, 0.02);
    T.near('סך התנע נשאר 0', 0, s.small * s.vSmall + s.big * s.vBig, 0.01);
    var d = T.make(S.pairs, { mode: 'sled' });
    await T.run(d.play());
    var q = d.getState();
    T.near('תאוצת המזחלת', 1, q.aSled, 1e-9);
    T.near('תאוצת ניוטון זהה', 1, q.aCat, 1e-9);
    T.near('מהירות אחרי 4 ש\'', 4, q.v, 0.01);
    T.near('דרך אחרי 4 ש\'', 8, q.x, 0.05);
  });

  await T.test('פרק 4: חיכוך', async function () {
    var sim = T.make(S.frictionPull, {});
    await T.run(sim.play({ to: 30 }));
    var s = sim.getState();
    T.near('N של 10 ק"ג', 100, s.N, 1e-9);
    T.near('משיכה 30 ניוטון, חיכוך', 30, s.f, 1e-6);
    T.same('משיכה 30 ניוטון, נשאר דבוק', true, s.stuck);
    sim.setParam('pull', 50);
    sim.advance(0.05);
    T.near('בדיוק בגבול, 50 ניוטון', 50, sim.getState().f, 1e-9);
    T.same('בדיוק בגבול, עוד דבוק', true, sim.getState().stuck);
    sim.setParam('pull', 51);
    sim.advance(0.05);
    var b = sim.getState();
    T.same('מעל הגבול, החליק', false, b.stuck);
    T.near('אחרי השבירה, חיכוך קינטי', 40, b.f, 1e-9);
    T.near('אחרי השבירה, a = (51 - 40)/10', 1.1, b.a, 1e-9);
    sim.setParam('pull', 60);
    var v0 = sim.getState().v;
    sim.advance(1);
    T.near('60 ניוטון, מהירות נמדדת', v0 + 2, sim.getState().v, 0.02);
    sim.setParam('pull', 30);
    sim.advance(5);
    var c = sim.getState();
    T.same('מורידים ל-30 ניוטון, נעצר ונדבק', true, c.stuck);
    T.near('שוב דבוק, חיכוך 30 ניוטון', 30, c.f, 1e-9);
    sim.reset();
    T.near('אפס משיכה, אפס חיכוך', 0, sim.getState().f, 1e-9);
    /* 80 N against 40 N on 10 kg: 4 m/s², with no speed limit. */
    var h = T.make(S.frictionPull, {});
    h.setParam('locked', false);
    h.setParam('pull', 80);
    h.advance(10);
    var hs = h.getState();
    T.near('80 ניוטון אחרי 10 ש\', המהירות לא קפאה', 40, hs.v, 0.05);
    T.near('80 ניוטון אחרי 10 ש\', התאוצה', 4, hs.a, 1e-9);
    h.advance(1);
    T.near('עוד שנייה, עוד 4 מ/ש', hs.v + 4, h.getState().v, 0.02);
  });

  await T.test('פרק 4: מדרון', async function () {
    var r = T.make(S.incline, { two: true, angle: 37, mu: 0.25, locked: true });
    await T.run(r.play({ two: true }));
    var s = r.getState();
    T.near('10 ק"ג, תאוצה', 4, s.race[0].a, 1e-9);
    T.near('2 ק"ג, תאוצה', 4, s.race[1].a, 1e-9);
    T.near('10 ק"ג, מהירות בסוף 8 מ\'', 8, s.race[0].endV, 0.05);
    T.near('הפרש המהירויות', 0, s.race[0].v - s.race[1].v, 1e-9);
    T.near('הפרש הדרכים', 0, s.race[0].s - s.race[1].s, 1e-9);
    T.near('זמן המרוץ', 2, s.tEnd, 0.02);
    var a = T.make(S.incline, { angle: 37, mu: 0.25, m: 5 });
    await T.run(a.play({ two: false }));
    var q = a.getState();
    T.near('תרגיל: 5 ק"ג, זמן ל-8 מ\'', 2, q.tEnd, 0.01);
    T.near('תרגיל: מהירות בסוף', 8, q.v, 0.02);
    T.near('mg sin37°', 30, q.mgSin, 1e-9);
    T.near('mg cos37°', 40, q.mgCos, 1e-9);
    T.near('בסוף המסלול, התאוצה של הרגע האחרון נשארת', 4, q.a, 1e-9);
    var f = T.make(S.incline, { angle: 30, mu: 0.75, m: 5 });
    f.advance(0.5);
    T.same('30° עם μ = 0.75: נשאר במקום', 'rest', f.getState().phase);
    f.setParam('angle', 37);
    f.advance(0.5);
    T.same('37° עם μ = 0.75: בגבול, עוד במקום', 'rest', f.getState().phase);
    f.setParam('angle', 38);
    f.advance(0.1);
    T.same('38° עם μ = 0.75: מחליק', 'slide', f.getState().phase);
    var h = T.make(S.incline, { angle: 37, mu: 0.75, m: 20 });
    h.advance(0.5);
    T.same('זווית ההחלקה לא תלויה במסה', 'rest', h.getState().phase);
    h.setParam('angle', 38);
    h.advance(0.1);
    T.same('20 ק"ג מחליק באותה זווית', 'slide', h.getState().phase);
    /* tan 14° = 0.249 and tan 15° = 0.268, so with μ = 0.25 the slip is at 15° on a slider in whole degrees. */
    var g = T.make(S.incline, { angle: 37, mu: 0.25, m: 5 });
    g.advance(0.1);
    T.same('37° עם μ = 0.25: מחליק מיד', 37, g.getState().slipAt);
    g.setParam('angle', 0);
    T.same('מתחת לזווית ההחלקה הקריאה מתאפסת', null, g.getState().slipAt);
    g.advance(3);
    T.same('ב-0° נעצר', 'rest', g.getState().phase);
    g.setParam('angle', 14);
    g.advance(0.2);
    T.same('14°: עוד במקום', 'rest', g.getState().phase);
    g.setParam('angle', 15);
    g.advance(0.1);
    T.same('15°: מחליק', 'slide', g.getState().phase);
    T.same('הזווית שנרשמה', 15, g.getState().slipAt);
  });

  await T.test('פרק 4: גלגלות', async function () {
    var a = T.make(S.pulley, { mode: 'atwood', m1: 3, m2: 1 });
    await T.run(a.play());
    var s = a.getState();
    T.near('3 ק"ג ו-1 ק"ג, תאוצה', 5, s.a, 1e-9);
    T.near('3 ק"ג ו-1 ק"ג, מתיחות', 15, s.T, 1e-9);
    T.near('שקול על הכבד = m a', 3 * s.a, 30 - s.T, 1e-9);
    T.near('שקול על הקל = m a', 1 * s.a, s.T - 10, 1e-9);
    T.near('זמן ל-3.6 מ\'', Math.sqrt(7.2 / 5), s.tEnd, 0.01);
    T.near('מהירות בסוף 3.6 מ\'', 6, s.vEnd, 0.02);
    var b = T.make(S.pulley, { mode: 'table', M: 4, m: 1 });
    await T.run(b.play());
    var q = b.getState();
    T.near('שולחן 4 ק"ג ו-1 ק"ג, תאוצה', 2, q.a, 1e-9);
    T.near('שולחן 4 ק"ג ו-1 ק"ג, מתיחות', 8, q.T, 1e-9);
    T.near('שולחן, מהירות נמדדת', Math.sqrt(2 * 2 * 2.7), q.vEnd, 0.02);
    b.setParam('locked', false);
    b.setParam('mu', 0.2);
    var r = b.getState();
    T.near('μ = 0.2, תאוצה', 0.4, r.a, 1e-9);
    T.near('μ = 0.2, מתיחות', 9.6, r.T, 1e-9);
    b.setParam('mu', 0.3);
    var z = b.getState();
    T.same('μ = 0.3, לא זז', true, z.stuck);
    T.near('μ = 0.3, מתיחות שווה למשקל התלוי', 10, z.T, 1e-9);
  });

  await T.test('פרק 4: מעלית', async function () {
    var sim = T.make(S.elevator, {});
    await T.run(sim.play());
    var st = sim.getState(), log = st.log;
    function find(l) { return log.filter(function (x) { return x.label === l; })[0]; }
    T.near('במנוחה', 50, find('במנוחה').reading, 1e-9);
    T.near('מאיצה למעלה ב-2 מ/ש²', 60, find('מאיצה למעלה').reading, 1e-9);
    T.near('מהירות קבועה', 50, find('עולה במהירות קבועה').reading, 1e-9);
    T.near('מאטה ב-2 מ/ש²', 40, find('מאטה בדרך למעלה').reading, 1e-9);
    T.near('הכבל נקרע', 0, find('הכבל נקרע!').reading, 1e-9);
    T.near('בלם חירום', 100, find('בלם החירום').reading, 1e-9);
    T.near('זמן בלימה = מהירות חלקי תאוצה', 1.4, find('בלם החירום').T, 0.02);
    T.near('בסוף עצרה', 0, st.v, 1e-9);
    sim.setParam('locked', false);
    sim.setParam('a', 3);
    T.near('a = 3 מ/ש²', 65, sim.getState().reading, 1e-9);
    var v0 = sim.getState().v;
    sim.advance(1);
    T.near('a = 3 מ/ש², מהירות נמדדת', v0 + 3, sim.getState().v, 0.02);
    sim.setParam('a', -10);
    T.near('a = g כלפי מטה', 0, sim.getState().reading, 1e-9);
    sim.setParam('a', 0);
    sim.halt();
    sim.advance(10);
    T.near('עצירה בכפתור', 0, sim.getState().v, 1e-9);
    sim.cut();
    sim.advance(1);
    T.near('ניתוק בכפתור, קריאה', 0, sim.getState().reading, 1e-9);
    sim.advance(5);
    T.near('ניתוק בכפתור, עצר בסוף', 0, sim.getState().v, 1e-9);
  });

  /* Free fall: the cat and the scale share a velocity and an acceleration, so no gap can open. Height is measured
     where the cat is really drawn. The cabin stays still on the screen, so it should not change at all. */
  await T.test('פרק 4: בנפילה חופשית החתול לא מתרומם', async function () {
    var sim = T.make(S.elevator, {});
    var canvas = lastCanvas(), draw = PHY.mascot.draw, rest = [], fall = [];
    PHY.mascot.draw = function (view, x, y) {
      if (view.ctx.canvas === canvas) (sim.getState().reading < 0.01 ? fall : rest).push(y);
      return draw.apply(this, arguments);
    };
    try { await T.run(sim.play()); } finally { PHY.mascot.draw = draw; }
    T.same('צוירו פריימים של נפילה', true, fall.length > 5);
    T.near('בנפילה, הרמה מעל המאזניים, לכל היותר', 0, Math.max.apply(null, fall) - rest[0], 1e-9);
    T.near('בנפילה, הרמה מעל המאזניים, לכל הפחות', 0, Math.min.apply(null, fall) - rest[0], 1e-9);
  });

  await T.test('פרק 4: במשחק, ב-a = -g החתול לא מתרומם', async function () {
    var sim = T.make(S.elevatorGame, { random: lcg(77) });
    var canvas = lastCanvas();
    for (var r = 0; r < 2; r++) { var a = sim.getState(); sim.setNeedle(a.m * (10 + a.shownA)); sim.confirm(); sim.next(); }
    sim.setAccel(-10);
    var draw = PHY.mascot.draw, aim = [], run = [];
    PHY.mascot.draw = function (view, x, y) {
      if (view.ctx.canvas === canvas) (sim.getState().phase === 'run' ? run : aim).push(y);
      return draw.apply(this, arguments);
    };
    try { await T.settle(); await T.run(sim.fire()); await T.settle(); } finally { PHY.mascot.draw = draw; }
    T.near('a = -g, קריאה', 0, sim.getState().reading, 1e-9);
    T.same('צוירו פריימים של נפילה', true, run.length > 5);
    T.near('הרמה מעל המאזניים', 0, Math.max.apply(null, run) - aim[0], 1e-9);
  });

  /* A card's sim, locked and not yet run, must not show what the card asks about. Free play must still work after. */
  await T.test('פרק 4: הכרטיס לא מגלה את התשובה לפני הריצה', async function () {
    var a = T.make(S.pulley, { mode: 'atwood', m1: 3, m2: 1, M: 4, m: 1, locked: true });
    var ac = lastControls(), canvas = lastCanvas(), meter = PHY.ch04.springScale, seen = [];
    PHY.ch04.springScale = function (view, px, py, text) {
      if (view.ctx.canvas === canvas) seen.push(text);
      return meter.apply(this, arguments);
    };
    try {
      await T.settle();
      T.same('גלגלת לפני הריצה: מד הכוח', '?', seen[seen.length - 1]);
      T.same('גלגלת לפני הריצה: תאוצה', '?', values(ac)[0]);
      T.same('גלגלת לפני הריצה: מתיחות', '?', values(ac)[1]);
      await T.run(a.play());
      await T.settle();
      T.same('גלגלת אחרי הריצה: מד הכוח', F.unit(15, 'N', 0), seen[seen.length - 1]);
      T.same('גלגלת אחרי הריצה: תאוצה', F.unit(5, 'ms2', 2), values(ac)[0]);
      T.same('גלגלת אחרי הריצה: מתיחות', F.unit(15, 'N', 1), values(ac)[1]);
      a.setParam('locked', false);
      a.setParam('m2', 2);
      await T.settle();
      T.same('גלגלת, משחק חופשי לפני שחרור: מד הכוח', '?', seen[seen.length - 1]);
      await T.run(a.play());
      await T.settle();
      /* 3 kg and 2 kg: a = 10 / 5 = 2 m/s², T = 2 · 12 = 24 N. */
      T.same('גלגלת, משחק חופשי: תאוצה', F.unit(2, 'ms2', 2), values(ac)[0]);
      T.same('גלגלת, משחק חופשי: מד הכוח', F.unit(24, 'N', 0), seen[seen.length - 1]);
    } finally { PHY.ch04.springScale = meter; }

    var l = T.make(S.crateLanes, { mode: 'push', F: 10, m: 2, locked: true });
    var lc = lastControls();
    await T.settle();
    T.same('החוק השני לפני הריצה: תאוצת הקל', '?', values(lc)[0]);
    T.same('החוק השני לפני הריצה: תאוצת הכבד', '?', values(lc)[1]);
    await T.run(l.play());
    await T.settle();
    T.same('החוק השני אחרי הריצה: תאוצת הקל', F.unit(5, 'ms2', 1), values(lc)[0]);
    T.same('החוק השני אחרי הריצה: תאוצת הכבד', F.unit(2.5, 'ms2', 1), values(lc)[1]);
    l.setParam('locked', false);
    l.setParam('F', 20);
    await T.settle();
    T.same('החוק השני, משחק חופשי: 20 ניוטון על 2 ק"ג', F.unit(10, 'ms2', 1), values(lc)[0]);

    var f = T.make(S.crateLanes, { mode: 'fall', m2: 3, locked: true });
    var fc = lastControls();
    await T.settle();
    T.same('נפילה לפני הריצה: הכוח שהשאלה נותנת נשאר', F.unit(30, 'N', 0), values(fc)[0]);
    T.same('נפילה לפני הריצה: תאוצה', '?', values(fc)[1]);
    await T.run(f.play());
    await T.settle();
    T.same('נפילה אחרי הריצה: תאוצה', F.unit(10, 'ms2', 0), values(fc)[1]);

    var i = T.make(S.incline, { two: true, angle: 37, mu: 0.25, locked: true });
    var ic = lastControls();
    await T.settle();
    T.same('מדרון לפני הריצה: תאוצה, 10 ק"ג', '?', values(ic)[10]);
    T.same('מדרון לפני הריצה: תאוצה, 2 ק"ג', '?', values(ic)[11]);
    await T.run(i.play({ two: true }));
    await T.settle();
    T.same('מדרון אחרי הריצה: תאוצה, 10 ק"ג', F.unit(4, 'ms2', 1), values(ic)[10]);
    T.same('מדרון אחרי הריצה: תאוצה, 2 ק"ג', F.unit(4, 'ms2', 1), values(ic)[11]);
    /* Free play starts from the real slider, which leaves the race. tan 20° = 0.36 is above μ = 0.25. */
    i.setParam('locked', false);
    var slider = ic.querySelector('input[type=range]');
    slider.value = 20;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    i.advance(0.1);
    T.same('מדרון, משחק חופשי: יצאנו מהמרוץ', null, i.getState().race);
    T.same('מדרון, משחק חופשי: מחליק', 'slide', i.getState().phase);
    T.same('מדרון, משחק חופשי: הזווית שנרשמה', 20, i.getState().slipAt);

    var d = T.make(S.pairs, { mode: 'sled' });
    var dctl = lastControls(), dc = dctl.querySelector('.readouts');
    await T.settle();
    T.same('מזחלת לפני הריצה: השקולים מוסתרים', true, dc.hidden);
    await T.run(d.play());
    await T.settle();
    T.same('מזחלת אחרי הריצה: השקולים גלויים', false, dc.hidden);
    T.same('מזחלת אחרי הריצה: שקול על ניוטון', F.unit(5, 'N', 0), values(dctl)[1]);
  });

  /* Every arrow and label of the force diagrams stays on the canvas, at every slider value, at desktop and phone width. */
  await T.test('פרק 4: החצים נכנסים לציור', async function () {
    var widths = [650, 313];
    for (var w = 0; w < widths.length; w++) {
      var pull = measured(S.fbd, { mode: 'pull', locked: false }, widths[w]);
      var worst = { px: 0, what: '' };
      for (var r = 0; r <= 60; r += 5) {
        pull.sim.setParam('rope', r);
        await T.settle();
        var o = overflow(pull);
        if (o.px > worst.px) worst = o;
      }
      T.near('חבל, רוחב ' + widths[w] + ', חריגה מהציור ' + worst.what, 0, worst.px, 0);
      pull.sim.setParam('rope', 60);
      await T.settle();
      var mgLabel = pull.marks.filter(function (k) { return k.str === 'mg'; })[0];
      T.same('חבל, רוחב ' + widths[w] + ': התווית mg מצוירת בתוך הציור', true, !!mgLabel && mgLabel.y1 <= pull.view.h);

      var press = measured(S.fbd, { mode: 'press', locked: false }, widths[w]);
      worst = { px: 0, what: '' };
      for (var h = -40; h <= 40; h += 5) {
        press.sim.setParam('hand', h);
        await T.settle();
        o = overflow(press);
        if (o.px > worst.px) worst = o;
      }
      T.near('כף, רוחב ' + widths[w] + ', חריגה מהציור ' + worst.what, 0, worst.px, 0);
      press.sim.stop(); pull.sim.stop();

      var build = measured(S.fbd, { mode: 'builder' }, widths[w]);
      worst = { px: 0, what: '' };
      var scenes = { table: ['gravity', 'normal'], press: ['gravity', 'normal', 'hand'], hang: ['gravity', 'tension'], slope: ['gravity', 'normal', 'friction'] };
      Object.keys(scenes).forEach(function (k) { build.sim.setScene(k); scenes[k].forEach(function (c) { build.sim.choose(c); }); });
      for (var q = 0; q < 4; q++) {
        build.sim.setScene(Object.keys(scenes)[q]);
        await T.settle();
        o = overflow(build);
        if (o.px > worst.px) worst = o;
      }
      T.near('דיאגרמות, רוחב ' + widths[w] + ', חריגה מהציור ' + worst.what, 0, worst.px, 0);
      build.sim.stop();
    }
  });

  /* The mg arrow is longest for a crate low on the slope. Checks the start and the end of the track, at both widths. */
  await T.test('פרק 4: במדרון כל החצים בתוך הציור', async function () {
    var widths = [650, 313], angles = [0, 15, 37, 60], masses = [5, 20];
    for (var w = 0; w < widths.length; w++) {
      var m = measured(S.incline, { angle: 0, mu: 0, m: 5 }, widths[w]);
      var worst = { px: 0, what: '' };
      for (var a = 0; a < angles.length; a++) {
        for (var b = 0; b < masses.length; b++) {
          m.sim.setParam('m', masses[b]);
          m.sim.setParam('angle', angles[a]);
          m.sim.reset();
          await T.settle();
          var o = overflow(m);
          if (o.px > worst.px) worst = o;
          if (angles[a] > 0) {
            await T.run(m.sim.play({ two: false }));
            await T.settle();
            o = overflow(m);
            if (o.px > worst.px) worst = o;
          }
        }
      }
      T.near('מדרון, רוחב ' + widths[w] + ', חריגה מהציור ' + worst.what, 0, worst.px, 0);
      m.sim.stop();
    }
  });

  /* tan 37° = 0.75 and μ = 0.25: the crate slides to the end at 8 m/s, so the velocity arrow is as long as it gets. */
  await T.test('פרק 4: חץ המהירות לא מכסה את התווית של mg sinθ', async function () {
    var widths = [650, 313];
    for (var w = 0; w < widths.length; w++) {
      var m = measured(S.incline, { angle: 37, mu: 0.25, m: 5 }, widths[w]);
      await T.run(m.sim.play({ two: false }));
      await T.settle();
      var label = m.marks.filter(function (k) { return k.str === 'mg sinθ'; })[0];
      var vel = m.marks.filter(function (k) { return k.arrow && k.color === PHY.colors.velocity; })[0];
      T.near('רוחב ' + widths[w] + ': מהירות בסוף', 8, m.sim.getState().v, 0.02);
      T.same('רוחב ' + widths[w] + ': מרווח בין החץ לתווית', true, gap(vel, label) > 0);
      T.same('רוחב ' + widths[w] + ': התוויות מצוירות אחרי החצים', true, m.marks.indexOf(label) > m.marks.indexOf(vel));
      var o = overflow(m);
      T.near('רוחב ' + widths[w] + ', חריגה מהציור ' + o.what, 0, o.px, 0);
    }
  });

  /* A small repeatable random source, so a failing seed can be replayed. */
  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  /* Where we would stop if we started braking now: a small forward run of the same limits the sim has. */
  function stopDistance(v0, a0, bandA) {
    var v = v0, a = a0, x = 0, dt = 1 / 120, cap = bandA - 0.6;
    for (var i = 0; i < 1200 && v > 0; i++) {
      if (a < 0 && v <= (a * a) / 20) a = Math.min(0, a + 10 * dt);
      else a = Math.max(a - 3 * dt, -cap);
      v += a * dt;
      x += v * dt;
    }
    return x;
  }
  /* Drives level 3 through the sim's own thrust API. Speeds up to a cruise, coasts, brakes in time,
     and lets go before the needle leaves the band, the way a person watches the gauge. */
  function drive(sim) {
    var dt = 1 / 30;
    for (var i = 0; i < 40 / dt; i++) {
      var s = sim.getState();
      if (s.level !== 2 || s.phase !== 'drive') break;
      var e = s.floorY - s.y;
      var dir = Math.sign(e) || 1;
      var v = s.v * dir, a = s.a * dir, cap = s.bandA - 0.6;   /* in the direction of the target */
      var thrust = 0;
      if (v > 0.03 && e * dir <= stopDistance(v, a, s.bandA) + 0.12) {
        thrust = -1;
        if (a < 0 && v <= (a * a) / 20) thrust = 0;
      } else if (Math.abs(e) > 0.35 && v < 1.4) {
        thrust = 1;
      }
      if (thrust * a >= cap) thrust = 0;
      sim.thrust(thrust * dir);
      sim.advance(dt);
    }
    sim.thrust(0);
    /* coast out the last moments of the win timer */
    if (sim.getState().phase === 'drive') sim.advance(1);
    return sim.getState();
  }
  async function solveLevels(sim, T) {
    for (var r = 0; r < 2; r++) {
      var s = sim.getState();
      sim.setNeedle(s.m * (10 + s.shownA));
      T.same('שלב 1: הקריאה הנכונה מתקבלת', true, sim.confirm());
      sim.next();
    }
    for (var q = 0; q < 2; q++) {
      var s2 = sim.getState();
      sim.setAccel(s2.target / s2.m - 10);
      await T.run(sim.fire());
      T.same('שלב 2: התאוצה הנכונה מתקבלת', 'solved', sim.getState().phase);
      T.near('שלב 2: הקריאה שווה ליעד', s2.target, sim.getState().reading, 1e-9);
      sim.next();
    }
    var s3 = drive(sim);
    T.same('שלב 3: הגיע ועצר', 'solved', s3.phase);
    T.near('שלב 3: בקומת היעד', s3.floorY, s3.y, 0.6);
    sim.next();
  }

  await T.test('פרק 4: המשחק נפתר, לפי זרעים', async function () {
    for (var seed = 1; seed <= 8; seed++) {
      var done = null;
      var sim = T.make(S.elevatorGame, { random: lcg(seed * 7919), onDone: function (st, tot) { done = { st: st, tot: tot }; } });
      await solveLevels(sim, T);
      T.same('זרע ' + seed + ': שלושה כוכבים', 3, done && done.st);
      T.same('זרע ' + seed + ': תשע נקודות', 9, done && done.tot);
    }
  });

  await T.test('פרק 4: שלב 3 ביד של אדם', async function () {
    /* A plan a person can follow: hold 1 s, let go, coast, hold 1 s the other way when 1.5 m remain. */
    for (var seed = 1; seed <= 6; seed++) {
      var sim = T.make(S.elevatorGame, { random: lcg(seed * 131) });
      for (var r = 0; r < 2; r++) { var a = sim.getState(); sim.setNeedle(a.m * (10 + a.shownA)); sim.confirm(); sim.next(); }
      for (var q = 0; q < 2; q++) { var b = sim.getState(); sim.setAccel(b.target / b.m - 10); await T.run(sim.fire()); sim.next(); }
      var f = sim.getState();
      var dir = Math.sign(f.floorY);
      sim.thrust(dir); sim.advance(1); sim.thrust(0);
      var guard = 0;
      while (Math.abs(f.floorY - sim.getState().y) > 1.5 && guard++ < 3000) sim.advance(1 / 60);
      sim.thrust(-dir); sim.advance(1); sim.thrust(0);
      sim.advance(1.5);
      var end = sim.getState();
      T.same('זרע ' + seed + ': תוכנית פשוטה מנצחת בניסיון הראשון', 'solved', end.phase);
      T.same('זרע ' + seed + ': ניסיון אחד', 1, end.tries);
    }
  });

  await T.test('פרק 4: המשחק מעניש קלט גרוע', async function () {
    var sim = T.make(S.elevatorGame, { random: lcg(4242) });
    var s = sim.getState();
    sim.setNeedle(s.m * (10 + s.shownA) + 20);
    T.same('שלב 1: מחוג גבוה מדי נדחה', false, sim.confirm());
    sim.setNeedle(s.m * (10 + s.shownA) - 20);
    T.same('שלב 1: מחוג נמוך מדי נדחה', false, sim.confirm());
    T.same('שלב 1: עדיין באותו סיבוב', 0, sim.getState().round);
    T.same('שלב 1: שתי טעויות נספרו', 2, sim.getState().wrong);
    sim.setNeedle(s.m * (10 + s.shownA));
    sim.confirm(); sim.next();
    var s1 = sim.getState();
    sim.setNeedle(s1.m * (10 + s1.shownA));
    sim.confirm(); sim.next();
    T.same('שלב 1: 2 נקודות אחרי שתי טעויות', 2, sim.getState().points[0]);
    var t = sim.getState();
    sim.setAccel(t.target / t.m - 10 + 1);
    await T.run(sim.fire());
    T.same('שלב 2: תאוצה לא נכונה נדחית', 'aim', sim.getState().phase);
    T.same('שלב 2: טעות נספרה', 1, sim.getState().wrong);
    sim.setAccel(t.target / t.m - 10);
    await T.run(sim.fire());
    sim.next();
    var u = sim.getState();
    sim.setAccel(u.target / u.m - 10);
    await T.run(sim.fire());
    sim.next();
    T.same('שלב 2: 2 נקודות אחרי טעות', 2, sim.getState().points[1]);
    /* level 3: holding the button too long leaves the band, and the try ends */
    sim.thrust(1);
    sim.advance(4);
    T.same('שלב 3: החזקה ארוכה מפילה', 'crashed', sim.getState().phase);
    sim.next();
    T.same('שלב 3: ניסיון שני', 2, sim.getState().tries);
    /* doing nothing never wins, it runs out of time */
    sim.advance(50);
    T.same('שלב 3: בלי נהיגה נגמר הזמן', 'crashed', sim.getState().phase);
    sim.next();
    /* fly past the floor without stopping: not a win */
    var f = sim.getState();
    var dir = Math.sign(f.floorY);
    sim.thrust(dir);
    sim.advance(1);
    sim.thrust(0);
    var guard = 0;
    while (Math.abs(sim.getState().y) < Math.abs(f.floorY) + 1 && guard++ < 2000) sim.advance(1 / 30);
    T.same('שלב 3: חולפים על פני הקומה בלי לעצור', 'drive', sim.getState().phase);
    var end = drive(sim);
    T.same('שלב 3: אפשר לתקן ולהגיע', 'solved', end.phase);
    T.same('שלב 3: נקודה אחת אחרי שלושה ניסיונות', 1, sim.getState().points[2]);
    sim.next();
    T.same('סך הכל 5 נקודות: 2 כוכבים', 2, sim.getState().stars);
  });

  await T.test('פרק 4: המשחק מתחיל מחדש נקי', async function () {
    var sim = T.make(S.elevatorGame, { random: lcg(99) });
    await solveLevels(sim, T);
    sim.restart();
    var s = sim.getState();
    T.same('חזרה לשלב הראשון', 0, s.level);
    T.same('הנקודות אופסו', 0, s.points.length);
    T.same('הטעויות אופסו', 0, s.wrong);
    /* every serviced target fits on its dial and on the slider's grid */
    var bad = 0;
    for (var seed = 1; seed <= 40; seed++) {
      var g = T.make(S.elevatorGame, { random: lcg(seed * 31) });
      await solveLevels({ setNeedle: g.setNeedle, confirm: function () { var q = g.getState(); if (q.m * (10 + q.shownA) > q.m * 20) bad++; return g.confirm(); }, next: g.next, getState: g.getState, setAccel: g.setAccel, fire: g.fire, thrust: g.thrust, advance: g.advance }, { same: function (n, e, got) { if (e !== got) bad++; }, near: function (n, e, got, tol) { if (Math.abs(e - got) > tol) bad++; }, run: T.run });
    }
    T.same('40 זרעים נוספים, בלי כשלים', 0, bad);
  });
});

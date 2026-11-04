/* PHY.sims.graduation: the end of the course. A DOM-only sim: the first argument is a host div.
   One row per chapter from PHY.course, with quiz and game stars from PHY.progress, and the total.
   The first time it scrolls into view, apples rain. getState() reports the totals. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const U = PHY.ui, h = U.h;

  PHY.sims.graduation = function (host, _controls, opts) {
    opts = opts || {};
    const box = h('div', { class: 'grad-card' });
    host.appendChild(box);
    const title = h('h3', { class: 'grad-title', text: 'תעודת סיום' });
    const line = h('p', { class: 'grad-line' });
    const totalBox = h('div', { class: 'grad-total' });
    const list = h('ol', { class: 'grad-list' });
    const row = h('div', { class: 'btn-row grad-actions' });
    [title, line, totalBox, list, row].forEach(function (n) { box.appendChild(n); });
    U.Button(row, 'עוד גשם תפוחים', function () { celebrate(true); }, { primary: true });

    let state = { rows: [], total: 0, max: 0, doneChapters: 0 };
    function compute() {
      const P = PHY.progress;
      const rows = PHY.course.map(function (c) {
        const pc = P.chapter(c.id);
        const quiz = P.quizStars(pc.quiz || 0);
        const game = Math.max(0, Math.min(3, pc.game || 0));
        return { id: c.id, title: c.title, file: c.file, quiz: quiz, game: game, frac: P.fraction(c.id) };
      });
      const total = rows.reduce(function (a, r) { return a + r.quiz + r.game; }, 0);
      return { rows: rows, total: total, max: rows.length * 6, doneChapters: rows.filter(function (r) { return r.quiz + r.game > 0; }).length };
    }
    function message(s) {
      if (s.total >= s.max) return 'כל הכוכבים. כולם. ניוטון מבקש חתימה, ומיד אחר כך תפוח.';
      if (s.total >= s.max * 0.75) return 'כמעט כל השמיים מלאים. עוד סיבוב קטן, ואין לנו מה ללמד יותר.';
      if (s.total >= s.max * 0.4) return 'יופי של דרך. כל פרק פתוח תמיד לעוד ניסיון, והכוכבים מחכים.';
      return 'הקו האחרון כבר כאן, והכוכבים לא בורחים. אפשר לחזור לכל פרק, מתי שרוצים.';
    }
    function paint() {
      const s = compute();
      state = s;
      line.textContent = message(s);
      totalBox.innerHTML = '';
      totalBox.appendChild(h('span', { class: 'grad-num', text: s.total + ' מתוך ' + s.max }));
      totalBox.appendChild(h('span', { class: 'muted small', text: 'כוכבים בכל הקורס, מהבחנים ומהמשחקונים' }));
      list.innerHTML = '';
      s.rows.forEach(function (r) {
        const a = h('a', { href: r.file, class: 'grad-name', text: +r.id + '. ' + r.title });
        const quiz = h('span', { class: 'grad-stars' }, [h('span', { class: 'muted small', text: 'בוחן' })]);
        U.StarScore(quiz, { value: r.quiz, size: 18 });
        const game = h('span', { class: 'grad-stars' }, [h('span', { class: 'muted small', text: 'משחקון' })]);
        U.StarScore(game, { value: r.game, size: 18 });
        list.appendChild(h('li', { class: 'grad-row' }, [a, quiz, game]));
      });
    }
    function celebrate(burst) {
      PHY.mascot.appleRain();
      if (burst) U.burst(totalBox, 30);
    }
    let rained = false;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        if (rained) return;
        if (entries[entries.length - 1].isIntersecting) {
          rained = true;
          celebrate(true);
          PHY.mascot.say(opts.say || 'סיימנו. נפלתי, עפתי, נורתי והסתובבתי. ועל הרגליים, כל פעם. תודה על הדרך.', 'happy');
          io.disconnect();
        }
      }, { threshold: 0.35 });
      io.observe(box);
    }
    document.addEventListener('phy:progress', paint);
    paint();
    return {
      start() {},
      stop() {},
      reset: paint,
      setParam() {},
      getState() { paint(); return state; },
    };
  };
})();

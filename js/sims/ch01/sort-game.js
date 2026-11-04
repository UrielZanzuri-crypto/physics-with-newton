/* PHY.sims.sortGame: מיון קלפים. DOM-based, so the first argument is a host <div>, not a canvas.
   Drag a card to a bin, or tap a card and then a bin, or use the keyboard (both are real buttons).
   opts: {chapter, section, onDone(errors)}. Each card has {name, kind: 'scalar'|'vector', example, why}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const U = PHY.ui;

  const CARDS = [
    { name: 'טמפרטורה', kind: 'scalar', example: '30°', why: '30 מעלות לאן? לשום מקום. טמפרטורה היא רק מספר.' },
    { name: 'מסה', kind: 'scalar', example: '4 ק"ג', why: 'לתפוח יש מסה של 0.2 ק"ג, בלי קשר לכיוון שהוא פונה אליו.' },
    { name: 'זמן', kind: 'scalar', example: '5 ש\'', why: 'משך הזמן הוא מספר. אין "5 שניות צפונה".' },
    { name: 'מרחק', kind: 'scalar', example: "12 מ'", why: 'מרחק סופר כמה הלכת, בלי לשאול לאן. זה ההבדל בינו לבין העתק.' },
    { name: 'העתק', kind: 'vector', example: "5 מ' צפונה", why: 'העתק הוא החץ מההתחלה עד הסוף. בלי כיוון הוא לא יודע לאן הגעת.' },
    { name: 'מהירות', kind: 'vector', example: '60 קמ"ש מזרחה', why: 'מהירות אומרת כמה מהר וגם לאן. בכיוון הלא נכון, 60 קמ"ש הם בעיה.' },
    { name: 'כוח', kind: 'vector', example: '30 ניוטון למעלה', why: 'זוכר את הארגז? אותו כוח בכיוון אחר, תוצאה אחרת לגמרי.' },
    { name: 'תאוצה', kind: 'vector', example: '10 מ/ש² למטה', why: 'תאוצה תגיע בפרק 2. בינתיים תדע: יש לה כיוון, והיא תמיד אדומה.' },
  ];

  PHY.sims.sortGame = function (host, controlsEl, opts) {
    opts = opts || {};
    const pile = U.h('div', { class: 'sort-pile' });
    const makeBin = function (kind, title, sub) {
      const list = U.h('div', { class: 'sort-bin-list' });
      const bin = U.h('button', { type: 'button', class: 'sort-bin', 'data-kind': kind, 'aria-label': 'סל ' + title }, [
        U.h('span', { class: 'sort-bin-title', text: title }),
        U.h('span', { class: 'sort-bin-sub', text: sub }),
        list,
      ]);
      bin.addEventListener('click', function () {
        if (selected) place(selected, bin);
      });
      bin._list = list;
      return bin;
    };
    const bins = [makeBin('scalar', 'סקלר', 'מספיק מספר ויחידה'), makeBin('vector', 'וקטור', 'מספר, יחידה וגם כיוון')];
    const status = U.h('div', { class: 'sort-status', role: 'status', text: 'גרור כל קלף לסל שלו, או הקש על קלף ואז על סל.' });
    host.appendChild(pile);
    host.appendChild(U.h('div', { class: 'sort-bins' }, bins));
    host.appendChild(status);

    let selected = null;
    let errors = 0;
    let placed = 0;
    let cards = [];

    function select(c) {
      if (selected) selected.el.classList.remove('is-selected');
      selected = c;
      if (c) c.el.classList.add('is-selected');
    }

    function place(c, bin) {
      if (c.done) return;
      if (bin.dataset.kind === c.data.kind) {
        c.done = true;
        select(null);
        c.el.style.transform = '';
        c.el.textContent = c.data.name + ': ' + c.data.example;
        c.el.classList.add('is-placed');
        c.el.setAttribute('tabindex', '-1');
        bin._list.appendChild(c.el);
        placed++;
        status.textContent = c.data.why;
        if (placed === CARDS.length) done();
      } else {
        errors++;
        c.el.style.transform = '';
        c.el.classList.remove('is-shake');
        void c.el.offsetWidth;
        c.el.classList.add('is-shake');
        select(null);
        status.textContent = c.data.why;
        PHY.mascot.say('כמעט. ' + c.data.why, 'thinking');
      }
    }

    function done() {
      status.textContent = errors === 0 ? 'מיון מושלם, בלי טעות אחת!' : 'הכול במקום. טעית ' + (errors === 1 ? 'פעם אחת' : errors + ' פעמים') + ' בדרך, וזה בדיוק איך שלומדים.';
      U.burst(status, 26);
      PHY.mascot.say(errors === 0 ? 'אפילו אני טעיתי במסה בפעם הראשונה.' : 'מיון גמור. תפוח הוא עדיין סקלר טעים.', 'happy');
      if (opts.chapter && opts.section) PHY.progress.markSection(opts.chapter, opts.section);
      if (opts.onDone) opts.onDone(errors);
    }

    function binAt(x, y) {
      const under = document.elementsFromPoint(x, y);
      for (let i = 0; i < under.length; i++) {
        if (under[i].classList && under[i].classList.contains('sort-bin')) return under[i];
      }
      return null;
    }

    function attachDrag(c) {
      const el = c.el;
      let start = null, moved = false, hot = null;
      el.addEventListener('pointerdown', function (e) {
        if (c.done) return;
        start = { x: e.clientX, y: e.clientY };
        moved = false;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      });
      el.addEventListener('pointermove', function (e) {
        if (!start || c.done) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = true;
        el.classList.add('is-dragging');
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.06) rotate(-2deg)';
        el.style.pointerEvents = 'none';
        const b = binAt(e.clientX, e.clientY);
        el.style.pointerEvents = '';
        if (b !== hot) {
          if (hot) hot.classList.remove('is-hot');
          if (b) b.classList.add('is-hot');
          hot = b;
        }
      });
      const finish = function (e) {
        if (!start) return;
        start = null;
        el.classList.remove('is-dragging');
        if (hot) hot.classList.remove('is-hot');
        if (moved) {
          e.preventDefault();
          const b = hot;
          hot = null;
          if (b) place(c, b);
          else el.style.transform = '';
        }
      };
      el.addEventListener('pointerup', finish);
      el.addEventListener('pointercancel', function () {
        start = null;
        el.classList.remove('is-dragging');
        el.style.transform = '';
        if (hot) hot.classList.remove('is-hot');
        hot = null;
      });
      el.addEventListener('click', function () {
        if (c.done) return;
        if (moved) { moved = false; return; }
        select(selected === c ? null : c);
      });
    }

    function deal() {
      pile.innerHTML = '';
      bins.forEach(function (b) { b._list.innerHTML = ''; });
      errors = 0;
      placed = 0;
      selected = null;
      const order = CARDS.slice().sort(function () { return Math.random() - 0.5; });
      cards = order.map(function (data) {
        const el = U.h('button', { type: 'button', class: 'sort-card', text: data.name });
        pile.appendChild(el);
        const c = { el, data, done: false };
        attachDrag(c);
        return c;
      });
    }

    deal();
    return {
      start() {},
      stop() {},
      reset() {
        deal();
        status.textContent = 'גרור כל קלף לסל שלו, או הקש על קלף ואז על סל.';
      },
      setParam() {},
      getState() { return { placed, errors, total: CARDS.length }; },
    };
  };
})();

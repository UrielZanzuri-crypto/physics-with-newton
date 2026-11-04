/* PHY.progress: all persistence. localStorage key "phy-progress-v1".
   Shape: {chapters: {"01": {sections: [...], total: 12, quiz: 0.8, game: 3, predictions: {id: {choice, correct}}}}}
   Every storage access is wrapped: private windows and blocked storage must never break a page.
   PHY.course: the single source of truth for the chapter map (home page and chapter nav). */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});
  const KEY = 'phy-progress-v1';
  let memory = { chapters: {} };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.chapters) memory = parsed;
      }
    } catch (e) { /* keep the in-memory copy */ }
    return memory;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
    } catch (e) { /* in-memory only */ }
  }

  function chapter(id) {
    load();
    if (!memory.chapters[id]) memory.chapters[id] = { sections: [] };
    const c = memory.chapters[id];
    if (!Array.isArray(c.sections)) c.sections = [];
    return c;
  }

  function emit(id) {
    document.dispatchEvent(new CustomEvent('phy:progress', { detail: { chapter: id } }));
  }

  PHY.progress = {
    KEY,
    chapter,
    all() { load(); return memory; },
    markSection(id, name) {
      const c = chapter(id);
      if (c.sections.indexOf(name) < 0) {
        c.sections.push(name);
        save();
        emit(id);
      }
    },
    hasSection(id, name) { return chapter(id).sections.indexOf(name) >= 0; },
    setTotal(id, total) {
      const c = chapter(id);
      if (c.total !== total) { c.total = total; save(); }
    },
    /* Best score is kept. score is 0..1. */
    setQuiz(id, score) {
      const c = chapter(id);
      c.quiz = Math.max(c.quiz || 0, score);
      save();
      emit(id);
    },
    /* Best star count is kept. stars is 0..3. */
    setGame(id, stars) {
      const c = chapter(id);
      c.game = Math.max(c.game || 0, stars);
      save();
      emit(id);
    },
    recordPrediction(id, key, choice, correct) {
      const c = chapter(id);
      c.predictions = c.predictions || {};
      c.predictions[key] = { choice: choice, correct: !!correct };
      save();
    },
    fraction(id) {
      const c = chapter(id);
      return c.total ? Math.min(1, c.sections.length / c.total) : 0;
    },
    /* Quiz score to stars: used by the quiz and the home page, so the two always agree. */
    quizStars(score) {
      if (!score) return 0;
      if (score >= 0.9) return 3;
      if (score >= 0.6) return 2;
      return 1;
    },
    reset() {
      memory = { chapters: {} };
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
      emit(null);
    },
  };

  /* status: "active" = linked from the map; "soon" = shown as coming soon. Flip one line per new chapter. */
  PHY.course = [
    { id: '01', title: 'וקטורים וסקלרים', file: '01-vectors.html', status: 'active',
      desc: 'ניוטון הלך 3 מ\' ועוד 4 מ\'. כמה הוא רחוק מהבית? תלוי לאן.' },
    { id: '02', title: 'קינמטיקה ותנועה יחסית', file: '02-kinematics.html', status: 'active',
      desc: 'מכוניות שמציירות גרפים, תפוחים נופלים, וסירה שנסחפת בנהר.' },
    { id: '03', title: 'קליעים', file: '03-projectiles.html', status: 'active',
      desc: 'משגרים את ניוטון מתותח. הוא הסכים. בערך.' },
    { id: '04', title: 'חוקי ניוטון', file: '04-newton.html', status: 'active',
      desc: 'כוחות, מישור משופע, ומה קורה למשקל במעלית כשהכבל נקרע.' },
    { id: '05', title: 'עבודה ואנרגיה', file: '05-energy.html', status: 'active',
      desc: 'בונים רכבת הרים ובודקים אם ניוטון יעבור את הלולאה.' },
    { id: '06', title: 'תנועה מעגלית', file: '06-circular.html', status: 'active',
      desc: 'החוט נקרע. לאן הכדור עף? כמעט כולם טועים.' },
    { id: '07', title: 'מתקף, תנע ומרכז מסה', file: '07-momentum.html', status: 'active',
      desc: 'מעבדת התנגשויות, עריסת ניוטון, ואסטרונאוט שזורק מפתח ברגים.' },
    { id: '08', title: 'תנועה הרמונית פשוטה', file: '08-shm.html', status: 'active',
      desc: 'קפיץ, מטוטלת, והצל של תנועה מעגלית.' },
    { id: '09', title: 'כבידה', file: '09-gravity.html', status: 'active',
      desc: 'התותח של ניוטון על ההר, וכמה שוקלים על מאדים.' },
    { id: '10', title: 'סטטיקה ומומנטים', file: '10-statics.html', status: 'active',
      desc: 'מאזנים נדנדה, סולם על קיר, ומובייל שלא רוצה להתאזן.' },
  ];

  load();
})();

/* PHY.ui: shared components. Everything takes a host element and appends to it.
   Slider, Toggle, Button, Readouts, StarScore, PredictCard, Quiz, StepSolution, Problem,
   renderMath, burst, chapterNav, themeButton, initChapter. */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});

  /* Tiny element builder. attrs: class, html, text, on<event>, or anything for setAttribute. */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  /* KaTeX: \( inline \) and \[ display \] in any element. Each result gets dir="ltr".
     If the CDN is unreachable the raw TeX is shown as code, so the page stays readable. */
  function renderMath(root) {
    root = root || document.body;
    if (window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
      root.querySelectorAll('.katex, .katex-display').forEach(function (k) { k.setAttribute('dir', 'ltr'); });
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (/\\[(\[]/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
      nodes.forEach(function (n) {
        const span = document.createElement('span');
        span.innerHTML = n.nodeValue
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/\\[(\[]([\s\S]*?)\\[)\]]/g, '<code class="tex-fallback" dir="ltr">$1</code>');
        n.parentNode.replaceChild(span, n);
      });
    }
  }

  function reduced() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Decorative confetti from an element's center. */
  function burst(el, n) {
    if (reduced() || !el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const colors = ['--gold', '--accent', '--c-velocity', '--c-force', '--c-displacement', '--apple'];
    for (let i = 0; i < (n || 22); i++) {
      const d = document.createElement('i');
      d.className = 'burst-dot';
      d.setAttribute('aria-hidden', 'true');
      const a = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 110;
      d.style.left = r.left + r.width / 2 + 'px';
      d.style.top = r.top + r.height / 2 + 'px';
      d.style.background = 'var(' + colors[i % colors.length] + ')';
      d.style.setProperty('--dx', Math.cos(a) * dist + 'px');
      d.style.setProperty('--dy', Math.sin(a) * dist + 'px');
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 850);
    }
  }

  /* ---------- Button / Toggle ---------- */
  function Button(host, text, onClick, o) {
    o = o || {};
    const b = h('button', { type: 'button', class: 'btn ' + (o.primary ? 'btn-primary ' : '') + (o.ghost ? 'btn-ghost ' : '') + (o.class || ''), text: text, onclick: onClick });
    if (o.disabled) b.disabled = true;
    if (host) host.appendChild(b);
    return b;
  }

  function Toggle(host, label, o) {
    o = o || {};
    const input = h('input', { type: 'checkbox' });
    input.checked = !!o.value;
    input.addEventListener('change', function () { if (o.onChange) o.onChange(input.checked); });
    const el = h('label', { class: 'toggle' }, [input, h('span', { text: label })]);
    if (host) host.appendChild(el);
    return { el, input, get value() { return input.checked; }, set(v) { input.checked = !!v; } };
  }

  /* ---------- Slider ---------- */
  let sliderId = 0;
  /* Native range input: keyboard and touch work out of the box.
     o: {label, min, max, step, value, unit, digits, format(v), color (CSS color), onInput(v), onCommit(v)}
     The track is LTR on purpose: more is always to the right, same as the x axis in the sims. */
  function Slider(host, o) {
    const id = 'phy-slider-' + ++sliderId;
    const input = h('input', { type: 'range', id: id, min: o.min, max: o.max, step: o.step || 1, dir: 'ltr' });
    const out = h('output', { for: id });
    const el = h('div', { class: 'slider' }, [h('label', { for: id, text: o.label }), out, input]);
    if (o.color) el.style.setProperty('--slider-color', o.color);
    const show = function () {
      const v = +input.value;
      out.textContent = o.format ? o.format(v) : PHY.fmt.unit(v, o.unit || '', o.digits === undefined ? 1 : o.digits);
      const f = ((v - +input.min) / (+input.max - +input.min)) * 100;
      input.style.setProperty('--fill', f + '%');
      input.setAttribute('aria-valuetext', out.textContent);
    };
    input.value = o.value;
    show();
    input.addEventListener('input', function () { show(); if (o.onInput) o.onInput(+input.value); });
    input.addEventListener('change', function () { if (o.onCommit) o.onCommit(+input.value); });
    if (host) host.appendChild(el);
    return {
      el, input,
      get value() { return +input.value; },
      /* Sets the value without firing onInput, so sims can sync sliders without feedback loops. */
      set(v) { input.value = v; show(); },
      setRange(min, max) { input.min = min; input.max = max; show(); },
      setEnabled(on) { input.disabled = !on; },
    };
  }

  /* ---------- Readouts ---------- */
  /* items: [{key, label, color}] where color is a CSS color such as var(--c-force). */
  function Readouts(host, items) {
    const el = h('div', { class: 'readouts' });
    const vals = {};
    items.forEach(function (it) {
      const v = h('span', { class: 'r-value', text: it.value || '—' });
      const box = h('div', { class: 'readout' }, [h('span', { class: 'r-label', text: it.label }), v]);
      if (it.color) box.style.setProperty('--r-color', it.color);
      vals[it.key] = v;
      el.appendChild(box);
    });
    if (host) host.appendChild(el);
    return { el, set(k, t) { if (vals[k] && vals[k].textContent !== t) vals[k].textContent = t; } };
  }

  /* ---------- StarScore ---------- */
  const STAR_PATH = 'M12 2.4l2.95 6.3 6.9.85-5.1 4.72 1.35 6.83L12 17.2l-6.1 3.9 1.35-6.83-5.1-4.72 6.9-.85z';
  function StarScore(host, o) {
    o = o || {};
    const max = o.max || 3;
    const el = h('span', { class: 'stars', role: 'img' });
    if (o.size) el.style.setProperty('--star-size', o.size + 'px');
    const stars = [];
    for (let i = 0; i < max; i++) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('class', 'star');
      s.innerHTML = '<path d="' + STAR_PATH + '"/>';
      el.appendChild(s);
      stars.push(s);
    }
    function set(n, animate) {
      el.setAttribute('aria-label', n + ' מתוך ' + max + ' כוכבים');
      stars.forEach(function (s, i) {
        s.classList.toggle('is-on', i < n);
        s.classList.remove('is-pop');
        if (animate && i < n) {
          s.style.animationDelay = i * 0.14 + 's';
          void s.getBoundingClientRect();
          s.classList.add('is-pop');
        }
      });
    }
    set(o.value || 0, !!o.animate);
    if (host) host.appendChild(el);
    return { el, set };
  }

  /* ---------- PredictCard ---------- */
  /* The host's existing children (normally a <figure class="sim">) become the stage between the
     options and the explanation, so the animation is always right under the "run" button.

     o: {
       chapter, id, section,        // progress bookkeeping
       question, options: [{text, correct, why}],   // text, why and question may hold HTML and \( TeX \)
       runLabel, againLabel,
       onRun(index, option) -> Promise or undefined  // plays the animation; the reveal waits for it
       explanation,                 // HTML, shown after the run
       sayRight, sayWrong,          // what the cat says
       onDone(correct, index)
     } */
  function PredictCard(host, o) {
    const stage = h('div', { class: 'predict-stage' });
    while (host.firstChild) stage.appendChild(host.firstChild);
    const tag = h('div', { class: 'predict-tag', text: o.tag || 'קודם ניחוש' });
    const q = h('div', { class: 'predict-q', html: o.question });
    const list = h('div', { class: 'predict-options', role: 'radiogroup', 'aria-label': 'אפשרויות' });
    const run = h('button', { type: 'button', class: 'btn btn-primary', text: o.runLabel || 'קדימה!', disabled: true });
    const hint = h('span', { class: 'muted small', text: 'קודם ניחוש. ככה זה נשאר בראש.' });
    const row = h('div', { class: 'btn-row' }, [run, hint]);
    const verdict = h('div', { class: 'predict-verdict' });
    const why = h('div', { class: 'predict-why' });
    const resultIn = h('div', { class: 'predict-result-in' }, [verdict, why]);
    const result = h('div', { class: 'predict-result' }, [resultIn]);
    host.classList.add('predict');
    host._phyCardId = o.id;
    [tag, q, list, row, stage, result].forEach(function (n) { host.appendChild(n); });

    let choice = -1;
    let running = false;
    let finished = false;

    const buttons = o.options.map(function (opt, i) {
      const mark = h('span', { class: 'opt-mark', 'aria-hidden': 'true' });
      const b = h('button', { type: 'button', class: 'opt', role: 'radio', 'aria-checked': 'false' }, [mark, h('span', { html: opt.text })]);
      b.addEventListener('click', function () { pick(i); });
      list.appendChild(b);
      return b;
    });

    function pick(i) {
      if (running || finished) return;
      choice = i;
      buttons.forEach(function (b, j) {
        b.classList.toggle('is-selected', j === i);
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
      });
      run.disabled = false;
      run.classList.add('is-ready');
      hint.textContent = '';
    }

    function bringStageIntoView() {
      const target = stage.firstElementChild;
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight - 10) {
        target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }

    function playAnimation() {
      running = true;
      run.disabled = true;
      run.classList.remove('is-ready');
      run.textContent = 'רץ...';
      buttons.forEach(function (b) { b.disabled = true; });
      bringStageIntoView();
      let p;
      try { p = o.onRun ? o.onRun(choice, o.options[choice]) : null; } catch (e) { console.error(e); }
      return Promise.resolve(p).catch(function (e) { console.error(e); });
    }

    run.addEventListener('click', function () {
      if (running) return;
      playAnimation().then(function () {
        running = false;
        if (!finished) reveal();
        run.disabled = false;
        run.textContent = o.againLabel || 'עוד פעם';
      });
    });

    function reveal() {
      finished = true;
      const opt = o.options[choice];
      const right = !!opt.correct;
      buttons.forEach(function (b, j) {
        const oj = o.options[j];
        b.querySelector('.opt-mark').textContent = oj.correct ? '✓' : j === choice ? '✗' : '';
        b.classList.toggle('is-correct', !!oj.correct);
        b.classList.toggle('is-wrong', j === choice && !oj.correct);
        b.classList.toggle('is-dim', j !== choice && !oj.correct);
      });
      verdict.textContent = right ? 'ניחוש נכון!' : 'לא הפעם. אבל עכשיו זה לא יישכח.';
      verdict.className = 'predict-verdict ' + (right ? 'good' : 'bad');
      why.innerHTML = opt.why ? '<p>' + opt.why + '</p>' : '';
      if (o.steps) StepSolution(why, { steps: o.steps, open: true });
      if (o.explanation) why.appendChild(h('div', { class: 'predict-after', html: o.explanation }));
      renderMath(why);
      result.classList.add('is-open');
      releaseHeld(host);
      if (o.chapter) {
        PHY.progress.recordPrediction(o.chapter, o.id, choice, right);
        if (o.section) PHY.progress.markSection(o.chapter, o.section);
      }
      if (PHY.mascot) {
        if (right) PHY.mascot.say(o.sayRight || 'ידעתי! אני תמיד אומר את זה לתפוחים.', 'happy');
        else PHY.mascot.say(o.sayWrong || 'גם אני ניחשתי ככה. זה נשאר בינינו.', 'thinking');
      }
      if (right) burst(buttons[choice], 16);
      if (o.onDone) o.onDone(right, choice);
    }

    renderMath(q);
    renderMath(list);
    return { el: host, stage, get finished() { return finished; } };
  }

  /* ---------- StepSolution ---------- */
  /* A ladder for a full worked solution. Each step shows a hint first, and its work only after a click.
     o: {steps: [{hint, work, label}], open, startLabel, onDone}. The last step must state the final answer.
     open: show the first hint right away. Otherwise a start button waits, so an exercise stays unspoiled. */
  function StepSolution(host, o) {
    const steps = o.steps;
    const total = steps.length;
    const box = h('div', { class: 'solution' });
    const list = h('div', { class: 'steps', 'aria-live': 'polite' });
    const hintLabel = h('span', { class: 'step-label' });
    const hintText = h('div', { class: 'step-hint' });
    const nextRow = h('div', { class: 'btn-row' });
    const prompt = h('div', { class: 'step-next' }, [hintLabel, hintText, nextRow]);
    let shown = 0;
    let startBtn = null;
    const revealBtn = Button(nextRow, '', showNext, { primary: true });

    function paintPrompt() {
      hintLabel.textContent = 'רמז לשלב ' + (shown + 1) + ' מתוך ' + total;
      hintText.innerHTML = steps[shown].hint;
      renderMath(hintText);
      revealBtn.textContent = shown === total - 1 ? 'לחשוף את השלב האחרון' : 'לחשוף את שלב ' + (shown + 1);
    }

    function open() {
      if (startBtn) { startBtn.parentNode.remove(); startBtn = null; }
      if (prompt.parentNode || shown >= total) return;
      box.appendChild(h('div', { class: 'solution-title', text: 'הפתרון, שלב אחר שלב' }));
      box.appendChild(list);
      box.appendChild(prompt);
      paintPrompt();
    }

    function showNext() {
      if (shown >= total) return;
      const s = steps[shown];
      const node = h('div', { class: 'step', tabindex: '-1' }, [
        h('span', { class: 'step-label', text: s.label || 'שלב ' + (shown + 1) + ' מתוך ' + total }),
        h('div', { class: 'step-q', html: s.hint }),
        h('div', { class: 'step-work', html: s.work }),
      ]);
      list.appendChild(node);
      renderMath(node);
      shown++;
      const behavior = reduced() ? 'auto' : 'smooth';
      if (shown < total) {
        paintPrompt();
        prompt.scrollIntoView({ block: 'nearest', behavior });
      } else {
        prompt.remove();
        node.focus({ preventScroll: true });
        node.scrollIntoView({ block: 'nearest', behavior });
        if (o.onDone) o.onDone();
      }
    }

    host.appendChild(box);
    if (o.open) open();
    else {
      const startRow = h('div', { class: 'btn-row' });
      box.appendChild(startRow);
      startBtn = Button(startRow, o.startLabel || 'לפתרון בשלבים, עם רמז לפני כל שלב', open, { ghost: true });
    }
    return { el: box, open, showNext };
  }

  /* ---------- Numeric checking ---------- */
  /* Default tolerance is ±3%. Answers of 0 use an absolute tolerance. */
  function numClose(input, answer, tol) {
    const v = PHY.fmt.parse(input);
    if (isNaN(v)) return false;
    const t = tol === undefined ? 0.03 : tol;
    const margin = Math.max(Math.abs(answer) * t, answer === 0 ? 0.05 : 0.005);
    return Math.abs(v - answer) <= margin;
  }

  function numField(id, label, unit) {
    const input = h('input', { class: 'num-input', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', dir: 'ltr', placeholder: '?', 'aria-label': label || 'תשובה' });
    return {
      input,
      el: h('div', { class: 'num-field' }, [label ? h('label', { for: id, html: label }) : null, input, unit ? h('span', { text: unit }) : null]),
    };
  }

  /* ---------- Problem: exam-style exercise with answer checking and graded hints ---------- */
  /* o: {chapter, section, id, tag, text, fields: [{label, answer, unit, tol}], steps: [...]} */
  let fieldId = 0;
  function Problem(host, o) {
    const box = h('div', { class: 'problem' });
    if (o.tag) box.appendChild(h('div', { class: 'problem-tag', text: o.tag }));
    box.appendChild(h('div', { class: 'problem-text', html: o.text }));
    const fieldsBox = h('div', { class: 'problem-fields' });
    const fields = o.fields.map(function (f) {
      const nf = numField('phy-f-' + ++fieldId, f.label, f.unit);
      fieldsBox.appendChild(nf.el);
      nf.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
      return Object.assign({}, f, { input: nf.input });
    });
    box.appendChild(fieldsBox);
    const row = h('div', { class: 'btn-row' });
    Button(row, 'בדיקה', check, { primary: true });
    box.appendChild(row);
    const fb = h('div', { class: 'problem-feedback', role: 'status' });
    box.appendChild(fb);
    host.appendChild(box);

    function check() {
      let ok = 0, empty = 0;
      fields.forEach(function (f) {
        const raw = f.input.value.trim();
        if (!raw) { empty++; f.input.classList.remove('is-right', 'is-off'); return; }
        const good = numClose(raw, f.answer, f.tol);
        f.input.classList.toggle('is-right', good);
        f.input.classList.toggle('is-off', !good);
        if (good) ok++;
      });
      if (ok === fields.length) {
        fb.textContent = 'בדיוק! כך זה נראה במבחן.';
        fb.className = 'problem-feedback good';
        burst(fb, 18);
        PHY.mascot.say('תשובה נכונה. מגיע לך תפוח. שלי, אבל מגיע לך.', 'happy');
        finish();
      } else if (empty === fields.length) {
        fb.textContent = 'קודם צריך מספר. ואפשר לטעות, זה בסדר.';
        fb.className = 'problem-feedback bad';
      } else {
        fb.textContent = 'עוד לא. כדאי לבדוק סימנים ויחידות, או לעבור לפתרון בשלבים.';
        fb.className = 'problem-feedback bad';
      }
    }

    function finish() {
      if (o.chapter && o.section) PHY.progress.markSection(o.chapter, o.section);
      if (o.onSolved) o.onSolved();
    }

    StepSolution(box, { steps: o.steps, onDone: finish });
    renderMath(box);
    return { el: box };
  }

  /* ---------- Quiz ---------- */
  /* questions: {type: 'mc', q, options: [...], answer: index, steps: [{hint, work}]}
                {type: 'num', q, answer, unit, tol, steps: [{hint, work}]}
     Each question is checked on its own, and its worked solution opens right there.
     After a wrong answer the right one stays hidden until the last step is revealed.
     Fraction correct maps to stars with PHY.progress.quizStars. The best score is saved. */
  function Quiz(host, o) {
    const root = h('div', { class: 'quiz' });
    host.appendChild(root);
    let items = [];
    let resultBox;

    function build() {
      root.innerHTML = '';
      items = o.questions.map(function (qd, i) {
        const box = h('div', { class: 'q' });
        box.appendChild(h('div', { class: 'q-head', html: '<span class="q-num">' + (i + 1) + '.</span>' + qd.q }));
        const item = { qd, box, choice: -1, done: false, good: false };
        const checkRow = h('div', { class: 'btn-row' });
        item.checkRow = checkRow;
        item.checkBtn = Button(checkRow, 'בדיקה', function () { checkItem(item); }, { primary: true, disabled: true });
        if (qd.type === 'num') {
          const nf = numField('phy-q-' + ++fieldId, '', qd.unit);
          item.input = nf.input;
          nf.input.addEventListener('input', function () { item.checkBtn.disabled = nf.input.value.trim() === ''; });
          nf.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && nf.input.value.trim() !== '') checkItem(item);
          });
          box.appendChild(nf.el);
        } else {
          const list = h('div', { class: 'predict-options', role: 'radiogroup' });
          item.opts = qd.options.map(function (text, j) {
            const b = h('button', { type: 'button', class: 'opt', role: 'radio', 'aria-checked': 'false' }, [h('span', { class: 'opt-mark', 'aria-hidden': 'true' }), h('span', { html: text })]);
            b.addEventListener('click', function () {
              if (item.done) return;
              item.choice = j;
              item.opts.forEach(function (x, k) {
                x.classList.toggle('is-selected', k === j);
                x.setAttribute('aria-checked', k === j ? 'true' : 'false');
              });
              item.checkBtn.disabled = false;
            });
            list.appendChild(b);
            return b;
          });
          box.appendChild(list);
        }
        box.appendChild(checkRow);
        item.whyBox = h('div', { class: 'q-why', hidden: true });
        box.appendChild(item.whyBox);
        root.appendChild(box);
        return item;
      });
      resultBox = h('div', { role: 'status' });
      root.appendChild(resultBox);
      renderMath(root);
    }

    function showAnswer(it) {
      const qd = it.qd;
      if (qd.type === 'num') {
        it.whyBox.appendChild(h('div', { class: 'q-answer', text: 'התשובה: ' + PHY.fmt.unit(qd.answer, qd.unit || '', 2) }));
        return;
      }
      it.opts.forEach(function (b, j) {
        b.classList.toggle('is-correct', j === qd.answer);
        b.classList.toggle('is-dim', j !== it.choice && j !== qd.answer);
        if (j === qd.answer) b.querySelector('.opt-mark').textContent = '✓';
      });
    }

    function checkItem(it) {
      if (it.done) return;
      it.done = true;
      const qd = it.qd;
      it.checkRow.remove();
      if (qd.type === 'num') {
        it.good = numClose(it.input.value, qd.answer, qd.tol);
        it.input.classList.toggle('is-right', it.good);
        it.input.classList.toggle('is-off', !it.good);
        it.input.readOnly = true;
      } else {
        it.good = it.choice === qd.answer;
        it.opts.forEach(function (b, j) {
          b.disabled = true;
          b.classList.remove('is-selected');
          b.classList.toggle('is-correct', it.good && j === qd.answer);
          b.classList.toggle('is-wrong', j === it.choice && !it.good);
          b.classList.toggle('is-dim', it.good && j !== qd.answer);
          b.querySelector('.opt-mark').textContent = j === it.choice ? (it.good ? '✓' : '✗') : '';
        });
      }
      it.box.classList.add(it.good ? 'is-right' : 'is-off');
      it.whyBox.innerHTML = it.good
        ? '<span class="q-verdict good">נכון.</span>'
        : '<span class="q-verdict bad">לא מדויק.</span> התשובה תיחשף בשלב האחרון.';
      it.whyBox.hidden = false;
      StepSolution(it.whyBox, {
        steps: qd.steps,
        open: !it.good,
        startLabel: 'איך מגיעים לזה? לפתרון בשלבים',
        onDone: it.good ? null : function () { showAnswer(it); },
      });
      if (items.every(function (x) { return x.done; })) finish();
    }

    function finish() {
      const right = items.filter(function (x) { return x.good; }).length;
      const score = right / items.length;
      const stars = PHY.progress.quizStars(score);
      if (o.chapter) {
        PHY.progress.setQuiz(o.chapter, score);
        if (o.section) PHY.progress.markSection(o.chapter, o.section);
      }
      resultBox.className = 'quiz-result';
      resultBox.innerHTML = '';
      StarScore(resultBox, { value: stars, size: 34, animate: true });
      resultBox.appendChild(h('span', { text: right + ' מתוך ' + items.length + ' נכונות.' }));
      Button(resultBox, 'עוד ניסיון', build, { ghost: true });
      if (score >= 0.9) {
        burst(resultBox, 30);
        PHY.mascot.say('שלושה כוכבים! אני שם אותם על הקיר, בכיוון צפון.', 'happy');
      } else if (score >= 0.6) {
        PHY.mascot.say('יפה מאוד. הפתרונות בשלבים סוגרים את הפינות.', 'happy');
      } else {
        PHY.mascot.say('עוברים על הפתרונות בשלבים, ומנסים שוב. אני נפלתי הרבה יותר פעמים.', 'dizzy');
      }
      if (o.onDone) o.onDone(score, stars);
    }

    build();
    return { el: root, rebuild: build };
  }

  /* ---------- Page chrome ---------- */
  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  function themeButton(host) {
    const b = h('button', { type: 'button', class: 'icon-btn' });
    const paint = function () {
      const dark = PHY.theme.get() === 'dark';
      b.innerHTML = dark ? ICON_SUN : ICON_MOON;
      b.setAttribute('aria-label', dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
      b.title = b.getAttribute('aria-label');
    };
    b.addEventListener('click', PHY.theme.toggle);
    document.addEventListener('phy:theme', paint);
    paint();
    if (host) host.appendChild(b);
    return b;
  }

  /* Prev / home / next, built from PHY.course. "base" is the path to the chapters folder. */
  function chapterNav(host, id) {
    const i = PHY.course.findIndex(function (c) { return c.id === id; });
    const prev = PHY.course[i - 1];
    const next = PHY.course[i + 1];
    const nav = h('nav', { class: 'chapter-nav wrap', 'aria-label': 'ניווט בין פרקים' });
    const link = function (c, label) {
      if (!c || c.status !== 'active') return h('span', { class: 'is-spacer' });
      return h('a', { class: 'btn', href: c.file, text: label + ': ' + c.title });
    };
    nav.appendChild(link(prev, 'הקודם'));
    nav.appendChild(h('a', { class: 'btn', href: '../index.html', text: 'הבית' }));
    nav.appendChild(link(next, 'הבא'));
    host.appendChild(nav);
    return nav;
  }

  /* Call once at the bottom of every chapter page.
     Passive sections (data-passive) are marked done when seen for 1 s. All the rest are marked by
     their components, via the `section` option. Also renders math and mounts data-mascot cats. */
  /* Text right after a card often states its answer, so it stays closed until the reveal.
     It holds up to the next card, a <nav>, or an element marked data-no-hold. A card answered
     on an earlier visit holds nothing back. Held elements keep their width, so a canvas inside
     one stays correctly sized. */
  function holdAfterCards(chapterId) {
    const answered = PHY.progress.chapter(chapterId).predictions || {};
    document.querySelectorAll('.predict').forEach(function (host) {
      if (host._phyCardId && answered[host._phyCardId]) return;
      const els = [];
      for (let n = host.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.matches('.predict, nav, script, style, [data-no-hold]') || n.querySelector('.predict')) break;
        els.push(n);
      }
      if (!els.length) return;
      els.forEach(function (el) { el.classList.add('held'); });
      const note = h('p', { class: 'held-note muted small', text: 'ההמשך ייפתח אחרי הניחוש.' });
      host.after(note);
      host._held = { els: els, note: note };
    });
  }

  function releaseHeld(host) {
    const held = host._held;
    if (!held) return;
    host._held = null;
    held.note.remove();
    held.els.forEach(function (el) {
      el.classList.remove('held');
      el.classList.add('held-open');
    });
  }

  function initChapter(o) {
    const id = o.id;
    const sections = Array.prototype.slice.call(document.querySelectorAll('section[data-section]'));
    PHY.progress.setTotal(id, sections.length);

    const bar = document.querySelector('[data-chapter-bar]');
    function paint() {
      sections.forEach(function (s) {
        s.classList.toggle('is-done', PHY.progress.hasSection(id, s.dataset.section));
      });
      if (bar) bar.style.width = PHY.progress.fraction(id) * 100 + '%';
    }
    document.addEventListener('phy:progress', paint);
    paint();

    const tb = document.querySelector('[data-theme-slot]');
    if (tb) themeButton(tb);
    const brand = document.querySelector('[data-brand-cat]');
    if (brand) brand.innerHTML = '<span class="mascot-figure">' + PHY.mascot.svg('standing', 'aria-hidden="true"') + '</span>';
    const navHost = document.querySelector('[data-chapter-nav]');
    if (navHost) chapterNav(navHost, id);

    if ('IntersectionObserver' in window) {
      /* A section counts as read after 1 s with 25% of it visible, or, for one taller than that
         allows, with it filling half the screen. */
      const timers = new Map();
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          const name = e.target.dataset.section;
          const rootH = e.rootBounds ? e.rootBounds.height : window.innerHeight;
          const reading = e.isIntersecting && (e.intersectionRatio >= 0.25 || e.intersectionRect.height >= rootH * 0.5);
          if (reading && !timers.has(name)) {
            timers.set(name, setTimeout(function () {
              PHY.progress.markSection(id, name);
              io.unobserve(e.target);
            }, 1000));
          } else if (!reading && timers.has(name)) {
            clearTimeout(timers.get(name));
            timers.delete(name);
          }
        });
      }, { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1] });
      sections.forEach(function (s) {
        if (s.hasAttribute('data-passive') && !PHY.progress.hasSection(id, s.dataset.section)) io.observe(s);
      });
    }
    holdAfterCards(id);
    PHY.mascot.autoMount();
    renderMath(document.body);
  }

  PHY.ui = {
    h, renderMath, burst, reduced,
    Button, Toggle, Slider, Readouts, StarScore,
    PredictCard, StepSolution, Problem, Quiz, numClose,
    themeButton, chapterNav, initChapter,
  };
})();

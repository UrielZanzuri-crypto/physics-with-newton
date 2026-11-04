/* PHY.sims.escalator: relative motion in one dimension. Three cats race over a 30 m walkway: one
   stands on the moving belt, one walks on a still floor, one walks on the moving belt. Velocities
   simply add. The time runs at 5x so nobody falls asleep.
   sim.play() -> Promise. setParam('walk', v). getState(): {t, lanes: [{v, x, done}]}. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, H2 = PHY.ch02;
  const LEN = 30, BELT = 1, RATE = 5, CAP = 40;

  PHY.sims.escalator = function (canvasEl, controlsEl, opts) {
    opts = Object.assign({ walk: 1.5, locked: true }, opts || {});
    const view = PHY.canvas.create(canvasEl, { aspect: 2, minHeight: 300, maxHeight: 360 });
    const P = H2.pix(view);
    const S = { walk: opts.walk, t: 0, running: false, resolve: null, lanes: [], played: false };

    function build() {
      S.lanes = [
        { name: 'עומד על הדרגנוע', belt: true, v: BELT, walk: false, x: 0, done: null },
        { name: 'הולך על רצפה רגילה', belt: false, v: S.walk, walk: true, x: 0, done: null },
        { name: 'הולך על הדרגנוע', belt: true, v: BELT + S.walk, walk: true, x: 0, done: null },
      ];
    }
    const slider = U.Slider(controlsEl, {
      label: 'מהירות ההליכה (מינוס: נגד הכיוון)', min: -2, max: 3, step: 0.5, value: S.walk, unit: 'ms', digits: 1, color: 'var(--c-velocity)',
      onInput(v) { S.walk = v; api.reset(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const go = U.Button(row, 'התחל', function () { api.play(); }, { primary: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'a', label: 'עומד: ביחס לבניין', color: 'var(--c-velocity)' },
      { key: 'b', label: 'הולך: ביחס לבניין', color: 'var(--c-velocity)' },
      { key: 'c', label: 'גם וגם: ביחס לבניין', color: 'var(--c-velocity)' },
    ]);
    function setLocked(v) { slider.setEnabled(!v); go.disabled = v; }
    function update() {
      out.set('t', F.unit(S.t, 's', 1));
      out.set('a', F.unit(S.lanes[0].v, 'ms', 1));
      out.set('b', F.unit(S.lanes[1].v, 'ms', 1));
      /* Before the first run this sum is most of the answer to the guess. */
      out.set('c', S.played ? F.unit(S.lanes[2].v, 'ms', 1) : '?');
    }
    function step(dt) {
      if (!S.running) return;
      S.t += dt * RATE;
      let moving = false;
      S.lanes.forEach(function (l) {
        if (l.done !== null) return;
        const T = l.v > 0 ? LEN / l.v : Infinity;
        if (S.t >= T) { l.done = T; l.x = LEN; return; }
        l.x = Math.max(0, l.v * S.t);
        moving = true;
      });
      update();
      if (!moving || S.t >= CAP) {
        S.running = false;
        setLocked(false);
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
      }
    }
    function render() {
      view.clear();
      const W = view.w, Hh = view.h;
      const m = W < 420 ? 22 : 40;
      const X = (x) => m + (x / LEN) * (W - 2 * m);
      const laneH = Hh / 3;
      S.lanes.forEach(function (l, i) {
        const y = laneH * (i + 1) - 26;
        view.screenText(W - 8, laneH * i + 13, l.name, { size: 12, weight: 700, color: C.soft, align: 'right' });
        /* Belt: stripes that run. A still floor: stripes that do not. */
        P.line(m - 8, y + 5, W - m + 8, y + 5, { color: l.belt ? C.axis : C.gridStrong, width: 10, cap: 'butt' });
        const off = l.belt ? (BELT * S.t * ((W - 2 * m) / LEN)) % 26 : 0;
        for (let px = m - 8 + off; px < W - m + 8; px += 26) P.line(px, y + 1, px + 5, y + 9, { color: C.bg, width: 2, cap: 'butt' });
        view.screenText(X(0), y + 18, '0', { size: 10.5, color: C.soft });
        view.screenText(X(LEN), y + 18, F.unit(LEN, 'm', 0), { size: 10.5, color: C.soft });
        const moving = S.running && l.done === null;
        P.cat(X(l.x), y, { pose: l.done !== null ? 'happy' : moving && l.walk ? 'sliding' : 'standing', px: W < 420 ? 34 : 42, flipX: l.v < 0 });
        if (l.done !== null) view.screenText(X(l.x) - 28, y - 16, F.unit(l.done, 's', 0), { size: 13, weight: 800, color: C.accent, align: 'right', halo: true });
      });
    }
    const loop = PHY.SimLoop({ view, step, render });
    const api = {
      start: loop.start,
      stop: loop.stop,
      reset() {
        S.t = 0;
        S.running = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(); }
        build();
        update();
        loop.requestRender();
      },
      setParam(name, v) {
        if (name === 'walk') { S.walk = v; slider.set(v); api.reset(); }
        if (name === 'locked') setLocked(!!v);
      },
      getState() { return { t: S.t, running: S.running, lanes: S.lanes.map((l) => ({ v: l.v, x: l.x, done: l.done })) }; },
      play() {
        S.played = true;
        api.reset();
        setLocked(true);
        S.running = true;
        return new Promise(function (res) { S.resolve = res; });
      },
    };
    build();
    update();
    setLocked(opts.locked);
    return api;
  };
})();

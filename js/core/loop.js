/* PHY.SimLoop: fixed-timestep physics (dt = 1/120 s) with requestAnimationFrame rendering.
   An IntersectionObserver pauses anything offscreen. A stopped loop still repaints on demand
   (requestRender), on resize and on theme change.

   const loop = PHY.SimLoop({view, step(dt, t), render(t)});   // view from PHY.canvas.create
   loop.start(); loop.stop(); loop.requestRender(); loop.time; loop.running; loop.resetClock(); */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});
  PHY.sims = PHY.sims || {};
  const FIXED_DT = 1 / 120;
  const MAX_FRAME = 0.1;

  PHY.SimLoop = function (o) {
    const step = o.step || function () {};
    const render = o.render || function () {};
    const canvas = o.canvas || (o.view && o.view.canvas);
    let started = false;
    let visible = false;
    let rafId = 0;
    let last = 0;
    let acc = 0;
    let dirty = true;

    const api = {
      time: 0,
      get running() { return started; },
      get visible() { return visible; },
      start() { started = true; last = 0; kick(); },
      stop() { started = false; },
      requestRender() { dirty = true; kick(); },
      resetClock() { api.time = 0; acc = 0; },
    };

    function kick() {
      if (!rafId && visible && (started || dirty)) rafId = requestAnimationFrame(frame);
    }

    function frame(now) {
      rafId = 0;
      if (started && visible) {
        if (!last) last = now;
        acc += Math.min((now - last) / 1000, MAX_FRAME);
        last = now;
        while (acc >= FIXED_DT) {
          step(FIXED_DT, api.time);
          api.time += FIXED_DT;
          acc -= FIXED_DT;
        }
      } else {
        last = 0;
      }
      if (visible) {
        render(api.time);
        dirty = false;
      }
      kick();
    }

    if ('IntersectionObserver' in window && canvas) {
      new IntersectionObserver(
        function (entries) {
          visible = entries[entries.length - 1].isIntersecting;
          last = 0;
          if (visible) { dirty = true; kick(); }
        },
        { rootMargin: '80px' }
      ).observe(canvas);
    } else {
      visible = true;
    }

    if (o.view) o.view.onResize(api.requestRender);
    document.addEventListener('phy:theme', api.requestRender);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(api.requestRender);
    return api;
  };
})();

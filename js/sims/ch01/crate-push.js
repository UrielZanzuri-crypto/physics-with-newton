/* PHY.sims.cratePush: the same 30 N in different directions moves a crate to different places,
   while a thermometer next to it does not care. sim.play() -> Promise. Force is green. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const V = PHY.vec;
  const C = PHY.colors;

  PHY.sims.cratePush = function (canvasEl, controlsEl) {
    const view = PHY.canvas.create(canvasEl, {
      world: { xMin: -7, xMax: 7, yMin: -3.2, yMax: 4.2 },
      aspect: 1.9,
      minHeight: 230,
      maxHeight: 400,
    });
    const HOME = V.v(1.2, -1.5);
    const S = { pos: HOME, force: null, caption: '', t: 0, tw: [], pose: 'standing' };

    function tween(T, fn) {
      return new Promise(function (resolve) { S.tw.push({ t: 0, T, fn, resolve }); });
    }
    function step(dt) {
      S.t += dt;
      S.tw.slice().forEach(function (w) {
        w.t += dt;
        const k = Math.min(w.t / w.T, 1);
        w.fn(k);
        if (k >= 1) {
          S.tw.splice(S.tw.indexOf(w), 1);
          w.resolve();
        }
      });
    }

    function render() {
      view.clear();
      view.grid(1, {});
      view.line(view.visible.xMin, -1.5, view.visible.xMax, -1.5, { color: C.axis, width: 2.5 });

      /* Thermometer: the scalar. Same value no matter what the crate does. */
      const tx = -6.1;
      const ctx = view.ctx;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(view.sx(tx), view.sy(-0.9)); ctx.lineTo(view.sx(tx), view.sy(2.1)); ctx.stroke();
      ctx.strokeStyle = C.surface;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(view.sx(tx), view.sy(-0.9)); ctx.lineTo(view.sx(tx), view.sy(2.1)); ctx.stroke();
      ctx.strokeStyle = C.apple;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(view.sx(tx), view.sy(-0.9)); ctx.lineTo(view.sx(tx), view.sy(1)); ctx.stroke();
      ctx.restore();
      view.circle(tx, -1, 11, { px: true, fill: C.apple, color: C.axis, width: 2.5 });
      view.text(tx, 2.75, '30°', { weight: 800, size: 16 });

      /* Crate with the cat on top */
      const size = 1.5;
      const x = S.pos.x, y = S.pos.y;
      view.poly([
        { x: x - size / 2, y }, { x: x + size / 2, y }, { x: x + size / 2, y: y + size }, { x: x - size / 2, y: y + size },
      ], { fill: '#C5823F', color: '#3B2A20', width: 2.5, close: true });
      view.line(x - size / 2, y, x + size / 2, y + size, { color: '#3B2A20', width: 2 });
      view.line(x + size / 2, y, x - size / 2, y + size, { color: '#3B2A20', width: 2 });
      PHY.mascot.draw(view, x, y + size, { pose: S.pose, px: 62 });

      if (S.force) {
        const c = V.v(x, y + size / 2);
        const off = V.scale(V.norm(S.force), 0.95);
        const a = V.add(c, off);
        const b = V.add(a, S.force);
        view.arrow(a.x, a.y, b.x, b.y, { color: C.force, width: 5, label: '30 ניוטון', labelGap: 16, labelSize: 13.5 });
      }
      if (S.caption) view.screenText(view.w / 2, 22, S.caption, { size: 14, weight: 700, pill: true });
    }

    const loop = PHY.SimLoop({ view, step, render });
    let runId = 0;

    async function push(dir, word, pose) {
      const id = runId;
      S.caption = '30 ניוטון ' + word;
      S.force = V.scale(dir, 1.7);
      await tween(0.35, function () {});
      if (id !== runId) return;
      const from = S.pos, to = V.add(HOME, V.scale(dir, 2.6));
      S.pose = pose;
      await tween(0.8, function (k) { S.pos = V.lerp(from, to, k * k); });
      if (id !== runId) return;
      S.force = null;
      await tween(0.25, function () {});
      if (id !== runId) return;
      const back = S.pos;
      S.caption = '';
      S.pose = 'standing';
      await tween(0.5, function (k) { S.pos = V.lerp(back, HOME, k); });
    }

    return {
      start() { loop.start(); },
      stop() { loop.stop(); },
      reset() { runId++; S.tw = []; S.pos = HOME; S.force = null; S.caption = ''; S.pose = 'standing'; loop.requestRender(); },
      setParam() {},
      getState() { return { pos: S.pos }; },
      async play() {
        this.reset();
        const id = runId;
        await push(V.v(1, 0), 'ימינה', 'sliding');
        if (id !== runId) return;
        await push(V.v(-1, 0), 'שמאלה', 'sliding');
        if (id !== runId) return;
        await push(V.v(0, 1), 'למעלה', 'flying');
        if (id !== runId) return;
        S.caption = 'אותו 30, שלוש תוצאות. המדחום? 30°.';
        await tween(1.2, function () {});
      },
    };
  };
})();

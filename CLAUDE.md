# פיזיקה עם ניוטון החתול: project conventions

Interactive Hebrew (RTL) mechanics tutorial, mechina level. Static site. Read `CONTENT_GUIDE.md` before writing any Hebrew. `chapters/01-vectors.html` is the reference implementation: copy its structure.

## Hard rules

- **No build step and no ES modules** (`type="module"` breaks on `file://`). Classic `<script src>` tags, everything under `window.PHY`. The site must work by double-clicking `index.html` and via `python3 -m http.server`. Relative paths only.
- **External code only from cdnjs, pinned:** KaTeX 0.16.11 (css, js, contrib/auto-render). Google Fonts for Rubik and Heebo. Three.js only if a chapter truly needs 3D.
- **g = 10 m/s²** everywhere. The 9.8 note lives on the home page only.
- **Vector colors are fixed:** velocity blue, acceleration red, force green, displacement purple. CSS: `--c-velocity`, `--c-acceleration`, `--c-force`, `--c-displacement`. Text classes: `c-vel`, `c-acc`, `c-force`, `c-disp`. Canvas: `PHY.colors.velocity`, `.acceleration`, `.force`, `.displacement`.
- **Never hard-code theme-dependent colors in a sim, and never copy a color into a variable that outlives a frame.** `PHY.colors` is mutated in place on theme change, so read `C.force` at draw time. Theme changes repaint through `SimLoop`.
- **375px wide with no horizontal scroll.** Touch targets at least 44px. `prefers-reduced-motion` turns off decorative animation only, not simulations.

## Files

```
index.html               home: chapter map, driven by PHY.course
css/style.css            tokens on :root and :root[data-theme=dark], all components
js/core/fmt.js           PHY.fmt      num, unit, deg, parse (RTL-safe negatives)
js/core/vec.js           PHY.vec      immutable {x, y} math; angles in degrees
js/core/progress.js      PHY.progress + PHY.course (the chapter list)
js/core/canvas.js        PHY.canvas, PHY.colors, PHY.theme
js/core/loop.js          PHY.SimLoop, PHY.sims namespace
js/core/mascot.js        PHY.mascot
js/core/ui.js            PHY.ui
js/sims/chNN/<name>.js   one simulation per file, registers PHY.sims.<camelName>
chapters/NN-<slug>.html  one page per chapter
```

**Script order is fixed:** katex, auto-render, fmt, vec, progress, canvas, loop, mascot, ui, then the chapter's sims, then the inline chapter script.

## Adding a simulation

Factory signature: `PHY.sims.name(canvasEl, controlsEl, opts)` returns `{start, stop, reset, setParam, getState}` (extra methods are fine, for example `play()` returning a Promise). A DOM-only sim takes a host `<div>` as the first argument (see `sort-game.js`).

```js
(function () {
  'use strict';
  const PHY = window.PHY, V = PHY.vec, F = PHY.fmt, U = PHY.ui, C = PHY.colors;
  PHY.sims.mySim = function (canvasEl, controlsEl, opts) {
    const view = PHY.canvas.create(canvasEl, { world: { xMin: -1, xMax: 10, yMin: -1, yMax: 6 }, aspect: 16 / 9, minHeight: 240, maxHeight: 460 });
    const S = { /* state */ };
    function step(dt) { /* physics at fixed dt = 1/120 */ }
    function render() { view.clear(); view.grid(1); view.axes({ tickEvery: 1 }); /* draw */ }
    const loop = PHY.SimLoop({ view, step, render });
    return { start: loop.start, stop: loop.stop, reset() {}, setParam() {}, getState() { return {}; } };
  };
})();
```

- **Canvas is world coordinates in meters, x right, y UP.** The canvas is forced `dir="ltr"`. Scale is uniform.
- **`view` helpers:** `clear`, `grid(step, {majorEvery})`, `axes({origin, xLabel, yLabel, tickEvery, tickLabels})`, `line`, `poly`, `circle` (`{px: true}` for pixel radius), `arrow(x1, y1, x2, y2, {color, width, dash, alpha, label, labelSide, labelGap})`, `arc`, `text(x, y, str, {offset, size, weight, color, halo, pill})`, `screenText`, `pxDist`, `toWorld`, `sx`, `sy`, `visible`.
- **Dragging:** `view.drag({hit(p), start(h, p), move(h, p), end(h, p)})`. Return null from `hit` when the pointer misses a handle: that is what keeps the page scrollable on touch. Use `view.onTap(fn)` for taps. Hit radius about 30 px.
- **Sliders and readouts go in `controlsEl`:** `U.Slider`, `U.Readouts`, `U.Toggle`, `U.Button`.
- **Offscreen sims pause automatically.** Time-based scripted animation must therefore run inside `step` (tweens driven by `dt`), never on `setTimeout`, or it will drift from the picture. See the `tween` helper in `treasure-map.js`.
- **Text on canvas:** `view.text` draws Hebrew strings RTL automatically. Numbers always through `F.num` / `F.unit`, so negatives do not flip.
- **The cat in a sim:** `PHY.mascot.draw(view, x, y, {pose, px or h, rot, flipX, anchor, alpha})`, with (x, y) in world meters. Default anchor is the feet (seated poses), the center (`falling`, `flying`) or the branch (`onBranch`).

## Adding a chapter

1. Copy the head, top bar, footer scripts and section markup from `chapters/01-vectors.html`.
2. In `js/core/progress.js`, in `PHY.course`, set the chapter's `status: 'active'`. Home and nav update themselves. Chapters 02 and 03 are already active, so their filenames must stay `02-kinematics.html` and `03-projectiles.html`.
3. Every `<section class="section wrap" data-section="name">` counts toward progress. Add `data-passive` for sections with no interaction (they are marked when seen for 1 s). The rest are marked by passing `{chapter, section}` to the component, or by calling `PHY.progress.markSection`.
4. Use `\(inline\)` and `\[display\]` for math. In a JS string that is `\\(` and `\\[`. `PHY.ui.renderMath` runs automatically and sets `dir="ltr"`.
5. End the inline script with `PHY.mascot.easterEgg([...])` and `PHY.ui.initChapter({id: 'NN'})`.
6. The quiz has 5 questions, plus 2 review questions from earlier chapters from chapter 2 onward.

## Components (`PHY.ui`)

- `PredictCard(host, {chapter, id, section, tag, question, options: [{text, correct, why}], onRun(i, opt) -> Promise, steps, explanation, sayRight, sayWrong, onDone})`. `explanation` stays open under the solution, so keep it to calls to action. Children already inside `host` (the `<figure class="sim">`) become the stage. **The reveal waits for the promise that `onRun` returns.** Put your own data on options (see `F` in the tug-of-war card).
- `Quiz(host, {chapter, section, questions: [{type: 'mc', q, options, answer, steps} | {type: 'num', q, answer, unit, tol, steps}]})`. Each question has its own check button. ±3% default tolerance.
- `Problem(host, {chapter, section, tag, text, fields: [{label, answer, unit, tol}], steps: [...]})` wraps `StepSolution`.
- `StepSolution(host, {steps: [{hint, work}], open, startLabel, onDone})`: shows the hint, and the work only after a click. `open` shows the first hint at once. `StarScore(host, {value, size, animate})`, `Slider(host, {...})`, `Toggle`, `Button(host, text, fn, {primary, ghost})`, `Readouts(host, [{key, label, color}])`, `burst(el, n)`, `h(tag, attrs, children)`.

## Staged solutions

Every question has a full solution in `steps: [{hint, work}]`: predict cards, exam problems and quiz questions.

- A hint points to the next move and asks a question. It never contains the result of its own step.
- `work` is the full calculation of that step, with units. The last step must state the final answer of the question.
- After a wrong quiz answer, the right one stays hidden until the last step is revealed.
- Write new solutions in first person plural ("נחשב", "נציב"), which reads the same for every reader.

## Mascot

`PHY.mascot.say(text, pose)` for the floating cat. `<div data-mascot="happy" data-say="..." data-size="118"></div>` for an inline cat, or `PHY.mascot.mount(host, {pose, text, size})`. Poses: `standing`, `happy`, `thinking`, `dizzy`, `falling`, `flying`, `onBranch`, `sliding`.

## Progress

Key `phy-progress-v1`: `{chapters: {"01": {sections: [...], total, quiz: 0.8, game: 3, predictions: {...}}}}`. Always go through `PHY.progress`, never touch `localStorage` directly.

## Verifying a chapter

Serve with `python3 -m http.server 8080`. Click through every predict card, finish the game, submit the quiz, then check for console errors, 375px with no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), dark-mode toggle (canvases recolor), and that a reload keeps stars on the home page. Also open the page directly from `file://`.

## Testing

- **Physics:** open `tests/physics.html`. It runs the real sims on a manual clock, so tab visibility does not matter, and the page title reads `PASS n/n`. Add a line for every new sim's key numbers. It works headless:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --virtual-time-budget=60000 --dump-dom "file://<project path, URL-encoded>/tests/physics.html"`
- **Real browser run:** headless Chrome reports `visibilityState: visible`, so rAF and IntersectionObserver are real. It also opens `file://`, which the Chrome extension refuses. Prefer it for animation timing and for touch through `Input.dispatchTouchEvent`.

## Lessons from chapters 1-3

- `[hidden]` is forced to `display: none` globally, so `hidden` is safe on any component.
- Chapter-local helpers live next to the sims and load first: `js/sims/ch02/plot.js` (`PHY.ch02`), `js/sims/ch03/ballistics.js` (`PHY.ballistics`). Reuse them rather than writing new ones.
- Do not leave debug handles on `window`.
- Section numbers restart in every chapter. Write "מסעיף N" for a section and "מפרק N" for a chapter.
- A passive section counts as read after 1 s with 25% of it visible, or with it filling half the screen. No per-chapter workaround is needed.

#!/usr/bin/env node
/* End-to-end gate for one chapter, in a real headless Chrome over file://.
     node tests/chapter-check.mjs 04-newton.html [--shots <dir>] [--no-cards]
   Exit code 0 means no failures. Warnings are for a human to read and fix.

   Checks: source lint, console and KaTeX errors, every predict card in real time, every staged
   solution, the quiz wrong and then right, progress after reload, and 375px with everything open.
   --shots writes one screenshot per section, at desktop and phone width, into <dir>.
   It does not play the game: prove that in tests/chNN.js. */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const file = args.find((a) => a.endsWith('.html'));
if (!file) { console.error('usage: node tests/chapter-check.mjs NN-name.html [--shots dir] [--no-cards]'); process.exit(2); }
const shotsDir = args.includes('--shots') ? resolve(args[args.indexOf('--shots') + 1]) : null;
const skipCards = args.includes('--no-cards');
const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = join(PROJ, 'chapters', file);
const url = 'file://' + encodeURI(pagePath);
const id = file.slice(0, 2);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const R = { chapter: file, fails: [], warnings: [], info: {} };
const fail = (...a) => R.fails.push(a.join(' '));
const warn = (...a) => R.warnings.push(a.join(' '));

/* ---------- source lint ---------- */
const src = readFileSync(pagePath, 'utf8');
function lintGender(name, text) {
  if (+id < 4) return;
  const WORDS = ['אתה', 'נסה', 'גרור', 'לחץ', 'בחר', 'שים', 'הזז', 'הדלק', 'סמן', 'שנה', 'כוון', 'הקש', 'בדוק', 'חשב', 'תנחש', 'תספר', 'תגלה', 'תוכל', 'תראה', 'קח', 'זכור', 'הסתכל', 'תסתכל', 'לחצת', 'הרץ', 'כתוב', 'קרא', 'סובב', 'שגר', 'ירה', 'תשכח', 'דמיין', 'מוזמן', 'רוצה לנסות', 'בוא'];
  const noMath = text.replace(/\\\\?\(.*?\\\\?\)/g, ' ');
  noMath.split('\n').forEach((line, i) => {
    if (/^\s*(\/\*|\*|\/\/)/.test(line)) return;
    const tokens = line.split(/[^֐-׿']+/);
    for (const w of WORDS) if (tokens.includes(w)) warn(`gendered word "${w}" at ${name}:${i + 1}`);
  });
}
lintGender(file, src);
const simFiles = [...src.matchAll(/src="\.\.\/(js\/sims\/[^"]+)"/g)].map((m) => m[1]);
simFiles.forEach((rel) => {
  const abs = join(PROJ, rel);
  if (!existsSync(abs)) { fail('missing script', rel); return; }
  const s = readFileSync(abs, 'utf8');
  if (rel.includes(`/ch${id}/`)) {
    lintGender(rel, s);
    if (/setTimeout\(/.test(s)) warn(`setTimeout in ${rel}: scripted animation must run inside step(), or it drifts when the sim pauses offscreen`);
    if (/—/.test(s)) warn(`em dash in ${rel}`);
    if (/#[0-9a-fA-F]{3,8}\b/.test(s)) warn(`hard-coded hex color in ${rel}: read theme colors from PHY.colors at draw time`);
    if (/window\.[A-Za-z_]+\s*=/.test(s.replace(/window\.PHY\b/g, ''))) warn(`assigns to window in ${rel}`);
  }
});
if (/type="module"/.test(src)) fail('type="module" breaks file://');
if (/(src|href)="\//.test(src)) fail('absolute path in src or href');
if (/—/.test(src)) warn('em dash in the chapter');
if (/window\.PHY_/.test(src)) fail('debug handle on window');
const quizStart = src.indexOf('U.Quiz(');
const quizEnd = src.indexOf('easterEgg', quizStart);
if (quizStart < 0 || quizEnd < 0) fail('U.Quiz( or easterEgg not found');
if (src.indexOf('PHY.mascot.easterEgg') < 0) fail('no easter egg');
if (src.indexOf('initChapter') < 0) fail('no initChapter');
const Q = [...src.slice(quizStart, quizEnd).matchAll(/type: '(mc|num)'[\s\S]*?answer: (-?[\d.]+)/g)].map((m) => ({ t: m[1], a: +m[2] }));
const probBlock = src.slice(src.indexOf('U.Problem('), quizStart);
const P = probBlock.split('U.Problem(').slice(1).map((b) => [...b.split('steps:')[0].matchAll(/answer: (-?[\d.]+)/g)].map((m) => +m[1]));
const need = +id >= 2 ? 7 : 5;
if (Q.length !== need) fail(`quiz has ${Q.length} questions, expected ${need}`);
if (P.length < 2 || P.length > 4) warn(`${P.length} exam problems, expected 2-4`);
for (const name of ['hook', 'formula', 'playground', 'game', 'traps', 'problems', 'quiz', 'pocket'])
  if (!src.includes(`data-section="${name}"`)) warn(`no section named "${name}"`);
if (!/data-section="pocket"[^>]*data-passive|data-passive[^>]*data-section="pocket"/.test(src)) warn('pocket section should be data-passive');
if ((src.match(/hint: `/g) || []).length < 45) warn('fewer than 45 solution steps: is every solution complete?');

/* ---------- browser ---------- */
const prof = mkdtempSync(join(tmpdir(), 'phy-check-'));
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const finish = (code) => {
  try { proc.kill(); } catch {}
  setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} console.log(JSON.stringify(R, null, 1)); process.exit(code); }, 300);
};
setTimeout(() => { fail('watchdog: the run took more than 12 minutes'); finish(3); }, 12 * 60 * 1000);
process.on('unhandledRejection', (e) => { fail('crash: ' + (e && e.message)); finish(4); });

let port;
for (let i = 0; i < 100 && !port; i++) { await sleep(150); try { port = readFileSync(join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {} }
if (!port) { fail('Chrome did not start'); finish(5); await sleep(1e6); }
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(100); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let msgId = 0; const pend = new Map(); const handlers = [];
const BENIGN = /GL Driver|GPU stall|getImageData|WebGL|swiftshader|favicon/i;
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') fail('page exception:', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { const s = m.params.args.map((a) => a.value || a.description).join(' '); if (!BENIGN.test(s)) fail('console.error:', s); }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !BENIGN.test(m.params.entry.text)) fail('browser error:', m.params.entry.text, m.params.entry.url || '');
  handlers.forEach((h) => h(m));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++msgId; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const E = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(expr.slice(0, 80) + ' => ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
for (const d of ['Page', 'Runtime', 'Log']) await send(d + '.enable');
const nav = async () => {
  const loaded = new Promise((r) => { const h = (m) => { if (m.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); });
  await send('Page.navigate', { url });
  await loaded; await sleep(1500);
  await E(`window.__ladder=function(root){const o={hints:[],works:[]};let g=0;while(g++<30){const pr=root.querySelector('.step-next');if(!pr)break;o.hints.push(pr.querySelector('.step-hint').textContent);const b=root.querySelectorAll('.step').length;pr.querySelector('button').click();const s=root.querySelectorAll('.step');if(s.length!==b+1)o.bad=1;o.works.push(s[s.length-1].querySelector('.step-work').textContent)}return o};0`);
};
const shot = async (name) => { await sleep(350); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(shotsDir, name + '.png'), Buffer.from(s.result.data, 'base64')); };
const forms = (a) => { const r = Math.round(a * 10) / 10; return [...new Set([String(a), String(r), String(Math.round(a))])]; };
const has = (text, a) => forms(a).some((n) => new RegExp('(^|[^0-9.])' + n.replace('.', '\\.') + '([^0-9]|$)').test(text));

await nav();
R.info.katexErrors = await E(`document.querySelectorAll('.katex-error').length`);
if (R.info.katexErrors) fail('KaTeX errors:', R.info.katexErrors);
const sectionNames = await E(`[...document.querySelectorAll('section[data-section]')].map(s=>s.dataset.section)`);
R.info.sections = sectionNames;

/* ---------- screenshots of the untouched page ---------- */
const sweep = async (tag) => {
  for (const name of sectionNames) {
    await E(`document.querySelector('section[data-section="${name}"]').scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-70);0`);
    await shot(`${tag}-${name}`);
  }
};
if (shotsDir) {
  mkdirSync(shotsDir, { recursive: true });
  await sweep('desk');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  await sweep('phone');
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(500);
}

/* ---------- exam problems ---------- */
const nProblems = await E(`document.querySelectorAll('.problem').length`);
if (nProblems !== P.length) fail(`${nProblems} problems on the page, ${P.length} in the source`);
R.info.problemSteps = [];
for (let i = 0; i < nProblems; i++) {
  const r = await E(`(()=>{const b=document.querySelectorAll('.problem')[${i}];const closed=b.querySelectorAll('.step,.step-next').length===0;b.querySelector('.solution .btn').click();const hintFirst=b.querySelectorAll('.step').length===0&&!!b.querySelector('.step-next');const L=__ladder(b);return {closed,hintFirst,...L,left:b.querySelectorAll('.step-next').length}})()`);
  if (!r.closed) fail('problem', i, 'solution is open before it was asked for');
  if (!r.hintFirst) fail('problem', i, 'first hint missing');
  if (r.bad || r.left) fail('problem', i, 'solution steps did not reveal correctly');
  if (r.works.length < 3) warn('problem', i, 'has only', r.works.length, 'steps');
  P[i].forEach((a) => { if (!has(r.works.join(' '), a)) fail('problem', i, 'the answer', a, 'is not in the solution'); });
  P[i].forEach((a) => { if (has(r.hints.join(' '), a)) warn('problem', i, 'a hint mentions the answer', a); });
  const fieldsOk = await E(`(()=>{const b=document.querySelectorAll('.problem')[${i}];const ans=${JSON.stringify(P[i])};const inp=[...b.querySelectorAll('.num-input')];if(inp.length!==ans.length)return 'field count';inp.forEach((x,j)=>{x.value=ans[j]});[...b.querySelectorAll('.btn-primary')].find(x=>!x.closest('.solution')).click();return b.querySelector('.problem-feedback').classList.contains('good')})()`);
  if (fieldsOk !== true) fail('problem', i, 'right answers were not accepted:', fieldsOk);
  R.info.problemSteps.push(r.works.length);
}

/* ---------- quiz: all wrong, then all right ---------- */
const nq = await E(`document.querySelectorAll('.q').length`);
if (nq !== Q.length) fail(`${nq} quiz questions on the page, ${Q.length} in the source`);
R.info.quizSteps = [];
for (let i = 0; i < nq; i++) {
  const q = Q[i];
  const r = await E(`(()=>{const b=document.querySelectorAll('.q')[${i}];const btn=b.querySelector('.btn-primary');const dis0=btn.disabled;
    ${q.t === 'num' ? `const inp=b.querySelector('.num-input');inp.value='99999';inp.dispatchEvent(new Event('input',{bubbles:true}));` : `const o=b.querySelectorAll('.opt');o[(${q.a}+1)%o.length].click();`}
    const dis1=btn.disabled;btn.click();
    const v=b.querySelector('.q-verdict');const leak=b.querySelectorAll('.opt.is-correct').length+(b.querySelector('.q-answer')?1:0);const steps0=b.querySelectorAll('.step').length;const hint0=!!b.querySelector('.step-next');
    const L=__ladder(b);
    return {dis0,dis1,bad:v.classList.contains('bad'),leak,steps0,hint0,works:L.works,hints:L.hints,lbad:L.bad,correctAfter:b.querySelectorAll('.opt.is-correct').length,ansAfter:b.querySelector('.q-answer')?.textContent||''}})()`);
  if (!r.dis0 || r.dis1) fail('quiz', i, 'check button state');
  if (!r.bad) fail('quiz', i, 'a wrong answer was not marked wrong');
  if (r.leak) fail('quiz', i, 'the answer leaked before the last step');
  if (r.steps0 || !r.hint0) fail('quiz', i, 'solution did not open at the first hint');
  if (r.lbad) fail('quiz', i, 'solution steps did not reveal correctly');
  if (r.works.length < 2) fail('quiz', i, 'needs at least 2 steps');
  if (q.t === 'mc' && r.correctAfter !== 1) fail('quiz', i, 'right option not marked after the last step');
  if (q.t === 'num') {
    if (!r.ansAfter) fail('quiz', i, 'no answer line after the last step');
    if (!has(r.works.at(-1), q.a)) fail('quiz', i, 'the last step does not state the answer', q.a);
    if (has(r.hints.join(' '), q.a)) warn('quiz', i, 'a hint mentions the answer', q.a);
  }
  R.info.quizSteps.push(r.works.length);
}
if (!(await E(`!!document.querySelector('.quiz-result')`))) fail('no quiz result after every question was checked');
await E(`[...document.querySelectorAll('.quiz-result .btn')].pop().click()`);
for (let i = 0; i < nq; i++) {
  const q = Q[i];
  const r = await E(`(()=>{const b=document.querySelectorAll('.q')[${i}];const btn=b.querySelector('.btn-primary');
    ${q.t === 'num' ? `const inp=b.querySelector('.num-input');inp.value='${q.a}';inp.dispatchEvent(new Event('input',{bubbles:true}));` : `b.querySelectorAll('.opt')[${q.a}].click();`}
    btn.click();const v=b.querySelector('.q-verdict');const closed=!b.querySelector('.step-next')&&!b.querySelector('.step');b.querySelector('.solution .btn').click();return {good:v.classList.contains('good'),closed,opened:!!b.querySelector('.step-next')}})()`);
  if (!r.good) fail('quiz', i, 'the right answer was not accepted');
  if (!r.closed) fail('quiz', i, 'solution should stay closed after a right answer');
  if (!r.opened) fail('quiz', i, 'start button did not open the solution');
}
R.info.quizStored = await E(`PHY.progress.chapter('${id}').quiz`);
if (R.info.quizStored !== 1) fail('best quiz score was not stored as 1:', R.info.quizStored);

/* ---------- predict cards in real time, first option, with real scrolling ---------- */
R.info.cards = [];
const nCards = await E(`document.querySelectorAll('.predict').length`);
R.info.nCards = nCards;
if (nCards < 6) warn('only', nCards, 'predict cards');
if (!skipCards) for (let i = 0; i < nCards; i++) {
  const pre = await E(`(()=>{const c=document.querySelectorAll('.predict')[${i}];c.scrollIntoView({block:'center',behavior:'instant'});const o=[...c.querySelectorAll('.predict-options .opt')];const run=c.querySelector('.btn-row .btn-primary');const locked=run.disabled;o[0].click();const unlocked=!run.disabled;run.click();return {n:o.length,locked,unlocked}})()`);
  if (!pre.locked || !pre.unlocked) fail('card', i, 'run button is not locked until a choice');
  if (pre.n < 2 || pre.n > 4) warn('card', i, 'has', pre.n, 'options');
  const t0 = Date.now(); let done = false;
  while (Date.now() - t0 < 60000) { await sleep(200); done = await E(`document.querySelectorAll('.predict')[${i}].querySelector('.predict-result').classList.contains('is-open')`); if (done) break; }
  const secs = Math.round((Date.now() - t0) / 100) / 10;
  if (!done) { fail('card', i, 'never revealed: does onRun return a promise that settles?'); continue; }
  if (secs > 16) warn('card', i, 'takes', secs, 's, which is long');
  const r = await E(`(()=>{const R=document.querySelectorAll('.predict')[${i}].querySelector('.predict-result');const steps0=R.querySelectorAll('.step').length;const hint=!!R.querySelector('.step-next');const L=__ladder(R);return {steps0,hint,n:L.works.length,bad:L.bad,left:R.querySelectorAll('.step-next').length}})()`);
  if (r.steps0 || !r.hint) fail('card', i, 'solution missing or not at the first hint');
  if (r.bad || r.left) fail('card', i, 'solution steps did not reveal correctly');
  if (r.n < 2) fail('card', i, 'needs at least 2 steps');
  /* The reveal is a CSS transition, so under machine load it can still be running. Only a clip that lasts is a bug. */
  let clip = 0;
  for (let t = 0; t < 12; t++) {
    await sleep(250);
    clip = await E(`(()=>{const R=document.querySelectorAll('.predict')[${i}].querySelector('.predict-result-in');return R.scrollHeight-R.clientHeight})()`);
    if (clip <= 1) break;
  }
  if (clip > 1) fail('card', i, 'solution is clipped by', clip, 'px');
  R.info.cards.push([r.n, secs]);
}

/* ---------- text after a card opens at the reveal ---------- */
const stillHeld = await E(`document.querySelectorAll('.held').length`);
if (!skipCards && stillHeld) fail(stillHeld, 'elements still held after every card was answered');

/* ---------- symbols must not flip inside Hebrew text: 40° and 7.3×10²² read left to right ---------- */
const flips = await E(`(()=>{const out=[];const w=document.createTreeWalker(document.querySelector('main')||document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(n.parentElement.closest('.katex,script,style'))continue;const re=/\d°|[\d²³]\s?[×·]\s?\d/g;let m;while((m=re.exec(n.data))){const a=m.index,b=m.index+m[0].length-1;const r=document.createRange();r.setStart(n,a);r.setEnd(n,a+1);const d=r.getBoundingClientRect();r.setStart(n,b);r.setEnd(n,b+1);const c=r.getBoundingClientRect();if(d.width&&c.width&&Math.abs(c.top-d.top)<4&&c.left<d.left)out.push(n.data.slice(Math.max(0,a-12),b+6))}}return out})()`);
if (flips.length) fail('symbol flipped in:', JSON.stringify(flips.slice(0, 6)));

/* ---------- 375px with everything open ---------- */
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 2, mobile: true });
await sleep(700);
const phone = await E(`(()=>{const sw=document.documentElement.scrollWidth;const wide=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>376&&!e.closest('.katex-display')&&!e.closest('.step')}).slice(0,6).map(e=>e.tagName+'.'+e.className);const inner=[...document.querySelectorAll('.step')].filter(s=>s.scrollWidth>s.clientWidth+1).length;return {sw,wide,inner}})()`);
R.info.phone = phone;
if (phone.sw > 375) fail('horizontal scroll at 375px:', phone.sw, phone.wide.join(', '));
if (phone.inner) warn(phone.inner, 'solution steps need sideways scrolling at 375px: break long formulas in two');
await send('Emulation.clearDeviceMetricsOverride');
await sleep(500);

/* ---------- passive sections and dark mode ---------- */
for (const name of sectionNames) { await E(`document.querySelector('section[data-section="${name}"]').scrollIntoView({block:'start',behavior:'instant'});0`); await sleep(1250); }
const hash = `(()=>{let n=0;document.querySelectorAll('canvas').forEach(c=>{try{const d=c.getContext('2d');if(!d||!c.width)return;const p=d.getImageData(c.width>>1,2,1,1).data;n=(n*31+p[0]+p[1]*7+p[2]*13)|0}catch(e){}});return n})()`;
await E(`(()=>{const c=document.querySelector('figure.sim canvas');if(c)c.scrollIntoView({block:'center',behavior:'instant'})})()`);
await sleep(300);
const h1 = await E(hash);
await E(`document.querySelector('.icon-btn').click()`);
await sleep(700);
const h2 = await E(hash);
if (h1 === h2) warn('canvas pixels did not change on theme toggle: check that sims recolor');
await E(`document.querySelector('.icon-btn').click()`);

/* ---------- reload keeps progress ---------- */
const before = await E(`JSON.stringify(PHY.progress.chapter('${id}').sections)`);
await nav();
const after = await E(`JSON.stringify(PHY.progress.chapter('${id}').sections)`);
R.info.marked = JSON.parse(after);
const heldAfterReload = await E(`document.querySelectorAll('.held').length`);
if (!skipCards && heldAfterReload) fail(heldAfterReload, 'elements held after a reload, although every card was answered');
R.info.unmarked = sectionNames.filter((s) => !JSON.parse(after).includes(s));
if (before !== after) fail('progress changed on reload');
const totalStored = await E(`PHY.progress.chapter('${id}').total`);
if (totalStored !== sectionNames.length) fail('total sections stored as', totalStored, 'but the page has', sectionNames.length);
finish(R.fails.length ? 1 : 0);

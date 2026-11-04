/* PHY.mascot: ניוטון החתול.
   PHY.mascot.say(text, pose, {duration})   floating companion in the corner, with an RTL speech bubble
   PHY.mascot.mount(host, {pose, text, size}) inline cat with bubble; returns {say, setPose, el}
   PHY.mascot.draw(view, x, y, {pose, h, px, rot, flipX, anchor, alpha})  draw him on a canvas at world coordinates
   PHY.mascot.easterEgg([...]) what clicking the cat does on this page
   <div data-mascot="happy" data-say="..." data-size="120"></div> mounts automatically in PHY.ui.initChapter.
   Poses: standing, falling, flying, dizzy, happy, thinking, onBranch, sliding */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});

  const FUR = '#F4A24A';
  const FUR_DARK = '#D97B26';
  const CREAM = '#FFE7C7';
  const LINE = '#3B2A20';
  const PINK = '#F08A8A';
  const RED = '#D9382E';
  const GREEN = '#3F9B4F';
  const GOLD = '#FFC83D';
  const SW = 5;

  /* ---------- SVG parts ---------- */
  function limb(x1, y1, x2, y2, w) {
    w = w || 14;
    const d = `M${x1} ${y1}L${x2} ${y2}`;
    return `<path d="${d}" stroke="${LINE}" stroke-width="${w + SW * 2}" stroke-linecap="round" fill="none"/>` +
      `<path d="${d}" stroke="${FUR}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  }
  function curveLimb(d, w) {
    w = w || 14;
    return `<path d="${d}" stroke="${LINE}" stroke-width="${w + SW * 2}" stroke-linecap="round" fill="none"/>` +
      `<path d="${d}" stroke="${FUR}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  }
  function tail(d) {
    return `<path d="${d}" stroke="${LINE}" stroke-width="22" stroke-linecap="round" fill="none"/>` +
      `<path d="${d}" stroke="${FUR}" stroke-width="12" stroke-linecap="round" fill="none"/>` +
      `<path d="${d}" stroke="${FUR_DARK}" stroke-width="12" stroke-dasharray="5 15" fill="none"/>`;
  }
  function ell(cx, cy, rx, ry, fill, stroke) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"` +
      (stroke === false ? '' : ` stroke="${LINE}" stroke-width="${SW}"`) + '/>';
  }
  function collar(cx, cy, w, rot) {
    const hw = w / 2;
    return `<g transform="rotate(${rot || 0} ${cx} ${cy})">` +
      `<path d="M${cx - hw} ${cy}Q${cx} ${cy + 11} ${cx + hw} ${cy}" stroke="${LINE}" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      `<path d="M${cx - hw} ${cy}Q${cx} ${cy + 11} ${cx + hw} ${cy}" stroke="${RED}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      apple(cx, cy + 12, 0.62) + '</g>';
  }
  function apple(cx, cy, k) {
    return `<g transform="translate(${cx} ${cy}) scale(${k})">` +
      `<path d="M0 -8C-4 -13 -15 -12 -15 0C-15 10 -7 16 -3 15C-1 14.5 1 14.5 3 15C7 16 15 10 15 0C15 -12 4 -13 0 -8Z" fill="${RED}" stroke="${LINE}" stroke-width="4"/>` +
      `<path d="M0 -9C0 -13 2 -16 5 -17" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M3 -13C7 -19 13 -17 14 -15C10 -11 6 -11 3 -13Z" fill="${GREEN}" stroke="${LINE}" stroke-width="2.5"/></g>`;
  }
  function star(cx, cy, r, fill) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return `<path d="${d}Z" fill="${fill || GOLD}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  function eyes(kind, cx, cy) {
    const L = cx - 18, R = cx + 18, Y = cy - 4;
    const round = (x, y, rx, ry, px, py, pr) =>
      `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${LINE}" stroke-width="3.5"/>` +
      `<circle cx="${x + px}" cy="${y + py}" r="${pr}" fill="${LINE}"/>` +
      `<circle cx="${x + px + pr * 0.35}" cy="${y + py - pr * 0.4}" r="${pr * 0.32}" fill="#fff"/>`;
    switch (kind) {
      case 'wide': return round(L, Y, 12, 14, 0, 1, 4.5) + round(R, Y, 12, 14, 0, 1, 4.5);
      case 'up': return round(L, Y, 10, 12, 3, -4, 5.5) + round(R, Y, 10, 12, 3, -4, 5.5);
      case 'side': return round(L, Y, 10, 12, 3.5, 0, 5.5) + round(R, Y, 10, 12, 3.5, 0, 5.5);
      case 'joy': return `<path d="M${L - 10} ${Y + 4}Q${L} ${Y - 12} ${L + 10} ${Y + 4}M${R - 10} ${Y + 4}Q${R} ${Y - 12} ${R + 10} ${Y + 4}" stroke="${LINE}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      case 'spiral': {
        const sp = (x) => `<path d="M${x} ${Y}c2 -2 5 0 4 3c-1 4 -7 5 -10 1c-3 -5 1 -11 7 -11c7 0 11 7 8 14" stroke="${LINE}" stroke-width="3.2" fill="#fff" stroke-linecap="round"/>`;
        return ell(L, Y, 12, 13, '#fff') + ell(R, Y, 12, 13, '#fff') + sp(L) + sp(R);
      }
      default: return round(L, Y, 10, 12, 0, 0, 5.5) + round(R, Y, 10, 12, 0, 0, 5.5);
    }
  }
  function mouth(kind, cx, y) {
    switch (kind) {
      case 'open': return `<path d="M${cx - 9} ${y + 2}Q${cx} ${y + 22} ${cx + 9} ${y + 2}Z" fill="#8E3B3B" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${cx - 4} ${y + 10}Q${cx} ${y + 7} ${cx + 4} ${y + 10}Q${cx} ${y + 15} ${cx - 4} ${y + 10}Z" fill="${PINK}"/>`;
      case 'o': return ell(cx, y + 8, 6.5, 8, '#8E3B3B');
      case 'wavy': return `<path d="M${cx - 11} ${y + 5}q4 -5 7 0t7 0t7 0" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      case 'hmm': return `<path d="M${cx - 4} ${y + 5}Q${cx + 4} ${y + 2} ${cx + 10} ${y + 6}" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      default: return `<path d="M${cx - 11} ${y + 1}Q${cx - 6} ${y + 8} ${cx} ${y + 2}Q${cx + 6} ${y + 8} ${cx + 11} ${y + 1}" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }
  }
  function head(cx, cy, o) {
    o = o || {};
    const rot = o.rot || 0;
    const k = o.k || 1;
    const earBack = o.earsBack ? 8 : 0;
    const ear = (dir) => {
      const x0 = cx + dir * 22, x1 = cx + dir * (39 + earBack), x2 = cx + dir * 42;
      const y1 = cy - 56 + earBack;
      return `<path d="M${x0} ${cy - 30}L${x1} ${y1}L${x2} ${cy - 12}Z" fill="${FUR}" stroke="${LINE}" stroke-width="${SW}" stroke-linejoin="round"/>` +
        `<path d="M${x0 + dir * 7} ${cy - 28}L${x1 - dir} ${y1 + 13}L${x2 - dir * 3} ${cy - 17}Z" fill="${PINK}"/>`;
    };
    return `<g transform="rotate(${rot} ${cx} ${cy}) translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">` +
      ear(-1) + ear(1) +
      ell(cx, cy, 47, 40, FUR) +
      `<path d="M${cx - 9} ${cy - 39}v12M${cx} ${cy - 40}v15M${cx + 9} ${cy - 39}v12" stroke="${FUR_DARK}" stroke-width="5" stroke-linecap="round"/>` +
      ell(cx, cy + 19, 23, 16, CREAM, false) +
      eyes(o.eyes, cx, cy) +
      `<path d="M${cx - 5} ${cy + 10}H${cx + 5}L${cx} ${cy + 15}Z" fill="${PINK}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>` +
      mouth(o.mouth, cx, cy + 15) +
      `<path d="M${cx - 27} ${cy + 16}L${cx - 54} ${cy + 11}M${cx - 27} ${cy + 22}L${cx - 54} ${cy + 26}M${cx + 27} ${cy + 16}L${cx + 54} ${cy + 11}M${cx + 27} ${cy + 22}L${cx + 54} ${cy + 26}" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round"/>` +
      '</g>';
  }
  function seatedBody(o) {
    o = o || {};
    return ell(66, 171, 20, 15, FUR) + ell(134, 171, 20, 15, FUR) +
      ell(100, 142, 37, 45, FUR) +
      ell(100, 150, 21, 30, CREAM, false) +
      (o.noFront ? '' : limb(84, 132, 83, 176, 12) + limb(116, 132, 117, 176, 12));
  }
  function speedLines(d) {
    return `<path d="${d}" stroke="${LINE}" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.55"/>`;
  }

  /* ---------- Poses (viewBox 0 0 200 200) ---------- */
  const POSES = {
    standing: {
      anchor: [0.5, 0.96],
      svg: () =>
        tail('M134 174C176 178 184 134 160 116') + seatedBody() + collar(100, 100, 44) +
        head(100, 62, {}),
    },
    happy: {
      anchor: [0.5, 0.96],
      svg: () =>
        tail('M134 174C180 176 186 124 170 104') + limb(70, 122, 36, 86, 12) + limb(130, 122, 164, 86, 12) +
        seatedBody({ noFront: true }) + limb(90, 158, 88, 176, 12) + limb(110, 158, 112, 176, 12) +
        collar(100, 100, 44) + head(100, 62, { eyes: 'joy', mouth: 'open' }) +
        star(28, 58, 10) + star(174, 54, 12) + star(160, 26, 7),
    },
    thinking: {
      anchor: [0.5, 0.96],
      svg: () =>
        tail('M134 174C172 182 188 150 172 130') + seatedBody({ noFront: true }) + limb(84, 132, 83, 176, 12) +
        limb(116, 150, 117, 176, 12) +
        collar(100, 100, 44, -5) + head(100, 62, { rot: -7, eyes: 'up', mouth: 'hmm' }) +
        curveLimb('M128 134Q148 116 126 96', 12) +
        `<circle cx="158" cy="42" r="4" fill="#fff" stroke="${LINE}" stroke-width="2.5"/><circle cx="170" cy="28" r="6" fill="#fff" stroke="${LINE}" stroke-width="2.5"/>` +
        `<text x="184" y="19" font-family="Rubik,Arial,sans-serif" font-weight="800" font-size="27" text-anchor="middle" fill="${RED}" stroke="${LINE}" stroke-width="1">?</text>`,
    },
    falling: {
      anchor: [0.5, 0.55],
      svg: () =>
        speedLines('M34 16v30M100 2v14M166 16v30M60 6v18M140 6v18') +
        tail('M122 156C150 150 172 124 172 88') +
        limb(68, 124, 24, 86, 12) + limb(132, 124, 176, 86, 12) +
        limb(84, 162, 50, 188, 13) + limb(116, 162, 150, 188, 13) +
        ell(100, 136, 36, 40, FUR) + ell(100, 142, 20, 26, CREAM, false) +
        collar(100, 102, 40) + head(100, 68, { eyes: 'wide', mouth: 'open', earsBack: true }),
    },
    flying: {
      anchor: [0.5, 0.58],
      svg: () =>
        speedLines('M6 66h24M2 100h18M8 140h24') +
        `<path d="M92 92C60 74 34 76 16 82C30 92 30 100 22 110C44 106 70 112 96 112Z" fill="${RED}" stroke="${LINE}" stroke-width="4.5" stroke-linejoin="round"/>` +
        tail('M46 128C26 134 18 152 28 168') +
        limb(50, 130, 18, 128, 12) +
        limb(62, 142, 34, 156, 12) +
        limb(132, 118, 182, 92, 12) +
        ell(90, 122, 50, 27, FUR) + ell(94, 131, 32, 14, CREAM, false) +
        limb(128, 126, 172, 124, 12) +
        head(134, 72, { k: 0.86, rot: 8, eyes: 'wide', mouth: 'open', earsBack: true }),
    },
    dizzy: {
      anchor: [0.5, 0.96],
      svg: () =>
        tail('M134 174C166 190 192 170 178 148') + seatedBody() + collar(101, 100, 44, 6) +
        head(102, 64, { rot: 11, eyes: 'spiral', mouth: 'wavy' }) +
        `<ellipse cx="102" cy="20" rx="56" ry="13" fill="none" stroke="${LINE}" stroke-width="2.5" stroke-dasharray="5 7"/>` +
        star(50, 21, 10) + star(146, 13, 9, '#FFE27A') + star(112, 32, 8),
    },
    onBranch: {
      anchor: [0.5, 0.15],
      svg: () =>
        `<path d="M2 36C50 24 150 22 198 30" stroke="${LINE}" stroke-width="20" stroke-linecap="round" fill="none"/>` +
        `<path d="M2 36C50 24 150 22 198 30" stroke="#8B5E3C" stroke-width="11" stroke-linecap="round" fill="none"/>` +
        `<path d="M160 22C170 4 190 4 196 8C192 20 176 28 160 22Z" fill="${GREEN}" stroke="${LINE}" stroke-width="3.5"/>` +
        `<path d="M26 26C20 10 6 4 -2 6C-2 18 10 30 26 26Z" fill="${GREEN}" stroke="${LINE}" stroke-width="3.5"/>` +
        tail('M122 164C152 170 168 150 162 126') +
        limb(82, 186, 84, 160, 13) + limb(118, 186, 116, 160, 13) +
        ell(100, 136, 31, 38, FUR) + ell(100, 142, 17, 25, CREAM, false) +
        limb(72, 92, 66, 30, 12) + limb(128, 92, 134, 30, 12) +
        collar(100, 110, 38) + head(100, 76, { eyes: 'wide', mouth: 'o' }),
    },
    sliding: {
      anchor: [0.5, 0.95],
      svg: () =>
        `<path d="M6 190H194" stroke="#86CDE8" stroke-width="7" stroke-linecap="round"/>` +
        speedLines('M4 150h22M2 170h14M14 128h16') +
        `<g transform="rotate(-14 100 130)">` +
        tail('M62 158C34 154 22 128 34 104') +
        limb(74, 118, 32, 90, 12) +
        limb(126, 118, 170, 98, 12) +
        limb(92, 164, 56, 186, 13) +
        limb(122, 164, 152, 182, 13) +
        ell(100, 136, 36, 40, FUR) + ell(100, 143, 20, 26, CREAM, false) +
        collar(100, 102, 40) + head(100, 66, { eyes: 'side', mouth: 'open' }) +
        `</g>`,
    },
  };

  function svgString(pose, attrs) {
    const def = POSES[pose] || POSES.standing;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" ${attrs || ''}>${def.svg()}</svg>`;
  }

  /* ---------- Canvas drawing ---------- */
  const images = {};
  function image(pose) {
    if (!images[pose]) {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString(pose));
      images[pose] = img;
    }
    return images[pose];
  }
  Object.keys(POSES).forEach(image);

  /* (x, y) is the anchor point in world meters. Feet for seated poses, center for flying poses, the
     branch for onBranch. Size: h = height in meters or px = height in pixels (default 64 px). */
  function draw(view, x, y, o) {
    o = o || {};
    const pose = POSES[o.pose] ? o.pose : 'standing';
    const img = image(pose);
    if (!img.complete || !img.naturalWidth) return;
    const size = o.px || (o.h ? o.h * view.scale : 64);
    const a = o.anchor || POSES[pose].anchor;
    const ctx = view.ctx;
    ctx.save();
    ctx.translate(view.sx(x), view.sy(y));
    if (o.rot) ctx.rotate((-o.rot * Math.PI) / 180);
    if (o.flipX) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, -a[0] * size, -a[1] * size, size, size);
    ctx.restore();
  }

  /* ---------- DOM cat ---------- */
  function figure(pose, size) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mascot-figure';
    b.setAttribute('aria-label', 'ניוטון החתול');
    if (size) b.style.setProperty('--mascot-size', size + 'px');
    b.innerHTML = svgString(pose, 'aria-hidden="true"');
    b.dataset.pose = pose;
    b.addEventListener('click', function () { poke(b); });
    return b;
  }
  function setFigurePose(fig, pose) {
    if (pose && POSES[pose] && fig.dataset.pose !== pose) {
      fig.innerHTML = svgString(pose, 'aria-hidden="true"');
      fig.dataset.pose = pose;
    }
  }

  function mount(host, o) {
    o = o || {};
    host.classList.add('mascot-inline');
    const fig = figure(o.pose || 'standing', o.size || 120);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.setAttribute('aria-live', 'polite');
    bubble.textContent = o.text || '';
    host.innerHTML = '';
    host.appendChild(fig);
    host.appendChild(bubble);
    const inst = {
      el: host,
      figure: fig,
      setPose(p) { setFigurePose(fig, p); },
      say(text, pose) {
        if (pose) setFigurePose(fig, pose);
        bubble.textContent = text;
        bubble.classList.remove('is-new');
        void bubble.offsetWidth;
        bubble.classList.add('is-new');
      },
    };
    fig._inst = inst;
    return inst;
  }

  function autoMount(root) {
    (root || document).querySelectorAll('[data-mascot]').forEach(function (el) {
      if (el.dataset.mounted) return;
      el.dataset.mounted = '1';
      mount(el, { pose: el.dataset.mascot, text: el.dataset.say || '', size: el.dataset.size ? +el.dataset.size : undefined });
    });
  }

  /* ---------- Floating companion ---------- */
  let dock = null, dockBubble = null, dockFig = null, hideTimer = 0, restPose = 'standing';
  function ensureDock() {
    if (dock) return;
    dock = document.createElement('div');
    dock.className = 'mascot-dock';
    dock.setAttribute('dir', 'rtl');
    dockBubble = document.createElement('div');
    dockBubble.className = 'bubble';
    dockBubble.setAttribute('role', 'status');
    dockBubble.setAttribute('aria-live', 'polite');
    dockBubble.addEventListener('click', hide);
    dockFig = figure('standing');
    dock.appendChild(dockBubble);
    dock.appendChild(dockFig);
    document.body.appendChild(dock);
  }
  function hide() {
    if (!dock) return;
    clearTimeout(hideTimer);
    dock.classList.remove('is-talking');
    setFigurePose(dockFig, restPose);
  }
  /* Bubble stays for a time that depends on the text length (or opts.duration in ms). */
  function say(text, pose, opts) {
    ensureDock();
    opts = opts || {};
    clearTimeout(hideTimer);
    setFigurePose(dockFig, pose || 'standing');
    dockBubble.textContent = text;
    dock.classList.add('is-talking');
    const ms = opts.duration || Math.max(2800, Math.min(8000, 1400 + String(text).length * 62));
    hideTimer = setTimeout(hide, ms);
  }

  /* ---------- Easter egg ---------- */
  let eggSteps = null, eggCount = 0;
  function easterEgg(steps) {
    eggSteps = steps;
    eggCount = 0;
    ensureDock();
  }
  function poke(fig) {
    fig.classList.remove('is-hop', 'is-spin');
    void fig.offsetWidth;
    if (!eggSteps || !eggSteps.length) {
      fig.classList.add('is-hop');
      say('מיאו.', 'happy');
      return;
    }
    const entry = eggSteps[Math.min(eggCount, eggSteps.length - 1)];
    const cycleEnd = eggCount >= eggSteps.length - 1;
    eggCount = cycleEnd ? 0 : eggCount + 1;
    fig.classList.add(entry.spin ? 'is-spin' : 'is-hop');
    if (entry.text) say(entry.text, entry.pose || 'standing');
    if (entry.rain) appleRain();
    if (entry.action) entry.action();
  }
  function appleRain() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'apple-rain';
    box.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let i = 0; i < 26; i++) {
      const left = (Math.random() * 100).toFixed(1);
      const dur = (1.5 + Math.random() * 1.6).toFixed(2);
      const delay = (Math.random() * 0.9).toFixed(2);
      const spin = Math.round((Math.random() - 0.5) * 900);
      html += `<svg viewBox="-20 -22 40 42" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;--spin:${spin}deg">${apple(0, 0, 1)}</svg>`;
    }
    box.innerHTML = html;
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 4200);
  }

  PHY.mascot = {
    POSES: Object.keys(POSES),
    svg: svgString,
    image, draw, figure, mount, autoMount, say, hide, easterEgg, appleRain,
    setRest(p) { restPose = p; },
  };
})();

/* PHY.sims.orbit3d: Earth in Three.js, with orbit tracks and the cat as a satellite. DOM-based: the first argument
   is a host <div>. Nothing here is required for the chapter: if WebGL or the CDN is missing, the host shows a
   Hebrew note pointing at the 2D playground. Three.js r128 (the last build with a window.THREE global) is
   injected only when the host scrolls near view. SimLoop pauses rendering offscreen.
   stop() disposes everything and start() rebuilds it.
   opts: {r (in R), inclination (degrees), threeUrl}. setParam: r, inclination. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, G = PHY.grav;
  const R = G.R;
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const LOAD_TIMEOUT = 15000;
  const RAD = Math.PI / 180;
  let threePromise = null;

  function loadThree(url) {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (url === THREE_URL && threePromise) return threePromise;
    const p = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.crossOrigin = 'anonymous';
      let settled = false;
      const t0 = performance.now();
      /* A hung connection must also fall back. A frame check, so nothing here needs a timer. */
      (function watch() {
        if (settled) return;
        if (performance.now() - t0 > LOAD_TIMEOUT) { settled = true; reject(new Error('three.js timeout')); return; }
        requestAnimationFrame(watch);
      })();
      s.onload = function () {
        settled = true;
        if (window.THREE) resolve(window.THREE);
        else reject(new Error('three.js loaded without a global'));
      };
      s.onerror = function () { settled = true; reject(new Error('three.js failed to load')); };
      document.head.appendChild(s);
    });
    if (url === THREE_URL) {
      threePromise = p;
      p.catch(function () { threePromise = null; });
    }
    return p;
  }

  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /* A cartoon world map on a canvas: the same style as the 2D Earth. */
  function earthTexture(T) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = 'rgb(66, 134, 214)';
    x.fillRect(0, 0, 1024, 512);
    const blob = function (pts, color) {
      x.beginPath();
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (i === 0) x.moveTo(mx, my);
        const d = pts[(i + 2) % n];
        x.quadraticCurveTo(b[0], b[1], (b[0] + d[0]) / 2, (b[1] + d[1]) / 2);
      }
      x.closePath();
      x.fillStyle = color;
      x.fill();
    };
    const land = 'rgb(92, 176, 96)';
    blob([[90, 90], [240, 70], [300, 130], [240, 200], [190, 250], [130, 200], [70, 150]], land);
    blob([[220, 260], [300, 290], [290, 370], [245, 450], [215, 370]], land);
    blob([[460, 90], [560, 70], [760, 70], [900, 120], [840, 210], [720, 240], [640, 200], [560, 180], [470, 160]], land);
    blob([[470, 190], [580, 200], [610, 290], [560, 400], [510, 390], [490, 300], [440, 240]], land);
    blob([[790, 320], [880, 310], [900, 380], [810, 390]], land);
    x.fillStyle = 'rgb(240, 246, 252)';
    x.fillRect(0, 0, 1024, 24);
    x.fillRect(0, 488, 1024, 24);
    return new T.CanvasTexture(c);
  }

  function catTexture(T) {
    const img = PHY.mascot.image('flying');
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const tex = new T.CanvasTexture(c);
    const paint = function () {
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      tex.needsUpdate = true;
    };
    if (img.complete && img.naturalWidth) paint();
    else img.addEventListener('load', paint, { once: true });
    return tex;
  }

  /* A point on a tilted circular orbit, in units of R. y is up, the equator is the xz plane. */
  function orbitPoint(r, incl, theta) {
    const i = incl * RAD;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) * Math.sin(i), z: r * Math.sin(theta) * Math.cos(i) };
  }

  PHY.sims.orbit3d = function (host, controlsEl, opts) {
    opts = Object.assign({ r: 1.6, inclination: 35, threeUrl: THREE_URL }, opts || {});
    const stage = U.h('div', { class: 'c3d-stage' });
    const status = U.h('div', { class: 'c3d-status', role: 'status', text: 'התצוגה התלת-ממדית תיטען כשמגיעים אליה...' });
    stage.appendChild(status);
    host.appendChild(stage);

    const S = {
      r: opts.r, incl: opts.inclination, theta: 0, clock: 0, yaw: 0.7, pitch: 0.42, dist: 5.2, state: 'idle', frames: 0, wanted: false, failReason: null,
      accel: 1, dragging: false, dragX: 0, dragY: 0,
    };
    let R3 = null;
    let observer = null;

    const rSlider = U.Slider(controlsEl, {
      label: 'מרחק מהמרכז', min: 1.05, max: 7, step: 0.01, value: S.r, format: (v) => G.km(v * R), color: 'var(--c-displacement)',
      onInput(v) { S.r = v; orbitChanged(); },
    });
    const iSlider = U.Slider(controlsEl, {
      label: 'הטיית המסלול מקו המשווה', min: 0, max: 90, step: 1, value: S.incl, format: (v) => G.deg(v), color: 'var(--accent)',
      onInput(v) { S.incl = v; orbitChanged(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    U.Button(row, 'נמוך', function () { api.setParam('r', 1.0625); api.setParam('inclination', 52); }, { ghost: true });
    U.Button(row, 'קוטבי', function () { api.setParam('r', 1.6); api.setParam('inclination', 90); }, { ghost: true });
    U.Button(row, 'גיאוסטציונרי', function () { api.setParam('r', 6.66); api.setParam('inclination', 0); }, { ghost: true });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 'v', label: 'מהירות', color: 'var(--c-velocity)' },
      { key: 'T', label: 'זמן הקפה' },
      { key: 'g', label: 'g שם', color: 'var(--c-acceleration)' },
    ]);
    const controlsWrap = [rSlider.el, iSlider.el, row, out.el];

    function fallback(reason) {
      S.state = 'failed';
      S.failReason = reason;
      teardown();
      stage.innerHTML = '';
      stage.classList.add('is-fallback');
      const note = U.h('div', { class: 'c3d-fallback' });
      PHY.mascot.mount(note, { pose: 'thinking', size: 84, text: 'התצוגה התלת-ממדית לא נטענה כאן. היא צריכה WebGL וחיבור לאינטרנט.' });
      note.appendChild(U.h('p', { html: 'לא מפסידים שום פיזיקה: אלה אותם מסלולים כמו ב<a href="#playground">מגרש המסלולים</a> שבהמשך. שאר הפרק עובד כרגיל.' }));
      stage.appendChild(note);
      controlsWrap.forEach(function (el) { el.hidden = true; });
    }

    function makeTrack(T, r, incl, mat) {
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const p = orbitPoint(r, incl, (i / 160) * G.TAU);
        pts.push(new T.Vector3(p.x, p.y, p.z));
      }
      const geo = new T.BufferGeometry().setFromPoints(pts);
      return new T.Line(geo, mat);
    }

    function build(T) {
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(45, 16 / 9, 0.05, 200);
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute('aria-label', 'הדמיה תלת-ממדית של כדור הארץ ומסלולים סביבו');
      renderer.domElement.style.touchAction = 'pan-y';
      const r = { T, scene, camera, renderer, textures: [], dots: [] };

      scene.add(new T.HemisphereLight(0xffffff, 0x8899bb, 0.75));
      const sun = new T.DirectionalLight(0xffffff, 0.65);
      sun.position.set(6, 4, 5);
      scene.add(sun);

      /* Earth */
      const tex = earthTexture(T);
      r.textures.push(tex);
      r.earth = new T.Mesh(new T.SphereGeometry(1, 48, 32), new T.MeshLambertMaterial({ map: tex }));
      scene.add(r.earth);
      r.atmo = new T.Mesh(new T.SphereGeometry(1.035, 40, 28), new T.MeshBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.16, depthWrite: false }));
      scene.add(r.atmo);

      /* Two fixed tracks, for comparison: low and polar */
      r.fixedMat = new T.LineBasicMaterial({ color: 0xffffff });
      const dotGeo = new T.SphereGeometry(0.035, 10, 8);
      r.dotMat = new T.MeshBasicMaterial({ color: 0xffffff });
      [{ r: 1.0625, i: 52, a: 0 }, { r: 1.6, i: 90, a: 2 }].forEach(function (d) {
        scene.add(makeTrack(T, d.r, d.i, r.fixedMat));
        const m = new T.Mesh(dotGeo, r.dotMat);
        scene.add(m);
        r.dots.push({ m, r: d.r, i: d.i, a: d.a });
      });

      /* The cat's own orbit */
      r.trackMat = new T.LineBasicMaterial({ color: 0xffffff });
      r.track = makeTrack(T, S.r, S.incl, r.trackMat);
      scene.add(r.track);
      r.catTex = catTexture(T);
      r.textures.push(r.catTex);
      r.catMat = new T.SpriteMaterial({ map: r.catTex, transparent: true, alphaTest: 0.02, depthTest: true });
      r.cat = new T.Sprite(r.catMat);
      scene.add(r.cat);
      r.vArrow = new T.ArrowHelper(new T.Vector3(1, 0, 0), new T.Vector3(0, 0, 0), 0.5, 0xffffff, 0.12, 0.07);
      r.aArrow = new T.ArrowHelper(new T.Vector3(1, 0, 0), new T.Vector3(0, 0, 0), 0.4, 0xffffff, 0.1, 0.06);
      scene.add(r.vArrow);
      scene.add(r.aArrow);

      r.onContextLost = function (e) {
        e.preventDefault();
        if (S.state !== 'failed' && R3) fallback('context lost');
      };
      renderer.domElement.addEventListener('webglcontextlost', r.onContextLost);

      /* Dragging turns the view. Vertical touch stays with the page. */
      const el = renderer.domElement;
      el.addEventListener('pointerdown', function (e) { S.dragging = true; S.dragX = e.clientX; S.dragY = e.clientY; });
      el.addEventListener('pointermove', function (e) {
        if (!S.dragging) return;
        S.yaw -= (e.clientX - S.dragX) * 0.008;
        if (e.pointerType === 'mouse') S.pitch = Math.max(-1.3, Math.min(1.3, S.pitch + (e.clientY - S.dragY) * 0.006));
        S.dragX = e.clientX;
        S.dragY = e.clientY;
      });
      const stopDrag = function () { S.dragging = false; };
      el.addEventListener('pointerup', stopDrag);
      el.addEventListener('pointercancel', stopDrag);
      el.addEventListener('pointerleave', stopDrag);

      stage.appendChild(el);
      return r;
    }

    function paintTheme() {
      if (!R3) return;
      const T = R3.T;
      R3.scene.background = new T.Color(C.bg);
      R3.fixedMat.color.set(C.soft);
      R3.dotMat.color.set(C.gold);
      R3.trackMat.color.set(C.accent);
      R3.vArrow.setColor(new T.Color(C.velocity));
      R3.aArrow.setColor(new T.Color(C.acceleration));
    }

    function resize() {
      if (!R3) return;
      const w = stage.clientWidth || 320;
      const h = Math.max(260, Math.min(470, Math.round(w / 1.6)));
      stage.style.height = h + 'px';
      R3.renderer.setSize(w, h);
      R3.camera.aspect = w / h;
      R3.camera.updateProjectionMatrix();
    }

    function orbitChanged() {
      if (R3) {
        const T = R3.T;
        R3.track.geometry.dispose();
        const fresh = makeTrack(T, S.r, S.incl, R3.trackMat);
        R3.track.geometry = fresh.geometry;
      }
    }

    function clockSpeed() {
      /* The cat's lap takes 5 to 12 s on screen, on one clock for everything. */
      const T = G.period(S.r * R);
      return T / Math.max(5, Math.min(12, 5 + (S.r - 1) * 1.2));
    }

    function step(dt) {
      S.accel = clockSpeed();
      const sim = dt * S.accel;
      S.clock += sim;
      S.theta += (sim / G.period(S.r * R)) * G.TAU;
      if (!S.dragging && S.state === 'ready') S.yaw += dt * 0.02;
    }

    function render() {
      if (!R3) return;
      const T = R3.T;
      /* Earth turns once per 24 h on the same clock, the right way round. */
      R3.earth.rotation.y = (S.clock / 86400) * G.TAU;

      R3.dots.forEach(function (d) {
        const th = d.a + (S.clock / G.period(d.r * R)) * G.TAU;
        const p = orbitPoint(d.r, d.i, -th);
        d.m.position.set(p.x, p.y, p.z);
        d.m.visible = S.accel < 3500;
      });

      const p = orbitPoint(S.r, S.incl, -S.theta);
      const size = 0.55 + S.r * 0.05;
      R3.cat.position.set(p.x, p.y, p.z);
      R3.cat.scale.set(size, size, 1);
      /* Velocity: along the track. Acceleration: to the center. */
      const q = orbitPoint(S.r, S.incl, -S.theta - 0.02);
      const dir = new T.Vector3(q.x - p.x, q.y - p.y, q.z - p.z).normalize();
      R3.vArrow.position.set(p.x, p.y, p.z);
      R3.vArrow.setDirection(dir);
      const vv = G.vCirc(S.r * R) / 8000;
      R3.vArrow.setLength(0.25 + vv * 0.55 * (1 + S.r * 0.06), 0.13, 0.08);
      const inward = new T.Vector3(-p.x, -p.y, -p.z).normalize();
      R3.aArrow.position.set(p.x, p.y, p.z);
      R3.aArrow.setDirection(inward);
      R3.aArrow.setLength(Math.max(0.2, 0.6 * Math.min(1, 1 / (S.r * S.r)) + 0.15), 0.11, 0.07);

      S.dist += (Math.max(4.6, S.r * 2.5) - S.dist) * 0.06;
      const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
      R3.camera.position.set(S.dist * cp * Math.sin(S.yaw), S.dist * sp, S.dist * cp * Math.cos(S.yaw));
      R3.camera.lookAt(0, 0, 0);

      R3.renderer.render(R3.scene, R3.camera);
      S.frames++;

      out.set('v', G.kms(G.vCirc(S.r * R), 2));
      out.set('T', G.dur(G.period(S.r * R)));
      out.set('g', F.unit(G.gAt(S.r * R), 'מ/ש²', 2));
    }

    const loop = PHY.SimLoop({ canvas: stage, step, render });
    document.addEventListener('phy:theme', paintTheme);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(function () { resize(); }) : null;
    if (ro) ro.observe(stage);

    function teardown() {
      loop.stop();
      if (!R3) return;
      const r = R3;
      R3 = null;
      r.renderer.domElement.removeEventListener('webglcontextlost', r.onContextLost);
      const geos = new Set(), mats = new Set();
      r.scene.traverse(function (o) {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { mats.add(m); });
      });
      geos.forEach(function (g) { g.dispose(); });
      mats.forEach(function (m) { m.dispose(); });
      r.textures.forEach(function (t) { t.dispose(); });
      r.renderer.dispose();
      if (r.renderer.forceContextLoss) r.renderer.forceContextLoss();
      if (r.renderer.domElement.parentNode) r.renderer.domElement.parentNode.removeChild(r.renderer.domElement);
    }

    function init() {
      if (S.state === 'loading' || S.state === 'ready' || S.state === 'failed') return;
      if (!webglAvailable()) { fallback('no webgl'); return; }
      S.state = 'loading';
      status.textContent = 'טוענים תלת-ממד...';
      loadThree(opts.threeUrl).then(function (T) {
        if (!S.wanted) { S.state = 'idle'; return; }
        try {
          R3 = build(T);
          paintTheme();
          resize();
          status.hidden = true;
          S.state = 'ready';
          loop.start();
        } catch (e) {
          console.warn('orbit3d', e);
          fallback(String(e));
        }
      }).catch(function (e) {
        console.warn('orbit3d', e);
        fallback(String(e));
      });
    }

    function watch() {
      if (observer || S.state === 'failed') return;
      if (!('IntersectionObserver' in window)) { init(); return; }
      observer = new IntersectionObserver(function (entries) {
        if (entries[entries.length - 1].isIntersecting) {
          observer.disconnect();
          observer = null;
          if (S.wanted) init();
        }
      }, { rootMargin: '200px' });
      observer.observe(stage);
    }

    const api = {
      /* Arms the lazy load. Nothing is fetched until the host is near the viewport. */
      start() {
        S.wanted = true;
        if (S.state === 'ready') { loop.start(); return; }
        watch();
      },
      /* Frees the GPU. start() builds it all again. */
      stop() {
        S.wanted = false;
        if (observer) { observer.disconnect(); observer = null; }
        if (S.state === 'failed') return;
        teardown();
        S.state = 'idle';
        status.hidden = false;
        status.textContent = 'התצוגה התלת-ממדית נעצרה.';
      },
      reset() { S.theta = 0; S.clock = 0; },
      setParam(name, v) {
        if (name === 'r') { S.r = v; rSlider.set(v); orbitChanged(); }
        if (name === 'inclination') { S.incl = v; iSlider.set(v); orbitChanged(); }
      },
      getState() {
        const T = G.period(S.r * R);
        return {
          state: S.state, failReason: S.failReason, r: S.r, inclination: S.incl, theta: S.theta, clock: S.clock, T, v: G.vCirc(S.r * R), g: G.gAt(S.r * R),
          frames: S.frames, hasThree: !!window.THREE, built: !!R3, accel: S.accel, lap: S.theta / G.TAU, earthTurns: S.clock / 86400,
        };
      },
    };
    let stoppedByPagehide = false;
    window.addEventListener('pagehide', function () {
      if (S.state === 'ready') { stoppedByPagehide = true; api.stop(); }
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && stoppedByPagehide) { stoppedByPagehide = false; api.start(); }
    });
    return api;
  };
})();

/* PHY.sims.cannon3d: the same flight in Three.js, with the camera chasing the cat. DOM-based: the first
   argument is a host <div>. Nothing here is required for the chapter: if WebGL or the CDN is missing the
   host shows a Hebrew note pointing at the 2D playground.
   Three.js r128 (the last build with a window.THREE global) is injected only when the host scrolls near view.
   SimLoop pauses rendering offscreen. stop() disposes everything and start() rebuilds it.
   opts: {angle, speed, threeUrl}. sim.fire() -> Promise. setParam: angle, speed, follow. */
(function () {
  'use strict';
  const PHY = window.PHY;
  const F = PHY.fmt, U = PHY.ui, C = PHY.colors, B = PHY.ballistics;
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const LOAD_TIMEOUT = 15000;
  let threePromise = null;

  function loadThree(url) {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (url === THREE_URL && threePromise) return threePromise;
    const p = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.crossOrigin = 'anonymous';
      const timer = setTimeout(function () { reject(new Error('three.js timeout')); }, LOAD_TIMEOUT);
      s.onload = function () {
        clearTimeout(timer);
        if (window.THREE) resolve(window.THREE);
        else reject(new Error('three.js loaded without a global'));
      };
      s.onerror = function () { clearTimeout(timer); reject(new Error('three.js failed to load')); };
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

  /* A flat label that always faces the camera. */
  function labelTexture(T, text) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.92)';
    x.strokeStyle = 'rgba(42,36,51,0.6)';
    x.lineWidth = 3;
    x.beginPath();
    if (x.roundRect) x.roundRect(4, 8, 120, 48, 20); else x.rect(4, 8, 120, 48);
    x.fill();
    x.stroke();
    x.fillStyle = '#2A2433';
    x.font = '700 30px Heebo, Rubik, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if ('direction' in x) x.direction = 'rtl';
    x.fillText(text, 64, 33);
    return new T.CanvasTexture(c);
  }

  function catTexture(T, pose) {
    const img = PHY.mascot.image(pose);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const tex = new T.CanvasTexture(c);
    const paint = function () {
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      tex.needsUpdate = true;
    };
    if (img.complete && img.naturalWidth) paint();
    else img.addEventListener('load', paint, { once: true });
    return tex;
  }

  PHY.sims.cannon3d = function (host, controlsEl, opts) {
    opts = Object.assign({ angle: 45, speed: 20, threeUrl: THREE_URL }, opts || {});
    const stage = U.h('div', { class: 'c3d-stage' });
    const status = U.h('div', { class: 'c3d-status', role: 'status', text: 'התצוגה התלת-ממדית תיטען כשתגיע אליה...' });
    stage.appendChild(status);
    host.appendChild(stage);

    const S = {
      a: opts.angle, v: opts.speed, follow: true, t: 0, flying: false, landed: false, resolve: null,
      state: 'idle', frames: 0, wanted: false, stamps: 0,
    };
    let R = null; /* everything Three.js lives here; null means disposed */
    let observer = null;

    const angSlider = U.Slider(controlsEl, {
      label: 'זווית', min: 5, max: 85, step: 1, value: S.a, format: (v) => F.deg(v), color: 'var(--accent)',
      onInput(v) { S.a = v; aimChanged(); },
    });
    const speedSlider = U.Slider(controlsEl, {
      label: 'מהירות', min: 5, max: 25, step: 1, value: S.v, unit: 'ms', digits: 0, color: 'var(--c-velocity)',
      onInput(v) { S.v = v; aimChanged(); },
    });
    const row = U.h('div', { class: 'sim-row' });
    const fireBtn = U.Button(row, 'שגר!', function () { api.fire(); }, { primary: true });
    const followToggle = U.Toggle(row, 'מצלמה רודפת אחרי ניוטון', {
      value: true,
      onChange(v) { S.follow = v; },
    });
    controlsEl.appendChild(row);
    const out = U.Readouts(controlsEl, [
      { key: 't', label: 'זמן' },
      { key: 'x', label: 'מרחק', color: 'var(--c-displacement)' },
      { key: 'y', label: 'גובה', color: 'var(--c-displacement)' },
      { key: 'vx', label: 'מהירות אופקית', color: 'var(--c-velocity)' },
      { key: 'vy', label: 'מהירות אנכית', color: 'var(--c-velocity)' },
    ]);
    const controlsWrap = [angSlider.el, speedSlider.el, row, out.el];

    function fallback(reason) {
      S.state = 'failed';
      S.failReason = reason;
      teardown();
      stage.innerHTML = '';
      stage.classList.add('is-fallback');
      const note = U.h('div', { class: 'c3d-fallback' });
      PHY.mascot.mount(note, { pose: 'thinking', size: 84, text: 'התצוגה התלת-ממדית לא נטענה אצלך. היא צריכה WebGL וחיבור לאינטרנט.' });
      note.appendChild(U.h('p', { html: 'לא הפסדת שום פיזיקה: זו בדיוק אותה טיסה כמו ב<a href="#playground">מגרש התותחים</a> שמעל. שאר הפרק עובד כרגיל.' }));
      stage.appendChild(note);
      controlsWrap.forEach(function (el) { el.hidden = true; });
    }

    function pathPoints(T) {
      const pts = [];
      const N = 80;
      const end = B.flightTime(S.v, S.a);
      for (let i = 0; i <= N; i++) {
        const p = B.at(S.v, S.a, (end * i) / N);
        pts.push(new T.Vector3(p.x, Math.max(0.03, p.y), 0));
      }
      return pts;
    }

    function build(T) {
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(50, 16 / 9, 0.1, 800);
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute('aria-label', 'הדמיה תלת-ממדית של ניוטון נורה מתותח');
      const r = { T, scene, camera, renderer, textures: [], labels: [], strobes: [], camPos: new T.Vector3(), camLook: new T.Vector3() };

      scene.add(new T.HemisphereLight(0xffffff, 0x888866, 0.7));
      const sun = new T.DirectionalLight(0xffffff, 0.45);
      sun.position.set(-30, 60, 40);
      scene.add(sun);

      /* Ground and grid. Colors are applied by paintTheme, so a theme change just recolors them. */
      r.groundMat = new T.MeshLambertMaterial({ color: 0xffffff });
      const ground = new T.Mesh(new T.PlaneGeometry(700, 300), r.groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(100, 0, 0);
      scene.add(ground);
      r.grid = new T.GridHelper(300, 30, 0x888888, 0x888888);
      r.grid.position.set(100, 0.02, 0);
      scene.add(r.grid);

      /* The firing line along x */
      r.lineMat = new T.LineBasicMaterial({ color: 0xffffff });
      const axisGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(-20, 0.06, 0), new T.Vector3(220, 0.06, 0)]);
      scene.add(new T.Line(axisGeo, r.lineMat));

      /* Trees, for a sense of speed when the camera moves. Only behind the firing line, so none
         of them ever stands between the camera and the cat. */
      const trunkGeo = new T.CylinderGeometry(0.35, 0.5, 3, 7);
      const crownGeo = new T.ConeGeometry(2, 5.5, 8);
      const trunkMat = new T.MeshLambertMaterial({ color: 0x8b5e3c });
      r.crownMat = new T.MeshLambertMaterial({ color: 0xffffff });
      for (let i = 0; i < 44; i++) {
        const tx = -14 + i * 3.1 + ((i * 37) % 7) - 3;
        const tz = -(7 + ((i * 53) % 30));
        const k = 0.8 + ((i * 17) % 7) / 10;
        const trunk = new T.Mesh(trunkGeo, trunkMat);
        trunk.position.set(tx, 1.5 * k, tz);
        trunk.scale.setScalar(k);
        const crown = new T.Mesh(crownGeo, r.crownMat);
        crown.position.set(tx, 5.2 * k, tz);
        crown.scale.setScalar(k);
        scene.add(trunk);
        scene.add(crown);
      }

      /* Distance signs */
      for (let m = 10; m <= 60; m += 10) {
        const tex = labelTexture(T, F.unit(m, 'm', 0));
        r.textures.push(tex);
        const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: true }));
        sp.scale.set(5, 2.5, 1);
        sp.position.set(m, 1.4, -3.5);
        scene.add(sp);
      }

      /* The cannon */
      r.cannon = new T.Group();
      r.barrelMat = new T.MeshLambertMaterial({ color: 0x555566 });
      const baseGeo = new T.SphereGeometry(1.1, 16, 12);
      r.cannon.add(new T.Mesh(baseGeo, r.barrelMat));
      r.barrel = new T.Group();
      const barrelMesh = new T.Mesh(new T.CylinderGeometry(0.5, 0.65, 3.4, 16), r.barrelMat);
      barrelMesh.rotation.z = -Math.PI / 2; /* the cylinder's axis along +x */
      barrelMesh.position.x = 1.6;
      r.barrel.add(barrelMesh);
      r.cannon.add(r.barrel);
      scene.add(r.cannon);

      /* Newton, as a sprite with the same drawing as everywhere else */
      r.texFly = catTexture(T, 'flying');
      r.texStand = catTexture(T, 'happy');
      r.textures.push(r.texFly, r.texStand);
      r.catMat = new T.SpriteMaterial({ map: r.texFly, transparent: true, alphaTest: 0.02 });
      r.cat = new T.Sprite(r.catMat);
      r.cat.scale.set(3.4, 3.4, 1);
      scene.add(r.cat);

      /* His shadow on the floor: the chapter's x shadow, in 3D. */
      r.shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
      r.shadow = new T.Mesh(new T.CircleGeometry(0.9, 24), r.shadowMat);
      r.shadow.rotation.x = -Math.PI / 2;
      r.shadow.position.y = 0.05;
      scene.add(r.shadow);

      /* Dashed preview of the path */
      r.previewMat = new T.LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: 0.8 });
      r.preview = new T.Line(new T.BufferGeometry(), r.previewMat);
      scene.add(r.preview);

      /* The trail, drawn as far as he has flown */
      r.trailMat = new T.LineBasicMaterial({ color: 0xffffff });
      const MAX = 800;
      r.trailPos = new Float32Array(MAX * 3);
      r.trailGeo = new T.BufferGeometry();
      r.trailGeo.setAttribute('position', new T.BufferAttribute(r.trailPos, 3));
      r.trailGeo.setDrawRange(0, 0);
      r.trail = new T.Line(r.trailGeo, r.trailMat);
      r.trail.frustumCulled = false;
      r.trailN = 0;
      r.trailMax = MAX;
      scene.add(r.trail);

      /* Strobe beads every 0.25 s */
      const beadGeo = new T.SphereGeometry(0.28, 10, 8);
      r.beadMat = new T.MeshLambertMaterial({ color: 0xffffff });
      for (let i = 0; i < 40; i++) {
        const b = new T.Mesh(beadGeo, r.beadMat);
        b.visible = false;
        scene.add(b);
        r.strobes.push(b);
      }

      /* Landing ring */
      r.ringMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
      r.ring = new T.Mesh(new T.RingGeometry(1.1, 1.5, 32), r.ringMat);
      r.ring.rotation.x = -Math.PI / 2;
      r.ring.position.y = 0.07;
      scene.add(r.ring);

      /* Velocity arrow, in the chapter's blue */
      r.arrow = new T.ArrowHelper(new T.Vector3(1, 0, 0), new T.Vector3(0, 0, 0), 5, 0xffffff, 1, 0.6);
      scene.add(r.arrow);

      r.onContextLost = function (e) {
        e.preventDefault();
        if (S.state !== 'failed' && R) fallback('context lost');
      };
      renderer.domElement.addEventListener('webglcontextlost', r.onContextLost);
      stage.appendChild(renderer.domElement);
      return r;
    }

    function paintTheme() {
      if (!R) return;
      const T = R.T;
      R.scene.background = new T.Color(C.bg);
      R.scene.fog = new T.Fog(new T.Color(C.bg).getHex(), 90, 300);
      R.groundMat.color.set(C.grid);
      const mats = Array.isArray(R.grid.material) ? R.grid.material : [R.grid.material];
      mats.forEach(function (m) { m.color.set(C.gridStrong); m.vertexColors = false; m.needsUpdate = true; });
      R.lineMat.color.set(C.axis);
      R.crownMat.color.set(C.leaf);
      R.previewMat.color.set(C.soft);
      R.trailMat.color.set(C.accent);
      R.beadMat.color.set(C.accent);
      R.ringMat.color.set(C.displacement);
      R.arrow.setColor(new T.Color(C.velocity));
    }

    function resize() {
      if (!R) return;
      const w = stage.clientWidth || 320;
      const h = Math.max(230, Math.min(460, Math.round(w / 1.75)));
      stage.style.height = h + 'px';
      R.renderer.setSize(w, h);
      R.camera.aspect = w / h;
      R.camera.updateProjectionMatrix();
    }

    function aimChanged() {
      if (S.flying) { S.flying = false; if (S.resolve) { const r = S.resolve; S.resolve = null; r(null); } }
      S.t = 0;
      S.landed = false;
      syncAim();
    }

    /* Puts the scene at the current time and aim. Called from every render. */
    function syncAim() {
      if (!R) return;
      const T = R.T;
      R.barrel.rotation.z = (S.a * Math.PI) / 180;
      const pts = pathPoints(T);
      R.preview.geometry.dispose();
      R.preview.geometry = new T.BufferGeometry().setFromPoints(pts);
      R.preview.computeLineDistances();
      const Rg = B.range(S.v, S.a);
      R.ring.position.x = Rg;
      clearTrail();
    }
    function clearTrail() {
      if (!R) return;
      R.trailN = 0;
      R.trailGeo.setDrawRange(0, 0);
      R.strobes.forEach(function (b) { b.visible = false; });
      S.stamps = 0;
      R.catMat.map = R.texFly;
    }

    function pushTrail(p) {
      if (R.trailN >= R.trailMax) return;
      const i = R.trailN * 3;
      R.trailPos[i] = p.x; R.trailPos[i + 1] = Math.max(0.03, p.y); R.trailPos[i + 2] = 0;
      R.trailN++;
      R.trailGeo.setDrawRange(0, R.trailN);
      R.trailGeo.attributes.position.needsUpdate = true;
    }

    function step(dt) {
      if (!S.flying) return;
      S.t += dt * 0.85;
      const end = B.flightTime(S.v, S.a);
      if (S.t >= end) {
        S.t = end;
        S.flying = false;
        S.landed = true;
        if (R) R.catMat.map = R.texStand;
        const res = S.resolve;
        S.resolve = null;
        if (res) res({ range: B.range(S.v, S.a), T: end, H: B.maxHeight(S.v, S.a) });
      }
    }

    function render() {
      if (!R) return;
      const T = R.T;
      const p = B.at(S.v, S.a, S.t);
      const y = Math.max(0, p.y);
      const inAir = S.flying;
      R.cat.position.set(p.x, S.landed ? 1.6 : y, 0); /* landed: the sprite's center sits above its feet */
      R.shadow.position.x = p.x;
      R.cat.visible = S.t > 0 || S.landed;
      R.shadow.visible = R.cat.visible;
      if (inAir) {
        pushTrail(p);
        while (S.stamps < R.strobes.length && S.stamps * 0.25 <= S.t) {
          const q = B.at(S.v, S.a, S.stamps * 0.25);
          R.strobes[S.stamps].position.set(q.x, Math.max(0.1, q.y), 0);
          R.strobes[S.stamps].visible = true;
          S.stamps++;
        }
      }
      /* Velocity arrow: at the muzzle when aiming, on the cat in flight. */
      const vNow = S.t > 0 && !S.landed ? p : B.at(S.v, S.a, 0);
      const speed = Math.hypot(vNow.vx, vNow.vy) || 1;
      R.arrow.visible = !S.landed;
      const dir = new T.Vector3(vNow.vx / speed, vNow.vy / speed, 0);
      R.arrow.setDirection(dir);
      R.arrow.setLength(Math.max(1.5, speed * 0.32), 1, 0.6);
      R.arrow.position.set(S.t > 0 ? p.x : Math.cos((S.a * Math.PI) / 180) * 3.2, S.t > 0 ? y : Math.sin((S.a * Math.PI) / 180) * 3.2, 0);

      /* Camera */
      let wantPos, wantLook;
      const Rg = B.range(S.v, S.a), H = B.maxHeight(S.v, S.a);
      if (S.follow && (inAir || S.landed)) {
        wantPos = new T.Vector3(p.x - 9, y + 4.5, 13);
        wantLook = new T.Vector3(p.x + 3, y + 0.6, 0);
      } else {
        const d = Math.max(Rg * 0.8, H * 1.5, 22);
        wantPos = new T.Vector3(Rg * 0.42, Math.max(H * 0.55, 3) + d * 0.18, d);
        wantLook = new T.Vector3(Rg * 0.42, H * 0.42, 0);
      }
      const k = R.firstFrame ? 1 : 0.12;
      R.firstFrame = false;
      R.camPos.lerp(wantPos, k);
      R.camLook.lerp(wantLook, k);
      R.camera.position.copy(R.camPos);
      R.camera.lookAt(R.camLook);
      R.camera.updateMatrixWorld();

      /* Tilt the sprite along his motion on screen. */
      if (inAir) {
        const a0 = new T.Vector3(p.x, y, 0).project(R.camera);
        const a1 = new T.Vector3(p.x + p.vx * 0.05, y + p.vy * 0.05, 0).project(R.camera);
        R.catMat.rotation = Math.atan2(a1.y - a0.y, (a1.x - a0.x) * R.camera.aspect); /* NDC x is squeezed by the aspect */
      } else {
        R.catMat.rotation = 0;
      }

      R.renderer.render(R.scene, R.camera);
      S.frames++;

      out.set('t', F.unit(S.t, 's', 2));
      out.set('x', F.unit(p.x, 'm', 1));
      out.set('y', F.unit(y, 'm', 1));
      out.set('vx', F.unit(p.vx, 'ms', 1));
      out.set('vy', F.unit(p.vy, 'ms', 1));
    }

    const loop = PHY.SimLoop({ canvas: stage, step, render });
    document.addEventListener('phy:theme', paintTheme);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(function () { resize(); }) : null;
    if (ro) ro.observe(stage);

    function teardown() {
      loop.stop();
      if (!R) return;
      const r = R;
      R = null;
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
      status.textContent = 'טוען תלת-ממד...';
      loadThree(opts.threeUrl).then(function (T) {
        if (!S.wanted) { S.state = 'idle'; return; }
        try {
          R = build(T);
          R.firstFrame = true;
          paintTheme();
          resize();
          syncAim();
          status.hidden = true;
          S.state = 'ready';
          loop.start();
        } catch (e) {
          console.warn('cannon3d', e);
          fallback(String(e));
        }
      }).catch(function (e) {
        console.warn('cannon3d', e);
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
        S.flying = false;
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(null); }
        teardown();
        S.state = 'idle';
        status.hidden = false;
        status.textContent = 'התצוגה התלת-ממדית נעצרה.';
      },
      reset() { aimChanged(); },
      setParam(name, v) {
        if (name === 'angle') { S.a = v; angSlider.set(v); aimChanged(); }
        if (name === 'speed') { S.v = v; speedSlider.set(v); aimChanged(); }
        if (name === 'follow') { S.follow = !!v; followToggle.set(!!v); }
      },
      getState() {
        const p = B.at(S.v, S.a, S.t);
        return {
          state: S.state, failReason: S.failReason, angle: S.a, speed: S.v, t: S.t, T: B.flightTime(S.v, S.a), x: p.x, y: p.y,
          flying: S.flying, landed: S.landed, follow: S.follow, frames: S.frames, range: B.range(S.v, S.a), H: B.maxHeight(S.v, S.a),
          hasThree: !!window.THREE, built: !!R,
        };
      },
      fire() {
        if (S.state !== 'ready') return Promise.resolve(null);
        if (S.resolve) { const r = S.resolve; S.resolve = null; r(null); }
        S.t = 0;
        S.landed = false;
        clearTrail();
        S.flying = true;
        return new Promise(function (resolve) { S.resolve = resolve; });
      },
    };
    /* Give the GPU back when leaving, and come back if the browser restores the page from its cache. */
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

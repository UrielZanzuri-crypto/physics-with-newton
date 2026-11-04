/* PHY.vec: small immutable 2D vector helpers. Vectors are plain {x, y}. Angles are in degrees. */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});
  const RAD = Math.PI / 180;

  const v = (x, y) => ({ x: x, y: y });
  const add = (a, b) => v(a.x + b.x, a.y + b.y);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y);
  const scale = (a, k) => v(a.x * k, a.y * k);
  const neg = (a) => v(-a.x, -a.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const len = (a) => Math.hypot(a.x, a.y);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const norm = (a) => {
    const l = len(a);
    return l > 1e-9 ? v(a.x / l, a.y / l) : v(0, 0);
  };
  /* Angle from +x, counter-clockwise, in [0, 360). */
  const angle = (a) => {
    const d = Math.atan2(a.y, a.x) / RAD;
    return d < 0 ? d + 360 : d;
  };
  const polar = (r, deg) => v(r * Math.cos(deg * RAD), r * Math.sin(deg * RAD));
  const rotate = (a, deg) => {
    const c = Math.cos(deg * RAD);
    const s = Math.sin(deg * RAD);
    return v(a.x * c - a.y * s, a.x * s + a.y * c);
  };
  const snap = (a, step) => v(Math.round(a.x / step) * step, Math.round(a.y / step) * step);
  const eq = (a, b, eps) => dist(a, b) <= (eps === undefined ? 1e-6 : eps);
  const sum = (list) => list.reduce(add, v(0, 0));

  PHY.vec = { v, add, sub, scale, neg, dot, len, dist, lerp, norm, angle, polar, rotate, snap, eq, sum };
})();

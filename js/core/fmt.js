/* PHY.fmt: RTL-safe number and unit formatting.
   Negative numbers carry a leading LRM so "−3" never flips into "3−" inside Hebrew text. */
(function () {
  'use strict';
  const PHY = (window.PHY = window.PHY || {});
  const LRM = '‎';
  const MINUS = '−';

  const UNITS = {
    m: "מ'",
    s: "ש'",
    ms: 'מ/ש',
    ms2: 'מ/ש²',
    N: 'ניוטון',
    kg: 'ק"ג',
    deg: '°',
  };

  function num(x, digits) {
    if (digits === undefined) digits = 2;
    if (!isFinite(x)) return '—';
    const factor = Math.pow(10, digits);
    let r = Math.round(Math.abs(x) * factor + 1e-9) / factor;
    const neg = x < 0 && r !== 0;
    let s = r.toFixed(digits);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return neg ? LRM + MINUS + s : s;
  }

  /* fmt.unit(3.5, 'm') -> "3.5 מ'"; any string that is not a known key is used as is. */
  function unit(x, u, digits) {
    const name = UNITS[u] !== undefined ? UNITS[u] : u;
    if (name === '°') return num(x, digits === undefined ? 0 : digits) + '°';
    return num(x, digits) + ' ' + name;
  }

  function deg(x, digits) {
    return num(x, digits === undefined ? 0 : digits) + '°';
  }

  /* Accepts Hebrew/European decimal comma and the Unicode minus. Returns NaN when unparsable. */
  function parse(str) {
    if (typeof str === 'number') return str;
    const clean = String(str)
      .replace(/[‎‏\s]/g, '')
      .replace(/−/g, '-')
      .replace(',', '.');
    if (clean === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(clean)) return NaN;
    return parseFloat(clean);
  }

  PHY.fmt = { num, unit, deg, parse, UNITS, LRM };
})();

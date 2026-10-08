// Builds assets/ca-counties.svg from U.S. Census cartographic county
// boundaries (public domain), via Code for America's click_that_hood file.
// Albers equal-area: standard parallels 34°N and 40.5°N, central meridian 120°W.
//
//   node scripts/build-ca-counties-svg.js [path-or-url]
//
// Default source:
// https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/california-counties.geojson

const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/california-counties.geojson';
const OUT = path.join(__dirname, '..', 'assets', 'ca-counties.svg');

const EXPECTED = [
  'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa', 'Del Norte',
  'El Dorado', 'Fresno', 'Glenn', 'Humboldt', 'Imperial', 'Inyo', 'Kern', 'Kings', 'Lake',
  'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mariposa', 'Mendocino', 'Merced', 'Modoc',
  'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange', 'Placer', 'Plumas', 'Riverside',
  'Sacramento', 'San Benito', 'San Bernardino', 'San Diego', 'San Francisco', 'San Joaquin',
  'San Luis Obispo', 'San Mateo', 'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta',
  'Sierra', 'Siskiyou', 'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity',
  'Tulare', 'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
];

function albers(lon, lat) {
  const rad = Math.PI / 180;
  const phi1 = 34 * rad;
  const phi2 = 40.5 * rad;
  const lam0 = -120 * rad;
  const n = 0.5 * (Math.sin(phi1) + Math.sin(phi2));
  const C = Math.cos(phi1) * Math.cos(phi1) + 2 * n * Math.sin(phi1);
  const rho0 = Math.sqrt(C) / n;
  const theta = n * (lon * rad - lam0);
  const rho = Math.sqrt(C - 2 * n * Math.sin(lat * rad)) / n;
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplifyRing(points, tol) {
  const closed = points.length > 2 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1];
  const pts = closed ? points.slice(0, -1) : points.slice();
  if (pts.length <= 4) return closed ? pts.concat([pts[0]]) : pts;
  const mask = new Array(pts.length).fill(false);
  mask[0] = mask[pts.length - 1] = true;
  (function rec(a, b) {
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(pts[i], pts[a], pts[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > tol) {
      mask[idx] = true;
      rec(a, idx);
      rec(idx, b);
    }
  })(0, pts.length - 1);
  const out = pts.filter((_, i) => mask[i]);
  if (out.length < 4) return null;
  if (closed) out.push(out[0]);
  return out;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

function ringPath(ring) {
  return ring.map((p, i) =>
    (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)
  ).join('') + 'Z';
}

async function loadGeo(src) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error('Failed to fetch ' + src + ' (' + res.status + ')');
    return res.json();
  }
  return JSON.parse(fs.readFileSync(src, 'utf8'));
}

async function main() {
  const src = process.argv[2] || DEFAULT_URL;
  const geo = await loadGeo(src);
  const projected = geo.features.map(f => {
    const name = f.properties.name;
    const polys = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
    const rings = [];
    polys.forEach(poly => {
      poly.forEach(ring => {
        rings.push(ring.map(pt => albers(pt[0], pt[1])));
      });
    });
    return { name, rings };
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  projected.forEach(c => c.rings.forEach(ring => ring.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  })));

  const pad = 8;
  const width = 640;
  const scale = (width - pad * 2) / (maxX - minX);
  const height = Math.ceil((maxY - minY) * scale + pad * 2);
  const toSvg = (x, y) => [pad + (x - minX) * scale, pad + (maxY - y) * scale];

  const counties = projected.map(c => {
    let area = 0;
    const paths = [];
    c.rings.forEach(ring => {
      const px = ring.map(([x, y]) => toSvg(x, y));
      const simple = simplifyRing(px, 0.65);
      if (!simple) return;
      const a = ringArea(simple);
      if (a < 1.5) return;
      area += a;
      paths.push(ringPath(simple));
    });
    return { name: c.name, d: paths.join(''), area };
  }).filter(c => c.d);

  counties.sort((a, b) => b.area - a.area);
  const names = counties.map(c => c.name).sort();
  const missing = EXPECTED.filter(n => !names.includes(n));
  const extra = names.filter(n => !EXPECTED.includes(n));
  if (missing.length || extra.length || names.length !== 58) {
    throw new Error('County name mismatch. missing=' + missing.join(',') + ' extra=' + extra.join(','));
  }

  const paths = counties.map(c =>
    '    <path data-county="' + c.name + '" d="' + c.d + '"/>'
  ).join('\n');

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="California counties">',
    '  <!-- U.S. Census cartographic county boundaries, public domain, via Code for America click_that_hood. Albers equal-area, parallels 34N and 40.5N, central meridian 120W. Regenerated by scripts/build-ca-counties-svg.js. -->',
    '  <defs>',
    '    <pattern id="county-excluded" width="6" height="6" patternUnits="userSpaceOnUse">',
    '      <rect width="6" height="6" fill="#f3f0ea"/>',
    '      <path d="M0 6 L6 0" stroke="#c4bfb6" stroke-width="1"/>',
    '    </pattern>',
    '  </defs>',
    '  <g fill="#e6e1d8" stroke="rgba(31,36,48,0.35)" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke">',
    paths,
    '  </g>',
    '</svg>',
    ''
  ].join('\n');

  fs.writeFileSync(OUT, svg);
  console.log('Wrote ' + OUT + ' (' + svg.length + ' bytes, viewBox 0 0 ' + width + ' ' + height + ')');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

'use strict';
// Ringkaskan malaysia_district.geojson (asal tidak diubah) -> src/data/geo/malaysia_district.geojson
// Douglas-Peucker bagi setiap gelang, ketepatan 5 perpuluhan, tambah negeri penuh dan titik tengah (lon, lat).
// Guna: node scripts/ringkas-geojson-daerah.js [toleransi-darjah=0.008]
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUMBER = path.join(ROOT, 'malaysia_district.geojson');
const HASIL = path.join(ROOT, 'src', 'data', 'geo', 'malaysia_district.geojson');
const TOL = Number(process.argv[2]) || 0.008;
const NEGERI = {
  JHR: 'Johor',
  KDH: 'Kedah',
  KTN: 'Kelantan',
  MLK: 'Melaka',
  NSN: 'Negeri Sembilan',
  PHG: 'Pahang',
  PNG: 'Pulau Pinang',
  PRK: 'Perak',
  PLS: 'Perlis',
  SBH: 'Sabah',
  SWK: 'Sarawak',
  SGR: 'Selangor',
  TRG: 'Terengganu',
  KUL: 'W.P. Kuala Lumpur',
  LBN: 'W.P. Labuan',
  PJY: 'W.P. Putrajaya',
};
const bulat = (n) => Math.round(n * 1e5) / 1e5;

function jarakSegmen(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function dp(pts, tol) {
  const simpan = new Uint8Array(pts.length);
  simpan[0] = simpan[pts.length - 1] = 1;
  const tindan = [[0, pts.length - 1]];
  while (tindan.length) {
    const [i, j] = tindan.pop();
    let maks = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = jarakSegmen(pts[k], pts[i], pts[j]);
      if (d > maks) {
        maks = d;
        idx = k;
      }
    }
    if (maks > tol && idx > 0) {
      simpan[idx] = 1;
      tindan.push([i, idx], [idx, j]);
    }
  }
  return pts.filter((_, k) => simpan[k]);
}
function luasGelang(r) {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return s / 2;
}
function ringkasGelang(r, tol) {
  // gelang tertutup: pecah dua pada titik paling jauh supaya titik mula tidak dikunci
  const asal = r.slice(0, -1);
  if (asal.length < 4) return null;
  let jauh = 0;
  let k = 0;
  asal.forEach((p, i) => {
    const d = Math.hypot(p[0] - asal[0][0], p[1] - asal[0][1]);
    if (d > jauh) {
      jauh = d;
      k = i;
    }
  });
  const a = dp(asal.slice(0, k + 1), tol);
  const b = dp(asal.slice(k).concat([asal[0]]), tol);
  let hasil = a.concat(b.slice(1)).map((p) => [bulat(p[0]), bulat(p[1])]);
  hasil = hasil.filter((p, i) => i === 0 || p[0] !== hasil[i - 1][0] || p[1] !== hasil[i - 1][1]);
  if (hasil.length < 4) return null;
  return hasil;
}
function titikTengah(poligon) {
  // pusat luas gelang luar terbesar
  const r = poligon[0];
  const A = luasGelang(r);
  if (!A) return [r[0][0], r[0][1]];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    cx += (r[i][0] + r[i + 1][0]) * f;
    cy += (r[i][1] + r[i + 1][1]) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}
const kiraTitik = (g) => JSON.stringify(g.coordinates).split('],[').length;

const gj = JSON.parse(fs.readFileSync(SUMBER, 'utf8'));
let sebelum = 0;
let selepas = 0;
const fitur = gj.features.map((f) => {
  const polis = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  sebelum += kiraTitik(f.geometry);
  const baru = [];
  polis.forEach((p) => {
    const luar = ringkasGelang(p[0], TOL);
    if (!luar) return;
    const lubang = p
      .slice(1)
      .map((h) => ringkasGelang(h, TOL))
      .filter(Boolean);
    baru.push([luar, ...lubang]);
  });
  if (!baru.length) {
    // pulau kecil sahaja: kekalkan gelang terbesar tanpa ringkas
    const terbesar = polis
      .slice()
      .sort((a, b) => Math.abs(luasGelang(b[0])) - Math.abs(luasGelang(a[0])))[0];
    baru.push([terbesar[0].map((p) => [bulat(p[0]), bulat(p[1])])]);
  }
  const utama = baru
    .slice()
    .sort((a, b) => Math.abs(luasGelang(b[0])) - Math.abs(luasGelang(a[0])))[0];
  const [lon, lat] = titikTengah(utama);
  const geometry =
    baru.length === 1
      ? { type: 'Polygon', coordinates: baru[0] }
      : { type: 'MultiPolygon', coordinates: baru };
  selepas += kiraTitik(geometry);
  return {
    type: 'Feature',
    properties: {
      name: f.properties.name,
      state: f.properties.state,
      code_state: f.properties.code_state,
      negeri: NEGERI[f.properties.state] || f.properties.state,
      lon: bulat(lon),
      lat: bulat(lat),
    },
    geometry,
  };
});
fs.mkdirSync(path.dirname(HASIL), { recursive: true });
fs.writeFileSync(HASIL, JSON.stringify({ type: 'FeatureCollection', features: fitur }));
const saizAsal = fs.statSync(SUMBER).size;
const saizBaru = fs.statSync(HASIL).size;
console.log(
  `Fitur: ${fitur.length}; titik ${sebelum} -> ${selepas} (${((selepas / sebelum) * 100).toFixed(1)}%); ` +
    `saiz ${saizAsal} -> ${saizBaru} bait (${((saizBaru / saizAsal) * 100).toFixed(1)}%); toleransi ${TOL} darjah`,
);

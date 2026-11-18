'use strict';
// Ujian unit interp.js dan skala.js (fungsi tulen). Jalankan dari root: node tests/api/interp-unit.js
const assert = require('node:assert');
const I = require('../../src/js/lapisan-cuaca/interp.js');
const S = require('../../src/js/lapisan-cuaca/skala.js');

(async () => {
  const gagal = [];
  const ok = (nama, fn) => {
    try {
      fn();
    } catch (e) {
      gagal.push(nama + ' -> ' + e.message);
    }
  };
  const hampir = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);

  // grid 3x2: baris 0 = [0,10,20], baris 1 = [100,110,120]
  const g = [0, 10, 20, 100, 110, 120];
  ok('bilinear tepat pada nod', () => {
    hampir(I.bilinear(g, 3, 2, 0, 0), 0);
    hampir(I.bilinear(g, 3, 2, 2, 1), 120);
    hampir(I.bilinear(g, 3, 2, 1, 0), 10);
  });
  ok('bilinear titik tengah dan tepi', () => {
    hampir(I.bilinear(g, 3, 2, 0.5, 0.5), 55);
    hampir(I.bilinear(g, 3, 2, 1.5, 0), 15);
    hampir(I.bilinear(g, 3, 2, 2, 0.5), 70);
    assert.strictEqual(I.bilinear(g, 3, 2, 2.01, 0), null);
    assert.strictEqual(I.bilinear(g, 3, 2, -0.1, 0), null);
  });
  const h = [1, 2, null, 4];
  ok('bilinear ketat: penjuru hilang -> null', () => {
    assert.strictEqual(I.bilinear(h, 2, 2, 0.5, 0.5), null);
    hampir(I.bilinear(h, 2, 2, 0, 0), 1);
    assert.strictEqual(I.bilinear([NaN, 1, 1, 1], 2, 2, 0.1, 0.1), null);
  });
  ok('bilinear renormalisasi: abaikan penjuru hilang, null jika berat < 0.5', () => {
    // pusat: 3 penjuru sah, berat 0.75 -> purata 7/3
    hampir(I.bilinear(h, 2, 2, 0.5, 0.5, { renormalisasi: true }), 7 / 3);
    // dekat penjuru hilang (fx 0.1, fy 0.9 -> berat penjuru (0,1) ialah 0.81): berat sah 0.19 < 0.5
    assert.strictEqual(I.bilinear(h, 2, 2, 0.1, 0.9, { renormalisasi: true }), null);
    // dekat penjuru sah
    assert.ok(I.bilinear(h, 2, 2, 0.9, 0.1, { renormalisasi: true }) > 1);
  });
  ok('lonlatKeGrid had bbox', () => {
    const b = { latMin: 0.5, latMax: 7.5, lonMin: 99.5, lonMax: 119.5 };
    const r = I.lonlatKeGrid(b, 41, 15, 4, 109.5);
    hampir(r.fx, 20);
    hampir(r.fy, 7);
    assert.strictEqual(I.lonlatKeGrid(b, 41, 15, 8, 109.5), null);
    assert.strictEqual(I.lonlatKeGrid(b, 41, 15, 4, 99), null);
    assert.deepStrictEqual(I.lonlatKeGrid(b, 41, 15, 0.5, 99.5), { fx: 0, fy: 0 });
  });
  ok('mercatorBaris: tertib menurun, simetri Mercator', () => {
    const b = I.mercatorBaris(0.5, 7.5, 225);
    assert.strictEqual(b.length, 225);
    assert.ok(b[0] < 7.5 && b[0] > 7.4);
    assert.ok(b[224] > 0.5 && b[224] < 0.6);
    for (let i = 1; i < b.length; i++) assert.ok(b[i] < b[i - 1]);
    hampir(I.latDariMercatorY(I.mercatorY(4.2)), 4.2, 1e-9);
  });
  ok('kMaks untuk time0 0/10/23 pada 96 jam', () => {
    assert.strictEqual(I.kMaks(72, 0, 96), 23);
    assert.strictEqual(I.kMaks(72, 10, 96), 13);
    assert.strictEqual(I.kMaks(72, 23, 96), 0);
    assert.strictEqual(I.kMaks(3, 0, 96), 72);
    assert.strictEqual(I.kMaks(48, 10, 30), 0);
  });
  ok('kumpul: jumlah W 3/12/24/48/72 dan pemangkasan di hujung', () => {
    const perJam = [];
    for (let i = 0; i < 96; i++) perJam.push([i, 1]);
    [3, 12, 24, 48, 72].forEach((W) => {
      const k = I.kumpul(perJam, 5, W);
      let jum = 0;
      for (let i = 6; i <= 5 + W; i++) jum += i;
      hampir(k[0], jum);
      hampir(k[1], W);
    });
    // pemangkasan: h=94, W=3 -> hanya jam 95
    hampir(I.kumpul(perJam, 94, 3)[0], 95);
    // null dianggap 0 jika ada nilai; semua null -> NaN
    const p2 = [
      [0, null],
      [1, null],
      [null, null],
      [2, null],
    ];
    const k2 = I.kumpul(p2, 0, 3);
    hampir(k2[0], 3);
    assert.ok(Number.isNaN(k2[1]));
  });
  ok('kelasRibut jadual kebenaran', () => {
    const k = (code, cape, precip, cloud) => I.kelasRibut({ code, cape, precip, cloud });
    assert.strictEqual(k(96, 0, 0, 0), 4);
    assert.strictEqual(k(99, 0, 0, 0), 4);
    assert.strictEqual(k(95, 0, 0, 0), 3);
    assert.strictEqual(k(0, 500, 1, 80), 0);
    assert.strictEqual(k(0, 1000, 1, 80), 1);
    assert.strictEqual(k(0, 2000, 1, 80), 2);
    assert.strictEqual(k(0, 3500, 1, 80), 3);
    assert.strictEqual(k(0, 3500, 0, 20), 1); // cap
    assert.strictEqual(k(95, 3500, 0, 20), 3);
    assert.strictEqual(k(null, undefined, null, null), 0);
  });
  ok('uv pada 0/90/180/270', () => {
    const a = I.uv(10, 0); // dari utara -> bergerak ke selatan
    hampir(a.u, 0);
    hampir(a.v, -10);
    const b = I.uv(10, 90); // dari timur -> ke barat
    hampir(b.u, -10);
    hampir(b.v, 0, 1e-9);
    const c = I.uv(10, 180);
    hampir(c.v, 10);
    const d = I.uv(10, 270);
    hampir(d.u, 10);
  });
  ok('arah mata dan teks WMO', () => {
    assert.strictEqual(I.arahMata(0), 'U');
    assert.strictEqual(I.arahMata(90), 'T');
    assert.strictEqual(I.arahMata(225), 'BD');
    assert.strictEqual(I.arahMata(359), 'U');
    assert.strictEqual(I.arahMata(-90), 'B');
    assert.strictEqual(I.teksWMO(95), 'Ribut petir');
    assert.strictEqual(I.teksWMO(0), 'Langit cerah');
    assert.strictEqual(I.teksWMO(1234), 'Tidak diketahui');
  });
  ok('panahGaris: 6 bucu setiap anak panah', () => {
    const v = I.panahGaris([{ x: 0.5, y: 0.5, ux: 1, uy: 0, len: 0.01, alpha: 0.8 }]);
    assert.strictEqual(v.length, 18);
    hampir(v[3], 0.51, 1e-6);
    hampir(v[2], 0.8, 1e-6);
  });
  ok('skala: interpolasi ramp', () => {
    assert.deepStrictEqual(S.warna(S.RAMP.suhu, 10), [43, 95, 180, 184]);
    assert.deepStrictEqual(S.warna(S.RAMP.suhu, 99), [161, 22, 31, 184]);
    const tengah = S.warna(S.RAMP.suhu, 20);
    assert.ok(tengah[0] > 43 && tengah[0] < 63);
    assert.strictEqual(S.warna(S.RAMP.awan, 0)[3], 0);
    assert.strictEqual(S.warna(S.RAMP.hujan, 0)[3], 0);
    assert.strictEqual(S.warnaRibut(0)[3], 0);
    assert.strictEqual(S.warnaRibut(4)[0], 0xc1);
    assert.match(S.gradienCss(S.RAMP.angin), /^linear-gradient\(90deg,rgba\(/);
    assert.deepStrictEqual(S.julat(S.RAMP.ombak), [0, 4]);
  });

  if (gagal.length) {
    console.error('GAGAL interp-unit:\n- ' + gagal.join('\n- '));
    process.exit(1);
  }
  console.log('interp-unit: semua ujian lulus');
})();

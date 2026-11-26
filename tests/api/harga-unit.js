'use strict';
// Ujian unit src/js/harga.js dan konsistensi dalaman DATA.rekod. Jalankan dari root: node tests/api/harga-unit.js
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const ctx = {};
vm.createContext(ctx);
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'src/data/dashboard-data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/js/harga.js'), 'utf8'), ctx);
const H = ctx.HARGA;
const R = vm.runInContext('DATA.rekod', ctx);

const gagal = [];
const ok = (nama, fn) => {
  try {
    fn();
  } catch (e) {
    gagal.push(nama + ' -> ' + e.message);
  }
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const hampir = (a, b, t) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);

ok('1050 rekod', () => assert.strictEqual(R.length, 1050));
ok('medan terbitan konsisten dengan prices[]', () => {
  R.forEach((r) => {
    const P = r.prices;
    const t = mean(P.slice(-7)),
      b = mean(P.slice(-14, -7));
    hampir(r.mingguTerkini, t, 0.006);
    hampir(r.mingguSebelum, b, 0.006);
    hampir(r.purata, mean(P), 0.011);
    const mu = mean(P);
    const sd = Math.sqrt(P.reduce((s, x) => s + (x - mu) ** 2, 0) / (P.length - 1));
    hampir(r.sigma, sd, 0.006);
    hampir(r.perubahanPct, ((t - b) / b) * 100, 0.011);
    const z = Math.abs((r.ramalan - r.purata) / r.sigma);
    assert.strictEqual(r.status, z > 2 ? 'merah' : z > 1 ? 'kuning' : 'hijau', r.id);
  });
});
ok('rm()', () => assert.strictEqual(H.rm(9.75), 'RM 9.75'));
ok('pct()', () => {
  assert.strictEqual(H.pct(4.213), '+4.21%');
  assert.strictEqual(H.pct(-3.75), '-3.75%');
});
ok('accessor sama dengan medan rekod', () => {
  const r = R[0];
  assert.strictEqual(H.semasa(r), r.mingguTerkini);
  assert.strictEqual(H.sebelum(r), r.mingguSebelum);
  assert.strictEqual(H.min(r, 30), r.purata);
  assert.strictEqual(H.status(r), r.status);
});
ok('tahapKongsi mengikut arah merugikan', () => {
  const merahTurun = R.find((r) => r.status === 'merah' && r.ramalan < r.purata);
  if (merahTurun) {
    assert.strictEqual(H.tahapKongsi(merahTurun, 'pengeluar'), 'kritikal');
    assert.strictEqual(H.tahapKongsi(merahTurun, 'pengguna'), 'normal');
  }
  const kuningNaik = R.find((r) => r.status === 'kuning' && r.ramalan > r.purata);
  if (kuningNaik) {
    assert.strictEqual(H.tahapKongsi(kuningNaik, 'pengguna'), 'waspada');
    assert.strictEqual(H.tahapKongsi(kuningNaik, 'pengeluar'), 'normal');
  }
  const hijau = R.find((r) => r.status === 'hijau');
  assert.strictEqual(H.tahapKongsi(hijau, 'pengeluar'), 'normal');
});
ok('sirisBlok7 blok akhir = purataPO().semasa', () => {
  const s = H.sirisBlok7('simpangrenggam', 'cili-merah', 'Borong');
  assert.strictEqual(s.length, 4);
  hampir(s[3], H.purataPO('simpangrenggam', 'Cili Merah', 'Borong').semasa, 1e-12);
});
ok('rekod/rekodPO menerima nama atau slug', () => {
  assert.ok(H.rekod('perlis', 'Kangar', 'Cili Merah', 'Ladang'));
  assert.strictEqual(
    H.rekod('perlis', 'Kangar', 'cili-merah', 'Ladang'),
    H.rekod('perlis', 'Kangar', 'Cili Merah', 'Ladang'),
  );
  assert.ok(H.rekodPO('perlis', 'cili-merah', 'Ladang').length >= 1);
});

if (gagal.length) {
  console.error('GAGAL:\n' + gagal.join('\n'));
  process.exit(1);
}
console.log('harga-unit: semua ujian lulus');

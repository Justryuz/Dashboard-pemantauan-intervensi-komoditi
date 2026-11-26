'use strict';
// Membakar 14 senario ujian Intervensi (T1-T8, dummy) ke dalam DATA.rekod supaya Pemantauan Komoditi
// dan Dashboard Intervensi membaca nombor yang sama. Boleh diulang (idempotent).
// Jalankan: node scripts/selaras-data-harga.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../src/data/dashboard-data.js');
const text = fs.readFileSync(file, 'utf8');

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r2 = (x) => Math.round(x * 100) / 100;
const sdSample = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

// Medan terbitan, formula sama seperti data sedia ada (disahkan oleh ujian emas di bawah).
function derive(r) {
  const P = r.prices;
  const t = mean(P.slice(-7)),
    b = mean(P.slice(-14, -7));
  const out = {
    purata: r2(mean(P)),
    sigma: r2(sdSample(P)),
    mingguTerkini: r2(t),
    mingguSebelum: r2(b),
    perubahanPct: r2(((t - b) / b) * 100),
  };
  return out;
}
const statusDari = (z) => (Math.abs(z) > 2 ? 'merah' : Math.abs(z) > 1 ? 'kuning' : 'hijau');

// 14 senario: [id, poId, daerah, komoditi, peringkat, dev%, devF%]
const S = [
  ['T1', 'simpangrenggam', 'Kluang', 'Cili Merah', 'Ladang', -17.5, -19],
  ...['Kinta', 'Kampar', 'Kuala Kangsar', 'Manjung'].map((d) => [
    'T1b',
    'perak',
    d,
    'Cili Merah',
    'Borong',
    6,
    6,
  ]),
  ['T2', 'johor', 'Johor Bahru', 'Cili Merah', 'Runcit', 16, 18],
  ['T3', 'kelantan', 'Pasir Mas', 'Bawang Merah Kecil', 'Runcit', 17, 19],
  ['T4', 'perlis', 'Kangar', 'Cili Merah', 'Ladang', -16, -16],
  ['T5', 'sarawak', 'Serian', 'Kubis Bulat', 'Ladang', -18, -18],
  ['T6', 'pahang', 'Temerloh', 'Cili Hijau', 'Ladang', -10, -10],
  ['T6', 'sabah', 'Tuaran', 'Tomato Bulat', 'Ladang', -9, -9],
  ['T7', 'pahang', 'Kuantan', 'Tomato Bulat', 'Runcit', 18, 18],
  ['T8', 'selangor', 'Sepang', 'Cili Hijau', 'Runcit', 9, 9],
  ['T8', 'sarawak', 'Kuching', 'Ayam Proses Super', 'Runcit', 10, 10],
];
const key = (r) => `${r.poId}|${r.daerah}|${r.komoditi}|${r.peringkat}`;
const target = new Map(S.map((s) => [`${s[1]}|${s[2]}|${s[3]}|${s[4]}`, s]));

const lines = text.split('\n');
let golden = 0,
  goldenBad = 0,
  changed = 0;
const report = [];
const idx = [];
lines.forEach((ln, i) => {
  if (!/^\s*\{"id":/.test(ln)) return;
  const body = ln.replace(/\r$/, '').replace(/,\s*$/, '');
  const r = JSON.parse(body);
  if (!Array.isArray(r.prices)) return; // bukan baris rekod harga
  idx.push(i);
  const k = key(r);
  if (!target.has(k)) {
    // ujian emas: medan terbitan tersimpan sepadan dengan pengiraan semula
    const d = derive(r);
    golden++;
    const ok =
      Math.abs(d.sigma - r.sigma) < 1e-9 &&
      Math.abs(d.mingguTerkini - r.mingguTerkini) < 1e-9 &&
      Math.abs(d.mingguSebelum - r.mingguSebelum) < 1e-9 &&
      Math.abs(d.perubahanPct - r.perubahanPct) < 1e-9 &&
      Math.abs(d.purata - r.purata) <= 0.011 &&
      statusDari((r.ramalan - r.purata) / r.sigma) === r.status;
    if (!ok) goldenBad++;
    return;
  }
  const [id, , , , , dev, devF] = target.get(k);
  const P = r.prices.slice();
  const n = P.length; // 30
  const s23 = mean(P.slice(0, n - 7)) * (n - 7);
  const d = dev / 100;
  const L = ((1 + d) * s23) / (23 - 7 * d);
  const cur = mean(P.slice(-7));
  const shift = L - cur;
  for (let j = n - 7; j < n; j++) P[j] = r2(P[j] + shift);
  const nr = { ...r, prices: P };
  Object.assign(nr, derive(nr));
  nr.ramalan = r2(nr.purata * (1 + devF / 100));
  const z = (nr.ramalan - nr.purata) / nr.sigma;
  nr.status = statusDari(z);
  nr.sebab =
    nr.status === 'hijau'
      ? 'Dalam julat normal'
      : `${Math.abs(z).toFixed(1)}σ daripada purata 30 hari`;
  const eol = ln.endsWith('\r') ? '\r' : '';
  const comma = /,\s*\r?$/.test(ln) ? ',' : '';
  const indent = ln.match(/^\s*/)[0];
  const baru = indent + JSON.stringify(nr) + comma + eol;
  if (baru !== ln) {
    lines[i] = baru;
    changed++;
  }
  report.push(
    `${id} ${k} status=${nr.status} mingguTerkini=${nr.mingguTerkini} ramalan=${nr.ramalan} perubahanPct=${nr.perubahanPct}`,
  );
});

console.log(`Ujian emas: ${golden} rekod tidak disentuh, ${goldenBad} tidak sepadan`);
if (goldenBad) {
  console.error('Ujian emas gagal; tiada fail ditulis.');
  process.exit(1);
}
if (report.length !== 14) {
  console.error(`Dijangka 14 rekod sasaran, dapat ${report.length}`);
  process.exit(1);
}
report.forEach((x) => console.log(x));
fs.writeFileSync(file, lines.join('\n'));
console.log(`Baris diubah: ${changed}`);

// Pastikan fail masih sah dan 1050 rekod
const c = {};
vm.createContext(c);
vm.runInContext(fs.readFileSync(file, 'utf8') + ';this.DATA=DATA', c);
if (c.DATA.rekod.length !== 1050) {
  console.error('Bilangan rekod berubah: ' + c.DATA.rekod.length);
  process.exit(1);
}

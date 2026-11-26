/* Akses harga dummy kongsi untuk Pemantauan Komoditi dan Dashboard Intervensi Komoditi.
   Sumber kebenaran tunggal: DATA.rekod. Fungsi tulen, tiada DOM. Semua nombor harga yang
   dipaparkan kedua-dua tab mesti melalui modul ini supaya tafsirannya sama. */
(function (root) {
  'use strict';
  const slug = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const fin = (x) => typeof x === 'number' && Number.isFinite(x);

  const TARIKH_AKHIR = '2026-11-14';
  const HARI = 30;
  const LABEL_TETINGKAP = '30 hari berakhir 14 Nov 2026';
  const labelStatus = { merah: 'Kritikal', kuning: 'Berwaspada', hijau: 'Stabil' };

  const rm = (x) => 'RM ' + Number(x).toFixed(2);
  const pct = (x, d = 2) => (fin(x) ? (x > 0 ? '+' : '') + x.toFixed(d) + '%' : '—');

  const semasa = (r) => r.mingguTerkini;
  const sebelum = (r) => r.mingguSebelum;
  const ramalan = (r) => r.ramalan;
  const minHari = (r, hari = HARI) =>
    !hari || hari >= r.prices.length ? r.purata : mean(r.prices.slice(-Math.max(1, hari)));
  const sigma = (r) => r.sigma;
  const lantai = (r) => r.hargaLantai;
  const siling = (r) => r.hargaSiling;
  const perubahanPct = (r) => r.perubahanPct;
  const sisihanPct = (r, hari = HARI) => ((semasa(r) - minHari(r, hari)) / minHari(r, hari)) * 100;
  const sisihanRamalanPct = (r, hari = HARI) =>
    ((ramalan(r) - minHari(r, hari)) / minHari(r, hari)) * 100;
  const z = (r) => (r.ramalan - r.purata) / r.sigma;
  const status = (r) => r.status;
  // Pengeluar rugi apabila harga turun; pengguna rugi apabila harga naik.
  const arahMerugikan = (r, mod) => (mod === 'pengeluar' ? z(r) < 0 : z(r) > 0);
  const tahapKongsi = (r, mod) => {
    const s = status(r);
    if (s === 'hijau' || !arahMerugikan(r, mod)) return 'normal';
    return s === 'merah' ? 'kritikal' : 'waspada';
  };

  const data = () => (typeof DATA !== 'undefined' ? DATA : root.DATA);
  let indeks = null,
    indeksDari = null;
  function bina() {
    const rekod = data().rekod;
    if (indeks && indeksDari === rekod) return indeks;
    indeks = new Map();
    rekod.forEach((r) => {
      indeks.set([r.poId, r.daerah, slug(r.komoditi), r.peringkat].join('|'), r);
      const kp = [r.poId, slug(r.komoditi), r.peringkat].join('|');
      if (!indeks.has(kp)) indeks.set(kp, []);
      indeks.get(kp).push(r);
    });
    indeksDari = rekod;
    return indeks;
  }
  const rekod = (poId, daerah, komoditi, peringkat) =>
    bina().get([poId, daerah, slug(komoditi), peringkat].join('|')) || null;
  const rekodPO = (poId, komoditi, peringkat) =>
    (bina().get([poId, slug(komoditi), peringkat].join('|')) || []).slice();

  function purataPO(poId, komoditi, peringkat, hari = HARI) {
    const rs = rekodPO(poId, komoditi, peringkat);
    if (!rs.length) return null;
    const m = (f) => mean(rs.map(f));
    const out = {
      semasa: m(semasa),
      sebelum: m(sebelum),
      min: m((r) => minHari(r, hari)),
      ramalan: m(ramalan),
      lantai: m(lantai),
      siling: m(siling),
      perubahanPct: m(perubahanPct),
      unit: rs[0].unit,
      bil: rs.length,
    };
    out.sisihanPct = ((out.semasa - out.min) / out.min) * 100;
    out.sisihanRamalanPct = ((out.ramalan - out.min) / out.min) * 100;
    return out;
  }
  // 4 purata blok 7 hari (lama -> baru), purata daerah PO. Dua blok terakhir ialah
  // mingguSebelum/mingguTerkini supaya blok akhir sama dengan purataPO().semasa.
  function sirisBlok7(poId, komoditi, peringkat) {
    const rs = rekodPO(poId, komoditi, peringkat);
    if (!rs.length) return [];
    const blok = (r, k) => {
      if (k === 0) return semasa(r);
      if (k === 1) return sebelum(r);
      const n = r.prices.length;
      return mean(r.prices.slice(n - 7 * (k + 1), n - 7 * k));
    };
    return [3, 2, 1, 0].map((k) => mean(rs.map((r) => blok(r, k))));
  }

  const HARGA = {
    TARIKH_AKHIR,
    HARI,
    LABEL_TETINGKAP,
    labelStatus,
    rm,
    pct,
    semasa,
    sebelum,
    ramalan,
    min: minHari,
    sigma,
    lantai,
    siling,
    perubahanPct,
    sisihanPct,
    sisihanRamalanPct,
    z,
    status,
    arahMerugikan,
    tahapKongsi,
    rekod,
    rekodPO,
    purataPO,
    sirisBlok7,
  };
  root.HARGA = HARGA;
})(typeof globalThis !== 'undefined' ? globalThis : window);

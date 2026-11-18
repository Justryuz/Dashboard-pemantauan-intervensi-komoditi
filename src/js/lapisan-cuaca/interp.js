'use strict';
// Fungsi tulen untuk lapisan cuaca (tiada DOM). Dikongsi: pelayar (window.FamaInterp) dan pelayan Node (/api/grid/titik).
(function (akar, kilang) {
  const modul = kilang();
  if (typeof module === 'object' && module.exports) module.exports = modul;
  else akar.FamaInterp = modul;
})(typeof self !== 'undefined' ? self : this, function () {
  const hilang = (v) => v === null || v === undefined || v !== v;

  // Interpolasi bilinear pada grid baris-utama (indeks = baris*nx + lajur). fx dalam [0,nx-1], fy dalam [0,ny-1].
  // Nilai hilang = null/undefined/NaN. Mod ketat: sebarang penjuru hilang -> null.
  // Mod renormalisasi: penjuru hilang diabaikan; null jika jumlah berat penjuru sah < 0.5.
  function bilinear(arr, nx, ny, fx, fy, opsyen) {
    if (!(fx >= 0 && fx <= nx - 1 && fy >= 0 && fy <= ny - 1)) return null;
    const x0 = Math.min(Math.floor(fx), nx - 2 < 0 ? 0 : nx - 2);
    const y0 = Math.min(Math.floor(fy), ny - 2 < 0 ? 0 : ny - 2);
    const x1 = Math.min(x0 + 1, nx - 1);
    const y1 = Math.min(y0 + 1, ny - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const v = [arr[y0 * nx + x0], arr[y0 * nx + x1], arr[y1 * nx + x0], arr[y1 * nx + x1]];
    const w = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
    const renorm = !!(opsyen && opsyen.renormalisasi);
    let jum = 0;
    let beratSah = 0;
    for (let i = 0; i < 4; i++) {
      if (hilang(v[i])) {
        if (!renorm && w[i] > 0) return null;
        continue;
      }
      jum += v[i] * w[i];
      beratSah += w[i];
    }
    if (renorm) return beratSah < 0.5 ? null : jum / beratSah;
    return beratSah > 0 ? jum / beratSah : null;
  }

  // lat/lon -> koordinat grid pecahan {fx, fy}; null jika di luar bbox.
  function lonlatKeGrid(bbox, nx, ny, lat, lon) {
    if (!(lat >= bbox.latMin && lat <= bbox.latMax && lon >= bbox.lonMin && lon <= bbox.lonMax))
      return null;
    return {
      fx: ((lon - bbox.lonMin) / (bbox.lonMax - bbox.lonMin)) * (nx - 1),
      fy: ((lat - bbox.latMin) / (bbox.latMax - bbox.latMin)) * (ny - 1),
    };
  }

  // Mercator: y dalam unit 0..1 (0 = utara jauh), seperti MercatorCoordinate MapLibre.
  const mercatorY = (lat) =>
    0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
  const latDariMercatorY = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  const mercatorX = (lon) => lon / 360 + 0.5;

  // Baris-baris piksel yang sama jarak dalam Mercator antara latMin (bawah) dan latMax (atas).
  // Pulangan: tatasusunan lat bagi setiap baris piksel dari atas (utara) ke bawah (selatan).
  function mercatorBaris(latMin, latMax, tinggi) {
    const yAtas = mercatorY(latMax);
    const yBawah = mercatorY(latMin);
    const hasil = new Array(tinggi);
    for (let j = 0; j < tinggi; j++) {
      const y = yAtas + ((j + 0.5) / tinggi) * (yBawah - yAtas);
      hasil[j] = latDariMercatorY(y);
    }
    return hasil;
  }

  // Jam maksimum peluncur untuk kumpulan hujan W jam: hari ke-k pada indeks time0+k.
  function kMaks(W, time0, bilJam) {
    return Math.max(0, Math.min(72, bilJam - 1 - time0 - W));
  }

  // Jumlah hujan setiap sel untuk jam h+1 .. h+W. perJam = tatasusunan bagi tatasusunan sel.
  // null dianggap 0 jika sekurang-kurangnya satu nilai wujud; jika tiada, null (NaN).
  function kumpul(perJam, h, W) {
    const n = perJam[0].length;
    const keluar = new Float32Array(n);
    const akhir = Math.min(perJam.length - 1, h + W);
    for (let c = 0; c < n; c++) {
      let jum = 0;
      let ada = false;
      for (let i = h + 1; i <= akhir; i++) {
        const v = perJam[i][c];
        if (!hilang(v)) {
          jum += v;
          ada = true;
        }
      }
      keluar[c] = ada ? jum : NaN;
    }
    return keluar;
  }

  // Kelas ribut petir 0..4 (anggaran heuristik, bukan ramalan rasmi).
  function kelasRibut(p) {
    const kod = Number(p.code) || 0;
    const cape = Number(p.cape) || 0;
    const hujan = Number(p.precip) || 0;
    const awan = Number(p.cloud) || 0;
    let kodSkor = 0;
    if (kod === 96 || kod === 99) kodSkor = 4;
    else if (kod === 95 || kod === 97 || kod === 98) kodSkor = 3;
    let capeSkor = 0;
    if (cape >= 3000) capeSkor = 3;
    else if (cape >= 2000) capeSkor = 2;
    else if (cape >= 1000) capeSkor = 1;
    if (hujan === 0 && awan < 50) capeSkor = Math.min(capeSkor, 1);
    return Math.max(kodSkor, capeSkor);
  }

  // Arah meteorologi ialah arah ANGIN DATANG DARI. u = timur, v = utara (km/j).
  function uv(laju, arah) {
    const r = (arah * Math.PI) / 180;
    const u = -laju * Math.sin(r);
    const v = -laju * Math.cos(r);
    return { u: u === 0 ? 0 : u, v: v === 0 ? 0 : v };
  }

  const ARAH_MATA = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  const arahMata = (deg) => ARAH_MATA[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

  // Kod cuaca WMO (Open-Meteo) dalam Bahasa Melayu.
  const WMO = {
    0: 'Langit cerah',
    1: 'Kebanyakan cerah',
    2: 'Separa berawan',
    3: 'Mendung',
    45: 'Kabus',
    48: 'Kabus berembun beku',
    51: 'Gerimis ringan',
    53: 'Gerimis sederhana',
    55: 'Gerimis lebat',
    56: 'Gerimis beku ringan',
    57: 'Gerimis beku lebat',
    61: 'Hujan ringan',
    63: 'Hujan sederhana',
    65: 'Hujan lebat',
    66: 'Hujan beku ringan',
    67: 'Hujan beku lebat',
    71: 'Salji ringan',
    73: 'Salji sederhana',
    75: 'Salji lebat',
    77: 'Butir salji',
    80: 'Hujan mandi ringan',
    81: 'Hujan mandi sederhana',
    82: 'Hujan mandi sangat lebat',
    85: 'Hujan salji ringan',
    86: 'Hujan salji lebat',
    95: 'Ribut petir',
    96: 'Ribut petir dengan hujan batu ringan',
    99: 'Ribut petir dengan hujan batu lebat',
  };
  function teksWMO(kod) {
    const k = Number(kod);
    if (WMO[k]) return WMO[k];
    if (k === 97 || k === 98) return 'Ribut petir';
    return 'Tidak diketahui';
  }

  // Bina senarai garis anak panah. titik: [{x, y, ux, uy, len, alpha}] (x,y Mercator; ux,uy vektor unit
  // dalam ruang Mercator, y ke selatan; len dalam unit Mercator). Pulangan: Float32Array [x,y,alpha]*bucu, 6 bucu per anak panah.
  function panahGaris(titik) {
    const keluar = new Float32Array(titik.length * 6 * 3);
    let o = 0;
    const tulis = (x, y, a) => {
      keluar[o++] = x;
      keluar[o++] = y;
      keluar[o++] = a;
    };
    titik.forEach((p) => {
      const hx = p.x + p.ux * p.len;
      const hy = p.y + p.uy * p.len;
      const kepala = p.len * 0.35;
      const c = Math.cos(Math.PI * 0.8);
      const s = Math.sin(Math.PI * 0.8);
      const ax = p.ux * c - p.uy * s;
      const ay = p.ux * s + p.uy * c;
      const bx = p.ux * c + p.uy * s;
      const by = -p.ux * s + p.uy * c;
      tulis(p.x, p.y, p.alpha);
      tulis(hx, hy, p.alpha);
      tulis(hx, hy, p.alpha);
      tulis(hx + ax * kepala, hy + ay * kepala, p.alpha);
      tulis(hx, hy, p.alpha);
      tulis(hx + bx * kepala, hy + by * kepala, p.alpha);
    });
    return keluar;
  }

  return {
    hilang,
    bilinear,
    lonlatKeGrid,
    mercatorX,
    mercatorY,
    latDariMercatorY,
    mercatorBaris,
    kMaks,
    kumpul,
    kelasRibut,
    uv,
    arahMata,
    teksWMO,
    panahGaris,
  };
});

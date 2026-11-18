'use strict';
// Skala warna dan takrif legenda lapisan cuaca. Warna ialah pilihan reka bentuk (bukan data bersumber).
(function (akar, kilang) {
  const modul = kilang();
  if (typeof module === 'object' && module.exports) module.exports = modul;
  else {
    akar.FamaCuaca = akar.FamaCuaca || {};
    akar.FamaCuaca.skala = modul;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const A = 0.72;
  const s = (nilai, hex, a) => [nilai, hex, a === undefined ? A : a];

  const RAMP = {
    suhu: {
      unit: '°C',
      stops: [
        s(18, '#2b5fb4'),
        s(22, '#3fa7d6'),
        s(25, '#7fd1ae'),
        s(28, '#f1e45a'),
        s(31, '#f5a33a'),
        s(34, '#e5522e'),
        s(38, '#a1161f'),
      ],
    },
    angin: {
      unit: 'km/j',
      stops: [
        s(0, '#3a6fb0', 0.15),
        s(10, '#4fb3d9'),
        s(20, '#7fd16f'),
        s(30, '#e8e24f'),
        s(40, '#f5a33a'),
        s(60, '#e5522e'),
        s(80, '#8f1d6b'),
      ],
    },
    awan: {
      unit: '%',
      stops: [s(0, '#ffffff', 0), s(50, '#cfd8e3', 0.35), s(100, '#7b8794')],
    },
    hujan: {
      unit: 'mm/j',
      stops: [
        s(0, '#a8d8f0', 0),
        s(0.1, '#a8d8f0', 0.35),
        s(1, '#5db4ea'),
        s(2.5, '#2f86d8'),
        s(5, '#3a56d0'),
        s(10, '#8a3fc7'),
        s(20, '#d02f9a'),
        s(40, '#ff3b3b'),
      ],
    },
    kumpulan: {
      unit: 'mm',
      stops: [
        s(0, '#a8d8f0', 0),
        s(1, '#a8d8f0', 0.35),
        s(5, '#5db4ea'),
        s(10, '#2f86d8'),
        s(25, '#3a56d0'),
        s(50, '#8a3fc7'),
        s(100, '#d02f9a'),
        s(200, '#ff3b3b'),
      ],
    },
    ombak: {
      unit: 'm',
      stops: [
        s(0, '#cfe8ff', 0.2),
        s(0.5, '#7ec0f0'),
        s(1, '#3f8fe0'),
        s(1.5, '#2f5fd0'),
        s(2, '#7a3fc7'),
        s(3, '#c02f9a'),
        s(4, '#ff3b3b'),
      ],
    },
  };

  // Ribut petir: 4 kelas diskret.
  const KELAS_RIBUT = [
    { kelas: 1, hex: '#ffe066', teks: 'Rendah' },
    { kelas: 2, hex: '#ffa13a', teks: 'Sederhana' },
    { kelas: 3, hex: '#ff5a3a', teks: 'Tinggi' },
    { kelas: 4, hex: '#c1121f', teks: 'Sangat tinggi' },
  ];

  const hexRgb = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];

  // Warna [r,g,b,a(0..255)] bagi nilai pada ramp (interpolasi linear RGB + alfa antara hentian).
  function warna(ramp, nilai) {
    const st = ramp.stops;
    if (nilai <= st[0][0]) return hexRgb(st[0][1]).concat(Math.round(st[0][2] * 255));
    const akhir = st[st.length - 1];
    if (nilai >= akhir[0]) return hexRgb(akhir[1]).concat(Math.round(akhir[2] * 255));
    for (let i = 1; i < st.length; i++) {
      if (nilai <= st[i][0]) {
        const a = st[i - 1];
        const b = st[i];
        const t = (nilai - a[0]) / (b[0] - a[0]);
        const ca = hexRgb(a[1]);
        const cb = hexRgb(b[1]);
        return [
          Math.round(ca[0] + (cb[0] - ca[0]) * t),
          Math.round(ca[1] + (cb[1] - ca[1]) * t),
          Math.round(ca[2] + (cb[2] - ca[2]) * t),
          Math.round((a[2] + (b[2] - a[2]) * t) * 255),
        ];
      }
    }
    return [0, 0, 0, 0];
  }

  // Warna kelas ribut (0 lutsinar).
  function warnaRibut(kelas) {
    const k = KELAS_RIBUT.find((x) => x.kelas === kelas);
    if (!k) return [0, 0, 0, 0];
    return hexRgb(k.hex).concat(Math.round(A * 255));
  }

  // CSS linear-gradient untuk bar legenda (alfa dipaparkan sebagai rgba).
  function gradienCss(ramp) {
    const min = ramp.stops[0][0];
    const jarak = ramp.stops[ramp.stops.length - 1][0] - min;
    const bahagian = ramp.stops.map((x) => {
      const c = hexRgb(x[1]);
      const a = Math.max(0.35, x[2]);
      return `rgba(${c[0]},${c[1]},${c[2]},${a}) ${(((x[0] - min) / jarak) * 100).toFixed(1)}%`;
    });
    return 'linear-gradient(90deg,' + bahagian.join(',') + ')';
  }

  const julat = (ramp) => [ramp.stops[0][0], ramp.stops[ramp.stops.length - 1][0]];

  return { RAMP, KELAS_RIBUT, hexRgb, warna, warnaRibut, gradienCss, julat };
});

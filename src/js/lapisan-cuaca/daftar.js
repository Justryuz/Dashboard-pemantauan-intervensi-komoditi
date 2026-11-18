'use strict';
// Daftar 10 lapisan cuaca, keadaan (S), integrasi peta MapLibre dan cangkuk ujian.
// Lapisan utama (satu sahaja): angin, hujan, suhu, awan, ombak, kumpulan, ribut. Tindihan: radar, satelit, siklon.
(function () {
  const NS = (window.FamaCuaca = window.FamaCuaca || {});
  const I = window.FamaInterp;
  const SK = NS.skala;
  const G = NS.gl;
  const Z = NS.zarah;
  const DT = NS.data;
  const ATR_OM = 'Data cuaca: Open-Meteo.com (CC BY 4.0)';
  const MSG_META = 'Data cuaca belum tersedia. Cuba lagi sebentar.';
  const TEMBAK_GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';

  let map = null;
  let sekarangUbah = null;
  NS.sekarang = () => (sekarangUbah !== null ? sekarangUbah : Date.now());

  // Ikon 16x16 (garis); dibina dengan createElementNS dalam kawalan.js
  const LAPISAN = [
    {
      id: 'radar',
      label: 'Radar cuaca',
      jenis: 'tindih',
      ikon: 'M8 8 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M8 8 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M8 8 L13 3',
    },
    {
      id: 'satelit',
      label: 'Satelit',
      jenis: 'tindih',
      ikon: 'M5 4 l4 4 -2 2 -4 -4z M8 7 l4 -4 M3 13 l3 -3 M10 11 a3 3 0 0 0 3 -3',
    },
    {
      id: 'angin',
      label: 'Angin',
      jenis: 'utama',
      ikon: 'M2 6 H10 a2 2 0 1 0 -2 -2 M2 10 H12 a2 2 0 1 1 -2 2',
      vars: ['wind_speed_10m', 'wind_direction_10m'],
    },
    {
      id: 'hujan',
      label: 'Hujan, petir',
      jenis: 'utama',
      ikon: 'M4 9 a3 3 0 0 1 1 -6 a4 4 0 0 1 7 2 a2.5 2.5 0 0 1 0 4z M5 12 l-1 2 M8 12 l-1 2 M11 12 l-1 2',
      vars: ['precipitation', 'weather_code', 'cape'],
    },
    {
      id: 'suhu',
      label: 'Suhu',
      jenis: 'utama',
      ikon: 'M7 2 h2 v7 a3 3 0 1 1 -2 0z',
      vars: ['temperature_2m'],
    },
    {
      id: 'siklon',
      label: 'Penjejak siklon',
      jenis: 'tindih',
      ikon: 'M8 8 m-1 0 a1 1 0 1 0 2 0 a3 3 0 1 0 -3 3 a5 5 0 1 0 4 -8',
    },
    {
      id: 'awan',
      label: 'Awan',
      jenis: 'utama',
      ikon: 'M4 12 a3 3 0 0 1 0 -6 a4 4 0 0 1 8 1 a2.5 2.5 0 0 1 0 5z',
      vars: ['cloud_cover'],
    },
    {
      id: 'ombak',
      label: 'Ombak',
      jenis: 'utama',
      ikon: 'M1 8 q2 -3 4 0 t4 0 t4 0 M1 12 q2 -3 4 0 t4 0 t4 0',
      vars: ['wave_height', 'wave_direction'],
    },
    {
      id: 'kumpulan',
      label: 'Kumpulan hujan',
      jenis: 'utama',
      ikon: 'M8 2 q4 5 4 8 a4 4 0 0 1 -8 0 q0 -3 4 -8z',
      vars: ['precipitation'],
    },
    {
      id: 'ribut',
      label: 'Ribut petir',
      jenis: 'utama',
      ikon: 'M9 1 L4 9 h4 l-1 6 5 -8 h-4z',
      vars: ['weather_code', 'cape', 'precipitation', 'cloud_cover'],
    },
  ];
  const cari = (id) => LAPISAN.find((l) => l.id === id);
  const OPSI_W = [3, 12, 24, 48, 72];
  const RAMP = {
    angin: 'angin',
    hujan: 'hujan',
    suhu: 'suhu',
    awan: 'awan',
    ombak: 'ombak',
    kumpulan: 'kumpulan',
  };

  const S = {
    utama: null,
    tindih: new Set(),
    jam: 0,
    mod: 'ramalan',
    time0: 0,
    W: 24,
    bermain: false,
    bingkai: 0,
    meta: null,
    data: null, // {nama: {jam: Float32Array[]}}
    kanvas: null,
    lapisan: new Map(), // id lapisan peta -> pangkat
    opa: {},
    radar: null,
    sat: null,
    siklon: null,
    mesej: '',
    mesejSat: '',
    ombakTiada: false,
    lumpuh: {}, // id -> sebab
    zarah: null,
    zarahMod: null,
    garisLayer: null,
    rantai: Promise.resolve(),
    petir: [],
    popup: null,
    popupToken: 0,
    kurangGerak: false,
    ralatTile: 0,
    ralatSat: 0,
    pemasaMain: null,
    siklonKlik: false,
  };
  NS.S = S;
  NS.LAPISAN = LAPISAN;
  NS.OPSI_W = OPSI_W;

  const kemas = () => {
    if (NS.kawalan && NS.kawalan.kemas) NS.kawalan.kemas();
  };

  // ---------- Masa ----------
  const fmtMYT = new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const masaMYT = (ms) => fmtMYT.format(new Date(ms));
  NS.masaMYT = masaMYT;

  function hitungTime0() {
    if (!S.meta) return 0;
    const d = new Date(NS.sekarang());
    d.setUTCMinutes(0, 0, 0);
    const kunci = d.toISOString().slice(0, 16) + 'Z';
    const i = S.meta.times.findIndex((t) => t >= kunci);
    return i < 0 ? S.meta.times.length - 1 : i;
  }
  const jumlahJam = () => (S.meta ? S.meta.times.length : 0);
  function bilStop() {
    if (!S.meta) return 0;
    if (S.utama === 'kumpulan') return I.kMaks(S.W, S.time0, jumlahJam()) + 1;
    return Math.min(73, jumlahJam() - S.time0);
  }
  const adaBingkai = () => S.tindih.has('radar') || S.tindih.has('satelit');
  function terbitMod() {
    if (!S.utama) return adaBingkai() ? 'imbasan' : null;
    return adaBingkai() ? S.mod : 'ramalan';
  }
  function senaraiBingkai() {
    if (S.tindih.has('radar') && S.radar) return S.radar.frames.map((f) => f.time * 1000);
    if (S.tindih.has('satelit') && S.sat) return S.sat.frames.map((t) => Date.parse(t));
    return [];
  }
  const masaSemasaMs = () => (S.meta ? Date.parse(S.meta.times[S.time0 + S.jam]) : NS.sekarang());

  // ---------- Peta: lapisan dan kedudukan ----------
  const gayaSedia = () =>
    new Promise((res) => {
      if (typeof gayaDimuat === 'undefined' || gayaDimuat) return res();
      map.once('style.load', () => res());
    });
  function asasSebelum() {
    const ls = map.getStyle().layers || [];
    const sim = ls.find((l) => l.type === 'symbol');
    if (sim) return sim.id;
    return ['banjir-stesen', 'amaran-cuaca-halo', 'amaran-cuaca'].find((i) => map.getLayer(i));
  }
  function sisipDi(pangkat) {
    let terbaik = null;
    S.lapisan.forEach((p, id) => {
      if (p > pangkat && map.getLayer(id) && (terbaik === null || p < terbaik[1]))
        terbaik = [id, p];
    });
    return terbaik ? terbaik[0] : asasSebelum();
  }
  function tambahLapisan(spec, pangkat) {
    if (map.getLayer(spec.id)) map.removeLayer(spec.id);
    map.addLayer(spec, sisipDi(pangkat));
    S.lapisan.set(spec.id, pangkat);
  }
  function buangLapisan(id) {
    if (map && map.getLayer(id)) map.removeLayer(id);
    S.lapisan.delete(id);
  }
  function buangSumber(id) {
    if (map && map.getSource(id)) map.removeSource(id);
  }

  // ---------- Kanvas isian ----------
  let geo = null;
  function geometri(meta) {
    const kunci = meta.nx + 'x' + meta.ny + JSON.stringify(meta.bbox);
    if (geo && geo.kunci === kunci) return geo;
    const b = meta.bbox;
    const W = (meta.nx - 1) * 16 + 1;
    const lebar = I.mercatorX(b.lonMax) - I.mercatorX(b.lonMin);
    const tinggi = I.mercatorY(b.latMin) - I.mercatorY(b.latMax);
    const H = Math.max(2, Math.round((W * tinggi) / lebar));
    const lats = I.mercatorBaris(b.latMin, b.latMax, H);
    const fx = new Float32Array(W);
    const fy = new Float32Array(H);
    for (let i = 0; i < W; i++) fx[i] = (i / (W - 1)) * (meta.nx - 1);
    for (let j = 0; j < H; j++)
      fy[j] = ((lats[j] - b.latMin) / (b.latMax - b.latMin)) * (meta.ny - 1);
    geo = { kunci, W, H, fx, fy };
    return geo;
  }
  const LUT = {};
  function jadualWarna(idRamp) {
    if (LUT[idRamp]) return LUT[idRamp];
    const r = SK.RAMP[idRamp];
    const [min, max] = SK.julat(r);
    const n = 1024;
    const t = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const w = SK.warna(r, min + ((max - min) * i) / (n - 1));
      t.set(w, i * 4);
    }
    LUT[idRamp] = { t, min, max, n };
    return LUT[idRamp];
  }
  function lukisKanvas(medan, idRamp, ribut, renorm) {
    const meta = S.meta;
    const g = geometri(meta);
    if (!S.kanvas) {
      S.kanvas = document.createElement('canvas');
    }
    if (S.kanvas.width !== g.W || S.kanvas.height !== g.H) {
      S.kanvas.width = g.W;
      S.kanvas.height = g.H;
    }
    const px = new Uint8ClampedArray(g.W * g.H * 4);
    const opsyen = renorm ? { renormalisasi: true } : undefined;
    const lut = ribut ? null : jadualWarna(idRamp);
    const wRibut = [0, 1, 2, 3, 4].map((k) => SK.warnaRibut(k));
    for (let j = 0; j < g.H; j++) {
      const fy = g.fy[j];
      for (let i = 0; i < g.W; i++) {
        const v = I.bilinear(medan, meta.nx, meta.ny, g.fx[i], fy, opsyen);
        if (v === null || v !== v) continue;
        const o = (j * g.W + i) * 4;
        if (ribut) {
          const c = wRibut[Math.max(0, Math.min(4, Math.round(v)))];
          px[o] = c[0];
          px[o + 1] = c[1];
          px[o + 2] = c[2];
          px[o + 3] = c[3];
        } else {
          let k = Math.round(((v - lut.min) / (lut.max - lut.min)) * (lut.n - 1));
          k = k < 0 ? 0 : k > lut.n - 1 ? lut.n - 1 : k;
          px[o] = lut.t[k * 4];
          px[o + 1] = lut.t[k * 4 + 1];
          px[o + 2] = lut.t[k * 4 + 2];
          px[o + 3] = lut.t[k * 4 + 3];
        }
      }
    }
    S.kanvas.getContext('2d').putImageData(new ImageData(px, g.W, g.H), 0, 0);
    return S.kanvas;
  }

  function medanKelas(h) {
    const v = S.data;
    const n = S.meta.nx * S.meta.ny;
    const k = new Float32Array(n);
    for (let c = 0; c < n; c++)
      k[c] = I.kelasRibut({
        code: v.weather_code.jam[h][c],
        cape: v.cape.jam[h][c],
        precip: v.precipitation.jam[h][c],
        cloud: v.cloud_cover.jam[h][c],
      });
    return k;
  }

  function medanAngin(h) {
    const v = S.data;
    const n = S.meta.nx * S.meta.ny;
    const u = new Float32Array(n);
    const w = new Float32Array(n);
    const lj = v.wind_speed_10m.jam[h];
    const ar = v.wind_direction_10m.jam[h];
    for (let c = 0; c < n; c++) {
      if (lj[c] !== lj[c] || ar[c] !== ar[c]) {
        u[c] = NaN;
        w[c] = NaN;
      } else {
        const r = I.uv(lj[c], ar[c]);
        u[c] = r.u;
        w[c] = r.v;
      }
    }
    return { nx: S.meta.nx, ny: S.meta.ny, bbox: S.meta.bbox, u, v: w };
  }

  // ---------- Lukis lapisan utama untuk jam semasa ----------
  function lukisUtama() {
    if (!S.utama || !S.data) return;
    const h = S.time0 + S.jam;
    const v = S.data;
    let kanvas;
    switch (S.utama) {
      case 'angin':
        kanvas = lukisKanvas(v.wind_speed_10m.jam[h], 'angin');
        break;
      case 'suhu':
        kanvas = lukisKanvas(v.temperature_2m.jam[h], 'suhu');
        break;
      case 'awan':
        kanvas = lukisKanvas(v.cloud_cover.jam[h], 'awan');
        break;
      case 'hujan':
        kanvas = lukisKanvas(v.precipitation.jam[h], 'hujan');
        break;
      case 'ombak':
        kanvas = lukisKanvas(v.wave_height.jam[h], 'ombak', false, true);
        break;
      case 'kumpulan':
        kanvas = lukisKanvas(I.kumpul(v.precipitation.jam, h, S.W), 'kumpulan');
        break;
      case 'ribut':
        kanvas = lukisKanvas(medanKelas(h), null, true);
        break;
      default:
        return;
    }
    const fill = map.getLayer('cuaca-fill') && S.fillLayer;
    if (fill) fill.setPiksel(kanvas);
    if (S.utama === 'angin' && S.zarah) S.zarah.setMedan(medanAngin(h));
    S.medanGaris = null;
    kemasPetir();
    if (map) map.triggerRepaint();
  }

  // ---------- Fill dan garis ----------
  function pasangFill() {
    buangLapisan('cuaca-fill');
    S.fillLayer = new G.FillLayer('cuaca-fill', S.meta.bbox, S.kanvas);
    tambahLapisan(S.fillLayer, 1);
  }
  function pasangGaris() {
    buangLapisan('cuaca-garis');
    S.garisLayer = null;
    S.zarahMod = null;
    if (S.utama === 'angin') {
      const h = S.time0 + S.jam;
      const m = medanAngin(h);
      if (S.kurangGerak) {
        S.garisLayer = new G.GarisLayer(
          'cuaca-garis',
          (mp) => Z.panahAngin(mp, S.medanA || m),
          [1, 1, 1],
        );
        S.medanA = m;
        S.zarahMod = 'panah';
      } else {
        if (!S.zarah) S.zarah = new Z.ParticleSystem();
        S.zarah.setMedan(m);
        S.zarah.mulaiSemua = true;
        S.garisLayer = new G.GarisLayer('cuaca-garis', (mp) => S.zarah.isiBucu(mp), [1, 1, 1]);
        S.zarahMod = 'zarah';
      }
    } else if (S.utama === 'ombak') {
      S.garisLayer = new G.GarisLayer(
        'cuaca-garis',
        (mp) =>
          Z.panahOmbak(mp, {
            nx: S.meta.nx,
            ny: S.meta.ny,
            bbox: S.meta.bbox,
            tinggi: S.data.wave_height.jam[S.time0 + S.jam],
            arah: S.data.wave_direction.jam[S.time0 + S.jam],
          }),
        [0.03, 0.14, 0.3],
      );
      S.zarahMod = 'panah';
    }
    if (S.garisLayer) tambahLapisan(S.garisLayer, 2);
  }
  function kemasMedanPanahAngin() {
    if (S.utama === 'angin' && S.kurangGerak) S.medanA = medanAngin(S.time0 + S.jam);
  }

  // ---------- Petir ----------
  function kemasPetir() {
    S.petir.forEach((m) => m.remove());
    S.petir = [];
    if (S.utama !== 'hujan' || !S.data || !map) return;
    const h = S.time0 + S.jam;
    const kod = S.data.weather_code.jam[h];
    const cape = S.data.cape.jam[h];
    const sel = [];
    for (let c = 0; c < kod.length; c++) if (kod[c] >= 95 && kod[c] <= 99) sel.push(c);
    sel.sort((a, b) => (cape[b] || 0) - (cape[a] || 0));
    const m = S.meta;
    const res = m.resDeg;
    sel.slice(0, 60).forEach((c) => {
      const lat = m.bbox.latMin + Math.floor(c / m.nx) * res;
      const lon = m.bbox.lonMin + (c % m.nx) * res;
      const el = document.createElement('div');
      el.className = 'cuaca-petir';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M9 1 L4 9 h4 l-1 6 5 -8 h-4z');
      p.setAttribute('fill', '#ffd400');
      p.setAttribute('stroke', '#5a3d00');
      p.setAttribute('stroke-width', '1');
      svg.append(p);
      el.append(svg);
      S.petir.push(
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map),
      );
    });
  }

  // ---------- Bingkai radar / satelit ----------
  function tambahBingkai(jenis) {
    const radar = jenis === 'radar';
    const d = radar ? S.radar : S.sat;
    const awalan = radar ? 'cuaca-radar-' : 'cuaca-sat-';
    const n = d.frames.length;
    for (let i = 0; i < n; i++) {
      const id = awalan + i;
      buangLapisan(id);
      buangSumber(id);
      const tiles = radar
        ? [d.host + d.frames[i].path + '/256/{z}/{x}/{y}/2/1_1.png']
        : [`${TEMBAK_GIBS}${d.lapisan}/default/${d.frames[i]}/${d.matriks}/{z}/{y}/{x}.png`];
      map.addSource(id, {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: radar ? 7 : d.maxzoom,
        attribution: radar ? 'RainViewer' : 'NASA GIBS / JMA Himawari',
      });
      tambahLapisan(
        {
          id,
          type: 'raster',
          source: id,
          paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 },
        },
        radar ? 3 : 0,
      );
    }
    S.opa[awalan] = null;
  }
  function buangBingkai(jenis) {
    const awalan = jenis === 'radar' ? 'cuaca-radar-' : 'cuaca-sat-';
    const d = jenis === 'radar' ? S.radar : S.sat;
    const n = d ? d.frames.length : 0;
    for (let i = 0; i < n; i++) {
      buangLapisan(awalan + i);
      buangSumber(awalan + i);
    }
    delete S.opa[awalan];
  }
  function tetapOpa(awalan, indeks, n, nilai) {
    if (S.opa[awalan] === indeks) return;
    for (let i = 0; i < n; i++) {
      const id = awalan + i;
      if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', i === indeks ? nilai : 0);
    }
    S.opa[awalan] = indeks;
  }
  function tunjukBingkai() {
    if (!map) return;
    const m = terbitMod();
    const imbasan = m === 'imbasan';
    let masaRadar = null;
    if (S.tindih.has('radar') && S.radar && S.radar.frames.length) {
      const F = S.radar.frames.length;
      const ri = imbasan ? Math.max(0, Math.min(S.bingkai, F - 1)) : F - 1;
      masaRadar = S.radar.frames[ri].time * 1000;
      tetapOpa('cuaca-radar-', ri, F, 0.75);
    }
    if (S.tindih.has('satelit') && S.sat && S.sat.frames.length) {
      const masa = S.sat.frames.map((t) => Date.parse(t));
      const F = masa.length;
      let si = F - 1;
      if (imbasan) {
        if (masaRadar !== null) {
          si = 0;
          masa.forEach((t, i) => {
            if (t <= masaRadar) si = i;
          });
        } else si = Math.max(0, Math.min(S.bingkai, F - 1));
      }
      tetapOpa('cuaca-sat-', si, F, 0.65);
    }
  }
  const tetapBingkaiAkhir = () => {
    S.bingkai = Math.max(0, senaraiBingkai().length - 1);
  };

  // ---------- Siklon ----------
  const WARNA_ARAS = ['match', ['get', 'aras'], 'Red', '#e5383b', 'Orange', '#ff9f1c', '#3fbf6a'];
  function pasangSiklon() {
    ['cuaca-siklon-titik', 'cuaca-siklon-ramal', 'cuaca-siklon-garis'].forEach(buangLapisan);
    buangSumber('cuaca-siklon');
    const fitur = [];
    ((S.siklon && S.siklon.siklon) || []).forEach((s) => {
      s.jejakLalu.forEach((g) =>
        fitur.push({
          type: 'Feature',
          properties: { aras: s.aras, ramal: false },
          geometry: { type: 'LineString', coordinates: g },
        }),
      );
      s.jejakRamalan.forEach((g) =>
        fitur.push({
          type: 'Feature',
          properties: { aras: s.aras, ramal: true },
          geometry: { type: 'LineString', coordinates: g },
        }),
      );
      fitur.push({
        type: 'Feature',
        properties: {
          aras: s.aras,
          id: s.id,
          nama: s.nama,
          kategori: s.kategori,
          angin: s.anginKmj,
          dari: s.dari,
          hingga: s.hingga,
          negara: s.negara,
          pautan: s.pautan || '',
        },
        geometry: { type: 'Point', coordinates: s.pos },
      });
    });
    map.addSource('cuaca-siklon', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: fitur },
      attribution: 'GDACS',
    });
    tambahLapisan(
      {
        id: 'cuaca-siklon-garis',
        type: 'line',
        source: 'cuaca-siklon',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'ramal'], false]],
        paint: { 'line-color': WARNA_ARAS, 'line-width': 2.5 },
      },
      4,
    );
    tambahLapisan(
      {
        id: 'cuaca-siklon-ramal',
        type: 'line',
        source: 'cuaca-siklon',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'ramal'], true]],
        paint: { 'line-color': WARNA_ARAS, 'line-width': 2.5, 'line-dasharray': [2, 2] },
      },
      4,
    );
    tambahLapisan(
      {
        id: 'cuaca-siklon-titik',
        type: 'circle',
        source: 'cuaca-siklon',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': WARNA_ARAS,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      4,
    );
    if (!S.siklonKlik) {
      S.siklonKlik = true;
      map.on('click', 'cuaca-siklon-titik', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        bukaPopupSiklon(f.properties, e.lngLat);
      });
    }
  }
  function bukaPopupSiklon(p, lngLat) {
    const kot = document.createElement('div');
    kot.className = 'cuaca-popup-isi';
    const t = document.createElement('b');
    t.textContent = p.nama + ' (' + p.kategori + ')';
    kot.append(t);
    const baris = (a, b) => {
      const d = document.createElement('div');
      d.textContent = a + ': ' + b;
      kot.append(d);
    };
    baris('Tahap amaran', p.aras);
    if (p.angin !== null && p.angin !== undefined && p.angin !== 'null')
      baris('Angin maksimum', p.angin + ' km/j');
    baris(
      'Tempoh',
      String(p.dari || '-').slice(0, 10) + ' hingga ' + String(p.hingga || '-').slice(0, 10),
    );
    if (p.negara) baris('Negara', p.negara);
    if (typeof p.pautan === 'string' && p.pautan.startsWith('https://www.gdacs.org/')) {
      const a = document.createElement('a');
      a.href = p.pautan;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'GDACS';
      a.className = 'gmaps-link';
      kot.append(a);
    }
    tutupPopup();
    S.popup = new maplibregl.Popup({ className: 'cuaca-popup', maxWidth: '260px' })
      .setLngLat(lngLat)
      .setDOMContent(kot)
      .addTo(map);
  }
  const tutupPopup = () => {
    if (S.popup) S.popup.remove();
    S.popup = null;
  };

  // ---------- Penyahaktifan ----------
  function nyahUtama() {
    buangLapisan('cuaca-fill');
    buangLapisan('cuaca-garis');
    S.fillLayer = null;
    S.garisLayer = null;
    S.zarahMod = null;
    S.petir.forEach((m) => m.remove());
    S.petir = [];
    S.kanvas = null;
    S.data = null;
    S.utama = null;
    S.medanA = null;
  }

  // ---------- togol ----------
  function jeda() {
    S.bermain = false;
    if (S.pemasaMain) clearInterval(S.pemasaMain);
    S.pemasaMain = null;
    kemas();
  }
  function mainkan() {
    const m = terbitMod();
    if (!m) return;
    if (S.pemasaMain) clearInterval(S.pemasaMain);
    S.bermain = true;
    S.pemasaMain = setInterval(langkah, m === 'ramalan' ? 600 : 450);
    kemas();
  }
  function langkah() {
    const m = terbitMod();
    if (!m || document.hidden) return;
    if (m === 'ramalan') tetapJam((S.jam + 1) % Math.max(1, bilStop()));
    else {
      const F = senaraiBingkai().length;
      if (!F) return;
      S.bingkai = (S.bingkai + 1) % F;
      tunjukBingkai();
      kemas();
    }
  }
  function tetapJam(k) {
    const n = bilStop();
    S.jam = Math.max(0, Math.min(Math.max(0, n - 1), Math.round(Number(k)) || 0));
    kemasMedanPanahAngin();
    lukisUtama();
    kemas();
  }
  function tetapSlider(v) {
    jeda();
    if (terbitMod() === 'imbasan') {
      const F = senaraiBingkai().length;
      S.bingkai = Math.max(0, Math.min(F - 1, Math.round(Number(v)) || 0));
      tunjukBingkai();
      kemas();
    } else tetapJam(v);
  }
  function tetapMod(m) {
    if (!S.utama || !adaBingkai() || (m !== 'ramalan' && m !== 'imbasan')) return;
    jeda();
    S.mod = m;
    if (m === 'imbasan') tetapBingkaiAkhir();
    tunjukBingkai();
    kemas();
  }
  function tetapW(w) {
    if (!S.meta || !OPSI_W.includes(w)) return;
    if (jumlahJam() - 1 - S.time0 - w < 0) return;
    S.W = w;
    S.jam = Math.min(S.jam, Math.max(0, bilStop() - 1));
    if (S.utama === 'kumpulan') lukisUtama();
    kemas();
  }
  function sediaW() {
    // pilih W yang tersedia; pulangkan false jika tiada
    if (jumlahJam() - 1 - S.time0 - S.W >= 0) return true;
    const ada = OPSI_W.filter((w) => jumlahJam() - 1 - S.time0 - w >= 0);
    if (!ada.length) return false;
    S.W = ada[ada.length - 1];
    return true;
  }
  const wTersedia = (w) => !!S.meta && jumlahJam() - 1 - S.time0 - w >= 0;

  async function aktifkanUtama(l) {
    const meta = await DT.muatMeta(true);
    if (l.id === 'ombak' && !(meta.sumber && meta.sumber.ombak === 'ok')) {
      S.ombakTiada = true;
      S.lumpuh.ombak = 'Data ombak tidak tersedia';
      S.mesej = 'Data ombak tidak tersedia';
      return;
    }
    const nama = l.vars;
    const hasil = await Promise.all(nama.map((n) => DT.muatVar(n)));
    const data = {};
    nama.forEach((n, i) => (data[n] = hasil[i]));
    // dapat semua data: tukar keadaan
    const pra = S.meta;
    S.meta = meta;
    S.time0 = hitungTime0();
    if (l.id === 'kumpulan' && !sediaW()) {
      S.meta = pra;
      S.mesej = 'Data tidak mencukupi untuk kumpulan hujan';
      return;
    }
    jeda();
    nyahUtama();
    S.utama = l.id;
    S.data = data;
    S.mod = 'ramalan';
    S.mesej = '';
    S.jam = Math.min(S.jam, Math.max(0, bilStop() - 1));
    await gayaSedia();
    lukisUtama();
    pasangFill();
    pasangGaris();
    tunjukBingkai();
  }

  async function togolUtama(l) {
    if (S.utama === l.id) {
      jeda();
      nyahUtama();
      S.mesej = '';
      tunjukBingkai();
      return;
    }
    try {
      await aktifkanUtama(l);
    } catch (e) {
      S.mesej = MSG_META;
    }
  }

  async function togolTindih(l) {
    const id = l.id;
    if (S.tindih.has(id)) {
      jeda();
      S.tindih.delete(id);
      if (id === 'siklon') {
        ['cuaca-siklon-titik', 'cuaca-siklon-ramal', 'cuaca-siklon-garis'].forEach(buangLapisan);
        buangSumber('cuaca-siklon');
        tutupPopup();
      } else {
        buangBingkai(id === 'radar' ? 'radar' : 'satelit');
        if (!adaBingkai()) S.mod = 'ramalan';
        tetapBingkaiAkhir();
        tunjukBingkai();
      }
      S.mesej = '';
      return;
    }
    try {
      if (id === 'siklon') {
        S.siklon = await DT.muatSiklon();
        await gayaSedia();
        S.tindih.add('siklon');
        pasangSiklon();
      } else if (id === 'radar') {
        const d = await DT.muatRadar();
        if (!d.frames || !d.frames.length) {
          S.lumpuh.radar = 'Radar tidak tersedia untuk Malaysia daripada sumber ini';
          S.mesej = S.lumpuh.radar;
          return;
        }
        S.radar = d;
        await gayaSedia();
        jeda();
        S.tindih.add('radar');
        tambahBingkai('radar');
        tetapBingkaiAkhir();
        tunjukBingkai();
        S.mesej = '';
      } else {
        const d = await DT.muatSatelit();
        if (!d.frames || !d.frames.length) {
          S.lumpuh.satelit = 'Satelit tidak tersedia buat masa ini';
          S.mesej = S.lumpuh.satelit;
          return;
        }
        S.sat = d;
        await gayaSedia();
        jeda();
        S.tindih.add('satelit');
        tambahBingkai('satelit');
        tetapBingkaiAkhir();
        tunjukBingkai();
        S.mesej = '';
        S.mesejSat = '';
        S.ralatSat = 0;
      }
    } catch (e) {
      S.mesej =
        id === 'siklon'
          ? 'Maklumat siklon tidak dapat dimuatkan'
          : id === 'radar'
            ? 'Radar tidak tersedia untuk Malaysia daripada sumber ini'
            : 'Satelit tidak tersedia buat masa ini';
    }
  }

  function togol(id) {
    const l = cari(id);
    if (!l || !map) return Promise.resolve();
    S.rantai = S.rantai
      .then(() => (l.jenis === 'utama' ? togolUtama(l) : togolTindih(l)))
      .catch(() => {})
      .then(() => kemas());
    return S.rantai;
  }

  // ---------- Penyemakan semula selepas tukar peta asas ----------
  function pasangSemula() {
    if (!map) return;
    S.lapisan.clear();
    S.opa = {};
    S.fillLayer = null;
    if (S.tindih.has('satelit') && S.sat) tambahBingkai('satelit');
    if (S.utama && S.data && S.meta) {
      pasangFill();
      pasangGaris();
    }
    if (S.tindih.has('radar') && S.radar) tambahBingkai('radar');
    if (S.tindih.has('siklon')) pasangSiklon();
    tunjukBingkai();
    kemas();
  }

  // ---------- Pemeriksa titik ----------
  const tahap = (v, d) =>
    v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d;
  async function bukaInspektor(lat, lon) {
    const token = ++S.popupToken;
    const kot = document.createElement('div');
    kot.className = 'cuaca-popup-isi';
    const pos = [lon, lat];
    const b = S.meta && S.meta.bbox;
    const luar = !b || lat < b.latMin || lat > b.latMax || lon < b.lonMin || lon > b.lonMax;
    const pasang = () => {
      if (token !== S.popupToken) return;
      tutupPopup();
      S.popup = new maplibregl.Popup({ className: 'cuaca-popup', maxWidth: '280px' })
        .setLngLat(pos)
        .setDOMContent(kot)
        .addTo(map);
    };
    const baris = (nama, label, nilai) => {
      const d = document.createElement('div');
      d.className = 'cuaca-baris';
      const a = document.createElement('span');
      a.textContent = label;
      const c = document.createElement('b');
      c.textContent = nilai.teks;
      c.setAttribute('data-nama', nama);
      if (nilai.angka !== undefined && nilai.angka !== null)
        c.setAttribute('data-nilai', String(nilai.angka));
      d.append(a, c);
      kot.append(d);
    };
    if (luar) {
      kot.textContent = 'Di luar liputan data cuaca';
      pasang();
      return;
    }
    try {
      const r = await DT.muatTitik(tahap(lat, 3), tahap(lon, 3));
      if (token !== S.popupToken) return;
      const h = S.time0 + S.jam;
      const n = (k) => (r.nilai[k] ? r.nilai[k][h] : null);
      const tajuk = document.createElement('b');
      tajuk.textContent = `${lat.toFixed(2)}°U, ${lon.toFixed(2)}°T · ${masaMYT(Date.parse(r.times[h]))}`;
      kot.append(tajuk);
      const dua = (x) => (x === null ? '-' : String(tahap(x, 1)));
      if (n('temperature_2m') !== null)
        baris('temperature_2m', 'Suhu', {
          teks: dua(n('temperature_2m')) + ' °C',
          angka: n('temperature_2m'),
        });
      if (n('wind_speed_10m') !== null) {
        const arah = n('wind_direction_10m');
        baris('wind_speed_10m', 'Angin', {
          teks:
            dua(n('wind_speed_10m')) +
            ' km/j' +
            (arah === null ? '' : ' ' + I.arahMata(arah) + ' (' + Math.round(arah) + '°)'),
          angka: n('wind_speed_10m'),
        });
      }
      if (n('wind_gusts_10m') !== null)
        baris('wind_gusts_10m', 'Hembusan', {
          teks: dua(n('wind_gusts_10m')) + ' km/j',
          angka: n('wind_gusts_10m'),
        });
      if (n('cloud_cover') !== null)
        baris('cloud_cover', 'Awan', {
          teks: dua(n('cloud_cover')) + ' %',
          angka: n('cloud_cover'),
        });
      if (n('precipitation') !== null)
        baris('precipitation', 'Hujan', {
          teks: dua(n('precipitation')) + ' mm',
          angka: n('precipitation'),
        });
      if (n('rain') !== null || n('showers') !== null)
        baris('rain', 'Hujan lebat / zarah', {
          teks: dua(n('rain')) + ' / ' + dua(n('showers')) + ' mm',
          angka: n('rain'),
        });
      if (n('weather_code') !== null)
        baris('weather_code', 'Keadaan', {
          teks: I.teksWMO(n('weather_code')),
          angka: n('weather_code'),
        });
      if (n('cape') !== null)
        baris('cape', 'CAPE', { teks: dua(n('cape')) + ' J/kg', angka: n('cape') });
      if (n('wave_height') !== null) {
        const p = n('wave_period');
        const d = n('wave_direction');
        baris('wave_height', 'Ombak', {
          teks:
            dua(n('wave_height')) +
            ' m' +
            (p === null ? '' : ' · ' + dua(p) + ' s') +
            (d === null ? '' : ' · ' + Math.round(d) + '°'),
          angka: n('wave_height'),
        });
      }
      const p = document.createElement('div');
      p.className = 'gmaps-baris';
      p.append(
        typeof gmapsPautan === 'function' ? gmapsPautan(lat, lon) : document.createTextNode(''),
      );
      kot.append(p);
    } catch (e) {
      if (token !== S.popupToken) return;
      kot.textContent = 'Nilai tidak dapat diambil. Cuba lagi.';
    }
    pasang();
  }

  function klikPeta(e) {
    if (!S.utama || !S.meta) return;
    if (e.originalEvent && e.originalEvent.target !== map.getCanvas()) return;
    const lapis = ['banjir-stesen', 'amaran-cuaca', 'cuaca-siklon-titik'].filter((i) =>
      map.getLayer(i),
    );
    if (lapis.length && map.queryRenderedFeatures(e.point, { layers: lapis }).length) return;
    bukaInspektor(e.lngLat.lat, e.lngLat.lng);
  }

  // ---------- Legenda ----------
  function maklumatLegenda(id) {
    const meta = S.meta;
    const aktif = id === S.utama || S.tindih.has(id);
    if (!aktif) return null;
    const rampMilik = (r) => {
      const ramp = SK.RAMP[r];
      const [min, max] = SK.julat(ramp);
      return { unit: ramp.unit, min, max, gradien: SK.gradienCss(ramp) };
    };
    let o;
    switch (id) {
      case 'angin':
        o = { tajuk: 'Angin', ...rampMilik('angin') };
        break;
      case 'hujan':
        o = { tajuk: 'Hujan, petir', ...rampMilik('hujan'), nota: 'Simbol petir: kod cuaca 95-99' };
        break;
      case 'suhu':
        o = { tajuk: 'Suhu', ...rampMilik('suhu') };
        break;
      case 'awan':
        o = { tajuk: 'Awan', ...rampMilik('awan') };
        break;
      case 'ombak':
        o = { tajuk: 'Ombak', ...rampMilik('ombak'), nota: 'Garis pantai kasar (grid 0.5°)' };
        break;
      case 'kumpulan':
        o = {
          tajuk: 'Kumpulan hujan',
          ...rampMilik('kumpulan'),
          mesej:
            `Jumlah ${S.W} jam selepas ${meta ? masaMYT(masaSemasaMs()) : ''}` +
            (meta && I.kMaks(S.W, S.time0, jumlahJam()) === 0 ? ' · Satu masa tetap' : ''),
        };
        break;
      case 'ribut':
        o = {
          tajuk: 'Kebarangkalian ribut petir (anggaran)',
          unit: 'kelas',
          min: 1,
          max: 4,
          kelas: SK.KELAS_RIBUT,
        };
        break;
      case 'radar':
        o = {
          tajuk: 'Radar cuaca',
          unit: 'Ringan → Lebat',
          min: null,
          max: null,
          gradien: 'linear-gradient(90deg,#7fd1ae,#f1e45a,#e5522e,#8f1d6b)',
        };
        break;
      case 'satelit':
        o = {
          tajuk: 'Satelit inframerah',
          unit: 'Himawari IR (puncak awan)',
          min: null,
          max: null,
          mesej: S.mesejSat || '',
        };
        break;
      case 'siklon':
        o = {
          tajuk: 'Penjejak siklon',
          unit: 'Tahap amaran GDACS',
          min: null,
          max: null,
          aras: [
            ['Green', '#3fbf6a'],
            ['Orange', '#ff9f1c'],
            ['Red', '#e5383b'],
          ],
          mesej:
            S.siklon && S.siklon.siklon && S.siklon.siklon.length === 0
              ? 'Tiada siklon tropika aktif di rantau ini'
              : '',
        };
        break;
      default:
        return null;
    }
    o.id = id;
    o.atribusi =
      { radar: 'RainViewer', satelit: 'NASA GIBS / JMA Himawari', siklon: 'GDACS' }[id] || ATR_OM;
    if (cari(id).jenis === 'utama' && meta) {
      if (meta.lapuk)
        o.mesej =
          (o.mesej ? o.mesej + ' · ' : '') +
          `Data tidak dikemas kini sejak ${Math.round(meta.umurJam)} j`;
      if (bilStop() < 6 && id !== 'kumpulan')
        o.mesej = (o.mesej ? o.mesej + ' · ' : '') + 'Data ramalan sudah lapuk';
    }
    return o;
  }
  function legendaSemua() {
    const ids = [];
    if (S.utama) ids.push(S.utama);
    ['radar', 'satelit', 'siklon'].forEach((i) => S.tindih.has(i) && ids.push(i));
    return ids.map(maklumatLegenda).filter(Boolean);
  }
  NS.legendaSemua = legendaSemua;
  NS.maklumatLegenda = maklumatLegenda;
  NS.keadaanKawalan = () => ({
    mod: terbitMod(),
    jam: S.jam,
    bilStop: bilStop(),
    bingkai: S.bingkai,
    bilBingkai: senaraiBingkai().length,
    bermain: S.bermain,
    utama: S.utama,
    tindih: [...S.tindih],
    W: S.W,
    bolehPilihMod: !!S.utama && adaBingkai(),
    label: labelMasa(),
    mesej: S.mesej,
    lumpuh: S.lumpuh,
    wTersedia,
  });
  function labelMasa() {
    const m = terbitMod();
    if (!m) return '';
    if (m === 'ramalan') {
      const t = S.meta ? masaMYT(masaSemasaMs()) : '';
      return S.utama === 'kumpulan' ? t + ' (+' + S.W + ' j)' : t;
    }
    const ms = senaraiBingkai();
    if (!ms.length) return '';
    const t = ms[Math.min(S.bingkai, ms.length - 1)];
    const lalu = Math.round((NS.sekarang() - t) / 60000);
    return masaMYT(t) + ' (imbasan' + (lalu > 0 ? ', -' + lalu + ' min' : '') + ')';
  }

  // ---------- Sedia ----------
  function sedia(m) {
    map = m;
    const bingkai = map.getContainer().parentElement;
    if (bingkai) {
      bingkai.classList.add('peta-berlapis');
      // Bingkai membesar (410 -> 540px) selepas peta dicipta; tanpa resize kanvas
      // kekal pada saiz lama dan bahagian bawah peta nampak terpotong.
      map.resize();
      requestAnimationFrame(() => map.resize());
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => map.resize()).observe(bingkai);
      }
    }
    map.on('error', (e) => {
      const sid = e && e.sourceId;
      if (sid && String(sid).startsWith('cuaca-')) {
        S.ralatTile++;
        if (S.sat && S.sat.frames.length > 1 && sid === 'cuaca-sat-' + (S.sat.frames.length - 1)) {
          S.ralatSat++;
          if (S.ralatSat >= 5) sembunyiBingkaiSatTerkini();
        }
        return;
      }
      console.error(e && e.error ? e.error : e);
    });
    map.on('click', klikPeta);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (S.pemasaMain) jeda();
      } else if (S.zarahMod === 'zarah' && map) map.triggerRepaint();
    });
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    S.kurangGerak = !!(mq && mq.matches);
    if (mq && mq.addEventListener)
      mq.addEventListener('change', () => {
        S.kurangGerak = mq.matches;
        if (S.utama === 'angin' && map.getLayer('cuaca-fill')) {
          pasangGaris();
          kemas();
        }
      });
    NS.padaTidakSokong = () => {
      S.mesej = 'Pelayar tidak menyokong lapisan ini (WebGL)';
      kemas();
    };
  }
  function sembunyiBingkaiSatTerkini() {
    const i = S.sat.frames.length - 1;
    buangLapisan('cuaca-sat-' + i);
    buangSumber('cuaca-sat-' + i);
    S.sat.frames = S.sat.frames.slice(0, i);
    S.mesejSat = 'Bingkai satelit terkini belum ada';
    S.ralatSat = 0;
    S.opa['cuaca-sat-'] = null;
    tetapBingkaiAkhir();
    tunjukBingkai();
    kemas();
  }

  NS.sedia = sedia;
  NS.pasangSemula = pasangSemula;
  NS.togol = togol;
  NS.tetapJam = tetapJam;
  NS.tetapSlider = tetapSlider;
  NS.tetapMod = tetapMod;
  NS.tetapW = tetapW;
  NS.mainkan = mainkan;
  NS.jeda = jeda;

  function cincang() {
    if (!S.kanvas) return null;
    const c = S.kanvas;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0x811c9dc5;
    let legap = 0;
    const beza = new Set();
    const u32 = new Uint32Array(d.buffer, d.byteOffset, d.length / 4);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        legap++;
        beza.add(u32[i / 4]);
      }
    }
    for (let i = 0; i < d.length; i++) {
      h ^= d[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return { w: c.width, h: c.height, hash: h >>> 0, legap, warnaBeza: beza.size };
  }

  NS.ujian = {
    senaraiMenu: () =>
      LAPISAN.map((l) => {
        const b = document.querySelector('#cuacaMenu [data-lapisan="' + l.id + '"]');
        return {
          id: l.id,
          label: b ? b.querySelector('.cuaca-label').textContent : l.label,
          ditekan: !!b && b.getAttribute('aria-pressed') === 'true',
          dilumpuhkan: !!b && b.disabled,
        };
      }),
    aktif: () => ({
      utama: S.utama,
      tindih: [...S.tindih],
      jam: S.jam,
      mod: terbitMod(),
      bermain: S.bermain,
      W: S.W,
      indeksMasa0: S.time0,
      bingkai: S.bingkai,
      bilStop: bilStop(),
    }),
    lapisanPeta: () =>
      [...S.lapisan.keys()]
        .filter((id) => map && map.getLayer(id))
        .map((id) => ({ id, type: map.getLayer(id).type })),
    kanvas: () => {
      const r = cincang();
      if (!r) return null;
      r.sampel = (lon, lat) => {
        const g = geometri(S.meta);
        const b = S.meta.bbox;
        const i = Math.round(((lon - b.lonMin) / (b.lonMax - b.lonMin)) * (g.W - 1));
        const yy = I.mercatorY(lat);
        const y0 = I.mercatorY(b.latMax);
        const y1 = I.mercatorY(b.latMin);
        const j = Math.round(((yy - y0) / (y1 - y0)) * (g.H - 1));
        return Array.from(S.kanvas.getContext('2d').getImageData(i, j, 1, 1).data);
      };
      return r;
    },
    zarah: () => ({
      mod: S.zarahMod,
      bilangan:
        S.zarahMod === 'zarah' && S.zarah ? S.zarah.bilangan() : S.zarahMod === 'panah' ? 1 : 0,
      denyutan:
        S.zarahMod === 'zarah' && S.zarah
          ? S.zarah.denyutan
          : S.garisLayer
            ? S.garisLayer.denyutan
            : 0,
    }),
    legenda: (id) => {
      const o = maklumatLegenda(id || S.utama || [...S.tindih][S.tindih.size - 1]);
      if (!o) return null;
      return {
        id: o.id,
        tajuk: o.tajuk,
        unit: o.unit,
        min: o.min,
        max: o.max,
        atribusi: o.atribusi,
        mesej: o.mesej || '',
      };
    },
    mesej: () => S.mesej,
    bawahTampak: () => {
      const e = document.getElementById('cuacaBawah');
      return !!e && !e.hidden && e.getClientRects().length > 0;
    },
    bingkaiTampak: () => {
      const hasil = { radar: null, sat: null };
      if (!map) return hasil;
      const cari = (awalan, n) => {
        for (let i = 0; i < n; i++)
          if (map.getLayer(awalan + i) && map.getPaintProperty(awalan + i, 'raster-opacity') > 0)
            return i;
        return null;
      };
      hasil.radar = cari('cuaca-radar-', S.radar ? S.radar.frames.length : 0);
      hasil.sat = cari('cuaca-sat-', S.sat ? S.sat.frames.length : 0);
      return hasil;
    },
    petir: () => S.petir.length,
    tetapJam,
    togol,
    mainkan,
    jeda,
    tetapMod,
    tetapW,
    tetapSekarang: (ms) => {
      sekarangUbah = ms === null || ms === undefined ? null : Number(ms);
      if (S.meta) {
        S.time0 = hitungTime0();
        S.jam = Math.min(S.jam, Math.max(0, bilStop() - 1));
        if (S.utama) {
          pasangGaris();
          lukisUtama();
        }
        kemas();
      }
    },
    klikTitik: (lat, lon) => bukaInspektor(lat, lon),
    ralatTile: () => S.ralatTile,
  };
})();

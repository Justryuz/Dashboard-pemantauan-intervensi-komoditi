'use strict';
/* Lapisan "Amaran Rasmi" pada peta Pemantauan. Satu sumber kebenaran: senarai yang sama dengan yang dipaparkan panel
   EWS > Amaran Rasmi (window.famaAmaranRasmi() / peristiwa 'fama:amaran-rasmi' daripada app.js: gabungan MET + data.gov.my
   + JPS, dedupe, susunan, 7 terkini + amaran aktif, Aktif/Tamat pada 'kini' yang sama). Modul ini tidak mengambil data sendiri.
   Hanya amaran AKTIF dipetakan. Satu penanda setiap negeri (titik tengah negeri, GeoJSON daerah, FamaDaerah): beberapa amaran
   dalam negeri sama dikumpul dalam satu penanda (lencana kiraan, warna tahap tertinggi). Daerah bernama dalam teks
   ("Sabah: Telupid, Paitan") diwarnakan sebagai poligon (garis nipis + isian ringan), bukan penanda. Amaran laut sahaja ->
   satu penanda pada kawasan laut anggaran pertama (jadual LAUT), kawasan lain disenarai dalam pop-up; yang tidak dapat
   dikenal pasti tidak dipetakan (tiada lokasi direka). Warna tahap dibaca daripada CSS cip tahap panel
   (.alert-tahap.t-*), jadi tiada pemetaan warna kedua. Dimuat selepas lapisan-daerah.js. Tiada skrip sebaris (CSP). */
(function () {
  const SUMBER_T = 'amaran-cuaca';
  const SUMBER_D = 'amaran-daerah';
  const L_ISI = 'amaran-daerah-isi';
  const L_GARIS = 'amaran-daerah-garis';
  const L_BILANG = 'amaran-cuaca-bilang';
  const L_HALO = 'amaran-cuaca-halo';
  const L_DENYUT = 'amaran-cuaca-denyut';
  const L_TITIK = 'amaran-cuaca';
  const TAHAP = ['BAHAYA', 'BURUK', 'WASPADA', 'UMUM'];
  const ADA = () => typeof map !== 'undefined' && !!map;
  const kurangGerak = () =>
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Kawasan laut MET (pusat anggaran, darjah lon/lat). Hanya nama yang pusatnya diketahui; nama lain dilaporkan tidak dipetakan.
  // Susunan penting: nama lebih panjang dahulu (teks yang dipadan dibuang sebelum nama pendek diuji).
  const LAUT = [
    ['selat melaka utara', 'Selat Melaka Utara', [99.3, 5.9]],
    ['selat melaka selatan', 'Selat Melaka Selatan', [101.6, 2.6]],
    ['selat melaka', 'Selat Melaka', [100.6, 4.0]],
    ['laut china selatan', 'Laut China Selatan', [111.0, 5.5]],
    ['johor timur', 'Perairan Johor Timur', [104.5, 2.4]],
    ['layang-layang', 'Layang-Layang', [113.85, 7.37]],
    ['tioman', 'Tioman', [104.2, 2.8]],
    ['samui', 'Samui', [100.0, 9.5]],
    ['phuket', 'Phuket', [98.4, 7.9]],
    ['condore', 'Condore', [106.6, 8.7]],
    ['bunguran', 'Bunguran', [108.0, 4.0]],
    ['palawan', 'Palawan', [118.7, 9.8]],
    ['sulawesi', 'Laut Sulawesi', [121.0, 3.5]],
    ['sulu', 'Laut Sulu', [120.0, 8.0]],
    ['labuan', 'Perairan Labuan', [115.0, 5.4]],
    ['perak', 'Perairan Perak', [100.3, 4.2]],
    ['pahang', 'Perairan Pahang', [103.9, 3.6]],
    ['terengganu', 'Perairan Terengganu', [103.9, 5.0]],
    ['kelantan', 'Perairan Kelantan', [102.9, 6.4]],
    ['sarawak', 'Perairan Sarawak', [112.3, 3.9]],
    ['sabah', 'Perairan Sabah', [116.0, 6.6]],
  ];
  // Disebut MET tetapi pusatnya tidak disahkan: tidak dipetakan.
  const LAUT_TAK_TAHU = [
    ['reef north', 'Reef North'],
    ['reef south', 'Reef South'],
  ];

  const ST = {
    tunjuk: true,
    warna: null,
    kumpulan: new Map(), // kunci -> kumpulan (penanda)
    poligon: new Map(), // kunci daerah -> {..., idx:[]}
    perItem: new Map(), // indeks amaran -> [kunci]
    hasil: new Map(), // indeks amaran -> {marin, tempat:[kunci], tidakDipeta:[nama], tidakPadan:[nama]}
    popup: null,
    popupKunci: null,
    pengendali: false,
    pemasa: null,
    sorotPemasa: null,
    menunggu: false,
  };

  /* ---------- Warna: daripada cip tahap panel ---------- */
  function warnaTahap() {
    if (ST.warna) return ST.warna;
    const w = {};
    TAHAP.forEach((t) => {
      const e = document.createElement('span');
      e.className = 'alert-tahap t-' + t.toLowerCase();
      e.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
      document.body.append(e);
      w[t] = getComputedStyle(e).color;
      e.remove();
    });
    ST.warna = w;
    return w;
  }
  const tahapSah = (t) => (TAHAP.includes(t) ? t : 'UMUM');

  /* ---------- Padanan lokasi ---------- */
  const D = () => window.FamaDaerah;
  const nn = (s) => D().norm(s).replace(/^wp/, '');
  let negeriGeo = null; // nn(negeri) -> nama negeri dalam GeoJSON
  function indeksNegeri() {
    if (negeriGeo) return negeriGeo;
    negeriGeo = new Map();
    D()
      .semuaFitur()
      .forEach((f) => negeriGeo.set(nn(f.properties.negeri), f.properties.negeri));
    return negeriGeo;
  }
  function titikNegeri(geoNegeri) {
    const fs = D()
      .semuaFitur()
      .filter(
        (f) =>
          f.properties.negeri === geoNegeri &&
          Number.isFinite(f.properties.lon) &&
          Number.isFinite(f.properties.lat),
      );
    if (!fs.length) return null;
    return [
      fs.reduce((a, f) => a + f.properties.lon, 0) / fs.length,
      fs.reduce((a, f) => a + f.properties.lat, 0) / fs.length,
    ];
  }
  // Pecah pada koma/•/; peringkat atas (tidak dalam kurungan)
  function pecahAtas(s) {
    const hasil = [];
    let dalam = 0;
    let cur = '';
    for (const c of s) {
      if (c === '(') dalam++;
      if (c === ')') dalam = Math.max(0, dalam - 1);
      if (!dalam && /[,•;]/.test(c)) {
        hasil.push(cur);
        cur = '';
      } else cur += c;
    }
    hasil.push(cur);
    return hasil.map((x) => x.trim()).filter(Boolean);
  }
  const pecahNama = (s) =>
    s
      .split(/,|•|;|\bdan\b|\//i)
      .map((x) => x.trim())
      .filter(Boolean);
  // Segmen "Negeri: a, b (c dan d)" daripada teks amaran darat
  function segmenNegeri(teks) {
    const nama = [...indeksNegeri().keys()];
    const senarai = [
      ...new Set([
        ...[...indeksNegeri().values()].map((v) => v.replace(/^W\.P\.\s*/i, '')),
        'Kuala Lumpur',
        'Labuan',
        'Putrajaya',
      ]),
    ];
    if (!nama.length) return [];
    const re = new RegExp('(' + senarai.map((x) => x.replace(/\./g, '\\.')).join('|') + ')\\s*:', 'gi');
    const t = String(teks || '').replace(/\s+/g, ' ');
    const kena = [...t.matchAll(re)];
    return kena.map((m, i) => {
      const akhir = i + 1 < kena.length ? kena[i + 1].index : t.length;
      let isi = t.slice(m.index + m[0].length, akhir);
      isi = isi.replace(/\bsehingga\b.*$/i, '');
      return { negeri: m[1], isi };
    });
  }
  // Nama daerah daripada teks segmen: dalam kurungan = daerah; tanpa kurungan = nama itu sendiri
  function calonDaerah(isi) {
    const calon = [];
    pecahAtas(isi).forEach((e) => {
      const m = /^([^()]*)\(([^()]*)\)\s*$/.exec(e);
      if (m) pecahNama(m[2]).forEach((n) => calon.push(n));
      else pecahNama(e.replace(/[()]/g, ' ')).forEach((n) => calon.push(n));
    });
    return calon;
  }
  function padanDaerah(geoNegeri, calon) {
    const ada = [];
    const tak = [];
    calon.forEach((n) => {
      const f = D().fitur(geoNegeri, n);
      if (f) {
        if (!ada.includes(f)) ada.push(f);
      } else tak.push(n);
    });
    return { ada, tak };
  }
  const tempatDaerah = (f) => ({
    kunci: 'd:' + nn(f.properties.negeri) + ':' + D().norm(f.properties.name),
    jenis: 'daerah',
    label: f.properties.name + ', ' + f.properties.negeri.replace(/^W\.P\.\s*/i, ''),
    nama: f.properties.name,
    negeri: f.properties.negeri,
    lng: f.properties.lon,
    lat: f.properties.lat,
    poligon: f,
  });
  function tempatNegeri(geoNegeri) {
    const p = titikNegeri(geoNegeri);
    if (!p) return null;
    return {
      kunci: 'n:' + nn(geoNegeri),
      jenis: 'negeri',
      label: geoNegeri.replace(/^W\.P\.\s*/i, ''),
      negeri: geoNegeri,
      lng: p[0],
      lat: p[1],
    };
  }
  function eMarin(a) {
    const tajuk = String(a.tajuk || '');
    const teks = String(a.teks || '');
    if (/\bLAUT\b|PERAIRAN|OMBAK|PERKAPALAN|PELAYARAN/i.test(tajuk)) return true;
    if (/^\s*SEKSYEN\b/i.test(teks)) return true;
    return /\bperairan\b|\bselat\b|laut china/i.test(teks) && !segmenNegeri(teks).length;
  }
  function tempatLaut(a) {
    let t = ' ' + String(a.teks || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    const tempat = [];
    const tidakDipeta = [];
    const guna = (kunci, fn) => {
      const re = new RegExp(
        '(^|[^a-z])' + kunci.replace(/[-]/g, '[-\\s]?').replace(/ /g, '\\s+') + '(?![a-z])',
      );
      if (!re.test(t)) return;
      t = t.replace(new RegExp(re.source, 'g'), ' ');
      fn();
    };
    LAUT.forEach(([k, nama, pusat]) =>
      guna(k, () =>
        tempat.push({
          kunci: 'l:' + k,
          jenis: 'laut',
          label: nama + ' (anggaran)',
          lng: pusat[0],
          lat: pusat[1],
        }),
      ),
    );
    LAUT_TAK_TAHU.forEach(([k, nama]) => guna(k, () => tidakDipeta.push(nama)));
    return { tempat, tidakDipeta };
  }
  function selesai(a) {
    const hasil = { marin: false, tempat: [], tidakDipeta: [], tidakPadan: [] };
    if (eMarin(a)) {
      hasil.marin = true;
      const l = tempatLaut(a);
      hasil.tempat = l.tempat;
      hasil.tidakDipeta = l.tidakDipeta;
      if (!l.tempat.length && !l.tidakDipeta.length) hasil.tidakDipeta = ['kawasan laut tidak dikenal pasti'];
      return hasil;
    }
    const peta = indeksNegeri();
    const dipakai = new Set();
    const tambah = (t) => {
      if (t && !hasil.tempat.some((x) => x.kunci === t.kunci)) hasil.tempat.push(t);
    };
    const segmen = segmenNegeri(a.teks);
    segmen.forEach((s) => {
      const geo = peta.get(nn(s.negeri));
      if (!geo) return;
      dipakai.add(geo);
      const { ada, tak } = padanDaerah(geo, calonDaerah(s.isi));
      if (ada.length) {
        ada.forEach((f) => tambah(tempatDaerah(f)));
        tak.forEach((n) => hasil.tidakPadan.push(n));
      } else tambah(tempatNegeri(geo));
    });
    const kurungan = [...String(a.teks || '').matchAll(/\(([^()]{3,70})\)/g)].flatMap((m) =>
      pecahNama(m[1]),
    );
    (a.negeri || []).forEach((n) => {
      const geo = peta.get(nn(n));
      if (!geo) {
        hasil.tidakDipeta.push(n);
        return;
      }
      if (dipakai.has(geo)) return;
      const { ada } = segmen.length ? { ada: [] } : padanDaerah(geo, kurungan);
      if (ada.length) ada.forEach((f) => tambah(tempatDaerah(f)));
      else tambah(tempatNegeri(geo));
    });
    return hasil;
  }

  /* ---------- Bina model daripada senarai panel ---------- */
  function bina() {
    ST.kumpulan = new Map();
    ST.perItem = new Map();
    ST.hasil = new Map();
    ST.poligon = new Map();
    if (!D() || !D().sedia()) return false;
    const { senarai } = window.famaAmaranRasmi ? famaAmaranRasmi() : { senarai: [] };
    senarai.forEach((a, i) => {
      if (!a.aktif) return; // amaran tamat tidak dipetakan
      const h = selesai(a);
      const pilih = [];
      h.daerah = [];
      h.lautLain = [];
      if (h.marin) {
        if (h.tempat[0]) pilih.push(h.tempat[0]);
        h.lautLain = h.tempat.slice(1).map((t) => t.label);
      } else {
        h.tempat.forEach((t) => {
          const n = tempatNegeri(t.negeri);
          if (n && !pilih.some((x) => x.kunci === n.kunci)) pilih.push(n);
          if (t.jenis === 'daerah') h.daerah.push(t);
        });
      }
      h.tempat = pilih;
      ST.hasil.set(i, h);
      ST.perItem.set(
        i,
        pilih.map((t) => t.kunci),
      );
      pilih.forEach((t) => {
        if (!ST.kumpulan.has(t.kunci)) ST.kumpulan.set(t.kunci, { ...t, idx: [], daerahPer: {} });
        const g = ST.kumpulan.get(t.kunci);
        g.idx.push(i);
        g.daerahPer[i] = h.daerah.filter((d) => d.negeri === t.negeri).map((d) => d.nama);
      });
      h.daerah.forEach((d) => {
        if (!ST.poligon.has(d.kunci)) ST.poligon.set(d.kunci, { ...d, idx: [] });
        ST.poligon.get(d.kunci).idx.push(i);
      });
    });
    return true;
  }
  const senarai = () => (window.famaAmaranRasmi ? famaAmaranRasmi().senarai : []);
  // Amaran dengan tahap tertinggi dalam kumpulan indeks (BAHAYA > BURUK > WASPADA > UMUM)
  function tertinggi(idx) {
    const l = senarai();
    const r = (i) => TAHAP.indexOf(tahapSah(l[i] && l[i].tahap));
    return idx.reduce((a, i) => (r(i) < r(a) ? i : a), idx[0]);
  }
  function bangunFitur() {
    const w = warnaTahap();
    const l = senarai();
    const titik = [];
    const daerah = [];
    const sifatDari = (g) => {
      const tahap = tahapSah(l[tertinggi(g.idx)].tahap);
      return { kunci: g.kunci, jenis: g.jenis, label: g.label, tahap, jumlah: g.idx.length, warna: w[tahap] };
    };
    ST.kumpulan.forEach((g) => {
      titik.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [g.lng, g.lat] }, properties: sifatDari(g) });
    });
    ST.poligon.forEach((g) => {
      daerah.push({ type: 'Feature', geometry: g.poligon.geometry, properties: sifatDari(g) });
    });
    return { titik, daerah };
  }

  /* ---------- Lapisan peta ---------- */
  const UBAH = [0, 10]; // anjak ke bawah: penanda sentimen (DOM, anchor bawah) duduk di atas titik daerah yang sama
  function pasangLapisan() {
    if (!ADA() || !map.getStyle() || map.getSource(SUMBER_T)) return;
    if (!map.getStyle().glyphs) map.setGlyphs('https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf');
    const kosong = { type: 'FeatureCollection', features: [] };
    const bawah = map.getLayer('banjir-stesen') ? 'banjir-stesen' : undefined;
    const vis = { visibility: ST.tunjuk ? 'visible' : 'none' };
    const warna = ['get', 'warna'];
    map.addSource(SUMBER_D, { type: 'geojson', data: kosong });
    map.addSource(SUMBER_T, { type: 'geojson', data: kosong });
    map.addLayer(
      {
        id: L_ISI,
        type: 'fill',
        source: SUMBER_D,
        layout: vis,
        paint: { 'fill-color': warna, 'fill-opacity': 0.12 },
      },
      bawah,
    );
    map.addLayer(
      {
        id: L_GARIS,
        type: 'line',
        source: SUMBER_D,
        layout: { ...vis, 'line-join': 'round' },
        paint: { 'line-color': warna, 'line-width': 1.4, 'line-opacity': 0.9 },
      },
      bawah,
    );
    map.addLayer(
      {
        id: L_HALO,
        type: 'circle',
        source: SUMBER_T,
        layout: vis,
        paint: {
          'circle-color': warna,
          'circle-radius': 20,
          'circle-opacity': 0.16,
          'circle-translate': UBAH,
        },
      },
      bawah,
    );
    map.addLayer(
      {
        id: L_DENYUT,
        type: 'circle',
        source: SUMBER_T,
        layout: vis,
        filter: ['==', ['get', 'tahap'], 'BAHAYA'],
        paint: {
          'circle-color': warna,
          'circle-radius': 14,
          'circle-opacity': 0.25,
          'circle-translate': UBAH,
        },
      },
      bawah,
    );
    map.addLayer(
      {
        id: L_TITIK,
        type: 'circle',
        source: SUMBER_T,
        layout: vis,
        paint: {
          'circle-color': warna,
          'circle-opacity': 0.85,
          'circle-radius': ['case', ['>', ['get', 'jumlah'], 1], 12, 10],
          'circle-stroke-color': warna,
          'circle-stroke-width': 3,
          'circle-translate': UBAH,
        },
      },
      bawah,
    );
    map.addLayer(
      {
        id: L_BILANG,
        type: 'symbol',
        source: SUMBER_T,
        filter: ['>', ['get', 'jumlah'], 1],
        layout: {
          ...vis,
          'text-field': ['to-string', ['get', 'jumlah']],
          'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, 0.8],
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.2 },
      },
      bawah,
    );
    if (!ST.pengendali) {
      ST.pengendali = true;
      map.on('click', L_TITIK, (e) => {
        const ft = e.features && e.features[0];
        if (ft) bukaPopup(ft.properties.kunci);
      });
      map.on('mouseenter', L_TITIK, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', L_TITIK, () => (map.getCanvas().style.cursor = ''));
    }
  }
  function denyut() {
    clearInterval(ST.pemasa);
    ST.pemasa = null;
    const tulis = (r, o) => {
      try {
        if (!ADA() || !map.getLayer(L_DENYUT)) return;
        map.setPaintProperty(L_DENYUT, 'circle-radius-transition', { duration: 1200, delay: 0 });
        map.setPaintProperty(L_DENYUT, 'circle-opacity-transition', { duration: 1200, delay: 0 });
        map.setPaintProperty(L_DENYUT, 'circle-radius', r);
        map.setPaintProperty(L_DENYUT, 'circle-opacity', o);
      } catch (_) {}
    };
    tulis(14, 0.25);
    if (!ST.tunjuk || kurangGerak()) return;
    let besar = false;
    ST.pemasa = setInterval(() => {
      if (document.hidden) return;
      besar = !besar;
      tulis(besar ? 26 : 14, besar ? 0.08 : 0.25);
    }, 1400);
  }
  function terap() {
    if (!ADA() || typeof gayaDimuat === 'undefined' || !gayaDimuat) return;
    try {
      pasangLapisan();
      if (!map.getSource(SUMBER_T)) return;
      const f = bangunFitur();
      map.getSource(SUMBER_T).setData({ type: 'FeatureCollection', features: f.titik });
      map.getSource(SUMBER_D).setData({ type: 'FeatureCollection', features: f.daerah });
      [L_ISI, L_GARIS, L_HALO, L_DENYUT, L_TITIK, L_BILANG].forEach((id) =>
        map.setLayoutProperty(id, 'visibility', ST.tunjuk ? 'visible' : 'none'),
      );
      denyut();
    } catch (err) {
      console.warn('Lapisan Amaran Rasmi tidak dapat dipasang', err);
    }
  }

  /* ---------- Panel: pin, penanda tidak dipetakan ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function glifPin() {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '12');
    s.setAttribute('height', '12');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M8 1.5a4.5 4.5 0 0 0-4.5 4.5C3.5 9.4 8 14.5 8 14.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z');
    p.setAttribute('fill', 'currentColor');
    s.append(p);
    return s;
  }
  function hiasPanel() {
    document
      .querySelectorAll('#metAlertBody .amaran-pin, #metAlertBody .amaran-takpeta')
      .forEach((e) => e.remove());
    if (!ST.hasil.size) return;
    document.querySelectorAll('#metAlertBody .alert-item[data-amaran]').forEach((el) => {
      const i = Number(el.dataset.amaran);
      const h = ST.hasil.get(i);
      const atas = el.querySelector('.alert-top');
      if (!h || !atas) return;
      if (h.tempat.length) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'amaran-pin';
        b.dataset.act = 'amaran-pin';
        b.title = 'Tunjuk di peta';
        b.setAttribute('aria-label', 'Tunjuk amaran ini di peta');
        b.append(glifPin());
        atas.append(b);
      } else {
        const s = document.createElement('span');
        s.className = 'amaran-takpeta';
        s.textContent = 'tidak dipetakan';
        s.title = h.tidakDipeta.length ? 'Tidak dipetakan: ' + h.tidakDipeta.join(', ') : '';
        atas.append(s);
      }
    });
  }

  /* ---------- Legenda ---------- */
  function legenda() {
    const l = document.querySelector('.map-legend');
    if (!l) return;
    let k = document.getElementById('legendAmaran');
    if (!k) {
      k = document.createElement('span');
      k.className = 'legend-item legend-amaran';
      k.id = 'legendAmaran';
      const akhir = l.querySelector('.legend-item[style*="margin-left"]');
      l.insertBefore(k, akhir || null);
    }
    const w = warnaTahap();
    if (!k.dataset.siap) {
      k.dataset.siap = '1';
      k.append(document.createTextNode('Amaran Rasmi: '));
      TAHAP.forEach((t) => {
        const s = document.createElement('span');
        s.className = 'amaran-leg-tahap';
        s.dataset.tahap = t;
        const d = document.createElement('i');
        d.className = 'dot';
        s.append(d, document.createTextNode(t[0] + t.slice(1).toLowerCase()));
        k.append(s);
      });
      const tp = document.createElement('span');
      tp.className = 'amaran-leg-takpeta';
      tp.id = 'legendAmaranTakPeta';
      k.append(tp);
    }
    k.querySelectorAll('.amaran-leg-tahap').forEach((s) => {
      s.firstChild.style.background = w[s.dataset.tahap];
    });
    const tp = document.getElementById('legendAmaranTakPeta');
    if (tp) {
      const L = senarai();
      const tak = [...ST.hasil].filter(([, h]) => !h.tempat.length).map(([i]) => L[i].tajuk);
      tp.textContent = tak.length ? tak.length + ' tidak dipetakan' : '';
      tp.title = tak.length ? 'Tidak dipetakan: ' + tak.join('; ') : '';
    }
  }

  /* ---------- Pop-up ---------- */
  function elemen(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  function popupNode(g) {
    const L = senarai();
    const item = g.idx.filter((i) => L[i]);
    const n = elemen('div', 'banjir-popup amaran-popup');
    n.style.maxHeight = Math.round(map.getContainer().clientHeight * 0.6) + 'px';
    const nota = [];
    n.append(
      elemen(
        'div',
        'banjir-popup-tajuk',
        'Amaran Rasmi · ' + g.label + (item.length > 1 ? ` (${item.length})` : ''),
      ),
    );
    item.forEach((i) => {
      const a = L[i];
      const k = elemen('div', 'amaran-popup-item');
      k.dataset.amaran = String(i);
      const atas = elemen('div', 'alert-top');
      atas.append(
        elemen('b', '', a.tajuk),
        elemen('span', 'alert-tahap t-' + tahapSah(a.tahap).toLowerCase(), tahapSah(a.tahap)),
        elemen('span', 'alert-chip ' + (a.aktif ? 'aktif' : 'tamat'), a.aktif ? 'Aktif' : 'Tamat'),
      );
      k.append(atas);
      const ng = a.negeri || [];
      if (ng.length)
        k.append(
          elemen(
            'div',
            'alert-lok',
            ng.slice(0, 3).join(', ') + (ng.length > 3 ? ` +${ng.length - 3} negeri` : ''),
          ),
        );
      const sah = a.sahHingga ? ' · Sah hingga ' + cuacaMasa(a.sahHingga) : '';
      k.append(
        elemen(
          'div',
          'amaran-popup-sah',
          'Dikeluarkan ' + (a.dikeluarkan ? cuacaMasa(a.dikeluarkan) : '-') + sah,
        ),
        elemen('div', 'amaran-popup-sah', 'Sumber: ' + a.sumber),
      );
      const h = ST.hasil.get(i);
      const dn = g.daerahPer[i] || [];
      if (dn.length)
        k.append(
          elemen(
            'div',
            'amaran-popup-sah',
            'Daerah: ' + dn.slice(0, 3).join(', ') + (dn.length > 3 ? ` +${dn.length - 3} daerah` : ''),
          ),
        );
      if (h && h.lautLain.length) {
        const L3 = h.lautLain;
        const baris = elemen('div', 'amaran-popup-sah amaran-popup-laut');
        const senarai = elemen('span', 'amaran-popup-laut-senarai');
        const ringkas = 'Kawasan laut lain: ' + L3.slice(0, 3).join(', ');
        const penuh = 'Kawasan laut lain: ' + L3.join(', ');
        senarai.textContent = ringkas;
        baris.append(senarai);
        if (L3.length > 3) {
          const baki = elemen('span', 'amaran-popup-baki', ` +${L3.length - 3} kawasan laut lain`);
          const t = elemen('button', 'amaran-popup-lagi', 'Tunjuk semua');
          t.type = 'button';
          t.dataset.act = 'amaran-peta-laut-semua';
          t.setAttribute('aria-expanded', 'false');
          t.addEventListener('click', () => {
            const buka = t.getAttribute('aria-expanded') !== 'true';
            t.setAttribute('aria-expanded', String(buka));
            senarai.textContent = buka ? penuh : ringkas;
            baki.hidden = buka;
            t.textContent = buka ? 'Tunjuk ringkas' : 'Tunjuk semua';
            popupDalamPaparan(map, ST.popup);
          });
          baris.append(baki, t);
        }
        k.append(baris);
      }
      if (h) nota.push(...h.tidakDipeta, ...h.tidakPadan);
      const aksi = elemen('div', 'amaran-popup-aksi');
      const b = elemen('button', 'alert-more', 'Lihat lagi');
      b.type = 'button';
      b.dataset.act = 'amaran-peta-lihat';
      b.addEventListener('click', () => sorotItem(i));
      aksi.append(b);
      if (i === item[item.length - 1]) aksi.append(gmapsPautan(g.lat, g.lng));
      k.append(aksi);
      n.append(k);
    });
    const kedudukan =
      g.jenis === 'laut'
        ? 'Kedudukan kawasan laut ialah anggaran'
        : g.jenis === 'negeri'
          ? 'Kedudukan ialah tengah negeri (anggaran)'
          : 'Kedudukan ialah tengah daerah';
    n.append(
      elemen(
        'div',
        'amaran-popup-nota',
        (nota.length ? 'Tidak dipetakan: ' + [...new Set(nota)].join(', ') + ' · ' : '') + kedudukan,
      ),
    );
    return n;
  }
  function bukaPopup(kunci) {
    const g = ST.kumpulan.get(kunci);
    if (!ADA() || !g) return null;
    if (ST.popup) ST.popup.remove();
    ST.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px', offset: 14 })
      .setLngLat([g.lng, g.lat])
      .setDOMContent(popupNode(g))
      .addTo(map);
    popupDalamPaparan(map, ST.popup);
    ST.popupKunci = kunci;
    ST.popup.on('close', () => {
      if (ST.popupKunci === kunci) ST.popupKunci = null;
    });
    return ST.popup;
  }
  function sorotItem(i) {
    if (typeof setEwsTab === 'function') setEwsTab('amaran');
    const el = document.querySelector(`#metAlertBody .alert-item[data-amaran="${i}"]`);
    if (!el) return false;
    document
      .querySelectorAll('#metAlertBody .alert-item.sorot')
      .forEach((x) => x.classList.remove('sorot'));
    el.classList.add('sorot');
    el.scrollIntoView({ block: 'nearest', behavior: kurangGerak() ? 'auto' : 'smooth' });
    clearTimeout(ST.sorotPemasa);
    ST.sorotPemasa = setTimeout(() => el.classList.remove('sorot'), 5000);
    return true;
  }

  /* ---------- Panel -> peta ---------- */
  function terbang(i) {
    const kunci = ST.perItem.get(i) || [];
    const gs = kunci.map((k) => ST.kumpulan.get(k)).filter(Boolean);
    if (!ADA() || !gs.length) return false;
    const L = senarai();
    if (!ST.tunjuk) tetapTunjuk(true);
    const bingkai = document.getElementById('map');
    if (bingkai && bingkai.scrollIntoView) bingkai.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (gs.length === 1) {
      const g = gs[0];
      map.flyTo({
        center: [g.lng, g.lat],
        zoom: Math.max(map.getZoom(), g.jenis === 'daerah' ? 9 : g.jenis === 'negeri' ? 7 : 6),
        essential: true,
      });
    } else {
      const b = new maplibregl.LngLatBounds();
      gs.forEach((g) => b.extend([g.lng, g.lat]));
      map.fitBounds(b, { padding: 70, maxZoom: 9, essential: true });
    }
    bukaPopup(gs[0].kunci);
    return true;
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('#metAlertBody .alert-item[data-amaran]');
    if (!el) return;
    if (ev.target.closest('a, button:not([data-act="amaran-pin"])')) return;
    terbang(Number(el.dataset.amaran));
  });

  /* ---------- Kawalan ---------- */
  function segarUI() {
    legenda();
    hiasPanel();
    if (typeof renderPetaKawalan === 'function') renderPetaKawalan();
  }
  function tetapTunjuk(v) {
    ST.tunjuk = !!v;
    if (!ST.tunjuk && ST.popup) ST.popup.remove();
    terap();
    segarUI();
  }
  function bangunSemula() {
    if (!bina()) {
      if (D() && !ST.menunggu) {
        ST.menunggu = true;
        D()
          .muat()
          .then(() => {
            ST.menunggu = false;
            if (D().sedia()) bangunSemula();
          });
      }
      return;
    }
    if (ST.popup) ST.popup.remove();
    terap();
    segarUI();
  }
  document.addEventListener('fama:amaran-rasmi', bangunSemula);
  window.addEventListener('fama-daerah-sedia', bangunSemula);

  window.FamaAmaranPeta = {
    tunjuk: () => ST.tunjuk,
    tetapTunjuk,
    terbang,
    bukaPopup,
    sorotItem,
    dipetakan: (i) => (ST.perItem.get(i) || []).length > 0,
    ujian: () => {
      const dataSumber = ADA() && map.getSource(SUMBER_T) ? map.getSource(SUMBER_T).serialize().data : null;
      const dataDaerah = ADA() && map.getSource(SUMBER_D) ? map.getSource(SUMBER_D).serialize().data : null;
      return {
        tunjuk: ST.tunjuk,
        popup: ST.popupKunci,
        fitur: dataSumber ? dataSumber.features.map((f) => ({ ...f.properties })) : [],
        koordinat: dataSumber ? dataSumber.features.map((f) => f.geometry.coordinates) : [],
        daerah: dataDaerah ? dataDaerah.features.map((f) => ({ ...f.properties })) : [],
        kumpulan: [...ST.kumpulan.values()].map((g) => ({
          kunci: g.kunci,
          jenis: g.jenis,
          label: g.label,
          lng: g.lng,
          lat: g.lat,
          idx: g.idx.slice(),
          daerah: Object.fromEntries(Object.entries(g.daerahPer)),
        })),
        dipeta: [...ST.hasil].filter(([, h]) => h.tempat.length).map(([i]) => i),
        tidakDipeta: [...ST.hasil].filter(([, h]) => !h.tempat.length).map(([i]) => i),
        hasil: Object.fromEntries(
          [...ST.hasil].map(([i, h]) => [
            i,
            { marin: h.marin, tempat: h.tempat.map((t) => t.kunci), tidakDipeta: h.tidakDipeta, tidakPadan: h.tidakPadan },
          ]),
        ),
        lapisan: ADA()
          ? Object.fromEntries(
              [L_ISI, L_GARIS, L_HALO, L_DENYUT, L_TITIK, L_BILANG].map((id) => [
                id,
                map.getLayer(id) ? map.getLayoutProperty(id, 'visibility') : null,
              ]),
            )
          : {},
        paint: ADA() && map.getLayer(L_TITIK) ? {
          opacity: map.getPaintProperty(L_TITIK, 'circle-opacity'),
          jejari: map.getPaintProperty(L_TITIK, 'circle-radius'),
        } : null,
      };
    },
  };

  if (!ADA()) return;
  map.on('style.load', terap);
  new MutationObserver(() => {
    ST.warna = null;
    terap();
    legenda();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  legenda();
  bangunSemula();
})();

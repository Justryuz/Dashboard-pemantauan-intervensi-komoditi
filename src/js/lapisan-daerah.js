'use strict';
/* Lapisan "Sempadan Daerah" (malaysia_district.geojson, versi ringkas di src/data/geo/).
   Peta Pemantauan: isi lutsinar + garis + label (zum >= 8), sorot ketika hover, pop-up bila klik, suis dalam menu Lapisan.
   Peta Intervensi: window.FamaDaerah.fitur() memberi poligon sebenar bagi daerah PO (lihat intervensi.js).
   Dimuat selepas main.js supaya peta (`map`) dan menu kawalan sudah wujud. Tiada skrip sebaris (CSP). */
(function () {
  const URL_DATA = 'src/data/geo/malaysia_district.geojson';
  const KUNCI = 'fama_lapisan_daerah_nasional'; // pilihan paparan Malaysia sahaja (lalai: sembunyi); kunci lama diabaikan
  const SUMBER = 'daerah-sempadan';
  const ISI = 'daerah-isi';
  const GARIS = 'daerah-garis';
  const DENYUT = 'daerah-denyut';
  const LABEL = 'daerah-label';
  const LAPISAN_ATAS = [
    'amaran-daerah-isi',
    'amaran-daerah-garis',
    'amaran-cuaca-halo',
    'amaran-cuaca',
    'banjir-stesen',
  ];
  const GLIF = 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf';
  // Nama daerah dalam data PO yang berbeza daripada GeoJSON (kemudian dinormalkan)
  const ALIAS = {
    'alor setar': 'kota setar',
    perai: 'seberang perai tengah',
    kangar: 'perlis',
    arau: 'perlis',
    'padang besar': 'perlis',
    'kuala lumpur': 'W.P. Kuala Lumpur',
  };
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/baharu/g, 'bharu')
      .replace(/[^a-z0-9]/g, '');
  // Alias nama daerah FIS -> GeoJSON daripada config/pemetaan-po-fis.json (cermin PEMETAAN_PO_FIS)
  const ALIAS_FIS =
    typeof PEMETAAN_PO_FIS !== 'undefined' && PEMETAAN_PO_FIS.alias
      ? PEMETAAN_PO_FIS.alias.daerahGeo
      : {};
  const ALIAS_N = Object.fromEntries(
    Object.entries({ ...ALIAS, ...ALIAS_FIS }).map(([k, v]) => [norm(k), norm(v)]),
  );

  // Wilayah Persekutuan (KL 14, Labuan 15, Putrajaya 16) diselia PO yang berdaftar di bawah negeri lain
  // (Selayang/Dengkil di Selangor, Kota Kinabalu di Sabah), mengikut pemetaan FIS 2.1.
  const negeriSama = (f, negeri) =>
    !negeri ||
    norm(f.properties.negeri) === norm(negeri) ||
    [14, 15, 16].includes(f.properties.code_state);
  let data = null;
  let janji = null;
  const indeks = new Map();
  const kotak = new WeakMap();

  function bacaPilihan() {
    try {
      return localStorage.getItem(KUNCI) === '1';
    } catch (_) {
      return false;
    }
  }
  // Drill-down = PO (utama/tambahan) atau negeri dipilih (mapView ditetapkan oleh zoomTo)
  const drill = () =>
    !!(
      (typeof mapView !== 'undefined' && mapView) ||
      (typeof state !== 'undefined' && state && state.po)
    );
  const kelihatan = () => ST.tunjuk || drill();
  const ada = () => typeof map !== 'undefined' && !!map;
  const ST = {
    tunjuk: bacaPilihan(),
    popup: null,
    hover: null,
    pengendali: false,
    status: new Map(),
    info: new Map(),
  };

  function sempadanGeom(g) {
    let w = 999;
    let s = 999;
    let e = -999;
    let n = -999;
    const jalan = (c) => {
      if (typeof c[0] === 'number') {
        if (c[0] < w) w = c[0];
        if (c[0] > e) e = c[0];
        if (c[1] < s) s = c[1];
        if (c[1] > n) n = c[1];
      } else c.forEach(jalan);
    };
    jalan(g.coordinates);
    return [
      [w, s],
      [e, n],
    ];
  }
  function muat() {
    if (janji) return janji;
    janji = fetch(URL_DATA, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => {
        data = d;
        d.features.forEach((f) => {
          indeks.set(norm(f.properties.name), f);
          kotak.set(f, sempadanGeom(f.geometry));
        });
        window.dispatchEvent(new CustomEvent('fama-daerah-sedia'));
        return d;
      })
      .catch((err) => {
        janji = null;
        console.warn('Lapisan sempadan daerah tidak dapat dimuatkan', err);
        return null;
      });
    return janji;
  }
  // Cari daerah GeoJSON bagi nama daerah (dan negeri) dalam data PO. Pulangkan null jika tiada padanan.
  function fitur(negeri, nama) {
    if (!data) return null;
    const k = norm(nama);
    const f = indeks.get(ALIAS_N[k] || k);
    if (!f) return null;
    if (!negeriSama(f, negeri)) return null;
    return f;
  }
  const sempadan = (f) => kotak.get(f) || null;

  /* ---------- Warna ikut tema dan peta asas ---------- */
  function warna() {
    const cerah = document.documentElement.getAttribute('data-theme') === 'cerah';
    const asas = typeof petaAsas !== 'undefined' ? petaAsas : 'lalai';
    if (asas === 'satelit')
      return { garis: '#ffffff', isi: '#ffffff', teks: '#ffffff', halo: 'rgba(0,0,0,0.75)' };
    return cerah
      ? { garis: '#1b4f8a', isi: '#1b4f8a', teks: '#10315a', halo: 'rgba(255,255,255,0.9)' }
      : { garis: '#2f74c0', isi: '#2f74c0', teks: '#0e2a4d', halo: 'rgba(255,255,255,0.85)' };
  }
  /* ---------- Warna status titik amaran (sama dengan penanda PO/daerah: --green, --yellow, --red) ---------- */
  const BOBOT = { kelabu: -1, hijau: 0, kuning: 1, merah: 2 };
  const WARNA_LALAI = { hijau: '#22d88a', kuning: '#ffbd43', merah: '#ff4e63', kelabu: '#8a94a6' };
  const ST_FS = ['feature-state', 'status'];
  const HOVER = ['boolean', ['feature-state', 'hover'], false];
  function warnaStatus() {
    const cs = getComputedStyle(document.documentElement);
    const baca = (v, lalai) => cs.getPropertyValue(v).trim() || lalai;
    return {
      hijau: baca('--green', WARNA_LALAI.hijau),
      kuning: baca('--yellow', WARNA_LALAI.kuning),
      merah: baca('--red', WARNA_LALAI.merah),
      kelabu: baca('--grey', WARNA_LALAI.kelabu),
    };
  }
  const padanStatus = (s, w, lain) => [
    'match',
    ST_FS,
    'hijau',
    s.hijau,
    'kuning',
    s.kuning,
    'merah',
    s.merah,
    'kelabu',
    s.kelabu,
    lain,
  ];
  const opasitiIsi = [
    'case',
    HOVER,
    0.45,
    ['==', ST_FS, 'merah'],
    0.2,
    ['==', ST_FS, 'kuning'],
    0.3,
    ['==', ST_FS, 'hijau'],
    0.28,
    ['==', ST_FS, 'kelabu'],
    0.16,
    0,
  ];
  const adaStatus = ['match', ST_FS, ['hijau', 'kuning', 'merah', 'kelabu'], true, false];
  const lebarGaris = [
    'interpolate',
    ['linear'],
    ['zoom'],
    5,
    ['case', HOVER, 2.4, adaStatus, 1.4, 0.6],
    9,
    ['case', HOVER, 3, adaStatus, 2.4, 1.2],
  ];
  const kurangGerak = () =>
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Denyut lembut: opasiti lapisan malar id berayun (peralihan CSS-gaya MapLibre) setiap 1.5 s selagi aktif.
  // Tanpa denyut (kurang gerak) lapisan kekal pada opasiti pertengahan. Dikongsi dengan peta Intervensi.
  const pemasa = new Map();
  function denyut(m, id, aktif) {
    const kunci = id + m.getContainer().id;
    clearInterval(pemasa.get(kunci));
    pemasa.delete(kunci);
    const tulis = (v, trans) => {
      try {
        if (!m.getLayer(id)) return;
        if (trans) m.setPaintProperty(id, 'fill-opacity-transition', { duration: 1400, delay: 0 });
        m.setPaintProperty(id, 'fill-opacity', v);
      } catch (_) {}
    };
    tulis(aktif ? 0.14 : 0, false);
    if (!aktif || kurangGerak()) return;
    let tinggi = false;
    pemasa.set(
      kunci,
      setInterval(() => {
        if (document.hidden) return;
        tinggi = !tinggi;
        tulis(tinggi ? 0.3 : 0.04, true);
      }, 1500),
    );
  }
  // Status setiap daerah GeoJSON daripada poStatus() app.js (fungsi sama dengan penanda daerah)
  function kiraStatus() {
    const hasil = new Map();
    ST.info = new Map();
    if (
      typeof state === 'undefined' ||
      typeof poStatus !== 'function' ||
      typeof DATA === 'undefined'
    )
      return hasil;
    const pos = state.po
      ? [...DATA.po, ...(DATA.poTambahan || [])].filter((p) => p.id === state.po)
      : [
          ...(typeof statePOs === 'function' ? statePOs() : DATA.po),
          ...(typeof statePOTambahan === 'function' ? statePOTambahan() : []),
        ];
    pos.forEach((p) =>
      p.districts.forEach((d) => {
        const f = fitur(p.negeri, d[0]);
        if (!f) return;
        const s = poStatus(p, d[0]);
        const k = f.properties.name;
        if (!hasil.has(k) || BOBOT[s] > BOBOT[hasil.get(k)]) {
          hasil.set(k, s);
          // Rekod harga terburuk daerah ini (sebab + harga) untuk pop-up
          ST.info.set(k, typeof ringkasDaerah === 'function' ? ringkasDaerah(p, d[0]) : null);
        }
      }),
    );
    return hasil;
  }
  function terapStatus() {
    if (!ada() || !data || !map.getSource(SUMBER)) return;
    try {
      map.removeFeatureState({ source: SUMBER });
      // removeFeatureState tidak diterapkan serta-merta bila lapisan baru dipaparkan semula (tiada tile dimuat):
      // daerah yang tidak lagi berstatus ditetapkan null secara jelas.
      const lama = ST.diterap || new Set();
      ST.status.forEach((s, id) => map.setFeatureState({ source: SUMBER, id }, { status: s }));
      lama.forEach((id) => {
        if (!ST.status.has(id)) map.setFeatureState({ source: SUMBER, id }, { status: null });
      });
      ST.diterap = new Set(ST.status.keys());
      if (ST.hover !== null) map.setFeatureState({ source: SUMBER, id: ST.hover }, { hover: true });
      // Merah harga sahaja = "Amaran harga": tidak berkelip (kelip hanya untuk Kritikal bersama bekalan, tab Intervensi).
      if (map.getLayer(DENYUT)) map.setFilter(DENYUT, ['in', ['get', 'name'], ['literal', []]]);
      denyut(map, DENYUT, false);
    } catch (err) {
      console.warn('Status warna daerah tidak dapat dikemas kini', err);
    }
  }
  function kemasStatus() {
    kemasKelihatan();
    ST.status = kiraStatus();
    terapStatus();
  }
  function terapWarna() {
    if (!ada() || !map.getLayer(GARIS)) return;
    const w = warna();
    const s = warnaStatus();
    map.setPaintProperty(GARIS, 'line-color', padanStatus(s, w, w.garis));
    map.setPaintProperty(ISI, 'fill-color', padanStatus(s, w, w.isi));
    if (map.getLayer(DENYUT)) map.setPaintProperty(DENYUT, 'fill-color', s.merah);
    if (map.getLayer(LABEL)) {
      map.setPaintProperty(LABEL, 'text-color', w.teks);
      map.setPaintProperty(LABEL, 'text-halo-color', w.halo);
    }
  }

  /* ---------- Pop-up ---------- */
  // Semua PO (utama dan tambahan) yang meliputi daerah ini; satu daerah boleh dalam beberapa PO.
  function poPenyelia(f) {
    if (typeof DATA === 'undefined' || !DATA.po) return { utama: [], tambahan: [], semua: [] };
    const k = norm(f.properties.name);
    const ada = (x) =>
      (x.districts || []).some((d) => {
        const n = norm(d[0]);
        return (ALIAS_N[n] || n) === k && negeriSama(f, x.negeri);
      });
    const utama = DATA.po.filter(ada);
    const tambahan = (DATA.poTambahan || []).filter(ada);
    return {
      utama: utama.map((p) => p.name),
      tambahan: tambahan.map((p) => p.label + ' (tambahan)'),
      semua: [...utama, ...tambahan],
    };
  }
  // Nama daerah dalam DATA.po (padanan alias) bagi rekod harga daerah ini.
  function namaDaerahPO(f, pos) {
    const k = norm(f.properties.name);
    for (const p of pos)
      for (const d of p.districts || []) {
        const n = norm(d[0]);
        if ((ALIAS_N[n] || n) === k) return d[0];
      }
    return f.properties.name;
  }
  // Gaya sama dengan pop-up PO (app.js poHoverHTML): nama, negeri + status, Google Maps, senarai amaran harga.
  function popupNode(f, lngLat) {
    const p = f.properties;
    const n = document.createElement('div');
    n.className = 'banjir-popup daerah-popup';
    const t = document.createElement('div');
    t.className = 'ph-name';
    t.textContent = 'Daerah ' + p.name;
    n.append(t);
    const sub = document.createElement('div');
    sub.className = 'ph-sub';
    sub.append(document.createTextNode(p.negeri));
    const stt = ST.status.get(p.name);
    if (stt && typeof statusHTML === 'function') {
      sub.append(document.createTextNode(' · '));
      const s = document.createElement('span');
      s.innerHTML = statusHTML(stt); // label tetap daripada app.js, tiada input luar
      sub.append(...s.childNodes);
    }
    n.append(sub);
    const lat = Number.isFinite(p.lat) ? p.lat : lngLat.lat;
    const lon = Number.isFinite(p.lon) ? p.lon : lngLat.lng;
    const g = document.createElement('div');
    g.className = 'gmaps-baris ph-gmaps-atas';
    if (typeof gmapsPautan === 'function') g.append(gmapsPautan(lat, lon));
    n.append(g);
    const po = poPenyelia(f);
    if (typeof amaranDaerahSenaraiHTML === 'function') {
      const a = document.createElement('div');
      a.className = 'daerah-popup-amaran';
      // HTML dibina app.js dengan esc() pada semua nilai data
      a.innerHTML = amaranDaerahSenaraiHTML(po.semua, namaDaerahPO(f, po.semua));
      n.append(a);
    }
    const kaki = document.createElement('div');
    kaki.className = 'outlet-note daerah-popup-po';
    const senaraiPO = [];
    if (po.utama.length) senaraiPO.push('PO penyelia (FIS 2.1): ' + po.utama.join(', '));
    if (po.tambahan.length) senaraiPO.push('PO tambahan: ' + po.tambahan.join(', '));
    kaki.textContent = senaraiPO.length ? senaraiPO.join(' · ') : 'Tiada PO penyelia (FIS 2.1)';
    n.append(kaki);
    return n;
  }
  function bukaPopup(f, lngLat) {
    if (ST.popup) ST.popup.remove();
    ST.popup = new maplibregl.Popup({
      closeButton: true,
      maxWidth: '300px',
      className: 'daerah-popup-gelap',
    })
      .setLngLat(lngLat)
      .setDOMContent(popupNode(f, lngLat))
      .addTo(map);
    if (typeof hadTinggiPopup === 'function') hadTinggiPopup(ST.popup, lngLat);
    ST.popup.setLngLat(lngLat); // kira semula kedudukan selepas had tinggi
    return ST.popup;
  }

  /* ---------- Lapisan peta ---------- */
  function pasang() {
    if (!ada() || !data) return;
    try {
      if (!map.getStyle() || map.getSource(SUMBER)) return;
      if (!map.getStyle().glyphs) map.setGlyphs(GLIF);
      const w = warna();
      const vis = { visibility: kelihatan() ? 'visible' : 'none' };
      const bawah = LAPISAN_ATAS.find((i) => map.getLayer(i));
      map.addSource(SUMBER, { type: 'geojson', data, promoteId: 'name' });
      map.addLayer(
        {
          id: ISI,
          type: 'fill',
          source: SUMBER,
          layout: vis,
          paint: {
            'fill-color': padanStatus(warnaStatus(), w, w.isi),
            'fill-opacity': opasitiIsi,
          },
        },
        bawah,
      );
      map.addLayer(
        {
          id: DENYUT,
          type: 'fill',
          source: SUMBER,
          layout: vis,
          filter: ['in', ['get', 'name'], ['literal', []]],
          paint: { 'fill-color': warnaStatus().merah, 'fill-opacity': 0.14 },
        },
        bawah,
      );
      map.addLayer(
        {
          id: GARIS,
          type: 'line',
          source: SUMBER,
          layout: { ...vis, 'line-join': 'round' },
          paint: {
            'line-color': padanStatus(warnaStatus(), w, w.garis),
            'line-opacity': ['case', adaStatus, 0.9, 0.45],
            'line-width': lebarGaris,
          },
        },
        bawah,
      );
      map.addLayer(
        {
          id: LABEL,
          type: 'symbol',
          source: SUMBER,
          minzoom: 8,
          layout: {
            ...vis,
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
            'text-size': 12,
            'text-padding': 4,
          },
          paint: { 'text-color': w.teks, 'text-halo-color': w.halo, 'text-halo-width': 1.5 },
        },
        bawah,
      );
      kemasStatus();
      if (!ST.pengendali) {
        ST.pengendali = true;
        map.on('mousemove', ISI, (e) => {
          const ft = e.features && e.features[0];
          if (!ft || ft.id === ST.hover) return;
          kosongHover();
          ST.hover = ft.id;
          map.setFeatureState({ source: SUMBER, id: ST.hover }, { hover: true });
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', ISI, () => {
          kosongHover();
          map.getCanvas().style.cursor = '';
        });
        map.on('click', ISI, (e) => {
          // Klik pada penanda PO/daerah (HTML) dikendalikan penanda itu sahaja
          const oe = e.originalEvent;
          if (oe && oe.target && oe.target.closest && oe.target.closest('.maplibregl-marker'))
            return;
          // Stesen banjir dan amaran cuaca diutamakan
          const atas = LAPISAN_ATAS.filter((i) => i !== 'amaran-daerah-isi' && map.getLayer(i));
          if (atas.length && map.queryRenderedFeatures(e.point, { layers: atas }).length) return;
          const ft = e.features && e.features[0];
          const f = ft && indeks.get(norm(ft.properties.name));
          if (f) bukaPopup(f, e.lngLat);
        });
      }
    } catch (err) {
      console.warn('Lapisan sempadan daerah tidak dapat dipasang', err);
    }
  }
  function kosongHover() {
    if (ST.hover === null) return;
    try {
      map.setFeatureState({ source: SUMBER, id: ST.hover }, { hover: false });
    } catch (_) {}
    ST.hover = null;
  }
  function kemasButang() {
    const b = document.getElementById('petaDaerahBtn');
    if (b) b.setAttribute('aria-pressed', ST.tunjuk ? 'true' : 'false');
  }
  // Malaysia: ikut suis; drill-down: sentiasa dipaparkan
  function kemasKelihatan() {
    const k = kelihatan();
    if (!k) {
      if (ST.popup) ST.popup.remove();
      kosongHover();
    }
    if (ada() && map.getSource(SUMBER)) {
      [ISI, DENYUT, GARIS, LABEL].forEach((i) => {
        if (map.getLayer(i)) map.setLayoutProperty(i, 'visibility', k ? 'visible' : 'none');
      });
    }
  }
  function tetapTunjuk(v) {
    ST.tunjuk = !!v;
    try {
      localStorage.setItem(KUNCI, ST.tunjuk ? '1' : '0');
    } catch (_) {}
    kemasKelihatan();
    terapStatus();
    kemasButang();
  }
  function pasangButang() {
    const kumpulan = document.querySelector(
      '#petaKawalan .peta-seg[aria-label="Lapisan tambahan"]',
    );
    if (!kumpulan || document.getElementById('petaDaerahBtn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'petaDaerahBtn';
    b.textContent = 'Sempadan Daerah';
    b.title = 'Papar sempadan daerah dalam paparan Malaysia (sentiasa dipaparkan selepas klik PO)';
    b.setAttribute('aria-pressed', ST.tunjuk ? 'true' : 'false');
    b.addEventListener('click', () => tetapTunjuk(!ST.tunjuk));
    kumpulan.append(b);
    kemasButang();
  }

  /* ---------- Drill-down PO: guna sempadan poligon sebenar bila dipadankan ----------
     applyMapView() app.js dipanggil oleh zoomTo(); dibungkus di sini supaya paparan muat semua poligon daerah seliaan.
     Tanpa padanan, tingkah laku asal (titik anggaran) digunakan. */
  const applyMapViewAsal = window.applyMapView;
  if (typeof applyMapViewAsal === 'function') {
    window.applyMapView = function () {
      try {
        const po = typeof mapView !== 'undefined' ? mapView : null;
        if (ST.popup) ST.popup.remove();
        if (ada() && po && data) {
          const b = new maplibregl.LngLatBounds();
          let padan = 0;
          po.districts.forEach((d) => {
            const f = fitur(po.negeri, d[0]);
            const k = f && sempadan(f);
            if (k) {
              b.extend(k[0]);
              b.extend(k[1]);
              padan++;
            } else b.extend([d[2], d[1]]);
          });
          if (padan) {
            map.fitBounds(b, { padding: 60, maxZoom: 10, duration: 700 });
            return;
          }
        }
      } catch (err) {
        console.warn('Drill-down poligon daerah gagal, guna paparan anggaran', err);
      }
      applyMapViewAsal();
    };
  }

  /* zoomTo() asal menangguhkan zum ke map.once('load') bila map.loaded() palsu. 'load' hanya tercetus sekali,
     jadi klik PO ketika tile/lapisan (daerah, amaran) sedang dimuat tidak pernah zum. fitBounds selamat dipanggil serta-merta. */
  if (typeof window.zoomTo === 'function') {
    window.zoomTo = function (po) {
      mapView = po || null;
      kemasKelihatan();
      if (ada()) window.applyMapView();
    };
  }

  window.FamaDaerah = {
    muat,
    fitur,
    semuaFitur: () => (data ? data.features : []),
    sempadan,
    norm,
    sedia: () => !!data,
    ujian: () => ({
      tunjuk: ST.tunjuk,
      dipasang: !!(ada() && map.getSource(SUMBER)),
      drill: drill(),
      kelihatan: kelihatan(),
      bilFitur: data ? data.features.length : 0,
    }),
    tetapTunjuk,
    kemasStatus,
    denyut,
    statusDaerah: () => Object.fromEntries(ST.status),
    // Kandungan pop-up daerah (nod DOM baharu) untuk hover penanda daerah di app.js
    kandungan: (f, lngLat) => popupNode(f, lngLat),
    bukaPopup: (nama) => {
      const f = data && indeks.get(norm(nama));
      if (!f) return null;
      return bukaPopup(f, { lng: f.properties.lon, lat: f.properties.lat });
    },
  };

  muat();
  if (typeof map === 'undefined' || !map) return;
  pasangButang();
  map.on('style.load', () => muat().then(pasang));
  if (typeof gayaDimuat !== 'undefined' && gayaDimuat) muat().then(pasang);
  new MutationObserver(terapWarna).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
})();

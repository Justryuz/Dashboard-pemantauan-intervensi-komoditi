'use strict';
/* PO tambahan (di luar 15 PO utama dashboard) daripada pemetaan FIS 2.1 (DATA.poTambahan, src/data/pemetaan-po-terap.js).
   Dipaparkan sebagai penanda PETAK pada peta Pemantauan dan Intervensi dengan suis 'PO Tambahan (N)' (kekal dalam
   localStorage fama_po_tambahan). Lokasi ialah titik tengah daerah seliaan (anggaran), bukan koordinat kemudahan.
   Modul ini tidak bergantung pada app.js semasa dimuat; fungsi paparan menerima status daripada pemanggil. Tiada skrip sebaris (CSP). */
(function () {
  const KUNCI = 'fama_po_tambahan';
  const ZUM_LABEL = 7; // label penuh dipaparkan dari zum ini (hover sentiasa menunjukkan nama)
  const SUMBER = 'Pemetaan: FIS 2.1 (Power BI)';
  const LOKASI = 'Lokasi anggaran: titik tengah daerah seliaan';
  const senarai = () => (typeof DATA !== 'undefined' && DATA.poTambahan) || [];
  function baca() {
    try {
      return localStorage.getItem(KUNCI) !== '0';
    } catch (_) {
      return true;
    }
  }
  let tunjuk = baca();
  const bil = () => senarai().length;
  const aktif = () => tunjuk && bil() > 0;

  function kemasLegenda() {
    document.querySelectorAll('[data-po-tbh-leg]').forEach((e) => (e.hidden = !aktif()));
  }
  function kemasButang(satu) {
    kemasLegenda();
    (satu ? [satu] : document.querySelectorAll('[data-po-tbh-btn]')).forEach((b) => {
      const n = bil();
      b.textContent = `PO Tambahan (${n})`;
      b.disabled = n === 0;
      b.setAttribute('aria-pressed', aktif() ? 'true' : 'false');
      b.title = n
        ? 'Tunjuk atau sembunyi PO tambahan (penanda petak) daripada pemetaan FIS 2.1'
        : 'Tiada PO tambahan dalam pemetaan FIS';
    });
  }
  function tetap(v) {
    tunjuk = !!v;
    try {
      localStorage.setItem(KUNCI, tunjuk ? '1' : '0');
    } catch (_) {}
    kemasButang();
    window.dispatchEvent(new CustomEvent('fama-po-tambahan', { detail: { tunjuk: aktif() } }));
  }
  // Pasang butang dalam kumpulan suis lapisan (kekal dalam gaya sedia ada: .peta-seg button).
  function pasangButang(kumpulan) {
    if (!kumpulan || kumpulan.querySelector('[data-po-tbh-btn]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-po-tbh-btn', '1');
    b.addEventListener('click', () => tetap(!tunjuk));
    kumpulan.append(b);
    kemasButang(b);
  }

  // Penanda petak berpiawai bulat-sudut. status: merah|kuning|hijau|kelabu.
  function penanda(p, status, statusTeks, { kecil = false, dipilih = false } = {}) {
    const el = document.createElement('div');
    el.className = `po-tbh tanpa-kelip status-${status}${kecil ? ' compact' : ''}${dipilih ? ' tbh-sel' : ''}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('data-po-tbh', p.id);
    el.setAttribute('aria-label', `${p.fisNama}, PO tambahan, ${statusTeks}`);
    el.title = `${p.fisNama} · PO tambahan · ${statusTeks}`;
    const c = document.createElement('span');
    c.className = 'core';
    el.append(c);
    if (!kecil || dipilih) {
      const t = document.createElement('span');
      t.className = 'map-label po-label po-label-tbh sauh-r';
      t.textContent = p.fisNama;
      el.append(t);
    }
    return el;
  }
  // Label dipaparkan hanya dari zum ZUM_LABEL (kelas pada bekas peta).
  function pasangZum(m) {
    if (!m || m._tbhZum) return;
    m._tbhZum = true;
    const kemas = () => m.getContainer().classList.toggle('tbh-label-on', m.getZoom() >= ZUM_LABEL);
    m.on('zoom', kemas);
    kemas();
  }
  const baris = (n, k, v) => {
    const r = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = k + ': ';
    r.append(b, document.createTextNode(v));
    n.append(r);
    return r;
  };
  // info = {statusTeks, sebab, harga?}
  function popupNode(p, info) {
    const n = document.createElement('div');
    n.className = 'banjir-popup po-tbh-popup';
    const t = document.createElement('div');
    t.className = 'banjir-popup-tajuk';
    t.textContent = p.label + ' (PO tambahan)';
    n.append(t);
    baris(n, 'Nama FIS', p.fisNama);
    baris(n, 'Negeri', p.negeriAsal || p.negeri);
    baris(n, 'Daerah seliaan', p.districts.map((d) => d[0]).join(', '));
    baris(n, 'Status harga', (info && info.statusTeks) || 'Tiada ambang');
    baris(n, 'Sebab', (info && info.sebab) || 'Tiada ambang atau tiada data harga');
    baris(n, 'Logistik', 'Tiada data logistik');
    if (p.perluDisahkan)
      baris(
        n,
        'Pemetaan',
        'PERLU DISAHKAN (padanan PO dengan dashboard/lokasi belum disahkan pengguna)',
      );
    const l = document.createElement('div');
    l.className = 'banjir-popup-sumber';
    l.textContent = LOKASI + '. Sumber: ' + SUMBER;
    n.append(l);
    const g = document.createElement('div');
    g.className = 'gmaps-baris';
    if (typeof gmapsPautan === 'function') g.append(gmapsPautan(p.lat, p.lon));
    n.append(g);
    return n;
  }
  // Hanya satu pop-up PO tambahan dibuka pada satu masa. Ia dibuka ketika hover (atau fokus/ketik pada peranti sentuh)
  // dan ditutup selepas kursor keluar (jeda ~200 ms supaya kursor sempat masuk ke pop-up dan pautan boleh diklik).
  const JEDA = 200;
  let pop = null;
  let pemasa = null;
  const sentuh = () => !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
  function tutup() {
    clearTimeout(pemasa);
    if (pop) pop.remove();
    pop = null;
  }
  function jadual() {
    clearTimeout(pemasa);
    pemasa = setTimeout(tutup, JEDA);
  }
  function bukaPopup(m, p, info, { hover = false } = {}) {
    tutup();
    const pp = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      maxWidth: '280px',
      offset: 12,
    })
      .setLngLat([p.lon, p.lat])
      .setDOMContent(popupNode(p, info))
      .addTo(m);
    pop = pp;
    if (!sentuh()) {
      const e = pp.getElement();
      e.addEventListener('mouseenter', () => clearTimeout(pemasa));
      e.addEventListener('mouseleave', jadual);
    }
    // kekalkan pop-up dalam kotak peta (panBy bila perlu); tidak ketika hover supaya peta tidak berganjak
    if (!hover && typeof popupDalamPaparan === 'function') popupDalamPaparan(m, pp);
    return pp;
  }
  // Ketik pada peta (bukan pada petak/pop-up) menutup pop-up pada peranti sentuh.
  function pasangTutupPeta(m) {
    if (!m || m._tbhTutup) return;
    m._tbhTutup = true;
    m.on('click', (e) => {
      const t = e.originalEvent && e.originalEvent.target;
      if (t && t.closest && t.closest('.po-tbh, .maplibregl-popup')) return;
      tutup();
    });
  }
  // Hover/fokus membuka pop-up; keluar/blur/Escape menutupnya. Klik kekal milik pemanggil (drill-down).
  function pasangHover(m, el, p, infoFn) {
    pasangTutupPeta(m);
    const buka = () => bukaPopup(m, p, infoFn(), { hover: true });
    if (!sentuh()) {
      el.addEventListener('mouseenter', buka);
      el.addEventListener('mouseleave', jadual);
    }
    el.addEventListener('focus', () => {
      if (el.matches(':focus-visible')) buka();
    });
    el.addEventListener('blur', jadual);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') tutup();
    });
  }
  // Sempadan gabungan daerah seliaan (poligon GeoJSON jika ada, jika tidak titik daerah).
  function sempadan(p) {
    const D = window.FamaDaerah;
    const b = new maplibregl.LngLatBounds([p.lon, p.lat], [p.lon, p.lat]);
    p.districts.forEach((d) => {
      const f = D && D.sedia() ? D.fitur(p.negeri, d[0]) : null;
      const k = f && D.sempadan(f);
      if (k) {
        b.extend(k[0]);
        b.extend(k[1]);
      } else b.extend([d[2], d[1]]);
    });
    return b;
  }
  // Sorot poligon daerah PO tambahan pada satu peta (sumber GeoJSON berasingan).
  const SRC = 'po-tbh-sorot';
  function sorot(m, p) {
    try {
      const D = window.FamaDaerah;
      const feats = [];
      if (p && D && D.sedia())
        p.districts.forEach((d) => {
          const f = D.fitur(p.negeri, d[0]);
          if (f)
            feats.push({
              type: 'Feature',
              properties: { name: f.properties.name },
              geometry: f.geometry,
            });
        });
      const data = { type: 'FeatureCollection', features: feats };
      const s = m.getSource(SRC);
      if (s) return s.setData(data);
      if (!feats.length) return;
      m.addSource(SRC, { type: 'geojson', data });
      m.addLayer({
        id: SRC + '-isi',
        type: 'fill',
        source: SRC,
        paint: { 'fill-color': '#00b8d9', 'fill-opacity': 0.18 },
      });
      m.addLayer({
        id: SRC + '-garis',
        type: 'line',
        source: SRC,
        paint: { 'line-color': '#00b8d9', 'line-width': 2.5, 'line-dasharray': [2, 1] },
      });
    } catch (err) {
      console.warn('Sorot daerah PO tambahan gagal', err);
    }
  }
  function pasangLegenda(bekas) {
    if (!bekas || bekas.querySelector('[data-po-tbh-leg]')) return;
    const s = document.createElement('span');
    s.className = 'legend-item';
    s.setAttribute('data-po-tbh-leg', '1');
    s.hidden = !aktif();
    const i = document.createElement('i');
    i.className = 'tbh-leg';
    i.setAttribute('aria-hidden', 'true');
    s.append(i, document.createTextNode('Petak = PO tambahan · Bulatan = PO utama'));
    bekas.append(s);
  }

  window.FamaPOT = {
    senarai,
    bil,
    tunjuk: aktif,
    tetap,
    pasangButang,
    kemasButang,
    penanda,
    pasangZum,
    popupNode,
    bukaPopup,
    pasangHover,
    pasangTutupPeta,
    tutup,
    sentuh,
    sempadan,
    sorot,
    pasangLegenda,
    ZUM_LABEL,
    SUMBER,
    LOKASI,
  };
})();

'use strict';
/* Lapisan "Sentimen" pada peta Pemantauan: item sentimen AI Muse yang bertanda lokasi (lokasi[] daripada nota)
   ditanda pada peta. Data = item yang sama dengan senarai tab Sentimen panel EWS (ewsMuseItems(museEwsState.data)).
   Lokasi dipadankan dengan GeoJSON daerah (FamaDaerah, normalisasi nama sama): daerah -> titik tengah daerah,
   hanya negeri -> purata titik tengah daerah negeri itu. Lokasi yang tidak dapat dipadankan dilangkau (tiada lokasi direka).
   Penanda ialah elemen DOM (di bawah penanda PO melalui z-index) jadi kekal selepas tukar peta asas.
   Dimuat selepas lapisan-daerah.js dan ews.js. Tiada skrip sebaris (CSP). */
(function () {
  const KUNCI = 'fama_lapisan_sentimen';
  const ADA_MAP = () => typeof map !== 'undefined' && !!map;
  const kurangGerak = () =>
    !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PERINGKAT = { Merah: 2, Kuning: 1, Hijau: 0 };
  const CLS = { Merah: 'merah', Kuning: 'kuning', Hijau: 'hijau' };

  function bacaPilihan() {
    try {
      return localStorage.getItem(KUNCI) !== '0';
    } catch (_) {
      return true;
    }
  }
  const ST = {
    tunjuk: bacaPilihan(),
    kumpulan: [], // [{kunci, lng, lat, jenis:'daerah'|'negeri', nama, negeri, item:[r]}]
    markers: [],
    bilDipeta: 0,
    bilTakPeta: 0,
    mapKomoditi: new Map(), // komoditiId -> [kumpulan]
    popup: null,
    popupKunci: null,
  };

  const nilaiBand = (r) =>
    Object.prototype.hasOwnProperty.call(PERINGKAT, r.band) ? r.band : null;
  const namaLokasi = (g) => (g.jenis === 'negeri' ? g.negeri : g.nama + ', ' + g.negeri);

  /* ---------- Padanan lokasi -> koordinat ---------- */
  function titikNegeri(negeri) {
    const D = window.FamaDaerah;
    const n = D.norm(negeri);
    const fs = D.semuaFitur().filter((f) => D.norm(f.properties.negeri) === n);
    const ada = fs.filter(
      (f) => Number.isFinite(f.properties.lon) && Number.isFinite(f.properties.lat),
    );
    if (!ada.length) return null;
    return {
      lng: ada.reduce((a, f) => a + f.properties.lon, 0) / ada.length,
      lat: ada.reduce((a, f) => a + f.properties.lat, 0) / ada.length,
      negeri: fs[0].properties.negeri,
    };
  }
  function padanLokasi(l) {
    const D = window.FamaDaerah;
    if (!l || !l.negeri) return null;
    if (l.daerah) {
      const f = D.fitur(l.negeri, l.daerah);
      if (!f || !Number.isFinite(f.properties.lon) || !Number.isFinite(f.properties.lat))
        return null;
      return {
        kunci: 'd:' + D.norm(f.properties.negeri) + ':' + D.norm(f.properties.name),
        jenis: 'daerah',
        nama: f.properties.name,
        negeri: f.properties.negeri,
        lng: f.properties.lon,
        lat: f.properties.lat,
      };
    }
    const t = titikNegeri(l.negeri);
    if (!t) return null;
    return {
      kunci: 'n:' + D.norm(t.negeri),
      jenis: 'negeri',
      nama: null,
      negeri: t.negeri,
      lng: t.lng,
      lat: t.lat,
    };
  }
  function senaraiItem() {
    const s = typeof museEwsState !== 'undefined' ? museEwsState : null;
    if (!s || s.status !== 'ready' || !s.data || typeof ewsMuseItems !== 'function') return [];
    return ewsMuseItems(s.data);
  }
  function bangunKumpulan(items) {
    const kump = new Map();
    const mapKom = new Map();
    let dipeta = 0;
    let takPeta = 0;
    items.forEach((r) => {
      const lok = Array.isArray(r.lokasi) ? r.lokasi : [];
      if (!lok.length) return;
      const sudah = new Set();
      lok.forEach((l) => {
        const p = padanLokasi(l);
        if (!p || sudah.has(p.kunci)) return;
        sudah.add(p.kunci);
        if (!kump.has(p.kunci)) kump.set(p.kunci, { ...p, item: [] });
        kump.get(p.kunci).item.push(r);
        if (!mapKom.has(r.komoditiId)) mapKom.set(r.komoditiId, []);
        mapKom.get(r.komoditiId).push(kump.get(p.kunci));
      });
      if (sudah.size) dipeta++;
      else takPeta++;
    });
    return { kumpulan: [...kump.values()], mapKom, dipeta, takPeta };
  }

  /* ---------- Label ---------- */
  function labelIndeks(v) {
    if (!Number.isFinite(v)) return '';
    if (v <= -50) return 'sangat negatif';
    if (v < -10) return 'negatif';
    if (v <= 10) return 'neutral';
    if (v < 50) return 'positif';
    return 'sangat positif';
  }
  const tanda = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

  /* ---------- Penanda ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function glif() {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '14');
    s.setAttribute('height', '14');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute(
      'd',
      'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H7l-3 3v-3h-.5A1.5 1.5 0 0 1 2 9.5z',
    );
    p.setAttribute('fill', 'currentColor');
    const c = document.createElementNS(SVG_NS, 'path');
    c.setAttribute('d', 'M5 5.5h6M5 8h4');
    c.setAttribute('stroke', 'var(--sent-glif, #fff)');
    c.setAttribute('stroke-width', '1.3');
    c.setAttribute('stroke-linecap', 'round');
    c.setAttribute('fill', 'none');
    s.append(p, c);
    return s;
  }
  function bandKumpulan(g) {
    return g.item.reduce(
      (a, r) => (nilaiBand(r) && (!a || PERINGKAT[r.band] > PERINGKAT[a]) ? r.band : a),
      null,
    );
  }
  function buatPenanda(g) {
    const band = bandKumpulan(g);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sent-marker band-' + (band ? CLS[band] : 'tiada');
    el.dataset.kunci = g.kunci;
    el.dataset.band = band ? CLS[band] : '';
    el.dataset.bil = String(g.item.length);
    const lbl = `Sentimen ${g.item.map((r) => r.komoditiLabel).join(', ')} di ${namaLokasi(g)}${band ? ', ' + band : ''}`;
    el.setAttribute('aria-label', lbl);
    el.title = lbl;
    const kotak = document.createElement('span');
    kotak.className = 'sent-bubble';
    kotak.append(glif());
    el.append(kotak);
    if (g.item.length > 1) {
      const n = document.createElement('span');
      n.className = 'sent-n';
      n.textContent = String(g.item.length);
      el.append(n);
    }
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      bukaKumpulan(g, { daripadaPenanda: true });
    });
    return el;
  }
  function kosongPenanda() {
    ST.markers.forEach((m) => m.remove());
    ST.markers = [];
  }
  function pasangPenanda() {
    kosongPenanda();
    if (!ADA_MAP() || typeof maplibregl === 'undefined') return;
    ST.kumpulan.forEach((g) => {
      const el = buatPenanda(g);
      g.el = el;
      ST.markers.push(
        new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([g.lng, g.lat])
          .addTo(map),
      );
    });
    terapTunjuk();
  }
  function terapTunjuk() {
    ST.markers.forEach((m) => {
      m.getElement().hidden = !ST.tunjuk;
    });
    const l = document.getElementById('legendSentimen');
    if (l) l.hidden = !ST.tunjuk;
  }

  /* ---------- Pop-up ---------- */
  function el(tag, cls, teks) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  function baris(label, nilai) {
    const r = el('div', 'sent-baris');
    r.append(el('span', 'sent-k', label), el('b', null, nilai));
    return r;
  }
  function blokItem(r) {
    const b = el('div', 'sent-item');
    b.dataset.kid = r.komoditiId;
    const atas = el('div', 'sent-item-atas');
    atas.append(el('b', 'sent-kom', r.komoditiLabel));
    const band = nilaiBand(r);
    if (band) {
      const sem = Number.isFinite(r.risikoSemasa) ? r.risikoSemasa : null;
      const ch =
        sem === null ? null : sem - (Number.isFinite(r.risikoSebelum) ? r.risikoSebelum : sem);
      const chip = el('span', 'sent-chip band-' + CLS[band]);
      chip.append(document.createTextNode(band));
      if (sem !== null) {
        const arr = ch > 0 ? '↑' : ch < 0 ? '↓' : '→';
        chip.append(el('span', 'sent-chip-risiko', `risiko ${sem} ${arr} ${tanda(ch)}`));
      }
      atas.append(chip);
    } else atas.append(el('span', 'sent-chip band-tiada', 'Tahap tidak diketahui'));
    b.append(atas);
    const kv = el('div', 'sent-kv');
    if (Number.isFinite(r.indeksSentimen))
      kv.append(
        baris('Indeks sentimen', `${tanda(r.indeksSentimen)} (${labelIndeks(r.indeksSentimen)})`),
      );
    if (Number.isFinite(r.bilSampel)) kv.append(baris('Sampel', String(r.bilSampel)));
    kv.append(baris('Tarikh', ewsTarikh(r.tarikh, true)));
    b.append(kv);
    const t = typeof ewsTajuk === 'function' ? ewsTajuk(r.nota) : '';
    if (t) b.append(el('div', 'sent-ringkas', t));
    const lagi = el('button', 'sent-lagi', 'Lihat lagi');
    lagi.type = 'button';
    lagi.dataset.kid = r.komoditiId;
    lagi.setAttribute('aria-label', `Lihat lagi ${r.komoditiLabel} dalam tab Sentimen`);
    lagi.addEventListener('click', () => {
      sorotItem([r.komoditiId], { tab: true });
    });
    b.append(lagi);
    return b;
  }
  function kandunganPopup(g) {
    const n = el('div', 'banjir-popup sent-popup');
    n.append(
      el(
        'div',
        'banjir-popup-tajuk',
        g.item.length > 1 ? `Sentimen berlokasi (${g.item.length} item)` : 'Sentimen berlokasi',
      ),
    );
    const lok = el('div', 'sent-lok');
    lok.append(el('span', 'sent-k', 'Lokasi disebut dalam nota: '));
    lok.append(el('b', null, namaLokasi(g) + (g.jenis === 'negeri' ? ' (negeri)' : '')));
    n.append(lok);
    if (g.jenis === 'negeri')
      n.append(
        el('div', 'sent-nota', 'Hanya negeri disebut; penanda di tengah negeri (anggaran).'),
      );
    const senarai = el('div', 'sent-senarai');
    g.item.forEach((r) => senarai.append(blokItem(r)));
    n.append(senarai);
    n.append(el('div', 'banjir-popup-sumber', 'Sumber: AI Muse · db-curated'));
    const gm = el('div', 'gmaps-baris');
    if (typeof gmapsPautan === 'function') gm.append(gmapsPautan(g.lat, g.lng));
    n.append(gm);
    return n;
  }
  function kosongSorot() {
    document.querySelectorAll('#ewsMuseBody .ews-sent-row.ews-sent-sorot').forEach((e) => {
      e.classList.remove('ews-sent-sorot');
    });
  }
  function tutupPopup() {
    if (ST.popup) ST.popup.remove();
    ST.popup = null;
    ST.popupKunci = null;
    kosongSorot();
  }
  function bukaKumpulan(g, opts) {
    if (!ADA_MAP() || !g) return null;
    tutupPopup();
    const p = new maplibregl.Popup({
      closeButton: true,
      maxWidth: '320px',
      className: 'sent-popup-wrap',
      anchor: 'bottom',
      offset: [0, -38],
    })
      .setLngLat([g.lng, g.lat])
      .setDOMContent(kandunganPopup(g))
      .addTo(map);
    if (typeof popupDalamPaparan === 'function') popupDalamPaparan(map, p);
    ST.popup = p;
    ST.popupKunci = g.kunci;
    p.on('close', () => {
      if (ST.popup === p) {
        ST.popup = null;
        ST.popupKunci = null;
        kosongSorot();
      }
    });
    if (opts && opts.daripadaPenanda)
      sorotItem(
        g.item.map((r) => r.komoditiId),
        {},
      );
    return p;
  }

  /* ---------- Senarai EWS: pin + sorot ---------- */
  function barisSenarai(kid) {
    return [...document.querySelectorAll('#ewsMuseBody .ews-sent-row')].find(
      (e) => e.dataset.kid === kid,
    );
  }
  function sorotItem(ids, opts) {
    if (opts && opts.tab && typeof setEwsTab === 'function') setEwsTab('sentimen');
    kosongSorot();
    const rows = ids.map(barisSenarai).filter(Boolean);
    rows.forEach((e) => e.classList.add('ews-sent-sorot'));
    if (rows[0])
      rows[0].scrollIntoView({ block: 'nearest', behavior: kurangGerak() ? 'auto' : 'smooth' });
    return rows.length;
  }
  function hiasSenarai(items) {
    const rows = [...document.querySelectorAll('#ewsMuseBody .ews-sent-row')];
    rows.forEach((row, i) => {
      const r = items[i];
      if (!r) return;
      row.dataset.kid = r.komoditiId;
      const g = ST.mapKomoditi.get(r.komoditiId);
      if (!g || !g.length) return;
      const atas = row.querySelector('.ews-sent-top');
      if (!atas || atas.querySelector('.ews-sent-pin')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ews-sent-pin';
      b.dataset.kid = r.komoditiId;
      const lbl = 'Tunjuk di peta: ' + g.map(namaLokasi).join('; ');
      b.title = lbl;
      b.setAttribute('aria-label', `${lbl} (${r.komoditiLabel})`);
      const s = document.createElementNS(SVG_NS, 'svg');
      s.setAttribute('viewBox', '0 0 16 16');
      s.setAttribute('width', '12');
      s.setAttribute('height', '12');
      s.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute(
        'd',
        'M8 1.5a4.5 4.5 0 0 0-4.5 4.5C3.5 9.5 8 14.5 8 14.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z',
      );
      p.setAttribute('fill', 'currentColor');
      s.append(p);
      b.append(s);
      atas.append(b);
    });
  }
  function terbangKe(kid) {
    const g = (ST.mapKomoditi.get(kid) || [])[0];
    if (!g || !ADA_MAP()) return false;
    const zum = g.jenis === 'negeri' ? 7 : 9;
    map.flyTo({
      center: [g.lng, g.lat],
      zoom: Math.max(map.getZoom(), zum),
      offset: [0, Math.round(map.getContainer().clientHeight * 0.3)],
      duration: kurangGerak() ? 0 : 900,
      essential: true,
    });
    if (!ST.tunjuk) tetapTunjuk(true);
    bukaKumpulan(g, {});
    sorotItem([kid], {});
    return true;
  }

  /* ---------- Suis, lencana, legenda ---------- */
  function kemasButang() {
    const b = document.getElementById('petaSentimenBtn');
    if (!b) return;
    b.setAttribute('aria-pressed', ST.tunjuk ? 'true' : 'false');
    b.textContent = `Sentimen (${ST.bilDipeta})`;
    b.title =
      ST.bilDipeta === 0
        ? 'Tiada sentimen berlokasi minggu ini'
        : 'Tunjuk atau sembunyi penanda sentimen AI Muse yang bertanda lokasi. ' +
          `${ST.bilDipeta} item dipetakan` +
          (ST.bilTakPeta
            ? `, ${ST.bilTakPeta} item tidak dipetakan (lokasi tiada dalam GeoJSON).`
            : '.');
  }
  function tetapTunjuk(v) {
    ST.tunjuk = !!v;
    try {
      localStorage.setItem(KUNCI, ST.tunjuk ? '1' : '0');
    } catch (_) {}
    if (!ST.tunjuk) tutupPopup();
    terapTunjuk();
    kemasButang();
  }
  function pasangButang() {
    const kumpulan = document.querySelector(
      '#petaKawalan .peta-seg[aria-label="Lapisan tambahan"]',
    );
    if (!kumpulan || document.getElementById('petaSentimenBtn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'petaSentimenBtn';
    b.addEventListener('click', () => tetapTunjuk(!ST.tunjuk));
    kumpulan.append(b);
    kemasButang();
  }
  function pasangLegenda() {
    const lg = document.querySelector('.map-legend');
    if (!lg || document.getElementById('legendSentimen')) return;
    const s = el('span', 'legend-item');
    s.id = 'legendSentimen';
    const i = el('i', 'sent-leg');
    i.setAttribute('aria-hidden', 'true');
    i.append(glif());
    s.append(i, document.createTextNode('Sentimen berlokasi (AI Muse): Hijau / Kuning / Merah'));
    const akhir = [...lg.children].find((c) =>
      /margin-left:\s*auto/.test(c.getAttribute('style') || ''),
    );
    lg.insertBefore(s, akhir || null);
    s.hidden = !ST.tunjuk;
  }

  /* ---------- Kemas kini penuh ---------- */
  function kemas() {
    const items = senaraiItem();
    const D = window.FamaDaerah;
    if (!D) return Promise.resolve();
    return D.muat().then(() => {
      if (!D.sedia()) return;
      const b = bangunKumpulan(items);
      ST.kumpulan = b.kumpulan;
      ST.mapKomoditi = b.mapKom;
      ST.bilDipeta = b.dipeta;
      ST.bilTakPeta = b.takPeta;
      tutupPopup();
      pasangPenanda();
      hiasSenarai(items);
      kemasButang();
    });
  }

  // Klik pin dalam senarai EWS -> terbang ke penanda dan buka pop-up
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('.ews-sent-pin');
    if (t) {
      ev.preventDefault();
      terbangKe(t.dataset.kid);
    }
  });

  // Senarai Sentimen dirender semula oleh ews.js (renderMuseEws); sambung selepas setiap render.
  const renderAsal = window.renderMuseEws;
  if (typeof renderAsal === 'function') {
    window.renderMuseEws = function () {
      const h = renderAsal.apply(this, arguments);
      try {
        kemas();
      } catch (err) {
        console.warn('Lapisan sentimen tidak dapat dikemas kini', err);
      }
      return h;
    };
  }

  window.FamaSentimenPeta = {
    kemas,
    tetapTunjuk,
    terbangKe,
    ujian: () => ({
      tunjuk: ST.tunjuk,
      bilDipeta: ST.bilDipeta,
      bilTakPeta: ST.bilTakPeta,
      penanda: ST.kumpulan.map((g) => ({
        kunci: g.kunci,
        nama: namaLokasi(g),
        jenis: g.jenis,
        lng: g.lng,
        lat: g.lat,
        band: bandKumpulan(g),
        komoditi: g.item.map((r) => r.komoditiId),
      })),
      popup: ST.popupKunci,
    }),
  };

  if (!ADA_MAP()) return;
  pasangButang();
  pasangLegenda();
  kemas();
})();

const $ = (id) => document.getElementById(id);
const state = {
  po: null,
  daerah: null,
  komoditi: 'all',
  indikator: 'all',
  issues: true,
  days: 30,
  banjir: true,
  chartRecord: null,
  lowStage: 'Ladang',
  highStage: 'Borong',
};
const labels = { merah: 'Kritikal', kuning: 'Berwaspada', hijau: 'Stabil' };
const weight = { hijau: 0, kuning: 1, merah: 2 };
let actions = [];
try {
  actions = JSON.parse(localStorage.getItem('fama-demo-intervensi-v1') || '[]');
  actions = Array.isArray(actions) ? actions.filter((a) => a && typeof a === 'object') : [];
} catch (_) {
  actions = [];
}
const poById = Object.fromEntries(DATA.po.map((p) => [p.id, p]));
function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}
const money = (x) => 'RM ' + Number(x).toFixed(2);
const fmt = (x) => Number(x).toLocaleString('ms-MY');
function statusHTML(s) {
  return `<span class="status-text status-${s}">● ${labels[s]}</span>`;
}
function filteredRecords({ issues = state.issues, stage = null, ignoreStatus = false } = {}) {
  return DATA.rekod.filter(
    (r) =>
      (!state.po || r.poId === state.po) &&
      (!state.daerah || r.daerah === state.daerah) &&
      (state.komoditi === 'all' || r.komoditi === state.komoditi) &&
      (ignoreStatus || state.indikator === 'all' || r.status === state.indikator) &&
      (!stage || r.peringkat === stage) &&
      (!issues || r.status !== 'hijau'),
  );
}
function poStatus(p, district = null) {
  const rr = DATA.rekod.filter(
    (r) =>
      r.poId === p.id &&
      (!district || r.daerah === district) &&
      (state.komoditi === 'all' || r.komoditi === state.komoditi),
  );
  return rr.length
    ? rr.reduce((a, r) => (weight[r.status] > weight[a] ? r.status : a), 'hijau')
    : 'hijau';
}
function statePOs() {
  return DATA.po.filter((p) => state.indikator === 'all' || poStatus(p) === state.indikator);
}
function toast(message) {
  const e = $('toast');
  e.textContent = message;
  e.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => e.classList.remove('show'), 3200);
}
function initControls() {
  DATA.komoditi.forEach((c) =>
    $('filterCommodity').insertAdjacentHTML(
      'beforeend',
      `<option value="${esc(c.name)}">${esc(c.name)}</option>`,
    ),
  );
  DATA.po.forEach((p) =>
    $('filterState').insertAdjacentHTML(
      'beforeend',
      `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.negeri)}</option>`,
    ),
  );
  const config = [
    ['filterCommodity', 'komoditi'],
    ['filterSeverity', 'indikator'],
    ['filterDays', 'days'],
    ['filterIssue', 'issues'],
    ['lowStage', 'lowStage'],
    ['highStage', 'highStage'],
  ];
  config.forEach(([id, key]) =>
    $(id).addEventListener('change', (ev) => {
      state[key] =
        key === 'days'
          ? +ev.target.value
          : key === 'issues'
            ? ev.target.value === 'true'
            : ev.target.value;
      state.chartRecord = null;
      renderAll();
    }),
  );
  $('filterState').addEventListener('change', (ev) => {
    const id = ev.target.value;
    if (id === 'all') {
      state.po = null;
      state.daerah = null;
      state.chartRecord = null;
      zoomTo(null);
      renderAll();
    } else selectPO(id);
  });
  $('resetFilters').onclick = () => {
    Object.assign(state, {
      po: null,
      daerah: null,
      komoditi: 'all',
      indikator: 'all',
      issues: true,
      days: 30,
      banjir: true,
      chartRecord: null,
      lowStage: 'Ladang',
      highStage: 'Borong',
    });
    [
      ['filterCommodity', 'all'],
      ['filterState', 'all'],
      ['filterSeverity', 'all'],
      ['filterDays', '30'],
      ['filterIssue', 'true'],
      ['lowStage', 'Ladang'],
      ['highStage', 'Borong'],
    ].forEach(([id, v]) => ($(id).value = v));
    zoomTo(null);
    renderAll();
  };
  $('backMap').onclick = () => {
    state.po = null;
    state.daerah = null;
    state.chartRecord = null;
    zoomTo(null);
    renderAll();
  };
  $('downloadCsv').onclick = exportCSV;
  $('downloadLogistik').onclick = exportLogistikCSV;
  $('showLogs').onclick = openLogModal;
}
function renderLogistik() {
  const L = DATA.logistikRingkasan;
  const cards = [
    ['◉', L.jumlahPO, 'PO utama', 'Jumlah lokasi yang dipetakan'],
    ['▰', L.kenderaan, 'buah', 'Kenderaan logistik'],
    ['↔', L.muatanMT, 'MT', 'Muatan kenderaan'],
    ['❄', L.bilikSejuk, 'bilik', 'Bilik sejuk · angka ringkasan'],
    ['◫', L.kapasitiSimpananMT, 'MT', 'Kapasiti penyimpanan'],
  ];
  $('logistikKpis').innerHTML = cards
    .map(
      ([ico, val, unit, label]) =>
        `<div class="logistik-kpi"><div class="symbol">${ico}</div><div class="figure">${fmt(val)}<span class="unit">${unit}</span></div><div class="label">${label}</div></div>`,
    )
    .join('');
  $('dataQuality').innerHTML =
    `⚠ <b>Semakan kualiti data sumber:</b> Ringkasan menyatakan <b>${L.bilikSejuk} bilik sejuk</b>, manakala jumlah berdasarkan 13 kotak butiran ialah <b>${L.jumlahBilikSejukMengikutButiran}</b>. Angka untuk PO Dengkil/Selayang dan PO Johor Baharu/Simpang Renggam ialah <b>gabungan dua PO</b>, bukan kapasiti individu. Infografik juga menyebut <b>27 PO sokongan</b> (127 lori, 362 MT muatan, 83 bilik sejuk, 855 MT simpanan), tetapi nama/lokasinya tidak diberikan dan oleh itu <b>tidak dipetakan</b>.`;
}
function renderPODirectory() {
  const mk = (region) =>
    DATA.po
      .filter((p) =>
        region === 'timur'
          ? ['Sabah', 'Sarawak'].includes(p.negeri)
          : !['Sabah', 'Sarawak'].includes(p.negeri),
      )
      .map(
        (p) =>
          `<button type="button" class="po-option ${state.po === p.id ? 'active' : ''}" data-po="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.negeri)} · ${esc(labels[poStatus(p)])}"><i class="dot ${poStatus(p) === 'merah' ? 'red' : poStatus(p) === 'kuning' ? 'yellow' : 'green'}"></i><span>${esc(p.name.replace('PO ', '').replace('Simpang Renggam', 'S. Renggam'))}</span></button>`,
      )
      .join('');
  $('poDirectory').innerHTML =
    `<div class="po-areas"><div><div class="directory-title">Semenanjung Malaysia · 13 PO</div><div class="po-directory-grid">${mk('barat')}</div></div><div><div class="directory-title">Malaysia Timur · 2 PO</div><div class="po-directory-grid east">${mk('timur')}</div></div></div><div class="outlet-note" style="margin-top:9px">Pilih nama PO untuk zum lokasi dan lihat maklumat logistik. Tanda amaran dan daerah adalah data simulasi.</div>`;
  $('poDirectory')
    .querySelectorAll('[data-po]')
    .forEach((b) => (b.onclick = () => selectPO(b.dataset.po)));
}
function renderKpis() {
  const pos = statePOs();
  const red = pos.filter((p) => poStatus(p) === 'merah').length;
  const yellow = pos.filter((p) => poStatus(p) === 'kuning').length;
  const green = pos.filter((p) => poStatus(p) === 'hijau').length;
  const count = filteredRecords({ issues: true, stage: 'Borong', ignoreStatus: true }).length;
  const items = [
    ['PO Dalam Tapisan', pos.length, 'Daripada 15 PO yang dipetakan', 'cyan'],
    ['PO Kritikal', red, 'Simulasi · intervensi', 'red'],
    ['PO Berwaspada', yellow, 'Simulasi · tren harga', 'yellow'],
    ['PO Stabil', green, 'Simulasi · rutin', 'green'],
    ['Isu Komoditi', count, 'Rekod borong dummy', 'red'],
  ];
  $('kpis').innerHTML = items
    .map(
      ([label, value, foot, cl]) =>
        `<article class="kpi ${cl}"><div class="kpi-label">${label}</div><div class="kpi-value">${fmt(value)}</div><div class="kpi-foot">${foot}</div></article>`,
    )
    .join('');
  $('actionCount').textContent = actions.length;
}

function selectPO(id) {
  hidePOHover();
  state.po = id;
  state.daerah = null;
  state.chartRecord = null;
  $('filterState').value = id;
  zoomTo(poById[id]);
  renderAll();
  document.querySelector('.map-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function selectDistrict(name) {
  state.daerah = state.daerah === name ? null : name;
  state.chartRecord = null;
  renderAll();
}
let map = null,
  mapView = null,
  mapMarkers = [];
const MAP_BOUNDS = [
  [99.5, 0.8],
  [119.5, 7.5],
];
const FAMA_MAP_STYLE =
  (window.APP_CONFIG && window.APP_CONFIG.mapStyle) ||
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
window.FAMA_MAP_CONFIG = { style: FAMA_MAP_STYLE, bounds: MAP_BOUNDS };
function initMap() {
  if (typeof maplibregl === 'undefined') {
    console.warn('MapLibre GL tidak dapat dimuatkan');
    return;
  }
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: FAMA_MAP_STYLE,
      bounds: MAP_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: true,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Tekan Ctrl + skrol untuk zum peta',
        'CooperativeGesturesHandler.MacHelpText': 'Tekan ⌘ + skrol untuk zum peta',
        'CooperativeGesturesHandler.MobileHelpText': 'Guna dua jari untuk gerakkan peta',
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  } catch (err) {
    console.warn('Peta tidak dapat dimulakan', err);
    map = null;
  }
}
function addMapMarker(el, lon, lat) {
  const m = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lon, lat])
    .addTo(map);
  mapMarkers.push(m);
  return m;
}
function mapEl(cls, attrs = {}) {
  const el = document.createElement('div');
  el.className = cls;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}
function mapChild(tag, cls, text) {
  const c = document.createElement(tag);
  c.className = cls;
  if (text !== undefined) c.textContent = text;
  return c;
}
function renderMap() {
  const visible = statePOs();
  if (map) {
    hidePOHover();
    mapMarkers.forEach((m) => m.remove());
    mapMarkers = [];
    const labelShift = {
      perlis: [-8, -16],
      kedah: [-5, 21],
      penang: [12, -10],
      perak: [-9, 20],
      selangor: [12, 22],
      selayang: [-10, -14],
      negerisembilan: [-12, 20],
      melaka: [18, 13],
      kelantan: [-8, -15],
      terengganu: [16, -6],
      pahang: [15, -10],
      johor: [16, 16],
      simpangrenggam: [-8, -16],
      sabah: [18, -13],
      sarawak: [14, -12],
    };
    visible.forEach((p) => {
      const s = poStatus(p);
      const el = mapEl(
        `po-marker status-${s}${state.po ? ' compact' : ''}${scenarioRingClass(p.id)}`,
        { tabindex: '0', role: 'button', 'aria-label': `${p.name}, ${labels[s]}` },
      );
      el.append(mapChild('span', 'halo'), mapChild('span', 'core'));
      if (!state.po) {
        const [dx, dy] = labelShift[p.id] || [9, -10];
        const t = mapChild('span', 'map-label po-label', p.label);
        t.style.left = `calc(50% + ${dx}px)`;
        t.style.top = `calc(50% + ${dy}px)`;
        t.style.transform = dx < 0 ? 'translate(-100%,-50%)' : 'translate(0,-50%)';
        el.append(t);
      }
      el.addEventListener('mouseenter', () => showPOHover(p));
      el.addEventListener('mouseleave', hidePOHover);
      el.addEventListener('focus', () => showPOHover(p));
      el.addEventListener('blur', hidePOHover);
      el.addEventListener('click', () => selectPO(p.id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectPO(p.id);
        }
      });
      addMapMarker(el, p.lon, p.lat);
    });
    if (state.po) {
      const p = poById[state.po];
      p.districts.forEach((d, i) => {
        const s = poStatus(p, d[0]);
        const el = mapEl(`district-marker status-${s}${state.daerah === d[0] ? ' selected' : ''}`, {
          tabindex: '0',
          role: 'button',
          'aria-label': `${d[0]}, ${labels[s]}`,
          title: `${d[0]} · ${labels[s]}`,
        });
        if (s === 'merah') el.append(mapChild('span', 'district-halo'));
        el.append(mapChild('span', 'dot-core'));
        const t = mapChild('span', 'map-label', d[0]);
        t.style.left = `calc(50% + ${i % 2 ? 9 : -9}px)`;
        t.style.top = 'calc(50% - 10px)';
        t.style.transform = i % 2 ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
        el.append(t);
        el.addEventListener('click', () => selectDistrict(d[0]));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectDistrict(d[0]);
          }
        });
        addMapMarker(el, d[2], d[1]);
      });
    }
  }
  $('backMap').style.display = state.po ? 'inline-block' : 'none';
  $('mapMode').textContent = state.po ? 'ZOOM: DAERAH SELIAAN' : 'PETA MALAYSIA';
  $('mapHint').textContent = state.po
    ? poById[state.po].negeri + ' · klik daerah'
    : 'Klik titik PO untuk perincian';
  $('mapPOCount').textContent = state.po ? poById[state.po].districts.length : visible.length;
  $('mapCaption').textContent = state.po
    ? `${poById[state.po].name} · ${poById[state.po].districts.length} daerah · status tertinggi: ${labels[poStatus(poById[state.po])]}`
    : '15 PO berpandukan infografik · koordinat bandar anggaran · warna risiko adalah simulasi';
  $('mapDetail').innerHTML = state.po
    ? `<div class="detail-copy"><strong>${esc(poById[state.po].name)} · ${statusHTML(poStatus(poById[state.po]))}</strong><div class="note">${esc(poById[state.po].negeri)} · Kedudukan titik ialah anggaran bandar, bukan koordinat tapak sebenar. ${poById[state.po].logistik.shared ? '<b>Data logistik berkongsi angka dengan PO pasangan.</b>' : ''}</div><div class="note">Liputan daerah di bawah ialah <b>contoh simulasi</b> (tiada senarai seliaan daerah dalam infografik). Klik daerah untuk mengemas kini panel harga.</div><div class="district-pills"><button class="pill ${!state.daerah ? 'active' : ''}" data-district="">Semua daerah</button>${poById[state.po].districts.map((d) => `<button class="pill ${state.daerah === d[0] ? 'active' : ''}" data-district="${esc(d[0])}">${esc(d[0])} · ${labels[poStatus(poById[state.po], d[0])]}</button>`).join('')}</div></div><button class="button tiny ghost" id="clearSelection">Reset PO</button>`
    : `<div class="detail-copy"><strong>Prinsip Amaran Minimum</strong><div class="note">Jika satu daerah atau komoditi ditanda kritikal (dummy), penanda PO berkelip merah. Klik titik atau nama PO untuk melihat logistik sumber dan perincian harga simulasi.</div></div><span class="tag-status"><i class="dot red"></i>Merah = tindakan segera</span>`;
  document.querySelectorAll('[data-district]').forEach(
    (b) =>
      (b.onclick = () => {
        state.daerah = b.dataset.district || null;
        state.chartRecord = null;
        renderAll();
      }),
  );
  const clear = $('clearSelection');
  if (clear) clear.onclick = $('backMap').onclick;
}
function applyMapView() {
  if (!map) return;
  const po = mapView;
  if (po) {
    const b = new maplibregl.LngLatBounds([po.lon, po.lat], [po.lon, po.lat]);
    po.districts.forEach((d) => b.extend([d[2], d[1]]));
    map.fitBounds(b, { padding: 60, maxZoom: 10, duration: 700 });
  } else map.fitBounds(MAP_BOUNDS, { padding: 20, duration: 700 });
}
function zoomTo(po) {
  mapView = po || null;
  if (!map) return;
  if (map.loaded()) applyMapView();
  else map.once('load', applyMapView);
}
initMap();
window.famaMonitorMapResize = () => {
  if (map) map.resize();
};
/* ===== Cuaca sebenar (MET Malaysia + Open-Meteo) =====
   Data dimuat sekali daripada /api/cuaca (same-origin; token MET tidak pernah sampai ke pelayar)
   dan dikongsi oleh kad ramalan, kad amaran dan senario AMS. */
const CUACA = {
  promise: null,
  load(force) {
    if (force || !this.promise) {
      this.promise = (async () => {
        if (location.protocol === 'file:') {
          const e = new Error('file');
          e.kind = 'file';
          throw e;
        }
        // Cache belum ada tetapi pelayan sedang mengambil data: cuba lagi sebentar (maks. ~30 saat).
        let res;
        for (let cuba = 0; ; cuba++) {
          res = await fetch('/api/cuaca', { cache: 'no-store' });
          const sedia = res.status === 503 && cuba < 6;
          const bd = sedia
            ? await res
                .clone()
                .json()
                .catch(() => null)
            : null;
          if (!(bd && bd.sedangDikemaskini)) break;
          await new Promise((r) => setTimeout(r, 5000));
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (!j || !Array.isArray(j.negeri) || !Array.isArray(j.po))
          throw new Error('Format data cuaca tidak sah');
        return j;
      })();
    }
    return this.promise;
  },
  staleHours: 30,
};
let cuacaState = { status: 'memuat', data: null };
const RISIKO_NILAI = { Rendah: 0, Sederhana: 1, Tinggi: 2 };
const cuacaFmt = new Intl.DateTimeFormat('ms-MY', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const cuacaMasa = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '-';
  const p = Object.fromEntries(cuacaFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} MYT`;
};
const cuacaHariIni = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
};
const cuacaLapuk = (d) => {
  const t = Date.parse(d && d.fetchedAt);
  return Number.isNaN(t) || (Date.now() - t) / 36e5 > CUACA.staleHours;
};
const cuacaRetryBtn = () => {
  return ' <button type="button" class="button tiny" data-act="cuaca-retry">Cuba semula</button>';
};
const cuacaTileData = (d, n) => {
  const hari = cuacaHariIni();
  const wakil = d.po.find((p) => p.poId === n.poWakilId) || d.po.find((p) => p.negeri === n.negeri);
  const met = n.tarikh.find((x) => x.tarikh >= hari) || n.tarikh[0] || null;
  const omHari = wakil && (wakil.harian || []).find((x) => x.tarikh >= hari);
  let risiko = 'Rendah';
  d.po
    .filter((p) => p.negeri === n.negeri)
    .forEach((p) => {
      const h = (p.harian || []).find((x) => x.tarikh >= hari);
      const r = h && h.risiko && h.risiko.tahap;
      if (r && RISIKO_NILAI[r] > RISIKO_NILAI[risiko]) risiko = r;
    });
  const keadaan = (met && met.keadaan) || (wakil && wakil.semasa && wakil.semasa.keadaan) || '-';
  const ikon =
    (met && met.keadaan && met.ikon) || (wakil && wakil.semasa && wakil.semasa.ikon) || '🌡️';
  const sMin = met && Number.isFinite(met.suhuMin) ? met.suhuMin : omHari && omHari.suhuMin;
  const sMax = met && Number.isFinite(met.suhuMax) ? met.suhuMax : omHari && omHari.suhuMax;
  const suhu = sMin != null && sMax != null ? `${Math.round(sMin)}–${Math.round(sMax)}°C` : '-';
  const angin = wakil && wakil.semasa && wakil.semasa.angin != null ? wakil.semasa.angin : null;
  const lembap =
    wakil && wakil.semasa && wakil.semasa.kelembapan != null ? wakil.semasa.kelembapan : null;
  return { negeri: n.negeri, keadaan, ikon, suhu, angin, lembap, risiko, met };
};
function renderWeather() {
  const grid = $('weatherGrid');
  const banner = $('weatherStatus');
  const note = $('weatherNote');
  const cs = cuacaState;
  let msg = '';
  let kind = '';
  if (cs.status === 'memuat') note.textContent = 'Memuatkan data cuaca…';
  else if (cs.status === 'file') {
    note.textContent = 'Data cuaca sebenar tidak tersedia';
    msg = 'Data cuaca sebenar memerlukan pelayan (npm start)';
  } else if (cs.status === 'error') {
    note.textContent = 'Data cuaca tidak tersedia';
    msg = 'Data cuaca tidak dapat dimuatkan.' + cuacaRetryBtn();
    kind = 'err';
  }
  if (cs.status !== 'ready') {
    grid.innerHTML = '';
    banner.hidden = !msg;
    banner.className = 'weather-banner' + (kind ? ' ' + kind : '');
    banner.innerHTML = msg;
    return;
  }
  const d = cs.data;
  note.textContent = 'Dikemas kini ' + cuacaMasa(d.fetchedAt);
  const sumberGagal = ['met', 'openMeteo']
    .filter((k) => d.sumber && d.sumber[k] && d.sumber[k].status === 'gagal')
    .map((k) => (k === 'met' ? 'MET Malaysia' : 'Open-Meteo'));
  if (cuacaLapuk(d)) {
    msg = 'Data lapuk: kemas kini terakhir ' + cuacaMasa(d.fetchedAt);
    kind = 'err';
  } else if (sumberGagal.length) {
    msg =
      'Sumber tidak dapat dikemas kini: ' + sumberGagal.join(', ') + ' (data terakhir dipaparkan)';
    kind = 'err';
  }
  banner.hidden = !msg;
  banner.className = 'weather-banner' + (kind ? ' ' + kind : '');
  banner.textContent = msg;
  const pilihan = state.po ? poById[state.po].negeri : null;
  const tiles = d.negeri
    .map((n) => cuacaTileData(d, n))
    .sort(
      (a, b) =>
        (b.negeri === pilihan) - (a.negeri === pilihan) ||
        RISIKO_NILAI[b.risiko] - RISIKO_NILAI[a.risiko] ||
        a.negeri.localeCompare(b.negeri),
    )
    .slice(0, 6);
  grid.innerHTML = tiles
    .map((w) => {
      const tip = w.met
        ? `Pagi: ${w.met.pagiMs || '-'} · Petang: ${w.met.tengahHariMs || '-'} · Malam: ${w.met.malamMs || '-'}`
        : '';
      return `<article class="weather-card" title="${esc(tip)}"><div class="weather-name"><span class="weather-nm">${esc(w.negeri)}</span><span class="weather-risk r-${esc(w.risiko.toLowerCase())}" title="Anggaran sistem, bukan amaran rasmi">${esc(w.risiko)}</span></div><div class="weather-now">${esc(w.ikon)} <span>${esc(w.keadaan)}</span></div><div class="weather-sub">♧ ${esc(w.suhu)}　≋ ${w.angin == null ? '-' : esc(Math.round(w.angin))} km/j　💧 ${w.lembap == null ? '-' : esc(Math.round(w.lembap))}%</div></article>`;
    })
    .join('');
}
const renderMetAlerts = () => {
  const body = $('metAlertBody');
  const note = $('metAlertNote');
  const cs = cuacaState;
  const sumber = 'Sumber: API rasmi MET Malaysia (dataset WARNING)';
  if (cs.status === 'memuat') {
    body.textContent = 'Memuatkan amaran…';
    note.textContent = sumber;
    return;
  }
  if (cs.status === 'file') {
    body.textContent = 'Amaran rasmi sebenar memerlukan pelayan (npm start)';
    note.textContent = sumber;
    return;
  }
  if (cs.status === 'error') {
    body.innerHTML = 'Amaran rasmi tidak dapat dimuatkan.' + cuacaRetryBtn();
    note.textContent = sumber;
    return;
  }
  const d = cs.data;
  const st = d.sumber && d.sumber.metAmaran ? d.sumber.metAmaran.status : 'gagal';
  const masa = cuacaMasa(d.amaranDiambil || d.fetchedAt);
  note.textContent = `${sumber} · Dikemas kini ${masa}`;
  if (st === 'tiada_dataset') {
    body.textContent = 'Amaran rasmi belum tersedia melalui API MET';
    return;
  }
  if (st === 'gagal') {
    body.innerHTML = 'Amaran rasmi tidak dapat dimuatkan.' + cuacaRetryBtn();
    return;
  }
  const kini = Date.now();
  const aktif = (d.amaran || []).filter((a) => !a.sah_hingga || Date.parse(a.sah_hingga) >= kini);
  if (!aktif.length) {
    body.innerHTML = `<div class="alert-item"><b>Tiada amaran rasmi aktif</b><p>Sumber: MET Malaysia · ${esc(masa)}</p></div>`;
    return;
  }
  const had = 4;
  body.innerHTML =
    aktif
      .slice(0, had)
      .map((a) => {
        const lok =
          a.negeri && a.negeri.length
            ? a.negeri.length > 4
              ? a.negeri.length + ' negeri'
              : a.negeri.join(', ')
            : '';
        const sah = a.sah_hingga ? ' · Sah hingga ' + cuacaMasa(a.sah_hingga) : '';
        return `<div class="alert-item"><b>${esc(a.tajuk)}${lok ? ' · ' + esc(lok) : ''}</b><p title="${esc(a.teks)}">${esc(a.teks)}</p><p class="alert-meta">MET Malaysia · Dikeluarkan ${esc(cuacaMasa(a.dikeluarkan))}${esc(sah)}</p></div>`;
      })
      .join('') +
    (aktif.length > had
      ? `<div class="alert-item"><b>+${aktif.length - had} amaran aktif lain</b></div>`
      : '');
};
const aplikasiCuaca = (p) => {
  return p.then(
    (d) => {
      cuacaState = { status: 'ready', data: d };
    },
    (e) => {
      cuacaState = { status: e && e.kind === 'file' ? 'file' : 'error', data: null };
    },
  );
};
const initCuaca = (force) => {
  cuacaState = { status: 'memuat', data: null };
  renderWeather();
  renderMetAlerts();
  return aplikasiCuaca(CUACA.load(force)).then(() => {
    renderWeather();
    renderMetAlerts();
  });
};
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-act="cuaca-retry"]')) return;
  initCuaca(true).then(() => {
    if (typeof initScenarios === 'function') initScenarios();
  });
});
/* ===== Tamat cuaca sebenar ===== */ function logistikStatsHTML(l) {
  return `<div class="logistic-stat-grid"><div class="logistic-stat"><div class="l-label">Kenderaan</div><div class="l-val">${l.kenderaan} buah</div></div><div class="logistic-stat"><div class="l-label">Muatan</div><div class="l-val">${l.muatanMT.toFixed(2)} MT</div></div><div class="logistic-stat"><div class="l-label">Bilik sejuk</div><div class="l-val">${l.bilikSejuk} unit</div></div><div class="logistic-stat"><div class="l-label">Kapasiti simpanan</div><div class="l-val">${l.kapasitiSimpananMT.toFixed(2)} MT</div></div></div>`;
}
function poHoverHTML(p) {
  const l = p.logistik;
  const s = poStatus(p);
  const share = l.shared
    ? `<div class="shared-warning">⚠ <b>Angka gabungan:</b> ${l.pemilikBersama.map(esc).join(' + ')}</div>`
    : '';
  return `<div class="ph-name">${esc(p.name)}</div><div class="ph-sub">${esc(p.negeri)} · ${statusHTML(s)}</div>${logistikStatsHTML(l)}${share}<div class="ph-out">Outlet intervensi terdekat (dummy)</div>${p.outlets
    .slice(0, 3)
    .map(
      (o) =>
        `<div class="outlet-item"><span><b>${esc(o.jenis)}</b> · ${esc(o.nama)}</span><span class="nowrap">${o.jarakKm} km</span></div>`,
    )
    .join('')}`;
}
let poHoverPopup = null;
function hidePOHover() {
  if (poHoverPopup) poHoverPopup.remove();
}
function showPOHover(p) {
  if (!map || typeof maplibregl === 'undefined') return;
  const O = 14,
    opts = {
      closeButton: false,
      closeOnClick: false,
      offset: O,
      maxWidth: '300px',
      className: 'po-hover-popup',
    };
  const html = poHoverHTML(p);
  hidePOHover();
  poHoverPopup = new maplibregl.Popup(opts).setLngLat([p.lon, p.lat]).setHTML(html).addTo(map);
  // Jika popup tidak muat di atas atau di bawah titik, buka di sisi dan anjak supaya kekal dalam peta
  const e = poHoverPopup.getElement(),
    h = e.querySelector('.maplibregl-popup-content').offsetHeight,
    ht = e.offsetHeight,
    pt = map.project([p.lon, p.lat]),
    H = map.getContainer().clientHeight,
    W = map.getContainer().clientWidth;
  if (pt.y + O + ht <= H || pt.y - O - ht >= 0) return;
  const side = W - pt.x >= pt.x ? 'left' : 'right';
  let dy = 0;
  if (pt.y - h / 2 < 0) dy = h / 2 - pt.y;
  else if (pt.y + h / 2 > H) dy = H - h / 2 - pt.y;
  poHoverPopup.remove();
  poHoverPopup = new maplibregl.Popup({
    ...opts,
    anchor: side,
    offset: [side === 'left' ? O : -O, dy],
  })
    .setLngLat([p.lon, p.lat])
    .setHTML(html)
    .addTo(map);
  if (dy) poHoverPopup.addClassName('po-hover-notip');
}
function renderOutlets() {
  const p = state.po ? poById[state.po] : null;
  $('outletSub').textContent = p ? p.name : 'Pilih PO pada peta atau direktori';
  if (!p) {
    $('outletContent').innerHTML =
      `<div class="outlet-note" style="padding-bottom:11px">Klik salah satu daripada 15 PO untuk melihat bilangan kenderaan, muatan, bilik sejuk dan kapasiti simpanan berdasarkan infografik asal. Outlet intervensi di bawah ialah dummy.</div>`;
    return;
  }
  const l = p.logistik;
  const share = l.shared
    ? `<div class="shared-warning">⚠ <b>Angka gabungan:</b> ${l.pemilikBersama.map(esc).join(' + ')}. Infografik tidak memperincikan agihan setiap PO. Angka ini <b>tidak</b> dikira dua kali dalam jumlah nasional.</div>`
    : '';
  $('outletContent').innerHTML =
    `${logistikStatsHTML(l)}${share}<div class="outlet-note">Sumber: infografik kesiapsiagaan logistik PO. Kadar penggunaan / baki semasa <b>tidak dinyatakan</b> dalam infografik.</div><div style="font-size:12px;font-weight:800;margin-top:11px">Outlet intervensi terdekat (dummy)</div>${p.outlets.map((o) => `<div class="outlet-item"><span><b>${esc(o.jenis)}</b> · ${esc(o.nama)}</span><span class="nowrap">${o.jarakKm} km</span></div>`).join('')}`;
}

function renderLists() {
  const lo = filteredRecords({ stage: state.lowStage })
    .sort((a, b) => a.mingguTerkini - b.mingguTerkini)
    .slice(0, 5);
  const hi = filteredRecords({ stage: state.highStage })
    .sort((a, b) => b.mingguTerkini - a.mingguTerkini)
    .slice(0, 5);
  const make = (rows, dir) =>
    rows.length
      ? rows
          .map(
            (r) =>
              `<div class="price-row" data-record="${esc(r.id)}"><div><div class="price-name">${esc(r.komoditi)}</div><div class="price-loc">${esc(r.daerah)}, ${esc(r.negeri)} · ${esc(r.unit)} ${statusHTML(r.status)}</div></div><div class="price-value value-${dir}">${money(r.mingguTerkini)}</div></div>`,
          )
          .join('')
      : '<div class="empty">Tiada rekod mengikut penapis. Tukar “Mod senarai” kepada semua komoditi.</div>';
  $('lowestPrices').innerHTML = make(lo, 'red');
  $('highestPrices').innerHTML = make(hi, 'green');
  document.querySelectorAll('.price-row').forEach(
    (el) =>
      (el.onclick = () => {
        state.chartRecord = el.dataset.record;
        renderTrend();
        document
          .querySelector('.chart-panel')
          .scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }),
  );
}
function renderCompare() {
  let rows = filteredRecords({ stage: 'Borong' })
    .sort(
      (a, b) =>
        weight[b.status] - weight[a.status] || Math.abs(b.perubahanPct) - Math.abs(a.perubahanPct),
    )
    .slice(0, 7);
  $('compareBody').innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<tr data-record="${esc(r.id)}"><td><div class="cell-major">${esc(r.negeri)} · ${esc(r.daerah)}</div><div class="cell-minor">${esc(r.komoditi)}</div></td><td class="number">${money(r.mingguSebelum)}</td><td class="number"><b>${money(r.mingguTerkini)}</b></td><td class="number">${money(r.ramalan)}</td><td class="number ${r.perubahanPct >= 0 ? 'positive' : 'negative'}"><b>${r.perubahanPct >= 0 ? '+' : ''}${r.perubahanPct.toFixed(2)}%</b> ${r.perubahanPct >= 0 ? '▲' : '▼'}</td><td>${statusHTML(r.status)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="6"><div class="empty">Tiada komoditi memenuhi penapis.</div></td></tr>';
  document.querySelectorAll('#compareBody tr[data-record]').forEach(
    (el) =>
      (el.onclick = () => {
        state.chartRecord = el.dataset.record;
        renderTrend();
        document
          .querySelector('.chart-panel')
          .scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }),
  );
}
function renderTrend() {
  const all = filteredRecords({ stage: 'Borong', issues: false });
  let r = DATA.rekod.find((x) => x.id === state.chartRecord && all.includes(x));
  if (!r) {
    r = [...all].sort((a, b) => weight[b.status] - weight[a.status])[0];
  }
  if (!r) {
    $('priceChart').innerHTML = '<text x="50" y="130">Tiada data untuk paparan graf.</text>';
    $('chartSubject').textContent = 'Tiada rekod memenuhi penapis';
    return;
  }
  const n = Math.min(state.days, r.prices.length),
    vals = r.prices.slice(-n),
    forecast = r.ramalan,
    mean = r.purata,
    sigma = r.sigma,
    lower1 = mean - sigma,
    upper1 = mean + sigma,
    lower2 = mean - 2 * sigma,
    upper2 = mean + 2 * sigma,
    min = Math.min(...vals, lower2, r.hargaLantai, forecast),
    max = Math.max(...vals, upper2, r.hargaSiling, forecast),
    pad = (max - min) * 0.1 || 1,
    ymin = min - pad,
    ymax = max + pad;
  const W = 600,
    H = 420,
    left = 50,
    right = 545,
    top = 16,
    bottom = 385;
  const px = (i) => left + (i / n) * (right - left),
    py = (v) => bottom - ((v - ymin) / (ymax - ymin)) * (bottom - top);
  const e = [];
  const line = (y, cls, label) => {
    const yy = py(y);
    e.push(
      `<line class="${cls}" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text x="${right + 8}" y="${yy + 3}" style="font-size:13px">${label}</text>`,
    );
  };
  e.push(
    `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="7" style="fill:var(--ch-bg)"/>`,
  );
  e.push(
    `<rect x="${left}" y="${py(upper1)}" width="${right - left}" height="${Math.max(0, py(lower1) - py(upper1))}" style="fill:var(--ch-ok)" opacity=".32"/>`,
  );
  e.push(
    `<rect x="${left}" y="${py(upper2)}" width="${right - left}" height="${Math.max(0, py(upper1) - py(upper2))}" style="fill:var(--ch-warn)" opacity=".22"/>`,
  );
  e.push(
    `<rect x="${left}" y="${py(lower1)}" width="${right - left}" height="${Math.max(0, py(lower2) - py(lower1))}" style="fill:var(--ch-warn)" opacity=".22"/>`,
  );
  for (let i = 0; i < 5; i++) {
    const y = top + (i * (bottom - top)) / 4,
      v = ymax - (i * (ymax - ymin)) / 4;
    e.push(
      `<line class="axis" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text x="${left - 10}" y="${y + 4}" text-anchor="end">${v.toFixed(1)}</text>`,
    );
  }
  line(upper2, 'critical-line', '+2σ');
  line(lower2, 'critical-line', '−2σ');
  line(upper1, 'warning-line', '+1σ');
  line(lower1, 'warning-line', '−1σ');
  line(mean, 'avg-line', 'μ');
  line(r.hargaLantai, 'critical-line', 'Lantai');
  line(r.hargaSiling, 'critical-line', 'Siling');
  const coords = vals.map((v, i) => `${px(i)},${py(v)}`);
  e.push(`<polyline class="line" points="${coords.join(' ')}"/>`);
  for (let i = 0; i < n; i++) {
    if (i % Math.max(1, Math.ceil(n / 12)) === 0 || i === n - 1)
      e.push(
        `<circle cx="${px(i)}" cy="${py(vals[i])}" r="3" style="fill:var(--ch-pt);stroke:var(--ch-pt-stroke)" stroke-width="1.5"/>`,
      );
  }
  e.push(
    `<line class="forecast-line" x1="${px(n - 1)}" y1="${py(vals[n - 1])}" x2="${px(n)}" y2="${py(forecast)}"/>`,
  );
  e.push(
    `<circle cx="${px(n)}" cy="${py(forecast)}" r="5" style="fill:${r.status === 'merah' ? 'var(--red)' : r.status === 'kuning' ? 'var(--yellow)' : 'var(--green)'}" stroke="white" stroke-width="1"/>`,
  );
  const start = new Date(Date.UTC(2026, 10, 14 - n + 1)),
    datefmt = (d) =>
      `${d.getUTCDate()} ${['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][d.getUTCMonth()]}`;
  for (let i = 0; i < n; i += Math.max(1, Math.ceil(n / 6))) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    e.push(`<text x="${px(i)}" y="${bottom + 19}" text-anchor="middle">${datefmt(d)}</text>`);
  }
  e.push(`<text x="${right}" y="${bottom + 19}" text-anchor="middle">Ramalan</text>`);
  $('priceChart').innerHTML = e.join('');
  $('chartSubject').textContent =
    `${r.komoditi} · ${r.daerah}, ${r.negeri} · ${r.peringkat} · ${r.unit} · ${n} hari`;
  $('chartStatus').innerHTML = `${statusHTML(r.status)} · Forecast ${money(r.ramalan)}`;
}
function renderQueue() {
  const rr = filteredRecords({ stage: 'Borong', issues: true }).sort(
    (a, b) =>
      weight[b.status] - weight[a.status] ||
      Math.abs((b.ramalan - b.purata) / b.sigma) - Math.abs((a.ramalan - a.purata) / a.sigma),
  );
  $('riskCount').textContent = rr.length + ' isu';
  $('riskFeed').innerHTML = rr.length
    ? rr
        .slice(0, 8)
        .map(
          (r) =>
            `<div class="risk-item" data-risk="${esc(r.id)}"><i class="dot ${r.status === 'merah' ? 'red' : 'yellow'}" style="margin-top:5px"></i><div class="risk-main"><strong>${esc(r.daerah)} · ${esc(r.komoditi)}</strong><div class="meta">${esc(r.negeri)} · Ramalan <b>${money(r.ramalan)}</b> · ${esc(r.sebab)}<br>${esc(poById[r.poId].name)}</div></div><button class="button tiny ${r.status === 'merah' ? 'danger' : 'ghost'}" data-open-action="${esc(r.id)}">Tindakan</button></div>`,
        )
        .join('')
    : '<div class="empty">Tiada isu kritikal atau amaran dalam pilihan semasa.</div>';
  document.querySelectorAll('[data-risk]').forEach((el) =>
    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-action]')) return;
      const r = DATA.rekod.find((x) => x.id === el.dataset.risk);
      if (r) {
        selectPO(r.poId);
        state.daerah = r.daerah;
        state.chartRecord = r.id;
        renderAll();
      }
    }),
  );
  document
    .querySelectorAll('[data-open-action]')
    .forEach((b) => (b.onclick = () => openActionModal(b.dataset.openAction)));
}
function renderAll() {
  renderLogistik();
  renderKpis();
  renderMap();
  renderPODirectory();
  renderWeather();
  renderOutlets();
  renderLists();
  renderCompare();
  renderTrend();
  renderQueue();
  renderScenarioPanel();
  const selected = state.po ? poById[state.po] : null;
  $('analyticsScope').textContent = selected
    ? `Tertapis: ${selected.name} · ${selected.negeri} / ${state.daerah || 'Semua daerah'} · ${state.issues ? 'komoditi bermasalah' : 'semua komoditi'}`
    : `Paparan lalai: ${state.issues ? 'komoditi bermasalah' : 'semua komoditi'} seluruh kawasan pilihan`;
  $('scopeChip').textContent = selected
    ? `◉ ${selected.name} · ${selected.negeri} ${state.daerah ? '· ' + state.daerah : ''}`
    : '◉ Seluruh Malaysia';
  $('filterState').value = state.po || 'all';
}
function openActionModal(recordId, opts) {
  const r = DATA.rekod.find((x) => x.id === recordId);
  if (!r) return;
  const p = poById[r.poId];
  $('modalMount').innerHTML =
    `<div class="modal-back" id="modalBack"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><div><div class="eyebrow">REKOD INTERVENSI · DATA DUMMY</div><h2 id="modalTitle">${esc(r.komoditi)} · ${esc(r.daerah)}</h2></div><button class="close-x" id="modalClose" aria-label="Tutup">×</button></div><div class="modal-body"><div class="modal-card"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(p.name)} / ${esc(r.negeri)}</b>${statusHTML(r.status)}</div><div class="note" style="margin-top:6px">Forecast: ${money(r.ramalan)} · Purata 30 hari: ${money(r.purata)} · Had: ${money(r.hargaLantai)} – ${money(r.hargaSiling)} · ${esc(r.sebab)}</div></div><div class="modal-grid"><div class="modal-card"><b>Cadangan outlet (simulasi)</b>${p.outlets.map((o) => `<div class="outlet-item">${esc(o.jenis)} · ${esc(o.nama)} <span>${o.jarakKm} km</span></div>`).join('')}</div><div class="modal-card"><b>Logistik PO (berdasarkan infografik)</b><div style="margin-top:10px">Kenderaan: ${p.logistik.kenderaan} buah · Muatan: ${p.logistik.muatanMT} MT</div><div>Bilik sejuk: ${p.logistik.bilikSejuk} unit</div><div>Kapasiti simpanan: ${p.logistik.kapasitiSimpananMT} MT</div><div class="note">${p.logistik.shared ? 'Angka gabungan: ' + p.logistik.pemilikBersama.join(' + ') : 'Angka PO daripada infografik'}. Baki sebenar tidak tersedia.</div></div></div><div class="modal-grid"><label>Jenis intervensi<select id="actionType"><option>Semakan pergerakan harga</option><option>Pengalihan bekalan</option><option>Penyelarasan jualan di outlet</option><option>Pemantauan bersama PO</option></select></label><label>Status tindakan<select id="actionStatus"><option>Dalam tindakan</option><option>Untuk semakan</option><option>Selesai</option></select></label></div><label style="display:block;margin-top:12px">Catatan tindakan<textarea id="actionNote" placeholder="Contoh: Semakan trend harga harian dan koordinasi dengan PO (simulasi)."></textarea></label><div class="note" style="margin-top:7px">Tindakan ini hanya direkodkan dalam pelayar tempatan. Tiada penghantaran kepada FAMA.</div></div><div class="modal-actions"><button class="button ghost" id="actionCancel">Batal</button><button class="button" id="saveAction">✓ Rekod Tindakan</button></div></section></div>`;
  if (opts && opts.note) $('actionNote').value = opts.note;
  const close = () => {
    $('modalMount').innerHTML = '';
  };
  $('modalClose').onclick = close;
  $('actionCancel').onclick = close;
  $('modalBack').onclick = (e) => {
    if (e.target === $('modalBack')) close();
  };
  $('saveAction').onclick = () => {
    actions.unshift({
      poId: p.id,
      daerah: r.daerah,
      komoditi: r.komoditi,
      jenis: $('actionType').value,
      status: $('actionStatus').value,
      catatan: $('actionNote').value,
      masa: new Date().toLocaleString('ms-MY'),
    });
    let saved = true;
    try {
      localStorage.setItem('fama-demo-intervensi-v1', JSON.stringify(actions));
    } catch (_) {
      saved = false;
    }
    close();
    renderKpis();
    toast(
      saved
        ? 'Rekod intervensi simulasi disimpan dalam pelayar ini.'
        : 'Rekod hanya disimpan buat sementara. Storan pelayar tidak tersedia.',
    );
  };
}
function openLogModal() {
  $('modalMount').innerHTML =
    `<div class="modal-back" id="modalBack"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>☷ Rekod Tindakan Intervensi (Simulasi)</h2><button class="close-x" id="modalClose">×</button></div><div class="modal-body">${
      actions.length
        ? actions
            .slice(0, 30)
            .map(
              (a) =>
                `<div class="modal-card"><b>${esc(a.komoditi)} · ${esc(a.daerah)}</b><span style="float:right" class="tag-status">${esc(a.status)}</span><div class="note">${esc(a.masa)} · ${esc(a.jenis)} · ${esc(poById[a.poId]?.name || a.poId)}</div><div style="font-size:12px;margin-top:6px">${esc(a.catatan || 'Tiada catatan')}</div></div>`,
            )
            .join('')
        : '<div class="empty">Belum ada tindakan direkodkan. Pilih “Tindakan” pada senarai keutamaan untuk mencuba.</div>'
    }<div class="note">Data tindakan disimpan secara setempat dalam pelayar sahaja.</div></div><div class="modal-actions"><button class="button ghost" id="modalClose2">Tutup</button><button class="button danger" id="clearLogs" ${!actions.length ? 'disabled' : ''}>Padam Semua Rekod Demo</button></div></section></div>`;
  const close = () => {
    $('modalMount').innerHTML = '';
  };
  $('modalClose').onclick = close;
  $('modalClose2').onclick = close;
  $('modalBack').onclick = (e) => {
    if (e.target === $('modalBack')) close();
  };
  $('clearLogs').onclick = () => {
    if (confirm('Padam semua rekod intervensi simulasi dalam pelayar ini?')) {
      actions = [];
      try {
        localStorage.removeItem('fama-demo-intervensi-v1');
      } catch (_) {}
      close();
      renderKpis();
      toast('Rekod simulasi dipadam.');
    }
  };
}
function exportCSV() {
  const fields = [
    'poId',
    'negeri',
    'daerah',
    'komoditi',
    'peringkat',
    'unit',
    'mingguSebelum',
    'mingguTerkini',
    'perubahanPct',
    'purata',
    'sigma',
    'ramalan',
    'hargaLantai',
    'hargaSiling',
    'status',
    'sebab',
  ];
  const recs = filteredRecords({ issues: false });
  const encode = (x) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  const csv =
    '\ufeff' +
    fields.join(',') +
    '\r\n' +
    recs.map((r) => fields.map((f) => encode(r[f])).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fama_harga_dummy_tapisan.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${recs.length} rekod CSV dummy dieksport.`);
}
function exportLogistikCSV() {
  const fields = [
    'namaPO',
    'negeri',
    'kumpulanLogistik',
    'sumberAngkaGabungan',
    'kenderaan',
    'muatanMT',
    'bilikSejuk',
    'kapasitiSimpananMT',
    'latAnggaran',
    'lonAnggaran',
  ];
  const quoted = (x) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  const rows = DATA.po.map((p) => [
    p.name,
    p.negeri,
    p.logistik.pemilikBersama.join(' / '),
    p.logistik.shared ? 'Ya - dua PO' : 'Tidak',
    p.logistik.kenderaan,
    p.logistik.muatanMT,
    p.logistik.bilikSejuk,
    p.logistik.kapasitiSimpananMT,
    p.lat,
    p.lon,
  ]);
  const csv =
    '\ufeff' +
    fields.map(quoted).join(',') +
    '\r\n' +
    rows.map((row) => row.map(quoted).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pemetaan_logistik_15_PO_FAMA.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(
    '15 PO dieksport. Angka gabungan dipaparkan pada kedua-dua PO dan tidak boleh dijumlahkan terus.',
  );
}

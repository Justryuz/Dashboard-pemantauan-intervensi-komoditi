const $ = (id) => document.getElementById(id);
const state = {
  po: null,
  daerah: null,
  negeri: 'all',
  bulan: 'all',
  minggu: 'all', // Isnin minggu ISO (YYYY-MM-DD) atau 'all' = minggu lengkap terkini (dalam bulan dipilih)
  komoditi: 'all',
  varieti: 'all',
  indikator: 'all',
  issues: true,
  days: 30,
  banjir: true,
  chartRecord: null,
  lowStage: 'Ladang',
  highStage: 'Borong',
  ewsTab: 'amaran',
};
// Status harga sebenar (DB Harga): merah harga sahaja = "Amaran harga" (tidak berkelip); kelabu = tiada ambang.
const labels = {
  merah: 'Amaran harga',
  kuning: 'Berwaspada',
  hijau: 'Stabil',
  kelabu: 'Tiada ambang',
};
const weight = HARGADB.BOBOT;
let actions = [];
try {
  actions = JSON.parse(localStorage.getItem('fama-demo-intervensi-v1') || '[]');
  actions = Array.isArray(actions) ? actions.filter((a) => a && typeof a === 'object') : [];
} catch (_) {
  actions = [];
}
// PO tambahan (pemetaan FIS 2.1, penanda petak) ada dalam poById supaya pilihan PO memacu panel seperti PO utama.
const TBH = DATA.poTambahan || [];
const poById = Object.fromEntries([...DATA.po, ...TBH].map((p) => [p.id, p]));
/* ===== Harga sebenar (DB Harga) =====
   Semua nombor harga datang daripada /api/harga* melalui HARGADB (pelayan menjadi satu-satunya pengira status,
   sebab dan ambang). Senarai Bulan, Komoditi dan Varieti datang daripada /api/harga/meta. Rekod harga ialah
   baris ringkasan {peringkat, po, daerah, commodity, variety, harga, status, sebab, ...}. */
const BULAN_NAMA = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];
const bulanLabel = (k) => BULAN_NAMA[+k.slice(5) - 1] + ' ' + k.slice(0, 4);
let SENARAI_BULAN = [];
/* Minggu ISO (Isnin–Ahad) untuk penapis Minggu: minggu lengkap dalam tetingkap cache (12 minggu) berakhir pada
   minggu lengkap terkini (Ahad <= tarikh data terkini). Bulan sesuatu minggu = bulan hari Ahadnya (sama dengan pelayan). */
const tkhUTC = (s) => new Date(s + 'T00:00:00Z');
const tkhStr = (d) => d.toISOString().slice(0, 10);
const tambahHariS = (s, n) => tkhStr(new Date(tkhUTC(s).getTime() + n * 864e5));
const isninS = (s) => tambahHariS(s, -((tkhUTC(s).getUTCDay() + 6) % 7));
function noMingguIso(isnin) {
  const k = tkhUTC(tambahHariS(isnin, 3)); // Khamis minggu itu menentukan tahun ISO
  const awal = Date.UTC(k.getUTCFullYear(), 0, 1);
  return Math.floor((k - awal) / 864e5 / 7) + 1;
}
const BLN_PENDEK = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogo',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
];
const tkhPendek = (s) => +s.slice(8, 10) + ' ' + BLN_PENDEK[+s.slice(5, 7) - 1];
const mingguLabel = (isnin) =>
  'Minggu ' +
  noMingguIso(isnin) +
  ' (' +
  tkhPendek(isnin) +
  '–' +
  tkhPendek(tambahHariS(isnin, 6)) +
  ')';
function senaraiMinggu() {
  const T = HARGA_META && HARGA_META.tarikhTerkini;
  if (!T) return [];
  let m = isninS(T);
  if (tambahHariS(m, 6) > T) m = tambahHariS(m, -7);
  const out = [];
  for (let i = 0; i < 12; i++, m = tambahHariS(m, -7))
    if (state.bulan === 'all' || tambahHariS(m, 6).slice(0, 7) === state.bulan) out.push(m);
  return out;
}
let HARGA_META = null;
// "Semua bulan" = minggu lengkap terkini; bulan dipilih = minggu lengkap terkini dalam bulan itu.
const BULAN_LALAI = 'all';
const SENARAI_NEGERI = [...new Set(DATA.po.map((p) => p.negeri))].sort((a, b) =>
  a.localeCompare(b, 'ms'),
);
const PERINGKAT_API = { Ladang: 'LADANG', Borong: 'BORONG', Runcit: 'RUNCIT' };
const PERINGKAT_NAMA = { LADANG: 'Ladang', BORONG: 'Borong', RUNCIT: 'Runcit' };
const normD = HARGADB.normDaerah;
// (NEGERI DB | nama daerah DB ternormal) -> id PO tambahan (satu daerah boleh dalam beberapa PO tambahan)
const TBH_KUNCI = new Map();
TBH.forEach((p) =>
  p.districts.forEach((d) => {
    const k = d[3] + '|' + normD(d[4]);
    if (!TBH_KUNCI.has(k)) TBH_KUNCI.set(k, []);
    TBH_KUNCI.get(k).push(p.id);
  }),
);
const tbhRekod = (r) =>
  TBH_KUNCI.get(String(r.negeri || '').toUpperCase() + '|' + normD(r.daerah)) || [];
const namaKom = HARGADB.tajuk;
// Padankan nama komoditi data dummy (cth. "Cili Merah") kepada komoditi DB Harga (cth. "CILI"); null jika tiada.
function komoditiHarga(nama) {
  const senarai = HARGA_META ? HARGA_META.penapis.komoditi : [];
  const n = String(nama || '').toUpperCase();
  return (
    senarai.find((c) => c === n) ||
    senarai.find((c) => n.startsWith(c + ' ') || c.startsWith(n + ' ')) ||
    null
  );
}
// Varieti senarai putih bagi satu jenis (daripada /api/harga/meta); sudah A-Z daripada pelayan.
const varietiUntuk = (kom) =>
  HARGA_META && HARGA_META.penapis.varieti[kom]
    ? [...HARGA_META.penapis.varieti[kom]].sort((a, b) => a.localeCompare(b, 'ms'))
    : [];
// Data harga bagi penapis semasa (Komoditi + Varieti + Bulan). Dipasang oleh muatHarga().
const HD = {
  sedia: false,
  ralat: null,
  ralatKunci: '',
  kunci: '',
  po: {},
  daerah: {},
  idxPO: {},
  idxDaerah: {},
};
// Komoditi + varieti: syarat rekod bersama (bulan sudah dikenakan oleh pelayan).
function padanRekod(r) {
  return (
    (state.komoditi === 'all' || r.commodity === state.komoditi) &&
    (state.varieti === 'all' || r.variety === state.varieti)
  );
}
/* Harga minggu ISO lengkap yang dipilih (bulan = minggu lengkap terkini dalam bulan itu). Nilai sudah dikira
   pelayan; tiada pengiraan semula di klien. */
function hargaMinggu(r) {
  return { terkini: r.harga, sebelum: r.hargaSebelum, pct: r.pctMinggu };
}
// Negeri rekod dalam bentuk DATA.po (cth. KL di bawah PO Selayang = Selangor).
const negeriRekod = (r) =>
  r.po && poById[r.po]
    ? poById[r.po].negeri
    : r.tpo && r.tpo.length
      ? poById[r.tpo[0]].negeri
      : namaKom(r.negeri);
const kunciRekod = (r) =>
  [r.peringkat, r.po || '', r.daerah || '', r.commodity, r.variety].join('|');
function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}
const money = HARGA.rm;
const fmt = (x) => Number(x).toLocaleString('ms-MY');
function statusHTML(s) {
  return `<span class="status-text status-${s}">● ${labels[s]}</span>`;
}
// Rekod aras daerah mengikut penapis. "Bermasalah sahaja" = merah/kuning; BORONG ialah pembanding (tiada
// status) maka tidak ditapis oleh mod itu.
function filteredRecords({ issues = state.issues, stage = null, ignoreStatus = false } = {}) {
  const peringkat = stage ? [PERINGKAT_API[stage]] : ['LADANG', 'RUNCIT', 'BORONG'];
  return peringkat
    .flatMap((p) => HD.daerah[p] || [])
    .filter(
      (r) =>
        (!state.po || r.po === state.po || (r.tpo || []).includes(state.po)) &&
        (!state.daerah || normD(r.daerah) === normD(state.daerah)) &&
        (state.negeri === 'all' || negeriRekod(r) === state.negeri) &&
        padanRekod(r) &&
        (ignoreStatus || state.indikator === 'all' || r.status === state.indikator) &&
        (!issues || r.peringkat === 'BORONG' || r.status === 'merah' || r.status === 'kuning'),
    );
}
// Status PO (atau satu daerahnya) = yang terburuk antara kunci LADANG (Pengeluar) dan RUNCIT (Pengguna).
// Kelabu hanya jika semua kunci kelabu atau tiada data. BORONG ialah pembanding dan tidak dikira.
function poStatus(p, district = null) {
  if (!HD.sedia) return 'kelabu';
  const dn = district ? normD(district) : null;
  const st = [];
  ['LADANG', 'RUNCIT'].forEach((pr) => {
    const rr = (district ? HD.idxDaerah : HD.idxPO)[pr].get(p.id) || [];
    rr.forEach((r) => {
      // Aras PO utama: amaranPo (dikira pelayan daripada status daerah); selainnya status rekod sendiri.
      if ((!dn || normD(r.daerah) === dn) && padanRekod(r)) st.push(statusRekodPo(r));
    });
  });
  return HARGADB.statusTerburuk(st);
}
const statusRekodPo = (r) => (r.amaranPo ? r.amaranPo.status : r.status);
// Rekod PO utama dengan amaranPo terburuk (ikut penapis komoditi/varieti), untuk sebab dalam pop-up dan panel.
function amaranPoInfo(p) {
  if (!HD.sedia || p.tambahan) return null;
  let t = null;
  ['LADANG', 'RUNCIT'].forEach((pr) =>
    ((HD.idxPO[pr] && HD.idxPO[pr].get(p.id)) || []).forEach((r) => {
      if (
        r.amaranPo &&
        padanRekod(r) &&
        (!t || weight[statusRekodPo(r)] > weight[statusRekodPo(t)])
      )
        t = r;
    }),
  );
  return t;
}
function amaranPoTeks(p) {
  const r = amaranPoInfo(p);
  return r ? `${namaRekod(r)} · ${PERINGKAT_NAMA[r.peringkat]}: ${r.amaranPo.sebab}` : '';
}
// Rekod harga terburuk bagi satu daerah PO (untuk sebab dan harga dalam pop-up daerah).
function ringkasDaerah(p, district) {
  if (!HD.sedia) return null;
  const dn = normD(district);
  let t = null;
  ['LADANG', 'RUNCIT'].forEach((pr) =>
    (HD.idxDaerah[pr].get(p.id) || []).forEach((r) => {
      if (normD(r.daerah) === dn && padanRekod(r) && (!t || weight[r.status] > weight[t.status]))
        t = r;
    }),
  );
  return t;
}
// Senarai PO tambahan untuk dropdown: ikut Negeri sahaja (cascade), tidak ikut Indikator.
function statePOTambahanSenarai() {
  return TBH.filter((p) => state.negeri === 'all' || p.negeri === state.negeri);
}
// PO tambahan dalam tapisan (hanya bila suis PO Tambahan ON). Tidak dikira dalam KPI 15 PO utama.
function statePOTambahan() {
  if (!window.FamaPOT || !FamaPOT.tunjuk()) return [];
  return statePOTambahanSenarai().filter(
    (p) => state.indikator === 'all' || poStatus(p) === state.indikator,
  );
}
function statePOs() {
  return DATA.po.filter(
    (p) =>
      (state.negeri === 'all' || p.negeri === state.negeri) &&
      (state.indikator === 'all' || poStatus(p) === state.indikator),
  );
}
/* Muat data harga bagi penapis semasa. Tiga peringkat x dua aras (PO dan daerah). LADANG dengan mod pengeluar
   (kunci tanpa ladang diganti harga borong berlabel), RUNCIT dengan mod pengguna, BORONG pembanding. */
function pertanyaanHarga() {
  const asas = {};
  if (state.komoditi !== 'all') asas.commodity = state.komoditi;
  if (state.varieti !== 'all') asas.variety = state.varieti;
  if (state.minggu !== 'all') asas.minggu = state.minggu;
  else if (state.bulan !== 'all') asas.bulan = state.bulan;
  const q = [];
  ['LADANG', 'RUNCIT', 'BORONG'].forEach((pr) => {
    const jenis = pr === 'LADANG' ? { mod: 'pengeluar' } : { peringkat: pr };
    q.push(['po', pr, { ...asas, ...jenis, aras: 'po' }]);
    q.push(['daerah', pr, { ...asas, ...jenis, aras: 'daerah' }]);
    if (TBH.length) q.push(['po_tambahan', pr, { ...asas, ...jenis, aras: 'po_tambahan' }]);
  });
  return q;
}
const kunciPertanyaan = () =>
  pertanyaanHarga()
    .map((x) => HARGADB.url('ringkasan', x[2]))
    .join(' ');
function terapHarga(qs) {
  HD.po = {};
  HD.daerah = {};
  HD.idxPO = {};
  HD.idxDaerah = {};
  qs.forEach(([aras, pr, params]) => {
    const rows = (HARGADB.segerak('ringkasan', params) || {}).baris || [];
    const idx = new Map();
    if (aras === 'daerah') rows.forEach((r) => (r.tpo = tbhRekod(r)));
    rows.forEach((r) => {
      const k = r.po || '';
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(r);
    });
    // Rekod daerah juga diindeks di bawah setiap PO tambahan yang meliputi daerah itu
    if (aras === 'daerah')
      rows.forEach((r) =>
        r.tpo.forEach((id) => {
          if (!idx.has(id)) idx.set(id, []);
          idx.get(id).push(r);
        }),
      );
    if (aras === 'po') {
      HD.po[pr] = rows;
      HD.idxPO[pr] = idx;
    } else if (aras === 'po_tambahan') {
      if (!HD.idxPO[pr]) HD.idxPO[pr] = new Map();
      idx.forEach((v, k) => HD.idxPO[pr].set(k, v));
    } else {
      HD.daerah[pr] = rows;
      HD.idxDaerah[pr] = idx;
    }
  });
  HD.sedia = true;
  HD.ralat = null;
  HD.kunci = kunciPertanyaan();
}
let hargaToken = 0;
// Dipanggil oleh renderAll(): jika data penapis semasa sudah ada, pasang serta-merta; jika belum, muat
// (keadaan memuat) dan lukis semula selepas selesai. Ralat dipaparkan dengan butang "Cuba semula".
function muatHarga() {
  const kunci = kunciPertanyaan();
  if (HD.sedia && HD.kunci === kunci) return;
  const qs = pertanyaanHarga();
  if (qs.every((x) => HARGADB.segerak('ringkasan', x[2]))) {
    terapHarga(qs);
    return;
  }
  HD.sedia = false;
  if (HD.ralat && HD.ralatKunci === kunci) return;
  HD.ralat = null;
  const token = ++hargaToken;
  Promise.all(qs.map((x) => HARGADB.ringkasan(x[2]))).then(
    () => {
      if (token !== hargaToken) return;
      terapHarga(pertanyaanHarga());
      renderAll();
    },
    (e) => {
      if (token !== hargaToken) return;
      HD.ralat = e && e.kind === 'file' ? 'file' : (e && e.message) || 'ralat';
      HD.ralatKunci = kunciPertanyaan();
      renderAll();
    },
  );
}
// Teks pengganti panel harga bila data belum sedia; null bila sedia.
function hargaBelumSedia() {
  if (HD.sedia) return null;
  if (HD.ralat === 'file' || HARGADB.keadaan === 'file')
    return 'Data harga sebenar memerlukan npm start (tidak tersedia pada file://).';
  if (HD.ralat) return 'Data harga tidak dapat dimuatkan.';
  return 'Memuat harga…';
}
function cubaSemulaHarga() {
  HARGADB.cubaSemula();
  HD.ralat = null;
  HD.ralatKunci = '';
  HD.sedia = false;
  HARGA_META = null;
  muatMetaHarga();
  renderAll();
}
function muatMetaHarga() {
  HARGADB.meta().then(
    (m) => {
      HARGA_META = m;
      SENARAI_BULAN = [...m.penapis.bulan].sort().reverse();
      if (state.bulan !== 'all' && !SENARAI_BULAN.includes(state.bulan)) state.bulan = 'all';
      if (state.minggu !== 'all' && !senaraiMinggu().includes(state.minggu)) state.minggu = 'all';
      if (state.komoditi !== 'all' && !m.penapis.komoditi.includes(state.komoditi)) {
        state.komoditi = 'all';
        state.varieti = 'all';
      }
      renderAll();
    },
    (e) => {
      if (!HD.ralat) HD.ralat = e && e.kind === 'file' ? 'file' : (e && e.message) || 'ralat';
      renderAll();
    },
  );
}
// Lencana tarikh data, lapuk dan minggu separa + blok keadaan (memuat / ralat + Cuba semula / file://).
function renderHargaKeadaan() {
  const lc = $('hargaLencana');
  if (lc) {
    const b = [];
    const t = HARGADB.terkini;
    if (t) {
      b.push(
        HARGADB.lapuk
          ? `<span class="harga-lencana lapuk" title="Data terkini lebih lapan hari lalu">⚠ Data lapuk · terkini ${esc(t)}</span>`
          : `<span class="harga-lencana">Data harga terkini: ${esc(t)}</span>`,
      );
    }
    if (HARGADB.mingguSeparaIso)
      b.push(
        `<span class="harga-lencana separa" title="Minggu ISO semasa belum lengkap dan tidak dinilai">Minggu semasa: separa (${esc(HARGADB.mingguSeparaIso)})</span>`,
      );
    lc.innerHTML = b.join('');
  }
  const k = $('hargaKeadaan');
  if (!k) return;
  const msg = hargaBelumSedia();
  const ralat = !HD.sedia && (HD.ralat || HARGADB.keadaan === 'file');
  k.hidden = !msg;
  k.className = 'harga-keadaan' + (ralat ? ' ralat' : '');
  if (!msg) {
    k.textContent = '';
    return;
  }
  k.innerHTML = `<span>${esc(msg)}</span>${ralat && HD.ralat !== 'file' && HARGADB.keadaan !== 'file' ? '<button type="button" class="button tiny ghost" id="hargaCubaSemula">Cuba semula</button>' : ''}`;
  const b = $('hargaCubaSemula');
  if (b) b.onclick = cubaSemulaHarga;
}
function toast(message) {
  const e = $('toast');
  e.textContent = message;
  e.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => e.classList.remove('show'), 3200);
}
function initControls() {
  kemasPenapis();
  muatMetaHarga();
  const config = [
    ['filterCommodity', 'komoditi'],
    ['filterBulan', 'bulan'],
    ['filterMinggu', 'minggu'],
    ['filterVarieti', 'varieti'],
    ['filterSeverity', 'indikator'],
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
      // Tukar bulan: minggu dipilih yang di luar bulan baharu diset semula
      if (key === 'bulan' && state.minggu !== 'all' && !senaraiMinggu().includes(state.minggu))
        state.minggu = 'all';
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
      zoomPenapis();
      renderAll();
    } else selectPO(id);
  });
  $('filterNegeri').addEventListener('change', (ev) => {
    state.negeri = ev.target.value;
    if (state.po && state.negeri !== 'all' && poById[state.po].negeri !== state.negeri)
      state.po = null;
    if (!state.po) state.daerah = null;
    state.chartRecord = null;
    zoomPenapis();
    renderAll();
  });
  $('resetFilters').onclick = () => {
    Object.assign(state, {
      po: null,
      daerah: null,
      negeri: 'all',
      bulan: BULAN_LALAI,
      minggu: 'all',
      komoditi: 'all',
      varieti: 'all',
      indikator: 'all',
      issues: true,
      days: 30,
      banjir: true,
      chartRecord: null,
      lowStage: 'Ladang',
      highStage: 'Borong',
    });
    [
      ['filterNegeri', 'all'],
      ['filterBulan', BULAN_LALAI],
      ['filterMinggu', 'all'],
      ['filterVarieti', 'all'],
      ['filterCommodity', 'all'],
      ['filterState', 'all'],
      ['filterSeverity', 'all'],
      ['filterIssue', 'true'],
      ['lowStage', 'Ladang'],
      ['highStage', 'Borong'],
    ].forEach(([id, v]) => ($(id).value = v));
    zoomTo(null);
    renderAll();
  };
  $('backMap').onclick = () => {
    tutupPopupTbh();
    state.po = null;
    state.negeri = 'all';
    state.daerah = null;
    state.chartRecord = null;
    zoomTo(null);
    renderAll();
  };
  $('downloadCsv').onclick = exportCSV;
  $('downloadLogistik').onclick = exportLogistikCSV;
  $('showLogs').onclick = openLogModal;
}
// Susun semula pilihan penapis mengikut keadaan semasa: Negeri -> PO, Komoditi -> Varieti, senarai Bulan.
function kemasPenapis() {
  if (state.po) state.negeri = poById[state.po].negeri;
  const isi = (id, pilihan, nilai, mati, tajuk) => {
    const s = $(id);
    const opsyen = ([v, t, mati]) =>
      `<option value="${esc(v)}"${mati ? ' disabled' : ''}>${esc(t)}</option>`;
    const html = pilihan
      .map((x) =>
        x.grup
          ? `<optgroup label="${esc(x.grup)}">${x.pilihan.map(opsyen).join('')}</optgroup>`
          : opsyen(x),
      )
      .join('');
    if (s.dataset.sig !== html) {
      s.innerHTML = html;
      s.dataset.sig = html;
    }
    s.value = nilai;
    s.disabled = !!mati;
    s.title = tajuk || '';
  };
  isi(
    'filterNegeri',
    [['all', 'Semua negeri'], ...SENARAI_NEGERI.map((n) => [n, n])],
    state.negeri,
  );
  isi(
    'filterState',
    [
      ['all', 'Semua PO'],
      ...DATA.po
        .filter((p) => state.negeri === 'all' || p.negeri === state.negeri)
        .map((p) => [p.id, p.name]),
      ...(window.FamaPOT && FamaPOT.tunjuk() && statePOTambahanSenarai().length
        ? [
            {
              grup: 'PO tambahan',
              pilihan: statePOTambahanSenarai().map((p) => [p.id, p.name]),
            },
          ]
        : []),
    ],
    state.po || 'all',
  );
  isi(
    'filterBulan',
    [['all', 'Semua bulan'], ...SENARAI_BULAN.map((k) => [k, bulanLabel(k)])],
    state.bulan,
    false,
    'Harga ialah purata minggu ISO lengkap terkini dalam bulan dipilih; "Semua bulan" = minggu lengkap terkini.',
  );
  isi(
    'filterMinggu',
    [['all', 'Terkini'], ...senaraiMinggu().map((m) => [m, mingguLabel(m)])],
    state.minggu,
    false,
    'Minggu ISO (Isnin–Ahad). Harga dan status ialah purata minggu dipilih; minggu disenaraikan ikut bulan dipilih.',
  );
  isi(
    'filterCommodity',
    [
      ['all', 'Semua komoditi'],
      ...(HARGA_META ? HARGA_META.penapis.komoditi : []).map((c) => [c, namaKom(c)]),
    ],
    state.komoditi,
  );
  const vars = state.komoditi === 'all' ? [] : varietiUntuk(state.komoditi);
  if (!vars.includes(state.varieti)) state.varieti = 'all';
  isi(
    'filterVarieti',
    vars.length
      ? [
          ['all', 'Semua varieti'],
          ...vars.map((v) => {
            const mati = HARGADB.tiadaData(v);
            return [v, namaKom(v) + (mati ? ' (tiada data)' : ''), mati];
          }),
        ]
      : [['all', state.komoditi === 'all' ? 'Pilih komoditi' : 'Tiada data varieti']],
    state.varieti,
    !vars.length,
    vars.length ? '' : 'Pilih komoditi untuk menapis varieti.',
  );
  const nota = [];
  if (HARGA_META && HARGA_META.tidakDitugaskan && HARGA_META.tidakDitugaskan.length)
    nota.push(
      `${HARGA_META.tidakDitugaskan.length} daerah (cth. ${HARGA_META.tidakDitugaskan
        .slice(0, 2)
        .map((d) => namaKom(d.daerah))
        .join(', ')}) tiada PO dan hanya dalam perbandingan negeri/daerah.`,
    );
  $('filterNota').textContent = nota.join(' ');
}
// Paparan peta mengikut penapis: PO > negeri (semua PO negeri itu) > seluruh Malaysia.
function zoomPenapis() {
  if (state.po) return zoomTo(poById[state.po]);
  if (state.negeri === 'all') return zoomTo(null);
  const ps = DATA.po.filter((p) => p.negeri === state.negeri);
  zoomTo({
    id: null,
    name: state.negeri,
    negeri: state.negeri,
    lon: ps[0].lon,
    lat: ps[0].lat,
    districts: ps.flatMap((p) => p.districts),
  });
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
          `<button type="button" class="po-option ${state.po === p.id ? 'active' : ''}" data-po="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.negeri)} · ${esc(labels[poStatus(p)])}"><i class="dot ${{ merah: 'red', kuning: 'yellow', hijau: 'green', kelabu: 'grey' }[poStatus(p)]}"></i><span>${esc(p.name.replace('PO ', '').replace('Simpang Renggam', 'S. Renggam'))}</span></button>`,
      )
      .join('');
  $('poDirectory').innerHTML =
    `<div class="po-areas"><div><div class="directory-title">Semenanjung Malaysia · 13 PO</div><div class="po-directory-grid">${mk('barat')}</div></div><div><div class="directory-title">Malaysia Timur · 2 PO</div><div class="po-directory-grid east">${mk('timur')}</div></div></div><div class="outlet-note" style="margin-top:9px">Pilih nama PO untuk zum lokasi dan lihat maklumat logistik. Warna status PO ialah harga sebenar (DB Harga).</div>`;
  $('poDirectory')
    .querySelectorAll('[data-po]')
    .forEach((b) => (b.onclick = () => selectPO(b.dataset.po)));
}
function renderKpis() {
  const pos = statePOs();
  const bil = (s) => pos.filter((p) => poStatus(p) === s).length;
  // Isu komoditi = kunci harga (peringkat x PO x komoditi x varieti) berstatus merah atau kuning dalam PO tertapis.
  const idPO = new Set(pos.map((p) => p.id));
  const isu = HD.sedia
    ? ['LADANG', 'RUNCIT'].reduce(
        (n, pr) =>
          n +
          (HD.po[pr] || []).filter(
            (r) =>
              idPO.has(r.po) && padanRekod(r) && (r.status === 'merah' || r.status === 'kuning'),
          ).length,
        0,
      )
    : null;
  const items = [
    [
      'PO Dalam Tapisan',
      pos.length,
      'Daripada 15 PO yang dipetakan' +
        (statePOTambahan().length
          ? `<span class="kpi-tambahan">+${statePOTambahan().length} PO tambahan</span>`
          : ''),
      'cyan',
    ],
    ['PO Amaran Harga', HD.sedia ? bil('merah') : null, 'Merah · 1 daerah merah atau lebih', 'red'],
    [
      'PO Berwaspada',
      HD.sedia ? bil('kuning') : null,
      'Kuning · 30% daerah kuning atau purata PO kuning',
      'yellow',
    ],
    [
      'PO Stabil',
      HD.sedia ? bil('hijau') : null,
      'Hijau · tiada daerah merah, data cukup',
      'green',
    ],
    [
      'PO Tiada Ambang',
      HD.sedia ? bil('kelabu') : null,
      'Kelabu · data daerah tidak cukup',
      'grey',
    ],
    ['Isu Komoditi', isu, 'Kunci harga merah atau kuning', 'red'],
  ];
  $('kpis').innerHTML = items
    .map(
      ([label, value, foot, cl]) =>
        `<article class="kpi ${cl}"><div class="kpi-label">${label}</div><div class="kpi-value">${value == null ? '…' : fmt(value)}</div><div class="kpi-foot">${foot}</div></article>`,
    )
    .join('');
  $('actionCount').textContent = actions.length;
}

function tutupPopupTbh() {
  if (window.FamaPOT) FamaPOT.tutup();
}
// Status harga dan sebab PO tambahan (rekod terburuk antara LADANG dan RUNCIT, ikut penapis komoditi/varieti).
function infoTbh(p) {
  let t = null;
  if (HD.sedia)
    ['LADANG', 'RUNCIT'].forEach((pr) =>
      ((HD.idxPO[pr] && HD.idxPO[pr].get(p.id)) || []).forEach((r) => {
        if (padanRekod(r) && (!t || weight[r.status] > weight[t.status])) t = r;
      }),
    );
  return { statusTeks: labels[poStatus(p)], sebab: t ? t.sebab : null };
}
function selectPO(id) {
  hidePOHover();
  tutupPopupTbh();
  state.po = id;
  state.daerah = null;
  state.chartRecord = null;
  state.negeri = poById[id].negeri;
  $('filterState').value = id;
  zoomTo(poById[id]);
  renderAll();
  // Peranti sentuh tiada hover: ketikan membuka pop-up (ditutup dengan mengetik di tempat lain)
  if (poById[id].tambahan && map && window.FamaPOT && FamaPOT.sentuh())
    FamaPOT.bukaPopup(map, poById[id], infoTbh(poById[id]));
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
/* ruang kanan untuk panel kawalan/lapisan cuaca supaya PO Sabah tidak tertutup */
const MAP_PADDING = { top: 20, bottom: 20, left: 80, right: 190 };
const MAP_BOUNDS = [
  [99.5, 0.8],
  [119.5, 7.5],
];
const FAMA_MAP_STYLE =
  (window.APP_CONFIG && window.APP_CONFIG.mapStyle) ||
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
window.FAMA_MAP_CONFIG = { style: FAMA_MAP_STYLE, bounds: MAP_BOUNDS };
/* ===== Peta asas (basemap) boleh tukar =====
   Lalai = gaya CARTO. Lain-lain ialah lapisan raster tunggal. Tukar gaya memuat semula semua lapisan tindihan
   (stesen banjir, amaran cuaca) melalui 'style.load'. Tile dimuat oleh pelayar seperti biasa (cache HTTP piawai). */
const PETA_ASAS_KUNCI = 'fama_peta_asas';
const PETA_ASAS = {
  lalai: { label: 'Lalai' },
  terrain: {
    label: 'Terrain',
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    maxzoom: 17,
    attribution: 'OpenTopoMap (CC-BY-SA), © OpenStreetMap',
  },
  jalan: {
    label: 'Jalan',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: '© OpenStreetMap contributors',
  },
  satelit: {
    label: 'Satelit',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    maxzoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
};
function bacaPetaAsas() {
  try {
    const k = localStorage.getItem(PETA_ASAS_KUNCI);
    return Object.hasOwn(PETA_ASAS, k) ? k : 'lalai';
  } catch {
    return 'lalai';
  }
}
let petaAsas = bacaPetaAsas();
let gayaDimuat = false;
function petaGaya(k) {
  const a = PETA_ASAS[k];
  if (!a || !a.tiles) return FAMA_MAP_STYLE;
  return {
    version: 8,
    sources: {
      'peta-asas': {
        type: 'raster',
        tiles: a.tiles,
        tileSize: 256,
        maxzoom: a.maxzoom,
        attribution: a.attribution,
      },
    },
    layers: [{ id: 'peta-asas', type: 'raster', source: 'peta-asas' }],
  };
}
function tetapPetaAsas(k) {
  if (!Object.hasOwn(PETA_ASAS, k)) return;
  try {
    localStorage.setItem(PETA_ASAS_KUNCI, k);
  } catch {
    /* storan tidak tersedia: pilihan tidak diingati */
  }
  if (k === petaAsas) return;
  petaAsas = k;
  if (map) {
    gayaDimuat = false;
    map.setStyle(petaGaya(k), { diff: false });
  }
  renderPetaKawalan();
}
// Hubungan ke Google Maps (hanya pautan; tiada API). Nilai koordinat dikodkan dengan encodeURIComponent.
const gmapsUrl = (lat, lng) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng);
function gmapsPautan(lat, lng) {
  const a = document.createElement('a');
  a.className = 'gmaps-link';
  a.href = gmapsUrl(lat, lng);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Buka di Google Maps';
  return a;
}
// Gerakkan peta supaya pop-up klik kekal dalam kotak peta (selepas dibuka / kandungan berubah)
function popupDalamPaparan(peta, popup) {
  const el = popup && popup.getElement();
  if (!el || !peta) return;
  if (peta.isMoving()) {
    // jangan batalkan flyTo/fitBounds yang sedang berjalan; semak selepas selesai
    peta.once('moveend', () => popup.isOpen() && popupDalamPaparan(peta, popup));
    return;
  }
  const m = peta.getContainer().getBoundingClientRect();
  const p = el.getBoundingClientRect();
  const S = 8;
  const dx =
    p.left < m.left + S ? p.left - m.left - S : p.right > m.right - S ? p.right - m.right + S : 0;
  const dy =
    p.top < m.top + S ? p.top - m.top - S : p.bottom > m.bottom - S ? p.bottom - m.bottom + S : 0;
  if (dx || dy) peta.panBy([dx, dy], { duration: 0 });
}
function initMap() {
  if (typeof maplibregl === 'undefined') {
    console.warn('MapLibre GL tidak dapat dimuatkan');
    return;
  }
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: petaGaya(petaAsas),
      bounds: MAP_BOUNDS,
      fitBoundsOptions: { padding: MAP_PADDING },
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
    map.on('style.load', () => {
      gayaDimuat = true;
      banjirLapisan.sedia = false;
      if (window.FamaCuaca && FamaCuaca.pasangSemula) FamaCuaca.pasangSemula();
      kemasLapisanBanjir();
    });
    if (window.FamaCuaca && FamaCuaca.sedia) FamaCuaca.sedia(map);
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
    /* sauh label PO: l/r/t/b + sesaran [x,y] px pilihan; elak bertindih pada paparan kebangsaan */
    const labelShift = {
      perlis: ['l'],
      kedah: ['l', 0, 6],
      penang: ['l'],
      perak: ['r'],
      selayang: ['l', 0, -8],
      selangor: ['l', 0, -2],
      negerisembilan: ['r', 0, -6],
      melaka: ['l', 0, 6],
      kelantan: ['r'],
      terengganu: ['r'],
      pahang: ['r'],
      johor: ['r', 0, 6],
      simpangrenggam: ['r', 0, -6],
      sabah: ['l'],
      sarawak: ['r'],
    };
    // PO tambahan (petak) ditambah dahulu supaya berada di bawah penanda PO utama
    if (window.FamaPOT) {
      FamaPOT.pasangZum(map);
      FamaPOT.tutup();
      statePOTambahan().forEach((p) => {
        const s = poStatus(p);
        const el = FamaPOT.penanda(p, s, labels[s], {
          kecil: !!state.po,
          dipilih: state.po === p.id,
        });
        FamaPOT.pasangHover(map, el, p, () => infoTbh(p));
        el.addEventListener('click', () => selectPO(p.id));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectPO(p.id);
          }
        });
        addMapMarker(el, p.lon, p.lat);
      });
    }
    visible.forEach((p) => {
      const s = poStatus(p);
      const el = mapEl(
        `po-marker status-${s}${state.po ? ' compact' : ''}${scenarioRingClass(p.id)}`,
        { tabindex: '0', role: 'button', 'aria-label': `${p.name}, ${labels[s]}` },
      );
      el.append(mapChild('span', 'halo'), mapChild('span', 'core'));
      if (!state.po) {
        const [sauh, lx = 0, ly = 0] = labelShift[p.id] || ['r'];
        const t = mapChild('span', `map-label po-label sauh-${sauh}`, p.label);
        t.style.setProperty('--lx', lx + 'px');
        t.style.setProperty('--ly', ly + 'px');
        el.append(t);
      }
      el.addEventListener('mouseenter', () => masukPOHover(p));
      el.addEventListener('mouseleave', keluarPOHover);
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
        const el = mapEl(
          `district-marker tanpa-kelip status-${s}${state.daerah === d[0] ? ' selected' : ''}`,
          {
            tabindex: '0',
            role: 'button',
            'aria-label': `${d[0]}, ${labels[s]}`,
            'data-daerah': d[0],
          },
        );
        if (s === 'merah') el.append(mapChild('span', 'district-halo'));
        el.append(mapChild('span', 'dot-core'));
        const t = mapChild('span', 'map-label', d[0]);
        t.style.left = `calc(50% + ${i % 2 ? 9 : -9}px)`;
        t.style.top = 'calc(50% - 10px)';
        t.style.transform = i % 2 ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
        el.append(t);
        el.addEventListener('mouseenter', () =>
          masukHover('daerah:' + p.id + ':' + d[0], () => showDaerahHover(p, d)),
        );
        el.addEventListener('mouseleave', keluarPOHover);
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
  mapCaptionAsas = state.po
    ? `${poById[state.po].name} · ${poById[state.po].districts.length} daerah · status tertinggi: ${labels[poStatus(poById[state.po])]}`
    : '15 PO berpandukan infografik · koordinat bandar anggaran · warna status daripada harga sebenar (DB Harga)' +
      (statePOTambahan().length
        ? ` · +${statePOTambahan().length} PO tambahan (petak, lokasi anggaran titik tengah daerah)`
        : '');
  renderMapCaption();
  if (window.FamaDaerah) FamaDaerah.kemasStatus();
  $('mapDetail').innerHTML = state.po
    ? `<div class="detail-copy"><strong>${esc(poById[state.po].name)} · ${statusHTML(poStatus(poById[state.po]))}</strong><div class="note">${esc(poById[state.po].negeri)} · Kedudukan titik ialah anggaran bandar, bukan koordinat tapak sebenar. ${poById[state.po].tambahan ? '<b>PO tambahan: tiada data logistik.</b> ' + esc(poById[state.po].fisNama) : poById[state.po].logistik.shared ? '<b>Data logistik berkongsi angka dengan PO pasangan.</b>' : ''}</div>${amaranPoNota(poById[state.po]).replace('outlet-note', 'note')}<div class="note">Daerah seliaan mengikut pemetaan FIS 2.1 (disahkan (FIS 2.1), Power BI); warna daerah ialah status harga sebenar. Klik daerah untuk mengemas kini panel harga.</div><div class="district-pills"><button class="pill ${!state.daerah ? 'active' : ''}" data-district="">Semua daerah</button>${poById[state.po].districts.map((d) => `<button class="pill ${state.daerah === d[0] ? 'active' : ''}" data-district="${esc(d[0])}">${esc(d[0])} · ${labels[poStatus(poById[state.po], d[0])]}</button>`).join('')}</div></div><button class="button tiny ghost" id="clearSelection">Reset PO</button>`
    : `<div class="detail-copy"><strong>Prinsip Amaran Minimum</strong><div class="note">Warna penanda PO ialah status terburuk antara harga ladang (Pengeluar, turun) dan harga runcit (Pengguna, naik). Merah = Amaran harga (tidak berkelip), kelabu = tiada ambang. Klik titik atau nama PO untuk melihat logistik sumber dan perincian harga.</div></div><span class="tag-status"><i class="dot red"></i>Merah = amaran harga</span>`;
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
  } else map.fitBounds(MAP_BOUNDS, { padding: MAP_PADDING, duration: 700 });
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
    );
  grid.innerHTML = tiles
    .map((w) => {
      const tip = w.met
        ? `Pagi: ${w.met.pagiMs || '-'} · Petang: ${w.met.tengahHariMs || '-'} · Malam: ${w.met.malamMs || '-'}`
        : '';
      return `<article class="weather-card" title="${esc(tip)}"><div class="weather-name"><span class="weather-ico" aria-hidden="true">${esc(w.ikon)}</span><span class="weather-nm">${esc(w.negeri)}</span><span class="weather-risk r-${esc(w.risiko.toLowerCase())}" title="Anggaran sistem, bukan amaran rasmi">${esc(w.risiko)}</span></div><div class="weather-sub"><span class="weather-cond">${esc(w.keadaan)}</span> · ♧ ${esc(w.suhu)} · ≋ ${w.angin == null ? '-' : esc(Math.round(w.angin))} km/j · 💧 ${w.lembap == null ? '-' : esc(Math.round(w.lembap))}%</div></article>`;
    })
    .join('');
}
const AMARAN_MET = 'MET Malaysia';
const AMARAN_JPS = 'JPS Malaysia (Public Info Banjir)';
const AMARAN_DG = 'MET Malaysia (data.gov.my)';
const AMARAN_HAD = 7;
const AMARAN_TAHAP_NILAI = { BAHAYA: 4, BURUK: 3, WASPADA: 2, UMUM: 1 };
const amaranTahap = (a) => {
  const cari = (t) => {
    const u = String(t || '').toUpperCase();
    if (/\bBERBAHAYA\b|\bBAHAYA\b|\bDANGER\b|KATEGORI KETIGA/.test(u)) return 'BAHAYA';
    if (/\bBURUK\b|\bWARNING\b|KATEGORI KEDUA/.test(u)) return 'BURUK';
    if (/\bWASPADA\b|\bALERT\b|KATEGORI PERTAMA/.test(u)) return 'WASPADA';
    return '';
  };
  return cari(a.tajuk) || cari(String(a.teks || '').slice(0, 160)) || 'UMUM';
};
const amaranDaerah = (a) => {
  const m =
    (a.sumber === AMARAN_MET || a.sumber === AMARAN_DG) && /\(([^()]{3,70})\)/.exec(a.teks || '');
  return m ? m[1].trim() : '';
};
// Gabung amaran rasmi MET + JPS, terbaharu dahulu (ikut masa dikeluarkan), maksimum 7.
function senaraiAmaranRasmi(kini = Date.now()) {
  const senarai = [];
  if (cuacaState.status === 'ready')
    (cuacaState.data.amaran || []).forEach((a) =>
      senarai.push({
        sumber: AMARAN_MET,
        tajuk: a.tajuk,
        teks: a.teks,
        negeri: a.negeri || [],
        dikeluarkan: a.dikeluarkan,
        sahHingga: a.sah_hingga,
        bendera: a.aktif !== false,
      }),
    );
  // Sumber tambahan MET melalui data.gov.my; amaran yang sama dengan api.met.gov.my ditanda `pendua` oleh pelayan.
  if (amaranDGState.status === 'ready')
    (amaranDGState.data.amaran || [])
      .filter((a) => !a.pendua)
      .forEach((a) =>
        senarai.push({
          sumber: AMARAN_DG,
          tajuk: a.tajuk,
          teks: a.teks,
          negeri: a.negeri || [],
          dikeluarkan: a.dikeluarkan,
          sahHingga: a.sah_hingga,
          bendera: true,
        }),
      );
  if (banjirState.status === 'ready') {
    const d = banjirState.data;
    (d.amaranSejarah || d.amaran || []).forEach((a) =>
      senarai.push({
        sumber: a.sumber || AMARAN_JPS,
        tajuk: 'AMARAN BANJIR',
        teks: a.mesej,
        negeri: a.negeri || [],
        dikeluarkan: a.dikeluarkan || a.dilihat || null,
        sahHingga: a.anggaranTamat,
        bendera: a.aktif !== false,
      }),
    );
  }
  const masa = (a) => Date.parse(a.dikeluarkan) || 0;
  const lengkap = senarai
    .sort((x, y) => masa(y) - masa(x))
    .map((a) => {
      const t = Date.parse(a.sahHingga);
      const tahap = amaranTahap(a);
      return {
        ...a,
        tahap,
        nilai: AMARAN_TAHAP_NILAI[tahap],
        aktif: Number.isNaN(t) ? !!a.bendera : t >= kini,
      };
    });
  // 7 terkini + mana-mana amaran aktif di luar 7 itu (amaran aktif tidak pernah disembunyikan)
  const dipilih = lengkap.filter((a, i) => i < AMARAN_HAD || a.aktif);
  return [
    ...dipilih.filter((a) => a.aktif).sort((x, y) => y.nilai - x.nilai || masa(y) - masa(x)),
    ...dipilih.filter((a) => !a.aktif).sort((x, y) => masa(y) - masa(x)),
  ];
}
// Senarai terkini yang dipaparkan panel Rasmi: satu-satunya sumber untuk lapisan peta Amaran Rasmi.
let amaranRasmiTerkini = { senarai: [], kini: Date.now() };
window.famaAmaranRasmi = () => amaranRasmiTerkini;
function terbitAmaranRasmi(senarai, kini) {
  amaranRasmiTerkini = { senarai, kini };
  renderPetaKawalan();
  document.dispatchEvent(new CustomEvent('fama:amaran-rasmi', { detail: amaranRasmiTerkini }));
}
// Teks wilayah dalam panel dan pop-up peta (sama)
const amaranLokTeks = (a) => {
  const lok = a.negeri.length
    ? a.negeri.length > 4
      ? a.negeri.length + ' negeri'
      : a.negeri.join(', ')
    : '';
  const daerah = amaranDaerah(a);
  return { lok, daerah, teks: lok + (lok && daerah ? ' · ' : '') + daerah };
};
const amaranItemHTML = (a, i) => {
  const { lok, daerah } = amaranLokTeks(a);
  const tahap = a.tahap;
  const sah = a.sahHingga ? ' · Sah hingga ' + cuacaMasa(a.sahHingga) : '';
  const panjang = String(a.teks || '').length > 110;
  return `<div class="alert-item${a.aktif ? '' : ' tamat'}" data-amaran="${i}"><div class="alert-top"><b>${esc(a.tajuk)}</b><span class="alert-tahap t-${esc(tahap.toLowerCase())}">${esc(tahap)}</span><span class="alert-chip ${a.aktif ? 'aktif' : 'tamat'}">${a.aktif ? 'Aktif' : 'Tamat'}</span></div>${lok || daerah ? `<div class="alert-lok">${esc(lok)}${lok && daerah ? ' · ' : ''}${esc(daerah)}</div>` : ''}<p class="alert-teks">${esc(a.teks)}</p>${panjang ? '<button type="button" class="alert-more" data-act="amaran-lagi" aria-expanded="false">Lihat lagi</button>' : ''}<p class="alert-meta">${esc(a.sumber)} · Dikeluarkan ${esc(a.dikeluarkan ? cuacaMasa(a.dikeluarkan) : '-')}${esc(sah)}</p></div>`;
};
const renderMetAlerts = () => {
  const body = $('metAlertBody');
  const note = $('metAlertNote');
  const tag = $('metAlertTag');
  const cs = cuacaState;
  const bs = banjirState;
  const sumber = 'Sumber: MET Malaysia · JPS Malaysia';
  if (cs.status === 'memuat' && bs.status === 'memuat') {
    body.textContent = 'Memuatkan amaran…';
    note.textContent = sumber;
    tag.textContent = '';
    return;
  }
  if (cs.status === 'file' && bs.status === 'file') {
    body.textContent = 'Amaran rasmi sebenar memerlukan pelayan (npm start)';
    note.textContent = sumber;
    tag.textContent = '';
    return;
  }
  const mesej = [];
  if (cs.status === 'memuat') mesej.push('Memuatkan amaran MET…');
  else if (cs.status === 'file') mesej.push('Amaran MET memerlukan pelayan (npm start)');
  else if (cs.status === 'error')
    mesej.push('Amaran rasmi tidak dapat dimuatkan.' + cuacaRetryBtn());
  else {
    const st =
      cs.data.sumber && cs.data.sumber.metAmaran ? cs.data.sumber.metAmaran.status : 'gagal';
    if (st === 'tiada_dataset') mesej.push('Amaran rasmi belum tersedia melalui API MET');
    else if (st === 'gagal') mesej.push('Amaran rasmi tidak dapat dimuatkan.' + cuacaRetryBtn());
  }
  if (bs.status === 'memuat') mesej.push('Memuatkan amaran JPS…');
  else if (bs.status === 'file') mesej.push('Amaran JPS memerlukan pelayan (npm start)');
  else if (bs.status === 'error')
    mesej.push('Amaran JPS tidak dapat dimuatkan.' + banjirRetryBtn());
  else {
    const st =
      bs.data.sumber && bs.data.sumber.amaranJps ? bs.data.sumber.amaranJps.status : 'gagal';
    if (st === 'gagal') mesej.push('Amaran JPS tidak dapat dikemas kini (data lama dikekalkan).');
  }
  const diambil = [
    cs.status === 'ready' ? cs.data.amaranDiambil || cs.data.fetchedAt : null,
    bs.status === 'ready' ? bs.data.amaranDiambil || bs.data.fetchedAt : null,
  ].filter(Boolean);
  const masa = cuacaMasa(diambil.sort().pop());
  note.textContent = `${sumber} · Dikemas kini ${masa}`;
  const kini = Date.now();
  const senarai = senaraiAmaranRasmi(kini);
  const aktif = senarai.filter((a) => a.aktif).length;
  tag.textContent = senarai.length ? `${aktif} aktif · ${senarai.length} terkini` : '';
  const status = mesej.map((m) => `<div class="alert-status">${m}</div>`).join('');
  if (!senarai.length) {
    body.innerHTML =
      status ||
      `<div class="alert-item"><b>Tiada amaran rasmi dalam 7 hari lepas</b><p>Sumber: MET Malaysia · JPS Malaysia · ${esc(masa)}</p></div>`;
    terbitAmaranRasmi(senarai, kini);
    return;
  }
  body.innerHTML = status + senarai.map(amaranItemHTML).join('');
  terbitAmaranRasmi(senarai, kini);
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
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act="amaran-lagi"]');
  if (!b) return;
  const item = b.closest('.alert-item');
  const buka = item.classList.toggle('open');
  b.setAttribute('aria-expanded', buka ? 'true' : 'false');
  b.textContent = buka ? 'Kurangkan' : 'Lihat lagi';
});

/* ===== Kualiti udara sebenar (JAS MyEQMS) =====
   Dimuat daripada /api/kualiti-udara (same-origin). IPU stesen terdekat bagi setiap PO. */
const IPU = {
  promise: null,
  load(force) {
    if (force) IPU.promise = null;
    if (!IPU.promise) {
      IPU.promise = (async () => {
        if (location.protocol === 'file:') {
          const e = new Error('Memerlukan pelayan');
          e.kind = 'file';
          throw e;
        }
        let res;
        for (let cuba = 0; ; cuba++) {
          res = await fetch('/api/kualiti-udara', { cache: 'no-store' });
          const bd = res.status === 503 && cuba < 6 ? await res.json().catch(() => null) : null;
          if (bd && bd.sedangDikemaskini) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          break;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (!j || !Array.isArray(j.po)) throw new Error('Format data kualiti udara tidak sah');
        return j;
      })();
      IPU.promise.catch(() => {
        IPU.promise = null;
      });
    }
    return IPU.promise;
  },
  staleHours: 3,
};
let ipuState = { status: 'memuat', data: null };
const IPU_JALUR = [
  ['baik', 'Baik', '0–50'],
  ['sederhana', 'Sederhana', '51–100'],
  ['tidak_sihat', 'Tidak Sihat', '101–200'],
  ['sangat_tidak_sihat', 'Sangat Tidak Sihat', '201–300'],
  ['berbahaya', 'Berbahaya', '301+'],
];
const ipuRetryBtn = () =>
  ' <button type="button" class="button tiny" data-act="ipu-retry">Cuba semula</button>';
const ipuLapuk = (d) => {
  const t = Date.parse(d && d.fetchedAt);
  return Number.isNaN(t) || (Date.now() - t) / 36e5 > IPU.staleHours;
};
const ipuJam = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '-';
  const p = Object.fromEntries(cuacaFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute}`;
};
const ipuBandKelas = (b) => (IPU_JALUR.some((j) => j[0] === b) ? b : 'tiada_data');
function renderIPU() {
  const list = $('ipuList');
  const banner = $('ipuStatus');
  const note = $('ipuNote');
  const legend = $('ipuLegend');
  if (!list) return;
  legend.innerHTML = IPU_JALUR.map(
    (j) =>
      `<span class="ipu-leg"><i class="ipu-dot ipu-${j[0]}" aria-hidden="true"></i>${esc(j[1])} <small>${esc(j[2])}</small></span>`,
  ).join('');
  const s = ipuState;
  let msg = '';
  let kind = '';
  if (s.status === 'memuat') note.textContent = 'Memuatkan data kualiti udara…';
  else if (s.status === 'file') {
    note.textContent = 'Data kualiti udara sebenar tidak tersedia';
    msg = 'Data kualiti udara sebenar memerlukan pelayan (npm start)';
  } else if (s.status === 'error') {
    note.textContent = 'Data kualiti udara tidak tersedia';
    msg = 'Data kualiti udara tidak dapat dimuatkan.' + ipuRetryBtn();
    kind = 'err';
  }
  if (s.status !== 'ready') {
    list.innerHTML = '';
    banner.hidden = !msg;
    banner.className = 'weather-banner' + (kind ? ' ' + kind : '');
    banner.innerHTML = msg;
    return;
  }
  const d = s.data;
  note.textContent = 'Dikemas kini ' + cuacaMasa(d.fetchedAt);
  const sumberGagal = ['stesenPeta', 'jam']
    .filter((k) => d.sumber && d.sumber[k] && d.sumber[k].status === 'gagal')
    .map((k) => (k === 'jam' ? 'bacaan jam' : 'senarai stesen'));
  if (ipuLapuk(d)) {
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
  const baris = d.po
    .slice()
    .sort(
      (a, b) =>
        (b.api == null ? -1 : b.api) - (a.api == null ? -1 : a.api) ||
        String(a.nama).localeCompare(String(b.nama)),
    );
  list.innerHTML = baris
    .map((p) => {
      const kelas = ipuBandKelas(p.band);
      const label = p.band && kelas !== 'tiada_data' ? p.bandLabel : 'Tiada data';
      const stesen = p.stesenNama
        ? `${esc(p.stesenNama)} · ${p.jarakKm == null ? '-' : esc(Number(p.jarakKm).toFixed(1))} km${p.jauh ? ' <span class="ipu-tanda">jauh</span>' : ''}`
        : 'Tiada stesen sah berhampiran';
      const masa = p.masaBacaan
        ? `${esc(ipuJam(p.masaBacaan))} MYT${p.lapuk ? ' <span class="ipu-tanda lapuk">lapuk</span>' : ''}`
        : '-';
      return `<div class="ipu-row" data-po="${esc(p.poId)}" data-band="${esc(kelas)}"><div class="ipu-main"><span class="ipu-nama" title="${esc(p.nama)}">${esc(p.nama)}</span><span class="ipu-stesen" title="${esc(p.stesenNama || '')}">${stesen}</span></div><div class="ipu-val"><b class="ipu-api">${p.api == null ? '-' : esc(p.api)}</b><span class="ipu-chip ipu-${esc(kelas)}"><i class="ipu-dot" aria-hidden="true"></i>${esc(label)}</span><span class="ipu-masa">${masa}</span></div></div>`;
    })
    .join('');
}
// Kad IPU dibuang daripada UI (diganti kad Stesen Banjir JPS). Tukar kepada true dan pulihkan
// markup #ipuPanel dalam index.html untuk memaparkannya semula. API /api/kualiti-udara kekal.
const IV_SHOW_IPU = false;
const initIPU = (force) => {
  if (!IV_SHOW_IPU) return Promise.resolve();
  ipuState = { status: 'memuat', data: null };
  renderIPU();
  return IPU.load(force).then(
    (d) => {
      ipuState = { status: 'ready', data: d };
      renderIPU();
    },
    (e) => {
      ipuState = { status: e && e.kind === 'file' ? 'file' : 'error', data: null };
      renderIPU();
    },
  );
};
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-act="ipu-retry"]')) return;
  initIPU(true);
});
/* ===== Banjir sebenar (JPS Malaysia + JPS Selangor) =====
   Dimuat daripada /api/banjir (same-origin). Digunakan oleh kad amaran, senario AMS, lapisan peta dan Intervensi. */
const BANJIR = {
  promise: null,
  load(force) {
    if (force || !this.promise) {
      this.promise = (async () => {
        if (location.protocol === 'file:') {
          const e = new Error('file');
          e.kind = 'file';
          throw e;
        }
        let res;
        for (let cuba = 0; ; cuba++) {
          res = await fetch('/api/banjir', { cache: 'no-store' });
          const bd =
            res.status === 503 && cuba < 6
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
        if (!j || !Array.isArray(j.stesen) || !Array.isArray(j.po))
          throw new Error('Format data banjir tidak sah');
        return j;
      })();
    }
    return this.promise;
  },
  staleHours: 2,
};
let banjirState = { status: 'memuat', data: null };
const banjirLapuk = (d) => {
  const t = Date.parse(d && d.fetchedAt);
  return Number.isNaN(t) || (Date.now() - t) / 36e5 > BANJIR.staleHours;
};
const banjirRetryBtn = () => {
  return ' <button type="button" class="button tiny" data-act="banjir-retry">Cuba semula</button>';
};
const aplikasiBanjir = (p) => {
  return p.then(
    (d) => {
      banjirState = { status: 'ready', data: d };
    },
    (e) => {
      banjirState = { status: e && e.kind === 'file' ? 'file' : 'error', data: null };
    },
  );
};
const initBanjir = (force) => {
  banjirState = { status: 'memuat', data: null };
  renderMetAlerts();
  renderFloodLayer();
  renderFloodCard();
  return aplikasiBanjir(BANJIR.load(force)).then(() => {
    renderMetAlerts();
    renderFloodLayer();
    renderFloodCard();
  });
};
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-act="banjir-retry"]')) return;
  initBanjir(true).then(() => {
    if (typeof initScenarios === 'function') initScenarios();
  });
});

/* --- Lapisan peta stesen JPS (GeoJSON symbol dengan ikon ombak; bukan penanda DOM kerana ratusan titik) ---
   Ikon banjir (bulatan + tiga ombak) mengikut warna: merah = Bahaya/Amaran, kuning = Waspada, hijau = Normal. */
const BANJIR_IKON = { merah: '#ef4444', kuning: '#f5b400', hijau: '#22c55e' };
const BANJIR_IKON_STATUS = { Bahaya: 'merah', Amaran: 'merah', Waspada: 'kuning', Normal: 'hijau' };
// Lukis ikon pada kanvas (64 px, pixelRatio 2 = 32 px pada peta). Pulangan ImageData untuk map.addImage.
function lukisIkonBanjir(warna) {
  const S = 64,
    c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
  g.fillStyle = warna;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#0b1f3f';
  g.stroke();
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  for (const y of [22, 32, 42]) {
    g.beginPath();
    g.moveTo(16, y);
    g.bezierCurveTo(21, y - 5, 26, y - 5, 32, y);
    g.bezierCurveTo(38, y + 5, 43, y + 5, 48, y);
    g.stroke();
  }
  return g.getImageData(0, 0, S, S);
}
function pasangIkonBanjir() {
  Object.entries(BANJIR_IKON).forEach(([k, w]) => {
    const id = 'banjir-' + k;
    if (!map.hasImage(id)) map.addImage(id, lukisIkonBanjir(w), { pixelRatio: 2 });
  });
}
let banjirLapisan = { tunjuk: true, semua: false, sedia: false, popup: null };
const banjirPenapis = () => (banjirLapisan.semua ? null : ['!=', ['get', 'statusRasmi'], 'Normal']);
function banjirFitur() {
  const d = banjirState.status === 'ready' ? banjirState.data : null;
  if (!d || banjirLapuk(d)) return [];
  return d.stesen
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: stesenProps(s),
    }));
}
const stesenProps = (s) => ({
  id: s.id,
  nama: s.nama,
  sungai: s.sungai || '',
  negeri: s.negeri || '',
  statusRasmi: s.statusRasmi,
  parasAir: s.parasAir,
  trend: s.trend || '',
  masaBacaan: s.masaBacaan || '',
  sumber: s.sumber || '',
  lat: s.lat,
  lon: s.lon,
});
function stesenPopupNode(p, lngLat) {
  const n = document.createElement('div');
  n.className = 'banjir-popup';
  const baris = (k, v) => {
    const r = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = k + ': ';
    r.append(b, document.createTextNode(v));
    n.append(r);
  };
  const t = document.createElement('div');
  t.className = 'banjir-popup-tajuk';
  t.textContent = p.nama;
  n.append(t);
  baris('Sungai', p.sungai || '-');
  baris('Status', p.statusRasmi);
  baris('Paras air', p.parasAir == null ? '-' : Number(p.parasAir).toFixed(2) + ' m');
  baris('Trend', p.trend || '-');
  baris('Bacaan', p.masaBacaan ? cuacaMasa(p.masaBacaan) : '-');
  const s = document.createElement('div');
  s.className = 'banjir-popup-sumber';
  s.textContent = 'Sumber: ' + (p.sumber || 'JPS Malaysia');
  n.append(s);
  // Koordinat stesen sebenar diutamakan; jika tiada, guna titik pop-up.
  const ll = Array.isArray(lngLat) ? lngLat : lngLat ? [lngLat.lng, lngLat.lat] : null;
  const lat = Number.isFinite(Number(p.lat)) && p.lat !== null ? Number(p.lat) : ll && ll[1];
  const lon = Number.isFinite(Number(p.lon)) && p.lon !== null ? Number(p.lon) : ll && ll[0];
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const g = document.createElement('div');
    g.className = 'gmaps-baris';
    g.append(gmapsPautan(lat, lon));
    n.append(g);
  }
  return n;
}
function bukaPopupStesen(p, lngLat) {
  if (!map || typeof maplibregl === 'undefined') return null;
  if (banjirLapisan.popup) banjirLapisan.popup.remove();
  banjirLapisan.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
    .setLngLat(lngLat)
    .setDOMContent(stesenPopupNode(p, lngLat))
    .addTo(map);
  return banjirLapisan.popup;
}
function pasangLapisanBanjir() {
  if (!map || banjirLapisan.sedia) return;
  try {
    map.addSource('banjir-stesen', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: banjirFitur() },
    });
    pasangIkonBanjir();
    const ikon = ['match', ['get', 'statusRasmi']];
    const susun = ['match', ['get', 'statusRasmi']];
    Object.entries(BANJIR_IKON_STATUS).forEach(([k, v]) => {
      ikon.push(k, 'banjir-' + v);
      susun.push(k, { Bahaya: 0, Amaran: 1, Waspada: 2, Normal: 3 }[k]);
    });
    ikon.push('banjir-hijau');
    susun.push(3);
    const lapisan = {
      id: 'banjir-stesen',
      type: 'symbol',
      source: 'banjir-stesen',
      layout: {
        visibility: banjirLapisan.tunjuk ? 'visible' : 'none',
        'icon-image': ikon,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 0.7, 11, 0.95],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        // Kunci lebih besar dilukis di atas: Bahaya/Amaran (merah) paling atas, Normal paling bawah
        'symbol-sort-key': ['-', 3, susun],
      },
    };
    const f = banjirPenapis();
    if (f) lapisan.filter = f;
    map.addLayer(lapisan);
    if (!banjirLapisan.pengendali) {
      // Pendengar berlapis kekal selepas tukar gaya peta; daftar sekali sahaja.
      banjirLapisan.pengendali = true;
      map.on('click', 'banjir-stesen', (e) => {
        const ft = e.features && e.features[0];
        if (ft) bukaPopupStesen(ft.properties, e.lngLat);
      });
      map.on('mouseenter', 'banjir-stesen', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'banjir-stesen', () => (map.getCanvas().style.cursor = ''));
    }
    banjirLapisan.sedia = true;
  } catch (err) {
    console.warn('Lapisan banjir tidak dapat dipasang', err);
  }
}
function renderFloodLayer() {
  const tog = $('floodToggle');
  const semua = $('floodAllToggle');
  if (tog) tog.setAttribute('aria-pressed', banjirLapisan.tunjuk ? 'true' : 'false');
  if (semua) {
    semua.setAttribute('aria-pressed', banjirLapisan.semua ? 'true' : 'false');
    semua.disabled = !banjirLapisan.tunjuk;
  }
  if (map) {
    if (gayaDimuat) kemasLapisanBanjir();
    else map.once('style.load', kemasLapisanBanjir);
  }
  renderMapCaption();
}
function kemasLapisanBanjir() {
  if (!map) return;
  pasangLapisanBanjir();
  if (!banjirLapisan.sedia) return;
  map.getSource('banjir-stesen').setData({ type: 'FeatureCollection', features: banjirFitur() });
  map.setFilter('banjir-stesen', banjirPenapis());
  map.setLayoutProperty('banjir-stesen', 'visibility', banjirLapisan.tunjuk ? 'visible' : 'none');
}
function initFloodLayer() {
  const tog = $('floodToggle');
  const semua = $('floodAllToggle');
  if (tog)
    tog.onclick = () => {
      banjirLapisan.tunjuk = !banjirLapisan.tunjuk;
      renderFloodLayer();
    };
  if (semua)
    semua.onclick = () => {
      banjirLapisan.semua = !banjirLapisan.semua;
      renderFloodLayer();
    };
  renderFloodLayer();
}
const banjirCatatanPeta = () => {
  if (banjirState.status === 'error') return ' · Stesen banjir JPS tidak dapat dimuatkan';
  if (banjirState.status === 'ready' && banjirLapuk(banjirState.data))
    return ' · Data banjir JPS lapuk, stesen tidak dipaparkan';
  return '';
};
/* --- Kad Stesen Banjir JPS (Pemantauan): stesen bukan Normal mengikut tahap amaran --- */
const BJ_TAHAP = ['Bahaya', 'Amaran', 'Waspada'];
const BJ_NILAI = { Bahaya: 3, Amaran: 2, Waspada: 1 };
const BJ_TREND = {
  Naik: ['▲', 'naik', 1],
  Surut: ['▼', 'turun', 0],
  Tetap: ['▬', 'tiada perubahan', 0],
};
const banjirRingkas = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '-';
  const p = Object.fromEntries(cuacaFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};
const stesenSah = (d) =>
  d.stesen.filter(
    (s) => s.statusRasmi && s.parasAir != null && Number.isFinite(s.lat) && Number.isFinite(s.lon),
  );
function senaraiStesenBanjir(d) {
  return stesenSah(d)
    .filter((s) => BJ_NILAI[s.statusRasmi])
    .sort(
      (a, b) =>
        BJ_NILAI[b.statusRasmi] - BJ_NILAI[a.statusRasmi] ||
        (BJ_TREND[b.trend] ? BJ_TREND[b.trend][2] : 0) -
          (BJ_TREND[a.trend] ? BJ_TREND[a.trend][2] : 0) ||
        (Date.parse(b.masaBacaan) || 0) - (Date.parse(a.masaBacaan) || 0) ||
        String(a.nama).localeCompare(String(b.nama)),
    );
}
const stesenBarisHTML = (s) => {
  const tr = BJ_TREND[s.trend];
  const lok = [s.sungai, [s.daerah, s.negeri].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');
  const paras = Number(s.parasAir).toFixed(2) + ' m';
  const trend = tr
    ? `<span class="bj-trend" title="Trend: ${esc(tr[1])}"><span aria-hidden="true">${tr[0]}</span> ${esc(tr[1])}</span>`
    : '<span class="bj-trend">tiada data trend</span>';
  return `<button type="button" class="bj-row" data-act="stesen-banjir" data-stesen="${esc(s.id)}" data-tahap="${esc(s.statusRasmi)}" aria-label="${esc(s.nama + ', ' + s.statusRasmi + ', ' + paras + '. Papar pada peta')}"><span class="bj-row-top"><b class="bj-nama" title="${esc(s.nama)}">${esc(s.nama)}</b><span class="bj-chip bj-${esc(s.statusRasmi.toLowerCase())}">${esc(s.statusRasmi)}</span></span><span class="bj-lok" title="${esc(lok)}">${esc(lok || '-')}</span><span class="bj-row-bot"><b class="bj-paras">${esc(paras)}</b>${trend}<span class="bj-masa">${esc(banjirRingkas(s.masaBacaan))} MYT</span></span></button>`;
};
// Panel lama (#floodPanel, hidden) dan paparan Risiko Banjir dalam EWS (AI) berkongsi satu fungsi render.
const FLOOD_TARGETS = [
  {
    list: 'floodList',
    banner: 'floodStatus',
    note: 'floodNote',
    ring: 'floodSummary',
    poNote: 'floodPoNote',
    srcGagal: 'floodSrcGagal',
  },
  {
    list: 'ewsFloodList',
    banner: 'ewsFloodStatus',
    note: 'ewsFloodNote',
    ring: 'ewsFloodSummary',
    poNote: 'ewsFloodPoNote',
    srcGagal: 'ewsFloodSrcGagal',
  },
];
function renderFloodCard() {
  FLOOD_TARGETS.forEach(renderFloodInto);
}
function renderFloodInto(ids) {
  const list = $(ids.list);
  if (!list) return;
  const banner = $(ids.banner);
  const note = $(ids.note);
  const ring = $(ids.ring);
  const poNote = $(ids.poNote);
  const bs = banjirState;
  let msg = '';
  let kind = '';
  const kosong = () => {
    list.innerHTML = '';
    ring.innerHTML = '';
    poNote.hidden = true;
    banner.hidden = !msg;
    banner.className = 'weather-banner' + (kind ? ' ' + kind : '');
    banner.innerHTML = msg;
  };
  if (bs.status === 'memuat') {
    note.textContent = 'Memuatkan data banjir JPS…';
    return kosong();
  }
  if (bs.status === 'file') {
    note.textContent = 'Data banjir sebenar tidak tersedia';
    msg = 'Data banjir sebenar memerlukan pelayan (npm start)';
    return kosong();
  }
  if (bs.status === 'error') {
    note.textContent = 'Data banjir tidak tersedia';
    msg = 'Data banjir tidak dapat dimuatkan.' + banjirRetryBtn();
    kind = 'err';
    return kosong();
  }
  const d = bs.data;
  note.textContent = 'Dikemas kini ' + cuacaMasa(d.fetchedAt);
  if (banjirLapuk(d)) {
    msg =
      'Data lapuk: kemas kini terakhir ' + cuacaMasa(d.fetchedAt) + '. Stesen tidak dipaparkan.';
    kind = 'err';
    return kosong();
  }
  const gagal = ['jpsNasional', 'jpsSelangor']
    .filter((k) => d.sumber && d.sumber[k] && d.sumber[k].status === 'gagal')
    .map((k) => (k === 'jpsNasional' ? 'JPS Malaysia' : 'JPS Selangor'));
  const sg = $(ids.srcGagal);
  if (sg) sg.textContent = gagal.map((g) => ' · ' + g + ': data terakhir').join('');
  banner.hidden = true;
  banner.textContent = '';
  const sah = stesenSah(d);
  const kira = (t) => sah.filter((s) => s.statusRasmi === t).length;
  ring.innerHTML = [...BJ_TAHAP, 'Normal']
    .map(
      (t) =>
        `<span class="bj-chip bj-${t.toLowerCase()}" data-tahap="${t}"><b>${kira(t)}</b> ${t}</span>`,
    )
    .join('');
  const tinggi = (d.po || []).filter((p) => p.risikoBanjir === 'Tinggi');
  poNote.hidden = !tinggi.length;
  poNote.textContent = tinggi.length
    ? `PO berisiko banjir Tinggi (${tinggi.length}): ${tinggi.map((p) => p.nama).join(', ')}`
    : '';
  const baris = senaraiStesenBanjir(d);
  list.innerHTML = baris.length
    ? baris.map(stesenBarisHTML).join('')
    : `<div class="bj-kosong"><b>Tiada stesen pada tahap Waspada, Amaran atau Bahaya sekarang</b><span>${sah.length} stesen sah dipantau</span></div>`;
}
// Klik baris stesen: terbang ke stesen pada peta utama dan buka pop-up (hidupkan lapisan jika dimatikan).
function pilihStesenBanjir(id) {
  const d = banjirState.status === 'ready' ? banjirState.data : null;
  const s = d && d.stesen.find((x) => String(x.id) === String(id));
  if (!s || !map) return;
  if (!banjirLapisan.tunjuk) {
    banjirLapisan.tunjuk = true;
    renderFloodLayer();
  }
  const mc = $('map');
  if (mc && mc.scrollIntoView) mc.scrollIntoView({ block: 'center', behavior: 'smooth' });
  map.flyTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 10), essential: true });
  bukaPopupStesen(stesenProps(s), [s.lon, s.lat]);
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act="stesen-banjir"]');
  if (b) pilihStesenBanjir(b.dataset.stesen);
});
/* ===== Amaran cuaca data.gov.my (lapisan peta + kad Amaran Rasmi) =====
   Dimuat daripada /api/met-malaysia (same-origin) dan digabung ke dalam senaraiAmaranRasmi(). Lapisan peta amaran
   (src/js/lapisan-amaran.js) tidak mengambil data sendiri: ia melanggan senarai yang sama (fama:amaran-rasmi). */
const AMARAN_DG_API = {
  promise: null,
  load(force) {
    if (force || !this.promise) {
      this.promise = (async () => {
        if (location.protocol === 'file:') {
          const e = new Error('file');
          e.kind = 'file';
          throw e;
        }
        const res = await fetch('/api/met-malaysia', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (!j || !Array.isArray(j.amaran)) throw new Error('Format amaran tidak sah');
        return j;
      })();
    }
    return this.promise;
  },
};
let amaranDGState = { status: 'memuat', data: null };
const initAmaranDG = () => {
  amaranDGState = { status: 'memuat', data: null };
  return AMARAN_DG_API.load().then(
    (d) => {
      amaranDGState = { status: 'ready', data: d };
      renderMetAlerts();
    },
    (e) => {
      amaranDGState = { status: e && e.kind === 'file' ? 'file' : 'error', data: null };
    },
  );
};

/* ===== Kawalan peta: peta asas, lapisan Amaran Rasmi, lapisan cuaca (lapisan-cuaca/*.js) ===== */
function butangPeta(teks, atribut) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = teks;
  Object.entries(atribut || {}).forEach(([k, v]) => b.setAttribute(k, v));
  return b;
}
function renderPetaKawalan() {
  const kot = $('petaKawalan');
  if (!kot) return;
  kot
    .querySelectorAll('[data-asas]')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.asas === petaAsas ? 'true' : 'false'));
  const a = $('petaAmaranBtn');
  if (a) {
    const P = window.FamaAmaranPeta;
    a.setAttribute('aria-pressed', !P || P.tunjuk() ? 'true' : 'false');
    // N = bilangan aktif dalam tag panel Rasmi ("N aktif · M terkini"); peta hanya menunjukkan yang aktif
    const nAktif = amaranRasmiTerkini.senarai.filter((x) => x.aktif).length;
    a.textContent = `Amaran Rasmi (${nAktif} aktif)`;
    a.title = nAktif
      ? 'Tunjuk atau sembunyi titik Amaran Rasmi aktif (sama dengan senarai panel EWS: MET Malaysia & JPS)'
      : 'Tiada amaran rasmi aktif';
  }
}
function initPetaKawalan() {
  const bingkai = $('map') && $('map').parentElement;
  if (!bingkai) return;
  const kot = document.createElement('div');
  kot.id = 'petaKawalan';
  kot.className = 'peta-kawalan';
  const menuBtn = butangPeta('Lapisan', {
    class: 'peta-menu-btn',
    id: 'petaMenuBtn',
    'aria-expanded': 'false',
    'aria-controls': 'petaMenu',
  });
  const menu = document.createElement('div');
  menu.id = 'petaMenu';
  menu.className = 'peta-menu';
  const asas = document.createElement('div');
  asas.className = 'peta-seg';
  asas.setAttribute('role', 'group');
  asas.setAttribute('aria-label', 'Peta asas');
  Object.entries(PETA_ASAS).forEach(([k, v]) => {
    const b = butangPeta(v.label, { 'data-asas': k, 'aria-pressed': 'false' });
    b.addEventListener('click', () => tetapPetaAsas(k));
    asas.append(b);
  });
  const lapis = document.createElement('div');
  lapis.className = 'peta-seg';
  lapis.setAttribute('role', 'group');
  lapis.setAttribute('aria-label', 'Lapisan tambahan');
  const am = butangPeta('Amaran Rasmi', {
    id: 'petaAmaranBtn',
    'aria-pressed': 'true',
    title:
      'Tunjuk atau sembunyi titik Amaran Rasmi (sama dengan senarai panel EWS: MET Malaysia & JPS)',
  });
  am.addEventListener('click', () => {
    if (window.FamaAmaranPeta) FamaAmaranPeta.tetapTunjuk(!FamaAmaranPeta.tunjuk());
  });
  lapis.append(am);
  if (window.FamaPOT) FamaPOT.pasangButang(lapis);
  menu.append(asas, lapis);
  if (map && window.FamaCuaca && FamaCuaca.pasangMenu) FamaCuaca.pasangMenu(menu);
  kot.append(menuBtn, menu);
  menuBtn.addEventListener('click', () => {
    const buka = kot.classList.toggle('terbuka');
    menuBtn.setAttribute('aria-expanded', buka ? 'true' : 'false');
  });
  bingkai.append(kot);
  if (map && window.FamaCuaca && FamaCuaca.pasangPapan) FamaCuaca.pasangPapan(bingkai);
  renderPetaKawalan();
}
if (window.FamaPOT) {
  window.addEventListener('fama-po-tambahan', () => {
    if (!FamaPOT.tunjuk() && state.po && poById[state.po] && poById[state.po].tambahan) {
      tutupPopupTbh();
      state.po = null;
      state.daerah = null;
      state.chartRecord = null;
      zoomPenapis();
    }
    renderAll();
  });
  FamaPOT.pasangLegenda(document.querySelector('.map-legend'));
}
let mapCaptionAsas = '';
function renderMapCaption() {
  const c = $('mapCaption');
  if (c && mapCaptionAsas) c.textContent = mapCaptionAsas + banjirCatatanPeta();
}
/* ===== Tamat cuaca sebenar ===== */ function logistikStatsHTML(l) {
  return `<div class="logistic-stat-grid"><div class="logistic-stat"><div class="l-label">Kenderaan</div><div class="l-val">${l.kenderaan} buah</div></div><div class="logistic-stat"><div class="l-label">Muatan</div><div class="l-val">${l.muatanMT.toFixed(2)} MT</div></div><div class="logistic-stat"><div class="l-label">Bilik sejuk</div><div class="l-val">${l.bilikSejuk} unit</div></div><div class="logistic-stat"><div class="l-label">Kapasiti simpanan</div><div class="l-val">${l.kapasitiSimpananMT.toFixed(2)} MT</div></div></div>`;
}
function amaranPoNota(p) {
  const t = amaranPoTeks(p);
  return t ? `<div class="outlet-note amaran-po-sebab" title="${esc(t)}">${esc(t)}</div>` : '';
}
function poHoverHTML(p) {
  if (p.tambahan)
    return `<div class="ph-name">${esc(p.fisNama)}</div><div class="ph-sub">PO tambahan · ${esc(p.negeriAsal || p.negeri)} · ${statusHTML(poStatus(p))}</div><div class="outlet-note">Tiada data logistik. ${esc(FamaPOT.LOKASI)}.</div>`;
  const s = poStatus(p);
  return `<div class="ph-name">${esc(p.name)}</div><div class="ph-sub">${esc(p.negeri)} · ${statusHTML(s)}</div><div class="gmaps-baris ph-gmaps-atas"><a class="gmaps-link" href="${esc(gmapsUrl(p.lat, p.lon))}" target="_blank" rel="noopener noreferrer">Buka di Google Maps</a></div>${amaranPoSenaraiHTML(p)}`;
}
// Pop-up PO: senarai amaran harga (amaranPo) ikut penapis komoditi/varieti, terburuk dahulu (5 dipaparkan, selebihnya di sebalik butang Lihat lagi).
function amaranPoSenaraiHTML(p) {
  if (!HD.sedia) return '<div class="outlet-note">Memuatkan status harga…</div>';
  const rr = [];
  ['LADANG', 'RUNCIT'].forEach((pr) =>
    ((HD.idxPO[pr] && HD.idxPO[pr].get(p.id)) || []).forEach((r) => {
      if (r.amaranPo && padanRekod(r)) rr.push(r);
    }),
  );
  if (!rr.length) return '<div class="outlet-note">Tiada data harga bagi tapisan semasa.</div>';
  rr.sort(
    (a, b) =>
      weight[statusRekodPo(b)] - weight[statusRekodPo(a)] ||
      b.amaranPo.daerah.merah - a.amaranPo.daerah.merah ||
      b.amaranPo.daerah.kuning - a.amaranPo.daerah.kuning,
  );
  const isu = rr.filter((r) => ['merah', 'kuning'].includes(statusRekodPo(r)));
  const tunjuk = isu.length ? isu : rr;
  const kelas = { merah: 'red', kuning: 'yellow', hijau: 'green', kelabu: 'grey' };
  const baris = tunjuk.map((r) => {
    const a = r.amaranPo;
    const d = a.daerah;
    const ringkas = `${d.merah} merah · ${d.kuning} kuning · ${d.hijau} hijau · ${d.kelabu} tiada data (daripada ${d.jumlah} daerah)`;
    return `<div class="ph-amaran"><div class="ph-amaran-tajuk"><i class="dot ${kelas[a.status]}"></i><b>${esc(namaRekod(r))}</b> · ${esc(PERINGKAT_NAMA[r.peringkat])}${r.harga == null ? '' : ` · ${money(r.harga)}`}</div><div class="ph-amaran-sebab">${esc(a.sebab)}</div><div class="ph-amaran-daerah">${esc(ringkas)}</div></div>`;
  });
  const mg = rr[0].minggu && rr[0].minggu.iso ? ` · minggu ${rr[0].minggu.iso}` : '';
  const tajuk = isu.length
    ? `Amaran harga (${isu.length} kunci merah/kuning)${mg}`
    : `Tiada amaran harga${mg}`;
  return senaraiAmaranHTML(tajuk, baris);
}
// Pop-up daerah (lapisan-daerah.js): senarai amaran harga daerah ini (status daerah sendiri), gaya sama dengan
// pop-up PO. `pos` = PO (utama/tambahan) yang meliputi daerah; rekod digabung tanpa pendua. 5 dipaparkan, selebihnya Lihat lagi.
function amaranDaerahSenaraiHTML(pos, district) {
  if (!HD.sedia) return '<div class="outlet-note">Memuatkan status harga…</div>';
  const dn = normD(district);
  const dilihat = new Set();
  const rr = [];
  pos.forEach((p) =>
    ['LADANG', 'RUNCIT'].forEach((pr) =>
      ((HD.idxDaerah[pr] && HD.idxDaerah[pr].get(p.id)) || []).forEach((r) => {
        const k = kunciRekod(r);
        if (normD(r.daerah) !== dn || !padanRekod(r) || dilihat.has(k)) return;
        dilihat.add(k);
        rr.push(r);
      }),
    ),
  );
  if (!rr.length) return '<div class="outlet-note">Tiada data harga bagi tapisan semasa.</div>';
  rr.sort((a, b) => weight[b.status] - weight[a.status] || Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));
  const isu = rr.filter((r) => r.status === 'merah' || r.status === 'kuning');
  const senarai = isu.length ? isu : rr;
  const tunjuk = senarai;
  const kelas = { merah: 'red', kuning: 'yellow', hijau: 'green', kelabu: 'grey' };
  const baris = tunjuk.map((r) => {
    const butir = [];
    if (r.pctMinggu != null)
      butir.push(`minggu ke minggu ${r.pctMinggu >= 0 ? '+' : ''}${r.pctMinggu.toFixed(1)}%`);
    if (r.peringkat === 'LADANG' && r.lantai != null) butir.push(`lantai ${money(r.lantai)}`);
    if (r.peringkat === 'RUNCIT' && r.siling != null) butir.push(`siling ${money(r.siling)}`);
    if (r.mean != null) butir.push(`purata asas ${money(r.mean)}`);
    return `<div class="ph-amaran"><div class="ph-amaran-tajuk"><i class="dot ${kelas[r.status] || 'grey'}"></i><b>${esc(namaRekod(r))}</b> · ${esc(PERINGKAT_NAMA[r.peringkat])}${r.harga == null ? '' : ` · ${money(r.harga)}${r.unit ? ' / ' + esc(r.unit) : ''}`}</div><div class="ph-amaran-sebab">${esc(r.sebab)}</div>${butir.length ? `<div class="ph-amaran-daerah">${esc(butir.join(' · '))}</div>` : ''}${gantiHTML(r)}</div>`;
  });
  const mg = rr[0].minggu && rr[0].minggu.iso ? ` · minggu ${rr[0].minggu.iso}` : '';
  const tajuk = isu.length
    ? `Amaran harga (${isu.length} kunci merah/kuning)${mg}`
    : `Tiada amaran harga${mg}`;
  return senaraiAmaranHTML(tajuk, baris);
}
// Senarai amaran pop-up PO/daerah: AMARAN_TUNJUK kunci pertama dipaparkan, selebihnya tersembunyi di sebalik
// butang "Lihat lagi" (pengendali klik didelegasi pada document; CSP tidak membenarkan onclick sebaris).
const AMARAN_TUNJUK = 5;
function senaraiAmaranHTML(tajuk, baris) {
  const lebih = baris.length - AMARAN_TUNJUK;
  const isi = baris
    .map((h, i) =>
      i < AMARAN_TUNJUK
        ? h
        : h.replace('<div class="ph-amaran">', '<div class="ph-amaran" hidden>'),
    )
    .join('');
  return `<div class="ph-out">${esc(tajuk)}</div><div class="ph-amaran-senarai">${isi}</div>${lebih > 0 ? `<button type="button" class="ph-lihat-lagi" data-lihat-lagi="${lebih}" aria-expanded="false">Lihat lagi (${lebih})</button>` : ''}`;
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-lihat-lagi]');
  if (!b) return;
  ev.preventDefault();
  ev.stopPropagation();
  const senarai = b.previousElementSibling;
  const buka = b.getAttribute('aria-expanded') !== 'true';
  [...senarai.querySelectorAll('.ph-amaran')].forEach((e, i) => {
    if (i >= AMARAN_TUNJUK) e.hidden = !buka;
  });
  senarai.classList.toggle('buka', buka);
  b.setAttribute('aria-expanded', String(buka));
  b.textContent = buka ? 'Tunjuk kurang' : 'Lihat lagi (' + b.dataset.lihatLagi + ')';
});
// Pop-up tidak boleh lebih tinggi daripada peta: kandungan diskrol di dalam pop-up (cth. senarai amaran panjang).
// Dengan ll (titik pop-up): had = ruang terbesar di atas atau di bawah titik, supaya pop-up muat pada satu sisi.
function hadTinggiPopup(pp, ll) {
  const el = pp && pp.getElement && pp.getElement().querySelector('.maplibregl-popup-content');
  if (!el || !map) return;
  const H = map.getContainer().clientHeight;
  const y = ll ? map.project(ll).y : H / 2;
  const ruang = ll ? Math.max(y, H - y) - 36 : H - 40;
  el.style.maxHeight = Math.max(160, Math.round(ruang)) + 'px';
  el.style.overflowY = 'auto';
}
let poHoverPopup = null;
let poHoverTimer = null;
function hidePOHover() {
  clearTimeout(poHoverTimer);
  if (poHoverPopup) poHoverPopup.remove();
}
// Beri masa kursor bergerak dari penanda ke pop-up (supaya pautan Google Maps boleh diklik).
function jadualSembunyiPOHover() {
  clearTimeout(poHoverTimer);
  poHoverTimer = setTimeout(hidePOHover, 300);
}
// Kursor yang melintasi penanda PO lain dalam perjalanan ke pop-up tidak menukar pop-up serta-merta:
// pertukaran ditangguh dan dibatalkan jika kursor masuk ke pop-up atau keluar dari penanda itu.
let poHoverTunda = null;
function masukPOHover(p) {
  masukHover(p.id, () => showPOHover(p));
}
function masukHover(id, buka) {
  clearTimeout(poHoverTunda);
  if (poHoverPopup && poHoverPopup.isOpen() && poHoverPopup._poId !== id)
    poHoverTunda = setTimeout(buka, 250);
  else buka();
}
// Hover penanda daerah: kandungan sama dengan pop-up klik poligon daerah (lapisan-daerah.js).
function showDaerahHover(p, d) {
  if (!window.FamaDaerah || !FamaDaerah.kandungan) return;
  const f = FamaDaerah.fitur(p.negeri, d[0]);
  if (!f) return;
  const isi = FamaDaerah.kandungan(f, { lng: d[2], lat: d[1] });
  isi.className = 'daerah-hover';
  bukaHover([d[2], d[1]], isi, 'daerah:' + p.id + ':' + d[0]);
}
function keluarPOHover() {
  clearTimeout(poHoverTunda);
  jadualSembunyiPOHover();
}
function ikatPOHover(popup) {
  const el = popup.getElement();
  el.addEventListener('mouseenter', () => {
    clearTimeout(poHoverTimer);
    clearTimeout(poHoverTunda);
  });
  el.addEventListener('mouseleave', jadualSembunyiPOHover);
}
function showPOHover(p) {
  bukaHover([p.lon, p.lat], poHoverHTML(p), p.id);
}
// Pop-up hover (PO atau daerah): isi = rentetan HTML atau nod DOM.
function bukaHover(ll, isi, id) {
  clearTimeout(poHoverTunda);
  if (!map || typeof maplibregl === 'undefined') return;
  const O = 14,
    opts = {
      closeButton: false,
      closeOnClick: false,
      offset: O,
      maxWidth: '300px',
      className: 'po-hover-popup',
    };
  const pasang = (pp) => (typeof isi === 'string' ? pp.setHTML(isi) : pp.setDOMContent(isi));
  hidePOHover();
  poHoverPopup = pasang(new maplibregl.Popup(opts).setLngLat(ll)).addTo(map);
  hadTinggiPopup(poHoverPopup);
  poHoverPopup._poId = id;
  ikatPOHover(poHoverPopup);
  // Jika popup tidak muat di atas atau di bawah titik, buka di sisi dan anjak supaya kekal dalam peta
  const e = poHoverPopup.getElement(),
    h = e.querySelector('.maplibregl-popup-content').offsetHeight,
    ht = e.offsetHeight,
    pt = map.project(ll),
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
  });
  poHoverPopup = pasang(poHoverPopup.setLngLat(ll)).addTo(map);
  hadTinggiPopup(poHoverPopup);
  poHoverPopup._poId = id;
  ikatPOHover(poHoverPopup);
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
  if (p.tambahan) {
    $('outletContent').innerHTML =
      '<div class="outlet-note" style="padding-bottom:11px"><b>Tiada data logistik</b> untuk PO tambahan (pemetaan FIS 2.1). Calon mobilisasi hanya 15 PO utama.</div>';
    return;
  }
  const l = p.logistik;
  const share = l.shared
    ? `<div class="shared-warning">⚠ <b>Angka gabungan:</b> ${l.pemilikBersama.map(esc).join(' + ')}. Infografik tidak memperincikan agihan setiap PO. Angka ini <b>tidak</b> dikira dua kali dalam jumlah nasional.</div>`
    : '';
  $('outletContent').innerHTML =
    `${logistikStatsHTML(l)}${share}<div class="outlet-note">Sumber: infografik kesiapsiagaan logistik PO. Kadar penggunaan / baki semasa <b>tidak dinyatakan</b> dalam infografik.</div><div style="font-size:12px;font-weight:800;margin-top:11px">Outlet intervensi terdekat (dummy)</div>${p.outlets.map((o) => `<div class="outlet-item"><span><b>${esc(o.jenis)}</b> · ${esc(o.nama)}</span><span class="nowrap">${o.jarakKm} km</span></div>`).join('')}`;
}

/* ===== Panel harga (harga sebenar DB Harga) ===== */
const lokasiRekod = (r) => `${namaKom(r.daerah || r.negeri)}, ${negeriRekod(r)}`;
const namaRekod = (r) =>
  namaKom(r.commodity) + (r.variety && r.variety !== r.commodity ? ' · ' + namaKom(r.variety) : '');
const gantiHTML = (r) =>
  r.ganti
    ? `<div class="price-ganti">${esc(r.ganti.label)}: <b>${money(r.ganti.harga)}</b></div>`
    : '';
const klikBaris = (el) =>
  (el.onclick = () => {
    state.chartRecord = el.dataset.record;
    renderTrend();
    document.querySelector('.chart-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
function renderLists() {
  const msg = hargaBelumSedia();
  if (msg) {
    $('lowestPrices').innerHTML = $('highestPrices').innerHTML =
      `<div class="empty">${esc(msg)}</div>`;
    return;
  }
  // Rekod berharga disusun dahulu; kunci tanpa harga ladang (ganti borong) hanya selepasnya.
  const susun = (stage, arah) => {
    const rr = filteredRecords({ stage });
    const ada = rr
      .filter((r) => r.harga != null)
      .sort((a, b) => (arah === 'asc' ? a.harga - b.harga : b.harga - a.harga));
    return [...ada, ...rr.filter((r) => r.harga == null)].slice(0, 5);
  };
  const lo = susun(state.lowStage, 'asc');
  const hi = susun(state.highStage, 'desc');
  const make = (rows, dir) =>
    rows.length
      ? rows
          .map(
            (r) =>
              `<div class="price-row" data-record="${esc(kunciRekod(r))}"><div><div class="price-name">${esc(namaRekod(r))}</div><div class="price-loc">${esc(lokasiRekod(r))} · ${esc(r.unit || '')} ${statusHTML(r.status)}</div><div class="price-sebab">${esc(r.sebab)}</div>${gantiHTML(r)}</div><div class="price-value value-${dir}">${r.harga == null ? '<span class="price-kosong">Tiada harga ladang</span>' : money(r.harga)}</div></div>`,
          )
          .join('')
      : '<div class="empty">Tiada rekod mengikut penapis. Tukar “Mod senarai” kepada semua komoditi.</div>';
  $('lowestPrices').innerHTML = make(lo, 'red');
  $('highestPrices').innerHTML = make(hi, 'green');
  document.querySelectorAll('.price-row').forEach(klikBaris);
}
function renderCompare() {
  const msg = hargaBelumSedia();
  const nota = $('compareNota');
  if (msg) {
    $('compareBody').innerHTML =
      `<tr><td colspan="4"><div class="empty">${esc(msg)}</div></td></tr>`;
    if (nota) nota.textContent = '';
    return;
  }
  const rows = filteredRecords()
    .filter((r) => r.harga != null)
    .sort(
      (a, b) =>
        weight[b.status] - weight[a.status] ||
        Math.abs(b.pctMinggu ?? 0) - Math.abs(a.pctMinggu ?? 0),
    )
    .slice(0, 7);
  if (nota) {
    const m = rows[0] && rows[0].minggu;
    nota.textContent = m
      ? `Minggu ${m.iso}${m.separa ? ' (separa)' : ''}`
      : 'Harga mingguan sebenar';
  }
  $('compareBody').innerHTML = rows.length
    ? rows
        .map((r) => {
          const pct = r.pctMinggu;
          return `<tr data-record="${esc(kunciRekod(r))}"><td><div class="cell-major">${esc(negeriRekod(r))} · ${esc(namaKom(r.daerah || r.negeri))}</div><div class="cell-minor">${esc(namaRekod(r))} · ${esc(PERINGKAT_NAMA[r.peringkat])} ${statusHTML(r.status)}</div></td><td class="number">${r.hargaSebelum == null ? '—' : money(r.hargaSebelum)}</td><td class="number"><b>${money(r.harga)}</b></td><td class="number ${pct == null || pct >= 0 ? 'positive' : 'negative'}">${pct == null ? '—' : `<b>${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</b> ${pct >= 0 ? '▲' : '▼'}`}</td></tr>`;
        })
        .join('')
    : '<tr><td colspan="4"><div class="empty">Tiada komoditi memenuhi penapis.</div></td></tr>';
  document.querySelectorAll('#compareBody tr[data-record]').forEach(klikBaris);
}
let trendToken = 0;
function teksTrend(tajuk, sub, status) {
  $('priceChart').innerHTML =
    `<text x="300" y="205" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--white)">${esc(tajuk)}</text>` +
    (sub
      ? `<text x="300" y="232" text-anchor="middle" style="font-size:13px">${esc(sub)}</text>`
      : '');
  $('chartSubject').textContent = sub || tajuk;
  $('chartStatus').textContent = status || '';
}
function renderTrend() {
  const msg = hargaBelumSedia();
  if (msg) return teksTrend(msg === 'Memuat harga…' ? msg : 'Trend harga tidak tersedia', msg, '');
  if (state.komoditi === 'all' && !state.chartRecord)
    return teksTrend(
      'Sila pilih komoditi',
      'Graf trend dipaparkan mengikut komoditi. Pilih komoditi pada penapis di atas.',
      '',
    );
  const all = filteredRecords({ issues: false });
  const berharga = all.filter((r) => r.harga != null);
  const utama = berharga.filter((r) => r.peringkat !== 'BORONG');
  const r =
    all.find((x) => kunciRekod(x) === state.chartRecord) ||
    [...(utama.length ? utama : berharga)].sort(
      (a, b) => weight[b.status] - weight[a.status] || Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0),
    )[0];
  if (!r) {
    $('priceChart').innerHTML = '<text x="50" y="130">Tiada data untuk paparan graf.</text>';
    $('chartSubject').textContent = 'Tiada rekod memenuhi penapis';
    $('chartStatus').textContent = '';
    return;
  }
  const params = {
    peringkat: r.peringkat,
    commodity: r.commodity,
    variety: r.variety,
    ...(r.po ? { po: r.po } : { negeri: r.negeri }),
    ...(r.daerah ? { daerah: r.daerah } : {}),
    ...(state.bulan !== 'all' ? { bulan: state.bulan } : {}),
  };
  const d = HARGADB.segerak('siri', params);
  if (!d) {
    teksTrend('Memuat trend…', 'Memuat siri harga harian…', '');
    const token = ++trendToken;
    HARGADB.siri(params).then(
      () => token === trendToken && renderTrend(),
      () => {
        if (token !== trendToken) return;
        teksTrend(
          'Trend harga tidak dapat dimuatkan',
          'Siri harian tidak tersedia buat masa ini.',
          '',
        );
        $('chartStatus').innerHTML =
          '<button type="button" class="button tiny ghost" id="trendCubaSemula">Cuba semula</button>';
        $('trendCubaSemula').onclick = cubaSemulaHarga;
      },
    );
    return;
  }
  ++trendToken;
  const s = d.siri;
  const titik = state.bulan === 'all' ? s.titik.slice(-state.days) : s.titik;
  const n = titik.length;
  if (!n) return teksTrend('Tiada titik harga', 'Tiada data harian untuk pilihan ini.', '');
  const vals = titik.map((t) => t.h);
  const sd = s.sd != null && s.sd > 0 ? s.sd : null;
  const bandSigma = s.mean != null && sd != null;
  const lower1 = bandSigma ? s.mean - sd : null,
    upper1 = bandSigma ? s.mean + sd : null,
    lower2 = bandSigma ? s.mean - 2 * sd : null,
    upper2 = bandSigma ? s.mean + 2 * sd : null;
  const tahap = [...vals, lower2, upper2, s.mean, s.lantai, s.siling].filter((v) => v != null);
  const min = Math.min(...tahap),
    max = Math.max(...tahap),
    pad = (max - min) * 0.1 || 1,
    ymin = min - pad,
    ymax = max + pad;
  const left = 50,
    right = 545,
    top = 16,
    bottom = 385;
  const px = (i) => (n > 1 ? left + (i / (n - 1)) * (right - left) : (left + right) / 2),
    py = (v) => bottom - ((v - ymin) / (ymax - ymin)) * (bottom - top);
  const e = [];
  const line = (y, cls, label) => {
    if (y == null) return;
    const yy = py(y);
    e.push(
      `<line class="${cls}" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text x="${right + 8}" y="${yy + 3}" style="font-size:13px">${label}</text>`,
    );
  };
  e.push(
    `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="7" style="fill:var(--ch-bg)"/>`,
  );
  if (bandSigma) {
    e.push(
      `<rect x="${left}" y="${py(upper1)}" width="${right - left}" height="${Math.max(0, py(lower1) - py(upper1))}" style="fill:var(--ch-ok)" opacity=".32"/>`,
      `<rect x="${left}" y="${py(upper2)}" width="${right - left}" height="${Math.max(0, py(upper1) - py(upper2))}" style="fill:var(--ch-warn)" opacity=".22"/>`,
      `<rect x="${left}" y="${py(lower1)}" width="${right - left}" height="${Math.max(0, py(lower2) - py(lower1))}" style="fill:var(--ch-warn)" opacity=".22"/>`,
    );
  }
  for (let i = 0; i < 5; i++) {
    const y = top + (i * (bottom - top)) / 4,
      v = ymax - (i * (ymax - ymin)) / 4;
    e.push(
      `<line class="axis" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text x="${left - 10}" y="${y + 4}" text-anchor="end">${v.toFixed(1)}</text>`,
    );
  }
  if (bandSigma) {
    line(upper2, 'critical-line', '+2σ');
    line(lower2, 'critical-line', '−2σ');
    line(upper1, 'warning-line', '+1σ');
    line(lower1, 'warning-line', '−1σ');
  }
  line(s.mean, 'avg-line', 'μ');
  line(s.lantai, 'critical-line', 'Lantai');
  line(s.siling, 'critical-line', 'Siling');
  e.push(`<polyline class="line" points="${vals.map((v, i) => `${px(i)},${py(v)}`).join(' ')}"/>`);
  for (let i = 0; i < n; i++) {
    if (i % Math.max(1, Math.ceil(n / 12)) === 0 || i === n - 1)
      e.push(
        `<circle cx="${px(i)}" cy="${py(vals[i])}" r="3" style="fill:var(--ch-pt);stroke:var(--ch-pt-stroke)" stroke-width="1.5"/>`,
      );
  }
  const bln = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  const tarikh = (t) => `${+t.slice(8, 10)} ${bln[+t.slice(5, 7) - 1]}`;
  for (let i = 0; i < n; i += Math.max(1, Math.ceil(n / 6)))
    e.push(
      `<text x="${px(i)}" y="${bottom + 19}" text-anchor="middle">${tarikh(titik[i].t)}</text>`,
    );
  if (!bandSigma)
    e.push(
      `<text x="${(left + right) / 2}" y="${top + 16}" text-anchor="middle" style="font-size:12px">${s.mean == null ? 'Tiada ambang untuk kunci ini' : 'Sisihan piawai tidak sah (jalur σ tidak dilukis)'}</text>`,
    );
  $('priceChart').innerHTML = e.join('');
  $('chartSubject').textContent =
    `${namaRekod(r)} · ${lokasiRekod(r)} · ${PERINGKAT_NAMA[r.peringkat]} · ${s.unit || r.unit || ''} · ${n} hari${state.bulan !== 'all' ? ' · ' + bulanLabel(state.bulan) : ''}${s.asas ? ' · asas ' + s.asas : ' · tiada tahun asas'}`;
  $('chartSubject').title = s.asas
    ? `μ dan σ ialah purata dan sisihan piawai tahun asas ${s.asas}; Lantai dan Siling ialah harga dasar.`
    : 'Tiada ambang untuk kunci ini.';
  $('chartStatus').innerHTML = statusHTML(r.status);
  $('chartStatus').title = r.sebab;
}
function renderQueue() {
  const msg = hargaBelumSedia();
  if (msg) {
    $('riskCount').textContent = '…';
    $('riskFeed').innerHTML = `<div class="empty">${esc(msg)}</div>`;
    return;
  }
  const rr = filteredRecords({ issues: true })
    .filter((r) => r.status === 'merah' || r.status === 'kuning')
    .sort((a, b) => weight[b.status] - weight[a.status] || Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));
  $('riskCount').textContent = rr.length + ' isu';
  $('riskFeed').innerHTML = rr.length
    ? rr
        .slice(0, 8)
        .map(
          (r) =>
            `<div class="risk-item" data-risk="${esc(kunciRekod(r))}"><i class="dot ${r.status === 'merah' ? 'red' : 'yellow'}" style="margin-top:5px"></i><div class="risk-main"><strong>${esc(namaKom(r.daerah || r.negeri))} · ${esc(namaRekod(r))}</strong><div class="meta">${esc(negeriRekod(r))} · ${esc(PERINGKAT_NAMA[r.peringkat])} <b>${money(r.harga)}</b> · ${esc(r.sebab)}<br>${esc(r.po ? poById[r.po].name : 'Tiada PO ditugaskan')}</div></div><button class="button tiny ${r.status === 'merah' ? 'danger' : 'ghost'}" data-open-action="${esc(kunciRekod(r))}">Tindakan</button></div>`,
        )
        .join('')
    : '<div class="empty">Tiada amaran harga atau isu berwaspada dalam pilihan semasa.</div>';
  document.querySelectorAll('[data-risk]').forEach((el) =>
    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-action]')) return;
      const r = cariBaris(el.dataset.risk);
      if (r && r.po) {
        selectPO(r.po);
        const dd = poById[r.po].districts.find((d) => normD(d[0]) === normD(r.daerah));
        state.daerah = dd ? dd[0] : null;
        state.chartRecord = kunciRekod(r);
        renderAll();
      }
    }),
  );
  document
    .querySelectorAll('[data-open-action]')
    .forEach((b) => (b.onclick = () => openActionModal(b.dataset.openAction)));
}
const cariBaris = (kunci) =>
  ['daerah', 'po'].reduce(
    (a, aras) =>
      a ||
      ['LADANG', 'RUNCIT', 'BORONG']
        .flatMap((p) => HD[aras][p] || [])
        .find((x) => kunciRekod(x) === kunci),
    null,
  );
function renderAll() {
  muatHarga();
  renderHargaKeadaan();
  renderLogistik();
  renderKpis();
  renderMap();
  renderPODirectory();
  renderWeather();
  renderEws();
  renderOutlets();
  renderLists();
  renderCompare();
  renderTrend();
  renderQueue();
  renderScenarioPanel();
  const selected = state.po ? poById[state.po] : null;
  $('analyticsScope').textContent = selected
    ? `Tertapis: ${selected.name} · ${selected.negeri} / ${state.daerah || 'Semua daerah'} · ${state.issues ? 'komoditi bermasalah' : 'semua komoditi'}`
    : `Paparan lalai: ${state.issues ? 'komoditi bermasalah' : 'semua komoditi'} ${state.negeri === 'all' ? 'seluruh kawasan pilihan' : 'negeri ' + state.negeri}`;
  $('scopeChip').textContent = selected
    ? `◉ ${selected.name} · ${selected.negeri} ${state.daerah ? '· ' + state.daerah : ''}`
    : state.negeri === 'all'
      ? '◉ Seluruh Malaysia'
      : `◉ ${state.negeri}`;
  kemasPenapis();
}
function openActionModal(recordId, opts) {
  // Rekod harga sebenar (kunci baris) atau, bagi konteks senario (scenarios.js), rekod dummy lama.
  const b = cariBaris(recordId);
  const lama = b ? null : DATA.rekod.find((x) => x.id === recordId);
  if (!b && !lama) return;
  const p = poById[b ? b.po : lama.poId] || null;
  const r = b
    ? {
        komoditi: namaRekod(b),
        daerah: namaKom(b.daerah || b.negeri),
        negeri: negeriRekod(b),
        status: b.status,
        info:
          `${PERINGKAT_NAMA[b.peringkat]} · ${b.harga == null ? 'Tiada harga ladang' : money(b.harga)}` +
          (b.hargaSebelum == null ? '' : ` · Minggu sebelum: ${money(b.hargaSebelum)}`) +
          (b.lantai == null && b.siling == null
            ? ''
            : ` · Lantai: ${b.lantai == null ? '—' : money(b.lantai)} · Siling: ${b.siling == null ? '—' : money(b.siling)}`) +
          (b.mean == null
            ? ''
            : ` · μ ${money(b.mean)} · σ ${b.sd == null ? '—' : money(b.sd)} (asas ${b.asas || '—'})`) +
          ` · ${b.sebab}`,
      }
    : {
        komoditi: lama.komoditi,
        daerah: lama.daerah,
        negeri: lama.negeri,
        status: lama.status,
        info: `Forecast: ${money(lama.ramalan)} · Purata 30 hari: ${money(lama.purata)} · Had: ${money(lama.hargaLantai)} – ${money(lama.hargaSiling)} · ${lama.sebab}`,
      };
  const kadPO = p
    ? `<div class="modal-grid"><div class="modal-card"><b>Cadangan outlet (simulasi)</b>${p.outlets.map((o) => `<div class="outlet-item">${esc(o.jenis)} · ${esc(o.nama)} <span>${o.jarakKm} km</span></div>`).join('')}</div><div class="modal-card"><b>Logistik PO (berdasarkan infografik)</b><div style="margin-top:10px">Kenderaan: ${p.logistik.kenderaan} buah · Muatan: ${p.logistik.muatanMT} MT</div><div>Bilik sejuk: ${p.logistik.bilikSejuk} unit</div><div>Kapasiti simpanan: ${p.logistik.kapasitiSimpananMT} MT</div><div class="note">${p.logistik.shared ? 'Angka gabungan: ' + p.logistik.pemilikBersama.join(' + ') : 'Angka PO daripada infografik'}. Baki sebenar tidak tersedia.</div></div></div>`
    : '<div class="modal-card"><b>Tiada PO ditugaskan</b><div class="note">Daerah ini belum dipetakan kepada mana-mana PO.</div></div>';
  $('modalMount').innerHTML =
    `<div class="modal-back" id="modalBack"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><div><div class="eyebrow">REKOD INTERVENSI · ${b ? 'HARGA SEBENAR (DB Harga)' : 'DATA DUMMY'}</div><h2 id="modalTitle">${esc(r.komoditi)} · ${esc(r.daerah)}</h2></div><button class="close-x" id="modalClose" aria-label="Tutup">×</button></div><div class="modal-body"><div class="modal-card"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(p ? p.name : 'Tiada PO')} / ${esc(r.negeri)}</b>${statusHTML(r.status)}</div><div class="note" style="margin-top:6px">${esc(r.info)}</div></div>${kadPO}<div class="modal-grid"><label>Jenis intervensi<select id="actionType"><option>Semakan pergerakan harga</option><option>Pengalihan bekalan</option><option>Penyelarasan jualan di outlet</option><option>Pemantauan bersama PO</option></select></label><label>Status tindakan<select id="actionStatus"><option>Dalam tindakan</option><option>Untuk semakan</option><option>Selesai</option></select></label></div><label style="display:block;margin-top:12px">Catatan tindakan<textarea id="actionNote" placeholder="Contoh: Semakan trend harga harian dan koordinasi dengan PO (simulasi)."></textarea></label><div class="note" style="margin-top:7px">Tindakan ini hanya direkodkan dalam pelayar tempatan. Tiada penghantaran kepada FAMA.</div></div><div class="modal-actions"><button class="button ghost" id="actionCancel">Batal</button><button class="button" id="saveAction">✓ Rekod Tindakan</button></div></section></div>`;
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
      poId: p ? p.id : null,
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
  if (!HD.sedia) {
    toast(hargaBelumSedia() || 'Data harga belum sedia.');
    return;
  }
  const fields = [
    'peringkat',
    'negeri',
    'po',
    'daerah',
    'komoditi',
    'varieti',
    'unit',
    'minggu',
    'harga',
    'hargaSebelum',
    'perubahanPct',
    'status',
    'sebab',
    'tahunAsas',
  ];
  const recs = filteredRecords({ issues: false }).map((r) => ({
    peringkat: PERINGKAT_NAMA[r.peringkat],
    negeri: negeriRekod(r),
    po: r.po ? poById[r.po].name : '',
    daerah: namaKom(r.daerah || ''),
    komoditi: namaKom(r.commodity),
    varieti: namaKom(r.variety),
    unit: r.unit,
    minggu: r.minggu ? r.minggu.iso + (r.minggu.separa ? ' (separa)' : '') : '',
    harga: r.harga,
    hargaSebelum: r.hargaSebelum,
    perubahanPct: r.pctMinggu,
    status: labels[r.status],
    sebab: r.sebab,
    tahunAsas: r.asas,
  }));
  const encode = (x) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  const csv =
    '\ufeff' +
    fields.join(',') +
    '\r\n' +
    recs.map((r) => fields.map((f) => encode(r[f])).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fama_harga_tapisan.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${recs.length} rekod CSV dieksport.`);
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

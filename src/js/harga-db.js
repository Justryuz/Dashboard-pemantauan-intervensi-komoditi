/* Pemuat harga sebenar (DB Harga) yang dikongsi tab Pemantauan dan Intervensi.
   Hanya memanggil /api/harga*, /api/harga/meta same-origin; tiada kunci atau rahsia dalam pelayar.
   Hasil disimpan mengikut rentetan pertanyaan. Peristiwa window 'fama-harga-sedia' dicetus bila satu
   respons berjaya diterima. Tiada skrip sebaris (CSP). */
(function (root) {
  'use strict';
  const TAMAT_MASA = 20000;
  const URL_ASAS = '/api/harga';
  const sedia = new Map(); // url -> respons JSON
  const janji = new Map(); // url -> Promise (sedang berjalan atau selesai)
  const H = {
    keadaan: 'memuat', // memuat | sedia | ralat | file
    ralat: null,
    terkini: null, // tarikh terkini (YYYY-MM-DD)
    lapuk: false,
    mingguSeparaIso: null,
    disegarPada: null,
  };

  const kosong = (v) => v === undefined || v === null || v === '' || v === 'all';
  function binaUrl(jenis, params) {
    if (jenis === 'meta') return URL_ASAS + '/meta';
    const sp = new URLSearchParams();
    Object.keys(params || {})
      .sort()
      .forEach((k) => {
        if (!kosong(params[k])) sp.set(k, String(params[k]));
      });
    if (jenis === 'siri') sp.set('siri', '1');
    const q = sp.toString();
    return URL_ASAS + (q ? '?' + q : '');
  }
  function catatKepala(d) {
    if (!d || typeof d !== 'object') return;
    if (typeof d.tarikhTerkini === 'string') H.terkini = d.tarikhTerkini;
    if (typeof d.lapuk === 'boolean') H.lapuk = d.lapuk;
    if ('mingguSemasaSeparaIso' in d) H.mingguSeparaIso = d.mingguSemasaSeparaIso || null;
    if (d.disegarPada) H.disegarPada = d.disegarPada;
  }
  async function ambil(url) {
    if (root.location && root.location.protocol === 'file:') {
      const e = new Error('Data harga sebenar memerlukan npm start');
      e.kind = 'file';
      throw e;
    }
    const ac = new AbortController();
    const pemasa = setTimeout(() => ac.abort(), TAMAT_MASA);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d || typeof d !== 'object') throw new Error('Respons harga tidak sah');
      return d;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        const t = new Error('Masa tamat');
        t.kind = 'masa';
        throw t;
      }
      throw e;
    } finally {
      clearTimeout(pemasa);
    }
  }
  function muat(jenis, params) {
    const url = binaUrl(jenis, params);
    if (janji.has(url)) return janji.get(url);
    if (!sedia.size) H.keadaan = 'memuat';
    const p = ambil(url).then(
      (d) => {
        sedia.set(url, d);
        catatKepala(d);
        if (jenis === 'meta') catatSenarai(d);
        H.keadaan = 'sedia';
        H.ralat = null;
        root.dispatchEvent(new CustomEvent('fama-harga-sedia', { detail: { url, jenis } }));
        return d;
      },
      (e) => {
        janji.delete(url);
        H.keadaan = e && e.kind === 'file' ? 'file' : 'ralat';
        H.ralat = e && e.message ? e.message : 'Ralat tidak diketahui';
        throw e;
      },
    );
    janji.set(url, p);
    return p;
  }

  // Padanan nama: huruf besar, buang noktah/kurungan, BAHARU/BHARU -> BAHRU (cth. Johor Bahru).
  const normDaerah = (s) =>
    String(s || '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .replace(/\bBAHARU\b|\bBHARU\b/g, 'BAHRU')
      .replace(/\s+/g, ' ')
      .trim();
  // Label jenis/varieti daripada /api/harga/meta (config/komoditi-diliputi.json), satu-satunya sumber nama paparan.
  const LABEL = new Map();
  const TIADA = new Set();
  function catatSenarai(d) {
    const s = d && d.penapis && d.penapis.komoditiSenarai;
    if (!Array.isArray(s)) return;
    LABEL.clear();
    TIADA.clear();
    s.forEach((k) => {
      LABEL.set(k.kod, k.label);
      (k.varieti || []).forEach((v) => {
        LABEL.set(v.kod, v.label);
        if (v.tiadaData) TIADA.add(v.kod);
      });
    });
  }
  // 'CILI MERAH KULAI' -> 'Cili Merah Kulai'; kekalkan kandungan dalam kurungan. Jenis/varieti dalam senarai guna labelnya.
  const tajuk = (s) =>
    LABEL.has(s)
      ? LABEL.get(s)
      : String(s || '')
          .toLowerCase()
          .replace(/(^|[\s(\-/])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  const BOBOT = { kelabu: -1, hijau: 0, kuning: 1, merah: 2 };
  // Status terburuk: merah > kuning > hijau; kelabu hanya jika semua kelabu (atau tiada).
  function statusTerburuk(senarai) {
    let t = 'kelabu';
    for (const s of senarai) if (s in BOBOT && BOBOT[s] > BOBOT[t]) t = s;
    return t;
  }
  const RM = (x) => 'RM ' + Number(x).toFixed(2);

  root.HARGADB = {
    get keadaan() {
      return H.keadaan;
    },
    get ralat() {
      return H.ralat;
    },
    get terkini() {
      return H.terkini;
    },
    get lapuk() {
      return H.lapuk;
    },
    get mingguSeparaIso() {
      return H.mingguSeparaIso;
    },
    get disegarPada() {
      return H.disegarPada;
    },
    meta: () => muat('meta'),
    ringkasan: (params) => muat('ringkasan', params),
    siri: (params) => muat('siri', params),
    // Akses segerak kepada hasil yang sudah diterima (undefined jika belum).
    segerak: (jenis, params) => sedia.get(binaUrl(jenis, params)),
    url: binaUrl,
    cubaSemula() {
      sedia.clear();
      janji.clear();
      H.keadaan = 'memuat';
      H.ralat = null;
      return Promise.resolve();
    },
    normDaerah,
    tajuk,
    tiadaData: (v) => TIADA.has(v),
    statusTerburuk,
    BOBOT,
    RM,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

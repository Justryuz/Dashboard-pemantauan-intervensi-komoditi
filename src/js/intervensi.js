(function () {
  'use strict';
  /* ===== Dashboard Intervensi Komoditi: modul data dan logik tulen (ruang nama iv*) ===== */
  const $i = (id) => document.getElementById(id);
  const slug = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fin = (x) => typeof x === 'number' && Number.isFinite(x);
  const f2 = (x) => (fin(x) ? x.toFixed(2) : '—');
  const sgn = (x, d = 2) => (fin(x) ? (x > 0 ? '+' : '') + x.toFixed(d) : '—');
  const rmPos = (x) => (fin(x) && x > 0 ? 'RM ' + x.toFixed(2) : '—');
  const rmAny = (x) => (fin(x) ? 'RM ' + x.toFixed(2) : '—');
  const E = (s) => esc(s);
  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const MY_MONTHS = [
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
  const MY_MON_IDX = {
    januari: 1,
    februari: 2,
    mac: 3,
    april: 4,
    mei: 5,
    jun: 6,
    julai: 7,
    ogos: 8,
    september: 9,
    oktober: 10,
    november: 11,
    disember: 12,
  };

  const IV_CONFIG = {
    refNow: '2026-11-15T12:00:00+08:00',
    thresholds: {
      pengeluar: { direction: 'turun', warnPct: -8, critPct: -15, stage: 'Ladang' },
      pengguna: { direction: 'naik', warnPct: 8, critPct: 15, stage: 'Runcit' },
    },
    supply: { minSurplusMT: 3, minSurplusRatio: 0.15, shortageCoverage: 0.8, staleHours: 72 },
    detour: 1.3,
    crossZoneRules: [],
    museBands: { kuning: 20, merah: 40 },
    minHistory: 8,
    labelShift: {
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
    },
  };
  const IV_THR_DEFAULT = JSON.parse(JSON.stringify(IV_CONFIG.thresholds));
  let refNow = IV_CONFIG.refNow;
  const nowMs = () => Date.parse(refNow);
  const myDate = (iso) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
  function addDays(ds, n) {
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function weekStart(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDays(ds, -((dow + 6) % 7));
  }
  function weekRange(ws) {
    return [ws, addDays(ws, 6)];
  }
  function fmtDate(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    return d + ' ' + MY_MONTHS[m - 1] + ' ' + y;
  }
  function fmtWeek(ws) {
    const [a, b] = weekRange(ws);
    const [y1, m1, d1] = a.split('-').map(Number),
      [y2, m2, d2] = b.split('-').map(Number);
    return m1 === m2
      ? `${d1} – ${d2} ${MY_MONTHS[m2 - 1]} ${y2}`
      : `${d1} ${MY_MONTHS[m1 - 1]} – ${d2} ${MY_MONTHS[m2 - 1]} ${y2}`;
  }

  /* ===== MODUL DATA: PO (paparan terbitan DATA.po, tiada salinan nilai) ===== */
  const IV_PO = DATA.po.map((p) => ({
    id: p.id,
    name: p.name,
    label: p.label,
    negeri: p.negeri,
    stateId: slug(p.negeri),
    zone: p.negeri === 'Sabah' ? 'Sabah' : p.negeri === 'Sarawak' ? 'Sarawak' : 'Semenanjung',
    lat: p.lat,
    lon: p.lon,
    coordApprox: true,
    group: p.logistikGroup,
    districts: p.districts,
    logistik: p.logistik,
    source: 'sebenar',
    origin: 'DATA.po',
  }));
  const IV_POBY = Object.fromEntries(IV_PO.map((p) => [p.id, p]));
  const IV_STATES = [...new Map(IV_PO.map((p) => [p.stateId, p.negeri])).entries()].map(
    ([id, name]) => ({ id, name }),
  );
  const IV_COMM = DATA.komoditi.map((k) => ({
    id: slug(k.name),
    name: k.name,
    unit: k.unit,
    base: k.base,
    floor: k.floor,
    ceiling: k.ceiling,
    source: 'dummy',
    origin: 'DATA.rekod',
  }));
  const IV_COMMBY = Object.fromEntries(IV_COMM.map((c) => [c.id, c]));
  const isKg = (cid) => IV_COMMBY[cid] && IV_COMMBY[cid].unit === 'RM/kg';

  /* Pemetaan daerah ke PO (dummy, eksplisit) */
  const IV_DISTRICTS = [];
  IV_PO.forEach((p) =>
    p.districts.forEach((d) =>
      IV_DISTRICTS.push({
        districtId: p.stateId + '/' + slug(d[0]),
        name: d[0],
        stateId: p.stateId,
        negeri: p.negeri,
        poId: p.id,
        lat: d[1],
        lon: d[2],
        coordApprox: true,
        mappingStatus: 'dummy-sah',
        source: 'dummy',
        origin: 'DATA.po.districts',
      }),
    ),
  );
  const IV_DISTBY = Object.fromEntries(IV_DISTRICTS.map((d) => [d.districtId, d]));
  const IV_GAZETTEER = [
    { name: 'Dungun', stateId: 'terengganu', negeri: 'Terengganu', lat: 4.76, lon: 103.42 },
    { name: 'Kemaman', stateId: 'terengganu', negeri: 'Terengganu', lat: 4.23, lon: 103.42 },
    { name: 'Besut', stateId: 'terengganu', negeri: 'Terengganu', lat: 5.83, lon: 102.55 },
    { name: 'Cameron Highlands', stateId: 'pahang', negeri: 'Pahang', lat: 4.47, lon: 101.38 },
  ];
  let ivWithheld = {};

  /* Outlet (dummy) */
  const IV_CATS = [
    { id: 'pasar-awam', label: 'Pasar Awam', glyph: 'PA' },
    { id: 'ptk', label: 'PTK', glyph: 'PT' },
    { id: 'rakr', label: 'RAKR', glyph: 'RK' },
    { id: 'agrobazaar', label: 'Agrobazaar', glyph: 'AB' },
  ];
  const IV_CATBY = Object.fromEntries(IV_CATS.map((c) => [c.id, c]));
  const IV_OUTLETS = (function () {
    const out = [];
    const named = {
      'johor/kluang': [
        ['OUT-KLU-01', 'Pasar Awam Kluang', 'pasar-awam'],
        ['OUT-KLU-02', 'Agrobazaar Kluang', 'agrobazaar'],
        ['OUT-KLU-03', 'RAKR Kluang', 'rakr'],
      ],
      'johor/johor-bahru': [
        ['OUT-JHB-01', 'Pasar Awam Larkin', 'pasar-awam'],
        ['OUT-JHB-02', 'PTK Johor Bahru', 'ptk'],
        ['OUT-JHB-03', 'Agrobazaar Johor Bahru', 'agrobazaar'],
      ],
      'kelantan/pasir-mas': [
        ['OUT-PMS-01', 'Pasar Awam Pasir Mas', 'pasar-awam'],
        ['OUT-PMS-02', 'PTK Pasir Mas', 'ptk'],
        ['OUT-PMS-03', 'RAKR Pasir Mas', 'rakr'],
      ],
    };
    const commPool = IV_COMM.filter((c) => c.unit === 'RM/kg').map((c) => c.id);
    const stat = (h) =>
      h % 7 === 0 ? 'Tidak beroperasi' : h % 11 === 0 ? 'Data tidak tersedia' : 'Beroperasi';
    IV_DISTRICTS.forEach((d, i) => {
      if (d.name === 'Jasin' || d.name === 'Jelebu') return;
      const h = hash32(d.districtId);
      let list = named[d.districtId];
      if (!list) {
        const n = 1 + (h % 2);
        list = [];
        for (let k = 0; k < n; k++) {
          const c = IV_CATS[(h + k + i) % 4];
          list.push([
            'OUT-' + slug(d.name).toUpperCase().replace(/-/g, '').slice(0, 5) + '-0' + (k + 1),
            c.label + ' ' + d.name,
            c.id,
          ]);
        }
      }
      list.forEach(([id, nama, kat], k) => {
        const hh = hash32(id);
        const dlat = ((hh % 81) - 40) / 1000,
          dlon = (((hh >>> 8) % 81) - 40) / 1000;
        let kom = [commPool[hh % commPool.length], commPool[(hh + 3) % commPool.length]];
        if (d.districtId === 'johor/kluang' || d.districtId === 'johor/johor-bahru')
          kom = ['cili-merah', kom[0]];
        if (d.districtId === 'kelantan/pasir-mas') kom = ['bawang-merah-kecil', kom[0]];
        out.push({
          outletId: id,
          nama: nama + ' (Contoh)',
          kategori: kat,
          stateId: d.stateId,
          negeri: d.negeri,
          districtId: d.districtId,
          districtName: d.name,
          supervisingPOId: d.poId,
          lat: +(d.lat + dlat).toFixed(4),
          lon: +(d.lon + dlon).toFixed(4),
          coordApprox: true,
          status: named[d.districtId] ? 'Beroperasi' : stat(hh),
          komoditiBerkaitan: [...new Set(kom)],
          assignmentStatus: 'dummy-sah',
          source: 'dummy',
          origin: 'iv',
        });
      });
    });
    [
      ['OUT-KMN-01', 'Pasar Awam Kemaman', 'pasar-awam', IV_GAZETTEER[1]],
      ['OUT-KMN-02', 'RAKR Kemaman', 'rakr', IV_GAZETTEER[1]],
    ].forEach(([id, n, k, g]) =>
      out.push({
        outletId: id,
        nama: n + ' (Contoh)',
        kategori: k,
        stateId: g.stateId,
        negeri: g.negeri,
        districtId: g.stateId + '/' + slug(g.name),
        districtName: g.name,
        supervisingPOId: null,
        lat: g.lat + 0.01,
        lon: g.lon + 0.01,
        coordApprox: true,
        status: 'Data tidak tersedia',
        komoditiBerkaitan: ['cili-merah'],
        assignmentStatus: 'tidak-disahkan',
        source: 'dummy',
        origin: 'iv',
      }),
    );
    return out;
  })();
  function outletsOfPO(poId) {
    return IV_OUTLETS.filter((o) => o.supervisingPOId === poId && !ivWithheld[poId]);
  }
  function outletStats() {
    const cat = {},
      po = {};
    IV_CATS.forEach((c) => (cat[c.id] = 0));
    IV_PO.forEach((p) => (po[p.id] = 0));
    IV_OUTLETS.forEach((o) => {
      cat[o.kategori]++;
      if (o.supervisingPOId) po[o.supervisingPOId]++;
    });
    const empty = IV_DISTRICTS.filter(
      (d) => !IV_OUTLETS.some((o) => o.districtId === d.districtId),
    ).map((d) => d.name);
    return { cat, po, empty, total: IV_OUTLETS.length };
  }

  /* ===== Harga: ivPrice ===== */
  const IV_REK = new Map();
  DATA.rekod.forEach((r) =>
    IV_REK.set(r.poId + '|' + r.daerah + '|' + slug(r.komoditi) + '|' + r.peringkat, r),
  );
  const IV_PRICE_OVERLAY = [
    {
      id: 'T1',
      poId: 'simpangrenggam',
      district: 'Kluang',
      commodityId: 'cili-merah',
      stage: 'Ladang',
      dev: -17.5,
      devF: -19,
      note: 'Senario ujian 1 (dummy)',
    },
    ...['Kinta', 'Kampar', 'Kuala Kangsar', 'Manjung'].map((d) => ({
      id: 'T1b',
      poId: 'perak',
      district: d,
      commodityId: 'cili-merah',
      stage: 'Borong',
      dev: 6,
      devF: 6,
      note: 'Senario ujian 1b (dummy)',
    })),
    {
      id: 'T2',
      poId: 'johor',
      district: 'Johor Bahru',
      commodityId: 'cili-merah',
      stage: 'Runcit',
      dev: 16,
      devF: 18,
      note: 'Senario ujian 2 (dummy)',
    },
    {
      id: 'T3',
      poId: 'kelantan',
      district: 'Pasir Mas',
      commodityId: 'bawang-merah-kecil',
      stage: 'Runcit',
      dev: 17,
      devF: 19,
      note: 'Senario ujian 3 (dummy)',
    },
    {
      id: 'T4',
      poId: 'perlis',
      district: 'Kangar',
      commodityId: 'cili-merah',
      stage: 'Ladang',
      dev: -16,
      devF: -16,
      note: 'Senario ujian 4 (dummy)',
    },
    {
      id: 'T5',
      poId: 'sarawak',
      district: 'Serian',
      commodityId: 'kubis-bulat',
      stage: 'Ladang',
      dev: -18,
      devF: -18,
      note: 'Senario ujian 5 (dummy)',
    },
    {
      id: 'T6',
      poId: 'pahang',
      district: 'Temerloh',
      commodityId: 'cili-hijau',
      stage: 'Ladang',
      dev: -10,
      devF: -10,
      note: 'Senario ujian 6 (dummy)',
    },
    {
      id: 'T6',
      poId: 'sabah',
      district: 'Tuaran',
      commodityId: 'tomato-bulat',
      stage: 'Ladang',
      dev: -9,
      devF: -9,
      note: 'Senario ujian 6 (dummy)',
    },
    {
      id: 'T7',
      poId: 'pahang',
      district: 'Kuantan',
      commodityId: 'tomato-bulat',
      stage: 'Runcit',
      dev: 18,
      devF: 18,
      note: 'Senario ujian 7 (dummy)',
    },
    {
      id: 'T8',
      poId: 'selangor',
      district: 'Sepang',
      commodityId: 'cili-hijau',
      stage: 'Runcit',
      dev: 9,
      devF: 9,
      note: 'Senario ujian 8 (dummy)',
    },
    {
      id: 'T8',
      poId: 'sarawak',
      district: 'Kuching',
      commodityId: 'ayam-proses-super',
      stage: 'Runcit',
      dev: 10,
      devF: 10,
      note: 'Senario ujian 8 (dummy)',
    },
  ];
  const IV_OVBY = new Map(
    IV_PRICE_OVERLAY.map((o) => [
      o.poId + '|' + o.district + '|' + o.commodityId + '|' + o.stage,
      o,
    ]),
  );
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  function recPrice(r, days) {
    const cid = slug(r.komoditi);
    const th = IV_CONFIG.thresholds;
    const arr = r.prices.slice(-Math.max(1, Math.min(days, r.prices.length)));
    const baseline = mean(arr);
    let actual = r.prices[r.prices.length - 1],
      forecast = r.ramalan,
      overlay = null;
    const ov = IV_OVBY.get(r.poId + '|' + r.daerah + '|' + cid + '|' + r.peringkat);
    if (ov) {
      actual = baseline * (1 + ov.dev / 100);
      forecast = baseline * (1 + ov.devF / 100);
      overlay = { id: ov.id, note: ov.note };
    }
    return {
      actual,
      forecast,
      baseline,
      devPct: ((actual - baseline) / baseline) * 100,
      forecastDevPct: ((forecast - baseline) / baseline) * 100,
      thresholdLow: baseline * (1 + th.pengeluar.warnPct / 100),
      thresholdHigh: baseline * (1 + th.pengguna.warnPct / 100),
      floor: r.hargaLantai,
      ceiling: r.hargaSiling,
      unit: r.unit,
      priceLevel: r.peringkat,
      grade: null,
      gradeNote: 'gred tidak tersedia dalam data sedia ada',
      windowDays: days,
      overlay,
      source: 'dummy',
      origin: 'DATA.rekod',
    };
  }
  function ivPrice(poId, commodityId, stage, days) {
    days = days || ivState.selectedDateRange.days;
    const p = IV_POBY[poId];
    if (!p) return null;
    const ps = p.districts
      .map((d) => IV_REK.get(poId + '|' + d[0] + '|' + commodityId + '|' + stage))
      .filter(Boolean)
      .map((r) => recPrice(r, days));
    if (!ps.length) return null;
    const m = (k) => mean(ps.map((x) => x[k]));
    return {
      actual: m('actual'),
      forecast: m('forecast'),
      baseline: m('baseline'),
      devPct: m('devPct'),
      forecastDevPct: m('forecastDevPct'),
      floor: m('floor'),
      ceiling: m('ceiling'),
      unit: ps[0].unit,
      priceLevel: stage,
      grade: null,
      gradeNote: ps[0].gradeNote,
      overlay: ps.find((x) => x.overlay) ? ps.find((x) => x.overlay).overlay : null,
      windowDays: days,
      source: 'dummy',
      origin: 'DATA.rekod',
    };
  }

  /* ===== Bekalan (dummy) ===== */
  const IV_UPD = '2026-11-15T06:00:00+08:00';
  function mkSupply(poId, cid, avail, res, req, upd, tag) {
    const net = +(avail - res).toFixed(6);
    return {
      poId,
      commodityId: cid,
      availableStockMT: avail,
      reservedMT: res,
      requiredMT: req,
      net,
      surplusMT: +Math.max(0, net - req).toFixed(6),
      shortageMT: +Math.max(0, req - net).toFixed(6),
      coverage: req > 0 ? net / req : null,
      lastUpdated: upd || IV_UPD,
      scenario: tag || null,
      source: 'dummy',
      origin: 'iv',
    };
  }
  const IV_SUPPLY_OVERRIDE = (function () {
    const o = {};
    const add = (po, c, a, r, q, upd, t) => (o[po + '|' + c] = mkSupply(po, c, a, r, q, upd, t));
    add('simpangrenggam', 'cili-merah', 18, 1, 5, null, 'T1');
    add('johor', 'cili-merah', 2, 0, 8, null, 'T1b/T2');
    add('selangor', 'cili-merah', 2, 0, 7, null, 'T1b');
    add('perak', 'cili-merah', 3, 0, 7, null, 'T1b');
    add('sabah', 'cili-merah', 2, 0, 8, null, 'T1b');
    add('melaka', 'cili-merah', 16, 0, 6, null, 'T2s');
    add('negerisembilan', 'cili-merah', 11, 0, 6, null, 'T2s');
    add('selayang', 'cili-merah', 12, 0, 6, null, 'T2s');
    add('pahang', 'cili-merah', 14, 0, 6, null, 'T2s');
    add('kelantan', 'cili-merah', 15, 0, 6, null, 'T2s');
    add('sarawak', 'cili-merah', 14, 0, 6, null, 'T2s');
    add('perlis', 'cili-merah', 6, 0, 5.5, null, 'T4');
    add('kedah', 'cili-merah', 8, 0, 8);
    add('penang', 'cili-merah', 8, 0, 8);
    add('terengganu', 'cili-merah', 8, 0, 8);
    add('kelantan', 'bawang-merah-kecil', 3, 0, 9, null, 'T3');
    add('perak', 'bawang-merah-kecil', 14, 0, 6, null, 'T3');
    add('pahang', 'bawang-merah-kecil', 12, 0, 6, null, 'T3');
    add('terengganu', 'bawang-merah-kecil', 13, 0, 6, null, 'T3');
    add('johor', 'bawang-merah-kecil', 9, 0, 6, null, 'T3');
    add('sarawak', 'kubis-bulat', 15, 1, 5, '2026-11-10T06:00:00+08:00', 'T5');
    add('pahang', 'cili-hijau', 12, 0, 6, null, 'T6');
    add('sabah', 'tomato-bulat', 10, 0, 5, null, 'T6');
    add('pahang', 'tomato-bulat', 12, 0, 10, null, 'T7');
    add('selangor', 'cili-hijau', 7, 0, 10, '2026-11-11T06:00:00+08:00', 'T8');
    add('sarawak', 'ayam-proses-super', 7, 0, 10, '2026-11-11T06:00:00+08:00', 'T8');
    return o;
  })();
  const IV_SUPPLY = (function () {
    const rows = {};
    IV_PO.forEach((p) =>
      IV_COMM.forEach((c) => {
        if (c.unit !== 'RM/kg') return;
        const k = p.id + '|' + c.id;
        if (IV_SUPPLY_OVERRIDE[k]) {
          rows[k] = IV_SUPPLY_OVERRIDE[k];
          return;
        }
        const r = mulberry32(hash32(k));
        const a = r();
        const arche = a < 0.35 ? 'surplus' : a < 0.75 ? 'balanced' : 'shortage';
        const req = 3 + Math.round(r() * 90) / 10;
        const res = Math.round(r() * 20) / 10;
        let avail;
        if (arche === 'surplus') avail = req + res + 3 + r() * 8;
        else if (arche === 'balanced') avail = req + res + (r() - 0.5);
        else avail = Math.max(1, req * (0.3 + r() * 0.45) + res);
        avail = Math.min(20, Math.max(4, Math.round(avail * 10) / 10));
        rows[k] = mkSupply(p.id, c.id, avail, res, req);
      }),
    );
    return rows;
  })();
  const supplyRow = (poId, cid) => IV_SUPPLY[poId + '|' + cid] || null;

  /* ===== Logistik ===== */
  const IV_LOGISTICS_AVAIL = {
    johor_simpang: { availableVehicleCount: 5, availableCapacityMT: 62.0, actualStockMT: 92.4 },
    ayerkeroh: { availableVehicleCount: 6, availableCapacityMT: 28.0, actualStockMT: 6.6 },
    kotabaharu: { availableVehicleCount: 1, availableCapacityMT: 1.5, actualStockMT: 8.6 },
  };
  function logisticsOf(poId) {
    const p = IV_POBY[poId];
    if (!p) return null;
    const l = p.logistik;
    const a = IV_LOGISTICS_AVAIL[p.group] || null;
    const members = IV_PO.filter((x) => x.group === p.group).map((x) => x.id);
    return {
      poId,
      logisticsCapacityGroupId: p.group,
      kenderaanMax: l.kenderaan,
      muatanMaxMT: l.muatanMT,
      bilikSejukMax: l.bilikSejuk,
      simpananMaxMT: l.kapasitiSimpananMT,
      groupShared: members.length > 1,
      groupMemberPOIds: members,
      availableVehicleCount: a ? a.availableVehicleCount : null,
      availableCapacityMT: a ? a.availableCapacityMT : null,
      actualStockMT: a ? a.actualStockMT : null,
      availabilityUpdated: a ? IV_UPD : null,
      source: 'sebenar',
      availSource: 'dummy',
    };
  }
  function readiness(lg) {
    const parts = [];
    if (lg.availableVehicleCount != null && lg.kenderaanMax > 0)
      parts.push(lg.availableVehicleCount / lg.kenderaanMax);
    if (lg.availableCapacityMT != null && lg.simpananMaxMT > 0)
      parts.push(lg.availableCapacityMT / lg.simpananMaxMT);
    if (!parts.length)
      return { state: 'tidak-dinilai', r: null, label: 'Kesiapsiagaan tidak dapat dinilai' };
    const r = mean(parts);
    return r >= 0.6
      ? { state: 'sedia', r, label: 'Sedia' }
      : r >= 0.3
        ? { state: 'terhad', r, label: 'Terhad' }
        : { state: 'kritikal', r, label: 'Kritikal' };
  }

  /* ===== Pengiraan tahap, bekalan dan skor ===== */
  function supplyConfirm(mode, row, now) {
    now = now == null ? nowMs() : now;
    const cfg = IV_CONFIG.supply;
    if (!row || row.availableStockMT == null || row.requiredMT == null)
      return { state: 'tiada', reason: 'Tiada data bekalan' };
    if ((now - Date.parse(row.lastUpdated)) / 36e5 > cfg.staleHours)
      return { state: 'lapuk', reason: 'Data stok lapuk' };
    if (mode === 'pengeluar') {
      if (row.surplusMT >= Math.max(cfg.minSurplusMT, cfg.minSurplusRatio * row.net))
        return { state: 'disahkan', reason: 'Lebihan bekalan dikesan' };
    } else if (
      row.coverage !== null &&
      row.coverage < cfg.shortageCoverage &&
      row.shortageMT >= cfg.minSurplusMT
    )
      return { state: 'disahkan', reason: 'Kekurangan bekalan dikesan' };
    return { state: 'tidak-disahkan', reason: 'Menunggu pengesahan bekalan' };
  }
  function ivClassify(mode, price, row) {
    const th = IV_CONFIG.thresholds[mode];
    const crit = Math.abs(th.critPct),
      warn = Math.abs(th.warnPct);
    const harm = mode === 'pengeluar' ? -price.devPct : price.devPct,
      harmF = mode === 'pengeluar' ? -price.forecastDevPct : price.forecastDevPct;
    const floorHit =
      mode === 'pengeluar'
        ? fin(price.floor) && price.actual <= price.floor
        : fin(price.ceiling) && price.actual >= price.ceiling;
    let pl = 'normal';
    if (harm >= crit || floorHit) pl = 'kritikal';
    else if (harm >= warn || harmF >= warn) pl = 'waspada';
    const sc = supplyConfirm(mode, row);
    let level,
      flag = null,
      early = false;
    if (pl === 'kritikal') {
      if (sc.state === 'disahkan') level = 'kritikal';
      else {
        level = 'waspada';
        flag = sc.state === 'tidak-disahkan' ? 'Menunggu pengesahan bekalan' : sc.reason;
      }
    } else if (pl === 'waspada') level = 'waspada';
    else {
      level = 'normal';
      early = sc.state === 'disahkan';
    }
    return { priceLevel: pl, level, flag, earlySignal: early, supply: sc, harm, harmF };
  }
  function priorityScore(mode, price, row, cls) {
    const crit = Math.abs(IV_CONFIG.thresholds[mode].critPct);
    const P = clamp(cls.harm / (2 * crit), 0, 1),
      F = clamp(cls.harmF / (2 * crit), 0, 1);
    let gap = 0;
    if (row)
      gap =
        mode === 'pengeluar'
          ? row.surplusMT / Math.max(row.net, 1)
          : row.shortageMT / Math.max(row.requiredMT, 1);
    const S = clamp(gap, 0, 1);
    const C = cls.supply.state === 'disahkan' ? 1 : cls.supply.state === 'lapuk' ? 0.5 : 0;
    return { score: Math.round(100 * (0.45 * P + 0.35 * S + 0.1 * F + 0.1 * C)), P, S, F, C };
  }
  const LV_W = { normal: 0, waspada: 1, kritikal: 2 };
  const LV_LABEL = { normal: 'Normal', waspada: 'Waspada', kritikal: 'Kritikal' };
  const MODE_STAGE = { pengeluar: 'Ladang', pengguna: 'Runcit' };
  const _recCache = {};
  function computeRecs(mode, days) {
    const key = mode + '|' + days + '|' + JSON.stringify(IV_CONFIG.thresholds) + '|' + refNow;
    if (_recCache[key]) return _recCache[key];
    const stage = MODE_STAGE[mode];
    const out = [];
    DATA.rekod.forEach((r) => {
      if (r.peringkat !== stage) return;
      const cid = slug(r.komoditi);
      const price = recPrice(r, days);
      const row = isKg(cid) ? supplyRow(r.poId, cid) : null;
      const cls = ivClassify(mode, price, row);
      const sc = priorityScore(mode, price, row, cls);
      const po = IV_POBY[r.poId];
      out.push({
        id: `${mode}:${r.poId}:${po.stateId}/${slug(r.daerah)}:${cid}`,
        mode,
        poId: r.poId,
        poName: po.name,
        stateId: po.stateId,
        negeri: po.negeri,
        district: r.daerah,
        districtId: po.stateId + '/' + slug(r.daerah),
        commodityId: cid,
        commodity: r.komoditi,
        price,
        row,
        cls,
        score: sc.score,
        comp: sc,
        legacyStatus: r.status,
      });
    });
    Object.keys(_recCache).forEach((k) => delete _recCache[k]);
    _recCache[key] = out;
    return out;
  }
  const worst = (a, b) => (LV_W[a] >= LV_W[b] ? a : b);

  /* ===== Cuaca/banjir ===== */
  function ivScenarios() {
    return typeof SCEN_LIST !== 'undefined' && Array.isArray(SCEN_LIST) ? SCEN_LIST : [];
  }
  function hav(lat1, lon1, lat2, lon2) {
    const R = 6371,
      r = Math.PI / 180;
    const dl = (lat2 - lat1) * r,
      dn = (lon2 - lon1) * r;
    const a =
      Math.sin(dl / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function disruptionLevel(poId, now) {
    now = now == null ? nowMs() : now;
    const p = IV_POBY[poId];
    let best = null;
    const rank = { Amaran: 2, Waspada: 1 };
    (DATA.banjir || []).forEach((f) => {
      if (hav(p.lat, p.lon, f.lat, f.lon) <= 30) {
        const lv = f.level;
        if (!best || rank[lv] > rank[best.level])
          best = {
            level: lv,
            source: `${lv === 'Amaran' ? 'Amaran' : 'Waspada'} banjir (DATA.banjir)`,
          };
      }
    });
    ivScenarios().forEach((s) => {
      if (s.warningType !== 'amaran_banjir' || !(s.affectedPOIds || []).includes(poId)) return;
      if (!(Date.parse(s.validFrom) <= now && now <= Date.parse(s.validUntil))) return;
      const lv =
        s.riskLevel === 'tinggi' ? 'Amaran' : s.riskLevel === 'sederhana' ? 'Waspada' : null;
      if (!lv) return;
      if (
        !best ||
        rank[lv] > rank[best.level] ||
        (rank[lv] === rank[best.level] && best.source.includes('DATA.banjir'))
      )
        best = { level: lv, source: `${lv} banjir AMS ${s.scenarioId}` };
    });
    return best;
  }
  const disruptionLabel = (d) =>
    d
      ? (d.level === 'Amaran' ? 'Amaran banjir' : 'Waspada banjir') +
        (d.source.includes('AMS') ? ' AMS ' + d.source.split('AMS ')[1] : ' (DATA.banjir)')
      : '';

  /* ===== Enjin mobilisasi (tulen) ===== */
  function mobilisationEngine(inp) {
    const { mode, anchorPOId, commodityId } = inp;
    const out = {
      dalam: [],
      luar: [],
      excluded: [],
      trigger: { ok: false, reason: null },
      inputsEcho: { ...inp },
    };
    const anchor = IV_POBY[anchorPOId];
    if (!anchor || !isKg(commodityId)) {
      out.trigger.reason = 'tiada';
      return out;
    }
    const aRow = supplyRow(anchorPOId, commodityId);
    const sc = supplyConfirm(mode, aRow, inp.now);
    if (sc.state !== 'disahkan') {
      out.trigger = { ok: false, reason: sc.state, text: sc.reason };
      return out;
    }
    out.trigger = { ok: true, reason: 'disahkan', text: sc.reason };
    const wP = clamp(inp.wPrice, 0, 100) / 100,
      wD = 1 - wP;
    const need = inp.needMT;
    const refPrice = inp.refPrice;
    const el = [];
    IV_PO.forEach((c) => {
      const ex = (r) => out.excluded.push({ poId: c.id, name: c.name, reason: r });
      if (c.id === anchorPOId) return ex('PO terpilih sendiri');
      const row = supplyRow(c.id, commodityId);
      const pr = ivPrice(c.id, commodityId, 'Borong', inp.days);
      if (!row || !pr) return ex('Data tidak lengkap');
      const stock = mode === 'pengguna' ? row.surplusMT : row.shortageMT;
      if (!(stock > 0))
        return ex(
          mode === 'pengguna'
            ? 'Tiada lebihan stok'
            : 'Tiada permintaan tambahan (tiada kekurangan)',
        );
      if (
        c.zone !== anchor.zone &&
        !IV_CONFIG.crossZoneRules.some(
          (r) => r.approved && r.from === anchor.zone && r.to === c.zone,
        )
      )
        return ex(`Zon berbeza (${c.zone} lawan ${anchor.zone})`);
      const km = hav(anchor.lat, anchor.lon, c.lat, c.lon) * IV_CONFIG.detour;
      if (km > inp.distLimitKm)
        return ex(`Jarak ${Math.round(km)} km melebihi had ${inp.distLimitKm} km`);
      const dis = disruptionLevel(c.id, inp.now);
      if (dis && dis.level === 'Amaran') return ex(dis.source);
      const adv = mode === 'pengguna' ? refPrice - pr.actual : pr.actual - refPrice;
      if (!(adv > 0)) return ex('Harga tidak lebih baik daripada harga rujukan');
      const lg = logisticsOf(c.id);
      let qty = Math.min(need, stock),
        cap = null;
      if (lg.availableVehicleCount != null) {
        cap = (lg.availableVehicleCount * lg.muatanMaxMT) / lg.kenderaanMax;
        qty = Math.min(qty, cap);
      }
      el.push({
        poId: c.id,
        name: c.name,
        negeri: c.negeri,
        zone: c.zone,
        sameState: c.negeri === anchor.negeri,
        stockMT: stock,
        price: pr.actual,
        km,
        priceAdv: adv,
        qty,
        vehicleCapMT: cap,
        vehicleKnown: lg.availableVehicleCount != null,
        maxCapMT: lg.muatanMaxMT,
        sameGroup: c.group === anchor.group,
        flood: dis && dis.level === 'Waspada' ? dis : null,
        overlay: pr.overlay,
      });
    });
    const rank = (list) => {
      const mx = Math.max(...list.map((x) => x.priceAdv), 1e-9);
      list.forEach((x) => {
        const ps = x.priceAdv / mx,
          ds = clamp(1 - x.km / inp.distLimitKm, 0, 1);
        x.priceScore = ps;
        x.distScore = ds;
        x.score = Math.max(0, Math.round(100 * (wP * ps + wD * ds)) - (x.flood ? 5 : 0));
      });
      list.sort(
        (a, b) => b.score - a.score || b.qty - a.qty || a.km - b.km || a.name.localeCompare(b.name),
      );
      list.slice(0, 5).forEach((x, i) => (x.rank = i + 1));
      return list.slice(0, 5);
    };
    out.dalam = rank(el.filter((x) => x.sameState));
    out.luar = rank(el.filter((x) => !x.sameState));
    return out;
  }

  /* ===== Margin ===== */
  const marginPct = (S, F, C) => (S > 0 ? ((S - F - C) / S) * 100 : NaN);
  const maxFarmPrice = (S, C, t) => S * (1 - t / 100) - C;
  const minSell = (F, C, t) => (1 - t / 100 > 0 ? (F + C) / (1 - t / 100) : NaN);
  function historyStats(h) {
    const sp = h.map((x) => x.jual - x.beli),
      n = sp.length;
    if (!n) return null;
    const m = mean(sp),
      s = [...sp].sort((a, b) => a - b),
      med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const sd = Math.sqrt(mean(sp.map((x) => (x - m) ** 2)));
    const xm = (n - 1) / 2;
    let num = 0,
      den = 0;
    sp.forEach((y, i) => {
      num += (i - xm) * (y - m);
      den += (i - xm) ** 2;
    });
    const slope = den ? num / den : 0;
    return {
      n,
      mean: m,
      median: med,
      sd,
      slope,
      trend: Math.abs(slope) < 0.01 ? 'stabil' : slope > 0 ? 'naik' : 'turun',
    };
  }
  const IV_OPCOST = Object.fromEntries(
    IV_PO.map((p) => [p.id, +(0.35 + (hash32('kos' + p.id) % 26) / 100).toFixed(2)]),
  );
  IV_OPCOST.simpangrenggam = 0.45;
  const IV_HISTORY_OVERRIDE = {
    'simpangrenggam|cili-merah': [1.1, 1.2, 1.3, 1.2, 1.1, 1.2, 1.3, 1.2, 1.1, 1.2, 1.3, 1.2].map(
      (s, i) => ({
        week: addDays('2026-11-15', -7 * (11 - i)),
        beli: 12.5,
        jual: +(12.5 + s).toFixed(2),
      }),
    ),
    'penang|kubis-bulat': [0, 1, 2, 3].map((i) => ({
      week: addDays('2026-11-15', -7 * (3 - i)),
      beli: 4.1 + i * 0.02,
      jual: +(4.55 + i * 0.01).toFixed(2),
    })),
  };
  const IV_MARGIN_DEFAULT_OVERRIDE = { 'simpangrenggam|cili-merah': { ladang: 9.8 } };
  function historyOf(poId, cid) {
    const k = poId + '|' + cid;
    if (IV_HISTORY_OVERRIDE[k]) return IV_HISTORY_OVERRIDE[k];
    const pr = ivPrice(poId, cid, 'Borong', 30);
    if (!pr) return [];
    const r = mulberry32(hash32('h' + k));
    const out = [];
    for (let i = 0; i < 12; i++) {
      const jual = pr.baseline * (1 + (r() - 0.5) * 0.08);
      const sp = 0.06 + r() * 0.06;
      out.push({
        week: addDays('2026-11-15', -7 * (11 - i)),
        beli: +(jual * (1 - sp)).toFixed(2),
        jual: +jual.toFixed(2),
      });
    }
    return out;
  }
  function marginDefaults(poId, cid) {
    const h = historyOf(poId, cid),
      last = h[h.length - 1] || null;
    const lad = ivPrice(poId, cid, 'Ladang', 30);
    const ov = IV_MARGIN_DEFAULT_OVERRIDE[poId + '|' + cid];
    return {
      jual: last ? last.jual : null,
      beli: last ? last.beli : null,
      ladang: ov ? ov.ladang : lad ? +lad.actual.toFixed(2) : null,
      kos: IV_OPCOST[poId],
      target: 15,
      override: !!ov,
    };
  }
  function validateMargin(m) {
    const err = {};
    const val = {};
    const pf = (k, lbl, allowZero) => {
      const raw = String(m[k]).trim();
      const v = Number(raw);
      if (raw === '' || !Number.isFinite(v)) {
        err[k] = `${lbl} mesti nombor`;
        return;
      }
      if (allowZero ? v < 0 || v > 999 : v <= 0 || v > 999) {
        err[k] = allowZero
          ? `${lbl} mesti antara 0 dan 999`
          : `${lbl} mesti lebih daripada 0 dan tidak melebihi 999`;
        return;
      }
      val[k] = v;
    };
    pf('beli', 'Harga Borong Beli');
    pf('jual', 'Harga Borong Jual');
    pf('ladang', 'Harga Belian Ladang');
    pf('kos', 'Kos Operasi', true);
    const traw = String(m.target).trim(),
      t = Number(traw);
    if (traw === '' || !Number.isFinite(t)) err.target = 'Margin sasaran mesti nombor';
    else if (t < 0) err.target = 'Margin sasaran tidak boleh negatif';
    else if (t >= 100) err.target = 'Margin sasaran mesti kurang daripada 100%';
    else if (t > 95) err.target = 'Margin sasaran maksimum 95%';
    else val.target = t;
    return { ok: !Object.keys(err).length, err, val };
  }
  function simulateMargin(v, hist, ctx) {
    const S = v.beli,
      F = v.ladang,
      C = v.kos,
      t = v.target,
      J = v.jual;
    const cur = marginPct(S, F, C),
      spread = J - S,
      maxF = maxFarmPrice(S, C, t),
      minS = minSell(F, C, t);
    const hs = historyStats(hist);
    const enough = hist.length >= IV_CONFIG.minHistory;
    const farmLow = Math.max(0, ctx.farmFloor || 0);
    const farmOk = fin(maxF) && maxF > 0 && maxF >= farmLow;
    let mLow = NaN,
      mHigh = NaN,
      recLow = NaN,
      recHigh = NaN,
      sellOk = false;
    if (hs && enough) {
      mLow = Math.max(0, J - (hs.median + hs.sd));
      mHigh = Math.max(0, J - Math.max(0, hs.median - hs.sd));
      recLow = Math.max(minS, mLow);
      recHigh = mHigh;
      sellOk = fin(minS) && minS > 0 && minS <= mHigh && recLow <= recHigh;
    }
    return {
      S,
      F,
      C,
      t,
      J,
      cur,
      spread,
      maxF,
      minS,
      farmLow,
      farmOk,
      hs,
      enough,
      mLow,
      mHigh,
      recLow,
      recHigh,
      sellOk,
      impact: t - cur,
      marginAtLow: marginPct(recLow, F, C),
      marginAtHigh: marginPct(recHigh, F, C),
      buyAboveSell: S > J,
    };
  }

  /* ===== AI Muse (data dummy mentah + penyarian) ===== */
  const IV_MUSE_RAW = [
    {
      rawId: 'M01',
      recordDate: '2026-11-11',
      analystNote:
        'Kelapa tua (Matag): pada 4 November 2026 seramai 69 pekebun kelapa Matag terjejas di Dungun, Terengganu akibat tekanan harga daripada kelapa import.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.42,
      sampleCount: 69,
      riskBefore: 4,
      riskCurrent: 16,
      riskForward: 18,
    },
    {
      rawId: 'M02',
      recordDate: '2026-11-12',
      analystNote:
        'Harga ladang cili merah jatuh di Kluang, Johor pada 12 November 2026 akibat lebihan bekalan; peladang sukar memasarkan hasil.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.55,
      sampleCount: 42,
      riskBefore: 12,
      riskCurrent: 38,
      riskForward: 44,
    },
    {
      rawId: 'M03',
      recordDate: '2026-11-13',
      analystNote:
        'Harga runcit bawang merah kecil naik di Pasir Mas, Kelantan pada 13 November 2026; bekalan terhad selepas gangguan banjir.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.48,
      sampleCount: 35,
      riskBefore: 15,
      riskCurrent: 41,
      riskForward: 46,
    },
    {
      rawId: 'M04',
      recordDate: '2026-11-11',
      analystNote:
        'Cuaca buruk menjejaskan hasil tomato bulat di Cameron Highlands, Pahang pada 10 November 2026.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.3,
      sampleCount: 21,
      riskBefore: 8,
      riskCurrent: 24,
      riskForward: 27,
    },
    {
      rawId: 'M05',
      recordDate: '2026-11-13',
      analystNote:
        'Dipercayai harga ladang cili merah masih jatuh di Kluang pada 12 November 2026 kerana lebihan bekalan.',
      sourceName: 'Laporan kedua (dummy)',
      sentimentIndex: -0.5,
      sampleCount: 18,
      riskBefore: 12,
      riskCurrent: 36,
      riskForward: 40,
    },
    {
      rawId: 'M06',
      recordDate: '2026-11-12',
      analystNote:
        'Harga kubis bulat jatuh di Serian, Sarawak; berbanding pada 3 Mac 2025 harga jatuh dengan teruk.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.2,
      sampleCount: 12,
      riskBefore: 6,
      riskCurrent: 14,
      riskForward: 15,
    },
    {
      rawId: 'M07',
      recordDate: '2026-11-12',
      analystNote:
        'Harga ayam proses super dilaporkan naik di sebuah pasar di utara pada 12 November 2026.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.25,
      sampleCount: 9,
      riskBefore: 5,
      riskCurrent: 18,
      riskForward: 19,
    },
    {
      rawId: 'M08',
      recordDate: '2026-11-12',
      analystNote:
        'Latihan kakitangan mengenai pengendalian telur gred A diadakan di Kangar pada 11 November 2026.',
      sourceName: 'Nota dalaman (dummy)',
      sentimentIndex: 0.1,
      sampleCount: 0,
      riskBefore: 2,
      riskCurrent: 2,
      riskForward: 2,
    },
    {
      rawId: 'M09',
      recordDate: '2026-11-06',
      analystNote:
        'Hasil cili hijau merosot di Temerloh, Pahang pada 5 November 2026 akibat hujan lebat.',
      sourceName: 'Nota penganalisis FAMA (dummy)',
      sentimentIndex: -0.35,
      sampleCount: 27,
      riskBefore: 10,
      riskCurrent: 30,
      riskForward: 33,
    },
  ];
  const IV_COMM_ALIAS = [
    ['kelapa matag', null, 'Kelapa Tua (Matag)'],
    ['kelapa tua', null, 'Kelapa Tua (Matag)'],
    ['kelapa', null, 'Kelapa Tua (Matag)'],
    ['cili merah', 'cili-merah', 'Cili Merah'],
    ['cili hijau', 'cili-hijau', 'Cili Hijau'],
    ['tomato bulat', 'tomato-bulat', 'Tomato Bulat'],
    ['tomato', 'tomato-bulat', 'Tomato Bulat'],
    ['bawang merah kecil', 'bawang-merah-kecil', 'Bawang Merah Kecil'],
    ['bawang merah', 'bawang-merah-kecil', 'Bawang Merah Kecil'],
    ['ayam proses super', 'ayam-proses-super', 'Ayam Proses Super'],
    ['ayam', 'ayam-proses-super', 'Ayam Proses Super'],
    ['kubis bulat', 'kubis-bulat', 'Kubis Bulat'],
    ['kubis', 'kubis-bulat', 'Kubis Bulat'],
    ['telur gred a', 'telur-gred-a', 'Telur Gred A'],
    ['telur', 'telur-gred-a', 'Telur Gred A'],
  ];
  const MUSE_ISSUE_RE =
    /harga|bekalan|lebihan|hasil|pengeluaran|pemasaran|memasarkan|kekurangan|terjejas|menjejaskan/i;
  const MUSE_RECALL_RE = /tahun lepas|berbanding|sebelum ini|lalu|pada tahun/i;
  function validateMuseRaw(rows) {
    const ok = [];
    let dropped = 0;
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (
        r &&
        typeof r.rawId === 'string' &&
        typeof r.analystNote === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.recordDate || '')
      )
        ok.push(r);
      else dropped++;
    });
    return { ok, dropped };
  }
  function extractMuseIssue(raw) {
    const note = raw.analystNote,
      low = note.toLowerCase();
    let com = null;
    for (const [a, id, lbl] of IV_COMM_ALIAS) {
      if (low.includes(a)) {
        com = { id, label: lbl };
        break;
      }
    }
    const sentences = note.split(/(?<=[.;:])\s+/);
    const csent = com
      ? sentences.find((s) =>
          s
            .toLowerCase()
            .includes(IV_COMM_ALIAS.find((a) => a[2] === com.label && low.includes(a[0]))[0]),
        ) || note
      : note;
    const dates = [];
    let m;
    const re1 =
      /(\d{1,2})\s+(januari|februari|mac|april|mei|jun|julai|ogos|september|oktober|november|disember)(?:\s+(\d{4}))?/gi;
    while ((m = re1.exec(note))) {
      const y = m[3] ? +m[3] : +raw.recordDate.slice(0, 4);
      dates.push({
        ds: `${y}-${String(MY_MON_IDX[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`,
        off: m.index,
      });
    }
    const re2 = /(\d{2})\/(\d{2})\/(\d{4})/g;
    while ((m = re2.exec(note))) dates.push({ ds: `${m[3]}-${m[2]}-${m[1]}`, off: m.index });
    const re3 = /(\d{4})-(\d{2})-(\d{2})/g;
    while ((m = re3.exec(note))) dates.push({ ds: m[0], off: m.index });
    const ry = +raw.recordDate.slice(0, 4);
    const keep = dates.filter((d) => {
      const pre = note.slice(Math.max(0, d.off - 40), d.off);
      return !(MUSE_RECALL_RE.test(pre) || +d.ds.slice(0, 4) < ry);
    });
    const cOff = note.indexOf(csent),
      cEnd = cOff + csent.length;
    const dist = (d) =>
      d.off >= cOff && d.off <= cEnd ? 0 : Math.min(Math.abs(d.off - cOff), Math.abs(d.off - cEnd));
    keep.sort((a, b) => dist(a) - dist(b) || (a.ds < b.ds ? -1 : 1));
    let eventDate = keep.length ? keep[0].ds : null;
    if (!eventDate) {
      if (/kelmarin/i.test(note)) eventDate = addDays(raw.recordDate, -2);
      else if (/semalam/i.test(note)) eventDate = addDays(raw.recordDate, -1);
      else if (/hari ini|baru-baru ini/i.test(note)) eventDate = raw.recordDate;
    }
    let loc = null;
    const mapped = IV_DISTRICTS.find((d) => new RegExp('\\b' + d.name + '\\b', 'i').test(note));
    if (mapped)
      loc = {
        name: mapped.name,
        stateId: mapped.stateId,
        negeri: mapped.negeri,
        districtId: mapped.districtId,
        mapped: true,
      };
    else {
      const g = IV_GAZETTEER.find((x) => new RegExp('\\b' + x.name + '\\b', 'i').test(note));
      if (g)
        loc = {
          name: g.name,
          stateId: g.stateId,
          negeri: g.negeri,
          districtId: g.stateId + '/' + slug(g.name),
          mapped: false,
        };
    }
    let ltype = 'belum',
      conf = 0;
    if (loc) {
      const pre = note.slice(
        Math.max(0, note.search(new RegExp('\\b' + loc.name + '\\b', 'i')) - 18),
        note.search(new RegExp('\\b' + loc.name + '\\b', 'i')),
      );
      if (/(dilaporkan dari|berbanding|\bdari)\s*$/i.test(pre)) ltype = 'disebut';
      else if (/\bdi\s*$/i.test(pre)) {
        ltype = 'disahkan';
      } else ltype = 'disebut';
      conf = ltype === 'disahkan' ? (/dipercayai|mungkin|dikatakan/i.test(note) ? 0.8 : 0.9) : 0.5;
    }
    const issue = MUSE_ISSUE_RE.test(note);
    const band =
      raw.riskCurrent >= IV_CONFIG.museBands.merah
        ? 'merah'
        : raw.riskCurrent >= IV_CONFIG.museBands.kuning
          ? 'kuning'
          : 'hijau';
    const po = loc && loc.mapped ? IV_DISTBY[loc.districtId].poId : null;
    const supplyKw = /bekalan|lebihan|kekurangan/i.test(note);
    return {
      insightId: raw.rawId,
      commodityId: com ? com.id : null,
      commodityLabel: com ? com.label : null,
      eventDate,
      recordDate: raw.recordDate,
      location: loc
        ? { label: `${loc.name}, ${loc.negeri}`, type: ltype }
        : { label: 'Tidak dikenal pasti', type: 'belum' },
      districtName: loc ? loc.name : null,
      stateId: loc ? loc.stateId : null,
      negeri: loc ? loc.negeri : null,
      districtId: loc ? loc.districtId : null,
      matchedPOId: po,
      locationConfidence: conf,
      locationType: ltype,
      riskBefore: raw.riskBefore,
      riskCurrent: raw.riskCurrent,
      riskForward: raw.riskForward,
      riskBand: band,
      sentimentIndex: raw.sentimentIndex,
      sampleCount: raw.sampleCount,
      analystNote: note,
      sourceName: raw.sourceName,
      evidence: [{ quote: note, sourceName: raw.sourceName, date: raw.recordDate }],
      issueRelevant: issue,
      issueClass: /lebihan|jatuh|turun/i.test(note)
        ? 'lebihan-harga-turun'
        : /naik|terhad|kekurangan/i.test(note)
          ? 'bekalan-harga-naik'
          : 'hasil',
      supplyKw,
      suggestedActions:
        band === 'merah'
          ? [
              'Sahkan stok dan harga di lokasi',
              'Pertimbangkan mobilisasi bekalan melalui Mobilisasi Stok Pintar AI',
            ]
          : [
              'Pantau harga dan bekalan di lokasi',
              'Semak semula dalam kemas kini harian seterusnya',
            ],
      summary: `${com ? com.label : 'Komoditi'}: ${csent}`,
      explanation:
        'Penyarian deterministik (simulasi) daripada nota penganalisis; bukan keputusan AI sebenar.',
      source: 'dummy',
      origin: 'iv',
    };
  }
  function museInclude(ins, ws) {
    const [a, b] = weekRange(ws);
    return !!(
      ins.commodityLabel &&
      ins.locationType === 'disahkan' &&
      ins.districtId &&
      ins.eventDate &&
      ins.eventDate >= a &&
      ins.eventDate <= b &&
      ins.issueRelevant
    );
  }
  function museWeekList(all, ws) {
    const cand = all.filter((i) => museInclude(i, ws));
    const best = new Map();
    cand.forEach((i) => {
      const k = [i.commodityId || i.commodityLabel, i.districtId, i.eventDate, i.issueClass].join(
        '|',
      );
      const o = best.get(k);
      if (
        !o ||
        i.locationConfidence > o.locationConfidence ||
        (i.locationConfidence === o.locationConfidence && i.recordDate > o.recordDate)
      )
        best.set(k, i);
    });
    return [...best.values()].sort((x, y) => y.riskCurrent - x.riskCurrent);
  }

  /* ===== Keadaan ternamaruang dan dispatch ===== */
  const ivState = {
    selectedMode: 'pengeluar',
    selectedCommodityId: null,
    selectedStateId: null,
    selectedDistrictId: null,
    selectedPOId: null,
    selectedOutletId: null,
    selectedDateRange: { days: 30 },
    selectedRisk: 'all',
    selectedInterventionId: null,
    selectedSourcePOId: null,
    selectedDestinationPOId: null,
    outletCats: { 'pasar-awam': true, ptk: true, rakr: true, agrobazaar: true },
    mob: { needMT: null, refPrice: null, wPrice: 65, distLimitKm: 550, candidateKey: null },
    margin: { jual: '', beli: '', ladang: '', kos: '', target: '15', touched: false, ctx: null },
    muse: { weekStart: '2026-11-09', expandedId: null, evidenceOpen: {}, status: 'loading' },
    ui: {
      mapReady: false,
      mapError: null,
      loading: {},
      errors: {},
      scenPending: false,
      priBanner: null,
      showAll: false,
      marInsight: false,
    },
  };
  const failFlags = { ai: false, muse: false, map: false };
  let ivDrafts = [];
  const DRAFT_KEY = 'fama-iv-draf-v1';
  function loadDrafts() {
    try {
      const a = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(
        (d) =>
          d &&
          d.status === 'draf' &&
          typeof d.interventionId === 'string' &&
          typeof d.sourcePOId === 'string' &&
          typeof d.destinationPOId === 'string' &&
          fin(d.quantityMT),
      );
    } catch (_) {
      return [];
    }
  }
  function saveDrafts() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(ivDrafts));
      return true;
    } catch (err) {
      console.warn('Draf tidak dapat disimpan', err);
      return false;
    }
  }
  ivDrafts = loadDrafts();

  const thr = () => IV_CONFIG.thresholds[ivState.selectedMode];
  const modeLbl = (m) => (m === 'pengeluar' ? 'Pengeluar' : 'Pengguna');
  function effPO() {
    if (ivState.selectedPOId) return ivState.selectedPOId;
    if (ivState.selectedInterventionId) {
      const x = ivState.selectedInterventionId.split(':')[1];
      if (IV_POBY[x]) return x;
    }
    return null;
  }
  function effCommodity() {
    if (ivState.selectedCommodityId) return { id: ivState.selectedCommodityId, def: false };
    if (ivState.selectedInterventionId) {
      const x = ivState.selectedInterventionId.split(':')[3];
      if (IV_COMMBY[x]) return { id: x, def: false };
    }
    return { id: 'cili-merah', def: true };
  }
  const poName = (id) => (IV_POBY[id] ? IV_POBY[id].name : '—');
  const commName = (id) => (IV_COMMBY[id] ? IV_COMMBY[id].name : '—');

  /* ===== Penyesuai AI (simulasi, deterministik) ===== */
  const aiAdapter = (function () {
    const model = 'mock-deterministik-v1';
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    async function run(kind, fn, lat = true) {
      if (failFlags[kind]) {
        failFlags[kind] = false;
        throw new Error('Kegagalan AI disuntik (ujian)');
      }
      if (lat) await delay(200 + Math.floor(Math.random() * 200));
      return { ok: true, text: fn(), model, generatedAt: new Date().toISOString() };
    }
    return Object.freeze({
      model,
      explainMobilisation: (f) => run('ai', () => f.text),
      explainMargin: (f) => run('ai', () => f.text),
      recommendPriority: (f) => run('ai', () => f.text),
      summariseMuse: (f) => run('ai', () => f.text),
      extractMuseIssue: async (raw) => ({
        ok: true,
        data: extractMuseIssue(raw),
        model,
        generatedAt: new Date().toISOString(),
      }),
    });
  })();
  function ivValidateAi(r) {
    return !!(
      r &&
      r.ok === true &&
      typeof r.text === 'string' &&
      r.text.length >= 1 &&
      r.text.length <= 1200
    );
  }
  async function callAI(method, facts, fallback) {
    try {
      const r = await Promise.race([
        aiAdapter[method](facts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Tamat masa AI')), 4000)),
      ]);
      if (ivValidateAi(r)) return { text: r.text, ai: true };
      throw new Error('Respons AI tidak sah');
    } catch (err) {
      console.warn('Penjelasan AI tidak tersedia', err && err.message);
      return { text: fallback, ai: false };
    }
  }

  /* ===== Penyaringan dan tahap ===== */
  function recsNow() {
    return computeRecs(ivState.selectedMode, ivState.selectedDateRange.days);
  }
  function recsForPO(poId, commOnly = true) {
    return recsNow().filter(
      (r) =>
        r.poId === poId &&
        (!commOnly ||
          !ivState.selectedCommodityId ||
          r.commodityId === ivState.selectedCommodityId),
    );
  }
  function poLevel(poId) {
    let l = 'normal';
    recsForPO(poId).forEach((r) => {
      l = worst(l, r.cls.level);
    });
    return l;
  }
  function districtLevel(did) {
    let l = 'normal',
      any = false;
    recsNow().forEach((r) => {
      if (
        r.districtId === did &&
        (!ivState.selectedCommodityId || r.commodityId === ivState.selectedCommodityId)
      ) {
        any = true;
        l = worst(l, r.cls.level);
      }
    });
    return any ? l : 'tiada';
  }
  const STATUS_CLS = { normal: 'hijau', waspada: 'kuning', kritikal: 'merah' };
  function poPasses(p, lvl) {
    const s = ivState;
    return (
      (!s.selectedStateId || p.stateId === s.selectedStateId) &&
      (s.selectedRisk === 'all' || lvl === s.selectedRisk)
    );
  }
  function priRows() {
    const s = ivState;
    return recsNow()
      .filter(
        (r) =>
          r.cls.level !== 'normal' &&
          (s.selectedRisk === 'all' || r.cls.level === s.selectedRisk) &&
          (!s.selectedCommodityId || r.commodityId === s.selectedCommodityId) &&
          (!s.selectedStateId || r.stateId === s.selectedStateId) &&
          (!s.selectedPOId || r.poId === s.selectedPOId) &&
          (!s.selectedDistrictId || r.districtId === s.selectedDistrictId),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          LV_W[b.cls.level] - LV_W[a.cls.level] ||
          b.comp.S - a.comp.S ||
          a.poName.localeCompare(b.poName) ||
          a.district.localeCompare(b.district),
      );
  }
  function issueLabel(r) {
    const m = r.mode;
    const base =
      r.cls.priceLevel !== 'normal'
        ? m === 'pengeluar'
          ? 'Harga ladang jatuh'
          : 'Kenaikan harga runcit'
        : m === 'pengeluar'
          ? 'Ramalan di bawah ambang'
          : 'Ramalan di atas ambang';
    const suf =
      r.cls.supply.state === 'disahkan'
        ? m === 'pengeluar'
          ? ' + lebihan bekalan dikesan (data dummy)'
          : ' + kekurangan bekalan dikesan (data dummy)'
        : '';
    return base + suf;
  }
  function intervType(r) {
    const k = r.cls.level === 'kritikal';
    return r.mode === 'pengeluar'
      ? k
        ? 'Pengumpulan dan pengedaran semula bekalan'
        : 'Pantau dan sedia pembelian lebihan'
      : k
        ? 'Mobilisasi stok tambahan'
        : 'Pantau bekalan dan sedia stok sokongan';
  }
  const tagD = '<span class="iv-tag dummy">DATA DUMMY</span>',
    tagR = '<span class="iv-tag real">Data sedia ada</span>';
  const chip = (t, c = '') => `<span class="iv-chip ${c}">${E(t)}</span>`;

  /* ===== Dispatch ===== */
  const ALL_PANELS = ['filters', 'map', 'log', 'pri', 'mob', 'draft', 'mar', 'muse'];
  function resetMobSel() {
    ivState.mob.needMT = null;
    ivState.mob.refPrice = null;
    ivState.mob.candidateKey = null;
    ivState.selectedSourcePOId = null;
    ivState.selectedDestinationPOId = null;
  }
  function applyRoles() {
    const s = ivState;
    if (s.selectedMode === 'pengeluar') {
      s.selectedSourcePOId = s.selectedPOId;
      s.selectedDestinationPOId = null;
    } else {
      s.selectedDestinationPOId = s.selectedPOId;
      s.selectedSourcePOId = null;
    }
  }
  function toastSafe(m) {
    try {
      toast(m);
    } catch (_) {}
  }
  function ivDispatch(type, payload) {
    const s = ivState;
    let dirty = ALL_PANELS,
      focus = false;
    switch (type) {
      case 'setMode': {
        if (payload !== 'pengeluar' && payload !== 'pengguna') return;
        s.selectedMode = payload;
        s.selectedInterventionId = null;
        s.selectedOutletId = null;
        resetMobSel();
        applyRoles();
        s.ui.priBanner = null;
        break;
      }
      case 'setFilter': {
        const [k, v] = payload;
        if (k === 'komoditi') {
          s.selectedCommodityId = v === 'all' || !IV_COMMBY[v] ? null : v;
          s.selectedInterventionId = null;
          s.mob.candidateKey = null;
          s.mob.needMT = null;
          s.mob.refPrice = null;
        } else if (k === 'negeri') {
          s.selectedStateId = v === 'all' || !IV_STATES.some((x) => x.id === v) ? null : v;
          if (s.selectedDistrictId && !s.selectedDistrictId.startsWith(s.selectedStateId + '/'))
            s.selectedDistrictId = null;
        } else if (k === 'po') {
          if (v === 'all' || !IV_POBY[v]) {
            s.selectedPOId = null;
            s.selectedDistrictId = null;
            s.selectedOutletId = null;
            s.selectedInterventionId = null;
            resetMobSel();
            focus = true;
          } else {
            return ivDispatch('selectPO', v);
          }
        } else if (k === 'daerah') {
          return ivDispatch('selectDistrict', v === 'all' ? null : v);
        } else if (k === 'tempoh') {
          const d = +v;
          s.selectedDateRange.days = [7, 14, 30].includes(d) ? d : 30;
        } else if (k === 'risiko') {
          s.selectedRisk = ['kritikal', 'waspada', 'normal'].includes(v) ? v : 'all';
        }
        break;
      }
      case 'resetFilters': {
        Object.assign(s, {
          selectedMode: 'pengeluar',
          selectedCommodityId: null,
          selectedStateId: null,
          selectedDistrictId: null,
          selectedPOId: null,
          selectedOutletId: null,
          selectedRisk: 'all',
          selectedInterventionId: null,
          selectedSourcePOId: null,
          selectedDestinationPOId: null,
        });
        s.selectedDateRange = { days: 30 };
        s.outletCats = { 'pasar-awam': true, ptk: true, rakr: true, agrobazaar: true };
        s.mob = { needMT: null, refPrice: null, wPrice: 65, distLimitKm: 550, candidateKey: null };
        s.ui.priBanner = null;
        s.ui.showAll = false;
        s.margin.touched = false;
        s.margin.ctx = null;
        IV_CONFIG.thresholds = JSON.parse(JSON.stringify(IV_THR_DEFAULT));
        focus = true;
        break;
      }
      case 'selectPO': {
        const p = IV_POBY[payload];
        if (!p) {
          toastSafe('Pilihan tidak sah, penapis diset semula');
          console.warn('PO tidak sah', payload);
          return;
        }
        s.selectedPOId = p.id;
        s.selectedStateId = p.stateId;
        s.selectedDistrictId = null;
        s.selectedOutletId = null;
        s.selectedInterventionId = null;
        resetMobSel();
        applyRoles();
        s.ui.priBanner = null;
        focus = true;
        break;
      }
      case 'selectDistrict': {
        if (payload === null || payload === s.selectedDistrictId) {
          s.selectedDistrictId = null;
          focus = true;
          break;
        }
        const d = IV_DISTBY[payload];
        if (!d) return;
        s.selectedDistrictId = d.districtId;
        if (!ivWithheld[d.poId] && s.selectedPOId !== d.poId) {
          s.selectedPOId = d.poId;
          s.selectedStateId = d.stateId;
          s.selectedOutletId = null;
          s.selectedInterventionId = null;
          resetMobSel();
          applyRoles();
        }
        focus = true;
        break;
      }
      case 'toggleOutletCat': {
        if (IV_CATBY[payload]) s.outletCats[payload] = !s.outletCats[payload];
        dirty = ['map'];
        break;
      }
      case 'selectOutlet': {
        s.selectedOutletId = payload;
        dirty = ['map'];
        break;
      }
      case 'selectIntervention': {
        const r = recsNow().find((x) => x.id === payload);
        if (!r) return;
        s.selectedInterventionId = r.id;
        s.selectedPOId = r.poId;
        s.selectedStateId = r.stateId;
        s.selectedDistrictId = r.districtId;
        s.selectedCommodityId = r.commodityId;
        s.selectedOutletId = null;
        resetMobSel();
        applyRoles();
        s.margin.touched = false;
        focus = true;
        s.ui.priBanner = { id: r.id, text: null, loading: true };
        ivRecommendBanner(r);
        toastSafe('Intervensi dipilih: ' + r.commodity + ' · ' + r.district + ' · ' + r.poName);
        break;
      }
      case 'setMob': {
        const [k, v] = payload;
        if (k === 'need') s.mob.needMT = v;
        else if (k === 'ref') s.mob.refPrice = v;
        else if (k === 'limit') s.mob.distLimitKm = v;
        else if (k === 'wPrice') s.mob.wPrice = clamp(Math.round(v / 5) * 5, 0, 100);
        else if (k === 'resetNeed') s.mob.needMT = null;
        else if (k === 'resetRef') s.mob.refPrice = null;
        dirty = k === 'resetNeed' || k === 'resetRef' ? ['mob'] : ['mobres'];
        break;
      }
      case 'selectCandidate': {
        s.mob.candidateKey = s.mob.candidateKey === payload ? null : payload;
        const eng = curEngine();
        if (s.mob.candidateKey) {
          if (s.selectedMode === 'pengeluar') s.selectedDestinationPOId = payload;
          else s.selectedSourcePOId = payload;
        } else applyRoles();
        dirty = ['mobres'];
        break;
      }
      case 'createDraft': {
        return createDraft();
      }
      case 'deleteDraft': {
        ivDrafts = ivDrafts.filter((d) => d.interventionId !== payload);
        saveDrafts();
        dirty = ['draft'];
        break;
      }
      case 'setMargin': {
        const [k, v] = payload;
        s.margin[k] = v;
        s.margin.touched = true;
        dirty = ['marres'];
        break;
      }
      case 'resetMargin': {
        s.margin.touched = false;
        s.margin.ctx = null;
        dirty = ['mar'];
        break;
      }
      case 'museWeek': {
        const cur = weekStart(myDate(refNow));
        let ws = s.muse.weekStart;
        if (payload === 'prev') {
          const min = addDays(weekStart(addDays(museEarliest(), -14)), 0);
          if (addDays(ws, -7) >= min) ws = addDays(ws, -7);
        } else if (payload === 'next') {
          if (ws < cur) ws = addDays(ws, 7);
        } else ws = cur;
        s.muse.weekStart = ws;
        s.muse.expandedId = null;
        dirty = ['muse'];
        break;
      }
      case 'museExpand': {
        s.muse.expandedId = s.muse.expandedId === payload ? null : payload;
        dirty = ['muse'];
        break;
      }
      case 'museEvidence': {
        s.muse.evidenceOpen[payload] = !s.muse.evidenceOpen[payload];
        dirty = ['muse'];
        break;
      }
      case 'museTransfer': {
        const ins = museAll.find((i) => i.insightId === payload);
        if (!ins || !ins.matchedPOId || !ins.commodityId || !IV_COMMBY[ins.commodityId]) return;
        const p = IV_POBY[ins.matchedPOId];
        s.selectedCommodityId = ins.commodityId;
        s.selectedPOId = p.id;
        s.selectedStateId = p.stateId;
        s.selectedDistrictId = ins.districtId;
        s.selectedInterventionId = null;
        s.selectedOutletId = null;
        resetMobSel();
        applyRoles();
        focus = true;
        toastSafe('Konteks dipindahkan: ' + ins.commodityLabel + ' · ' + p.name);
        break;
      }
      case 'setThreshold': {
        const [m, k, v] = payload;
        const o = IV_CONFIG.thresholds[m];
        const w = Math.abs(o.warnPct),
          c = Math.abs(o.critPct);
        let nw = w,
          nc = c;
        if (k === 'warn') nw = v;
        else nc = v;
        if (!(nw >= 1 && nw <= 50 && nc > nw && nc <= 90)) return false;
        const sg = m === 'pengeluar' ? -1 : 1;
        o.warnPct = sg * nw;
        o.critPct = sg * nc;
        break;
      }
      default:
        return;
    }
    if (focus) ivFocusMap();
    ivRender(dirty);
    return true;
  }
  function museEarliest() {
    return museAll.length ? museAll.map((i) => i.recordDate).sort()[0] : '2026-11-01';
  }

  /* ===== Peta ===== */
  const MY_BOUNDS = (typeof FAMA_MAP_CONFIG !== 'undefined' && FAMA_MAP_CONFIG.bounds) || [
    [99.5, 0.8],
    [119.5, 7.5],
  ];
  let ivMap = null,
    ivMapLoaded = false,
    ivMapTimer = null,
    ivMapWarned = false,
    ivPoMk = [],
    ivDistMk = [],
    ivOutMk = [],
    ivPopup = null;
  function ivMapBox() {
    return $i('ivMap');
  }
  function ivInitMap() {
    if (ivMap) return;
    const sk = $i('ivMapSkel'),
      fb = $i('ivMapFallback');
    if (typeof maplibregl === 'undefined' || failFlags.map) {
      const injected = failFlags.map;
      failFlags.map = false;
      if (!ivMapWarned) {
        ivMapWarned = true;
        console.warn(
          'Peta intervensi tidak dapat dimulakan',
          injected ? '(disuntik)' : 'MapLibre tiada',
        );
      }
      ivState.ui.mapError = 'fallback';
      sk.hidden = true;
      ivRenderMapFallback();
      return;
    }
    try {
      fb.hidden = true;
      sk.hidden = false;
      ivState.ui.mapError = null;
      const cfg = window.FAMA_MAP_CONFIG || {};
      ivMap = new maplibregl.Map({
        container: 'ivMap',
        style: cfg.style || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        bounds: MY_BOUNDS,
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
      ivMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      if (window.ResizeObserver) {
        if (ivMap._ro) ivMap._ro.disconnect();
        ivMap._ro = new ResizeObserver(() => {
          try {
            if (ivMap) ivMap.resize();
          } catch (_) {}
        });
        ivMap._ro.observe(document.querySelector('.iv-map-frame'));
      }
      ivMap.on('load', () => {
        ivMapLoaded = true;
        ivState.ui.mapReady = true;
        ivState.ui.mapError = null;
        clearTimeout(ivMapTimer);
        sk.hidden = true;
        ivDrawDistrictLayer();
        ivRenderMapBanner();
      });
      ivMap.on('error', () => {
        if (!ivMapLoaded && !ivState.ui.mapError) {
          ivState.ui.mapError = 'style';
          sk.hidden = true;
          if (!ivMapWarned) {
            ivMapWarned = true;
            console.warn('Peta asas intervensi tidak dapat dimuatkan');
          }
          ivRenderMapBanner();
        }
      });
      ivMapTimer = setTimeout(() => {
        if (!ivMapLoaded) {
          ivState.ui.mapError = 'style';
          sk.hidden = true;
          if (!ivMapWarned) {
            ivMapWarned = true;
            console.warn('Peta asas intervensi lambat dimuatkan');
          }
          ivRenderMapBanner();
        }
      }, 10000);
    } catch (err) {
      if (!ivMapWarned) {
        ivMapWarned = true;
        console.warn('Peta intervensi tidak dapat dimulakan', err);
      }
      ivMap = null;
      ivState.ui.mapError = 'fallback';
      sk.hidden = true;
      ivRenderMapFallback();
    }
    ivRenderMap();
  }
  function ivRetryMap() {
    try {
      if (ivMap) {
        ivMap.remove();
      }
    } catch (_) {}
    ivMap = null;
    ivMapLoaded = false;
    ivMapWarned = false;
    ivPoMk = [];
    ivDistMk = [];
    ivOutMk = [];
    ivState.ui.mapError = null;
    $i('ivMapFallback').hidden = true;
    ivInitMap();
  }
  function ivFocusMap() {
    if (!ivMap) return;
    const s = ivState;
    try {
      const d = s.selectedDistrictId && IV_DISTBY[s.selectedDistrictId];
      if (d && !ivWithheld[d.poId]) {
        ivMap.flyTo({ center: [d.lon, d.lat], zoom: 10.5, duration: 700 });
        return;
      }
      const p = s.selectedPOId && IV_POBY[s.selectedPOId];
      if (p) {
        const b = new maplibregl.LngLatBounds([p.lon, p.lat], [p.lon, p.lat]);
        if (!ivWithheld[p.id]) p.districts.forEach((x) => b.extend([x[2], x[1]]));
        ivMap.fitBounds(b, { padding: 60, maxZoom: 10, duration: 700 });
        return;
      }
      ivMap.fitBounds(MY_BOUNDS, { padding: 20, duration: 700 });
    } catch (err) {
      console.warn('Gerakan peta gagal', err);
    }
  }
  function mkEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function ivRenderMapFallback() {
    const fb = $i('ivMapFallback');
    fb.hidden = false;
    fb.innerHTML = `<div class="iv-banner bad">Peta tidak dapat dimuatkan. Pilihan PO melalui senarai masih berfungsi.</div><button type="button" class="button" data-iv-act="mapRetry">Cuba Semula</button><div class="iv-fb-grid">${IV_PO.map(
      (p) => {
        const l = poLevel(p.id);
        return `<button type="button" class="iv-fb-btn status-${STATUS_CLS[l]}" data-iv-act="selPO" data-iv-arg="${E(p.id)}">${E(p.name)}<br><small>${LV_LABEL[l]}</small></button>`;
      },
    ).join('')}</div>`;
  }
  function ivRenderMapBanner() {
    const b = $i('ivMapBanner');
    const s = ivState;
    let h = '';
    if (s.ui.mapError === 'style')
      h += `<div class="iv-banner">Peta asas tidak dapat dimuatkan. Penanda PO tetap berfungsi. <button type="button" class="button tiny ghost" data-iv-act="mapRetry">Cuba Semula</button></div>`;
    if (s.selectedPOId && ivWithheld[s.selectedPOId])
      h += `<div class="iv-banner info">Pemetaan daerah untuk PO ini belum disediakan. Daerah dan outlet tidak dipaparkan.</div>`;
    b.innerHTML = h;
  }
  function circlePoly(lon, lat, rKm, n = 24) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      pts.push([
        lon + (rKm / 111.32 / Math.cos((lat * Math.PI) / 180)) * Math.cos(a),
        lat + (rKm / 110.57) * Math.sin(a),
      ]);
    }
    return pts;
  }
  function ivDrawDistrictLayer() {
    if (!ivMap || !ivMapLoaded) return;
    try {
      const s = ivState,
        p = s.selectedPOId && IV_POBY[s.selectedPOId];
      const feats =
        p && !ivWithheld[p.id]
          ? IV_DISTRICTS.filter((d) => d.poId === p.id).map((d) => ({
              type: 'Feature',
              properties: {
                name: d.name + ' (anggaran)',
                lvl: districtLevel(d.districtId),
                sel: d.districtId === s.selectedDistrictId ? 1 : 0,
              },
              geometry: { type: 'Polygon', coordinates: [circlePoly(d.lon, d.lat, 10)] },
            }))
          : [];
      const data = { type: 'FeatureCollection', features: feats };
      const src = ivMap.getSource('iv-districts');
      if (src) {
        src.setData(data);
        return;
      }
      ivMap.addSource('iv-districts', { type: 'geojson', data });
      const col = [
        'match',
        ['get', 'lvl'],
        'kritikal',
        '#ff4e63',
        'waspada',
        '#ffbd43',
        'normal',
        '#22d88a',
        '#7f9bb8',
      ];
      ivMap.addLayer({
        id: 'iv-districts-fill',
        type: 'fill',
        source: 'iv-districts',
        paint: { 'fill-color': col, 'fill-opacity': 0.16 },
      });
      ivMap.addLayer({
        id: 'iv-districts-line',
        type: 'line',
        source: 'iv-districts',
        paint: {
          'line-color': col,
          'line-width': ['case', ['==', ['get', 'sel'], 1], 3, 1.5],
          'line-dasharray': [2, 2],
        },
      });
    } catch (err) {
      console.warn('Lapisan kawasan daerah gagal', err);
    }
  }
  function outletPopupNode(o) {
    const n = mkEl('div', '');
    n.append(mkEl('strong', '', o.nama));
    const dl = mkEl('dl');
    const row = (k, v) => {
      dl.append(mkEl('dt', '', k), mkEl('dd', '', v));
    };
    row('Jenis', IV_CATBY[o.kategori].label);
    row('Negeri', o.negeri);
    row('Daerah', o.districtName);
    row('PO penyelia', o.supervisingPOId ? poName(o.supervisingPOId) : 'Belum disahkan');
    row('Koordinat (anggaran)', o.lat.toFixed(3) + ', ' + o.lon.toFixed(3));
    row('Status operasi', o.status);
    row('Komoditi berkaitan', o.komoditiBerkaitan.map(commName).join(', '));
    row('Data', 'DATA DUMMY');
    n.append(dl);
    return n;
  }
  function visibleOutlets() {
    const s = ivState,
      p = s.selectedPOId;
    if (!p || ivWithheld[p]) return [];
    let l = outletsOfPO(p);
    if (s.selectedDistrictId) l = l.filter((o) => o.districtId === s.selectedDistrictId);
    return l;
  }
  function ivRenderMapMarkers() {
    ivPoMk.forEach((m) => m.remove());
    ivDistMk.forEach((m) => m.remove());
    ivOutMk.forEach((m) => m.remove());
    ivPoMk = [];
    ivDistMk = [];
    ivOutMk = [];
    if (ivPopup) {
      ivPopup.remove();
      ivPopup = null;
    }
    if (!ivMap) return;
    const s = ivState;
    IV_PO.forEach((p) => {
      const lvl = poLevel(p.id),
        sel = s.selectedPOId === p.id,
        pass = poPasses(p, lvl);
      const show = s.selectedPOId ? s.selectedRisk === 'all' || lvl === s.selectedRisk : pass;
      if (!show && !sel) return;
      const el = mkEl(
        'div',
        `po-marker iv-po-marker status-${STATUS_CLS[lvl]}${sel ? ' iv-sel' : ''}${!pass ? ' iv-outside' : ''}${s.selectedPOId && !sel ? ' compact' : ''}`,
      );
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${p.name}, ${LV_LABEL[lvl]}`);
      el.title = `${p.name} · ${LV_LABEL[lvl]} (lokasi anggaran bandar)`;
      el.dataset.ivPo = p.id;
      el.append(mkEl('span', 'halo'), mkEl('span', 'core'));
      if (!s.selectedPOId) {
        const [dx, dy] = IV_CONFIG.labelShift[p.id] || [9, -10];
        const t = mkEl('span', 'iv-lbl', p.label);
        t.style.left = `calc(50% + ${dx}px)`;
        t.style.top = `calc(50% + ${dy}px)`;
        el.append(t);
      }
      const go = () => ivDispatch('selectPO', p.id);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        go();
      });
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          go();
        }
      });
      ivPoMk.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lon, p.lat])
          .addTo(ivMap),
      );
    });
    const p = s.selectedPOId && IV_POBY[s.selectedPOId];
    if (p && !ivWithheld[p.id]) {
      IV_DISTRICTS.filter((d) => d.poId === p.id).forEach((d) => {
        const lv = districtLevel(d.districtId);
        const el = mkEl(
          'div',
          `iv-dist status-${lv === 'tiada' ? 'tiada' : STATUS_CLS[lv]}${s.selectedDistrictId === d.districtId ? ' iv-sel' : ''}`,
        );
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `Daerah ${d.name} (kawasan anggaran)`);
        el.dataset.ivDist = d.districtId;
        el.append(mkEl('span', 'dot-core'), mkEl('span', 'map-label', d.name));
        const go = () => ivDispatch('selectDistrict', d.districtId);
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          go();
        });
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            go();
          }
        });
        ivDistMk.push(
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([d.lon, d.lat])
            .addTo(ivMap),
        );
      });
      visibleOutlets()
        .filter((o) => s.outletCats[o.kategori])
        .forEach((o) => {
          const el = mkEl(
            'button',
            'iv-out c-' + o.kategori + (s.selectedOutletId === o.outletId ? ' iv-sel' : ''),
          );
          el.type = 'button';
          el.append(mkEl('span', '', IV_CATBY[o.kategori].glyph));
          el.setAttribute('aria-label', `${o.nama}, ${IV_CATBY[o.kategori].label}`);
          el.title = o.nama;
          el.dataset.ivOutlet = o.outletId;
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            s.selectedOutletId = o.outletId;
            if (ivPopup) ivPopup.remove();
            ivPopup = new maplibregl.Popup({ offset: 16, maxWidth: '260px', className: 'iv-popup' })
              .setLngLat([o.lon, o.lat])
              .setDOMContent(outletPopupNode(o))
              .addTo(ivMap);
          });
          ivOutMk.push(
            new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([o.lon, o.lat])
              .addTo(ivMap),
          );
        });
    }
  }
  function ivRenderMap() {
    const s = ivState;
    $i('ivModePengeluar').setAttribute('aria-selected', String(s.selectedMode === 'pengeluar'));
    $i('ivModePengguna').setAttribute('aria-selected', String(s.selectedMode === 'pengguna'));
    $i('ivMapHint').textContent =
      s.selectedMode === 'pengeluar'
        ? 'Penunjuk: Harga Ladang · amaran apabila harga turun'
        : 'Penunjuk: Harga Runcit · amaran apabila harga naik';
    $i('ivMapBack').hidden = !s.selectedPOId;
    const cnt = { normal: 0, waspada: 0, kritikal: 0 };
    IV_PO.forEach((p) => cnt[poLevel(p.id)]++);
    const sel = s.selectedPOId ? IV_POBY[s.selectedPOId] : null;
    const outside = sel && !poPasses(sel, poLevel(sel.id));
    $i('ivMapChips').innerHTML =
      chip('Kritikal ' + cnt.kritikal, 'bad') +
      chip('Waspada ' + cnt.waspada, 'warn') +
      chip('Normal ' + cnt.normal, 'ok') +
      (outside ? chip('Terpilih (di luar penapis)', 'info') : '') +
      (sel ? chip(sel.name, 'info') : '') +
      notApplicable('map');
    const outs =
      sel && !ivWithheld[sel.id]
        ? outletsOfPO(sel.id).filter(
            (o) => !s.selectedDistrictId || o.districtId === s.selectedDistrictId,
          )
        : [];
    $i('ivOutletChips').innerHTML = IV_CATS.map(
      (c) =>
        `<button type="button" class="iv-chip" aria-pressed="${s.outletCats[c.id]}" data-iv-act="outCat" data-iv-arg="${c.id}"><i class="iv-leg-i c-${c.id}"></i>${c.label} (${outs.filter((o) => o.kategori === c.id).length})</button>`,
    ).join('');
    $i('ivLegend').innerHTML =
      IV_CATS.map((c) => `<span><i class="iv-leg-i c-${c.id}"></i>${c.label}</span>`).join('') +
      `<span><i class="iv-dot g"></i>Normal</span><span><i class="iv-dot y"></i>Waspada</span><span><i class="iv-dot r"></i>Merah berkelip: kritikal disahkan bekalan</span>`;
    let dc = '';
    if (sel && !ivWithheld[sel.id]) {
      dc = IV_DISTRICTS.filter((d) => d.poId === sel.id)
        .map((d) => {
          const n = IV_OUTLETS.filter((o) => o.districtId === d.districtId).length;
          return `<button type="button" class="iv-chip" aria-pressed="${s.selectedDistrictId === d.districtId}" data-iv-act="district" data-iv-arg="${E(d.districtId)}">${E(d.name)} · ${n ? n + ' outlet' : 'Tiada outlet dalam daerah ini'}</button>`;
        })
        .join('');
    }
    $i('ivDistChips').innerHTML = dc;
    $i('ivUnmappedList').innerHTML = IV_OUTLETS.filter((o) => !o.supervisingPOId)
      .map((o) => `${E(o.nama)} · ${E(o.districtName)}, ${E(o.negeri)} ${tagD}`)
      .join('<br>');
    ivRenderMapBanner();
    if (ivMap) {
      ivRenderMapMarkers();
      ivDrawDistrictLayer();
    } else if (s.ui.mapError === 'fallback') ivRenderMapFallback();
  }

  /* ===== Penapis (toolbar) ===== */
  function notApplicable(panel) {
    const s = ivState;
    const act = [];
    const f = (n, on) => {
      if (on) act.push(n);
    };
    if (panel === 'log' || (panel === 'map' && false)) {
      f('Komoditi', !!s.selectedCommodityId);
      f('Negeri', !!s.selectedStateId);
      f('Daerah', !!s.selectedDistrictId);
      f('Tempoh', s.selectedDateRange.days !== 30);
      f('Tahap Risiko', s.selectedRisk !== 'all');
    }
    if (panel === 'mob' || panel === 'mar') {
      f('Negeri', !!s.selectedStateId);
      f('Daerah', !!s.selectedDistrictId);
      f('Tahap Risiko', s.selectedRisk !== 'all');
    }
    if (panel === 'muse') {
      f('Tempoh', s.selectedDateRange.days !== 30);
    }
    return act.length ? chip('Penapis tidak terpakai: ' + act.join(', '), 'grey') : '';
  }
  function fillSel(id, opts, val) {
    const e = $i(id);
    const h = opts
      .map(([v, l]) => `<option value="${E(v)}"${v === val ? ' selected' : ''}>${E(l)}</option>`)
      .join('');
    if (e.dataset.sig !== h) {
      e.innerHTML = h;
      e.dataset.sig = h;
    }
    e.value = val;
  }
  function ivRenderFilters() {
    const s = ivState;
    fillSel(
      'ivFKomoditi',
      [['all', 'Semua komoditi'], ...IV_COMM.map((c) => [c.id, c.name])],
      s.selectedCommodityId || 'all',
    );
    fillSel(
      'ivFNegeri',
      [['all', 'Semua negeri'], ...IV_STATES.map((x) => [x.id, x.name])],
      s.selectedStateId || 'all',
    );
    let pos = IV_PO.filter((p) => !s.selectedStateId || p.stateId === s.selectedStateId);
    const out =
      s.selectedPOId && !pos.some((p) => p.id === s.selectedPOId) ? IV_POBY[s.selectedPOId] : null;
    fillSel(
      'ivFPO',
      [
        ['all', 'Semua PO'],
        ...pos.map((p) => [p.id, p.name]),
        ...(out ? [[out.id, out.name + ' (di luar penapis)']] : []),
      ],
      s.selectedPOId || 'all',
    );
    let ds = IV_DISTRICTS.filter((d) =>
      s.selectedPOId
        ? d.poId === s.selectedPOId
        : !s.selectedStateId || d.stateId === s.selectedStateId,
    );
    if (
      s.selectedDistrictId &&
      !ds.some((d) => d.districtId === s.selectedDistrictId) &&
      IV_DISTBY[s.selectedDistrictId]
    )
      ds = [...ds, IV_DISTBY[s.selectedDistrictId]];
    fillSel(
      'ivFDaerah',
      [['all', 'Semua daerah'], ...ds.map((d) => [d.districtId, d.name])],
      s.selectedDistrictId || 'all',
    );
    $i('ivFTempoh').value = String(s.selectedDateRange.days);
    $i('ivFRisiko').value = s.selectedRisk;
    const t = IV_CONFIG.thresholds;
    [
      ['ivThrPW', Math.abs(t.pengeluar.warnPct)],
      ['ivThrPC', Math.abs(t.pengeluar.critPct)],
      ['ivThrGW', Math.abs(t.pengguna.warnPct)],
      ['ivThrGC', Math.abs(t.pengguna.critPct)],
    ].forEach(([id, v]) => {
      const e = $i(id);
      if (document.activeElement !== e) {
        e.value = v;
        e.removeAttribute('aria-invalid');
      }
    });
  }

  /* ===== Paparan 2 ===== */
  const ICON_TRUCK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>';
  const ICON_SNOW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2v20M4 7l16 10M20 7L4 17M9 3l3 3 3-3M9 21l3-3 3 3"/></svg>';
  const ICON_WH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 10l9-6 9 6v10H3z"/><path d="M8 20v-6h8v6"/></svg>';
  function logTotals(pos) {
    const has = (p) =>
      p.logistik &&
      ['kenderaan', 'muatanMT', 'bilikSejuk', 'kapasitiSimpananMT'].every((k) =>
        fin(p.logistik[k]),
      );
    const withData = pos.filter(has),
      noData = pos.filter((p) => !has(p));
    const groups = new Map();
    withData.forEach((p) => {
      if (!groups.has(p.group)) groups.set(p.group, { id: p.group, l: p.logistik, pos: [] });
      groups.get(p.group).pos.push(p);
    });
    const G = [...groups.values()],
      sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
    const cov = G.filter((g) => IV_LOGISTICS_AVAIL[g.id]);
    const tot = {
      kenderaan: sum(G, (g) => g.l.kenderaan),
      muatan: sum(G, (g) => g.l.muatanMT),
      bilikSejuk: sum(G, (g) => g.l.bilikSejuk),
      simpanan: sum(G, (g) => g.l.kapasitiSimpananMT),
    };
    const av = {
      groups: cov.length,
      kenderaanMax: sum(cov, (g) => g.l.kenderaan),
      simpananMax: sum(cov, (g) => g.l.kapasitiSimpananMT),
      vehicles: sum(cov, (g) => IV_LOGISTICS_AVAIL[g.id].availableVehicleCount),
      space: sum(cov, (g) => IV_LOGISTICS_AVAIL[g.id].availableCapacityMT),
      stock: sum(cov, (g) => IV_LOGISTICS_AVAIL[g.id].actualStockMT),
    };
    return { withData, noData, groups: G, shared: G.filter((g) => g.pos.length > 1), tot, av };
  }
  function ivRenderLogTotal(body, ch, nt) {
    const s = ivState,
      st = s.selectedStateId ? IV_STATES.find((x) => x.id === s.selectedStateId) : null;
    const pos = IV_PO.filter((p) => !st || p.stateId === st.id),
      T = logTotals(pos);
    const scope = st
      ? `Jumlah Negeri ${st.name} (${pos.length} PO)`
      : `Jumlah Keseluruhan (${pos.length} PO)`;
    nt.textContent = scope + ' · tiada PO dipilih.';
    const tile = (ico, v, l) =>
      `<div class="iv-stat">${ico}<div><b>${v}</b><span>${l}</span></div></div>`;
    let rd = { state: 'tidak-dinilai', label: 'Kesiapsiagaan tidak dapat dinilai' };
    if (T.av.groups)
      rd = readiness({
        availableVehicleCount: T.av.vehicles,
        kenderaanMax: T.av.kenderaanMax,
        availableCapacityMT: T.av.space,
        simpananMaxMT: T.av.simpananMax,
      });
    const rc =
      rd.state === 'sedia'
        ? 'ok'
        : rd.state === 'terhad'
          ? 'warn'
          : rd.state === 'kritikal'
            ? 'bad'
            : 'grey';
    ch.innerHTML = chip(rd.label, rc) + notApplicable('log');
    if (!pos.length) {
      body.innerHTML =
        '<div class="iv-empty" id="ivLogTotal">Tiada PO dalam skop penapis ini</div>';
      return;
    }
    let h = `<div id="ivLogTotal"><div class="iv-chips"><b>${E(scope)}</b>${tagR}</div>
 <div class="iv-note">Dikira daripada ${T.withData.length} daripada ${pos.length} PO${T.noData.length ? `; ${T.noData.length} PO belum mempunyai data logistik (dikecualikan, tiada nilai direka)` : ''}. Pilih PO pada peta untuk melihat butiran PO.</div>
 <div class="iv-sec">JUMLAH KAPASITI MAKSIMUM STATIK</div><div class="iv-stats" id="ivLogTotStats">${tile(ICON_TRUCK, T.tot.kenderaan, 'Bilangan Kenderaan')}${tile(ICON_TRUCK, f2(T.tot.muatan), 'Kapasiti Muatan (MT)')}${tile(ICON_SNOW, T.tot.bilikSejuk, 'Bilangan Bilik Sejuk')}${tile(ICON_WH, f2(T.tot.simpanan), 'Kapasiti Simpanan (MT)')}</div>`;
    if (T.shared.length)
      h += `<div class="iv-banner info" id="ivLogTotGrp">Rekod logistik dikongsi: ${E(T.shared.map((g) => g.pos.map((x) => x.name).join(' dan ')).join('; '))}. Kapasiti kumpulan dikira sekali sahaja, tidak digandakan.</div>`;
    const IV_SHOW_AVAIL = false; // ubah kepada true untuk papar semula "Ketersediaan Semasa"
    if (IV_SHOW_AVAIL) {
      h += `<div class="iv-sec">KETERSEDIAAN SEMASA ${tagD}</div>`;
      if (!T.av.groups)
        h += `<div class="iv-empty" id="ivLogNull">Data ketersediaan semasa belum tersedia</div>`;
      else
        h += `<div class="iv-stats" id="ivLogTotAvail">${tile(ICON_TRUCK, T.av.vehicles, 'Kenderaan tersedia (daripada ' + T.av.kenderaanMax + ')')}${tile(ICON_WH, T.av.space.toFixed(1), 'Ruang simpanan kosong (MT)')}${tile(ICON_WH, T.av.stock.toFixed(1), 'Stok sebenar disimpan (MT)')}${tile(ICON_SNOW, T.av.simpananMax.toFixed(1), 'Simpanan maksimum (MT)')}</div><div class="iv-note">Hanya ${T.av.groups} daripada ${T.groups.length} kumpulan logistik mempunyai data ketersediaan semasa; yang lain belum tersedia dan tidak disimpulkan daripada kapasiti maksimum. Kesiapsiagaan dinilai daripada kumpulan berdata sahaja. Dikemas kini ${E(myDate(IV_UPD))} (dummy).</div>`;
    }
    const IV_SHOW_PO_BREAKDOWN = false; // ubah kepada true untuk papar semula "Pecahan mengikut PO"
    if (IV_SHOW_PO_BREAKDOWN)
      h += `<details class="iv-brk" id="ivLogBrk" open><summary>Pecahan mengikut PO (${pos.length})</summary><div class="iv-brk-list">${pos
        .map((p) => {
          const d = T.withData.includes(p),
            l = p.logistik;
          const sh = d && T.groups.find((g) => g.id === p.group).pos.length > 1;
          return `<button type="button" class="iv-brk-row" data-iv-act="selPO" data-iv-arg="${E(p.id)}"><b>${E(p.name)}</b><span>${d ? `${l.kenderaan} kenderaan · ${f2(l.muatanMT)} MT · ${l.bilikSejuk} bilik sejuk · ${f2(l.kapasitiSimpananMT)} MT simpanan${sh ? ' (gabungan kumpulan)' : ''}` : 'Belum mempunyai data logistik'}</span></button>`;
        })
        .join('')}</div></details>`;
    h += `</div>`;
    body.innerHTML = h;
  }
  function ivRenderLog() {
    const id = effPO(),
      body = $i('ivLogBody'),
      ch = $i('ivLogChips');
    const nt = $i('ivLogNote');
    if (!id) {
      ivRenderLogTotal(body, ch, nt);
      return;
    }
    nt.textContent = 'Kenderaan, muatan, bilik sejuk dan simpanan PO terpilih.';
    const p = IV_POBY[id],
      lg = logisticsOf(id),
      rd = readiness(lg);
    const rc =
      rd.state === 'sedia'
        ? 'ok'
        : rd.state === 'terhad'
          ? 'warn'
          : rd.state === 'kritikal'
            ? 'bad'
            : 'grey';
    ch.innerHTML = chip(rd.label, rc) + notApplicable('log');
    const names = lg.groupMemberPOIds.map(poName);
    const tile = (ico, v, l) =>
      `<div class="iv-stat">${ico}<div><b>${v}</b><span>${l}</span></div></div>`;
    let h = `<div class="iv-chips"><b>${E(p.name)}</b>${chip(p.negeri)}${chip('lokasi anggaran bandar', 'grey')}${tagR}</div>
 <div class="iv-sec">KAPASITI MAKSIMUM STATIK</div><div class="iv-stats">${tile(ICON_TRUCK, lg.kenderaanMax, 'Bilangan Kenderaan')}${tile(ICON_TRUCK, f2(lg.muatanMaxMT), 'Kapasiti Muatan (MT)')}${tile(ICON_SNOW, lg.bilikSejukMax, 'Bilangan Bilik Sejuk')}${tile(ICON_WH, f2(lg.simpananMaxMT), 'Kapasiti Simpanan (MT)')}</div>`;
    if (lg.groupShared)
      h += `<div class="iv-banner info">Angka gabungan ${E(names.join(' dan '))}. Tidak digandakan. ${lg.groupMemberPOIds
        .filter((x) => x !== id)
        .map(
          (x) =>
            `<button type="button" class="iv-chip info" data-iv-act="selPO" data-iv-arg="${E(x)}">Lihat ${E(poName(x))}</button>`,
        )
        .join(' ')}</div>`;
    const IV_SHOW_AVAIL = false; // ubah kepada true untuk papar semula "Ketersediaan Semasa"
    if (IV_SHOW_AVAIL) {
      h += `<div class="iv-sec">KETERSEDIAAN SEMASA ${tagD}</div>`;
      if (lg.availableVehicleCount == null && lg.availableCapacityMT == null)
        h += `<div class="iv-empty" id="ivLogNull">Data ketersediaan semasa belum tersedia</div>`;
      else
        h += `<div class="iv-stats">${tile(ICON_TRUCK, lg.availableVehicleCount, 'Kenderaan tersedia (daripada ' + lg.kenderaanMax + ')')}${tile(ICON_WH, lg.availableCapacityMT.toFixed(1), 'Ruang simpanan kosong (MT)')}${tile(ICON_WH, lg.actualStockMT.toFixed(1), 'Stok sebenar disimpan (MT)')}${tile(ICON_SNOW, lg.simpananMaxMT.toFixed(1), 'Simpanan maksimum (MT)')}</div><div class="iv-note">Dikemas kini ${E(myDate(lg.availabilityUpdated))} (dummy). Ketersediaan tidak pernah disimpulkan daripada kapasiti maksimum.</div>`;
    }
    body.innerHTML = h;
  }

  /* ===== Paparan 3 ===== */
  let _priBannerSeq = 0;
  async function ivRecommendBanner(r) {
    const seq = ++_priBannerSeq;
    const fb = `Cadangan: ${r.cls.level === 'kritikal' ? 'utamakan' : 'pantau'} ${r.commodity} di ${r.district} (${r.poName}). ${intervType(r)}.`;
    const res = await callAI('recommendPriority', { text: fb }, fb);
    if (seq !== _priBannerSeq || !ivState.ui.priBanner || ivState.ui.priBanner.id !== r.id) return;
    ivState.ui.priBanner = { id: r.id, text: res.text, loading: false, ai: res.ai };
    ivRender(['pri']);
  }
  function ivRenderPri() {
    const s = ivState,
      rows = priRows();
    const list = $i('ivPriList');
    const shown = s.ui.showAll ? rows : rows.slice(0, 12);
    $i('ivPriChips').innerHTML =
      chip('Mod: ' + modeLbl(s.selectedMode), 'info') +
      chip('Harga ' + (s.selectedMode === 'pengeluar' ? 'Ladang' : 'Runcit'), 'grey') +
      chip(rows.length + ' isu', rows.length ? 'warn' : 'ok') +
      tagD;
    const bn = s.ui.priBanner;
    let bh = '';
    if (bn) {
      bh = `<div class="iv-banner info" id="ivPriBannerBox" tabindex="-1">${bn.loading ? 'Menyediakan cadangan…' : E(bn.text)} <button type="button" class="button tiny ghost" data-iv-act="openMob">Buka Mobilisasi Stok</button></div>`;
    }
    $i('ivPriBanner').innerHTML = bh;
    if (!rows.length) {
      list.innerHTML = '<div class="iv-empty">Tiada isu keutamaan untuk penapis ini</div>';
    } else
      list.innerHTML = shown
        .map((r) => {
          const lv = r.cls.level;
          const tel = !isKg(r.commodityId);
          return `<div class="iv-row" role="button" tabindex="0" aria-pressed="${s.selectedInterventionId === r.id}" data-iv-act="selRow" data-iv-arg="${E(r.id)}">
   <div class="iv-r1"><span class="iv-lv ${lv}">${LV_LABEL[lv]}</span><b class="iv-r-com">${E(r.commodity)}</b><span class="iv-r-loc">${E(r.district)}, ${E(r.negeri)}</span><span class="iv-r-score" title="Komponen skor: harga ${(r.comp.P * 100).toFixed(0)}%, bekalan ${(r.comp.S * 100).toFixed(0)}%, forecast ${(r.comp.F * 100).toFixed(0)}%, pengesahan ${(r.comp.C * 100).toFixed(0)}%">Skor ${r.score}</span></div>
   <div class="iv-r2">${E(r.poName)} · <b>Jenis isu:</b> ${E(issueLabel(r))}</div>
   <div class="iv-r3">Harga semasa ${rmAny(r.price.actual)} → forecast ${rmAny(r.price.forecast)} · sisihan ${sgn(r.price.devPct, 1)}%</div>
   <div class="iv-r4"><div class="iv-r-int"><span><b>Intervensi:</b> ${E(intervType(r))}</span>${r.cls.flag ? chip(r.cls.flag, 'warn') : ''}${tel ? chip('Telur: bekalan dalam unit lain, tidak dinilai', 'grey') : ''}${r.price.overlay ? `<span class="iv-chip warn" title="${E(r.price.overlay.note)}">Senario ujian (dummy)</span>` : ''}</div><button type="button" class="button tiny iv-act" data-iv-act="tindakan" data-iv-arg="${E(r.id)}">Tindakan</button></div></div>`;
        })
        .join('');
    const pend = rows.filter((r) => r.cls.flag === 'Menunggu pengesahan bekalan').length;
    let foot = '';
    if (rows.length > 12)
      foot += `<button type="button" class="button tiny ghost" data-iv-act="showAll">${s.ui.showAll ? 'Papar 12 teratas' : 'Papar semua (' + rows.length + ')'}</button> `;
    if (pend) foot += `${pend} isu harga menunggu pengesahan bekalan. `;
    foot += 'Skor ialah indeks keutamaan prototaip, bukan kebarangkalian.';
    $i('ivPriFoot').innerHTML = foot;
  }

  /* ===== Paparan 4 ===== */
  function mobResolve() {
    const s = ivState,
      po = effPO(),
      cm = effCommodity(),
      mode = s.selectedMode;
    const row = po && isKg(cm.id) ? supplyRow(po, cm.id) : null;
    const defNeed = row ? (mode === 'pengeluar' ? row.surplusMT : row.shortageMT) : 0;
    const ap = po ? ivPrice(po, cm.id, 'Borong') : null;
    const need = s.mob.needMT != null ? s.mob.needMT : defNeed > 0 ? +defNeed.toFixed(1) : 1;
    const ref = s.mob.refPrice != null ? s.mob.refPrice : ap ? +ap.actual.toFixed(2) : null;
    return {
      po,
      cm,
      mode,
      row,
      defNeed,
      need,
      ref,
      anchorPrice: ap,
      needDefault: s.mob.needMT == null,
      refDefault: s.mob.refPrice == null,
    };
  }
  function curEngine() {
    const r = mobResolve();
    if (!r.po || !isKg(r.cm.id) || r.ref == null) return null;
    return mobilisationEngine({
      mode: r.mode,
      anchorPOId: r.po,
      commodityId: r.cm.id,
      needMT: r.need,
      refPrice: r.ref,
      wPrice: ivState.mob.wPrice,
      distLimitKm: ivState.mob.distLimitKm,
      days: ivState.selectedDateRange.days,
      now: nowMs(),
    });
  }
  function ivRenderMobCtl() {
    const s = ivState,
      r = mobResolve();
    const box = $i('ivMobCtl'),
      head = $i('ivMobHead');
    $i('ivMobChips').innerHTML =
      chip('Mod: ' + modeLbl(s.mode || s.selectedMode), 'info') + tagD + notApplicable('mob');
    if (!r.po) {
      head.innerHTML = '';
      box.innerHTML =
        '<div class="iv-empty">Pilih Pusat Operasi pada peta atau senarai keutamaan</div>';
      return;
    }
    const p = IV_POBY[r.po];
    if (!isKg(r.cm.id)) {
      head.innerHTML = '';
      box.innerHTML = `<div class="iv-banner">Unit komoditi (${E(IV_COMMBY[r.cm.id].unit)}) tidak disokong untuk pengiraan MT dan RM/kg. Pilih komoditi RM/kg.</div>`;
      return;
    }
    const role =
      r.mode === 'pengeluar' ? 'PO SUMBER (lebihan stok)' : 'PO DESTINASI (kekurangan stok)';
    const row = r.row;
    head.innerHTML = `<div class="iv-card"><div class="iv-chips"><span class="iv-chip info">${role}</span><b>${E(p.name)}</b>${chip(p.negeri)}${chip(IV_COMMBY[r.cm.id].name)}${chip('Peringkat Borong', 'grey')}${r.cm.def ? chip('Komoditi panel: Cili Merah (lalai, penapis ialah Semua)', 'warn') : ''}</div>
 <div class="iv-kv"><span>Harga Borong PO<b>${rmAny(r.anchorPrice && r.anchorPrice.actual)}${r.anchorPrice && r.anchorPrice.overlay ? ' *' : ''}</b></span><span>${r.mode === 'pengeluar' ? 'Lebihan stok' : 'Kekurangan stok'} (dummy)<b>${row ? f2(r.defNeed) + ' MT' : '—'}</b></span><span>Stok tersedia (dummy)<b>${row ? f2(row.net) + ' MT' : '—'}</b></span><span>Keperluan (dummy)<b>${row ? f2(row.requiredMT) + ' MT' : '—'}</b></span></div></div>`;
    const sig = [s.selectedMode, r.po, r.cm.id, s.selectedInterventionId].join('|');
    const hints = () => {
      const a = $i('ivNeedHint'),
        b = $i('ivRefHint');
      if (a)
        a.innerHTML = r.needDefault
          ? 'dari data dummy'
          : 'ditetapkan pengguna <a href="#" data-iv-act="resetNeed">Pulih lalai</a>';
      if (b)
        b.innerHTML = r.refDefault
          ? 'lalai: harga Borong PO'
          : 'ditetapkan pengguna <a href="#" data-iv-act="resetRef">Pulih lalai</a>';
    };
    if (box.dataset.sig === sig && box.firstChild) {
      hints();
      return;
    }
    box.dataset.sig = sig;
    box.innerHTML = `<div class="iv-ctl">
  <label>Keperluan/lebihan (MT)<input class="iv-in" type="number" id="ivNeed" data-iv-in="need" min="0.1" max="500" step="0.1" value="${r.need}"><span class="iv-err" id="ivNeedErr"></span><small id="ivNeedHint"></small></label>
  <label>Harga rujukan pasaran (RM/kg)<input class="iv-in" type="number" id="ivRef" data-iv-in="ref" min="0.01" max="999" step="0.01" value="${r.ref}"><span class="iv-err" id="ivRefErr"></span><small id="ivRefHint"></small></label>
  <label>Wajaran harga <b id="ivWPL">${s.mob.wPrice}%</b><input type="range" id="ivWP" data-iv-in="wp" min="0" max="100" step="5" value="${s.mob.wPrice}" aria-label="Wajaran harga"></label>
  <label>Wajaran jarak (%) <b id="ivWDL">${100 - s.mob.wPrice}%</b><input type="range" id="ivWD" data-iv-in="wd" min="0" max="100" step="5" value="${100 - s.mob.wPrice}" aria-label="Wajaran jarak"></label>
  <label>Had jarak (km)<input class="iv-in" type="number" id="ivLimit" data-iv-in="limit" min="50" max="2000" step="10" value="${s.mob.distLimitKm}"><span class="iv-err" id="ivLimitErr"></span></label>
 </div><div class="iv-note" id="ivWTotal">Jumlah wajaran: <b>${s.mob.wPrice}% + ${100 - s.mob.wPrice}% = 100%</b></div>`;
    hints();
  }
  function candCard(c, side, key) {
    const s = ivState;
    const lbl = s.selectedMode === 'pengguna' ? 'Lebihan stok' : 'Keperluan';
    const chips = [];
    if (c.sameGroup) chips.push(chip('Kongsi kapasiti logistik (kumpulan gabungan)', 'info'));
    if (c.flood) chips.push(chip('Waspada banjir', 'warn'));
    if (c.overlay) chips.push(chip('Senario ujian (dummy)', 'warn'));
    return `<button type="button" class="iv-cand" aria-pressed="${s.mob.candidateKey === c.poId}" data-iv-act="cand" data-iv-arg="${E(c.poId)}" data-iv-side="${side}"><div class="iv-cand-h"><span>#${c.rank} ${E(c.name)}</span><span>Skor ${c.score}/100</span></div>
 <div class="iv-row-s">${E(c.negeri)}</div>
 <div class="iv-kv"><span>${lbl}<b>${f2(c.stockMT)} MT</b></span><span>Harga ${s.selectedMode === 'pengguna' ? 'sumber' : 'destinasi'}<b>${rmAny(c.price)}</b></span><span>Anggaran jarak<b>${Math.round(c.km)} km</b></span><span>Boleh dihantar<b>${f2(c.qty)} MT</b></span></div>
 <div class="iv-chips" style="margin-top:6px">${chips.join('')}</div></button>`;
  }
  function ivEngineFacts(r, eng) {
    const top = eng.dalam[0] || eng.luar[0];
    if (!top) return null;
    return { top, inState: !!eng.dalam[0] };
  }
  let _mobAISeq = 0;
  const _aiCache = {};
  async function ivFillMobAI(r, eng) {
    const host = $i('ivMobAI');
    if (!host) return;
    const tf = ivEngineFacts(r, eng);
    if (!tf) {
      host.innerHTML = '';
      return;
    }
    const t = tf.top,
      m = r.mode;
    const fb = `Berdasarkan pengiraan, ${t.name} (${tf.inState ? 'dalam negeri' : 'luar negeri'}) ialah calon utama ${m === 'pengguna' ? 'sumber' : 'destinasi'} untuk ${commName(r.cm.id)}, dengan kuantiti boleh dihantar ${f2(t.qty)} MT, anggaran jarak ${Math.round(t.km)} km serta harga ${m === 'pengguna' ? 'sumber' : 'destinasi'} ${rmAny(t.price)}. Cadangan ini perlu disahkan oleh pegawai operasi.`;
    const key = JSON.stringify([fb]);
    const seq = ++_mobAISeq;
    if (_aiCache[key] && !failFlags.ai) {
      host.innerHTML = aiCard(_aiCache[key]);
      return;
    }
    host.innerHTML =
      '<div class="iv-ai" aria-busy="true"><h4>Ringkasan AI (simulasi, bukan keputusan)</h4><div class="iv-spin">Menjana ringkasan…</div></div>';
    const res = await callAI('explainMobilisation', { text: fb }, fb);
    if (seq !== _mobAISeq) return;
    const h = $i('ivMobAI');
    if (!h) return;
    const o = { text: res.text, ai: res.ai };
    if (res.ai) _aiCache[key] = o;
    h.innerHTML = aiCard(o);
  }
  const aiCard = (o) =>
    `<div class="iv-ai"><h4>Ringkasan AI (simulasi, bukan keputusan)</h4><div>${E(o.text)}</div>${o.ai ? '' : '<div class="iv-note">Penjelasan AI tidak tersedia, angka dikira oleh enjin.</div>'}<div class="iv-note">Model: ${aiAdapter.model}. Teks ini tidak menambah angka di luar blok pengiraan.</div></div>`;
  function ivRenderMobRes() {
    const s = ivState,
      r = mobResolve(),
      host = $i('ivMobRes');
    if (!r.po || !isKg(r.cm.id)) {
      host.innerHTML = '';
      return;
    }
    const eng = curEngine();
    if (!eng) {
      host.innerHTML = '';
      return;
    }
    let h = '';
    if (s.ui.scenPending)
      h += `<div class="iv-chips">${chip('Amaran cuaca/banjir AMS sedang dimuatkan', 'warn')}</div>`;
    else if (s.ui.scenError)
      h += `<div class="iv-chips">${chip('Data AMS tidak tersedia, hanya DATA.banjir digunakan', 'warn')}</div>`;
    const ad = disruptionLevel(r.po);
    if (ad)
      h += `<div class="iv-banner ${ad.level === 'Amaran' ? 'bad' : ''}">PO terpilih berada dalam ${ad.level === 'Amaran' ? 'amaran' : 'waspada'} banjir. Sahkan akses laluan sebelum menghantar. <small>(${E(ad.source)})</small></div>`;
    if (!eng.trigger.ok) {
      h += `<div class="iv-empty">PO terpilih tiada lebihan/kekurangan bekalan yang disahkan<br><small>${E(eng.trigger.text || '')}</small></div>`;
      host.innerHTML = h;
      return;
    }
    const tf = ivEngineFacts(r, eng);
    const empD =
        'Tiada PO dalam negeri yang layak. Sistem tidak menambah calon yang tidak memenuhi syarat.',
      empL =
        'Tiada PO luar negeri yang layak. Sistem tidak menambah calon yang tidak memenuhi syarat.';
    if (tf) {
      const t = tf.top;
      h += `<div class="iv-calc" id="ivMobSummary"><h4>Ringkasan Cadangan Mobilisasi ${tagD}</h4>
  <div class="iv-kv"><span>PO ${r.mode === 'pengguna' ? 'sumber' : 'destinasi'} dicadangkan<b>${E(t.name)}</b></span><span>Lokasi<b>${tf.inState ? 'Dalam negeri' : 'Luar negeri'} (${E(t.negeri)})</b></span><span>Kuantiti<b>${f2(t.qty)} MT</b></span><span>Anggaran jarak<b>${Math.round(t.km)} km</b></span></div>
  <div class="iv-note"><b>Mengapa:</b> skor tertinggi ${t.score}/100 dalam senarai ${tf.inState ? 'Dalam Negeri' : 'Luar Negeri'}; harga lebih baik daripada harga rujukan dan jarak ${Math.round(t.km)} km dalam had ${s.mob.distLimitKm} km. <b>Kekangan:</b> ${t.vehicleKnown ? 'kenderaan tersedia dihadkan kepada ' + f2(t.vehicleCapMT) + ' MT' : 'ketersediaan kenderaan semasa tidak diketahui (kapasiti maksimum statik ' + f2(t.maxCapMT) + ' MT)'}${t.sameGroup ? '; kapasiti logistik dikongsi dengan PO terpilih' : ''}${t.flood ? '; waspada banjir' : ''}. Stok: Belum disahkan.</div></div><div id="ivMobAI"></div>`;
    }
    h += `<div class="iv-two" style="margin-top:10px"><div><div class="iv-sec">TOP 5 PO DALAM NEGERI ${E(IV_POBY[r.po].negeri)} ${tagD}</div><div id="ivListDalam">${eng.dalam.length ? eng.dalam.map((c) => candCard(c, 'dalam')).join('') : `<div class="iv-empty">${empD}</div>`}</div></div>
 <div><div class="iv-sec">TOP 5 PO LUAR NEGERI ${tagD}</div><div id="ivListLuar">${eng.luar.length ? eng.luar.map((c) => candCard(c, 'luar')).join('') : `<div class="iv-empty">${empL}</div>`}</div></div></div>`;
    const all = [...eng.dalam, ...eng.luar];
    const sel = all.find((c) => c.poId === s.mob.candidateKey);
    if (sel) {
      const src = r.mode === 'pengguna' ? sel.name : poName(r.po),
        dst = r.mode === 'pengguna' ? poName(r.po) : sel.name;
      const risks = [];
      if (ad && ad.level === 'Amaran') risks.push('Destinasi/sumber terjejas banjir');
      if (sel.flood) risks.push('Waspada banjir pada ' + sel.name);
      if (sel.sameGroup) risks.push('Kapasiti kenderaan dikongsi dengan PO terpilih');
      if (!sel.vehicleKnown)
        risks.push(
          'Ketersediaan kenderaan semasa tidak diketahui. Kapasiti maksimum statik: ' +
            f2(sel.maxCapMT) +
            ' MT',
        );
      h += `<div class="iv-card" id="ivCandDetail" style="margin-top:10px"><h4>Butiran calon: ${E(sel.name)}</h4>
  <div class="iv-kv"><span>PO sumber<b>${E(src)}</b></span><span>PO destinasi<b>${E(dst)}</b></span><span>Komoditi<b>${E(commName(r.cm.id))}</b></span><span>Kuantiti<b>${f2(sel.qty)} MT</b></span><span>Jarak<b>${Math.round(sel.km)} km (anggaran dummy)</b></span><span>Status pengesahan stok<b>Belum disahkan</b></span></div>
  <ul class="iv-note"><li>Justifikasi: harga ${r.mode === 'pengguna' ? 'sumber' : 'destinasi'} ${rmAny(sel.price)} berbanding harga rujukan ${rmAny(r.ref)}, jarak ${Math.round(sel.km)} km.</li><li>Skor harga ${(sel.priceScore * 100).toFixed(0)}%, skor jarak ${(sel.distScore * 100).toFixed(0)}% (wajaran ${s.mob.wPrice}/${100 - s.mob.wPrice}).</li></ul>
  <div class="iv-sec">RISIKO PENGHANTARAN</div><ul class="iv-note">${risks.length ? risks.map((x) => `<li>${E(x)}</li>`).join('') : '<li>Tiada risiko tambahan dikesan oleh enjin.</li>'}</ul>
  <button type="button" class="button" id="ivDraftBtn" data-iv-act="draft">Sediakan Cadangan Intervensi</button> <span class="iv-note">Hanya draf (status: draf). Tiada kelulusan atau pelaksanaan automatik.</span></div>`;
    }
    h += `<details style="margin-top:10px"><summary class="iv-note" style="cursor:pointer">${eng.excluded.length} PO ditapis keluar</summary><ul class="iv-note" id="ivExcluded">${eng.excluded.map((x) => `<li>${E(x.name)}: ${E(x.reason)}</li>`).join('')}</ul></details>`;
    host.innerHTML = h;
    if (tf) ivFillMobAI(r, eng);
  }
  function createDraft() {
    const s = ivState,
      r = mobResolve(),
      eng = curEngine();
    if (!eng || !eng.trigger.ok) return;
    const all = [...eng.dalam, ...eng.luar];
    const c = all.find((x) => x.poId === s.mob.candidateKey);
    if (!c) return;
    const src = r.mode === 'pengguna' ? c.poId : r.po,
      dst = r.mode === 'pengguna' ? r.po : c.poId;
    if (
      ivDrafts.some(
        (d) =>
          d.status === 'draf' &&
          d.sourcePOId === src &&
          d.destinationPOId === dst &&
          d.commodityId === r.cm.id &&
          d.quantityMT === +c.qty.toFixed(2),
      )
    ) {
      toastSafe('Draf yang sama sudah wujud');
      return;
    }
    const ds = myDate(refNow).replace(/-/g, '');
    const suf =
      Math.max(
        0,
        ...ivDrafts
          .filter((d) => d.interventionId.startsWith('IV-' + ds + '-'))
          .map((d) => +d.interventionId.slice(-3) || 0),
      ) + 1;
    const ad = disruptionLevel(r.po);
    ivDrafts.push({
      interventionId: `IV-${ds}-${String(suf).padStart(3, '0')}`,
      mode: r.mode,
      status: 'draf',
      createdAt: refNow,
      sourcePOId: src,
      destinationPOId: dst,
      commodityId: r.cm.id,
      quantityMT: +c.qty.toFixed(2),
      distanceKm: Math.round(c.km),
      score: c.score,
      justification: `Harga ${r.mode === 'pengguna' ? 'sumber' : 'destinasi'} ${rmAny(c.price)} dan jarak ${Math.round(c.km)} km; skor ${c.score}/100.`,
      deliveryRisk:
        (ad && ad.level === 'Amaran'
          ? 'PO terpilih berada dalam amaran banjir. Sahkan akses laluan sebelum menghantar. '
          : '') + (c.vehicleKnown ? '' : 'Ketersediaan kenderaan tidak diketahui.'),
      stockVerification: 'belum disahkan',
      weights: { price: s.mob.wPrice, dist: 100 - s.mob.wPrice },
      createdBy: 'prototaip',
      source: 'dummy',
    });
    const ok = saveDrafts();
    toastSafe(
      ok
        ? 'Draf cadangan intervensi disediakan (status: draf)'
        : 'Draf disimpan sementara dalam sesi ini sahaja',
    );
    ivRender(['draft']);
    return true;
  }
  function ivRenderDrafts() {
    const box = $i('ivDraftBox');
    box.innerHTML = `<details style="margin-top:12px" ${ivDrafts.length ? 'open' : ''}><summary class="iv-sec" style="cursor:pointer">DRAF CADANGAN INTERVENSI (${ivDrafts.length}) ${tagD}</summary><div id="ivDrafts">${ivDrafts.length ? ivDrafts.map((d) => `<div class="iv-draft"><span><b>${E(d.interventionId)}</b> · ${E(commName(d.commodityId))} · ${E(poName(d.sourcePOId))} → ${E(poName(d.destinationPOId))} · ${f2(d.quantityMT)} MT · ${E(d.distanceKm)} km ${chip('status: draf', 'warn')}</span><button type="button" class="button tiny danger" data-iv-act="delDraft" data-iv-arg="${E(d.interventionId)}">Padam Draf</button></div>`).join('') : '<div class="iv-empty">Belum ada draf. Pilih calon dan tekan “Sediakan Cadangan Intervensi”.</div>'}</div></details>`;
  }

  /* ===== Paparan 5 ===== */
  function marCtx() {
    const po = effPO(),
      cm = effCommodity();
    return { po, cm };
  }
  function ivRenderMarDefs() {
    $i('ivMarDefs').innerHTML =
      `<div class="iv-defs"><p><b>Harga Borong Beli:</b> harga yang FAMA PO jual kepada pemborong luar.</p><p><b>Harga Borong Jual:</b> harga jualan borong yang diperhatikan dan dikutip oleh FAMA di pasaran terbuka.</p><p><b>Spread = Harga Borong Jual − Harga Borong Beli. Spread bukan margin operasi PO.</b></p><details class="iv-formula"><summary>Lihat formula pengiraan</summary><p class="iv-note">Harga Jualan PO (dalam formula) = Harga Borong Beli. Margin% = (Jualan − Ladang − Kos) ÷ Jualan × 100; Harga Ladang Maksimum = Jualan × (1 − sasaran) − Kos; Harga Jualan Minimum = (Ladang + Kos) ÷ (1 − sasaran).</p></details></div>`;
  }
  function seedMargin() {
    const { po, cm } = marCtx();
    const m = ivState.margin;
    const ctx = po + '|' + cm.id;
    if (!po || !isKg(cm.id)) {
      return;
    }
    if (m.ctx !== ctx && !m.touched) {
      const d = marginDefaults(po, cm.id);
      m.jual = d.jual != null ? String(d.jual) : '';
      m.beli = d.beli != null ? String(d.beli) : '';
      m.ladang = d.ladang != null ? String(d.ladang) : '';
      m.kos = String(d.kos);
      m.target = '15';
    }
    m.ctx = ctx;
  }
  function ivRenderMarCtl() {
    const { po, cm } = marCtx();
    const box = $i('ivMarCtl'),
      res = $i('ivMarRes');
    const m = ivState.margin;
    $i('ivMarChips').innerHTML = tagD + notApplicable('mar');
    if (!po) {
      box.innerHTML = '';
      res.innerHTML =
        '<div class="iv-empty">Pilih Pusat Operasi pada peta atau senarai keutamaan</div>';
      box.dataset.sig = '';
      return;
    }
    if (!isKg(cm.id)) {
      box.innerHTML = '';
      res.innerHTML = `<div class="iv-banner">Unit komoditi (${E(IV_COMMBY[cm.id].unit)}) tidak disokong untuk pengiraan MT dan RM/kg. Pilih komoditi RM/kg.</div>`;
      box.dataset.sig = '';
      return;
    }
    seedMargin();
    const sig = po + '|' + cm.id + '|' + m.ctx;
    if (box.dataset.sig === sig && box.firstChild) return;
    box.dataset.sig = sig;
    const d = marginDefaults(po, cm.id);
    box.innerHTML = `<div class="iv-chips"><span>PO:</span><select class="iv-in" style="width:auto" data-iv-sel="marpo" aria-label="PO simulasi margin">${IV_PO.map((p) => `<option value="${E(p.id)}"${p.id === po ? ' selected' : ''}>${E(p.name)}</option>`).join('')}</select>${chip('Komoditi: ' + IV_COMMBY[cm.id].name, 'info')}${cm.def ? chip('lalai (penapis ialah Semua)', 'warn') : ''}${d.override ? chip('nilai lalai ujian (dummy)', 'warn') : ''}<button type="button" class="button tiny ghost" data-iv-act="marReset">Pulih nilai lalai</button></div>
 <div class="iv-ctl">
 <label>Harga Borong Jual (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-jual" id="ivMJual" value="${E(m.jual)}"><span class="iv-err" id="ivMJualErr"></span></label>
 <label>Harga Borong Beli (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-beli" id="ivMBeli" value="${E(m.beli)}"><span class="iv-err" id="ivMBeliErr"></span></label>
 <label>Harga Belian Ladang (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-ladang" id="ivMLadang" value="${E(m.ladang)}"><span class="iv-err" id="ivMLadangErr"></span></label>
 <label>Kos Operasi (RM/kg)<input class="iv-in" type="number" step="0.01" data-iv-in="m-kos" id="ivMKos" value="${E(m.kos)}"><span class="iv-err" id="ivMKosErr"></span></label>
 <label>Margin Sasaran (%)<input class="iv-in" type="number" step="0.5" data-iv-in="m-target" id="ivMTarget" value="${E(m.target)}"><input type="range" min="0" max="95" step="1" data-iv-in="m-target-range" id="ivMTargetR" value="${E(Math.min(95, Math.max(0, Number(m.target) || 0)))}" aria-label="Margin sasaran"><span class="iv-err" id="ivMTargetErr"></span></label></div>`;
  }
  let _lastGoodMargin = null;
  function ivRenderMarRes() {
    const { po, cm } = marCtx();
    const host = $i('ivMarRes');
    const m = ivState.margin;
    if (!po || !isKg(cm.id)) return;
    const v = validateMargin(m);
    ['jual', 'beli', 'ladang', 'kos', 'target'].forEach((k) => {
      const id = {
        jual: 'ivMJual',
        beli: 'ivMBeli',
        ladang: 'ivMLadang',
        kos: 'ivMKos',
        target: 'ivMTarget',
      }[k];
      const inp = $i(id),
        er = $i(id + 'Err');
      if (!inp) return;
      if (v.err[k]) {
        inp.setAttribute('aria-invalid', 'true');
        if (er) er.textContent = v.err[k];
      } else {
        inp.removeAttribute('aria-invalid');
        if (er) er.textContent = '';
      }
    });
    const hist = historyOf(po, cm.id);
    const fl = ivPrice(po, cm.id, 'Ladang', 30);
    const ctx = { farmFloor: fl ? fl.floor : 0 };
    let note = '';
    if (v.ok) {
      _lastGoodMargin = { v: v.val, po, cm: cm.id };
    }
    const use = v.ok
      ? v.val
      : _lastGoodMargin && _lastGoodMargin.po === po && _lastGoodMargin.cm === cm.id
        ? _lastGoodMargin.v
        : null;
    if (!use) {
      host.innerHTML = `<div class="iv-banner">Masukkan nilai yang sah untuk melihat hasil simulasi. ${Object.values(v.err).map(E).join('. ')}</div>`;
      return;
    }
    if (!v.ok)
      note = `<div class="iv-banner">Input tidak sah (${Object.values(v.err).map(E).join('; ')}). Hasil terakhir yang sah dikekalkan.</div>`;
    const r = simulateMargin(use, hist, ctx);
    const warnBeli = r.buyAboveSell
      ? '<div class="iv-banner" id="ivWarnBeli">Harga Borong Beli melebihi Harga Borong Jual</div>'
      : '';
    const tile = (l, val) => `<div class="iv-stat"><div><b>${val}</b><span>${l}</span></div></div>`;
    let h =
      note +
      warnBeli +
      `<div class="iv-stats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))" id="ivMarSummary">${tile('Harga Borong Beli', rmAny(r.S))}${tile('Harga Borong Jual', rmAny(r.J))}${tile('Spread Semasa', sgn(r.spread) + ' RM/kg')}${tile('Margin Operasi PO Semasa', fin(r.cur) ? sgn(r.cur, 2) + ' %' : '—')}</div>`;
    const INF = 'Tiada julat harga yang memenuhi margin sasaran';
    const farm = r.farmOk
      ? `<div class="iv-big" id="ivMaxFarm">${rmPos(r.maxF)}</div><div class="iv-note">Harga belian maksimum</div><div class="iv-kv"><span>Julat dicadangkan<b>${rmPos(r.farmLow)} – ${rmPos(r.maxF)}</b></span><span>Kesan margin<b>${sgn(r.impact)} mata peratus</b></span></div>`
      : `<div class="iv-big">—</div><div class="iv-banner" id="ivFarmInf">${INF}</div>`;
    let sell;
    if (!r.enough)
      sell = `<div class="iv-big" id="ivMinSell">${rmPos(r.minS)}</div><div class="iv-note">Harga minimum untuk margin sasaran</div><div class="iv-banner" id="ivHistWarn">Data sejarah tidak mencukupi (${r.hs ? r.hs.n : 0} minggu, perlu sekurang-kurangnya ${IV_CONFIG.minHistory}). Julat sokongan pasaran tidak dipaparkan.</div>`;
    else if (r.sellOk)
      sell = `<div class="iv-big" id="ivSellRange">${rmPos(r.recLow)} – ${rmPos(r.recHigh)}</div><div class="iv-note">Julat jualan dicadangkan (julat dicadangkan, bukan nilai optimum)</div><div class="iv-kv"><span>Harga minimum untuk margin sasaran<b id="ivMinSell">${rmPos(r.minS)}</b></span><span>Margin pada hujung julat<b>${fin(r.marginAtLow) ? r.marginAtLow.toFixed(2) : '—'}% – ${fin(r.marginAtHigh) ? r.marginAtHigh.toFixed(2) : '—'}%</b></span><span>Julat sokongan pasaran<b>${rmPos(r.mLow)} – ${rmPos(r.mHigh)}</b></span></div>`;
    else
      sell = `<div class="iv-big">—</div><div class="iv-note">Harga minimum untuk margin sasaran: <b id="ivMinSell">${rmPos(r.minS)}</b></div><div class="iv-banner" id="ivSellInf">${INF}</div>`;
    h += `<div class="iv-two" style="margin-top:10px"><div class="iv-res-g" id="ivCardFarm"><h4>Cadangan Harga Belian Ladang</h4>${farm}</div><div class="iv-res-c" id="ivCardSell"><h4>Cadangan Harga Jualan Borong PO</h4>${sell}</div></div>`;
    const hs = r.hs;
    h += `<div class="iv-card" style="margin-top:10px" id="ivHistBlock"><h4>Analisis Spread Sejarah ${tagD}</h4>${hs ? `<div class="iv-kv"><span>Purata<b id="ivHMean">${f2(hs.mean)}</b></span><span>Median<b id="ivHMed">${f2(hs.median)}</b></span><span>Sisihan piawai<b id="ivHSd">${f2(hs.sd)}</b></span><span>Trend<b id="ivHTrend">${hs.trend}</b></span><span>Bilangan minggu<b>${hs.n}</b></span></div>` : '<div class="iv-note">Tiada data sejarah.</div>'}<div class="iv-note">Jika sejarah kurang daripada ${IV_CONFIG.minHistory} minggu, julat sokongan pasaran tidak dipaparkan. Sejarah ialah data dummy yang dijana secara deterministik.</div></div>`;
    const open = ivState.ui.marInsight;
    h += `<div style="margin-top:10px"><button type="button" class="button ghost" id="ivInsightBtn" data-iv-act="marInsight" aria-expanded="${open}">${open ? '▾' : '▸'} Pandangan AI Margin</button><div id="ivInsight" ${open ? '' : 'hidden'}></div></div>`;
    host.innerHTML = h;
    if (open) ivFillInsight(r, po, cm.id);
  }
  let _insSeq = 0;
  async function ivFillInsight(r, po, cid) {
    const host = $i('ivInsight');
    if (!host) return;
    const seq = ++_insSeq;
    const fb = `Margin semasa ${fin(r.cur) ? r.cur.toFixed(2) + '%' : 'tidak dapat dikira'} berbanding sasaran ${r.t.toFixed(2)}%. Harga belian ladang maksimum untuk sasaran ialah ${rmPos(r.maxF)} (semasa ${rmAny(r.F)}), jadi kemampanan harga belian ${r.F <= r.maxF ? 'mencukupi' : 'tidak mencukupi'}. Harga jualan minimum ialah ${rmPos(r.minS)} berbanding harga jualan semasa ${rmAny(r.S)}, jadi kecukupan harga jualan ${r.S >= r.minS ? 'mencukupi' : 'tidak mencukupi'}. Risiko harga jatuh: ${r.hs && r.hs.trend === 'turun' ? 'trend spread menurun' : 'tiada isyarat trend menurun'}. Cadangan pelarasan: ${r.F > r.maxF ? 'turunkan harga belian ladang atau naikkan harga jualan' : 'kekalkan dan pantau'}.`;
    host.innerHTML =
      '<div class="iv-ai" aria-busy="true"><div class="iv-spin">Menjana pandangan…</div></div>';
    const res = await callAI('explainMargin', { text: fb }, fb);
    if (seq !== _insSeq) return;
    const h = $i('ivInsight');
    if (!h) return;
    h.innerHTML = `<div class="iv-ai"><h4>Pandangan AI Margin (simulasi)</h4><div>${E(res.text)}</div>${res.ai ? '' : '<div class="iv-note">Penjelasan AI tidak tersedia, angka dikira oleh enjin.</div>'}<div class="iv-note">Nasihat sahaja dan tertakluk kepada pengesahan operasi.</div></div>`;
  }

  /* ===== Paparan 6 ===== */
  let museAll = [],
    museMeta = { dropped: 0, lastDataDate: '2026-11-14', processing: 'Siap' };
  const ivDataService = {
    loadMuse() {
      return new Promise((res, rej) => {
        setTimeout(() => {
          if (failFlags.muse) {
            failFlags.muse = false;
            rej(new Error('Kegagalan data Muse disuntik (ujian)'));
            return;
          }
          res({
            status: 'dummy',
            lastDataDate: '2026-11-14',
            processingStatus: 'Siap',
            records: IV_MUSE_RAW.map((x) => ({ ...x })),
          });
        }, 250);
      });
    },
  };
  async function ivLoadMuse() {
    ivState.muse.status = 'loading';
    ivRender(['muse']);
    try {
      const d = await ivDataService.loadMuse();
      const v = validateMuseRaw(d.records);
      const ex = await Promise.all(v.ok.map((r) => aiAdapter.extractMuseIssue(r)));
      museAll = ex.map((x) => x.data);
      museMeta = {
        dropped: v.dropped,
        lastDataDate: d.lastDataDate,
        processing: v.dropped ? `Sebahagian (${v.dropped} rekod tidak sah)` : d.processingStatus,
      };
      ivState.muse.status = 'ready';
    } catch (err) {
      console.warn('Data AI Muse tidak dapat dimuatkan', err && err.message);
      ivState.muse.status = 'error';
    }
    ivRender(['muse']);
  }
  function sparkline(i) {
    const pts = [i.riskBefore, i.riskCurrent, i.riskForward];
    const mx = Math.max(50, ...pts);
    const W = 160,
      H = 44;
    const xy = pts.map((v, k) => [10 + k * 70, H - 6 - (v / mx) * (H - 14)]);
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Trend risiko: sebelum ${i.riskBefore}, semasa ${i.riskCurrent}, ramalan ${i.riskForward}"><polyline fill="none" style="stroke:var(--cyan)" stroke-width="2" points="${xy.map((p) => p.join(',')).join(' ')}"/>${xy.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" style="fill:var(--cyan)"/>`).join('')}</svg>`;
  }
  function museInsightText(i) {
    let x = String(i.summary || '');
    const lb = i.commodityLabel ? i.commodityLabel + ': ' : '';
    if (lb && x.startsWith(lb)) x = x.slice(lb.length);
    x = x.replace(/^[^:.;]{1,40}:\s+/, '');
    let dt = '';
    x = x.replace(
      /(^|\s)pada\s+(\d{1,2})\s+(Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember)(?:\s+(\d{4}))?/i,
      (m, p, d, mn, y) => {
        dt = d + ' ' + mn.slice(0, 3) + (y ? ' ' + y : '');
        return p;
      },
    );
    x = x
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/[\s;:,.]+$/, '')
      .trim();
    if (!x) x = i.analystNote || '';
    x = x.charAt(0).toUpperCase() + x.slice(1);
    return x + (dt ? ' (' + dt + ')' : '') + '.';
  }
  function museShortDate(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    return d + ' ' + MY_MONTHS[m - 1].slice(0, 3);
  }
  function museSentLbl(v) {
    return v < -0.15 ? 'Negatif' : v > 0.15 ? 'Positif' : 'Neutral';
  }
  function ivRenderMuse() {
    const s = ivState,
      body = $i('ivMuseBody'),
      ms = s.muse;
    $i('ivMuseChips').innerHTML = tagD + chip('Kelompok harian', 'grey') + notApplicable('muse');
    if (ms.status === 'loading') {
      body.innerHTML = '<div class="iv-empty" aria-busy="true">Memuatkan data AI Muse…</div>';
      return;
    }
    if (ms.status === 'error') {
      body.innerHTML =
        '<div class="iv-banner bad">Data AI Muse tidak dapat dimuatkan <button type="button" class="button tiny" data-iv-act="museRetry">Cuba Semula</button></div>';
      return;
    }
    const ws = ms.weekStart,
      cur = weekStart(myDate(refNow));
    let list = museWeekList(museAll, ws);
    const f = ivState;
    list = list.filter(
      (i) =>
        (!f.selectedCommodityId || i.commodityId === f.selectedCommodityId) &&
        (!f.selectedStateId || i.stateId === f.selectedStateId) &&
        (!f.selectedPOId || i.matchedPOId === f.selectedPOId) &&
        (!f.selectedDistrictId || i.districtId === f.selectedDistrictId) &&
        (f.selectedRisk === 'all' ||
          i.riskBand === { kritikal: 'merah', waspada: 'kuning', normal: 'hijau' }[f.selectedRisk]),
    );
    list = list
      .slice()
      .sort(
        (p, q) =>
          ({ merah: 0, kuning: 1, hijau: 2 })[p.riskBand] -
            { merah: 0, kuning: 1, hijau: 2 }[q.riskBand] ||
          q.riskCurrent - q.riskBefore - (p.riskCurrent - p.riskBefore),
      );
    const nCrit = list.filter((i) => i.riskBand === 'merah').length;
    const stale = museMeta.lastDataDate < addDays(myDate(refNow), -1);
    const minWs = weekStart(addDays(museEarliest(), -14));
    let h = `${stale ? `<div class="iv-banner">Data lapuk: kemas kini terakhir pada ${fmtDate(museMeta.lastDataDate)}</div>` : ''}
 <div class="iv-mu-bar">
  <div class="iv-mu-nav"><span class="iv-sec">MINGGU ANALISIS</span><button type="button" class="button tiny ghost" data-iv-act="museWeek" data-iv-arg="prev" aria-label="Minggu sebelum" ${addDays(ws, -7) < minWs ? 'disabled' : ''}>◀</button><b id="ivWeekLbl">${fmtWeek(ws)}</b><button type="button" class="button tiny ghost" data-iv-act="museWeek" data-iv-arg="next" aria-label="Minggu seterusnya" ${ws >= cur ? 'disabled' : ''}>▶</button><button type="button" class="button tiny" data-iv-act="museWeek" data-iv-arg="now">Minggu ini</button></div>
  <div class="iv-mu-last">${list.length ? `<span class="iv-mu-n" id="ivMuseCount">${list.length} isu${nCrit ? ` · ${nCrit} kritikal` : ''}</span><span aria-hidden="true">|</span>` : ''}<span title="Minggu Isnin hingga Ahad, waktu Malaysia (UTC+8)">Tarikh data terakhir</span><b>${fmtDate(museMeta.lastDataDate)}</b></div>
  </div><div style="margin-top:12px" id="ivMuseCards">`;
    if (!list.length)
      h +=
        '<div class="iv-empty" id="ivMuseEmpty">Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini</div>';
    list.forEach((i) => {
      const open = ms.expandedId === i.insightId,
        ev = !!ms.evidenceOpen[i.insightId],
        id = E(i.insightId);
      const bc = i.riskBand === 'merah' ? 'bad' : i.riskBand === 'kuning' ? 'warn' : 'ok';
      const ch = i.riskCurrent - i.riskBefore;
      const bandL = i.riskBand === 'merah' ? 'Merah' : i.riskBand === 'kuning' ? 'Kuning' : 'Hijau';
      const dir = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat',
        arr = ch > 0 ? '↑' : ch < 0 ? '↓' : '→';
      const ltl = {
        disahkan: 'Lokasi acara disahkan',
        disebut: 'Lokasi hanya disebut',
        belum: 'Lokasi belum disahkan',
      }[i.locationType];
      const canX = !!(i.matchedPOId && i.commodityId && IV_COMMBY[i.commodityId]);
      const dummy = /dummy/i.test(i.sourceName || '') || i.source === 'dummy';
      h += `<article class="iv-muse-card" data-band="${i.riskBand}" data-open="${open}" data-id="${id}" aria-label="${E(i.commodityLabel)}, Risiko ${bandL}">
  <button type="button" class="iv-mc-head" aria-expanded="${open}" data-iv-act="museExp" data-iv-arg="${id}"><span class="iv-mc-t">${E(i.commodityLabel)}</span>${chip(i.location.label)}<span class="iv-chip ${bc}">Risiko ${bandL} <span class="iv-tr ${dir}">${i.riskCurrent} ${arr} ${sgn(ch, 0)}</span></span><span class="iv-mc-date">tarikh acara ${museShortDate(i.eventDate)}</span></button>
  <p class="iv-mc-ins">${E(museInsightText(i))}</p>
  <div class="iv-mc-act"><h4>Tindakan disyorkan</h4><ul>${i.suggestedActions
    .slice(0, 2)
    .map((a) => `<li>${E(a)}</li>`)
    .join(
      '',
    )}</ul><div class="iv-mc-po">${canX ? `PO berkaitan: <b>${E(poName(i.matchedPOId))}</b>` : 'PO belum disahkan'}</div>
  <div class="iv-mc-btns">${canX ? `<button type="button" class="button" data-iv-act="museXfer" data-iv-arg="${id}">Buka Tindakan Intervensi</button>` : ''}<button type="button" class="button tiny ghost iv-mc-more" data-iv-act="museExp" data-iv-arg="${id}" aria-expanded="${open}">${open ? 'Tutup butiran' : 'Butiran'}</button></div></div>`;
      if (open) {
        h += `<div class="iv-muse-x"><div class="iv-kv"><span>Risiko sebelum → semasa<b>${i.riskBefore} → ${i.riskCurrent} (${sgn(ch, 0)})</b></span><span>Indeks sentimen<b>${f2(i.sentimentIndex)} (${museSentLbl(i.sentimentIndex)})</b></span><span>Bilangan sampel<b>${i.sampleCount}</b></span><span>Jenis lokasi<b>${ltl} (${Math.round(i.locationConfidence * 100)}%)</b></span><span>Sumber<b>${E(i.sourceName)}</b></span><span>PO berkaitan<b>${i.matchedPOId ? E(poName(i.matchedPOId)) : 'Belum disahkan'}</b></span></div>
   ${dummy ? tagD : ''}<div class="iv-note">${E(i.explanation)}</div><div class="iv-sec">TREND RISIKO</div>${sparkline(i)}
   <div class="iv-fix"><button type="button" class="button tiny ghost" data-iv-act="museEv" data-iv-arg="${id}" aria-expanded="${ev}">Lihat Butiran Bukti</button>${canX ? '' : `<span class="iv-note">Padanan daerah kepada PO masih memerlukan pengesahan.</span>`}</div>
   ${ev ? `<div class="iv-sec">BUKTI SUMBER</div>${i.evidence.map((e) => `<div class="iv-ev">“${E(e.quote)}”<br><small>${E(e.sourceName)} · ${fmtDate(e.date)}</small></div>`).join('')}` : ''}</div>`;
      }
      h += '</article>';
    });
    h +=
      '</div><details class="iv-crit" id="ivMuseCrit"><summary>Kriteria isu</summary><p>Isu dipaparkan jika komoditi dan lokasi acara disahkan, tarikh acara (bukan tarikh rekod) dalam minggu dipilih, berkaitan bekalan atau harga, dan bukan pendua. Sentimen negatif sahaja bukan kekurangan bekalan.</p></details>';
    body.innerHTML = h;
  }

  /* ===== Render ===== */
  const _pan = {
    filters: ivRenderFilters,
    map: ivRenderMap,
    log: ivRenderLog,
    pri: ivRenderPri,
    mob: () => {
      ivRenderMobCtl();
      ivRenderMobRes();
    },
    mobres: () => {
      ivRenderMobCtl();
      ivRenderMobRes();
    },
    draft: ivRenderDrafts,
    mar: () => {
      ivRenderMarDefs();
      ivRenderMarCtl();
      ivRenderMarRes();
    },
    marres: () => {
      ivRenderMarCtl();
      ivRenderMarRes();
    },
    muse: ivRenderMuse,
  };
  const DEP = {};
  function ivRender(keys) {
    const set = new Set(keys || ALL_PANELS);
    const order = [
      'filters',
      'map',
      'log',
      'pri',
      'mob',
      'mobres',
      'draft',
      'mar',
      'marres',
      'muse',
    ];
    order.forEach((k) => {
      if (!set.has(k)) return;
      if (k === 'mobres' && set.has('mob')) return;
      if (k === 'marres' && set.has('mar')) return;
      try {
        _pan[k]();
      } catch (err) {
        console.error('Paparan gagal dipaparkan:', k, err);
        const t = {
          filters: 'ivFilters',
          map: 'ivMapChips',
          log: 'ivLogBody',
          pri: 'ivPriList',
          mob: 'ivMobRes',
          mobres: 'ivMobRes',
          draft: 'ivDraftBox',
          mar: 'ivMarRes',
          marres: 'ivMarRes',
          muse: 'ivMuseBody',
        }[k];
        const e = $i(t);
        if (e)
          e.innerHTML = `<div class="iv-banner bad">Paparan ini tidak dapat dipaparkan. Cuba semula <button type="button" class="button tiny" data-iv-act="retryPanel">Cuba Semula</button></div>`;
      }
    });
    try {
      mdCtx();
    } catch (e) {
      console.error(e);
    }
  }
  function ivRenderAll() {
    ivRender(ALL_PANELS);
  }
  let _scenSig = '';
  function scenSig() {
    return JSON.stringify(
      ivScenarios().map((s) => [s.scenarioId, s.riskLevel, s.affectedPOIds, s.validUntil]),
    );
  }
  function ivRefreshScenarios(force) {
    const sg = scenSig();
    if (sg !== _scenSig || force) {
      _scenSig = sg;
      ivRender(['map', 'pri', 'mob', 'log']);
    }
  }

  /* ===== Pengendali acara ===== */
  /* ===== Pop-up Mobilisasi Stok & Simulasi Margin ===== */
  const MD = {
    open: false,
    tab: 'mob',
    opener: null,
    openerSel: null,
    timer: null,
    prevOv: '',
    prevPad: '',
  };
  const MD_TABS = ['mob', 'mar'];
  const mdTabEl = (k) => $i(k === 'mob' ? 'ivMdTabMob' : 'ivMdTabMar');
  function mdSetTab(t, focus) {
    if (!MD_TABS.includes(t)) t = 'mob';
    MD.tab = t;
    try {
      sessionStorage.setItem('ivMdTab', t);
    } catch (e) {}
    MD_TABS.forEach((k) => {
      const b = mdTabEl(k),
        on = k === t;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      $i(k === 'mob' ? 'ivMobPanel' : 'ivMarPanel').hidden = !on;
    });
    $i('ivMdBody').scrollTop = 0;
    if (focus) mdTabEl(t).focus();
  }
  function mdCtx() {
    const host = $i('ivMdCtx');
    if (!host) return;
    const po = effPO(),
      cm = effCommodity();
    host.innerHTML =
      chip(po ? 'PO terpilih: ' + poName(po) : 'PO belum dipilih', po ? 'info' : 'grey') +
      chip('Komoditi: ' + commName(cm.id), 'info') +
      chip('Mod: ' + modeLbl(ivState.selectedMode), 'grey');
  }
  function mdOpen(tab, opener) {
    const back = $i('ivMd');
    if (MD.open) {
      mdSetTab(tab || MD.tab);
      mdCtx();
      return;
    }
    clearTimeout(MD.timer);
    MD.opener = opener || null;
    MD.openerSel = null;
    if (opener && opener.dataset && opener.dataset.ivAct) {
      const a = opener.dataset.ivAct,
        g = opener.dataset.ivArg;
      MD.openerSel =
        `[data-iv-act="${a}"]` +
        (g != null ? `[data-iv-arg="${String(g).replace(/["\\]/g, '\\$&')}"]` : '');
    }
    MD.open = true;
    mdCtx();
    mdSetTab(tab || MD.tab);
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    MD.prevOv = document.body.style.overflow;
    MD.prevPad = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
    document.body.classList.add('iv-md-open');
    back.hidden = false;
    void back.offsetWidth;
    back.classList.add('open');
    mdTabEl(MD.tab).focus({ preventScroll: true });
  }
  function mdClose(restore) {
    if (!MD.open) return;
    MD.open = false;
    const back = $i('ivMd');
    back.classList.remove('open');
    document.body.style.overflow = MD.prevOv;
    document.body.style.paddingRight = MD.prevPad;
    document.body.classList.remove('iv-md-open');
    const fin = () => {
      if (!MD.open) back.hidden = true;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fin();
    else MD.timer = setTimeout(fin, 200);
    if (restore !== false) {
      let o = MD.opener;
      if (!(o && o.isConnected) && MD.openerSel)
        o = document.querySelector('#viewIntervensi ' + MD.openerSel);
      if (o && o.focus) o.focus({ preventScroll: true });
    }
  }
  (function () {
    let down = false;
    const back = $i('ivMd'),
      dlg = $i('ivMdDlg');
    try {
      const st = sessionStorage.getItem('ivMdTab');
      if (MD_TABS.includes(st)) MD.tab = st;
    } catch (e) {}
    $i('ivMdClose').addEventListener('click', () => mdClose());
    back.addEventListener('pointerdown', (e) => {
      down = e.target === back;
    });
    back.addEventListener('click', (e) => {
      if (e.target === back && (down || e.detail === 0)) mdClose();
      down = false;
    });
    MD_TABS.forEach((k) => mdTabEl(k).addEventListener('click', () => mdSetTab(k)));
    $i('ivMdTabMob').parentNode.addEventListener('keydown', (e) => {
      const i = MD_TABS.indexOf(MD.tab);
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % MD_TABS.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        n = (i + MD_TABS.length - 1) % MD_TABS.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = MD_TABS.length - 1;
      if (n === null) return;
      e.preventDefault();
      mdSetTab(MD_TABS[n], true);
    });
    document.addEventListener(
      'keydown',
      (e) => {
        if (!MD.open) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          mdClose();
          return;
        }
        if (e.key !== 'Tab') return;
        const f = [
          ...dlg.querySelectorAll(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((x) => x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden');
        if (!f.length) {
          e.preventDefault();
          dlg.focus();
          return;
        }
        const first = f[0],
          last = f[f.length - 1],
          ac = document.activeElement,
          inside = dlg.contains(ac) && ac !== dlg;
        if (e.shiftKey && (!inside || ac === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || ac === last)) {
          e.preventDefault();
          first.focus();
        }
      },
      true,
    );
  })();
  const root = $i('viewIntervensi');
  function mobField(id, errId, val, lo, hi, msg) {
    const inp = $i(id),
      er = $i(errId);
    const ok = Number.isFinite(val) && val >= lo && val <= hi;
    if (ok) {
      inp.removeAttribute('aria-invalid');
      if (er) er.textContent = '';
    } else {
      inp.setAttribute('aria-invalid', 'true');
      if (er) er.textContent = msg;
    }
    return ok;
  }
  function onAct(el, ev) {
    const a = el.dataset.ivAct,
      arg = el.dataset.ivArg;
    switch (a) {
      case 'mode':
        ivDispatch('setMode', arg);
        break;
      case 'reset':
        ivDispatch('resetFilters');
        $i('ivMobCtl').dataset.sig = '';
        $i('ivMarCtl').dataset.sig = '';
        toastSafe('Penapis dan paparan disetkan semula');
        break;
      case 'backMY':
        ivState.selectedStateId = null;
        ivDispatch('setFilter', ['po', 'all']);
        break;
      case 'outCat':
        ivDispatch('toggleOutletCat', arg);
        break;
      case 'district':
        ivDispatch('selectDistrict', arg);
        break;
      case 'selPO':
        ivDispatch('selectPO', arg);
        break;
      case 'selRow': {
        const r = recsNow().find((x) => x.id === arg);
        if (r) {
          ivState.selectedInterventionId = r.id;
          ivRender(['log', 'pri', 'mob', 'mar']);
        }
        break;
      }
      case 'tindakan':
        if (ivDispatch('selectIntervention', arg) === true) mdOpen('mob', el);
        break;
      case 'showAll':
        ivState.ui.showAll = !ivState.ui.showAll;
        ivRender(['pri']);
        break;
      case 'openMob':
        mdOpen('mob', el);
        break;
      case 'cand':
        ivDispatch('selectCandidate', arg);
        break;
      case 'draft':
        createDraft();
        break;
      case 'delDraft':
        ivDispatch('deleteDraft', arg);
        break;
      case 'resetNeed':
        $i('ivMobCtl').dataset.sig = '';
        ivDispatch('setMob', ['resetNeed']);
        break;
      case 'resetRef':
        $i('ivMobCtl').dataset.sig = '';
        ivDispatch('setMob', ['resetRef']);
        break;
      case 'marReset':
        $i('ivMarCtl').dataset.sig = '';
        ivDispatch('resetMargin');
        break;
      case 'marInsight':
        ivState.ui.marInsight = !ivState.ui.marInsight;
        ivRender(['marres']);
        break;
      case 'museWeek':
        ivDispatch('museWeek', arg);
        break;
      case 'museExp':
        ivDispatch('museExpand', arg);
        break;
      case 'museEv':
        ivDispatch('museEvidence', arg);
        break;
      case 'museXfer':
        if (ivDispatch('museTransfer', arg) === true) mdOpen('mob', el);
        break;
      case 'museRetry':
        ivLoadMuse();
        break;
      case 'mapRetry':
        ivRetryMap();
        break;
      case 'retryPanel':
        ivRenderAll();
        break;
    }
  }
  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-iv-act]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A') ev.preventDefault();
    onAct(el, ev);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = ev.target.closest && ev.target.closest('[data-iv-act]');
    if (
      !el ||
      el !== ev.target ||
      el.tagName === 'BUTTON' ||
      el.tagName === 'A' ||
      el.tagName === 'INPUT'
    )
      return;
    ev.preventDefault();
    onAct(el, ev);
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target;
    const k = t.dataset && t.dataset.ivSel;
    if (!k) return;
    if (k === 'marpo') {
      ivDispatch('selectPO', t.value);
      return;
    }
    ivDispatch('setFilter', [k, t.value]);
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target;
    const k = t.dataset && t.dataset.ivIn;
    if (t.dataset && t.dataset.ivThr) {
      const [m, w] = t.dataset.ivThr.split('.');
      const v = Number(t.value);
      const ok =
        t.value !== '' && Number.isFinite(v) && ivDispatch('setThreshold', [m, w, v]) !== false;
      if (ok) {
        t.removeAttribute('aria-invalid');
        $i('ivThrErr').textContent = '';
        ivRender(ALL_PANELS);
      } else {
        t.setAttribute('aria-invalid', 'true');
        $i('ivThrErr').textContent =
          'Ambang tidak sah: amaran antara 1 dan 50; kritikal lebih besar daripada amaran dan tidak melebihi 90';
      }
      return;
    }
    if (!k) return;
    if (k === 'need') {
      const v = Number(t.value);
      if (
        t.value !== '' &&
        mobField('ivNeed', 'ivNeedErr', v, 0.1, 500, 'Masukkan 0.1 hingga 500 MT')
      )
        ivDispatch('setMob', ['need', v]);
      else mobField('ivNeed', 'ivNeedErr', NaN, 0.1, 500, 'Masukkan 0.1 hingga 500 MT');
    } else if (k === 'ref') {
      const v = Number(t.value);
      if (
        t.value !== '' &&
        mobField('ivRef', 'ivRefErr', v, 0.01, 999, 'Masukkan harga RM/kg antara 0.01 dan 999')
      )
        ivDispatch('setMob', ['ref', v]);
      else
        mobField('ivRef', 'ivRefErr', NaN, 0.01, 999, 'Masukkan harga RM/kg antara 0.01 dan 999');
    } else if (k === 'limit') {
      const v = Number(t.value);
      if (
        t.value !== '' &&
        mobField('ivLimit', 'ivLimitErr', v, 50, 2000, 'Masukkan 50 hingga 2000 km')
      )
        ivDispatch('setMob', ['limit', v]);
      else mobField('ivLimit', 'ivLimitErr', NaN, 50, 2000, 'Masukkan 50 hingga 2000 km');
    } else if (k === 'wp' || k === 'wd') {
      const raw = Number(t.value);
      const wp = k === 'wp' ? raw : 100 - raw;
      ivDispatch('setMob', ['wPrice', wp]);
      const w = ivState.mob.wPrice;
      $i('ivWP').value = w;
      $i('ivWD').value = 100 - w;
      $i('ivWPL').textContent = w + '%';
      $i('ivWDL').textContent = 100 - w + '%';
      $i('ivWTotal').innerHTML = `Jumlah wajaran: <b>${w}% + ${100 - w}% = 100%</b>`;
    } else if (k.startsWith('m-')) {
      const f = k.slice(2);
      if (f === 'target-range') {
        ivDispatch('setMargin', ['target', t.value]);
        $i('ivMTarget').value = t.value;
      } else {
        ivDispatch('setMargin', [f, t.value]);
        if (f === 'target') {
          const n = Number(t.value);
          if (Number.isFinite(n)) $i('ivMTargetR').value = Math.min(95, Math.max(0, n));
        }
      }
    }
  });
  $i('ivFilterToggle').addEventListener('click', () => {
    const f = $i('ivFilters');
    const c = f.classList.toggle('iv-collapsed');
    $i('ivFilterToggle').setAttribute('aria-expanded', String(!c));
  });

  /* ===== Tab ===== */
  const tabM = $i('ivTabMonitor'),
    tabI = $i('ivTabIv'),
    viewM = $i('viewMonitor');
  let ivInited = false,
    ivActive = 'pemantauan';
  function writeHash(h) {
    try {
      history.replaceState(null, '', '#' + h);
    } catch (_) {
      try {
        location.hash = h;
      } catch (__) {}
    }
  }
  function showTab(which, opts) {
    opts = opts || {};
    ivActive = which;
    const iv = which === 'intervensi';
    tabM.setAttribute('aria-selected', String(!iv));
    tabI.setAttribute('aria-selected', String(iv));
    tabM.tabIndex = iv ? -1 : 0;
    tabI.tabIndex = iv ? 0 : -1;
    viewM.hidden = iv;
    root.hidden = !iv;
    document.body.dataset.ivTab = iv ? 'intervensi' : 'pemantauan';
    if (!opts.noHash) writeHash(iv ? 'intervensi' : 'pemantauan');
    if (iv) {
      if (!ivInited) {
        ivInited = true;
        ivInit();
      }
      requestAnimationFrame(() => {
        if (!ivMap && !ivState.ui.mapError) ivInitMap();
        if (ivMap) {
          try {
            ivMap.resize();
          } catch (_) {}
        }
        ivRefreshScenarios(false);
        ivRender(['map']);
      });
    } else {
      requestAnimationFrame(() => {
        try {
          if (window.famaMonitorMapResize) window.famaMonitorMapResize();
        } catch (_) {}
      });
    }
  }
  tabM.addEventListener('click', () => showTab('pemantauan'));
  tabI.addEventListener('click', () => showTab('intervensi'));
  [tabM, tabI].forEach((t) =>
    t.addEventListener('keydown', (ev) => {
      const order = [tabM, tabI];
      let i = order.indexOf(t);
      if (ev.key === 'ArrowRight') i = (i + 1) % 2;
      else if (ev.key === 'ArrowLeft') i = (i + 1) % 2;
      else if (ev.key === 'Home') i = 0;
      else if (ev.key === 'End') i = 1;
      else return;
      ev.preventDefault();
      order[i].focus();
      showTab(i === 1 ? 'intervensi' : 'pemantauan');
    }),
  );

  function ivInit() {
    ivState.ui.scenPending = !scenSettled;
    ivRenderMarDefs();
    ivRenderAll();
    ivLoadMuse();
    const sp = window.famaScenariosReady;
    if (sp && typeof sp.then === 'function') {
      const done = () => {
        scenSettled = true;
        ivState.ui.scenPending = false;
        ivState.ui.scenError = ivState.ui.scenError || false;
        ivRefreshScenarios(true);
        ivRender(['mob']);
      };
      sp.then(done, (e) => {
        ivState.ui.scenError = true;
        done();
      });
    }
  }
  let scenSettled = false;
  if (window.famaScenariosReady && typeof window.famaScenariosReady.then === 'function')
    window.famaScenariosReady.then(
      () => {
        scenSettled = true;
      },
      () => {
        scenSettled = true;
      },
    );
  else scenSettled = true;

  /* Pautan dalam (hash): hanya selepas load dan senario selesai */
  (function () {
    const want = (location.hash || '').toLowerCase();
    if (want !== '#intervensi') return;
    const loadP =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((r) => window.addEventListener('load', r, { once: true }));
    const sp =
      window.famaScenariosReady && window.famaScenariosReady.then
        ? window.famaScenariosReady
        : Promise.resolve();
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      showTab('intervensi', { noHash: true });
    };
    Promise.allSettled([loadP, sp]).then(() => requestAnimationFrame(apply));
    setTimeout(apply, 3000);
  })();

  /* ===== Hook ujian ===== */
  window.IV_TEST = {
    state: () => JSON.parse(JSON.stringify(ivState)),
    outletStats,
    dispatch: ivDispatch,
    refresh: () => ivRefreshScenarios(true),
    setScenariosPending: (b) => {
      ivState.ui.scenPending = !!b;
      ivRender(['mob']);
    },
    ivClassify,
    supplyConfirm,
    priorityScore,
    mobilisationEngine,
    marginPct,
    maxFarmPrice,
    minSell,
    historyStats,
    weekStart,
    weekRange,
    extractMuseIssue,
    museInclude,
    validateMuseRaw,
    ivValidateAi,
    map: () => ivMap,
    drafts: () => JSON.parse(JSON.stringify(ivDrafts)),
    failNext: (k) => {
      if (k in failFlags) failFlags[k] = true;
    },
    withholdDistrictMap: (id) => {
      ivWithheld[id] = true;
      ivRender(ALL_PANELS);
    },
    setRefNow: (iso) => {
      refNow = iso;
      ivRender(ALL_PANELS);
    },
    engine: curEngine,
    priRows: () =>
      priRows().map((r) => ({
        id: r.id,
        level: r.cls.level,
        score: r.score,
        label: issueLabel(r),
        flag: r.cls.flag,
        po: r.poId,
        district: r.district,
        commodity: r.commodityId,
      })),
    poLevel,
    museAll: () => museAll.map((x) => ({ ...x })),
    config: () => IV_CONFIG,
    resolveMob: mobResolve,
    marginDefaults,
    simulateMargin,
    validateMargin,
    historyOf,
    ivPrice,
  };
})();

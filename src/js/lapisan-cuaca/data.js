'use strict';
// Pemuat data lapisan cuaca: hanya /api/* (same-origin). Hasil disimpan dalam memori sepanjang sesi.
(function () {
  const NS = (window.FamaCuaca = window.FamaCuaca || {});
  const MS_META = 5 * 60000;
  const MS_LAIN = 5 * 60000;

  async function json(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }

  const D = {
    meta: null,
    metaMasa: 0,
    vars: new Map(), // nama -> Promise<{unit, skala, jam: Float32Array[]}>
    radar: null,
    satelit: null,
    siklon: null,
  };

  // Meta dimuat semula jika lebih 5 min; jika fetchedAt berubah, semua pembolehubah dibuang.
  async function muatMeta(paksa) {
    const kini = Date.now();
    if (D.meta && !paksa && kini - D.metaMasa < MS_META) return D.meta;
    const m = await json('/api/grid/meta');
    if (D.meta && D.meta.fetchedAt !== m.fetchedAt) D.vars.clear();
    D.meta = m;
    D.metaMasa = kini;
    return m;
  }

  function muatVar(nama) {
    if (D.vars.has(nama)) return D.vars.get(nama);
    const p = json('/api/grid?var=' + encodeURIComponent(nama)).then((b) => {
      const jam = b.data.map((baris) => {
        const f = new Float32Array(baris.length);
        for (let i = 0; i < baris.length; i++) f[i] = baris[i] === null ? NaN : baris[i] / b.skala;
        return f;
      });
      return { unit: b.unit, skala: b.skala, nx: b.nx, ny: b.ny, jam };
    });
    D.vars.set(nama, p);
    p.catch(() => D.vars.delete(nama));
    return p;
  }

  async function muatLain(kunci, url) {
    const kini = Date.now();
    if (D[kunci] && kini - D[kunci].masa < MS_LAIN) return D[kunci].data;
    const data = await json(url);
    D[kunci] = { masa: kini, data };
    return data;
  }

  async function muatTitik(lat, lon) {
    return json(
      '/api/grid/titik?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon),
    );
  }

  NS.data = {
    muatMeta,
    muatVar,
    muatTitik,
    muatRadar: () => muatLain('radar', '/api/radar'),
    muatSatelit: () => muatLain('satelit', '/api/satelit'),
    muatSiklon: () => muatLain('siklon', '/api/siklon'),
    meta: () => D.meta,
  };
})();

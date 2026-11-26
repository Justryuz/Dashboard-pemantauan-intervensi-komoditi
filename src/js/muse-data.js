/* Pemuat data AI Muse yang dikongsi (Intervensi dan panel EWS (AI) di Pemantauan).
   Hanya memanggil /api/muse same-origin; tiada kunci atau rahsia dalam pelayar. */
(function () {
  let cache = null;
  function ambil(minggu) {
    if (location.protocol === 'file:') {
      const e = new Error('Memerlukan pelayan');
      e.kind = 'file';
      return Promise.reject(e);
    }
    return fetch('/api/muse' + (minggu ? '?minggu=' + encodeURIComponent(minggu) : ''), {
      headers: { Accept: 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((d) => {
        if (!d || !Array.isArray(d.rekod) || typeof d.minggu !== 'string')
          throw new Error('Respons AI Muse tidak sah');
        d.mingguTersedia = Array.isArray(d.mingguTersedia) ? d.mingguTersedia : [];
        return d;
      });
  }
  // reuse=true: muat sekali sahaja untuk minggu semasa dan kongsi hasilnya (termasuk ralat) antara
  // EWS dan Intervensi semasa halaman dimuat. Cuba semula memanggil tanpa reuse (ambil baharu).
  function load(minggu, opts) {
    const reuse = !!(opts && opts.reuse) && !minggu;
    if (reuse && cache) return cache;
    const p = ambil(minggu);
    if (reuse) cache = p;
    else if (!minggu)
      p.then(
        () => (cache = p),
        () => {},
      );
    return p;
  }
  window.FamaMuse = { load };
})();

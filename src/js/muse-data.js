/* Pemuat data AI Muse yang dikongsi (Intervensi dan panel EWS (AI) di Pemantauan).
   Hanya memanggil /api/muse same-origin; tiada kunci atau rahsia dalam pelayar. */
(function () {
  let cache = null;
  // 202 = pelayan masih membina cache dari Google Drive (larian pertama). Tunggu Retry-After dan cuba semula.
  const MAKS_TUNGGU = 30; // ~5 minit pada 10 s setiap cubaan
  const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
  function ambil(minggu, onPending, cubaan = 0) {
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
        if (r.status === 202) {
          if (cubaan >= MAKS_TUNGGU) throw new Error('Data AI Muse masih dikemas kini');
          if (typeof onPending === 'function') onPending();
          const s = Math.min(60, Math.max(3, Number(r.headers.get('Retry-After')) || 10));
          return tidur(s * 1000).then(() => ambil(minggu, onPending, cubaan + 1));
        }
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
  // Pemanggil yang berkongsi promise yang sama (reuse) juga dimaklumkan jika pelayan membalas 202.
  let pendengarKongsi = [];
  let kongsiMenunggu = false;
  function load(minggu, opts) {
    const reuse = !!(opts && opts.reuse) && !minggu;
    const onPending = opts && typeof opts.onPending === 'function' ? opts.onPending : null;
    if (reuse && cache) {
      if (onPending) {
        if (kongsiMenunggu) onPending();
        else pendengarKongsi.push(onPending);
      }
      return cache;
    }
    if (reuse) {
      pendengarKongsi = onPending ? [onPending] : [];
      kongsiMenunggu = false;
    }
    const maklum = reuse
      ? () => {
          kongsiMenunggu = true;
          pendengarKongsi.forEach((f) => f());
        }
      : onPending;
    const p = ambil(minggu, maklum);
    if (reuse) {
      cache = p;
      p.then(
        () => (kongsiMenunggu = false),
        () => (kongsiMenunggu = false),
      );
    } else if (!minggu)
      p.then(
        () => (cache = p),
        () => {},
      );
    return p;
  }
  window.FamaMuse = { load };
})();

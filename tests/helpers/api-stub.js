'use strict';
// Satu pemintas permintaan puppeteer bagi /api/cuaca, /api/banjir, /api/kualiti-udara dan /api/muse.
// Fungsi pengendali menerima URL permintaan (berguna untuk /api/muse?minggu=).
// Dua pemintas pada satu halaman akan bertembung, jadi gunakan hanya ini.
// Setiap kunci: fungsi () => nilai, 'abort', {status}, {body} atau objek JSON terus.
// Kunci yang tidak diberi: permintaan diteruskan ke pelayan sebenar.
const LALUAN = {
  cuaca: /\/api\/cuaca(\?|$)/,
  banjir: /\/api\/banjir(\?|$)/,
  ipu: /\/api\/kualiti-udara(\?|$)/,
  muse: /\/api\/muse(\?|$)/,
};

async function stubApi(page, pengendali = {}) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const kunci = Object.keys(LALUAN).find((k) => LALUAN[k].test(req.url()));
    if (!kunci || pengendali[kunci] === undefined) return req.continue();
    const h =
      typeof pengendali[kunci] === 'function' ? pengendali[kunci](req.url()) : pengendali[kunci];
    if (h === 'abort') return req.abort('failed');
    if (h && typeof h.status === 'number' && h.status !== 200)
      return req.respond({
        status: h.status,
        contentType: 'application/json',
        body: JSON.stringify({ ralat: 'tidak tersedia' }),
      });
    return req.respond({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(h && h.body ? h.body : h),
    });
  });
}

module.exports = { stubApi };

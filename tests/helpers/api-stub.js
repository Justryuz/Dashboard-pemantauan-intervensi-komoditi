'use strict';
// Satu pemintas permintaan puppeteer bagi /api/cuaca, /api/banjir, /api/kualiti-udara, /api/muse dan API lapisan cuaca
// (grid, grid/meta, grid/titik, radar, satelit, siklon).
// Fungsi pengendali menerima URL permintaan (berguna untuk /api/muse?minggu= dan /api/grid?var=).
// Dua pemintas pada satu halaman akan bertembung, jadi gunakan hanya ini.
// Setiap kunci: fungsi () => nilai, 'abort', {status}, {body} atau objek JSON terus.
// tileAsli: true = biarkan tile ke rangkaian sebenar (untuk tangkapan skrin).
// Kunci yang tidak diberi: permintaan diteruskan ke pelayan sebenar.
const LALUAN = {
  cuaca: /\/api\/cuaca(\?|$)/,
  banjir: /\/api\/banjir(\?|$)/,
  ipu: /\/api\/kualiti-udara(\?|$)/,
  muse: /\/api\/muse(\?|$)/,
  metmy: /\/api\/met-malaysia(\?|$)/,
  gridMeta: /\/api\/grid\/meta(\?|$)/,
  gridTitik: /\/api\/grid\/titik(\?|$)/,
  grid: /\/api\/grid(\?|$)/,
  radar: /\/api\/radar(\?|$)/,
  satelit: /\/api\/satelit(\?|$)/,
  siklon: /\/api\/siklon(\?|$)/,
};
// Tile peta asas dan tile cuaca tidak pernah ke rangkaian sebenar: tile = PNG 1x1.
// Permintaan dicatat pada page.tileUrls.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const RE_TILE =
  /^https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com|tilecache\.rainviewer\.com|gibs\.earthdata\.nasa\.gov)\//;

async function stubApi(page, pengendali = {}) {
  await page.setRequestInterception(true);
  page.tileUrls = [];
  page.on('request', (req) => {
    if (!pengendali.tileAsli && RE_TILE.test(req.url())) {
      page.tileUrls.push(req.url());
      return req.respond({
        status: 200,
        contentType: 'image/png',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: PNG_1X1,
      });
    }
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

module.exports = { stubApi, PNG_1X1 };

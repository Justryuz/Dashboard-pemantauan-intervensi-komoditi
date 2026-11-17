'use strict';
// Satu pemintas permintaan puppeteer bagi /api/cuaca, /api/banjir, /api/kualiti-udara dan /api/muse.
// Fungsi pengendali menerima URL permintaan (berguna untuk /api/muse?minggu=).
// Dua pemintas pada satu halaman akan bertembung, jadi gunakan hanya ini.
// Setiap kunci: fungsi () => nilai, 'abort', {status}, {body} atau objek JSON terus.
// tileAsli: true = biarkan tile dan Windy ke rangkaian sebenar (untuk tangkapan skrin).
// Kunci yang tidak diberi: permintaan diteruskan ke pelayan sebenar.
const LALUAN = {
  cuaca: /\/api\/cuaca(\?|$)/,
  banjir: /\/api\/banjir(\?|$)/,
  ipu: /\/api\/kualiti-udara(\?|$)/,
  muse: /\/api\/muse(\?|$)/,
  metmy: /\/api\/met-malaysia(\?|$)/,
};
// Tile peta asas dan iframe Windy tidak pernah ke rangkaian sebenar: tile = PNG 1x1, Windy = halaman kosong.
// Permintaan dicatat pada page.tileUrls dan page.windyUrls.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const RE_TILE =
  /^https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com)\//;
const RE_WINDY = /^https:\/\/(embed|node)\.windy\.com\//;

async function stubApi(page, pengendali = {}) {
  await page.setRequestInterception(true);
  page.tileUrls = [];
  page.windyUrls = [];
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
    if (!pengendali.tileAsli && RE_WINDY.test(req.url())) {
      page.windyUrls.push(req.url());
      return req.respond({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Windy (stub)</title><body style="background:#345;color:#fff;font:14px sans-serif">Radar Windy (stub ujian)</body>',
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

module.exports = { stubApi };

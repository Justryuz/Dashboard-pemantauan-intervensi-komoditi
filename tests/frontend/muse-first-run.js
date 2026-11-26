'use strict';
// Simulasi larian pertama AI Muse: cache kosong, pelayan sedang mengambil dari Google Drive.
// Semak: /api/muse tiada 4xx/5xx, tiada ralat JS, panel tunjuk "sedang diambil", kemudian data dipaparkan.
// Jalankan dari root: node --no-warnings tests/frontend/muse-first-run.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-first-'));
process.env.MUSE_CACHE_FILE = path.join(tmp, 'muse-curated.json');
process.env.MUSE_DIR = path.join(tmp, 'muse');

const server = require('../../lib/server.js');
const muse = require('../../lib/services/muse.js');
const puppeteer = require(
  path.resolve(__dirname, '../../.agents/tasks/bt/node_modules/puppeteer-core'),
);
const BROWSER =
  process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ambil = muse.segar(); // seperti mulaPenjadual() pada larian pertama
  const browser = await puppeteer.launch({
    executablePath: BROWSER,
    headless: 'new',
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mfr-')),
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const problems = [];
  const statuses = [];
  let sawPending = false;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    // Hanya /api/muse dinilai. Endpoint lain (cth. harga) boleh 503 di mesin tanpa cache/secrets.
    page.on('response', (r) => {
      if (r.url().includes('/api/muse')) statuses.push(r.status());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/?muse=1`, { waitUntil: 'load' });
    await page.click('#ivTabIv');
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < 240000) {
      const txt = await page.evaluate(() => {
        const b = document.getElementById('ivMuseBody');
        return b ? b.textContent : '';
      });
      if (/sedang diambil/i.test(txt)) sawPending = true;
      if (/tidak dapat dimuatkan/i.test(txt)) {
        problems.push('panel tunjuk ralat');
        break;
      }
      if (txt && !/Memuatkan|sedang diambil/i.test(txt)) {
        ready = true;
        break;
      }
      await sleep(1000);
    }
    if (!ready) problems.push('panel AI Muse tidak siap');
    if (!sawPending) problems.push('keadaan "sedang diambil" tidak dipaparkan');
    if (statuses.some((s) => s >= 400)) problems.push('respons ralat: ' + statuses.join(','));
  } finally {
    await browser.close();
    await ambil.catch(() => {});
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('status /api/muse:', statuses.join(','));
  console.log(problems.length ? problems.join('\n') : 'OK: larian pertama AI Muse lancar');
  process.exitCode = problems.length ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});

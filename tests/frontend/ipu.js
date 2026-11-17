'use strict';
// Kad 'Kualiti Udara (IPU) Berhampiran PO': 15 PO, jalur, susunan, lapuk/503/abort/file://, overflow, kontras.
// API distub (deterministik). Jalankan dari root: node tests/frontend/ipu.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const server = require('../../api/server.js');
const { buatFixture } = require('../helpers/cuaca-fixture.js');
const { buatFixtureIPU, pasangSemuaCache } = require('../helpers/banjir-fixture.js');
const { stubApi } = require('../helpers/api-stub.js');
const puppeteer = require(
  path.resolve(__dirname, '../../.agents/tasks/bt/node_modules/puppeteer-core'),
);
const EDGE =
  process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  pasangSemuaCache();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ipu-ui-')),
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const gagal = [];
  const ok = (nama, cond, info) => {
    if (!cond) gagal.push(nama + (info !== undefined ? ' -> ' + JSON.stringify(info) : ''));
  };
  async function buka(ipu, { url = base + '/', rangkaian = false, lebar = 1440 } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: lebar, height: 900 });
    const masalah = [];
    page.on('pageerror', (e) => masalah.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (!['error', 'warning'].includes(m.type())) return;
      if (rangkaian && /Failed to load resource/.test(m.text())) return;
      masalah.push(`console.${m.type()}: ${m.text()}`);
    });
    await stubApi(page, { cuaca: buatFixture(), ipu });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await sleep(1800);
    return { page, masalah };
  }
  const teks = (page, sel) => page.$eval(sel, (e) => e.innerText);
  const baris = (page) =>
    page.$$eval('#ipuList .ipu-row', (e) =>
      e.map((x) => ({
        nama: x.querySelector('.ipu-nama').textContent,
        api: x.querySelector('.ipu-api').textContent,
        chip: x.querySelector('.ipu-chip').textContent.trim(),
        band: x.dataset.band,
        teks: x.innerText,
      })),
    );

  try {
    // (i) data segar dengan semua jalur
    {
      const fx = buatFixtureIPU({ band: 'variasi' });
      const { page, masalah } = await buka(fx);
      const b = await baris(page);
      ok('(i) 15 baris PO', b.length === 15, b.length);
      const nilai = b.map((x) => Number(x.api));
      ok(
        '(i) disusun IPU tertinggi dahulu',
        nilai.every((v, i) => i === 0 || nilai[i - 1] >= v),
        nilai,
      );
      const label = {
        baik: 'Baik',
        sederhana: 'Sederhana',
        tidak_sihat: 'Tidak Sihat',
        sangat_tidak_sihat: 'Sangat Tidak Sihat',
        berbahaya: 'Berbahaya',
      };
      ok(
        '(i) chip jalur betul mengikut nilai',
        b.every((x) => x.chip === label[x.band]),
        b.map((x) => x.api + ':' + x.chip),
      );
      ok(
        '(i) kelima-lima jalur hadir',
        Object.keys(label).every((k) => b.some((x) => x.band === k)),
      );
      const leg = await teks(page, '#ipuLegend');
      ok(
        '(i) legenda 5 jalur',
        Object.values(label).every((l) => leg.includes(l)),
        leg,
      );
      ok(
        '(i) jarak km dan masa MYT dipaparkan',
        b.every((x) => /\d+\.\d km/.test(x.teks) && /\d\d:\d\d MYT/.test(x.teks)),
        b[0].teks,
      );
      ok(
        '(i) atribusi JAS (MyEQMS)',
        (await teks(page, '#ipuAttrib')).includes('Sumber: JAS (MyEQMS)'),
      );
      ok('(i) tag', (await teks(page, '#ipuTag')).includes('JAS · Sebenar'));
      ok('(i) tiada banner', await page.$eval('#ipuStatus', (e) => e.hidden));
      const kad = await teks(page, '#ipuPanel');
      ok('(i) tiada DATA DUMMY dalam kad', !/DATA DUMMY/i.test(kad));
      ok('(i) tiada ralat konsol/CSP', masalah.length === 0, masalah);
      await page.close();
    }
    // (ii) lapuk (umurJam 5): banner; bacaan lapuk per PO ditanda
    {
      const { page } = await buka(buatFixtureIPU({ umurJam: 5, lapuk: true }));
      ok(
        '(ii) banner data lapuk',
        /Data lapuk/.test(await teks(page, '#ipuStatus')),
        await teks(page, '#ipuStatus'),
      );
      ok('(ii) baris ditanda lapuk', (await page.$$('#ipuList .ipu-tanda.lapuk')).length > 0);
      await page.close();
    }
    // (iii) 503 -> ralat + Cuba semula pulih
    {
      let n = 0;
      const fx = buatFixtureIPU();
      const { page } = await buka(() => (n++ === 0 ? { status: 503 } : fx), { rangkaian: true });
      const b = await teks(page, '#ipuStatus');
      ok(
        '(iii) ralat BM + Cuba semula',
        /tidak dapat dimuatkan/.test(b) && /Cuba semula/.test(b),
        b,
      );
      ok('(iii) tiada baris/nombor dummy', (await page.$$('#ipuList .ipu-row')).length === 0);
      await page.click('[data-act="ipu-retry"]');
      await sleep(1200);
      ok('(iii) pulih selepas Cuba semula', (await page.$$('#ipuList .ipu-row')).length === 15);
      await page.close();
    }
    // (iv) abort
    {
      const { page } = await buka('abort', { rangkaian: true });
      ok('(iv) abort: mesej ralat', /tidak dapat dimuatkan/.test(await teks(page, '#ipuStatus')));
      ok('(iv) abort: tiada baris', (await page.$$('#ipuList .ipu-row')).length === 0);
      await page.close();
    }
    // (v) file://
    {
      const { page } = await buka(undefined, {
        url: 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'),
        rangkaian: true,
      });
      ok(
        '(v) file:// memerlukan pelayan',
        (await teks(page, '#ipuStatus')).includes('memerlukan pelayan (npm start)'),
      );
      await page.close();
    }
    // (vi) tiada overflow mendatar, kad dalam sempadan; kontras chip
    for (const lebar of [1440, 1024, 390]) {
      const { page } = await buka(buatFixtureIPU({ band: 'variasi' }), { lebar });
      const m = await page.evaluate(() => {
        const p = document.getElementById('ipuPanel').getBoundingClientRect();
        const luar = [...document.querySelectorAll('#ipuPanel *')].filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 && e.closest('#ipuList') && (r.right > p.right + 1 || r.left < p.left - 1)
          );
        }).length;
        return {
          sw: document.documentElement.scrollWidth,
          iw: innerWidth,
          luar,
          lebarPanel: p.width,
        };
      });
      ok(`(vi) ${lebar}: tiada overflow mendatar`, m.sw <= m.iw, m);
      ok(`(vi) ${lebar}: kandungan dalam sempadan panel`, m.luar === 0, m);
      await page.close();
    }
    for (const tema of ['gelap', 'cerah']) {
      const { page } = await buka(buatFixtureIPU({ band: 'variasi' }));
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema);
      await sleep(300);
      const nisbah = await page.evaluate(() => {
        const rgb = (s) =>
          s
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number);
        const lum = ([r, g, b]) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const hasil = {};
        document.querySelectorAll('#ipuList .ipu-chip').forEach((c) => {
          const cs = getComputedStyle(c);
          const a = lum(rgb(cs.color));
          const b = lum(rgb(cs.backgroundColor));
          hasil[c.parentElement.parentElement.dataset.band] =
            (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        return hasil;
      });
      ok(
        `(vi) kontras chip >= 4.5 tema ${tema}`,
        Object.keys(nisbah).length === 5 && Object.values(nisbah).every((v) => v >= 4.5),
        nisbah,
      );
      await page.close();
    }
  } catch (e) {
    gagal.push('pengecualian: ' + (e && e.stack ? e.stack : e));
  }
  await browser.close();
  server.close();
  if (gagal.length) {
    console.error('GAGAL:\n - ' + gagal.join('\n - '));
    process.exit(1);
  }
  console.log('OK: kad IPU (15 PO, jalur, susunan, lapuk/503/abort/file://, overflow, kontras)');
})();

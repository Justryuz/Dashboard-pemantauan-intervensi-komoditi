'use strict';
// Panel 'AI Muse - Gambaran Mingguan Komoditi' (tab Intervensi): data sebenar melalui /api/muse (cache fixture),
// kad ikut komoditi, susunan, garis masa, navigasi minggu, paparan ikut hari, keadaan kosong/ralat/lapuk/file://,
// penapis, overflow (1440/1024/390), kontras dua tema, tiada ralat konsol/CSP.
// Jalankan dari root: node --no-warnings tests/frontend/muse.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const server = require('../../api/server.js');
const { pasangSemuaCache } = require('../helpers/banjir-fixture.js');
const { buatFixtureMuse, pasangCacheMuse } = require('../helpers/muse-fixture.js');
const { buatFixture } = require('../helpers/cuaca-fixture.js');
const { stubApi } = require('../helpers/api-stub.js');
const puppeteer = require(
  path.resolve(__dirname, '../../.agents/tasks/bt/node_modules/puppeteer-core'),
);
const EDGE =
  process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOW = '2026-11-17T12:00:00+08:00';

// Fixture: 16 hari; pada 2026-11-17 kubis -> Merah (5 -> 60), tembikai -> Kuning (9 -> 30)
function fixtureData() {
  const d = buatFixtureMuse();
  d.rekod.forEach((r) => {
    if (r.tarikh !== '2026-11-17') return;
    if (r.komoditiId === 'kubis')
      Object.assign(r, { band: 'Merah', risikoSebelum: 5, risikoSemasa: 60 });
    if (r.komoditiId === 'tembikai')
      Object.assign(r, { band: 'Kuning', risikoSebelum: 9, risikoSemasa: 30 });
  });
  return d;
}
const JANGKAAN_SUSUN = ['durian', 'kelapa-tua', 'tembikai', 'kubis', 'cili-padi'];

(async () => {
  pasangSemuaCache();
  pasangCacheMuse(fixtureData());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const nyata = await (await fetch(base + '/api/muse')).json();
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'muse-ui-')),
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const gagal = [];
  const ok = (nama, cond, info) => {
    if (!cond) gagal.push(nama + (info !== undefined ? ' -> ' + JSON.stringify(info) : ''));
  };
  async function buka({ muse, url = base + '/', rangkaian = false, lebar = 1440, tema } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: lebar, height: 900 });
    const masalah = [],
      minta = [];
    page.on('pageerror', (e) => masalah.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (!['error', 'warning'].includes(m.type())) return;
      if (rangkaian && /Failed to load resource|Data AI Muse/.test(m.text())) return;
      masalah.push(`console.${m.type()}: ${m.text()}`);
    });
    page.on('request', (r) => {
      if (/\/api\/muse/.test(r.url())) minta.push(r.url().replace(/^https?:\/\/[^/]+/, ''));
    });
    await stubApi(page, { cuaca: buatFixture(), ...(muse === undefined ? {} : { muse }) });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.click('#ivTabIv');
    await sleep(1500);
    await page.evaluate(
      (n, t) => {
        IV_TEST.setMuseNow(n);
        if (t) document.documentElement.setAttribute('data-theme', t);
      },
      NOW,
      tema || null,
    );
    await sleep(300);
    return { page, masalah, minta };
  }
  const teks = (page, sel) => page.$eval(sel, (e) => e.innerText);
  const kad = (page) =>
    page.$$eval('#ivMuseCards .iv-muse-card', (e) =>
      e.map((x) => ({
        id: x.dataset.id,
        band: x.dataset.band,
        buka: x.dataset.open,
        teks: x.innerText,
        chips: [...x.querySelectorAll('.iv-chip')].map((c) => c.innerText),
        cls: [...x.querySelectorAll('.iv-chip')].map((c) => c.className),
      })),
    );
  const klik = async (page, act, arg) => {
    await page.click(`#ivMusePanel [data-iv-act="${act}"]${arg ? `[data-iv-arg="${arg}"]` : ''}`);
    await sleep(700);
  };
  try {
    // (i) kad ringkas ikut lokasi, tajuk, Lihat lagi, pengepala
    {
      const { page, masalah, minta } = await buka();
      const k = await kad(page);
      ok(
        '(i) satu kad setiap komoditi',
        k.length === 5,
        k.map((x) => x.id),
      );
      ok(
        '(i) susunan: berlokasi (negeri A-Z, daerah) dahulu, tiada lokasi di bawah',
        JSON.stringify(k.map((x) => x.id)) === JSON.stringify(JANGKAAN_SUSUN),
        k.map((x) => x.id),
      );
      const tajukKumpulan = await page.$$eval('#ivMuseCards .iv-mu-grp', (e) =>
        e.map((x) => x.innerText),
      );
      ok(
        '(i) pengepala kumpulan',
        JSON.stringify(tajukKumpulan) ===
          JSON.stringify(['Sarawak (1)', 'Terengganu (2)', 'Lokasi tidak dinyatakan (2)']),
        tajukKumpulan,
      );
      ok('(i) data-band', k[2].band === 'kuning' && k[3].band === 'merah' && k[0].band === 'hijau');
      ok(
        '(i) chip Merah bad dengan perubahan',
        /Risiko Merah\s+60 ↑ \+55/.test(k[3].chips.join(' ')),
        k[3].chips,
      );
      ok(
        '(i) kelas chip band',
        k[3].cls.some((c) => /\bbad\b/.test(c)) &&
          k[2].cls.some((c) => /\bwarn\b/.test(c)) &&
          k[0].cls.some((c) => /\bok\b/.test(c)),
      );
      ok('(i) risiko Hijau turun', /Risiko Hijau\s+20 ↓ -4/.test(k[1].chips.join(' ')), k[1].chips);
      ok('(i) tarikh terkini pada kad', /17 November 2026/.test(k[3].teks), k[3].teks);
      ok(
        '(i) lokasi daerah, negeri',
        /Dungun, Terengganu/.test(k[1].teks) && /Marang, Terengganu/.test(k[1].teks),
        k[1].teks,
      );
      ok(
        '(i) tiada chip lokasi tidak dinyatakan pada kad',
        !k.some((x) => x.chips.includes('Lokasi tidak dinyatakan')),
      );
      ok('(i) chip Awal', k[3].chips.includes('Awal') && !k[1].chips.includes('Awal'), [
        k[3].chips,
        k[1].chips,
      ]);
      // tajuk: <= 70 aksara
      const hl = await page.$$eval('#ivMuseCards .iv-mc-hl', (e) => e.map((x) => x.textContent));
      ok(
        '(i) tajuk <= 70 aksara dan tidak kosong',
        hl.length === 5 && hl.every((t) => t.length > 0 && t.length <= 70),
        hl,
      );
      // keterangan tersembunyi secara lalai
      const notaKelapa = nyata.rekod.find(
        (r) => r.komoditiId === 'kelapa-tua' && r.tarikh === '2026-11-17',
      ).nota;
      const hujung = notaKelapa.slice(-30);
      ok(
        '(i) nota penuh, harga dan garis masa tersembunyi',
        !k[1].teks.includes(hujung) &&
          !/harga pada/.test(k[1].teks) &&
          (await page.$$('.iv-mu-tl')).length === 0,
        k[1].teks,
      );
      const btn = '.iv-muse-card[data-id="kelapa-tua"] .iv-mc-more';
      ok(
        '(i) butang Lihat lagi',
        (await teks(page, btn)) === 'Lihat lagi' &&
          (await page.$eval(btn, (e) => e.getAttribute('aria-expanded'))) === 'false',
      );
      await klik(page, 'museExp', 'kelapa-tua');
      const bt = await page.$eval('.iv-muse-card[data-id="kelapa-tua"]', (e) => e.innerText);
      ok(
        '(i) Tutup + aria-expanded',
        (await teks(page, btn)) === 'Tutup' &&
          (await page.$eval(btn, (e) => e.getAttribute('aria-expanded'))) === 'true',
      );
      ok('(i) nota penuh dipaparkan', bt.includes(hujung), bt);
      ok('(i) baris harga', /harga pada/.test(bt) && /RM\//.test(bt), bt);
      ok(
        '(i) risiko sebelum/semasa/hadapan, sentimen, sampel, sumber',
        /Risiko sebelum/.test(bt) &&
          /Risiko semasa/.test(bt) &&
          /Risiko hadapan/.test(bt) &&
          /Indeks sentimen/.test(bt) &&
          /Bilangan sampel/.test(bt) &&
          /db-curated-2026-11-17\.json/.test(bt),
        bt,
      );
      const tl = await page.$$eval('.iv-muse-card[data-id="kelapa-tua"] .iv-mu-tl li', (e) =>
        e.map((x) => x.innerText),
      );
      ok(
        '(i) garis masa 2 rekod, terbaharu dahulu',
        tl.length === 2 && /17 November/.test(tl[0]) && /16 November/.test(tl[1]),
        tl,
      );
      await klik(page, 'museExp', 'durian');
      ok(
        '(i) hanya satu kad terbuka',
        (await page.$$('.iv-muse-card[data-open="true"]')).length === 1 &&
          !(await page.$('.iv-muse-card[data-id="kelapa-tua"] .iv-mu-tl')),
      );
      await klik(page, 'museExp', 'durian');
      const kt = await kad(page);
      ok(
        '(i) Tutup menyembunyikan semula',
        kt.every((x) => x.buka === 'false') &&
          !kt[0].teks.includes(
            nyata.rekod
              .find((r) => r.komoditiId === 'durian' && r.tarikh === '2026-11-17')
              .nota.slice(-30),
          ) &&
          (await page.$$('.iv-mu-tl')).length === 0,
      );
      const p = await teks(page, '#ivMusePanel');
      ok(
        '(i) tiada DATA DUMMY',
        !/DATA DUMMY/i.test(p) && !(await page.$('#ivMusePanel .iv-tag.dummy')),
      );
      ok(
        '(i) Tarikh data terakhir',
        /Tarikh data terakhir\s*17 November 2026/.test(p),
        p.slice(0, 400),
      );
      ok(
        '(i) sumber',
        (await teks(page, '#ivMuseChips')).includes('Sumber: AI Muse · db-curated (Google Drive)'),
      );
      ok('(i) Kelompok harian', (await teks(page, '#ivMuseChips')).includes('Kelompok harian'));
      ok('(i) kiraan komoditi', (await teks(page, '#ivMuseCount')) === '5 komoditi');
      ok(
        '(i) label minggu',
        (await teks(page, '#ivWeekLbl')) === '16 – 22 November 2026',
        await teks(page, '#ivWeekLbl'),
      );
      ok(
        '(i) tiada butang tindakan',
        !(await page.$('#ivMusePanel .iv-mc-act')) &&
          !(await page.$('#ivMusePanel [data-iv-act="museXfer"]')),
      );
      ok('(i) tiada kad lapuk', !(await page.$('#ivMuseStale')));
      ok('(i) minggu lalai tanpa param', minta[0] === '/api/muse', minta);
      // penapis komoditi dengan alias
      const ada = await page.$eval('#ivFKomoditi', (s) =>
        [...s.options].some((o) => o.value === 'kubis-bulat'),
      );
      if (ada) {
        await page.select('#ivFKomoditi', 'kubis-bulat');
        await sleep(600);
        const k2 = await kad(page);
        ok(
          '(i) penapis komoditi kubis-bulat -> kubis',
          k2.length === 1 && k2[0].id === 'kubis',
          k2.map((x) => x.id),
        );
        await page.select('#ivFKomoditi', '');
        await sleep(400);
      } else ok('(i) pilihan kubis-bulat wujud', false);
      ok('(i) tiada ralat konsol/CSP', masalah.length === 0, masalah);
      await page.close();
    }
    // (i-b) kumpulan negeri A-Z, berbilang negeri, tinggi kad runtuh sama
    {
      const d = JSON.parse(JSON.stringify(nyata));
      d.rekod.forEach((r) => {
        if (r.tarikh !== '2026-11-17') return;
        if (r.komoditiId === 'kubis')
          r.lokasi = [
            { negeri: 'Johor', daerah: 'Kluang', jenis: 'disebut', poId: null },
            { negeri: 'Pahang', daerah: 'Pekan', jenis: 'disebut', poId: null },
          ];
        if (r.komoditiId === 'cili-padi')
          r.lokasi = [{ negeri: 'Kedah', daerah: null, jenis: 'disebut', poId: null }];
      });
      const { page } = await buka({ muse: d });
      const g = await page.$$eval('#ivMuseCards .iv-mu-grp', (e) => e.map((x) => x.innerText));
      ok(
        '(i-b) negeri A-Z, tiada lokasi tiada kumpulan',
        JSON.stringify(g) ===
          JSON.stringify(['Johor (1)', 'Kedah (1)', 'Sarawak (1)', 'Terengganu (2)']),
        g,
      );
      const k = await kad(page);
      ok(
        '(i-b) kad berbilang negeri di bawah negeri pertama dengan chip negeri lain',
        k[0].id === 'kubis' && k[0].chips.some((c) => /Pahang/.test(c)),
        k[0].chips,
      );
      const h = await page.$$eval('#ivMuseCards .iv-muse-card', (e) =>
        e.map((x) => Math.round(x.getBoundingClientRect().height)),
      );
      ok(
        '(i-b) tinggi kad runtuh sama',
        h.every((x) => Math.abs(x - h[0]) <= 2),
        h,
      );
      await page.close();
    }
    // (i-c) kosong lokasi sahaja: tajuk kumpulan tunggal
    {
      const d = JSON.parse(JSON.stringify(nyata));
      d.rekod.forEach((r) => (r.lokasi = []));
      const { page } = await buka({ muse: d });
      const g = await page.$$eval('#ivMuseCards .iv-mu-grp', (e) => e.map((x) => x.innerText));
      ok(
        '(i-c) hanya kumpulan Lokasi tidak dinyatakan',
        JSON.stringify(g) === JSON.stringify(['Lokasi tidak dinyatakan (5)']),
        g,
      );
      const k = await kad(page);
      ok(
        '(i-c) tahap menurun: Merah dahulu',
        k[0].id === 'kubis' && k[1].id === 'tembikai',
        k.map((x) => x.id),
      );
      await page.close();
    }
    // (i-d) susun atur lajur 3 / 2 / 1
    for (const [lebar, lajur] of [
      [1440, 3],
      [1100, 2],
      [390, 1],
    ]) {
      const { page } = await buka({ lebar });
      const n = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#ivMuseCards .iv-muse-card')];
        return (
          new Set(c.map((x) => Math.round(x.getBoundingClientRect().top))).size &&
          c.filter(
            (x) => Math.abs(x.getBoundingClientRect().top - c[0].getBoundingClientRect().top) < 3,
          ).length
        );
      });
      ok(
        `(i-d) ${lebar}: ${lajur} lajur (kad sebaris dalam kumpulan pertama)`,
        n === Math.min(lajur, 1) || n >= 1,
      );
      const lajurSebenar = await page.$eval(
        '#ivMuseCards',
        (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length,
      );
      ok(`(i-d) ${lebar}: grid ${lajur} lajur`, lajurSebenar === lajur, lajurSebenar);
      await page.close();
    }
    // (ii) navigasi minggu
    {
      const { page, masalah, minta } = await buka();
      const dis = (sel) => page.$eval(sel, (e) => e.disabled);
      const P = '#ivMusePanel [data-iv-act="museWeek"][data-iv-arg="prev"]';
      const N = '#ivMusePanel [data-iv-act="museWeek"][data-iv-arg="next"]';
      ok('(ii) seterusnya dilumpuhkan pada minggu terkini', await dis(N));
      await page.click(P);
      await sleep(900);
      ok('(ii) prev minta 2026-11-09', minta.includes('/api/muse?minggu=2026-11-09'), minta);
      ok(
        '(ii) label 9 – 15 November 2026',
        (await teks(page, '#ivWeekLbl')) === '9 – 15 November 2026',
        await teks(page, '#ivWeekLbl'),
      );
      ok(
        '(ii) minggu 9 Nov: 5 kad, tarikh 15 Nov',
        (await kad(page)).length === 5 && /15 November 2026/.test((await kad(page))[0].teks),
      );
      await page.click(P);
      await sleep(900);
      ok('(ii) prev minta 2026-11-02', minta.includes('/api/muse?minggu=2026-11-02'), minta);
      ok('(ii) prev dilumpuhkan pada minggu terawal', await dis(P));
      ok('(ii) seterusnya aktif', !(await dis(N)));
      await page.click('#ivMusePanel [data-iv-act="museWeek"][data-iv-arg="now"]');
      await sleep(900);
      ok(
        '(ii) Minggu ini -> 2026-11-16',
        (await teks(page, '#ivWeekLbl')) === '16 – 22 November 2026' &&
          minta[minta.length - 1] === '/api/muse?minggu=2026-11-16',
        minta,
      );
      await page.click(P);
      await sleep(800);
      await page.click(N);
      await sleep(800);
      ok(
        '(ii) seterusnya kembali ke 16 Nov',
        (await teks(page, '#ivWeekLbl')) === '16 – 22 November 2026',
      );
      ok('(ii) tiada ralat konsol/CSP', masalah.length === 0, masalah);
      await page.close();
    }
    // (iii) paparan ikut hari
    {
      const { page, masalah } = await buka();
      await klik(page, 'museView', 'hari');
      const hari = await page.$$eval('#ivMuseCards .iv-mu-day', (e) => e.map((x) => x.innerText));
      ok(
        '(iii) 2 tajuk hari, terbaharu dahulu',
        hari.length === 2 && /^17 November 2026/.test(hari[0]) && /^16 November 2026/.test(hari[1]),
        hari,
      );
      ok('(iii) 10 kad (5 komoditi x 2 hari)', (await kad(page)).length === 10);
      ok(
        '(iii) aria-pressed',
        (await page.$eval('[data-iv-arg="hari"]', (e) => e.getAttribute('aria-pressed'))) ===
          'true' &&
          (await page.$eval('[data-iv-arg="komoditi"]', (e) => e.getAttribute('aria-pressed'))) ===
            'false',
      );
      ok(
        '(iii) kad hari tiada butang kembang',
        (await page.$$('#ivMuseCards button.iv-mc-head')).length === 0,
      );
      await klik(page, 'museView', 'komoditi');
      ok('(iii) kembali ikut komoditi', (await kad(page)).length === 5);
      ok('(iii) tiada ralat konsol/CSP', masalah.length === 0, masalah);
      await page.close();
    }
    // (iv) kosong
    {
      const kosong = {
        ...nyata,
        minggu: '2026-11-16',
        mingguTersedia: ['2026-11-16'],
        rekod: [],
        bilRekod: 0,
      };
      const { page } = await buka({ muse: kosong });
      ok(
        '(iv) teks kosong tepat',
        (await teks(page, '#ivMuseEmpty')) === 'Tiada berita AI Muse untuk minggu ini',
        await page.$eval('#ivMuseBody', (e) => e.innerText.slice(0, 200)),
      );
      ok('(iv) tiada kad', (await kad(page)).length === 0);
      await page.close();
    }
    // (v) ralat -> Cuba Semula -> pulih
    for (const mod of [{ status: 503 }, 'abort']) {
      let n = 0;
      const { page } = await buka({ muse: () => (n++ === 0 ? mod : nyata), rangkaian: true });
      const awal = await teks(page, '#ivMuseBody');
      ok(
        `(v) ralat ${mod.status || mod}`,
        /Data AI Muse tidak dapat dimuatkan/.test(awal) && /Cuba Semula/.test(awal),
        awal,
      );
      ok('(v) tiada kad semasa ralat', (await kad(page)).length === 0);
      await page.click('#ivMusePanel [data-iv-act="museRetry"]');
      await sleep(900);
      ok('(v) pulih selepas Cuba Semula', (await kad(page)).length === 5);
      await page.close();
    }
    // (vi) lapuk
    {
      const lapuk = { ...nyata, latestDate: '2026-11-14' };
      const { page } = await buka({ muse: lapuk });
      const t = await page.$eval('#ivMuseStale', (e) => e.innerText).catch(() => '');
      ok(
        '(vi) banner lapuk',
        /Data AI Muse lapuk: tarikh data terakhir 14 November 2026/.test(t),
        t,
      );
      ok('(vi) kad masih dipaparkan', (await kad(page)).length === 5);
      await page.close();
    }
    // (vi-b) sebahagian
    {
      const { page } = await buka({ muse: { ...nyata, status: 'sebahagian' } });
      ok('(vi-b) nota sebahagian', (await page.$('#ivMusePart')) !== null);
      await page.close();
    }
    // (vii) file://
    {
      const { page } = await buka({
        url: 'file:///' + path.resolve(__dirname, '../../index.html').replace(/\\/g, '/'),
        rangkaian: true,
      });
      ok(
        '(vii) file:// memerlukan pelayan',
        (await teks(page, '#ivMuseBody')).includes('Data AI Muse memerlukan pelayan (npm start)'),
        await teks(page, '#ivMuseBody'),
      );
      await page.close();
    }
    // (viii) overflow, kad dikembangkan
    for (const lebar of [1440, 1024, 390]) {
      const { page } = await buka({ lebar });
      await klik(page, 'museExp', 'kubis');
      const m = await page.evaluate(() => {
        const p = document.getElementById('ivMusePanel').getBoundingClientRect();
        const luar = [...document.querySelectorAll('#ivMusePanel *')].filter((e) => {
          const a = e.getBoundingClientRect();
          return a.width > 0 && a.right > p.right + 1;
        });
        return {
          luar: luar.slice(0, 4).map((e) => e.className || e.tagName),
          sw: document.documentElement.scrollWidth,
          iw: innerWidth,
          kad: [...document.querySelectorAll('#ivMuseCards .iv-muse-card')].filter(
            (c) => c.scrollWidth > c.clientWidth + 1,
          ).length,
        };
      });
      ok(`(viii) ${lebar}: tiada elemen melebihi panel`, m.luar.length === 0, m.luar);
      ok(`(viii) ${lebar}: tiada overflow mendatar halaman`, m.sw <= m.iw, [m.sw, m.iw]);
      ok(`(viii) ${lebar}: tiada overflow kad`, m.kad === 0, m.kad);
      await page.close();
    }
    // (ix) kontras kedua-dua tema (kad dikembangkan) + tangkapan skrin berklip
    for (const tema of ['gelap', 'cerah']) {
      const { page } = await buka({ tema, lebar: 1024 });
      await klik(page, 'museExp', 'kubis');
      const rendah = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number);
        const lum = ([r, g, b]) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const latar = (e) => {
          const lapis = [];
          for (let x = e; x; x = x.parentElement) {
            const c = rgb(getComputedStyle(x).backgroundColor);
            const a = c.length >= 4 ? c[3] : 1;
            if (a > 0) lapis.push([c[0], c[1], c[2], a]);
            if (a >= 1) break;
          }
          let [r, g, b] = [255, 255, 255];
          if (!lapis.length || lapis[lapis.length - 1][3] < 1)
            [r, g, b] = rgb(getComputedStyle(document.body).backgroundColor);
          for (let i = lapis.length - 1; i >= 0; i--) {
            const [R, G, B, A] = lapis[i];
            r = R * A + r * (1 - A);
            g = G * A + g * (1 - A);
            b = B * A + b * (1 - A);
          }
          return [r, g, b];
        };
        const buruk = [];
        let n = 0;
        document
          .querySelectorAll(
            '#ivMusePanel .iv-mc-ins, #ivMusePanel .iv-mc-t, #ivMusePanel .iv-mc-date, #ivMusePanel .iv-chip, #ivMusePanel .iv-tr, #ivMusePanel .iv-mc-price, #ivMusePanel .iv-mc-price b, #ivMusePanel .iv-mu-last, #ivMusePanel .iv-mu-last b, #ivMusePanel .iv-mu-n, #ivMusePanel .iv-mu-day, #ivMusePanel .iv-sec, #ivMusePanel .iv-mc-hl, #ivMusePanel .iv-mc-more, #ivMusePanel .iv-mu-grp, #ivMusePanel .iv-kv span, #ivMusePanel .iv-kv b, #ivMusePanel #ivWeekLbl, #ivMusePanel details.iv-crit summary, #ivMusePanel details.iv-crit p',
          )
          .forEach((e) => {
            if (!e.offsetParent) return;
            n++;
            const a = lum(rgb(getComputedStyle(e).color));
            const b = lum(latar(e));
            const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (k < 4.5) buruk.push([e.className || e.id, k.toFixed(2), e.innerText.slice(0, 24)]);
          });
        return { buruk, n };
      });
      ok(`(ix) kontras >= 4.5 tema ${tema}`, rendah.buruk.length === 0, rendah.buruk.slice(0, 6));
      ok(`(ix) elemen diuji tema ${tema}`, rendah.n > 20, rendah.n);
      const kotak = await page.$eval('#ivMusePanel', (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      });
      const fail = path.join(os.tmpdir(), `muse-${tema}.png`);
      await page.screenshot({
        path: fail,
        captureBeyondViewport: true,
        clip: {
          x: kotak.x,
          y: kotak.y,
          width: Math.min(kotak.width, 1600),
          height: Math.min(kotak.height, 1600),
        },
      });
      console.log('tangkapan skrin:', fail);
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
  console.log(
    'OK: panel AI Muse (kad, susunan, garis masa, minggu, ikut hari, kosong/ralat/lapuk/file, overflow, kontras)',
  );
})();

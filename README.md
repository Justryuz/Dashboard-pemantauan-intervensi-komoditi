# Dashboard Pemantauan Intervensi Komoditi

Dashboard pemantauan dan intervensi komoditi FAMA bagi 15 Pusat Operasi (PO). Semua data ialah data dummy/simulasi.

## Struktur

```
.
├── index.html                  Fail utama (HTML sahaja; CSS & JS dimuat dari src/)
├── src/
│   ├── css/
│   │   ├── base.css            Gaya asas: layout, panel, peta, KPI, jadual, carta, modal
│   │   ├── scenarios.css       Panel AI Multi-Scenario Monitoring
│   │   ├── intervensi.css      Tab Dashboard Intervensi Komoditi & pop-up
│   │   └── tema.css            Palet tema Gelap / Cerah (dimuat terakhir)
│   ├── js/
│   │   ├── theme-init.js       Tetapkan tema sebelum render (elak kelipan)
│   │   ├── app.js              Tab Pemantauan: state, penapis, peta, KPI, senarai, carta, modal, eksport CSV
│   │   ├── scenarios.js        AI Multi-Scenario Monitoring (data dummy, ScenarioService, UI)
│   │   ├── main.js             Titik mula: initControls(), renderAll(), initScenarios()
│   │   ├── intervensi.js       Tab Intervensi: harga, bekalan, logistik, mobilisasi, margin, AI Muse
│   │   └── theme-toggle.js     Butang tukar tema
│   └── data/
│       └── dashboard-data.js   Data dummy (objek DATA): PO, rekod harga, cuaca, banjir, logistik
├── api/                        Pelayan statik + API (server.js) dan folder routes/controllers/services/...
├── config/
│   ├── app.config.js           Konfigurasi sisi pelanggan (gaya peta). Tiada rahsia.
│   └── security.js             Polisi CSP (dikongsi pelayan & <meta> di index.html)
├── data/                       raw/ dan processed/ (diabaikan git)
├── docs/                       spesifikasi, rujukan, laporan, pembentangan (.pptx)
├── scripts/                    Skrip utiliti
├── tests/frontend/             smoke.js, click-all.js, snapshot.js, intervensi-test.js (lama)
├── .env.example                Templat pembolehubah persekitaran
└── package.json
```

### Susunan muat dalam `index.html`

Urutan ini penting kerana fail berkongsi pemboleh ubah global:

1. `theme-init.js`, MapLibre (CDN), `config/app.config.js`
2. CSS: `base` → `scenarios` → `intervensi` → `tema`
3. Di hujung `<body>`: `dashboard-data.js` → `app.js` → `scenarios.js` → `main.js` → `intervensi.js` → `theme-toggle.js`

## Persediaan & jalankan

Perlu Node.js 20.12 atau lebih baharu.

```
cp .env.example .env    # isi nilai jika perlu
npm install             # hanya untuk prettier (dev)
npm start               # http://127.0.0.1:3000
npm test                # smoke test + klik semua butang (perlu Chrome; set BROWSER_PATH jika lain)
npm run format          # format kod dengan Prettier
```

Buka melalui `npm start`. Membuka `index.html` terus (file://) masih berfungsi, tetapi header keselamatan hanya dihantar oleh pelayan.

## Fungsi dashboard

**Tab Pemantauan Komoditi**

- Peta MapLibre 15 PO dengan status risiko (Kritikal / Berwaspada / Stabil), lapisan banjir, zum ke daerah seliaan dan pop-up logistik PO.
- Penapis: komoditi, PO, indikator, mod senarai dan julat tren.
- KPI: PO dalam tapisan, kritikal, berwaspada, stabil dan isu komoditi.
- Analisis harga: 5 harga terendah dan 5 tertinggi, perbandingan negeri/daerah, trend harga harian dengan jalur sigma dan had lantai/siling.
- Ramalan cuaca, amaran MET (contoh) dan AI Multi-Scenario Monitoring.
- Rekod tindakan intervensi (disimpan dalam pelayar), eksport CSV harga dan logistik PO.
- Tema Gelap / Cerah yang diingati oleh pelayar.

**Tab Dashboard Intervensi Komoditi**

- Peta outlet dan daerah, senarai keutamaan isu dan paparan logistik PO.
- Mobilisasi Stok Pintar: cadangan PO sumber/destinasi dan draf cadangan intervensi.
- Simulasi Margin & Harga, serta AI Muse (ringkasan berita/isu dummy).

## Penambahbaikan yang telah dibuat

**Struktur projek**

- Folder `api/`, `config/`, `data/`, `docs/`, `scripts/`, `src/`, `tests/` dan fail `.env.example`, `.gitignore`.
- Fail utama dinamakan semula kepada `index.html`. Fail `.pptx` dipindah ke `docs/pembentangan/`.

**Kod kemas**

- `index.html` dikecilkan daripada ~840 KB (2,286 baris) kepada ~735 baris HTML sahaja.
- CSS inline dipecah kepada 4 fail dan JS inline kepada 6 fail mengikut modul.
- Data dummy (`DATA`) dipindah ke `src/data/dashboard-data.js`, satu rekod setiap baris.
- Semua CSS, JS dan HTML diformat dengan Prettier (`.prettierrc`). Logik dan rekaan tidak diubah.
- Disahkan dengan tangkapan skrin sebelum/selepas (desktop 1440 px, mudah alih 390 px, tema cerah, tab intervensi).

**Pembaikan pepijat**

- `localStorage` boleh menyebabkan ralat dalam mod peribadi atau apabila storan penuh. Simpan/padam rekod tindakan kini dalam `try/catch` dengan mesej kepada pengguna.
- Rekod tindakan yang rosak dalam `localStorage` ditapis supaya tidak memecahkan modal.
- Tag `</div>` penutup `.wrap` yang hilang ditambah (DOM yang terhasil kekal sama).
- Ralat 404 `/favicon.ico` dihentikan.

**Keselamatan**

- API key CARTO yang tertulis dalam kod dibuang. Gaya peta kini dari `config/app.config.js`. **Key lama masih dalam sejarah git; sila revoke/rotate di akaun CARTO.**
- `api/server.js` menghantar header: Content-Security-Policy, X-Frame-Options `DENY`, X-Content-Type-Options `nosniff`, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, `Cache-Control: no-store`.
- CSP: `script-src` tanpa `'unsafe-inline'` (semua JS kini fail luaran). `style-src` masih perlukan `'unsafe-inline'` kerana atribut `style=""` dalam templat UI.
- CORS: hanya origin dalam `CORS_ORIGIN` dibenarkan. Lalai: same-origin sahaja.
- Hanya `index.html`, `src/` dan `config/app.config.js` dilayan. `.env`, `.git`, `data/`, `docs/`, `api/` dan path traversal (`../`) dibalas 404. Kaedah selain GET/HEAD/OPTIONS dibalas 405.
- MapLibre dari unpkg dikunci dengan SRI (`integrity` + `crossorigin`).
- `.env` diabaikan git. Jangan letak rahsia dalam `config/app.config.js` kerana fail itu boleh dibaca sesiapa.

## Nota pembangunan

- Jika menukar `config/security.js`, kemas kini juga `<meta http-equiv="Content-Security-Policy">` dalam `index.html`.
- Jika menambah fail JS/CSS baharu, letakkan dalam `src/` (folder lain tidak dilayan oleh pelayan).
- Ujian bergantung pada `puppeteer-core` dalam `.agents/tasks/bt/node_modules`.
- `tests/frontend/intervensi-test.js` ialah fail ujian lama yang mengandungi HTML terbenam, jadi ia dikecualikan daripada Prettier.

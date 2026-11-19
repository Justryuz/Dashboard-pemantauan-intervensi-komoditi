# Dashboard Pemantauan Intervensi Komoditi

Dashboard pemantauan dan intervensi komoditi FAMA bagi 15 Pusat Operasi (PO). Data cuaca, banjir dan kualiti udara serta senario yang dijana daripadanya ialah data sebenar (MET Malaysia, Open-Meteo, JPS Malaysia, JPS Selangor, JAS MyEQMS) dan berita AI Muse (Google Drive db-curated) ialah data sebenar; selebihnya (harga, stok dll.) ialah data dummy/simulasi. Dashboard ialah alat sokongan keputusan, bukan sistem amaran rasmi.

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
│   │   ├── scenarios.js        AI Multi-Scenario Monitoring (senario daripada data cuaca sebenar, ScenarioService, UI)
│   │   ├── main.js             Titik mula: initControls(), renderAll(), initScenarios()
│   │   ├── intervensi.js       Tab Intervensi: harga, bekalan, logistik, mobilisasi, margin, AI Muse
│   │   └── theme-toggle.js     Butang tukar tema
│   └── data/
│       └── dashboard-data.js   Data dummy (objek DATA): PO, rekod harga, logistik
├── api/                        Pelayan statik + API (server.js) dan folder routes/controllers/services/...
├── config/
│   ├── app.config.js           Konfigurasi sisi pelanggan (gaya peta). Tiada rahsia.
│   └── security.js             Polisi CSP (dikongsi pelayan & <meta> di index.html)
├── data/                       raw/ dan processed/ (diabaikan git)
├── docs/                       spesifikasi, rujukan, laporan, pembentangan (.pptx)
├── scripts/                    Skrip utiliti
├── tests/                      api/ (cuaca-api, banjir-api, ipu-api, muse-api), helpers/ (fixture, api-stub), fixtures/ (data contoh JPS/JAS/Muse), frontend/ (smoke, click-all, cuaca, banjir, ipu, muse, filter-bar, ams, startup-csp, snapshot, intervensi-test)
│                               scripts/ambil-cuaca.js, ambil-banjir.js, ambil-ipu.js, ambil-muse.js  Skrip CLI ambil data (npm run cuaca:ambil / banjir:ambil / ipu:ambil / muse:ambil)
│                               api/services/cuaca.js, banjir.js, kualiti-udara.js, muse.js, muse-lokasi.js, util-rangkaian.js  Pengambil, normalisasi, risiko, senario, cache dan berita AI Muse
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
npm test                # smoke, klik semua butang, API cuaca/banjir/IPU/Muse/amaran data.gov.my, peta (asas, amaran, radar), kad cuaca, banjir, IPU, AI Muse, bar penapis, AMS, permulaan + CSP (set BROWSER_PATH jika lain)
npm run cuaca:ambil     # ambil data cuaca sebenar sekarang (MET + Open-Meteo)
npm run banjir:ambil    # ambil data banjir sebenar sekarang (JPS Malaysia + JPS Selangor)
npm run ipu:ambil       # ambil IPU sebenar sekarang (JAS MyEQMS)
npm run muse:ambil      # ambil berita AI Muse sekarang (Google Drive db-curated)
npm run format          # format kod dengan Prettier
```

Buka melalui `npm start`. Membuka `index.html` terus (file://) masih berfungsi, tetapi header keselamatan hanya dihantar oleh pelayan.

## Data cuaca sebenar

Sumber: **MET Malaysia** (api.met.gov.my v2: ramalan negeri `FORECAST/GENERAL` dan amaran rasmi dataset `WARNING`) dan **Open-Meteo** (suhu, kelembapan, hujan, angin, tiupan, 3 hari untuk 15 PO). Atribusi: Data cuaca: Open-Meteo.com (CC BY 4.0).

- Pembolehubah persekitaran dalam `.env` (jangan commit): `MET_API_TOKEN` dan `MET_API_BASE` (lalai `https://api.met.gov.my/v2`). Token tidak pernah dihantar ke pelayar, cache atau log.
- Jalankan `npm start`. Semasa permulaan pelayan mengambil data jika cache tiada atau lebih 24 jam, kemudian menyemak setiap jam. Cache: `data/processed/cuaca-terkini.json` (diabaikan git; boleh ditukar dengan `CUACA_CACHE_FILE`; `CUACA_AUTO=0` mematikan pengambilan automatik).
- Ambil secara manual: `npm run cuaca:ambil`. Alternatif Windows Task Scheduler (harian 06:00): `schtasks /Create /SC DAILY /ST 06:00 /TN "CuacaFAMA" /TR "cmd /c cd /d <laluan projek> && npm run cuaca:ambil"`.
- `GET /api/cuaca` memulangkan cache (503 jika belum ada; pelayar mencuba semula sebentar bila pelayan sedang mengambil data). Selepas menambah laluan baharu, **mulakan semula** pelayan (proses lama akan membalas 404).
- Risiko cuaca PO ialah anggaran sistem, bukan amaran rasmi. Ambang boleh ubah dalam `AMBANG` (`api/services/cuaca.js`): Tinggi jika hujan >= 30 mm atau (MET ribut petir/hujan lebat dan kebarangkalian >= 90%); Sederhana jika >= 10 mm, kebarangkalian >= 70% atau tiupan >= 40 km/j.
- Senario AMS dijana di pelayan (`bangunSenario`): Hujan Lebat (>= 30 mm atau MET hujan lebat), Ribut Petir & Angin Kencang (MET ribut petir atau tiupan >= 40 km/j) dan Hujan Berterusan (>= 2 hari berturut-turut, kebarangkalian >= 70% dan hujan >= 1 mm).
- Kad "Amaran Rasmi (MET Malaysia & JPS)" memaparkan amaran sebenar sehingga 7 hari lepas. Amaran aktif dipaparkan dahulu, disusun ikut tahap (Bahaya, Buruk, Waspada, lain-lain) kemudian masa dikeluarkan; amaran Tamat menyusul, terbaharu dahulu. Amaran aktif di luar 7 terkini tidak disembunyikan.
- Membuka `index.html` melalui `file://` tidak menyokong data sebenar (perlu `npm start`).

## Data banjir (JPS) dan kualiti udara (JAS)

**Banjir.** Sumber: Public Info Banjir JPS Malaysia (`latestreadingstrendabc.json` dan `getdisse.php`), JPS Selangor (`infobanjirjps.selangor.gov.my/JPSAPI/api/LatestAlert/Telemetry`) dan sejarah banjir 2024 Selangor (ArcGIS `BANJIR_2024`). Selang: banjir setiap 30 minit (`BANJIR_POLL_MIN`), sejarah setiap 7 hari. Cache: `data/processed/banjir-terkini.json` dan `banjir-sejarah.json` (diabaikan git). Endpoint: `GET /api/banjir`.

**Kualiti udara.** Sumber: JAS MyEQMS (`eqms.doe.gov.my`, lapisan peta stesen dan `apitablehourly`). Selang: setiap 60 minit (`IPU_POLL_MIN`). Cache: `data/processed/kualiti-udara-terkini.json`. Endpoint: `GET /api/kualiti-udara`. Kad "Kualiti Udara (IPU) Berhampiran PO" memaparkan IPU stesen terdekat bagi setiap 15 PO, terburuk dahulu. Jalur: Baik (0-50), Sederhana (51-100), Tidak Sihat (101-200), Sangat Tidak Sihat (201-300), Berbahaya (301+). Stesen lebih 50 km ditanda "jauh"; bacaan lebih `IPU_STALE_JAM` (3 jam) ditanda "lapuk". Ini bacaan stesen terdekat, bukan di lokasi PO.

**Pembolehubah persekitaran** (semua pilihan; lihat `.env.example`; tiada token diperlukan): `BANJIR_RADIUS_KM` (25), `BANJIR_POLL_MIN` (30), `BANJIR_DATA_MAX_JAM` (3), `IPU_POLL_MIN` (60), `IPU_STALE_JAM` (3), `BANJIR_AUTO` / `IPU_AUTO` (`0` mematikan pengambilan automatik), `BANJIR_CACHE_FILE`, `BANJIR_SEJARAH_FILE`, `IPU_CACHE_FILE`.

**Peraturan penapis banjir.** Bacaan paras air (WL) dan hujan (RF) lebih tua daripada 3 jam dibuang secara berasingan. Bacaan Error/kosong dan `-9999` tidak sah. Status `Danger` dengan nilai paras `<= 0` dibuang sebagai palsu. Stesen JPS Selangor menggantikan stesen nasional yang sama (padan ikut id, atau nama dan jarak kurang 1 km).

**Peraturan risiko banjir PO** (turutan tetap, radius `BANJIR_RADIUS_KM`): Tinggi jika ada stesen Bahaya atau Amaran, atau amaran rasmi aktif menyebut negeri PO; selain itu Tiada data jika tiada stesen paras air sah; Sederhana jika ada stesen Waspada atau hujan Lebat/Sangat lebat; selebihnya Rendah. Senario "Risiko Banjir" hanya wujud bila ada PO berisiko Tinggi. Risiko ini ialah anggaran sistem berdasarkan data JPS, bukan amaran rasmi.

**Atribusi.** Setiap kad memaparkan sumber: "JPS Malaysia (Public Info Banjir)", "JPS Selangor" dan "JAS (MyEQMS)".

**Had.** Selangor hanya melalui `LatestAlert/Telemetry` (tiada `StationRiverLevels`, `Announcements`, `Siren`). Data pusat pemindahan (PPS) tiada. Bentuk mesej `getdisse.php` belum disahkan semasa amaran sebenar (sentiasa `[]` ketika siasatan), jadi pengurai amaran JPS bersifat longgar. Sumber ialah data awam tanpa API rasmi berdokumen; strukturnya boleh berubah tanpa notis.

**Kebenaran sebelum pengeluaran (production).** Tiada terma yang membenarkan capaian automatik dinyatakan oleh JPS atau JAS. Kebenaran bertulis daripada JPS (Malaysia dan Selangor) dan JAS diperlukan sebelum dashboard ini digunakan di production. Prototaip ini menghantar `User-Agent: FAMA-dashboard-prototype`, selang yang jarang dan GET sahaja.

**Penafian.** Dashboard ini ialah penyokong keputusan, bukan sistem amaran rasmi. Rujuk MET Malaysia, JPS dan JAS untuk amaran dan status rasmi.

## AI Muse (Google Drive db-curated)

**Sumber.** Folder Google Drive awam `1wXNm0nG7dUOvNWkepN9ev3BcgwFZEn8M`. Hanya fail `db-curated-YYYY-MM-DD.json` dibaca; fail lain diabaikan. Data folder dikemas kini dari semasa ke semasa, jadi sistem mengambilnya secara berjadual.

**Paparan.** Ruangan "AI Muse - Gambaran Mingguan Komoditi" memaparkan berita seminggu sahaja, Isnin hingga Ahad mengikut waktu Malaysia (MYT). Minggu lalai ialah minggu `latestDate` dalam data; minggu lain boleh dipilih.

**Penjadual.** Pelayan mengambil data semasa permulaan, kemudian setiap 6 jam (`MUSE_POLL_JAM`). Ambil secara manual dengan `npm run muse:ambil`.

**Pembolehubah persekitaran** (lihat `.env.example`):

- `GOOGLE_API_KEY`: pilihan. Jika diisi, Drive API digunakan; jika kosong, paparan folder HTML digunakan. Jangan commit `.env`.
- `MUSE_DRIVE_FOLDER_ID`: ID folder Drive (lalai folder di atas).
- `MUSE_WEEKS`: bilangan minggu dikekalkan (lalai 8).
- `MUSE_POLL_JAM`: selang semakan dalam jam (lalai 6).
- `MUSE_AUTO`: `0` mematikan pengambilan automatik.

**Endpoint.** `GET /api/muse?minggu=YYYY-MM-DD`. Tarikh disesuaikan ke Isnin minggu itu; tanpa `minggu`, minggu `latestDate` digunakan. Respons turut menyenaraikan minggu yang tersedia.

**Cache.** `data/processed/muse-curated.json` (boleh ditukar dengan `MUSE_CACHE_FILE`) dan folder `data/processed/muse/` (`MUSE_DIR`). Kedua-duanya diabaikan git.

**Penjadual luaran.** Windows Task Scheduler (harian 06:00):

```
schtasks /Create /SC DAILY /ST 06:00 /TN "MuseFAMA" /TR "cmd /c cd /d <laluan projek> && npm run muse:ambil"
```

Linux cron (setiap 6 jam):

```
0 */6 * * * cd /laluan/projek && npm run muse:ambil
```

**Had.** Lokasi berita diekstrak daripada teks nota, jadi sesetengah berita mungkin tiada lokasi. Struktur fail Drive bukan API rasmi berdokumen dan boleh berubah tanpa notis.

## Peta utama (Pemantauan)

Kawalan peta berada di penjuru kanan atas peta. Pada skrin 640 px dan ke bawah, kawalan runtuh menjadi satu butang **Lapisan**.

- **Peta asas**: Lalai (CARTO), Terrain (OpenTopoMap, zum maks 17), Jalan (OpenStreetMap, zum maks 19) dan Satelit (Esri World Imagery, zum maks 19). Pilihan disimpan dalam `localStorage` (`fama_peta_asas`). Tukar peta asas memuat semula gaya peta dan memasang semula lapisan tindihan (stesen banjir JPS, amaran cuaca). Penanda PO ialah elemen DOM dan tidak terjejas. Atribusi setiap peta dipaparkan pada kawalan atribusi. Tile dimuat oleh pelayar seperti biasa tanpa prefetch; hanya cache HTTP piawai digunakan.
- **Amaran Cuaca** (togol): amaran aktif MET Malaysia daripada `https://api.data.gov.my/weather/warning` ditanda pada titik tengah negeri yang disebut dalam teks amaran (tiada poligon negeri dalam projek, jadi kedudukan ialah anggaran), warna ikut tahap. Pop-up memaparkan tajuk, tempoh sah dan teks ringkas dengan **Lihat lagi**. Amaran data.gov.my yang tidak menyamai amaran `api.met.gov.my` (tajuk sama, masa dikeluarkan dalam 60 minit, negeri bertindih) juga masuk ke kad Amaran Rasmi dengan sumber "MET Malaysia (data.gov.my)".
- **Radar cuaca**: iframe Windy telah diganti dengan lapisan cuaca natif (bahagian "Lapisan cuaca" di bawah).
- **Google Maps**: pop-up PO, stesen banjir JPS dan amaran cuaca ada pautan "Buka di Google Maps" (`https://www.google.com/maps/search/?api=1&query=lat,lng`). Pautan sahaja, tiada API. Baris kad Stesen Banjir JPS tiada pautan kerana baris ialah butang.
- Ikon penanda Leaflet (cdnjs) tidak diperlukan; peta menggunakan penanda sendiri dan CDN tidak ditambah.

**Amaran data.gov.my (pelayan).** `GET /api/met-malaysia` memulangkan cache amaran ternormal. Semakan setiap 30 minit (`AMARAN_DG_POLL_MIN`), tamat masa 20 s, 1 percubaan semula, `User-Agent: FAMA-dashboard-prototype`. Had kadar data.gov.my kira-kira 4 permintaan seminit. Cache: `data/processed/amaran-datagov.json` (`AMARAN_DG_CACHE_FILE`; `AMARAN_DG_AUTO=0` mematikan pengambilan automatik). Tanpa cache, respons ialah 200 dengan `amaran: []`. Setiap amaran ada `pendua` jika sama dengan amaran MET yang sedia ada.

**Had tile.** Tile OpenStreetMap untuk penggunaan ringan sahaja ([dasar tile OSM](https://operations.osmfoundation.org/policies/tiles/)); untuk production gunakan penyedia tile yang sesuai. OpenTopoMap juga untuk penggunaan sederhana. Peta tab Intervensi (`src/js/intervensi.js`) belum mendapat pilihan peta asas dan pautan Google Maps (cadangan susulan).

## Lapisan cuaca

Menu **Lapisan cuaca** pada peta utama (dalam butang `Lapisan` pada mobil): Radar cuaca, Satelit, Angin, Hujan/petir, Suhu, Penjejak siklon, Awan, Ombak, Kumpulan hujan, Ribut petir. Satu lapisan utama pada satu masa; Radar, Satelit dan Siklon ialah tindihan. Garis masa (main/jeda) untuk ramalan 72 j atau imbasan radar/satelit; klik peta untuk nilai pada titik. Ribut petir ialah anggaran (CAPE dan kod cuaca). Windy diganti dengan lapisan natif ini; tiada iframe.

| Lapisan                                       | Sumber                                             | Laluan                                                     |
| --------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Grid (angin, suhu, awan, hujan, ombak, ribut) | Open-Meteo (CC BY 4.0), grid 0.5°, 615 titik, 96 j | `/api/grid/meta`, `/api/grid?var=&jam=`, `/api/grid/titik` |
| Radar                                         | RainViewer                                         | `/api/radar`                                               |
| Satelit                                       | NASA GIBS (Himawari IR)                            | `/api/satelit`                                             |
| Siklon                                        | GDACS                                              | `/api/siklon`                                              |

- Had percuma Open-Meteo: 10 000 unit/hari, bukan komersial. Satu muat semula = 12 permintaan / 1046 unit (larian pertama 14 / 1230, membina topeng laut); setiap 6 j (`GRID_POLL_JAM`) ~4 200 unit/hari. Pengawal kuota harian `GRID_KUOTA_HARIAN` (lalai 8000). RainViewer percuma, skala kecil tanpa SLA.
- Produksi: letak kunci dalam `.env` sahaja (`OPEN_METEO_API_KEY`, `OPEN_METEO_BASE`, `OPEN_METEO_MARINE_BASE`, `RAINVIEWER_BASE`, `GRID_RES_DEG`, `GRID_POLL_JAM`). Kunci tidak pernah dihantar ke pelayar atau log. Jika `RAINVIEWER_TILE_HOST` ditukar, kedua-dua CSP (`config/security.js` dan `<meta>` index.html) mesti disunting.
- Skrip: `npm run grid:ambil`, `npm run siklon:ambil` (jalankan sekali sahaja; setiap larian grid menggunakan kuota).
- CORS disahkan 17 Nov 2026: tilecache.rainviewer.com dan gibs.earthdata.nasa.gov memulangkan `Access-Control-Allow-Origin: *`.
- Atribusi: Open-Meteo.com, RainViewer, NASA GIBS / JMA Himawari, GDACS.

## Fungsi dashboard

**Tab Pemantauan Komoditi**

- Peta MapLibre 15 PO dengan status risiko (Kritikal / Berwaspada / Stabil), lapisan banjir, zum ke daerah seliaan dan pop-up logistik PO.
- Penapis: komoditi, PO, indikator, mod senarai dan julat tren.
- KPI: PO dalam tapisan, kritikal, berwaspada, stabil dan isu komoditi.
- Analisis harga: 5 harga terendah dan 5 tertinggi, perbandingan negeri/daerah, trend harga harian dengan jalur sigma dan had lantai/siling.
- Ramalan cuaca sebenar (MET Malaysia + Open-Meteo), amaran rasmi MET dan AI Multi-Scenario Monitoring yang dijana daripada data cuaca sebenar.
- Rekod tindakan intervensi (disimpan dalam pelayar), eksport CSV harga dan logistik PO.
- Tema Gelap / Cerah yang diingati oleh pelayar.

**Tab Dashboard Intervensi Komoditi**

- Peta outlet dan daerah, senarai keutamaan isu dan paparan logistik PO.
- Mobilisasi Stok Pintar: cadangan PO sumber/destinasi dan draf cadangan intervensi.
- Simulasi Margin & Harga, serta AI Muse (berita mingguan sebenar daripada Google Drive db-curated).

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
- AI Muse pada larian pertama: `/api/muse` dulu membalas 503 semasa cache sedang dibina dari Google Drive, dan panel kekal ralat. Kini pelayan membalas `202` + `Retry-After: 10`. Panel memaparkan "sedang diambil" dan cuba semula secara automatik (maksimum ~5 minit). 503 hanya dibalas jika tiada cache dan tiada pengambilan berjalan. Diuji dengan `tests/frontend/muse-first-run.js`.

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

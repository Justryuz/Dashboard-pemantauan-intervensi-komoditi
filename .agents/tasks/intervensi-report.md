# Laporan Akhir: Dashboard Intervensi Komoditi

Status: diluluskan oleh semakan (`intervensi-review.md`, APPROVED). Ujian automatik terakhir: `JUMLAH GAGAL: 0` (`intervensi-verification.md`). Ujian tidak dijalankan semula semasa menulis laporan ini.

## 1. Fail diubah

| Fail | Perubahan |
|---|---|
| `Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html` | Satu-satunya fail aplikasi yang diubah (799,833 bait; asal 671,929 bait). Ditambah: bar tab, pembungkus `#viewMonitor` untuk halaman asal, `#viewIntervensi` dengan enam paparan, blok gaya `#ivStyle`, dan skrip `#ivScript` (IIFE yang mendedahkan `IV_TEST`). |
| `.agents/tasks/backup-before-intervensi.html` | Sandaran fail asal. Folder projek bukan repositori git, jadi pemulihan dibuat dengan menyalin semula fail ini. Tiada commit dibuat. |
| `.agents/tasks/intervensi-test.js` | Ujian puppeteer-core (Edge tanpa kepala). Tangkapan skrin ialah per-panel, maksimum 1600x1600 px. |
| `.agents/tasks/intervensi-design.md`, `intervensi-verification.md`, `intervensi-review.md`, `intervensi-test-output.txt`, `intervensi-*.png` | Dokumen reka bentuk, bukti, semakan dan tangkapan skrin. |

Tab Pemantauan asal tidak dibuang atau ditulis ganti. Ia hanya dibungkus dan kekal sebagai tab lalai. Ujian regresi lulus: 15 penanda PO, `#floodToggle`, `#showLogs`, senario AMS, bilangan rekod `#filterCommodity`, dan tiada mesej konsol baharu.

## 2. Cara membuka tab "Dashboard Intervensi Komoditi"

1. Buka `Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html` dalam pelayar.
2. Klik tab **Dashboard Intervensi Komoditi** pada bar tab di bahagian atas (tab pertama ialah halaman Pemantauan asal).
3. Pautan terus: tambah `#intervensi` pada URL. Contohnya `...Interaktif.html#intervensi`. `#pemantauan` kembali ke halaman asal. Pautan dalam hanya dilaksanakan selepas halaman dan senario selesai dimuat.

Tiada penghala dalam aplikasi, jadi tab ini berfungsi sebagai halaman baharu (andaian A6.1 dalam reka bentuk). Tajuk: "Dashboard Intervensi Komoditi". Subtajuk: "Pemantauan Harga, Bekalan dan Cadangan Intervensi Pasaran".

## 3. Enam paparan

Bar penapis: Komoditi, Negeri (menapis PO secara berlata), Pusat Operasi, Daerah, Tempoh Analisis, Tahap Risiko, butang Set Semula, dan bahagian "Tetapan Ambang" (ambang boleh ditetapkan dan di-reset).

| # | Panel (ID) | Fungsi |
|---|---|---|
| 1 | Peta Geospatial Malaysia (`#ivMapPanel`) | Tab **PENGELUAR \| PENGGUNA** (lalai PENGELUAR). 15 penanda PO menggunakan peta sedia ada. Warna: hijau, kuning, merah berkelip. Klik PO: zum, serlah daerah, papar outlet (Pasar Awam, PTK, RAKR, Agrobazaar) dengan ikon berbeza, penapis kategori, legenda, popup outlet. Jika peta gagal dimuat, senarai 15 butang PO dipaparkan dan masih boleh memilih PO. |
| 2 | Kesiapsiagaan Logistik PO (`#ivLogPanel`) | Angka logistik PO terpilih. Jika tiada PO dipilih, papar **Jumlah Keseluruhan (15 PO)** (atau Jumlah Negeri jika penapis Negeri dipilih): empat penunjuk dijumlah, kapasiti kumpulan dikongsi (Dengkil/Selayang, Johor Bahru/Simpang Renggam) dikira sekali, PO tanpa data dikecualikan dan dinyatakan, ketersediaan semasa dijumlah daripada kumpulan berdata sahaja (tidak disimpulkan daripada kapasiti maksimum), dan senarai pecahan PO boleh diklik untuk memilih PO. PO tanpa data logistik dipaparkan "tidak dapat dinilai". |
| 3 | Senarai Keutamaan Intervensi (`#ivPriPanel`) | Baris disusun mengikut skor (0 hingga 100) untuk mod semasa. Butang Tindakan memilih PO, memaparkan sepanduk cadangan dan kekal pada tab. |
| 4 | AI Smart Stock Mobilisation (`#ivMobPanel`) | Cadangan PO sumber (Pengguna) atau PO destinasi (Pengeluar), Dalam Negeri dan Luar Negeri, dengan pemberat boleh laras (jumlah 100), had jarak, pengecualian zon dan amaran banjir. Draf intervensi disimpan dalam `localStorage` tanpa pendua dan boleh dipadam. |
| 5 | AI Margin & Price Simulation (`#ivMarPanel`) | Simulasi julat harga untuk margin sasaran. Mesej tepat: "Tiada julat harga yang memenuhi margin sasaran". Amaran jika harga beli melebihi harga jual, dan mesej sejarah tidak mencukupi. Tiada NaN atau Infinity. |
| 6 | AI Muse Weekly Commodity Insight (`#ivMusePanel`) | Kad isu diringkaskan: bar keterukan, komoditi, lokasi, satu chip risiko dengan trend, ayat insight bersih, blok Tindakan disyorkan (PO berkaitan atau PO belum disahkan) dan butang Buka Tindakan Intervensi (hanya jika PO sah, membuka pop-up Mobilisasi). Metrik sekunder, sparkline dan bukti dalam bahagian Butiran (tutup secara lalai). Kad disusun mengikut keterukan kemudian perubahan risiko; kriteria isu dalam <details>. Navigasi minggu kekal. Sandaran: backup-before-muse-ringkas.html. Minggu kosong: "Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini". Ralat muat ada butang Cuba Semula. |

## 4. Keadaan kongsi antara paparan

- Satu objek `ivState` yang diubah hanya melalui `ivDispatch(action, payload)`. Tiada sistem keadaan kedua. Keadaan ini berasingan daripada keadaan tab Pemantauan asal (diuji: tindakan pada tab asal tidak mengubah `ivState`).
- Medan utama: mod (PENGELUAR/PENGGUNA), penapis (komoditi, negeri, PO, daerah, tempoh, risiko), PO terpilih, kategori outlet, pemberat dan had mobilisasi, minggu Muse, dan ambang.
- Aliran: mengubah penapis atau mod atau mengklik PO pada peta atau Tindakan di Paparan 3 menggerakkan semua paparan lain. Mengubah mod menukar penanda peta, senarai keutamaan, dan arah Paparan 4. Paparan 6 boleh memindahkan isu terus ke PO terpilih. Set Semula memulihkan lalai.
- Arah amaran berbeza: Pengeluar menjejak harga ladang jatuh (amaran -8 %, kritikal -15 %). Pengguna menjejak harga runcit naik (amaran +8 %, kritikal +15 %). Nilai boleh ditetapkan. Harga sahaja menghasilkan "Waspada". "Kritikal" memerlukan pengesahan bekalan (lebihan untuk Pengeluar, kekurangan untuk Pengguna). Data stok lapuk (lebih 72 jam) tidak disahkan.

## 5. Andaian data dummy

- Semua data bukan sebenar dilabel "DATA DUMMY" (19 kejadian dalam HTML), dan lencana sedia ada "SIMULASI · DATA DUMMY" kekal.
- Hanya nama PO, 15 koordinat bandar anggaran dan angka logistik daripada infografik ditanda `sebenar`. ID dan data PO sedia ada dikekalkan.
- **Pembetulan kedudukan penanda peta (Paparan 1):** punca ialah CSS, bukan koordinat. `.iv-po-marker{position:relative}` menimpa `position:absolute` MapLibre, jadi penanda terkeluar dari kedudukan lng/lat. Peraturan itu dibuang. Penanda outlet RAKR (`transform:rotate`) juga menimpa `transform` MapLibre; putaran dialihkan ke `::before`. Satu koordinat memang tidak tepat dan dibetulkan: Simpang Pulai 4.51,101.07 menjadi 4.61,101.15. 14 PO lain dikekalkan (beza ≤0.04°). Ujian regresi `3d` menyemak lat/lng, kedudukan piksel DOM sama dengan `map.project`, dan penanda dalam bekas peta.
- Koordinat PO ialah lokasi anggaran untuk prototaip. Peta daerah ke PO, taburan outlet (Pasar Awam, PTK, RAKR, Agrobazaar) dan lokasi daerah ialah dummy dan berlabel. Outlet sampel lama ("PTKR", "AKR") tidak digunakan semula kerana tiada pemetaan disahkan.
- Jam prototaip tetap `2026-11-15T12:00+08:00` (`IV_CONFIG.refNow`) supaya ujian minggu stabil.
- Rekod harga `DATA.rekod` sedia ada adalah simulasi aplikasi sendiri. Pindaan harga (`IV_PRICE_OVERLAY`) dan bekalan (`IV_SUPPLY_OVERRIDE`) ialah dummy untuk senario ujian T1 hingga T8 dan dilabel.
- Kos operasi PO, sejarah margin dan sembilan nota AI Muse (`IV_MUSE_RAW`, M01 hingga M09) ialah dummy. Contoh rujukan Kelapa Tua (M01) diletakkan di luar minggu semasa mengikut peraturan, dan hanya muncul pada minggu 2 hingga 8 Nov. Tukar tarikh acara M01 kepada 2026-11-11 untuk memaparkannya dalam minggu semasa.
- Tiada enjin ambang harga sedia ada untuk digunakan semula. Ambang peratusan ialah baharu dan dilabel "Ambang prototaip (boleh ditetapkan)". `hargaLantai` dan `hargaSiling` sedia ada digunakan sebagai had mutlak. Pemberat skor dan had jarak (lalai 550 km) ialah anggaran prototaip.
- AI ialah penyesuai olok-olok deterministik (`mock-deterministik-v1`). Angka datang daripada enjin, bukan teks AI. Penjelasan dipaparkan dalam kad "Ringkasan AI (simulasi)". Jika AI gagal, templat deterministik digunakan.

## 6. Cara menjalankan dan menguji

```
cd .agents/tasks/bt
node ../intervensi-test.js
```

- Keperluan: Node.js, `puppeteer-core` dalam `.agents/tasks/bt/node_modules`, dan pelayar Edge (tanpa kepala, SwiftShader). Ujian membaca fail HTML sasaran dan `backup-before-intervensi.html` (untuk regresi).
- Hasil dijangka: kod keluar 0 dan baris akhir `JUMLAH GAGAL: 0`. Output penuh dalam `intervensi-test-output.txt`. Tangkapan skrin per-panel (maksimum 1600 px) disimpan sebagai `intervensi-{1440,1024,390}-<panel>.png`.
- Liputan: lint skrip, pengasingan daripada tab asal, tab dan pautan terus, mod dan peraturan risiko, klik kesemua 15 PO, penapis dan Set Semula, ambang, enjin mobilisasi dan draf, simulasi margin, Muse mingguan, suntikan kegagalan (AI, peta, Muse), sapuan semua butang (20 daripada 22 diklik; 2 tersembunyi atau dilumpuhkan), responsif 1440/1024/390 px (tiada tatal mendatar), regresi tab asal dan konsol.
- Kawalan manual: konsol pelayar `window.IV_TEST` menyediakan `setRefNow(...)`, `withholdDistrictMap(poId)` dan `failNext('ai'|'muse'|'map')`.
- Pemulihan jika perlu: salin `.agents/tasks/backup-before-intervensi.html` ke atas fail HTML sasaran.

## 7. Keperluan FDW, API dan AI yang tinggal

Prototaip ini berjalan sepenuhnya dalam satu fail HTML dengan data dummy. Untuk operasi sebenar:

1. **FDW / data harga**: ganti `DATA.rekod` dan `IV_PRICE_OVERLAY` dengan harga ladang, borong dan runcit sebenar mengikut komoditi, daerah dan tarikh. Sediakan siri sejarah untuk simulasi margin (kini dijana oleh `IV_HISTORY_OVERRIDE` dan penjana dummy).
2. **Data bekalan dan stok**: ganti `IV_SUPPLY_OVERRIDE` dengan stok tersedia, tempahan dan keperluan sebenar mengikut PO dan komoditi, dengan cap masa `lastUpdated` (untuk peraturan data lapuk 72 jam).
3. **Master data lokasi**: koordinat tepat PO, pemetaan rasmi daerah ke PO, sempadan daerah GeoJSON, dan senarai outlet sebenar (Pasar Awam, PTK, RAKR, Agrobazaar) dengan kategori dan koordinat disahkan. Sahkan juga pemetaan PTKR ke PTK dan AKR ke RAKR.
4. **Logistik**: angka kesiapsiagaan untuk semua 15 PO. Kini hanya sebilangan kecil PO mempunyai angka (antaranya Kota Kinabalu, Simpang Renggam, Kota Baharu dan Ayer Keroh); PO lain dipaparkan "tidak dapat dinilai".
5. **Operasi PO**: kos operasi sebenar (`IV_OPCOST`) serta had jarak dan peraturan zon (Semenanjung, Sabah, Sarawak).
6. **Banjir dan cuaca**: suapan amaran banjir sebenar, bagi menggantikan `DATA.banjir` dan senario AMS S03 simulasi.
7. **API AI (bahagian belakang)**: `aiAdapter` ialah satu-satunya tempat teks AI dijana. Setiap kaedah patut menjadi `fetch` ke bahagian belakang, contohnya `POST /api/ai/mobilisation-explain`, `/margin-explain` dan `/muse-extract`, tanpa kunci API dalam pelayar. Kontrak dan pengesahan respons (`ivValidateAi`, 1 hingga 1200 aksara, tamat masa 4 saat) kekal.
8. **AI Muse**: `ivDataService.loadMuse()` ialah satu titik tukar, contohnya `fetch('/data/muse-weekly.json')` atau titik akhir pemprosesan harian. Pengekstrakan isu, lokasi (disahkan, hanya disebut, belum disahkan) dan skor risiko perlu dilakukan di bahagian belakang. Ambang jalur risiko (hijau di bawah 20, kuning 20 hingga 39, merah 40 ke atas) perlu disahkan.
9. **Penyimpanan draf intervensi**: kini `localStorage` (kunci draf berasingan daripada log "Rekod Tindakan"). Perlu pangkalan data dan aliran kelulusan pada pelayan.
10. **Pengesahan peraturan perniagaan**: ambang peratusan (±8 %, ±15 %), minimum lebihan 3 MT dan nisbah 0.15, liputan kekurangan 0.8, dan pemberat skor perlu disahkan oleh pihak FAMA.

## 8. Kos pengangkutan dan jurang harga bersih (dibuang sementara)

Panel 4 (Mobilisasi Stok Pintar AI) tidak lagi memaparkan atau mengira kos pengangkutan dan jurang harga bersih kerana data belum wujud. Skor calon kini = wajaran harga (lalai 65%) x kelebihan harga mentah berbanding harga rujukan (dinormalkan dalam senarai) + wajaran jarak (lalai 35%) x (1 - jarak/had jarak), tolak 5 mata jika waspada banjir. Kelayakan: zon, stok/permintaan, kebolehlaksanaan laluan, banjir, PO terpilih dikecualikan, had jarak, dan harga lebih baik daripada rujukan. Medan draf 	ransportCostPerKg dan 
etGapPerKg dibuang (draf lama dalam localStorage diabaikan tanpa ranap). Apabila data kos sebenar tersedia, kos angkut perlu ditambah semula sebagai komponen kelayakan dan skor. Kos Operasi dan Spread Harga Borong (Panel 5) kekal.

## Nota susun atur: Mobilisasi & Margin sebelah menyebelah
- #ivMobPanel dan #ivMarPanel dibungkus dalam .iv-grid-mid (2 lajur sama lebar, align-items:start) pada lebar >=1100px; di bawah itu disusun menegak. #ivMusePanel kekal lebar penuh di bawah.
- Padding/fon dikecilkan sederhana (teks >=12px); kawalan input 2 lajur, metrik 2x2, senarai Top 5 disusun menegak, kad cadangan ditindan. Tiada perubahan fungsi/ID.
- Ujian: tambah semakan sebelah menyebelah (1440), tindan (390), tiada limpahan mendatar (1440/1024/390) dan tangkapan .iv-grid-mid. JUMLAH GAGAL: 0.

## Nota susun atur: bahagian atas (peta | logistik + keutamaan)

- Desktop (>=1100px): peta (~59%) di kiri, lajur kanan (~41%) menyusun Kesiapsiagaan Logistik (tinggi semula jadi, jubin 2x2) dan Senarai Keutamaan di bawahnya. Bekas `.iv-grid-top` tinggi tetap 760px, jadi atas dan bawah peta sama dengan lajur kanan. Senarai keutamaan memenuhi baki tinggi dan skrol dalaman (skrol nipis gelap); halaman tidak membesar mengikut bilangan baris.
- Tab mod PENGELUAR | PENGGUNA dan nota penunjuk dialihkan ke bar di atas peta supaya tidak menutup penanda PO. Penapis outlet dan legenda berada dalam bar bawah peta. `ResizeObserver` memanggil `map.resize()` apabila bingkai peta berubah saiz.
- Baris keutamaan: baris 1 penanda tahap + komoditi + daerah/negeri + chip skor; baris 2 PO dan jenis isu; baris 3 harga semasa -> forecast; baris 4 intervensi dan butang Tindakan di kanan.
- Tablet (700-1099px): peta penuh lebar (460px), logistik dan keutamaan dua lajur di bawah. Mudah alih (<700px): disusun menegak, peta 380px, senarai keutamaan maks 480px skrol dalaman.
- Chip skop pendua dalam pengepala Logistik (paparan Jumlah) dibuang. Pecahan mengikut PO, Ketersediaan Semasa serta kos/jurang harga kekal tersembunyi.

## Nota susun atur: Mobilisasi / Margin / AI Muse
- Punca: .iv-grid-mid ialah grid 2 lajur yang mengandungi 3 panel; #ivMusePanel jatuh ke lajur kiri baris ke-2 (tiada grid-column:1/-1) dan lign-items:start menjadikan tinggi panel tidak sama.
- Pembetulan (CSS dalam #ivStyle + sedikit markup): Mob & Margin lign-items:stretch, tinggi min 380px / maks 720px dengan skrol dalaman pada .iv-pbody; placeholder dipusatkan; #ivMusePanel grid-column:1/-1; bar alat Muse (navigator minggu + Tarikh data terakhir sebaris); kad isu dalam grid 2 lajur (>=1100px) dengan jalur metrik; formula Margin dalam <details> (tiga definisi kekal kelihatan). <1100px: satu lajur.
- Ujian: ujian L (1440/1024/390) dalam intervensi-test.js; tangkapan: iv-mid-shots.js.

## Tema Gelap / Cerah

- Dua tema dalam satu fail, ditukar semasa runtime untuk kedua-dua tab. Togol "Gelap | Cerah" (`#temaGelap`, `#temaCerah`, `aria-pressed`) di bahagian atas kanan.
- Pilihan disimpan dalam `localStorage` kunci `fama_tema` (`gelap` | `cerah`). Skrip kecil dalam `<head>` menetapkan `data-theme` pada `<html>` sebelum cat pertama. Tiada simpanan atau nilai tidak sah = `gelap`. Togol tidak memuat semula halaman dan tidak menetapkan semula keadaan (PO dipilih, mod, penapis).
- Palet: `<style id="temaStyle">` (selepas `#ivStyle`). Gelap = nilai asal pada `:root`. Cerah = `html[data-theme="cerah"]`. Setiap warna hex asal dalam CSS diganti `var(--b…/--t…/--s…/--x…)` (b = latar/sempadan, t = teks/aksen, s = stroke, x = bayang). Pemboleh ubah asal (`--bg`, `--panel`, `--white`, `--muted`, `--cyan` dll.) juga dicerahkan. Carta SVG guna `--ch-*`.
- Melaras palet: ubah nilai dalam blok `html[data-theme="cerah"]` pada `#temaStyle`, atau tukar fungsi `mapB/mapT` dalam `.agents/tasks/tema-transform.js` dan jalankan semula (baca `backup-before-tema.html`, tulis fail dashboard; override manual dalam `tema-manual.css`). Warna baharu: guna `var(--white)`, `var(--panel)`, dsb. atau tambah pemboleh ubah di kedua-dua blok.
- Peta: asas peta Carto Voyager (cerah) kekal untuk kedua-dua tema; penanda, kawasan dan label peta tidak berubah.
- Ujian (`intervensi-test.js`, bahagian 15): lalai gelap, togol, simpanan, keadaan kekal, papan kekunci, kontras WCAG AA (cerah) dan tiada regresi kontras (gelap berbanding asal) pada 1440 dan 390, tiada skrol mendatar. Tangkapan skrin: `intervensi-tema-<gelap|cerah>-<1440|390>-*.png`.

## Pop-up Mobilisasi & Margin (tambahan)
- Panel #ivMobPanel dan #ivMarPanel dikeluarkan daripada aliran halaman dan dipindahkan ke dalam pop-up (#ivMd, role=dialog, aria-modal) sebagai dua tab: "Mobilisasi Stok Pintar AI" dan "Simulasi Margin & Harga AI". ID dan fungsi render asal dikekalkan.
- Dibuka melalui butang Tindakan (tab Mobilisasi), butang banner "Buka Mobilisasi Stok" dan butang Muse "Hantar Konteks ke Mobilisasi Stok". Memilih PO pada peta/penapis tidak membuka pop-up.
- Latar: backdrop-filter blur(7px) + lapisan malap (gelap rgba(5,12,28,.55), cerah rgba(15,37,64,.35)), fallback pepejal jika tiada backdrop-filter, animasi <=200ms, hormati prefers-reduced-motion.
- Tutup: butang X, Esc, klik latar. Perangkap fokus, fokus kembali ke butang asal, skrol halaman dikunci. Anak panah/Home/End menukar tab.
- Susun atur halaman: grid atas (peta/logistik/keutamaan) kemudian AI Muse lebar penuh; .iv-grid-mid dibuang.
- Ujian: .agents/tasks/intervensi-test.js dikemas kini (JUMLAH GAGAL: 0). Tangkapan skrin: intervensi-popup-{gelap,cerah}-{1440,390}-{mobilisasi,margin,tutup}.png. Sandaran: backup-before-popup.html.
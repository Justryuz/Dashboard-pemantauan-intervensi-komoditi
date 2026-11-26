# Prompt: Bina Dashboard Harga Cadangan PSI (Belian & Jualan)

> Salin prompt ini bulat-bulat kepada pembina dashboard (AI atau pembangun).
> Semua yang bertanda **[ISI]** perlu diisi dengan maklumat sebenar sebelum dibina.
> Formula di bawah ialah formula akhir yang dipersetujui pada 18 Nov 2026 — jangan ubah
> logiknya, jangan tambah semula apa yang telah dibuang.

---

## 1. Objektif

Bina satu dashboard interaktif untuk PSI yang memberi **dua cadangan harga setiap bulan,
untuk setiap varieti**:

| Trek | Cadangan | Aras data yang dipakai |
|---|---|---|
| **BELIAN** | Harga yang PSI patut bayar kepada petani/pembekal | **Peringkat ladang** |
| **JUALAN** | Harga yang PSI patut jual kepada pembeli | **Peringkat borong** |

Dashboard mesti memaparkan kedua-dua cadangan bersebelahan, berserta julat harga setiap
satu dan **margin kasar** antara keduanya.

## 2. Peraturan aras data (paling penting — jangan langgar)

1. **Jangan sekali-kali campur aras.** Semua input satu trek mesti dari aras yang sama:
   harga pasaran, harga transaksi dan unjuran SISDA semuanya ladang untuk trek BELIAN,
   semuanya borong untuk trek JUALAN.
2. **Formula yang sama dipakai pada kedua-dua trek**, tetapi setiap trek mengira
   nisbah, ralat dan wajarannya sendiri, berasingan. Nisbah ladang tidak boleh dipakai
   untuk borong, dan sebaliknya.
3. Setiap varieti dikira berasingan. Ketepatan SISDA (Ralat_Ramalan) berbeza ikut
   varieti DAN ikut aras — wajaran SISDA ditentukan semula untuk setiap pasangan
   varieti + aras.
4. Kira semula **bulanan sahaja**. Tiada kiraan mingguan, tiada harga dikunci sebulan.

## 3. Formula (dipakai pada setiap trek, setiap varieti, setiap bulan)

Semua harga dalam RM/kg. Semua nisbah dikira dari data 6 bulan terakhir.

> **Pindaan (22 Nov 2026):** Langkah 0 ditambah dan Langkah 1, 2, 5, 6, 7 dipinda
> untuk menangani data FIS yang tidak lengkap. Ini menyimpang daripada formula yang
> dipersetujui 18 Nov dan mesti dicatat dalam `dokumentasi-formula-fis-psi.pdf`.

**Langkah 0 — Tentukan Bulan_Sah (dipakai pada setiap trek dan setiap varieti)**

Dalam tetingkap 6 bulan terakhir, sesuatu bulan dikira bulan sah untuk sesuatu nisbah
hanya jika kedua-dua data pasangan nisbah itu ada:

- Nisbah_2_Bulan dan Nisbah_6_Bulan: ada harga transaksi (FIS) dan harga pasaran (AMI).
- Nisbah_SISDA dan Ralat_Ramalan: ada harga transaksi (FIS) dan unjuran SISDA.

Bulan yang tidak lengkap pasangannya digugurkan daripada kedua-dua pengangka dan
penyebut. Jangan sekali-kali masukkan bulan yang hanya ada separuh data.

**Langkah 1 — Nisbah_2_Bulan**
```
Bulan_2 = 2 bulan sah yang terkini dalam tetingkap 6 bulan
Nisbah_2_Bulan = Purata FIS (Bulan_2) / Purata AMI (Bulan_2)
```
Bulan yang sama dipakai untuk FIS dan AMI.
- Jika kurang daripada 2 bulan sah dalam tetingkap 6 bulan: "Data tidak lengkap —
  cadangan tidak dapat dikira" untuk trek itu.
- Jika Bulan_2 tidak termasuk bulan data terkini: paparkan amaran kuning
  "Nisbah 2 bulan bukan dari 2 bulan terkini".

**Langkah 2 — Nisbah_6_Bulan**
```
Bulan_6 = semua bulan sah dalam tetingkap 6 bulan
Nisbah_6_Bulan = Purata FIS (Bulan_6) / Purata AMI (Bulan_6)
```
Bulan_2 ialah subset Bulan_6, jadi kedua-dua nisbah dikira atas asas yang sama.

**Langkah 3 — Beza_Nisbah dan pilih nisbah**
`Beza_Nisbah = |Nisbah_2_Bulan − Nisbah_6_Bulan| / Nisbah_6_Bulan`

- Beza_Nisbah > 10% → guna Nisbah_2_Bulan (rejim berubah, ikut 2 bulan terkini)
- Beza_Nisbah ≤ 5% → guna Nisbah_6_Bulan (rejim stabil, ikut 6 bulan)
- 5% – 10% → guna purata kedua-duanya DAN tandakan **"Semakan manual"** pada cadangan itu

Nota: bila FIS jarang, Bulan_2 dan Bulan_6 bertindih banyak, jadi Beza_Nisbah
cenderung kecil dan nisbah 6 bulan lebih kerap dipilih. Ini dijangka, bukan ralat.

**Langkah 4 — Harga_Pasaran**
`Harga_Pasaran = Harga pasaran bulan terkini × Nisbah_Terpilih`

**Langkah 5 — Nisbah_SISDA**
`Nisbah_SISDA = Purata FIS / Purata SISDA`, atas bulan sah (FIS + SISDA) sahaja.
(SISDA selalunya lebih rendah daripada harga transaksi sebenar, jadi unjuran didarab
nisbah ini untuk dibawa naik ke paras transaksi.)

**Langkah 6 — Harga_Ramalan**
`Harga_Ramalan = Unjuran SISDA bulan cadangan × Nisbah_SISDA`
Guna unjuran SISDA **bulan yang dicadangkan**, bukan bulan semasa. Contoh: cadangan
Disember guna SISDA Disember.

**Langkah 7 — Ralat_Ramalan dan Berat_SISDA**
`Ralat_Ramalan = Purata |SISDA − FIS| / FIS`, atas bulan sah (FIS + SISDA) sahaja dalam
tetingkap 6 bulan.

Jika bulan sah SISDA kurang daripada 3, Berat_SISDA = 0 dan papar "SISDA tidak
diguna, data tidak mencukupi". (Ambang 3 bulan ialah cadangan; ubah jika perlu.)

| Ralat_Ramalan | Berat_SISDA |
|---|---|
| ≤ 5% | 0.50 |
| 5–10% | 0.30 |
| 10–20% | 0.10 |
| > 20% | 0 (SISDA tidak diguna) |

**Langkah 8 — Harga_Cadangan dan julat**
```
Harga_Cadangan = (1 − Berat_SISDA) × Harga_Pasaran + Berat_SISDA × Harga_Ramalan
Turun_Naik = Sisihan piawai harga transaksi bulanan / Purata harga transaksi (6 bulan)
Lebar_Julat = MIN(MAKS(5%, Turun_Naik), 10%)
Harga_Bawah = Harga_Cadangan × (1 − Lebar_Julat)
Harga_Atas  = Harga_Cadangan × (1 + Lebar_Julat)
```

## 4. Panel margin (antara dua trek)

```
Margin kasar (RM/kg) = Harga_Cadangan JUALAN − Harga_Cadangan BELIAN
Margin kasar (%)     = Margin kasar (RM/kg) / Harga_Cadangan BELIAN × 100
```

- Paparkan margin untuk tengah cadangan DAN untuk julat (margin paling kecil =
  Harga_Bawah JUALAN − Harga_Atas BELIAN).
- Jika margin tengah **negatif atau bawah [ISI: ambang margin minimum PSI, contoh 5%]**,
  tandakan cadangan itu merah dengan label **"Margin tidak mencukupi — semak semula"**.

## 5. Susun atur paparan

1. **Bar atas:** tajuk "Dashboard Harga Cadangan PSI", pemilih varieti, pemilih bulan
   cadangan, pemilih tahun, dan tarikh kemas kini data terakhir.
2. **Dua kad besar bersebelahan — BELIAN (ladang) dan JUALAN (borong).** Setiap kad:
   Harga_Cadangan (besar, RM/kg), julat Harga_Bawah – Harga_Atas, Harga_Pasaran,
   Harga_Ramalan, dan label status (biasa / Semakan manual / Margin tidak mencukupi).
3. **Kad margin** di antara atau di bawah kedua-dua kad: margin RM/kg dan %.
4. **Carta tren 12 bulan** (satu carta setiap trek, boleh tukar trek): garisan harga
   pasaran, harga transaksi dan unjuran SISDA; titik cadangan bulan semasa ditanda.
5. **Jadual diagnostik** (satu jadual setiap trek): Nisbah_2_Bulan, Nisbah_6_Bulan,
   Beza_Nisbah, Nisbah_Terpilih, Nisbah_SISDA, Ralat_Ramalan, Berat_SISDA,
   Turun_Naik, Lebar_Julat — supaya pegawai boleh audit kenapa cadangan itu keluar.
6. **Jadual data bulanan** (12 bulan): harga pasaran, harga transaksi, SISDA,
   beza RM dan beza %.
7. **Panel amaran:** (a) data lapuk — mana-mana sumber yang tarikh terakhirnya melebihi
   **[ISI: contoh 35 hari]** dari bulan cadangan; (b) Berat_SISDA = 0 — "SISDA tidak
   diguna, ralat melebihi 20%"; (c) Beza_Nisbah 5–10% — "Semakan manual"; (d) "Nisbah 2 bulan bukan dari 2 bulan
   terkini" (kuning).
8. **Butang eksport:** muat turun cadangan bulan semasa sebagai Excel (ikut struktur
   workbook `Cadangan_Harga_FIS_PSI_Dis2026.xlsx`) dan PDF ringkasan.

## 6. Sumber data dan medan (konfigurasi)

Dashboard membaca data sebenar dari tiga sistem — **bukan anggaran carta**:

| Sistem | Data | Medan yang diperlukan |
|---|---|---|
| Sistem AMI | Harga pasaran semasa (ladang dan borong) | varieti, aras, bulan, harga (RM/kg) |
| Sistem FIS | Harga transaksi FAMA sendiri (belian ladang, jualan borong) | varieti, aras, bulan, harga (RM/kg) |
| SISDA | Unjuran harga bulanan (ladang dan borong) | varieti, aras, bulan, unjuran (RM/kg) |

- Nama jadual dan lajur sebenar: **[ISI: isi nama jadual/lajur sebenar Sistem AMI, Sistem FIS dan SISDA — buat masa ini guna nama pemegang tempat dan jadikan ia tetapan konfigurasi, bukan kod keras]**.
- Paparkan pada dashboard: tarikh data terakhir bagi setiap sistem, supaya pengguna
  nampak data itu segar atau lapuk.
- Jika mana-mana input bulan terkini tiada, paparkan **"Data tidak lengkap — cadangan
  tidak dapat dikira"** untuk trek itu. Jangan ganti dengan anggaran atau nilai lama
  secara senyap.
- Kekosongan data FIS bulan terkini tidak lagi menghalang cadangan, selagi ada
  sekurang-kurangnya 2 bulan sah dalam tetingkap 6 bulan. Harga pasaran (AMI) bulan
  terkini dan unjuran SISDA bulan cadangan tetap wajib ada.
- Jadual diagnostik mesti menunjukkan bulan sebenar yang dipakai, cth.
  "Nisbah_2_Bulan: Sep–Okt 2026 (FIS Nov tiada)", serta bilangan bulan sah bagi
  Nisbah_6_Bulan dan Nisbah_SISDA.
- Penggantian ini tidak dikira anggaran atau nilai lama, tetapi mesti sentiasa
  kelihatan kepada pengguna.

## 7. Peraturan paparan

- Bahasa: **Bahasa Malaysia standard (Dewan Bahasa dan Pustaka)**. Jangan guna
  Bahasa Indonesia.
- Unit: RM/kg, dua titik perpuluhan. Nisbah dan peratus: dua titik perpuluhan.
- Warna status: hijau = biasa, kuning = Semakan manual, merah = Margin tidak
  mencukupi / data tidak lengkap.
- Paparan mesti boleh dibaca sepintas lalu tanpa klik — nombor cadangan dan julat
  sentiasa nampak di kad utama.
- Platform: **[ISI: pilih satu — aplikasi web interaktif / Power BI. Jika Power BI,
  guna DAX dari dokumen `dokumentasi-formula-fis-psi.pdf` muka surat 10 sebagai asas,
  dan bina satu ukuran berasingan untuk setiap trek (cth `[Harga_Cadangan_Belian]`,
  `[Harga_Cadangan_Jualan]`)].**

## 8. Perkara yang TIDAK BOLEH ada dalam dashboard

1. **Nisbah_Bulan_Terkini (R1)** — dibuang 18 Nov 2026 kerana tidak diguna dalam
   mana-mana kiraan. Jangan kira atau paparkannya.
2. **Harga_Lantai (L)** — dibuang 18 Nov 2026 kerana belum ditentukan. Jangan papar
   "Harga lantai: belum ditentukan", jangan buat amaran lantai, jangan tapis transaksi
   dengan lantai. (Akan ditambah semula bila senarai lantai rasmi kerajaan ada —
   tinggalkan satu nota kecil di kaki dashboard: "Peraturan harga lantai akan
   ditambah bila senarai lantai rasmi ada.")
3. **Peraturan MAKS(C, harga transaksi terakhir)** — cadangan BOLEH berada di bawah
   harga transaksi terakhir, terutama bila pasaran jatuh. Jangan paksa cadangan naik
   ke paras transaksi terakhir.
4. **RM1.55 sebagai harga lantai** — RM1.55 hanya nilai transaksi yang kerap muncul
   dalam data lama, bukan harga lantai. Jangan jadikannya lantai, ambang atau tapisan.
5. **Kiraan mingguan (R28/R180)** — formula ini bulanan sahaja.
6. Jangan campur aras ladang dan borong dalam satu kiraan (lihat Seksyen 2).

## 9. Contoh kerja untuk pengesahan (trek JUALAN, Disember 2026)

Contoh ini dari data peringkat **borong** — jadi ia mengesahkan trek JUALAN. Trek
BELIAN belum ada contoh kerja kerana data ladang belum dibekalkan.

> Nota: semua angka contoh ini ialah anggaran visual dari carta yang dikongsi
> 17 Nov 2026, BUKAN data sistem sebenar. Guna hanya untuk mengesahkan logik
> dashboard — dashboard sebenar mesti baca data sistem.

| Pemboleh ubah | Nilai contoh |
|---|---|
| Nisbah_2_Bulan | 0.83 |
| Nisbah_6_Bulan | 0.96 |
| Beza_Nisbah | 13.6% → guna Nisbah_2_Bulan |
| Harga_Pasaran | RM3.44 (AMI Nov RM4.15 × 0.83) |
| Nisbah_SISDA | 1.10 |
| Ralat_Ramalan | 16.7% → Berat_SISDA 0.10 |
| Harga_Ramalan | RM3.25 (SISDA Dis RM2.95 × 1.10) |
| **Harga_Cadangan** | **RM3.42** |
| Turun_Naik | ~32% → Lebar_Julat 10% |
| **Harga_Bawah – Harga_Atas** | **RM3.08 – RM3.76** |

Jika dashboard dimasukkan data contoh di atas, ia MESTI mengeluarkan tengah RM3.42
dan julat RM3.08–RM3.76 untuk trek JUALAN Disember 2026. Jika tidak, logiknya salah.

## 10. Penyerahan

- Dashboard siap dengan data contoh Seksyen 9 terisi, supaya pengesahan boleh dibuat
  sebelum sambung ke data sistem sebenar.
- Senarai semak pengesahan: (a) contoh Disember 2026 keluar RM3.42 / RM3.08–RM3.76;
  (b) tukar pemilih varieti/bulan dan semua kad, carta dan jadual berubah serentak;
  (c) padam satu input bulan terkini dan mesej "Data tidak lengkap" muncul;
  (d) tiada satu pun item Seksyen 8 muncul di mana-mana paparan;
  (e) kosongkan FIS bulan terkini sahaja: cadangan masih keluar, jadual diagnostik
  menunjukkan bulan yang dipakai, dan amaran (d) muncul;
  (f) kosongkan FIS untuk 5 daripada 6 bulan: mesej "Data tidak lengkap" muncul.

---

*Asas: formula akhir bulanan yang dipersetujui 18 Nov 2026 (dokumen
`dokumentasi-formula-fis-psi.pdf` 10 muka surat dan workbook
`Cadangan_Harga_FIS_PSI_Dis2026.xlsx`). Pembentangan rasmi: "kaedah gabungan ramalan
dengan tetingkap adaptif" — Bates & Granger (1969), Hamilton (1989).*

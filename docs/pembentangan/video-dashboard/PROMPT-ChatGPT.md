# Prompt untuk ChatGPT: Video Penerangan Dashboard FAMA (3 minit)

> Cara guna: muat naik **7 imej `babak-*.png`** (dan jika perlu `video-dashboard-3minit.mp4` sebagai rujukan susunan) ke ChatGPT, kemudian salin semua teks di bawah garis ini.

---

Anda ialah penerbit video korporat. Hasilkan **video penerangan berdurasi tepat 3 minit (180 saat)** untuk **pengurusan atasan FAMA** tentang fungsi *Dashboard Pemantauan & Intervensi Komoditi*.

## Keperluan umum
- **Bahasa:** Bahasa Malaysia standard (Dewan Bahasa dan Pustaka). Jangan guna Bahasa Indonesia.
- **Nada:** profesional, yakin, ringkas. Sasaran: pengurusan atasan yang mahu faham nilai dan fungsi, bukan butiran teknikal.
- **Format:** 16:9, 1920×1080, 30 fps.
- **Suara latar:** suara lelaki atau perempuan Bahasa Malaysia, kadar sederhana (±145 patah perkataan seminit). Gunakan teks narasi di bawah **tanpa mengubah angka atau fakta**.
- **Kapsyen:** paparkan kapsyen Bahasa Malaysia di bahagian bawah skrin (fail rujukan: `kapsyen-dashboard.srt`).
- **Muzik:** muzik latar korporat yang tenang dan rendah (≈ −20 dB di bawah suara).
- **Warna jenama:** latar biru gelap `#06122A`, aksen cyan `#22D3EE`, amaran merah `#EF4444`, kuning `#F5B400`, hijau `#22C55E`.
- **Visual:** gunakan imej tangkapan skrin yang dimuat naik sebagai visual utama. Tambah zum perlahan (Ken Burns), sorotan (highlight) dan anak panah pada bahagian yang disebut. **Jangan cipta skrin, angka atau data baharu.**

## Peraturan kandungan (wajib)
1. Dashboard ialah **alat sokongan keputusan, bukan sistem amaran rasmi**.
2. Data **bekalan, stok dan logistik ialah data contoh (dummy)**. Label "DATA DUMMY" yang kelihatan pada skrin hendaklah dikekalkan.
3. Angka contoh amaran ialah **data sebenar Minggu 2026-W45**: Timun Hijau, Runcit, Rompin, RM 5.00 → RM 10.00, z = 5.0, PO Kuantan merah (4 daerah merah).
4. Jangan sebut ciri yang tiada dalam senarai babak di bawah.

## Babak demi babak

| # | Masa | Imej | Teks pada skrin | Narasi (suara latar) |
|---|---|---|---|---|
| 1 | 0:00–0:15 | `babak-01-pemantauan.png` (dikaburkan, sebagai latar) | **Dashboard Pemantauan & Intervensi Komoditi FAMA** · *Alat sokongan keputusan untuk 15 Pusat Operasi* | Dashboard ini membantu FAMA memantau harga komoditi di 15 Pusat Operasi. Ia mempercepat keputusan intervensi. Ia alat sokongan keputusan, bukan sistem amaran rasmi. |
| 2 | 0:15–0:35 | `babak-01-pemantauan.png` (dikaburkan) + senarai ikon | **Sumber data:** Harga pasaran AMI · Harga transaksi FIS (Power BI) · Ramalan SISDA · Cuaca & amaran MET · Paras air JPS · Kualiti udara JAS · Berita AI Muse · *Bekalan & logistik: data contoh* | Dashboard menggabungkan harga pasaran AMI, harga transaksi FIS dan ramalan harga SISDA. Ia turut memaparkan cuaca MET, paras air sungai JPS, kualiti udara JAS dan berita AI Muse. Data bekalan dan logistik masih data contoh. |
| 3 | 0:35–0:50 | `babak-01-pemantauan.png` — sorot bar penapis, kemudian kad KPI | **Tab Pemantauan** | Di tab Pemantauan, pegawai menapis ikut negeri, PO, bulan, minggu dan komoditi. Kad di atas meringkaskan bilangan PO beramaran harga, berwaspada dan stabil. |
| 4 | 0:50–1:05 | `babak-02-peta.png` — sorot titik PO merah | **Peta 15 Pusat Operasi** | Pada peta, titik PO merah yang berkelip menandakan amaran harga. Kawasan daerah diwarnakan mengikut status harga: merah, kuning, hijau atau kelabu. |
| 5 | 1:05–1:35 | `babak-03-amaran-rompin.png` — sorot pop-up Daerah Rompin; dari 1:18 paparkan kotak pengiraan | **Cara amaran harga berfungsi.** Kotak: *Timun Hijau · Runcit · Rompin (2026-W45)* · Harga RM 5.00 → RM 10.00 (+100%) · Purata asas 2024 RM 3.96, sisihan piawai RM 1.20 · **z = (10.00 − 3.96) ÷ 1.20 = 5.0 → MERAH** · PO Kuantan merah: 4 daerah merah | Setiap minggu, harga setiap daerah dibandingkan dengan purata tahun asas dan had dasar. Contohnya, harga runcit timun hijau di Rompin naik dari RM 5 ke RM 10. Itu lima sisihan piawai di atas paras biasa, jadi statusnya merah. Satu PO menjadi merah apabila sekurang-kurangnya satu daerah di bawahnya merah. |
| 6 | 1:35–1:55 | `babak-04-risiko-banjir.png` — sorot ikon ombak merah/kuning dan panel lapisan cuaca | **Lapisan risiko** | Lapisan tambahan menunjukkan risiko bekalan: stesen banjir JPS mengikut warna merah, kuning dan hijau. Amaran cuaca rasmi MET, radar hujan dan sentimen berita turut dipaparkan. Pop-up menunjukkan lima isu utama. |
| 7 | 1:55–2:10 | `babak-05-intervensi.png` — sorot senarai keutamaan dan butang mod | **Tab Intervensi** | Tab Intervensi menyusun isu mengikut keutamaan. Mod Bekalan menilai harga ladang. Mod Pasaran menilai harga runcit. |
| 8 | 2:10–2:25 | `babak-06-mobilisasi.png` — sorot "Top 5 PO Luar Negeri" dan ringkasan cadangan | **Mobilisasi Stok** | Modul Mobilisasi Stok mencadangkan lima PO terbaik dalam dan luar negeri, termasuk PO tambahan. Calon dinilai berdasarkan jarak dan harga, dan draf cadangan intervensi boleh disediakan. |
| 9 | 2:25–2:45 | `babak-07-harga-cadangan-psi.png` — sorot dua kad cadangan dan baris margin | **Harga Cadangan PSI** | Modul Harga Cadangan PSI mengira julat harga belian ladang dan jualan borong bulan hadapan bagi setiap PO. Pengiraan memakai data AMI, FIS dan ramalan SISDA, serta margin kasar antara keduanya. |
| 10 | 2:45–3:00 | `babak-01-pemantauan.png` (dikaburkan) + logo/tajuk | **Langkah seterusnya:** Kemas kini data harga ke sumber terkini (Power BI) · Sahkan padanan varieti FIS · Sambung data bekalan & logistik sebenar | Dashboard sedia digunakan untuk pemantauan mingguan. Langkah seterusnya: data harga terkini, pengesahan padanan varieti FIS dan data bekalan sebenar. |

## Penyerahan yang diminta daripada ChatGPT
1. Fail video MP4 3 minit mengikut babak di atas, dengan suara latar, kapsyen dan muzik.
2. Jika video tidak dapat dijana terus: hasilkan (a) skrip suara latar akhir dengan tanda masa, (b) arahan suntingan babak demi babak untuk CapCut/Canva/PowerPoint, dan (c) fail kapsyen SRT yang diselaraskan.
3. Semak sebelum serah: jumlah masa 180 saat; semua angka sama seperti di atas; tiada Bahasa Indonesia; label "DATA DUMMY" kekal.

# Semakan: panel AI Multi-Scenario Monitoring (pas ulangan)
Panel ini menambah KPI, tiga kad senario, butiran dengan baris PO, AI Insight, laci PO, pra-isian intervensi dan ScenarioService ke dashboard sedia ada. Bukti coder (`ams-verification.md`, `ams-test-output.txt` dengan 99 lulus dan 0 gagal, tangkapan skrin 1440/1024/390) lengkap dan konsisten dengan fail semasa. Semakan `ams-review-check.js` sebelum ini mengesahkan baris `const DATA` sama dan hanya 4 baris asal berubah. Tangkapan skrin 1440 dengan S03 dipilih menunjukkan tajuk, lencana DATA DUMMY, KPI, kad S03 berwarna merah, pil "Risiko Tinggi", baris "2 senario" dengan "Juga dalam S01", laci PO, AI Insight dan dua butang. Susun atur peta, lajur kanan dan baris panel kekal sejajar.
Watch for: teks S02/S03 tidak dapat dibandingkan perkataan demi perkataan dengan mesej pengguna kerana mesej itu terpotong (possible). Nama PO kekal "PO Johor Baharu" mengikut DATA sedia ada, bukan "PO Johor Bahru" dalam spesifikasi (confirmed, disengajakan).
**Verdict**: APPROVED

## High-level view
Spesifikasi dipatuhi: KPI 3/6/2 dikira daripada set data, pil bertindih (S01 2/1/2, S02 1/1/1, S03 2/2) diterbitkan secara automatik, dan senario keempat berfungsi melalui data sahaja (diuji). Logik mengekalkan senario dan laci merentasi `renderAll()` dan `selectPO`, serta mengendalikan PO tiada, logistik tiada dan komoditi tidak sepadan (Sayur Berdaun: tiada data harga). Regresi rendah: DATA tidak berubah, panel tersembunyi kekal, `openActionModal` tanpa argumen kekal sama dan tiada ralat konsol.

## Issues (2)
1. **Teks S02/S03 tidak disahkan secara literal** (possible): bandingkan dengan mesej penuh pengguna. S03 dalam fail sepadan dengan nota coder tetapi pelan tidak memuatkan teks verbatim. Tidak menyekat.
2. **Nama "PO Johor Baharu"** (confirmed, minor): mengguna semula pengecam DATA sedia ada mengikut arahan "reuse PO identifiers". Tidak menyekat.

## Fail
`Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html`: panel, gaya, ScenarioService, kelas ring, kaitan `renderAll`, hujah pilihan `openActionModal`, `DASHBOARD_TEST`.

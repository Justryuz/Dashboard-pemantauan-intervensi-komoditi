# Fixture ujian banjir dan kualiti udara

Dipotong daripada respons sebenar yang diambil pada 2026-11-17 (GET sahaja, tanpa kunci atau token). Tiada rahsia.

| Fail                          | Asal                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `jps-nasional.json`           | 26 rekod sebenar daripada `latestreadingstrendabc.json` (JPS Public Info Banjir), bacaan sekitar 11:45 MYT. |
| `jps-selangor-telemetry.json` | 6 rekod sebenar daripada JPSAPI `LatestAlert/Telemetry`, bacaan 14:45-15:00 MYT.                            |
| `getdisse-sintetik.json`      | Sintetik. `getdisse.php` sentiasa `[]` semasa diuji; medan `MessageDT/EstimatedDT/EstimatedEndDT` tersirat. |
| `arcgis-banjir2024.json`      | 10 ciri sebenar `BANJIR_2024` (ArcGIS Selangor); 3 ciri disunting supaya lat/lon rentetan dengan ruang/tab. |
| `ipu-peta.json`               | 15 stesen sebenar lapisan peta JAS MyEQMS; `CA33J` dan `CA44T` disunting kepada `API: null`.                |
| `ipu-jam.json`                | Baris `apitablehourly` (24 jam) bagi stesen yang sama, tanpa medan `PAGE_*`.                                |

Rekod `jps-nasional.json` yang disunting (bukan sebenar sepenuhnya):

- `BTU10_LAPUK`: bacaan paras air dilapukkan (06:00) dengan hujan segar.
- `3016002_LEBAT`: kategori hujan `Heavy` (65 mm hari ini).

Masa rujukan (`sekarang`) untuk ujian unit: nasional `2026-11-17T04:30:00Z`, Selangor `2026-11-17T07:10:00Z`, IPU `2026-11-17T06:30:00Z`.

## Fixture AI Muse (Google Drive db-curated)

| Fail                              | Asal                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `muse/folder-akar.html`           | Dibina tangan meniru markup sebenar `embeddedfolderview`: folder harian, `Historical`, tarikh tidak sah dan satu fail.                      |
| `muse/folder-harian.html`         | Dibina tangan; `{{TARIKH}}` diganti oleh ujian. Ada `.json` db-curated, `.csv`, `cleansed` dan `raw` (hanya db-curated boleh dimuat turun). |
| `muse/db-curated-2026-11-15.json` | 5 rekod sebenar daripada `db-curated-2026-11-15.json` (Drive), diambil 2026-11-17.                                                          |
| `muse/db-curated-invalid.json`    | Sintetik: rekod tidak sah, baris tiada data, nombor sebagai rentetan, pendua.                                                               |

## Fixture lapisan cuaca

| Fail                        | Asal                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openmeteo-3pt.json`        | Respons sebenar Open-Meteo forecast (3 koordinat, 10 pembolehubah, 96 jam), 2026-11-17. Kes satu koordinat diuji dengan elemen pertama (objek tunggal). |
| `openmeteo-marine-3pt.json` | Respons sebenar Open-Meteo marine (3 koordinat; titik pertama ialah darat dan semua nilainya null).                                                     |
| `rainviewer-maps.json`      | Respons sebenar `weather-maps.json` RainViewer (13 bingkai radar lampau).                                                                               |
| `gdacs-tc.json`             | Respons sebenar GDACS (senarai TC + geometri ditapis); rujuk `_catatan`.                                                                                |
